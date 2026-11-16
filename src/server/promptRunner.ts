import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  DiffFileChange,
  PromptModelId,
  PromptRequest,
  PromptStreamEvent,
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
  ollamaUrl?: string;
  cliCommand?: string;
  defaultWorkspace?: string;
  maxLogs?: number;
}

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
  private readonly ollamaUrl: string;
  private readonly cliCommand: string;
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
    this.ollamaUrl =
      options.ollamaUrl ?? process.env.OLLAMA_CHAT_URL ?? 'http://localhost:11434/api/chat';
    this.cliCommand = options.cliCommand ?? process.env.ANTIGRAVITY_CLI_CMD ?? 'agy';
    this.defaultWorkspace = options.defaultWorkspace ?? CURRENT_WORKSPACE;
    this.workspace = this.defaultWorkspace;
    this.maxLogs = options.maxLogs ?? 200;
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

    this.emit({
      runId,
      type: 'status',
      agentId: targets[0],
      status: 'running',
      text: `Started ${req.model} (${req.mode})`,
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
    try {
      if (req.model === 'qwen2.5-coder:14b') {
        await this.runOllama(runId, req, primaryAgentId, signal);
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

    let response: Response;
    try {
      response = await this.fetchImpl(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-coder:14b',
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
        `[OLLAMA OFFLINE] Could not reach ${this.ollamaUrl} (${detail}). Start Ollama locally to use qwen2.5-coder:14b.`,
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
    const args = ['chat', '--model', req.model, '--mode', req.mode, req.prompt];

    await new Promise<void>((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = this.spawnImpl(this.cliCommand, args, {
          cwd: this.workspace,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        reject(
          new Error(
            `[CLI NOT FOUND] Failed to start '${this.cliCommand}' (${msg}). Install Antigravity CLI or select Local Qwen 2.5 Coder 14B.`,
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
              `[CLI NOT FOUND] '${this.cliCommand}' is not installed or not in PATH. Set ANTIGRAVITY_CLI_CMD or select Local Qwen 2.5 Coder 14B.`,
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
