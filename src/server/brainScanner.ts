import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentLogEntry,
  QuotaPoolId,
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
  prompt?: string;
  createdAt?: string;
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

export interface QuotaObservation {
  pool: QuotaPoolId;
  remainingPct: number;
  resetsAt?: string;
  observedAt?: string;
  sourceModel?: string;
}

export interface TranscriptLastError {
  stepIndex: number;
  timestamp: string;
  message: string;
  toolName?: string;
  target?: string;
}

export interface TranscriptSummary {
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  /** input + cache_read tokens of the latest model turn = real active context fill. */
  lastContextTokens?: number;
  quotaObservations?: QuotaObservation[];
  latestToolName?: string;
  latestTargetSummary?: string;
  latestThoughtSnippet?: string;
  lastStepStatus?: string;
  lastTimestamp?: string;
  lastError?: TranscriptLastError;
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

const TRANSCRIPT_TAIL_BYTES = 32768;
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

export function sanitizeAgentSpeechText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const text = raw
    .replace(/<SYSTEM_MESSAGE>[\s\S]*?(?:<\/SYSTEM_MESSAGE>|$)/gi, ' ')
    .replace(/^\s*(?:Created|Completed)\s+At:\s*[^\r\n]*$/gim, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';
  if (text.startsWith('{') || text.startsWith('[')) return '';
  if (
    /^(?:Waiting for a message\b|\[swarm\]\s+new board message\b|\[board\]\s+the latest message\b|Made \d+ replacement\b|Showing lines \d+|Command exited with code \d+|Created file\.?$)/i.test(
      text,
    )
  ) {
    return '';
  }
  return text;
}

function extractPostMessageText(toolCalls: unknown): string {
  if (!Array.isArray(toolCalls)) return '';
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const call = toolCalls[i] as Record<string, unknown> | undefined;
    if (!call || typeof call.name !== 'string') continue;
    if (call.name !== 'post_message') continue;
    const rawArgs = call.args ?? call.arguments;
    if (rawArgs && typeof rawArgs === 'object') {
      const textVal = (rawArgs as Record<string, unknown>).text;
      if (typeof textVal === 'string') {
        const clean = sanitizeAgentSpeechText(textVal);
        if (clean) return clean;
      }
    } else if (typeof rawArgs === 'string') {
      try {
        const parsedArgs = JSON.parse(rawArgs) as Record<string, unknown>;
        if (typeof parsedArgs.text === 'string') {
          const clean = sanitizeAgentSpeechText(parsedArgs.text);
          if (clean) return clean;
        }
      } catch {
        // Ignore invalid JSON args
      }
    }
  }
  return '';
}

export function classifyQuotaPool(modelName: string): QuotaPoolId | null {
  const lower = modelName.toLowerCase();
  if (/claude|gpt|opus|sonnet/.test(lower)) return 'claude_gpt';
  if (/gemini|orchestrator/.test(lower)) return 'gemini';
  return null;
}

const QUOTA_WARNING_RE =
  /\[quota\]\s+model\s+([\w.\-]+)\s+is low on quota\s+\((\d+(?:\.\d+)?)%\s+remaining,\s+resets at\s+([0-9T:.\-+Z]+)\)/gi;
const QUOTA_MODELS_JSON_RE =
  /\\?"([\w.\-]+)\\?":\s*\{\s*\\?"quota_remaining\\?":\s*\\?"(\d+(?:\.\d+)?)%\\?",\s*\\?"quota_resets\\?":\s*\\?"([^"\\]+)\\?"\s*\}/g;

/** Extract real account-quota observations from one raw transcript line. */
export function extractQuotaObservations(
  rawLine: string,
  observedAt?: string,
): QuotaObservation[] {
  const byPool = new Map<QuotaPoolId, QuotaObservation>();
  const record = (model: string, pct: string, resetsAt: string) => {
    const pool = classifyQuotaPool(model);
    const remainingPct = Number(pct);
    if (!pool || !Number.isFinite(remainingPct)) return;
    const prev = byPool.get(pool);
    if (!prev || remainingPct < prev.remainingPct) {
      byPool.set(pool, { pool, remainingPct, resetsAt, observedAt, sourceModel: model });
    }
  };

  if (rawLine.includes('[quota]')) {
    for (const m of rawLine.matchAll(QUOTA_WARNING_RE)) record(m[1], m[2], m[3]);
  }
  if (rawLine.includes('quota_remaining')) {
    for (const m of rawLine.matchAll(QUOTA_MODELS_JSON_RE)) record(m[1], m[2], m[3]);
  }
  return Array.from(byPool.values());
}

export function parseTranscriptSummary(text: string): TranscriptSummary {
  const summary: TranscriptSummary = {
    inputTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    recentSteps: [],
  };
  const latestQuotaByPool = new Map<QuotaPoolId, QuotaObservation>();

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

    const entryTypeRaw = typeof entry.type === 'string' ? entry.type.toUpperCase() : '';
    if (
      tokens.input + tokens.cacheRead > 0 &&
      (entryTypeRaw === 'PLANNER_RESPONSE' || entryTypeRaw === '')
    ) {
      summary.lastContextTokens = tokens.input + tokens.cacheRead;
    }

    for (const obs of extractQuotaObservations(
      line,
      typeof entry.created_at === 'string' ? entry.created_at : undefined,
    )) {
      latestQuotaByPool.set(obs.pool, obs);
    }

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
    let entryToolName: string | undefined;
    let entryTarget: string | undefined;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const lastCall = toolCalls[toolCalls.length - 1] as Record<string, unknown> | undefined;
      if (lastCall && typeof lastCall.name === 'string') {
        entryToolName = lastCall.name;
        entryTarget = extractTargetSummary(lastCall.args ?? lastCall.arguments);
        summary.latestToolName = entryToolName;
        summary.latestTargetSummary = entryTarget;
      }
    }

    if (typeof entry.status === 'string' && entry.status.toUpperCase() === 'ERROR') {
      const rawErrObj = entry.error as Record<string, unknown> | string | undefined;
      const errFromField =
        typeof rawErrObj === 'string'
          ? rawErrObj
          : rawErrObj && typeof rawErrObj === 'object' && typeof rawErrObj.message === 'string'
            ? rawErrObj.message
            : '';
      const rawContent = typeof entry.content === 'string' ? entry.content : '';
      const cleanedContent = rawContent ? sanitizeAgentSpeechText(rawContent) || rawContent : '';
      const rawMessage = errFromField.trim() || cleanedContent.trim();
      const message = rawMessage
        ? truncateText(rawMessage, 160)
        : entryToolName
          ? `${entryToolName} failed`
          : 'Error detected';
      const stepIndex =
        typeof entry.step_index === 'number' && Number.isFinite(entry.step_index)
          ? entry.step_index
          : Math.max(0, (summary.recentSteps?.length ?? 1) - 1);
      const timestamp =
        typeof entry.created_at === 'string' && entry.created_at
          ? entry.created_at
          : summary.lastTimestamp || '';
      summary.lastError = {
        stepIndex,
        timestamp,
        message,
        toolName: entryToolName ?? summary.latestToolName,
        target: entryTarget ?? summary.latestTargetSummary,
      };
    }

    const entryType = typeof entry.type === 'string' ? entry.type.toUpperCase() : '';
    const entrySource = typeof entry.source === 'string' ? entry.source.toUpperCase() : '';
    if (entryType !== 'TOOL_RESPONSE' && entrySource !== 'SYSTEM') {
      const postMsgText = extractPostMessageText(toolCalls);
      const cleanContent =
        typeof entry.content === 'string' ? sanitizeAgentSpeechText(entry.content) : '';
      const cleanThinking =
        typeof entry.thinking === 'string' ? sanitizeAgentSpeechText(entry.thinking) : '';
      const thoughtText = postMsgText || cleanContent || cleanThinking;
      if (thoughtText) {
        summary.latestThoughtSnippet = truncateText(thoughtText, 220);
      }
    }
  }

  if (latestQuotaByPool.size > 0) {
    summary.quotaObservations = Array.from(latestQuotaByPool.values());
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

    const rawType = typeof raw.type === 'string' ? raw.type.toUpperCase() : '';
    const rawSource = typeof raw.source === 'string' ? raw.source.toUpperCase() : '';
    let rawThought: string | undefined;
    if (rawType !== 'TOOL_RESPONSE' && rawSource !== 'SYSTEM') {
      const postMsg = extractPostMessageText(raw.tool_calls);
      const cleanContent =
        typeof raw.content === 'string' ? sanitizeAgentSpeechText(raw.content) : '';
      const cleanThinking =
        typeof raw.thinking === 'string' ? sanitizeAgentSpeechText(raw.thinking) : '';
      const combined = postMsg || cleanContent || cleanThinking;
      if (combined) rawThought = combined;
    }

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

export function normalizeSwarmRoleLabel(label: string): string {
  const trimmed = label.trim();
  const match = trimmed.match(/^Swarm Worker\s*\(([^)]+)\)$/i);
  return match ? match[1].trim() : trimmed;
}

export function normalizeSwarmRoleMentionsInText(text: string): string {
  return text.replace(
    /@Swarm Worker\s*\(([^)]+)\)/gi,
    (_full, inner: string) => `@${inner.trim()}`,
  );
}

export function extractMentions(text: string, knownNames?: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      result.push(trimmed);
    }
  };

  if (knownNames && knownNames.length > 0) {
    const lowerText = text.toLowerCase();
    for (const candidate of knownNames) {
      if (!candidate) continue;
      if (lowerText.includes(`@${candidate.toLowerCase()}`)) {
        add(candidate);
      }
    }
  }

  const matches = text.matchAll(/@([a-zA-Z0-9_-]+)/g);
  for (const match of matches) {
    const token = match[1];
    if (!token) continue;
    // Skip partial first word if a multi-word known name starting with token was already matched
    const alreadyCovered = result.some((r) =>
      r.toLowerCase().startsWith(token.toLowerCase() + ' '),
    );
    if (!alreadyCovered) {
      add(token);
    }
  }
  return result;
}

export function buildSwarmMentionEdges(
  messages: SwarmBoardMessage[],
  knownNames?: string[],
): SwarmMentionEdge[] {
  const edgeMap = new Map<string, SwarmMentionEdge>();

  for (const msg of messages) {
    const extracted = extractMentions(msg.text, knownNames);
    const mentions = Array.from(new Set([...(msg.mentions ?? []), ...extracted]));
    for (const target of mentions) {
      if (!target || target.toLowerCase() === msg.agent.toLowerCase()) continue;
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
      const rawText = typeof parsed.text === 'string' ? parsed.text : '';
      const text = normalizeSwarmRoleMentionsInText(rawText);
      const mentions = extractMentions(text);
      messages.push({
        seq: Number(parsed.seq || 0),
        agent: normalizeSwarmRoleLabel(
          typeof parsed.agent === 'string' ? parsed.agent : 'unknown',
        ),
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
              prompt:
                typeof parsed.prompt === 'string'
                  ? parsed.prompt
                  : typeof desc.prompt === 'string'
                    ? desc.prompt
                    : undefined,
              createdAt:
                typeof parsed.createdAt === 'string'
                  ? parsed.createdAt
                  : typeof parsed.timestamp === 'string'
                    ? parsed.timestamp
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

  // 3. Scan .system_generated/messages/*.json & subagent delegations across roots + subagents
  const resolveRootId = (convId: string): string => {
    const visited = new Set<string>();
    let cur = convId;
    while (extraParentLinks.has(cur) && !visited.has(cur) && visited.size < 25) {
      visited.add(cur);
      const p = extraParentLinks.get(cur)!;
      if (visited.has(p)) break;
      cur = p;
    }
    return cur;
  };

  const resolveAgentLabel = (rawId: string): string => {
    if (!rawId) return 'unknown';
    const taskMatch = rawId.match(/\/(task-[^/]+)$/i);
    if (taskMatch) return taskMatch[1];
    const subMeta = subagentMetaByConvId.get(rawId);
    if (subMeta) {
      return normalizeSwarmRoleLabel(subMeta.role || subMeta.typeName || rawId.slice(0, 8));
    }
    const swarmMeta = swarmMemberByConvId.get(rawId);
    if (swarmMeta) return normalizeSwarmRoleLabel(swarmMeta.rosterName);
    if (!extraParentLinks.has(rawId)) return 'coordinator';
    return rawId.slice(0, 8);
  };

  const syntheticByRoot = new Map<string, SwarmBoardMessage[]>();
  const allScanConvIds = Array.from(
    new Set([...conversationIds, ...Array.from(subagentMetaByConvId.keys())]),
  );

  for (const convId of allScanConvIds) {
    const messagesDir = path.join(brainDir, convId, '.system_generated', 'messages');
    if (!fs.existsSync(messagesDir)) continue;

    let files: string[];
    try {
      files = fs.readdirSync(messagesDir);
    } catch {
      continue;
    }

    const rootId = resolveRootId(convId);
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'read.json') continue;
      try {
        const raw = fs.readFileSync(path.join(messagesDir, file), 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const senderRaw = typeof parsed.sender === 'string' ? parsed.sender.trim() : '';
        if (!senderRaw || senderRaw.toLowerCase() === 'system') continue;

        const contentRaw = typeof parsed.content === 'string' ? parsed.content.trim() : '';
        if (/^\[swarm\]\s+new board message #\d+/i.test(contentRaw)) continue;

        const recipientRaw =
          typeof parsed.recipient === 'string' ? parsed.recipient.trim() : '';
        const senderLabel = resolveAgentLabel(senderRaw);
        const recipientLabel = recipientRaw ? resolveAgentLabel(recipientRaw) : '';

        const renderDetails = parsed.renderDetails as
          | { messageTitle?: unknown }
          | undefined;
        const title =
          typeof renderDetails?.messageTitle === 'string'
            ? renderDetails.messageTitle.trim()
            : '';
        const excerpt = contentRaw ? truncateText(contentRaw, 110) : '';
        let combined = normalizeSwarmRoleMentionsInText(
          title && excerpt ? `${title}: ${excerpt}` : title || excerpt || 'Message',
        );

        const mentions: string[] = [];
        if (
          recipientLabel &&
          recipientLabel !== 'unknown' &&
          recipientLabel.toLowerCase() !== senderLabel.toLowerCase()
        ) {
          mentions.push(recipientLabel);
          if (!combined.toLowerCase().includes(`@${recipientLabel.toLowerCase()}`)) {
            combined = `@${recipientLabel} ${combined}`;
          }
        }
        for (const m of extractMentions(combined)) {
          if (!mentions.some((x) => x.toLowerCase() === m.toLowerCase())) {
            mentions.push(m);
          }
        }

        const time =
          typeof parsed.timestamp === 'string'
            ? parsed.timestamp
            : typeof parsed.createdAt === 'string'
              ? parsed.createdAt
              : '';

        const list = syntheticByRoot.get(rootId) ?? [];
        list.push({
          seq: 0,
          agent: senderLabel,
          text: truncateText(combined, 160),
          time,
          kind: 'subagent_message',
          mentions,
        });
        syntheticByRoot.set(rootId, list);
      } catch {
        // Skip malformed message JSON
      }
    }
  }

  // Synthesize delegation messages for subagents without an explicit delegation message
  for (const subMeta of subagentMetaByConvId.values()) {
    const rootId = resolveRootId(subMeta.conversationId);
    const subLabel = normalizeSwarmRoleLabel(
      subMeta.role || subMeta.typeName || subMeta.conversationId.slice(0, 8),
    );
    const list = syntheticByRoot.get(rootId) ?? [];
    const alreadyRepresented = list.some(
      (m) =>
        m.agent.toLowerCase() === 'coordinator' &&
        (m.mentions ?? []).some((t) => t.toLowerCase() === subLabel.toLowerCase()),
    );
    if (!alreadyRepresented) {
      const summary = truncateText(
        subMeta.prompt || subMeta.role || subMeta.typeName || 'Subagent delegated',
        110,
      );
      list.push({
        seq: 0,
        agent: 'coordinator',
        text: `@${subLabel} ${summary}`,
        time: subMeta.createdAt || '',
        kind: 'delegation',
        mentions: [subLabel],
      });
      syntheticByRoot.set(rootId, list);
    }
  }

  for (const [rootId, synthMessages] of syntheticByRoot.entries()) {
    if (synthMessages.length === 0) continue;
    const existing = swarmBoardsByRootConvId.get(rootId);
    const merged = [...(existing?.messages ?? []), ...synthMessages];
    merged.sort((a, b) => {
      const ta = a.time ? Date.parse(a.time) : 0;
      const tb = b.time ? Date.parse(b.time) : 0;
      if (ta && tb && ta !== tb) return ta - tb;
      return a.seq - b.seq;
    });
    merged.forEach((m, idx) => {
      if (!m.seq) m.seq = idx + 1;
    });
    swarmBoardsByRootConvId.set(rootId, {
      title: existing?.title,
      messages: merged.slice(-40),
    });
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
