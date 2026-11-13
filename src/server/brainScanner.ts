import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentLogEntry,
  SwarmBoardMessage,
  SwarmMentionEdge,
  SwarmRole,
} from '../shared/types.js';

export interface SubagentMeta {
  conversationId: string;
  parentConversationId: string;
  typeName?: string;
  role?: string;
  state?: string;
  workspaceUris?: string[];
}

export interface SwarmMemberMeta {
  rosterName: string;
  conversationId: string;
  parentConversationId: string;
  role?: string;
  desiredState?: string;
  appliedModel?: string;
  model?: string;
  workspaceMode?: string;
  phase?: string;
  waitSince?: number;
  lastNudgedSeq?: number;
  killed?: boolean;
}

export interface TranscriptStepEvent {
  timestamp: string;
  status: string;
}

export interface TranscriptSummary {
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  latestToolName?: string;
  latestTargetSummary?: string;
  latestThoughtSnippet?: string;
  lastStepStatus?: string;
  lastTimestamp?: string;
  recentSteps?: TranscriptStepEvent[];
}

export interface BrainScanResult {
  presenceLocks: Set<string>;
  subagentMetaByConvId: Map<string, SubagentMeta>;
  swarmMemberByConvId: Map<string, SwarmMemberMeta>;
  swarmBoardsByRootConvId: Map<string, { title?: string; messages: SwarmBoardMessage[] }>;
  extraParentLinks: Map<string, string>;
  transcriptByConvId: Map<string, TranscriptSummary>;
}

interface TranscriptCacheEntry {
  mtimeMs: number;
  size: number;
  summary: TranscriptSummary;
}

const transcriptCache = new Map<string, TranscriptCacheEntry>();

const TRANSCRIPT_TAIL_BYTES = 16384;
const LOGS_TAIL_BYTES = 65536;

function tailFileText(filePath: string, maxBytes: number): { text: string; stat: fs.Stats } | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return null;
  }

  if (!stat.isFile() || stat.size === 0) {
    return { text: '', stat };
  }

  const readSize = Math.min(stat.size, maxBytes);
  const offset = stat.size - readSize;
  const buffer = Buffer.allocUnsafe(readSize);

  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, readSize, offset);
    let text = buffer.toString('utf8', 0, bytesRead);
    // Drop the potentially truncated first line if we started mid-file
    if (offset > 0) {
      const firstNewline = text.indexOf('\n');
      text = firstNewline >= 0 ? text.slice(firstNewline + 1) : '';
    }
    return { text, stat };
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close errors
      }
    }
  }
}

function truncateText(value: string, maxLen: number): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, Math.max(0, maxLen - 3)).trimEnd() + '...';
}

function extractTargetSummary(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const record = args as Record<string, unknown>;

  if (typeof record.toolSummary === 'string' && record.toolSummary.trim()) {
    return truncateText(record.toolSummary, 40);
  }

  const pathCandidate =
    (typeof record.Path === 'string' && record.Path) ||
    (typeof record.path === 'string' && record.path) ||
    (typeof record.AbsolutePath === 'string' && record.AbsolutePath) ||
    (typeof record.TargetFile === 'string' && record.TargetFile) ||
    (typeof record.file === 'string' && record.file);

  if (pathCandidate) {
    const normalized = pathCandidate.replace(/\\/g, '/');
    const base = path.posix.basename(normalized);
    return truncateText(base || normalized, 40);
  }

  const commandCandidate =
    (typeof record.CommandLine === 'string' && record.CommandLine) ||
    (typeof record.command === 'string' && record.command) ||
    (typeof record.query === 'string' && record.query) ||
    (typeof record.Query === 'string' && record.Query);

  if (commandCandidate) {
    return truncateText(commandCandidate, 40);
  }

  return undefined;
}

function extractUsageTokens(obj: Record<string, unknown>): {
  input: number;
  cacheRead: number;
  output: number;
} {
  const usageSource =
    (obj.usage as Record<string, unknown> | undefined) ||
    (obj.token_usage as Record<string, unknown> | undefined) ||
    (obj.usage_metadata as Record<string, unknown> | undefined) ||
    obj;

  const input = Number(
    usageSource.input_tokens ?? usageSource.prompt_tokens ?? usageSource.promptTokenCount ?? 0,
  );
  const cacheRead = Number(
    usageSource.cache_read_tokens ??
      usageSource.cached_content_token_count ??
      usageSource.cache_read_input_tokens ??
      0,
  );
  const output = Number(
    usageSource.output_tokens ??
      usageSource.completion_tokens ??
      usageSource.candidatesTokenCount ??
      0,
  );

  return {
    input: Number.isFinite(input) ? input : 0,
    cacheRead: Number.isFinite(cacheRead) ? cacheRead : 0,
    output: Number.isFinite(output) ? output : 0,
  };
}

function parseTranscriptSummary(text: string): TranscriptSummary {
  const summary: TranscriptSummary = {
    inputTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    recentSteps: [],
  };

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    const tokens = extractUsageTokens(entry);
    summary.inputTokens += tokens.input;
    summary.cacheReadTokens += tokens.cacheRead;
    summary.outputTokens += tokens.output;

    if (typeof entry.status === 'string' && entry.status) {
      summary.lastStepStatus = entry.status;
    }
    if (typeof entry.created_at === 'string' && entry.created_at) {
      summary.lastTimestamp = entry.created_at;
      summary.recentSteps!.push({
        timestamp: entry.created_at,
        status: typeof entry.status === 'string' && entry.status ? entry.status : 'DONE',
      });
    }

    const toolCalls = entry.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const lastCall = toolCalls[toolCalls.length - 1] as Record<string, unknown> | undefined;
      if (lastCall && typeof lastCall.name === 'string') {
        summary.latestToolName = lastCall.name;
        summary.latestTargetSummary = extractTargetSummary(lastCall.args ?? lastCall.arguments);
      }
    }

    const thoughtText =
      (typeof entry.thinking === 'string' && entry.thinking.trim()) ||
      (typeof entry.content === 'string' && entry.content.trim());
    if (thoughtText) {
      summary.latestThoughtSnippet = truncateText(thoughtText, 220);
    }
  }

  return summary;
}

export function scanTranscriptSummary(agyDataDir: string, convId: string): TranscriptSummary {
  const transcriptPath = path.join(
    agyDataDir,
    'brain',
    convId,
    '.system_generated',
    'logs',
    'transcript.jsonl',
  );

  let stat: fs.Stats;
  try {
    stat = fs.statSync(transcriptPath);
  } catch {
    return { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  }

  const cached = transcriptCache.get(transcriptPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.summary;
  }

  const tailed = tailFileText(transcriptPath, TRANSCRIPT_TAIL_BYTES);
  if (!tailed) {
    return { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  }

  const summary = parseTranscriptSummary(tailed.text);
  transcriptCache.set(transcriptPath, {
    mtimeMs: tailed.stat.mtimeMs,
    size: tailed.stat.size,
    summary,
  });
  return summary;
}

/**
 * Read the most recent AgentLogEntry items from transcript.jsonl (last ~64KB).
 */
export function readAgentLogs(agyDataDir: string, convId: string, limit = 25): AgentLogEntry[] {
  const transcriptPath = path.join(
    agyDataDir,
    'brain',
    convId,
    '.system_generated',
    'logs',
    'transcript.jsonl',
  );

  const tailed = tailFileText(transcriptPath, LOGS_TAIL_BYTES);
  if (!tailed || !tailed.text) return [];

  const entries: AgentLogEntry[] = [];
  const lines = tailed.text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    let toolName: string | undefined;
    let targetSummary: string | undefined;
    if (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
      const lastCall = raw.tool_calls[raw.tool_calls.length - 1] as
        | Record<string, unknown>
        | undefined;
      if (lastCall && typeof lastCall.name === 'string') {
        toolName = lastCall.name;
        targetSummary = extractTargetSummary(lastCall.args ?? lastCall.arguments);
      }
    }

    const rawThought =
      (typeof raw.thinking === 'string' && raw.thinking.trim()) ||
      (typeof raw.content === 'string' && raw.content.trim()) ||
      undefined;

    entries.push({
      stepIndex: typeof raw.step_index === 'number' ? raw.step_index : i,
      timestamp:
        typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
      type: typeof raw.type === 'string' ? raw.type : 'STEP',
      status: typeof raw.status === 'string' ? raw.status : 'DONE',
      toolName,
      targetSummary,
      thoughtSnippet: rawThought ? truncateText(rawThought, 220) : undefined,
    });
  }

  if (entries.length <= limit) return entries;
  return entries.slice(entries.length - limit);
}

export function extractMentions(text: string): string[] {
  const matches = text.matchAll(/@([a-zA-Z0-9_-]+)/g);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of matches) {
    const name = match[1];
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

export function buildSwarmMentionEdges(messages: SwarmBoardMessage[]): SwarmMentionEdge[] {
  const edgeMap = new Map<string, SwarmMentionEdge>();

  for (const msg of messages) {
    const mentions = msg.mentions ?? extractMentions(msg.text);
    for (const target of mentions) {
      if (!target || target === msg.agent) continue;
      const key = `${msg.agent}->${target}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.count += 1;
        if (msg.seq >= existing.lastSeq) {
          existing.lastSeq = msg.seq;
          existing.lastTime = msg.time;
        }
      } else {
        edgeMap.set(key, {
          from: msg.agent,
          to: target,
          count: 1,
          lastSeq: msg.seq,
          lastTime: msg.time,
        });
      }
    }
  }

  return Array.from(edgeMap.values()).sort((a, b) => b.lastSeq - a.lastSeq);
}

export function classifySwarmRole(
  rosterName?: string,
  role?: string,
  isCoordinator?: boolean,
): SwarmRole {
  const combined = `${rosterName || ''} ${role || ''}`.toLowerCase();
  if (isCoordinator || combined.includes('coordinator') || combined.includes('architect')) {
    return 'coordinator';
  }
  if (combined.includes('monitor')) return 'monitor';
  if (combined.includes('narrator')) return 'narrator';
  if (combined.includes('verifier') || combined.includes('qa')) return 'verifier';
  if (combined.includes('worker') || rosterName || role) return 'worker';
  return 'other';
}

function readBoardMessages(boardPath: string, limit = 40): SwarmBoardMessage[] {
  const tailed = tailFileText(boardPath, 32768);
  if (!tailed || !tailed.text) return [];

  const messages: SwarmBoardMessage[] = [];
  const lines = tailed.text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const text = typeof parsed.text === 'string' ? parsed.text : '';
      const mentions = extractMentions(text);
      messages.push({
        seq: Number(parsed.seq || 0),
        agent: typeof parsed.agent === 'string' ? parsed.agent : 'unknown',
        text,
        time: typeof parsed.time === 'string' ? parsed.time : '',
        kind: typeof parsed.kind === 'string' ? parsed.kind : 'message',
        mentions,
      });
    } catch {
      // Skip malformed line
    }
  }

  if (messages.length <= limit) return messages;
  return messages.slice(messages.length - limit);
}

/**
 * Scan presence locks, subagent descriptors, swarm members/boards, and transcript tails
 * for the given conversation IDs without modifying any files in agyDataDir.
 */
export function scanBrainData(agyDataDir: string, conversationIds: string[]): BrainScanResult {
  const presenceLocks = new Set<string>();
  const subagentMetaByConvId = new Map<string, SubagentMeta>();
  const swarmMemberByConvId = new Map<string, SwarmMemberMeta>();
  const swarmBoardsByRootConvId = new Map<
    string,
    { title?: string; messages: SwarmBoardMessage[] }
  >();
  const extraParentLinks = new Map<string, string>();
  const transcriptByConvId = new Map<string, TranscriptSummary>();

  // 1. Scan presence/<convId>.lock
  const presenceDir = path.join(agyDataDir, 'presence');
  for (const convId of conversationIds) {
    if (fs.existsSync(path.join(presenceDir, `${convId}.lock`))) {
      presenceLocks.add(convId);
    }
  }

  // 2. Scan brain/<convId>/.system_generated/*
  const brainDir = path.join(agyDataDir, 'brain');
  for (const convId of conversationIds) {
    const sysGenDir = path.join(brainDir, convId, '.system_generated');

    // Subagents
    const subagentsDir = path.join(sysGenDir, 'subagents');
    if (fs.existsSync(subagentsDir)) {
      try {
        const files = fs.readdirSync(subagentsDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const raw = fs.readFileSync(path.join(subagentsDir, file), 'utf8');
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const subConvId =
              typeof parsed.conversationId === 'string' ? parsed.conversationId : '';
            if (!subConvId) continue;

            const desc = (parsed.subagentDescriptor || {}) as Record<string, unknown>;
            const meta: SubagentMeta = {
              conversationId: subConvId,
              parentConversationId: convId,
              typeName: typeof desc.typeName === 'string' ? desc.typeName : undefined,
              role: typeof desc.role === 'string' ? desc.role : undefined,
              state: typeof parsed.state === 'string' ? parsed.state : undefined,
              workspaceUris: Array.isArray(parsed.workspaceUris)
                ? parsed.workspaceUris.filter((u): u is string => typeof u === 'string')
                : undefined,
            };
            subagentMetaByConvId.set(subConvId, meta);
            if (!extraParentLinks.has(subConvId)) {
              extraParentLinks.set(subConvId, convId);
            }
          } catch {
            // Skip malformed subagent JSON
          }
        }
      } catch {
        // Ignore directory read errors
      }
    }

    // Swarm members & board
    const swarmDir = path.join(sysGenDir, 'swarm');
    if (fs.existsSync(swarmDir)) {
      const membersPath = path.join(swarmDir, 'members.json');
      let swarmTitle: string | undefined;

      if (fs.existsSync(membersPath)) {
        try {
          const raw = fs.readFileSync(membersPath, 'utf8');
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (typeof parsed.title === 'string' && parsed.title.trim()) {
            swarmTitle = parsed.title.trim();
          }

          const rawMembers = parsed.members;
          const entries: Array<[string, Record<string, unknown>]> = [];

          if (Array.isArray(rawMembers)) {
            for (const item of rawMembers) {
              if (item && typeof item === 'object') {
                const rec = item as Record<string, unknown>;
                const name =
                  (typeof rec.name === 'string' && rec.name) ||
                  (typeof rec.roster_name === 'string' && rec.roster_name) ||
                  (typeof rec.role === 'string' && rec.role) ||
                  'worker';
                entries.push([name, rec]);
              }
            }
          } else if (rawMembers && typeof rawMembers === 'object') {
            for (const [rosterName, val] of Object.entries(
              rawMembers as Record<string, unknown>,
            )) {
              if (val && typeof val === 'object') {
                entries.push([rosterName, val as Record<string, unknown>]);
              }
            }
          }

          for (const [rosterName, rec] of entries) {
            const memberConvId =
              (typeof rec.conversation_id === 'string' && rec.conversation_id) ||
              (typeof rec.conversationId === 'string' && rec.conversationId) ||
              '';
            if (!memberConvId) continue;

            const memberMeta: SwarmMemberMeta = {
              rosterName,
              conversationId: memberConvId,
              parentConversationId: convId,
              role: typeof rec.role === 'string' ? rec.role : undefined,
              desiredState:
                typeof rec.desired_state === 'string' ? rec.desired_state : undefined,
              appliedModel:
                typeof rec.applied_model === 'string' ? rec.applied_model : undefined,
              model: typeof rec.model === 'string' ? rec.model : undefined,
              workspaceMode:
                typeof rec.workspace_mode === 'string' ? rec.workspace_mode : undefined,
              phase: typeof rec.phase === 'string' ? rec.phase : undefined,
              waitSince: typeof rec.wait_since === 'number' ? rec.wait_since : undefined,
              lastNudgedSeq:
                typeof rec.last_nudged_seq === 'number' ? rec.last_nudged_seq : undefined,
              killed: typeof rec.killed === 'boolean' ? rec.killed : undefined,
            };

            swarmMemberByConvId.set(memberConvId, memberMeta);
            if (!extraParentLinks.has(memberConvId) && memberConvId !== convId) {
              extraParentLinks.set(memberConvId, convId);
            }
          }
        } catch {
          // Skip malformed members.json
        }
      }

      const boardPath = path.join(swarmDir, 'board.jsonl');
      const messages = fs.existsSync(boardPath) ? readBoardMessages(boardPath, 40) : [];
      if (swarmTitle || messages.length > 0) {
        swarmBoardsByRootConvId.set(convId, { title: swarmTitle, messages });
      }
    }

    // Transcript tail
    transcriptByConvId.set(convId, scanTranscriptSummary(agyDataDir, convId));
  }

  return {
    presenceLocks,
    subagentMetaByConvId,
    swarmMemberByConvId,
    swarmBoardsByRootConvId,
    extraParentLinks,
    transcriptByConvId,
  };
}
