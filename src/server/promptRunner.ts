import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  CloudProviderId,
  DiffFileChange,
  GeminiModelInfo,
  OllamaModelInfo,
  PromptModelId,
  PromptProvider,
  PromptRequest,
  PromptStreamEvent,
  ProviderModelInfo,
} from '../shared/types.js';
import { CURRENT_WORKSPACE } from './config.js';

const execFileAsync = promisify(execFile);

export type PromptRunnerStatus = 'running' | 'idle' | 'stopped' | 'error';

export interface ActivePromptAgentOverride {
  agentKey: string;
  status: 'working';
  currentFile?: string;
  floorId?: string;
  startedAt: number;
}

export interface PromptRunnerState {
  runId: string | null;
  status: PromptRunnerStatus;
  logs: PromptStreamEvent[];
  diffs: DiffFileChange[];
  activeAgents: ActivePromptAgentOverride[];
  model?: PromptModelId;
  workspace?: string;
}

export type ExecFileFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

export interface PromptRunnerOptions {
  fetchImpl?: typeof fetch;
  spawnImpl?: typeof spawn;
  execFileImpl?: ExecFileFn;
  resolveCliCommand?: (cmd: string) => Promise<string | null>;
  ollamaUrl?: string;
  cliCommand?: string;
  geminiApiKey?: string;
  providerKeys?: Partial<Record<CloudProviderId, string>>;
  secretsFilePath?: string;
  defaultWorkspace?: string;
  maxLogs?: number;
}

export type KeySource = 'env' | 'settings' | 'none';
export type GeminiKeySource = KeySource;

export interface ProviderKeyStatus {
  configured: boolean;
  masked: string;
  source: KeySource;
}
export type GeminiApiKeyStatus = ProviderKeyStatus;

export const CLOUD_PROVIDER_IDS: readonly CloudProviderId[] = [
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'copilot',
];

export const ALL_PROMPT_PROVIDERS: readonly PromptProvider[] = [
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'copilot',
  'ollama',
  'lmstudio',
];

export function isCloudProviderId(value: string): value is CloudProviderId {
  return (CLOUD_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isPromptProvider(value: string): value is PromptProvider {
  return (ALL_PROMPT_PROVIDERS as readonly string[]).includes(value);
}

const CLOUD_ENV_VARS: Record<CloudProviderId, readonly string[]> = {
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  copilot: ['GITHUB_TOKEN', 'COPILOT_TOKEN'],
};

const SECRET_JSON_KEYS: Record<CloudProviderId, string> = {
  gemini: 'geminiApiKey',
  openai: 'openaiApiKey',
  anthropic: 'anthropicApiKey',
  openrouter: 'openrouterApiKey',
  copilot: 'copilotApiKey',
};

const COPILOT_FALLBACK_MODELS: readonly ProviderModelInfo[] = [
  { id: 'gpt-4o', displayName: 'GPT-4o (Copilot)', provider: 'copilot' },
  { id: 'gpt-4.1', displayName: 'GPT-4.1 (Copilot)', provider: 'copilot' },
  { id: 'o3-mini', displayName: 'o3-mini (Copilot)', provider: 'copilot' },
  { id: 'claude-3.5-sonnet', displayName: 'Claude 3.5 Sonnet (Copilot)', provider: 'copilot' },
];

export class PromptConflictError extends Error {
  constructor(message = 'A prompt run is already in progress') {
    super(message);
    this.name = 'PromptConflictError';
  }
}

export class InvalidDiffPathError extends Error {
  constructor(message = 'Invalid or unsafe diff file path') {
    super(message);
    this.name = 'InvalidDiffPathError';
  }
}

export class InvalidOllamaUrlError extends Error {
  constructor(message = 'Invalid or disallowed Ollama base URL') {
    super(message);
    this.name = 'InvalidOllamaUrlError';
  }
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h === '0.0.0.0') {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function resolveSafeLocalBaseUrl(
  rawUrl?: string,
  defaultUrl = 'http://localhost:11434',
): string {
  const candidate = (rawUrl ?? defaultUrl).trim() || defaultUrl;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new InvalidOllamaUrlError(`Invalid local provider URL: ${candidate}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidOllamaUrlError(
      `Unsupported protocol for local provider URL: ${parsed.protocol}`,
    );
  }
  if (!isPrivateOrLocalHostname(parsed.hostname)) {
    throw new InvalidOllamaUrlError(
      `Disallowed external host for local provider URL: ${parsed.hostname} (only localhost / private LAN allowed)`,
    );
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

export function resolveSafeOllamaBaseUrl(rawUrl?: string): string {
  return resolveSafeLocalBaseUrl(rawUrl, 'http://localhost:11434');
}

export function stripProviderPrefix(model: string): string {
  return model.replace(/^(?:ollama|lmstudio|openai|anthropic|openrouter|copilot|gemini):/, '').trim();
}

export function resolveRequestProvider(req: PromptRequest): PromptProvider {
  if (req.provider && isPromptProvider(req.provider)) {
    return req.provider;
  }
  for (const p of ALL_PROMPT_PROVIDERS) {
    if (req.model.startsWith(`${p}:`)) {
      return p;
    }
  }
  if (req.model === 'qwen2.5-coder:14b') return 'ollama';
  return 'gemini';
}

export function isOllamaRequest(req: PromptRequest): boolean {
  return resolveRequestProvider(req) === 'ollama';
}

export function mapGeminiRestModel(model: string): string {
  const clean = model.replace(/^models\//, '').trim();
  if (clean === 'gemini-4-carbon-medium') return 'gemini-2.5-pro';
  if (
    clean === 'gemini-4-argon-medium' ||
    clean === 'gemini-4-hydrogen-medium' ||
    clean === 'gemini-3.8-flash-fast'
  ) {
    return 'gemini-2.5-flash';
  }
  return clean || 'gemini-2.5-flash';
}

export function maskSecretKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export async function defaultResolveCliCommand(cmd: string): Promise<string | null> {
  const trimmed = cmd.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return fs.existsSync(trimmed) ? trimmed : null;
  }
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    const { stdout } = await execFileAsync(locator, [trimmed], { encoding: 'utf8' });
    const first = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

const FILE_PATH_REGEX =
  /\b((?:src|tests|docs|plugin|scripts)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)\b/;

export function resolveSafeWorkspaceFile(workspaceRoot: string, filePath: string): string {
  if (!filePath || typeof filePath !== 'string' || filePath.includes('\0')) {
    throw new InvalidDiffPathError('Diff path must be a non-empty string without null bytes');
  }
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, filePath);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new InvalidDiffPathError(`Path escapes workspace root: ${filePath}`);
  }
  return resolved;
}

export function parseGitNumstat(stdout: string): DiffFileChange[] {
  const changes: DiffFileChange[] = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\t+/);
    if (parts.length < 3) continue;
    const added = parts[0] === '-' ? 0 : Number.parseInt(parts[0], 10) || 0;
    const removed = parts[1] === '-' ? 0 : Number.parseInt(parts[1], 10) || 0;
    const filePath = parts.slice(2).join('\t').trim();
    if (!filePath) continue;
    changes.push({
      path: filePath,
      added,
      removed,
      status: 'pending',
    });
  }
  return changes;
}

export class PromptRunner {
  private readonly fetchImpl: typeof fetch;
  private readonly spawnImpl: typeof spawn;
  private readonly execFileImpl: ExecFileFn;
  private readonly resolveCliCommandFn: (cmd: string) => Promise<string | null>;
  private readonly ollamaUrl: string;
  private readonly cliCommand: string;
  private readonly secretsFilePath: string;
  private readonly envProviderKeys: Record<CloudProviderId, string>;
  private readonly providerKeys: Record<CloudProviderId, { key: string; source: KeySource }>;
  private readonly defaultWorkspace: string;
  private readonly maxLogs: number;

  private runId: string | null = null;
  private status: PromptRunnerStatus = 'idle';
  private model: PromptModelId | undefined;
  private workspace: string;
  private abortController: AbortController | null = null;
  private childProcess: ChildProcess | null = null;
  private logs: PromptStreamEvent[] = [];
  private diffs: DiffFileChange[] = [];
  private activeOverrides = new Map<string, ActivePromptAgentOverride>();
  private listeners = new Set<(event: PromptStreamEvent) => void>();
  private activeRunPromise: Promise<void> | null = null;

  constructor(options: PromptRunnerOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.spawnImpl = options.spawnImpl ?? spawn;
    this.execFileImpl =
      options.execFileImpl ??
      ((cmd, args, opts) => execFileAsync(cmd, args, { cwd: opts.cwd, encoding: 'utf8' }));
    this.resolveCliCommandFn = options.resolveCliCommand ?? defaultResolveCliCommand;
    this.ollamaUrl =
      options.ollamaUrl ?? process.env.OLLAMA_CHAT_URL ?? 'http://localhost:11434/api/chat';
    this.cliCommand = options.cliCommand ?? process.env.ANTIGRAVITY_CLI_CMD ?? 'agy';
    this.secretsFilePath =
      options.secretsFilePath ?? path.join(os.homedir(), '.gemini', 'swarm-plaza-secrets.json');

    this.envProviderKeys = {
      gemini: this.readEnvKey('gemini'),
      openai: this.readEnvKey('openai'),
      anthropic: this.readEnvKey('anthropic'),
      openrouter: this.readEnvKey('openrouter'),
      copilot: this.readEnvKey('copilot'),
    };

    const savedSecrets = this.readAllSavedSecrets();
    this.providerKeys = {
      gemini: this.initProviderKey('gemini', options, savedSecrets),
      openai: this.initProviderKey('openai', options, savedSecrets),
      anthropic: this.initProviderKey('anthropic', options, savedSecrets),
      openrouter: this.initProviderKey('openrouter', options, savedSecrets),
      copilot: this.initProviderKey('copilot', options, savedSecrets),
    };

    this.defaultWorkspace = options.defaultWorkspace ?? CURRENT_WORKSPACE;
    this.workspace = this.defaultWorkspace;
    this.maxLogs = options.maxLogs ?? 200;
  }

  private readEnvKey(provider: CloudProviderId): string {
    for (const envName of CLOUD_ENV_VARS[provider]) {
      const val = process.env[envName]?.trim();
      if (val) return val;
    }
    return '';
  }

  private readAllSavedSecrets(): Record<string, unknown> {
    try {
      if (!fs.existsSync(this.secretsFilePath)) return {};
      return JSON.parse(fs.readFileSync(this.secretsFilePath, 'utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private initProviderKey(
    provider: CloudProviderId,
    options: PromptRunnerOptions,
    savedSecrets: Record<string, unknown>,
  ): { key: string; source: KeySource } {
    const explicit =
      provider === 'gemini' && options.geminiApiKey !== undefined
        ? options.geminiApiKey
        : options.providerKeys?.[provider];
    if (explicit !== undefined) {
      const k = explicit.trim();
      return { key: k, source: k ? 'env' : 'none' };
    }
    const jsonKey = savedSecrets[SECRET_JSON_KEYS[provider]];
    if (typeof jsonKey === 'string' && jsonKey.trim()) {
      return { key: jsonKey.trim(), source: 'settings' };
    }
    const envVal = this.envProviderKeys[provider];
    if (envVal) {
      return { key: envVal, source: 'env' };
    }
    return { key: '', source: 'none' };
  }

  getProviderKeyStatus(provider: CloudProviderId): ProviderKeyStatus {
    const entry = this.providerKeys[provider];
    return {
      configured: Boolean(entry.key),
      masked: maskSecretKey(entry.key),
      source: entry.source,
    };
  }

  setProviderKey(provider: CloudProviderId, apiKey: string): ProviderKeyStatus {
    const trimmed = (apiKey ?? '').trim();
    const jsonField = SECRET_JSON_KEYS[provider];
    const dir = path.dirname(this.secretsFilePath);

    if (!trimmed) {
      try {
        if (fs.existsSync(this.secretsFilePath)) {
          const parsed = this.readAllSavedSecrets();
          delete parsed[jsonField];
          if (Object.keys(parsed).length === 0) {
            fs.unlinkSync(this.secretsFilePath);
          } else {
            fs.writeFileSync(this.secretsFilePath, JSON.stringify(parsed, null, 2), {
              encoding: 'utf8',
              mode: 0o600,
            });
          }
        }
      } catch {
        // Ignore cleanup errors
      }
      const envVal = this.envProviderKeys[provider];
      this.providerKeys[provider] = envVal
        ? { key: envVal, source: 'env' }
        : { key: '', source: 'none' };
      return this.getProviderKeyStatus(provider);
    }

    fs.mkdirSync(dir, { recursive: true });
    const existing = this.readAllSavedSecrets();
    existing[jsonField] = trimmed;
    fs.writeFileSync(this.secretsFilePath, JSON.stringify(existing, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    this.providerKeys[provider] = { key: trimmed, source: 'settings' };
    return this.getProviderKeyStatus(provider);
  }

  getGeminiApiKeyStatus(): GeminiApiKeyStatus {
    return this.getProviderKeyStatus('gemini');
  }

  setGeminiApiKey(apiKey: string): GeminiApiKeyStatus {
    return this.setProviderKey('gemini', apiKey);
  }

  subscribe(listener: (event: PromptStreamEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getActiveOverrides(): ReadonlyMap<string, ActivePromptAgentOverride> {
    return this.activeOverrides;
  }

  getState(): PromptRunnerState {
    return {
      runId: this.runId,
      status: this.status,
      logs: [...this.logs],
      diffs: this.diffs.map((d) => ({ ...d })),
      activeAgents: Array.from(this.activeOverrides.values()).map((a) => ({ ...a })),
      model: this.model,
      workspace: this.workspace,
    };
  }

  async waitForIdle(): Promise<void> {
    if (this.activeRunPromise) {
      await this.activeRunPromise;
    }
  }

  async fetchOllamaModels(
    baseUrl?: string,
  ): Promise<{ ok: boolean; models: OllamaModelInfo[]; error?: string }> {
    const safeBase = resolveSafeOllamaBaseUrl(baseUrl);
    try {
      const response = await this.fetchImpl(`${safeBase}/api/tags`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        return {
          ok: false,
          models: [],
          error: `Ollama HTTP ${response.status} ${response.statusText}`,
        };
      }
      const data = (await response.json()) as {
        models?: Array<{ name?: string; size?: number; modified_at?: string; modifiedAt?: string }>;
      };
      const models: OllamaModelInfo[] = (data.models ?? [])
        .filter((m) => typeof m.name === 'string' && m.name.trim().length > 0)
        .map((m) => ({
          name: m.name!.trim(),
          size: typeof m.size === 'number' ? m.size : undefined,
          modifiedAt: m.modified_at ?? m.modifiedAt,
        }));
      return { ok: true, models };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        error: `Ollama unreachable at ${safeBase}: ${detail}`,
      };
    }
  }

  async fetchGeminiModels(): Promise<{
    ok: boolean;
    models: GeminiModelInfo[];
    error?: string;
  }> {
    const geminiKey = this.providerKeys.gemini.key;
    if (!geminiKey) {
      return {
        ok: false,
        models: [],
        error: 'Gemini API key is not configured.',
      };
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(geminiKey)}`;
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        return {
          ok: false,
          models: [],
          error: `Gemini API HTTP ${response.status} ${response.statusText}`,
        };
      }
      const data = (await response.json()) as {
        models?: Array<{
          name?: string;
          displayName?: string;
          description?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const models: GeminiModelInfo[] = (data.models ?? [])
        .filter(
          (m) =>
            typeof m.name === 'string' &&
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent'),
        )
        .map((m) => {
          const id = m.name!.replace(/^models\//, '').trim();
          return {
            id,
            displayName: (m.displayName ?? id).trim(),
            description: m.description,
          };
        });
      return { ok: true, models };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        error: `Gemini API request failed: ${detail}`,
      };
    }
  }

  async fetchProviderModels(
    provider: PromptProvider,
    baseUrl?: string,
  ): Promise<{ ok: boolean; models: ProviderModelInfo[]; error?: string }> {
    if (provider === 'gemini') {
      const res = await this.fetchGeminiModels();
      return {
        ok: res.ok,
        models: res.models.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          provider: 'gemini',
          description: m.description,
        })),
        error: res.error,
      };
    }

    if (provider === 'ollama') {
      const res = await this.fetchOllamaModels(baseUrl);
      return {
        ok: res.ok,
        models: res.models.map((m) => ({
          id: m.name,
          displayName: m.name,
          provider: 'ollama',
        })),
        error: res.error,
      };
    }

    if (provider === 'lmstudio') {
      const safeBase = resolveSafeLocalBaseUrl(baseUrl, 'http://localhost:1234');
      try {
        const response = await this.fetchImpl(`${safeBase}/v1/models`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          return {
            ok: false,
            models: [],
            error: `LM Studio HTTP ${response.status} ${response.statusText}`,
          };
        }
        const data = (await response.json()) as { data?: Array<{ id?: string }> };
        const models: ProviderModelInfo[] = (data.data ?? [])
          .filter((m) => typeof m.id === 'string' && m.id.trim().length > 0)
          .map((m) => ({
            id: m.id!.trim(),
            displayName: m.id!.trim(),
            provider: 'lmstudio',
          }));
        return { ok: true, models };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          models: [],
          error: `LM Studio unreachable at ${safeBase}: ${detail}`,
        };
      }
    }

    const key = this.providerKeys[provider].key;
    if (!key) {
      return {
        ok: false,
        models: [],
        error: `${provider} API key/token is not configured.`,
      };
    }

    if (provider === 'copilot') {
      try {
        const response = await this.fetchImpl('https://models.github.ai/catalog/models', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${key}`,
          },
        });
        if (response.ok) {
          const data = (await response.json()) as
            | Array<{ id?: string; name?: string; summary?: string }>
            | { models?: Array<{ id?: string; name?: string; summary?: string }> };
          const list = Array.isArray(data) ? data : (data.models ?? []);
          const models: ProviderModelInfo[] = list
            .filter((m) => typeof m.id === 'string' && m.id.trim().length > 0)
            .map((m) => ({
              id: m.id!.trim(),
              displayName: (m.name ?? m.id!).trim(),
              provider: 'copilot',
              description: m.summary,
            }));
          if (models.length > 0) {
            return { ok: true, models };
          }
        }
      } catch {
        // Fallback to standard Copilot catalog below when token is configured
      }
      return { ok: true, models: COPILOT_FALLBACK_MODELS.map((m) => ({ ...m })) };
    }

    const endpointMap: Record<'openai' | 'anthropic' | 'openrouter', string> = {
      openai: 'https://api.openai.com/v1/models',
      anthropic: 'https://api.anthropic.com/v1/models',
      openrouter: 'https://openrouter.ai/api/v1/models',
    };
    const headers: Record<string, string> =
      provider === 'anthropic'
        ? {
            Accept: 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          }
        : {
            Accept: 'application/json',
            Authorization: `Bearer ${key}`,
          };

    try {
      const response = await this.fetchImpl(endpointMap[provider], {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        return {
          ok: false,
          models: [],
          error: `${provider} API HTTP ${response.status} ${response.statusText}`,
        };
      }
      const data = (await response.json()) as {
        data?: Array<{ id?: string; name?: string; display_name?: string; description?: string }>;
      };
      const models: ProviderModelInfo[] = (data.data ?? [])
        .filter((m) => typeof m.id === 'string' && m.id.trim().length > 0)
        .map((m) => ({
          id: m.id!.trim(),
          displayName: (m.display_name ?? m.name ?? m.id!).trim(),
          provider,
          description: m.description,
        }));
      return { ok: true, models };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        error: `${provider} API request failed: ${detail}`,
      };
    }
  }

  startPrompt(req: PromptRequest): { runId: string } {
    if (this.status === 'running') {
      throw new PromptConflictError();
    }

    const promptText = (req.prompt ?? '').trim();
    if (!promptText) {
      throw new Error('Prompt text cannot be empty');
    }

    const runId = `run-${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    this.runId = runId;
    this.status = 'running';
    this.model = req.model;
    this.workspace = req.workspace?.trim() || this.defaultWorkspace;
    this.abortController = new AbortController();
    this.childProcess = null;
    this.diffs = [];
    this.logs = [];
    this.activeOverrides.clear();

    const normalizedMentions = (req.mentions ?? [])
      .map((m) => m.replace(/^@+/, '').trim().toLowerCase())
      .filter(Boolean);
    const targets = normalizedMentions.length > 0 ? normalizedMentions : ['default'];
    for (const key of targets) {
      this.activeOverrides.set(key, {
        agentKey: key,
        status: 'working',
        floorId: req.floorId,
        startedAt: now,
      });
    }

    const orchLabel = req.orchestration === 'swarm' ? '[SWARM MODE]' : '[SINGLE]';
    const profileSummary =
      req.orchestration === 'swarm' && Array.isArray(req.swarmProfile) && req.swarmProfile.length > 0
        ? ` | Roles: ${req.swarmProfile.map((r) => `${r.role}=${r.model}(${r.level})`).join(', ')}`
        : '';
    this.emit({
      runId,
      type: 'status',
      agentId: targets[0],
      status: 'running',
      text: `${orchLabel} Started ${req.model} (${req.mode})${profileSummary}`,
      timestamp: now,
    });

    this.activeRunPromise = this.executeRun(runId, req, targets[0]).finally(() => {
      this.activeRunPromise = null;
    });

    return { runId };
  }

  stopPrompt(): PromptRunnerState {
    const runId = this.runId ?? 'none';
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort();
    }
    if (this.childProcess && !this.childProcess.killed) {
      try {
        this.childProcess.kill('SIGTERM');
      } catch {
        // Ignore kill errors if process already exited
      }
    }
    this.childProcess = null;
    this.activeOverrides.clear();

    if (this.status === 'running') {
      this.status = 'stopped';
      this.emit({
        runId,
        type: 'status',
        status: 'stopped',
        text: 'Stopped by user',
        timestamp: Date.now(),
      });
      this.emit({
        runId,
        type: 'done',
        status: 'idle',
        timestamp: Date.now(),
      });
    }

    return this.getState();
  }

  async acceptDiff(filePath: string): Promise<DiffFileChange[]> {
    resolveSafeWorkspaceFile(this.workspace, filePath);
    const normalized = filePath.replace(/\\/g, '/');
    let matched = false;
    this.diffs = this.diffs.map((d) => {
      if (d.path === normalized || d.path === filePath) {
        matched = true;
        return { ...d, status: 'accepted' };
      }
      return d;
    });
    if (!matched) {
      this.diffs.push({
        path: normalized,
        added: 0,
        removed: 0,
        status: 'accepted',
      });
    }
    return this.diffs.map((d) => ({ ...d }));
  }

  async rejectDiff(filePath: string): Promise<DiffFileChange[]> {
    resolveSafeWorkspaceFile(this.workspace, filePath);
    const normalized = filePath.replace(/\\/g, '/');
    await this.execFileImpl('git', ['checkout', '--', normalized], { cwd: this.workspace });
    let matched = false;
    this.diffs = this.diffs.map((d) => {
      if (d.path === normalized || d.path === filePath) {
        matched = true;
        return { ...d, status: 'rejected' };
      }
      return d;
    });
    if (!matched) {
      this.diffs.push({
        path: normalized,
        added: 0,
        removed: 0,
        status: 'rejected',
      });
    }
    return this.diffs.map((d) => ({ ...d }));
  }

  private emit(event: PromptStreamEvent): void {
    this.logs.push(event);
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  private handleTextChunk(runId: string, agentId: string, text: string): void {
    if (!text) return;
    this.emit({
      runId,
      type: 'chunk',
      agentId,
      text,
      timestamp: Date.now(),
    });
    const fileMatch = FILE_PATH_REGEX.exec(text);
    if (fileMatch) {
      const file = fileMatch[1];
      for (const override of this.activeOverrides.values()) {
        override.currentFile = file;
      }
      this.emit({
        runId,
        type: 'file',
        agentId,
        file,
        timestamp: Date.now(),
      });
    }
  }

  private async executeRun(
    runId: string,
    req: PromptRequest,
    primaryAgentId: string,
  ): Promise<void> {
    const signal = this.abortController?.signal;
    const provider = resolveRequestProvider(req);
    try {
      if (provider === 'ollama') {
        await this.runOllama(runId, req, primaryAgentId, signal);
      } else if (provider === 'lmstudio') {
        const base = resolveSafeLocalBaseUrl(
          req.localBaseUrl ?? req.ollamaBaseUrl,
          'http://localhost:1234',
        );
        await this.runOpenAiCompatibleStream(
          runId,
          req,
          primaryAgentId,
          'lmstudio',
          `${base}/v1/chat/completions`,
          { 'Content-Type': 'application/json' },
          signal,
        );
      } else if (provider === 'openai' || provider === 'openrouter' || provider === 'copilot') {
        const key = this.providerKeys[provider].key;
        if (!key) {
          throw new Error(
            `[${provider.toUpperCase()} API NOT CONFIGURED] Configure ${provider} API key in Settings -> Cloud APIs.`,
          );
        }
        const endpoint =
          provider === 'openai'
            ? 'https://api.openai.com/v1/chat/completions'
            : provider === 'openrouter'
              ? 'https://openrouter.ai/api/v1/chat/completions'
              : 'https://models.github.ai/inference/chat/completions';
        await this.runOpenAiCompatibleStream(
          runId,
          req,
          primaryAgentId,
          provider,
          endpoint,
          {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          signal,
        );
      } else if (provider === 'anthropic') {
        await this.runAnthropicStream(runId, req, primaryAgentId, signal);
      } else {
        await this.runGeminiCli(runId, req, primaryAgentId, signal);
      }

      if (signal?.aborted || this.status === 'stopped') {
        return;
      }

      await this.collectGitDiffs(runId);
      this.activeOverrides.clear();
      this.status = 'idle';
      this.emit({
        runId,
        type: 'done',
        agentId: primaryAgentId,
        status: 'idle',
        timestamp: Date.now(),
      });
    } catch (err) {
      if (signal?.aborted || this.status === 'stopped') {
        return;
      }
      this.activeOverrides.clear();
      this.status = 'error';
      const msg = err instanceof Error ? err.message : String(err);
      this.emit({
        runId,
        type: 'error',
        agentId: primaryAgentId,
        status: 'error',
        text: msg,
        timestamp: Date.now(),
      });
    } finally {
      this.childProcess = null;
    }
  }

  private async runOllama(
    runId: string,
    req: PromptRequest,
    agentId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const attachmentsNote =
      req.attachments && req.attachments.length > 0
        ? `\n\nAttached context: ${req.attachments.join(', ')}`
        : '';
    const systemMsg = `You are a coding agent running in ${req.mode} mode in workspace ${this.workspace}.`;
    const actualModel = stripProviderPrefix(req.model);
    const localUrl = (req.localBaseUrl ?? req.ollamaBaseUrl)?.trim();
    const chatUrl = localUrl
      ? `${resolveSafeLocalBaseUrl(localUrl, 'http://localhost:11434')}/api/chat`
      : this.ollamaUrl;

    let response: Response;
    try {
      response = await this.fetchImpl(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: actualModel,
          stream: true,
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: `${req.prompt}${attachmentsNote}` },
          ],
        }),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) return;
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[OLLAMA OFFLINE] Could not reach ${chatUrl} (${detail}). Start Ollama locally to use ${actualModel}.`,
      );
    }

    if (!response.ok) {
      throw new Error(`[OLLAMA ERROR] HTTP ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        this.processOllamaLine(runId, agentId, rawLine);
      }
    }
    if (buffer.trim()) {
      this.processOllamaLine(runId, agentId, buffer);
    }
  }

  private processOllamaLine(runId: string, agentId: string, rawLine: string): void {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed) as {
        message?: { content?: string };
        response?: string;
        error?: string;
      };
      if (parsed.error) {
        throw new Error(`[OLLAMA ERROR] ${parsed.error}`);
      }
      const chunk = parsed.message?.content ?? parsed.response ?? '';
      if (chunk) {
        this.handleTextChunk(runId, agentId, chunk);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('[OLLAMA ERROR]')) {
        throw err;
      }
      // Ignore malformed partial JSON lines
    }
  }

  private async runGeminiCli(
    runId: string,
    req: PromptRequest,
    agentId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const resolvedCmd = await this.resolveCliCommandFn(this.cliCommand);
    if (!resolvedCmd) {
      if (this.providerKeys.gemini.key) {
        await this.runGeminiRest(runId, req, agentId, signal);
        return;
      }
      throw new Error(
        "[CLI/API NOT CONFIGURED] Gemini CLI ('agy'/'gemini') veya GEMINI_API_KEY bulunamadı. Yerel model için Ayarlar -> Yerel Ajanlar (Ollama) üzerinden bir model seçin veya ANTIGRAVITY_CLI_CMD / GEMINI_API_KEY tanımlayın.",
      );
    }

    const args = ['chat', '--model', req.model, '--mode', req.mode, req.prompt];

    await new Promise<void>((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = this.spawnImpl(resolvedCmd, args, {
          cwd: this.workspace,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolvedCmd),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        reject(
          new Error(
            `[CLI NOT FOUND] Failed to start '${resolvedCmd}' (${msg}). Install Antigravity CLI or configure Settings -> Local Agents (Ollama).`,
          ),
        );
        return;
      }

      this.childProcess = child;

      if (signal) {
        const onAbort = () => {
          try {
            child.kill('SIGTERM');
          } catch {
            // Ignore
          }
          resolve();
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      child.stdout?.on('data', (buf: Buffer | string) => {
        this.handleTextChunk(runId, agentId, buf.toString());
      });

      child.stderr?.on('data', (buf: Buffer | string) => {
        this.handleTextChunk(runId, agentId, buf.toString());
      });

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (signal?.aborted) {
          resolve();
          return;
        }
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              `[CLI NOT FOUND] '${this.cliCommand}' is not installed or not in PATH. Set ANTIGRAVITY_CLI_CMD or configure Settings -> Local Agents (Ollama).`,
            ),
          );
          return;
        }
        reject(new Error(`[CLI ERROR] ${err.message}`));
      });

      child.on('close', (code) => {
        if (signal?.aborted || this.status === 'stopped') {
          resolve();
          return;
        }
        if (code === 0 || code === null) {
          resolve();
        } else {
          reject(new Error(`[CLI EXIT ${code}] '${this.cliCommand}' exited with code ${code}`));
        }
      });
    });
  }

  private async readSseEvents(
    response: Response,
    onPayload: (payload: string) => void,
  ): Promise<void> {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        onPayload(payload);
      }
    }
    if (buffer.trim().startsWith('data:')) {
      const payload = buffer.trim().slice(5).trim();
      if (payload && payload !== '[DONE]') {
        onPayload(payload);
      }
    }
  }

  private buildPromptContent(req: PromptRequest): string {
    const attachmentsNote =
      req.attachments && req.attachments.length > 0
        ? `\n\nAttached context: ${req.attachments.join(', ')}`
        : '';
    return `${req.prompt}${attachmentsNote}`;
  }

  private async runOpenAiCompatibleStream(
    runId: string,
    req: PromptRequest,
    agentId: string,
    provider: PromptProvider,
    url: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<void> {
    const actualModel = stripProviderPrefix(req.model);
    const systemMsg = `You are a coding agent running in ${req.mode} mode in workspace ${this.workspace}.`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: actualModel,
        stream: true,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: this.buildPromptContent(req) },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `[${provider.toUpperCase()} API ERROR] HTTP ${response.status} ${response.statusText}`,
      );
    }

    await this.readSseEvents(response, (payload) => {
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const text =
          parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? '';
        if (text) {
          this.handleTextChunk(runId, agentId, text);
        }
      } catch {
        // Ignore malformed SSE JSON chunk
      }
    });
  }

  private async runAnthropicStream(
    runId: string,
    req: PromptRequest,
    agentId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const key = this.providerKeys.anthropic.key;
    if (!key) {
      throw new Error(
        '[ANTHROPIC API NOT CONFIGURED] Configure Anthropic API key in Settings -> Cloud APIs.',
      );
    }
    const actualModel = stripProviderPrefix(req.model);
    const response = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: actualModel,
        max_tokens: 4096,
        stream: true,
        system: `You are a coding agent running in ${req.mode} mode in workspace ${this.workspace}.`,
        messages: [{ role: 'user', content: this.buildPromptContent(req) }],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`[ANTHROPIC API ERROR] HTTP ${response.status} ${response.statusText}`);
    }

    await this.readSseEvents(response, (payload) => {
      try {
        const parsed = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          this.handleTextChunk(runId, agentId, parsed.delta.text);
        }
      } catch {
        // Ignore malformed SSE JSON chunk
      }
    });
  }

  private async runGeminiRest(
    runId: string,
    req: PromptRequest,
    agentId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const restModel = mapGeminiRestModel(stripProviderPrefix(req.model));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(restModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.providerKeys.gemini.key)}`;

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: this.buildPromptContent(req) }],
          },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`[GEMINI API ERROR] HTTP ${response.status} ${response.statusText}`);
    }

    await this.readSseEvents(response, (payload) => {
      try {
        const parsed = JSON.parse(payload) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text =
          parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        if (text) {
          this.handleTextChunk(runId, agentId, text);
        }
      } catch {
        // Ignore malformed SSE JSON chunk
      }
    });
  }

  private async collectGitDiffs(runId: string): Promise<void> {
    try {
      const { stdout } = await this.execFileImpl('git', ['diff', '--numstat'], {
        cwd: this.workspace,
      });
      const parsed = parseGitNumstat(stdout);
      if (parsed.length > 0) {
        this.diffs = parsed;
        this.emit({
          runId,
          type: 'diff',
          diffs: this.diffs.map((d) => ({ ...d })),
          timestamp: Date.now(),
        });
      }
    } catch {
      // Non-git workspace or git unavailable; skip diff collection gracefully
    }
  }
}

export const defaultPromptRunner = new PromptRunner();
