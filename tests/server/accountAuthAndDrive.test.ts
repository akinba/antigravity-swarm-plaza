import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { AccountAuthManager } from '../../src/server/accountAuth.js';
import {
  listDriveEntries,
  pullDriveFolder,
  pushDriveFolder,
} from '../../src/server/googleDriveSync.js';

describe('AccountAuthManager & Google Drive Sync', () => {
  it('performs Google OAuth 2.0 PKCE flow, token refresh, and preserves existing provider keys in secrets file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-auth-google-'));
    const secretsFilePath = path.join(tempDir, 'secrets.json');
    fs.writeFileSync(secretsFilePath, JSON.stringify({ geminiApiKey: 'AIzaExistingKey' }), 'utf8');

    let tokenCalls = 0;
    const manager = new AccountAuthManager({
      secretsFilePath,
      fetchImpl: async (url) => {
        const u = String(url);
        if (u === 'https://oauth2.googleapis.com/token') {
          tokenCalls += 1;
          if (tokenCalls === 1) {
            return new Response(
              JSON.stringify({
                access_token: 'goog-access-1',
                refresh_token: 'goog-refresh-1',
                expires_in: 3600,
                scope: 'openid email https://www.googleapis.com/auth/drive',
              }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({
              access_token: 'goog-access-refreshed',
              expires_in: 3600,
            }),
            { status: 200 },
          );
        }
        if (u === 'https://www.googleapis.com/oauth2/v2/userinfo') {
          return new Response(
            JSON.stringify({ email: 'dev@example.com', name: 'Dev User' }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      },
    });

    try {
      const clientStatus = manager.saveGoogleOAuthClient({ clientId: 'goog-client-id-1' });
      assert.equal(clientStatus.hasClientId, true);
      assert.equal(clientStatus.connected, false);

      const { authUrl, state } = manager.startGoogleAuth('http://127.0.0.1:3210');
      assert.match(authUrl, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
      assert.match(authUrl, /code_challenge_method=S256/);
      assert.match(authUrl, /access_type=offline/);

      const cb = await manager.handleGoogleCallback('auth-code-123', state, 'http://127.0.0.1:3210');
      assert.equal(cb.ok, true);
      assert.equal(cb.account?.connected, true);
      assert.equal(cb.account?.email, 'dev@example.com');
      assert.match(cb.html, /swarm_auth_complete/);

      // Existing provider keys must remain intact
      const savedRaw = JSON.parse(fs.readFileSync(secretsFilePath, 'utf8')) as {
        geminiApiKey?: string;
        accounts?: { google?: { expiresAt?: number } };
      };
      assert.equal(savedRaw.geminiApiKey, 'AIzaExistingKey');

      assert.equal(await manager.getValidGoogleAccessToken(), 'goog-access-1');

      // Force token expiry and verify auto-refresh
      savedRaw.accounts!.google!.expiresAt = Date.now() - 10_000;
      fs.writeFileSync(secretsFilePath, JSON.stringify(savedRaw, null, 2), 'utf8');
      assert.equal(await manager.getValidGoogleAccessToken(), 'goog-access-refreshed');

      const disconnected = manager.disconnectAccount('google');
      assert.equal(disconnected.connected, false);
      assert.equal(disconnected.hasClientId, true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('imports GitHub gh CLI session and supports Device Flow polling + disconnect', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-auth-gh-'));
    const secretsFilePath = path.join(tempDir, 'secrets.json');
    let pollCount = 0;

    const manager = new AccountAuthManager({
      secretsFilePath,
      execFileImpl: async (cmd, args) => {
        assert.equal(cmd, 'gh');
        assert.deepEqual(args, ['auth', 'token']);
        return { stdout: 'gho_cli_token_123\n', stderr: '' };
      },
      fetchImpl: async (url) => {
        const u = String(url);
        if (u === 'https://api.github.com/user') {
          return new Response(
            JSON.stringify({ login: 'octocat', avatar_url: 'https://avatars.example/octo.png' }),
            { status: 200 },
          );
        }
        if (u === 'https://github.com/login/device/code') {
          return new Response(
            JSON.stringify({
              user_code: 'ABCD-1234',
              verification_uri: 'https://github.com/login/device',
              device_code: 'dev-code-1',
              interval: 5,
            }),
            { status: 200 },
          );
        }
        if (u === 'https://github.com/login/oauth/access_token') {
          pollCount += 1;
          if (pollCount === 1) {
            return new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 200 });
          }
          return new Response(
            JSON.stringify({ access_token: 'gho_device_token_456', scope: 'repo,read:user' }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      },
    });

    try {
      const imported = await manager.importGhCliAccount();
      assert.equal(imported.ok, true);
      assert.equal(imported.account?.username, 'octocat');
      assert.equal(imported.account?.source, 'gh_cli');
      assert.equal(manager.getGitHubToken(), 'gho_cli_token_123');

      manager.disconnectAccount('github');
      assert.equal(manager.getGitHubToken(), null);

      const started = await manager.startGitHubDeviceFlow();
      assert.equal(started.ok, true);
      assert.equal(started.userCode, 'ABCD-1234');

      const pending = await manager.pollGitHubDeviceFlow(started.deviceCode!);
      assert.equal(pending.status, 'pending');

      const connected = await manager.pollGitHubDeviceFlow(started.deviceCode!);
      assert.equal(connected.status, 'connected');
      assert.equal(connected.account?.username, 'octocat');
      assert.equal(manager.getGitHubToken(), 'gho_device_token_456');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists, pulls (skipping binaries), and pushes (PATCH updated, POST new, skip unchanged) Google Drive folders', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-gdrive-'));
    const patchedIds: string[] = [];
    const createdNames: string[] = [];

    const mockFetch: typeof fetch = async (url, init) => {
      const u = String(url);
      const method = init?.method ?? 'GET';

      if (method === 'GET' && u.includes('drive/v3/files?q=')) {
        if (u.includes("'root'")) {
          return new Response(
            JSON.stringify({
              files: [
                {
                  id: 'sub-src',
                  name: 'src',
                  mimeType: 'application/vnd.google-apps.folder',
                },
                { id: 'file-readme', name: 'README.md', mimeType: 'text/markdown', size: '12' },
                { id: 'file-img', name: 'logo.png', mimeType: 'image/png', size: '500' },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            files: [{ id: 'file-app', name: 'app.ts', mimeType: 'text/plain', size: '24' }],
          }),
          { status: 200 },
        );
      }

      if (method === 'GET' && u.includes('file-readme?alt=media')) {
        return new Response('# Hello Drive', { status: 200 });
      }
      if (method === 'GET' && u.includes('file-app?alt=media')) {
        return new Response('export const x = 1;', { status: 200 });
      }
      if (method === 'PATCH' && u.includes('upload/drive/v3/files/file-readme')) {
        patchedIds.push('file-readme');
        return new Response(JSON.stringify({ id: 'file-readme' }), { status: 200 });
      }
      if (method === 'POST' && u.includes('upload/drive/v3/files?uploadType=multipart')) {
        createdNames.push('notes.txt');
        return new Response(JSON.stringify({ id: 'file-notes-new' }), { status: 200 });
      }

      return new Response('{}', { status: 404 });
    };

    try {
      const rootEntries = await listDriveEntries('token-1', 'root', mockFetch);
      assert.equal(rootEntries.length, 3);
      assert.equal(rootEntries[0]?.isFolder, true);

      const pullRes = await pullDriveFolder('token-1', 'root', tempDir, mockFetch);
      assert.equal(pullRes.downloaded, 2);
      assert.equal(pullRes.skipped, 1); // logo.png skipped
      assert.equal(fs.readFileSync(path.join(tempDir, 'README.md'), 'utf8'), '# Hello Drive');
      assert.equal(fs.readFileSync(path.join(tempDir, 'src', 'app.ts'), 'utf8'), 'export const x = 1;');
      assert.ok(!fs.existsSync(path.join(tempDir, 'logo.png')));

      // Modify README.md, leave src/app.ts unchanged, and add notes.txt
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Updated Drive', 'utf8');
      fs.writeFileSync(path.join(tempDir, 'notes.txt'), 'New local note', 'utf8');

      const pushRes = await pushDriveFolder('token-1', 'root', tempDir, mockFetch);
      assert.deepEqual(pushRes, { uploaded: 1, created: 1, skipped: 1 });
      assert.deepEqual(patchedIds, ['file-readme']);
      assert.deepEqual(createdNames, ['notes.txt']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
