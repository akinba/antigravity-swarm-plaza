import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AccountProvider, ConnectedAccountInfo } from '../shared/types.js';

const execFileAsync = promisify(execFile);

const DEFAULT_GITHUB_DEVICE_CLIENT_ID = '178c6fc778ccc68e1d6a';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
];

interface StoredGoogleAccount {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
  name?: string;
  scopes?: string[];
}

interface StoredGitHubAccount {
  clientId?: string;
  token?: string;
  username?: string;
  avatarUrl?: string;
  scopes?: string[];
  source?: 'oauth' | 'gh_cli' | 'pat';
}

interface StoredAccountsRoot {
  google?: StoredGoogleAccount;
  github?: StoredGitHubAccount;
}

export type AuthExecFileFn = (
  cmd: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export interface AccountAuthManagerOptions {
  secretsFilePath?: string;
  fetchImpl?: typeof fetch;
  execFileImpl?: AuthExecFileFn;
}

export class AccountAuthManager {
  private readonly secretsFilePath: string;
  private readonly fetchImpl: typeof fetch;
  private readonly execFileImpl: AuthExecFileFn;
  private readonly pendingGooglePkce = new Map<
    string,
    { codeVerifier: string; createdAt: number }
  >();

  constructor(options: AccountAuthManagerOptions = {}) {
    this.secretsFilePath =
      options.secretsFilePath ?? path.join(os.homedir(), '.gemini', 'swarm-plaza-secrets.json');
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.execFileImpl =
      options.execFileImpl ??
      ((cmd, args) => execFileAsync(cmd, args, { encoding: 'utf8' }));
  }

  private readAllSecrets(): Record<string, unknown> {
    try {
      if (!fs.existsSync(this.secretsFilePath)) return {};
      return JSON.parse(fs.readFileSync(this.secretsFilePath, 'utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private readAccounts(): StoredAccountsRoot {
    const root = this.readAllSecrets();
    const accounts = root.accounts;
    if (!accounts || typeof accounts !== 'object') return {};
    return accounts as StoredAccountsRoot;
  }

  private writeAccounts(accounts: StoredAccountsRoot): void {
    const dir = path.dirname(this.secretsFilePath);
    fs.mkdirSync(dir, { recursive: true });
    const root = this.readAllSecrets();
    root.accounts = accounts;
    fs.writeFileSync(this.secretsFilePath, JSON.stringify(root, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  private resolveGoogleClient(): { clientId: string; clientSecret?: string } {
    const g = this.readAccounts().google;
    const clientId =
      g?.clientId?.trim() || (process.env.GOOGLE_OAUTH_CLIENT_ID ?? '').trim();
    const clientSecret =
      g?.clientSecret?.trim() || (process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '').trim() || undefined;
    return { clientId, clientSecret };
  }

  getAccountsStatus(): { google: ConnectedAccountInfo; github: ConnectedAccountInfo } {
    const accounts = this.readAccounts();
    const g = accounts.google;
    const gh = accounts.github;
    const { clientId: googleClientId } = this.resolveGoogleClient();

    return {
      google: {
        provider: 'google',
        connected: Boolean(g?.accessToken || g?.refreshToken),
        username: g?.name,
        email: g?.email,
        scopes: g?.scopes,
        source: g?.accessToken || g?.refreshToken ? 'oauth' : undefined,
        hasClientId: Boolean(googleClientId),
      },
      github: {
        provider: 'github',
        connected: Boolean(gh?.token),
        username: gh?.username,
        avatarUrl: gh?.avatarUrl,
        scopes: gh?.scopes,
        source: gh?.token ? (gh.source ?? 'oauth') : undefined,
        hasClientId: Boolean(gh?.clientId || process.env.GITHUB_OAUTH_CLIENT_ID),
      },
    };
  }

  saveGoogleOAuthClient(params: { clientId: string; clientSecret?: string }): ConnectedAccountInfo {
    const clientId = params.clientId.trim();
    if (!clientId) {
      throw new Error('Google OAuth Client ID is required.');
    }
    const accounts = this.readAccounts();
    accounts.google = {
      ...(accounts.google ?? {}),
      clientId,
      ...(params.clientSecret?.trim()
        ? { clientSecret: params.clientSecret.trim() }
        : {}),
    };
    this.writeAccounts(accounts);
    return this.getAccountsStatus().google;
  }

  startGoogleAuth(callbackBaseUrl: string): { ok: true; authUrl: string; state: string } {
    const { clientId } = this.resolveGoogleClient();
    if (!clientId) {
      throw new Error(
        'Google OAuth Client ID is not configured. Save your Client ID in Settings -> Accounts first.',
      );
    }

    const now = Date.now();
    for (const [k, v] of this.pendingGooglePkce.entries()) {
      if (now - v.createdAt > 10 * 60_000) {
        this.pendingGooglePkce.delete(k);
      }
    }

    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomUUID();
    this.pendingGooglePkce.set(state, { codeVerifier, createdAt: now });

    const cleanBase = callbackBaseUrl.replace(/\/+$/, '');
    const redirectUri = `${cleanBase}/api/auth/google/callback`;

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');

    return { ok: true, authUrl: url.toString(), state };
  }

  async handleGoogleCallback(
    code: string,
    state: string,
    callbackBaseUrl: string,
  ): Promise<{ ok: boolean; html: string; account?: ConnectedAccountInfo; error?: string }> {
    const pending = this.pendingGooglePkce.get(state);
    if (!pending || !code.trim()) {
      const msg = !code.trim() ? 'Missing authorization code.' : 'Invalid or expired OAuth state.';
      return {
        ok: false,
        error: msg,
        html: `<!doctype html><html><body style="background:#131622;color:#ff5666;font-family:monospace;padding:24px;"><h3>Google Auth Error</h3><p>${msg}</p></body></html>`,
      };
    }
    this.pendingGooglePkce.delete(state);

    const { clientId, clientSecret } = this.resolveGoogleClient();
    const cleanBase = callbackBaseUrl.replace(/\/+$/, '');
    const redirectUri = `${cleanBase}/api/auth/google/callback`;

    const form = new URLSearchParams({
      code: code.trim(),
      client_id: clientId,
      code_verifier: pending.codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (clientSecret) {
      form.set('client_secret', clientSecret);
    }

    const tokenRes = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      const msg = `Google token exchange failed (HTTP ${tokenRes.status}): ${errText}`;
      return {
        ok: false,
        error: msg,
        html: `<!doctype html><html><body style="background:#131622;color:#ff5666;font-family:monospace;padding:24px;"><h3>Google Auth Error</h3><p>${msg}</p></body></html>`,
      };
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!tokenData.access_token) {
      return {
        ok: false,
        error: 'Google did not return an access_token.',
        html: '<!doctype html><html><body style="background:#131622;color:#ff5666;font-family:monospace;padding:24px;"><h3>Google Auth Error</h3><p>Missing access_token.</p></body></html>',
      };
    }

    let email: string | undefined;
    let name: string | undefined;
    try {
      const userRes = await this.fetchImpl('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userJson = (await userRes.json()) as { email?: string; name?: string };
        email = userJson.email;
        name = userJson.name;
      }
    } catch {
      // Optional userinfo lookup
    }

    const accounts = this.readAccounts();
    const expiresInSec = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600;
    accounts.google = {
      ...(accounts.google ?? {}),
      clientId,
      ...(clientSecret ? { clientSecret } : {}),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? accounts.google?.refreshToken,
      expiresAt: Date.now() + Math.max(60, expiresInSec - 60) * 1000,
      email: email ?? accounts.google?.email,
      name: name ?? accounts.google?.name,
      scopes: tokenData.scope ? tokenData.scope.split(/\s+/) : GOOGLE_SCOPES,
    };
    this.writeAccounts(accounts);

    const account = this.getAccountsStatus().google;
    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Google Connected</title></head>
<body style="background:#131622;color:#3be87a;font-family:monospace;padding:24px;text-align:center;">
  <h3>Google Account Connected</h3>
  <p>${email || name || 'Connected'}. You can close this window.</p>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'swarm_auth_complete', provider: 'google' }, '*');
      }
      setTimeout(function () { window.close(); }, 350);
    } catch (e) {}
  </script>
</body>
</html>`;

    return { ok: true, html, account };
  }

  async getValidGoogleAccessToken(): Promise<string | null> {
    const accounts = this.readAccounts();
    const g = accounts.google;
    if (!g) return null;

    if (g.accessToken && (!g.expiresAt || Date.now() < g.expiresAt)) {
      return g.accessToken;
    }

    if (!g.refreshToken) {
      return g.accessToken ?? null;
    }

    const { clientId, clientSecret } = this.resolveGoogleClient();
    if (!clientId) return null;

    const form = new URLSearchParams({
      client_id: clientId,
      refresh_token: g.refreshToken,
      grant_type: 'refresh_token',
    });
    if (clientSecret) {
      form.set('client_secret', clientSecret);
    }

    try {
      const res = await this.fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) return null;
      const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;
      accounts.google = {
        ...g,
        accessToken: data.access_token,
        expiresAt: Date.now() + Math.max(60, expiresInSec - 60) * 1000,
      };
      this.writeAccounts(accounts);
      return data.access_token;
    } catch {
      return null;
    }
  }

  private async fetchGitHubUser(
    token: string,
  ): Promise<{ login: string; avatarUrl?: string }> {
    const res = await this.fetchImpl('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'antigravity-swarm-plaza',
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub user lookup failed (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { login?: string; avatar_url?: string };
    return {
      login: data.login || 'github-user',
      avatarUrl: data.avatar_url,
    };
  }

  async importGhCliAccount(): Promise<{ ok: boolean; account?: ConnectedAccountInfo; error?: string }> {
    try {
      const { stdout } = await this.execFileImpl('gh', ['auth', 'token']);
      const token = stdout.trim();
      if (!token) {
        return { ok: false, error: 'gh CLI returned an empty token. Run "gh auth login" first.' };
      }
      const user = await this.fetchGitHubUser(token);
      const accounts = this.readAccounts();
      accounts.github = {
        ...(accounts.github ?? {}),
        token,
        username: user.login,
        avatarUrl: user.avatarUrl,
        scopes: ['repo', 'read:user'],
        source: 'gh_cli',
      };
      this.writeAccounts(accounts);
      return { ok: true, account: this.getAccountsStatus().github };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Could not import gh CLI session: ${detail}`,
      };
    }
  }

  async startGitHubDeviceFlow(clientId?: string): Promise<{
    ok: boolean;
    userCode?: string;
    verificationUri?: string;
    deviceCode?: string;
    interval?: number;
    error?: string;
  }> {
    const resolvedClientId =
      clientId?.trim() ||
      this.readAccounts().github?.clientId?.trim() ||
      (process.env.GITHUB_OAUTH_CLIENT_ID ?? '').trim() ||
      DEFAULT_GITHUB_DEVICE_CLIENT_ID;

    try {
      const res = await this.fetchImpl('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: resolvedClientId,
          scope: 'repo read:user',
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `GitHub device flow start failed (HTTP ${res.status})` };
      }
      const data = (await res.json()) as {
        user_code?: string;
        verification_uri?: string;
        device_code?: string;
        interval?: number;
      };
      if (!data.user_code || !data.device_code || !data.verification_uri) {
        return { ok: false, error: 'GitHub did not return a valid device flow payload.' };
      }
      const accounts = this.readAccounts();
      accounts.github = {
        ...(accounts.github ?? {}),
        clientId: resolvedClientId,
      };
      this.writeAccounts(accounts);

      return {
        ok: true,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        deviceCode: data.device_code,
        interval: data.interval ?? 5,
      };
    } catch (err) {
      return {
        ok: false,
        error: `GitHub device flow request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async pollGitHubDeviceFlow(
    deviceCode: string,
    clientId?: string,
  ): Promise<{
    ok: boolean;
    status: 'pending' | 'connected' | 'error';
    account?: ConnectedAccountInfo;
    error?: string;
  }> {
    const resolvedClientId =
      clientId?.trim() ||
      this.readAccounts().github?.clientId?.trim() ||
      (process.env.GITHUB_OAUTH_CLIENT_ID ?? '').trim() ||
      DEFAULT_GITHUB_DEVICE_CLIENT_ID;

    try {
      const res = await this.fetchImpl('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: resolvedClientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });
      if (!res.ok) {
        return {
          ok: false,
          status: 'error',
          error: `GitHub token poll failed (HTTP ${res.status})`,
        };
      }
      const data = (await res.json()) as {
        access_token?: string;
        scope?: string;
        error?: string;
        error_description?: string;
      };
      if (data.error === 'authorization_pending' || data.error === 'slow_down') {
        return { ok: true, status: 'pending' };
      }
      if (!data.access_token) {
        return {
          ok: false,
          status: 'error',
          error: data.error_description || data.error || 'GitHub device authorization failed.',
        };
      }

      const user = await this.fetchGitHubUser(data.access_token);
      const accounts = this.readAccounts();
      accounts.github = {
        ...(accounts.github ?? {}),
        clientId: resolvedClientId,
        token: data.access_token,
        username: user.login,
        avatarUrl: user.avatarUrl,
        scopes: data.scope ? data.scope.split(/[,\s]+/).filter(Boolean) : ['repo', 'read:user'],
        source: 'oauth',
      };
      this.writeAccounts(accounts);
      return {
        ok: true,
        status: 'connected',
        account: this.getAccountsStatus().github,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  getGitHubToken(): string | null {
    return this.readAccounts().github?.token?.trim() || null;
  }

  disconnectAccount(provider: AccountProvider): ConnectedAccountInfo {
    const accounts = this.readAccounts();
    if (provider === 'google') {
      const clientId = accounts.google?.clientId;
      const clientSecret = accounts.google?.clientSecret;
      accounts.google = clientId ? { clientId, ...(clientSecret ? { clientSecret } : {}) } : {};
    } else {
      const clientId = accounts.github?.clientId;
      accounts.github = clientId ? { clientId } : {};
    }
    this.writeAccounts(accounts);
    return this.getAccountsStatus()[provider];
  }
}

export const defaultAccountAuthManager = new AccountAuthManager();
