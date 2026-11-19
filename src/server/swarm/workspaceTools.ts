import { exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ApprovalDecision,
  ApprovalRequestPayload,
  ExecutionMode,
  SwarmBoardMessage,
} from '../../shared/types.js';
import type { AgentToolCall, AgentToolDefinition } from '../providers/providerAdapter.js';
import {
  FileLockManager,
  SwarmBoard,
  normalizeSwarmFilePath,
  type SwarmBoardEntry,
} from './swarmBoard.js';

export class WorkspacePathTraversalError extends Error {
  constructor(targetPath: string) {
    super(`Path traversal blocked: "${targetPath}" escapes workspace root.`);
    this.name = 'WorkspacePathTraversalError';
  }
}

export const DANGEROUS_COMMAND_PATTERNS: readonly RegExp[] = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive)\s+(\/|\/\*|~|\$HOME|[a-zA-Z]:\\?)\b/i,
  /\brm\s+-[a-zA-Z]*f[a-zA-Z]*r\s+(\/|\/\*|~|\$HOME|[a-zA-Z]:\\?)\b/i,
  /\brm\s+-rf\s+\/(?:\s|$|\*)/i,
  /\bdel\s+\/s\s+\/q\b/i,
  /\b(?:rd|rmdir)\s+\/s\s+\/q\b/i,
  /(?:^|[;&|]\s*)format\s+[a-zA-Z]:/i,
  /(?:^|\s)format\s+/i,
  /\bmkfs(?:\.[a-z0-9]+)?\b/i,
  /\bshutdown(?:\.exe)?\b(?:\s+[-/][a-zA-Z]|\s*$)/i,
  /\breboot\b/i,
  /\bRemove-Item\b.*-Recurse.*-Force\s+[a-zA-Z]:\\(?:$|\s)/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
  /\bdd\s+if=.*\bof=\/dev\/(?:sd[a-z]|nvme|disk)/i,
];

export function isDangerousCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  return DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function resolveSafeWorkspacePath(
  workspaceRoot: string,
  targetPath = '.',
): { absPath: string; relPath: string } {
  const rootAbs = path.resolve(workspaceRoot);
  const cleanedTarget = (targetPath || '.').trim();
  const resolvedAbs = path.resolve(rootAbs, cleanedTarget);
  const rel = path.relative(rootAbs, resolvedAbs);

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new WorkspacePathTraversalError(targetPath);
  }

  return {
    absPath: resolvedAbs,
    relPath: normalizeSwarmFilePath(rel || '.'),
  };
}

export interface ApprovalGateOptions {
  onApprovalRequest?: (req: ApprovalRequestPayload) => void;
  onApprovalResolved?: (approvalId: string, decision: ApprovalDecision) => void;
  timeoutMs?: number;
}

interface PendingApprovalEntry {
  payload: ApprovalRequestPayload;
  resolve: (decision: ApprovalDecision) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * ApprovalGate coordinates human-in-the-loop tool approvals in Safe mode
 * and remembers session-scoped (`allow_session`) permissions by toolName.
 */
export class ApprovalGate {
  private readonly pending = new Map<string, PendingApprovalEntry>();
  private readonly sessionAllowedTools = new Set<string>();
  private readonly onApprovalRequest?: (req: ApprovalRequestPayload) => void;
  private readonly onApprovalResolved?: (
    approvalId: string,
    decision: ApprovalDecision,
  ) => void;
  private readonly timeoutMs: number;

  constructor(options: ApprovalGateOptions = {}) {
    this.onApprovalRequest = options.onApprovalRequest;
    this.onApprovalResolved = options.onApprovalResolved;
    this.timeoutMs = options.timeoutMs ?? 0;
  }

  public hasSessionPermission(toolName: string): boolean {
    return this.sessionAllowedTools.has(toolName);
  }

  public grantSessionPermission(toolName: string): void {
    this.sessionAllowedTools.add(toolName);
  }

  public clearSessionPermissions(): void {
    this.sessionAllowedTools.clear();
  }

  public getPendingApprovals(): ApprovalRequestPayload[] {
    return Array.from(this.pending.values()).map((entry) => ({ ...entry.payload }));
  }

  public async requestApproval(req: ApprovalRequestPayload): Promise<ApprovalDecision> {
    if (this.sessionAllowedTools.has(req.toolName)) {
      return 'allow_session';
    }

    return new Promise<ApprovalDecision>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (this.timeoutMs > 0) {
        timer = setTimeout(() => {
          this.pending.delete(req.approvalId);
          resolve('deny');
        }, this.timeoutMs);
      }

      this.pending.set(req.approvalId, {
        payload: req,
        resolve,
        timer,
      });

      this.onApprovalRequest?.(req);
    });
  }

  public resolveApproval(approvalId: string, decision: ApprovalDecision): boolean {
    const entry = this.pending.get(approvalId);
    if (!entry) return false;

    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    this.pending.delete(approvalId);

    if (decision === 'allow_session') {
      this.sessionAllowedTools.add(entry.payload.toolName);
    }

    entry.resolve(decision);
    this.onApprovalResolved?.(approvalId, decision);
    return true;
  }

  public cancelAll(): void {
    for (const [id, entry] of this.pending.entries()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.resolve('deny');
      this.onApprovalResolved?.(id, 'deny');
    }
    this.pending.clear();
  }
}

export const WORKSPACE_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: 'list_dir',
    description:
      'List files and directories inside the workspace at a given relative directory path.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative directory path inside workspace (defaults to ".").',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to recursively list subdirectories (up to maxDepth).',
        },
      },
    },
  },
  {
    name: 'read_file',
    description:
      'Read file contents from the workspace with optional 1-based line range.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file inside workspace.',
        },
        startLine: {
          type: 'number',
          description: 'Optional 1-based start line (inclusive).',
        },
        endLine: {
          type: 'number',
          description: 'Optional 1-based end line (inclusive).',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description:
      'Search for a text or substring across workspace files and return matching lines.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text or pattern to search for.',
        },
        path: {
          type: 'string',
          description: 'Optional relative directory to scope the search.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a file in the workspace (subject to file ownership & lock checks).',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file inside workspace.',
        },
        content: {
          type: 'string',
          description: 'Full content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description:
      'Replace an exact target snippet with replacement text in an existing workspace file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file inside workspace.',
        },
        target: {
          type: 'string',
          description: 'Exact existing text to find and replace.',
        },
        replacement: {
          type: 'string',
          description: 'New replacement text.',
        },
      },
      required: ['path', 'target', 'replacement'],
    },
  },
  {
    name: 'run_command',
    description:
      'Run a shell command in the workspace root with timeout and security blacklist protection.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute.',
        },
        timeoutMs: {
          type: 'number',
          description: 'Optional timeout in milliseconds (default 15000).',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'post_board',
    description:
      'Post a message or status update to the shared SwarmBoard to coordinate with other agents.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Optional target role or @mention (e.g. "coder-core" or "verifier").',
        },
        text: {
          type: 'string',
          description: 'Message text to post on the shared board.',
        },
        artifacts: {
          type: 'array',
          description: 'Optional list of modified or relevant file paths.',
          items: { type: 'string' },
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'read_board',
    description:
      'Read messages and task statuses from the shared SwarmBoard.',
    parameters: {
      type: 'object',
      properties: {
        sinceSeq: {
          type: 'number',
          description: 'Optional sequence number to read messages after.',
        },
      },
    },
  },
];

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandRunnerFn = (
  command: string,
  options: { cwd: string; timeoutMs: number },
) => Promise<CommandRunResult>;

const defaultCommandRunner: CommandRunnerFn = (command, { cwd, timeoutMs }) =>
  new Promise<CommandRunResult>((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const code = typeof error.code === 'number' ? error.code : 1;
          resolve({
            exitCode: code,
            stdout: String(stdout ?? ''),
            stderr: String(stderr || error.message || ''),
          });
          return;
        }
        resolve({
          exitCode: 0,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
        });
      },
    );
  });

export interface WorkspaceToolExecutionResult {
  ok: boolean;
  output: string;
  fileModified?: string;
  boardMessage?: SwarmBoardMessage;
  exitCode?: number;
}

export interface WorkspaceToolsOptions {
  workspaceRoot: string;
  runId?: string;
  mode?: ExecutionMode;
  board: SwarmBoard;
  lockManager: FileLockManager;
  approvalGate?: ApprovalGate;
  commandRunner?: CommandRunnerFn;
  onFileChanged?: (relPath: string, role: string) => void;
  onBoardMessage?: (message: SwarmBoardEntry) => void;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  '.next',
  'coverage',
]);

function buildDiffPreview(beforeText: string, afterText: string, maxLines = 16): string {
  const beforeLines = beforeText.split(/\r?\n/).slice(0, maxLines);
  const afterLines = afterText.split(/\r?\n/).slice(0, maxLines);
  const removed = beforeLines.map((l) => `- ${l}`).join('\n');
  const added = afterLines.map((l) => `+ ${l}`).join('\n');
  return [removed, added].filter(Boolean).join('\n');
}

export class WorkspaceToolExecutor {
  private readonly workspaceRoot: string;
  private readonly runId: string;
  private readonly mode: ExecutionMode;
  private readonly board: SwarmBoard;
  private readonly lockManager: FileLockManager;
  private readonly approvalGate: ApprovalGate;
  private readonly commandRunner: CommandRunnerFn;
  private readonly onFileChanged?: (relPath: string, role: string) => void;
  private readonly onBoardMessage?: (message: SwarmBoardEntry) => void;

  constructor(options: WorkspaceToolsOptions) {
    this.workspaceRoot = path.resolve(options.workspaceRoot);
    this.runId = options.runId ?? 'run-default';
    this.mode = options.mode ?? 'turbo';
    this.board = options.board;
    this.lockManager = options.lockManager;
    this.approvalGate = options.approvalGate ?? new ApprovalGate();
    this.commandRunner = options.commandRunner ?? defaultCommandRunner;
    this.onFileChanged = options.onFileChanged;
    this.onBoardMessage = options.onBoardMessage;
  }

  public getToolDefinitions(): AgentToolDefinition[] {
    return WORKSPACE_TOOL_DEFINITIONS;
  }

  private async ensureApprovalIfNeeded(params: {
    role: string;
    toolName: string;
    summary: string;
    detail?: string;
    diffPreview?: string;
    forceApproval?: boolean;
  }): Promise<{ approved: boolean; decision: ApprovalDecision }> {
    const requiresApproval = this.mode === 'safe' || params.forceApproval === true;
    if (!requiresApproval) {
      return { approved: true, decision: 'allow_once' };
    }

    const payload: ApprovalRequestPayload = {
      approvalId: `apr-${randomUUID()}`,
      runId: this.runId,
      role: params.role,
      toolName: params.toolName,
      summary: params.summary,
      detail: params.detail,
      diffPreview: params.diffPreview,
      timestamp: Date.now(),
    };

    const decision = await this.approvalGate.requestApproval(payload);
    return {
      approved: decision === 'allow_once' || decision === 'allow_session',
      decision,
    };
  }

  public async executeTool(
    role: string,
    ownedFiles: string[] | undefined,
    toolCall: AgentToolCall,
  ): Promise<WorkspaceToolExecutionResult> {
    const args = toolCall.args ?? {};
    try {
      switch (toolCall.name) {
        case 'list_dir':
          return await this.handleListDir(args);
        case 'read_file':
          return await this.handleReadFile(args);
        case 'search_files':
          return await this.handleSearchFiles(args);
        case 'write_file':
          return await this.handleWriteFile(role, ownedFiles, args);
        case 'edit_file':
          return await this.handleEditFile(role, ownedFiles, args);
        case 'run_command':
          return await this.handleRunCommand(role, args);
        case 'post_board':
          return this.handlePostBoard(role, args);
        case 'read_board':
          return this.handleReadBoard(args);
        default:
          return {
            ok: false,
            output: `[UNKNOWN TOOL] Tool "${toolCall.name}" is not supported.`,
          };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        output: `[TOOL ERROR: ${toolCall.name}] ${msg}`,
      };
    }
  }

  private async handleListDir(
    args: Record<string, unknown>,
  ): Promise<WorkspaceToolExecutionResult> {
    const rawPath = typeof args.path === 'string' ? args.path : '.';
    const recursive = Boolean(args.recursive);
    const maxDepth = typeof args.maxDepth === 'number' ? Math.min(args.maxDepth, 5) : 2;
    const { absPath, relPath } = resolveSafeWorkspacePath(this.workspaceRoot, rawPath);

    const results: string[] = [];
    const walk = async (currentAbs: string, currentRel: string, depth: number) => {
      if (results.length >= 250) return;
      const dirents = await fs.readdir(currentAbs, { withFileTypes: true });
      dirents.sort((a, b) => a.name.localeCompare(b.name));

      for (const d of dirents) {
        if (results.length >= 250) break;
        if (IGNORED_DIRS.has(d.name)) continue;
        const entryRel =
          currentRel && currentRel !== '.' ? `${currentRel}/${d.name}` : d.name;
        if (d.isDirectory()) {
          results.push(`${entryRel}/`);
          if (recursive && depth + 1 < maxDepth) {
            await walk(path.join(currentAbs, d.name), entryRel, depth + 1);
          }
        } else {
          results.push(entryRel);
        }
      }
    };

    await walk(absPath, relPath, 0);
    return {
      ok: true,
      output: results.length > 0 ? results.join('\n') : '(empty directory)',
    };
  }

  private async handleReadFile(
    args: Record<string, unknown>,
  ): Promise<WorkspaceToolExecutionResult> {
    const rawPath = typeof args.path === 'string' ? args.path : '';
    if (!rawPath) {
      return { ok: false, output: '[READ ERROR] Missing required "path" parameter.' };
    }
    const { absPath, relPath } = resolveSafeWorkspacePath(this.workspaceRoot, rawPath);
    const content = await fs.readFile(absPath, 'utf8');
    const allLines = content.split(/\r?\n/);

    const startLine =
      typeof args.startLine === 'number' && args.startLine >= 1
        ? Math.floor(args.startLine)
        : 1;
    const endLine =
      typeof args.endLine === 'number' && args.endLine >= startLine
        ? Math.min(allLines.length, Math.floor(args.endLine))
        : Math.min(allLines.length, startLine + 299);

    const slice = allLines
      .slice(startLine - 1, endLine)
      .map((line, idx) => `${startLine + idx}: ${line}`)
      .join('\n');

    return {
      ok: true,
      output: `File: ${relPath} (lines ${startLine}-${endLine} of ${allLines.length})\n${slice}`,
    };
  }

  private async handleSearchFiles(
    args: Record<string, unknown>,
  ): Promise<WorkspaceToolExecutionResult> {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return { ok: false, output: '[SEARCH ERROR] Missing required "query" parameter.' };
    }
    const rawPath = typeof args.path === 'string' ? args.path : '.';
    const { absPath, relPath } = resolveSafeWorkspacePath(this.workspaceRoot, rawPath);

    const matches: string[] = [];
    const maxMatches = 50;
    const lowerQuery = query.toLowerCase();

    const searchDir = async (dirAbs: string, dirRel: string) => {
      if (matches.length >= maxMatches) return;
      const entries = await fs.readdir(dirAbs, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= maxMatches) break;
        if (IGNORED_DIRS.has(entry.name)) continue;
        const childAbs = path.join(dirAbs, entry.name);
        const childRel = dirRel && dirRel !== '.' ? `${dirRel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await searchDir(childAbs, childRel);
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(childAbs);
            if (stat.size > 512 * 1024) continue;
            const text = await fs.readFile(childAbs, 'utf8');
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(lowerQuery)) {
                matches.push(`${childRel}:${i + 1}: ${lines[i].trim()}`);
                if (matches.length >= maxMatches) break;
              }
            }
          } catch {
            // Skip unreadable/binary file
          }
        }
      }
    };

    await searchDir(absPath, relPath);
    return {
      ok: true,
      output: matches.length > 0 ? matches.join('\n') : `No matches found for "${query}".`,
    };
  }

  private async handleWriteFile(
    role: string,
    ownedFiles: string[] | undefined,
    args: Record<string, unknown>,
  ): Promise<WorkspaceToolExecutionResult> {
    const rawPath = typeof args.path === 'string' ? args.path : '';
    const content = typeof args.content === 'string' ? args.content : '';
    if (!rawPath) {
      return { ok: false, output: '[WRITE ERROR] Missing required "path" parameter.' };
    }

    const { absPath, relPath } = resolveSafeWorkspacePath(this.workspaceRoot, rawPath);
    const violation = this.lockManager.getOwnershipViolation(relPath, role, ownedFiles);
    if (violation) {
      return {
        ok: false,
        output: `[FILE LOCK / OWNERSHIP CONFLICT] ${violation}`,
      };
    }

    if (!this.lockManager.acquire(relPath, role)) {
      const holder = this.lockManager.getLockOwner(relPath);
      return {
        ok: false,
        output: `[FILE LOCK CONFLICT] Cannot lock "${relPath}" for @${role} (locked by @${holder ?? 'unknown'}).`,
      };
    }

    let previousContent = '';
    try {
      previousContent = await fs.readFile(absPath, 'utf8');
    } catch {
      // New file
    }

    const approval = await this.ensureApprovalIfNeeded({
      role,
      toolName: 'write_file',
      summary: `Write file ${relPath} (${content.length} bytes)`,
      detail: relPath,
      diffPreview: buildDiffPreview(previousContent, content),
    });

    if (!approval.approved) {
      return {
        ok: false,
        output: `[APPROVAL DENIED] User rejected write_file on "${relPath}".`,
      };
    }

    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf8');
    this.onFileChanged?.(relPath, role);

    return {
      ok: true,
      output: `Successfully wrote ${content.length} bytes to ${relPath}.`,
      fileModified: relPath,
    };
  }

  private async handleEditFile(
    role: string,
    ownedFiles: string[] | undefined,
    args: Record<string, unknown>,
  ): Promise<WorkspaceToolExecutionResult> {
    const rawPath = typeof args.path === 'string' ? args.path : '';
    const target = typeof args.target === 'string' ? args.target : '';
    const replacement = typeof args.replacement === 'string' ? args.replacement : '';
    if (!rawPath || !target) {
      return {
        ok: false,
        output: '[EDIT ERROR] Both "path" and non-empty "target" are required.',
      };
    }

    const { absPath, relPath } = resolveSafeWorkspacePath(this.workspaceRoot, rawPath);
    const violation = this.lockManager.getOwnershipViolation(relPath, role, ownedFiles);
    if (violation) {
      return {
        ok: false,
        output: `[FILE LOCK / OWNERSHIP CONFLICT] ${violation}`,
      };
    }

    if (!this.lockManager.acquire(relPath, role)) {
      const holder = this.lockManager.getLockOwner(relPath);
      return {
        ok: false,
        output: `[FILE LOCK CONFLICT] Cannot lock "${relPath}" for @${role} (locked by @${holder ?? 'unknown'}).`,
      };
    }

    const existing = await fs.readFile(absPath, 'utf8');
    if (!existing.includes(target)) {
      return {
        ok: false,
        output: `[EDIT ERROR] Target snippet not found in "${relPath}".`,
      };
    }

    const approval = await this.ensureApprovalIfNeeded({
      role,
      toolName: 'edit_file',
      summary: `Edit file ${relPath}`,
      detail: relPath,
      diffPreview: buildDiffPreview(target, replacement),
    });

    if (!approval.approved) {
      return {
        ok: false,
        output: `[APPROVAL DENIED] User rejected edit_file on "${relPath}".`,
      };
    }

    const updated = existing.replace(target, replacement);
    await fs.writeFile(absPath, updated, 'utf8');
    this.onFileChanged?.(relPath, role);

    return {
      ok: true,
      output: `Successfully edited ${relPath}.`,
      fileModified: relPath,
    };
  }

  private async handleRunCommand(
    role: string,
    args: Record<string, unknown>,
  ): Promise<WorkspaceToolExecutionResult> {
    const command = typeof args.command === 'string' ? args.command.trim() : '';
    if (!command) {
      return { ok: false, output: '[COMMAND ERROR] Missing required "command" parameter.' };
    }

    if (isDangerousCommand(command)) {
      return {
        ok: false,
        exitCode: 126,
        output: `[SECURITY BLOCK] Command rejected by dangerous command blacklist: "${command}"`,
      };
    }

    const approval = await this.ensureApprovalIfNeeded({
      role,
      toolName: 'run_command',
      summary: `Run command: ${command}`,
      detail: command,
    });

    if (!approval.approved) {
      return {
        ok: false,
        exitCode: 1,
        output: `[APPROVAL DENIED] User rejected run_command: "${command}".`,
      };
    }

    const timeoutMs =
      typeof args.timeoutMs === 'number' && args.timeoutMs > 0
        ? Math.min(args.timeoutMs, 60_000)
        : 15_000;

    const result = await this.commandRunner(command, {
      cwd: this.workspaceRoot,
      timeoutMs,
    });

    const combined = [
      `Exit code: ${result.exitCode}`,
      result.stdout ? `STDOUT:\n${result.stdout.trim()}` : '',
      result.stderr ? `STDERR:\n${result.stderr.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      output: combined,
    };
  }

  private handlePostBoard(
    role: string,
    args: Record<string, unknown>,
  ): WorkspaceToolExecutionResult {
    const text = typeof args.text === 'string' ? args.text.trim() : '';
    if (!text) {
      return { ok: false, output: '[BOARD ERROR] Missing required "text" parameter.' };
    }
    const to = typeof args.to === 'string' ? args.to.trim() : undefined;
    const artifacts = Array.isArray(args.artifacts)
      ? args.artifacts.filter((a): a is string => typeof a === 'string')
      : undefined;

    const entry = this.board.postMessage({
      from: role,
      to,
      text,
      artifacts,
    });
    this.onBoardMessage?.(entry);

    return {
      ok: true,
      output: `Posted message #${entry.seq} to SwarmBoard.`,
      boardMessage: entry,
    };
  }

  private handleReadBoard(args: Record<string, unknown>): WorkspaceToolExecutionResult {
    const sinceSeq = typeof args.sinceSeq === 'number' ? args.sinceSeq : undefined;
    const messages = this.board.readMessages(sinceSeq);
    const tasks = this.board.getTasks();

    const taskLines =
      tasks.length > 0
        ? `Tasks:\n${tasks.map((t) => `- [${t.status}] ${t.id} (@${t.ownerName}): ${t.title}`).join('\n')}\n\n`
        : '';

    const msgLines =
      messages.length > 0
        ? messages
            .map(
              (m) =>
                `#${m.seq} @${m.agent}${m.to ? ` -> @${m.to}` : ''}: ${m.text}` +
                (m.artifacts?.length ? ` [artifacts: ${m.artifacts.join(', ')}]` : ''),
            )
            .join('\n')
        : '(no new board messages)';

    return {
      ok: true,
      output: `${taskLines}Messages:\n${msgLines}`,
    };
  }
}

export function createWorkspaceToolExecutor(
  options: WorkspaceToolsOptions,
): WorkspaceToolExecutor {
  return new WorkspaceToolExecutor(options);
}

export async function executeTool(
  executorOrOptions: WorkspaceToolExecutor | WorkspaceToolsOptions,
  role: string,
  ownedFiles: string[] | undefined,
  toolCall: AgentToolCall,
): Promise<WorkspaceToolExecutionResult> {
  const executor =
    executorOrOptions instanceof WorkspaceToolExecutor
      ? executorOrOptions
      : new WorkspaceToolExecutor(executorOrOptions);
  return executor.executeTool(role, ownedFiles, toolCall);
}
