import crypto from 'node:crypto';
import type {
  ActivityTimelineBucket,
  AgentActivityKind,
  AgentHealthMetrics,
  AgentResourceUsage,
  CompanyTier,
  FloorAnalytics,
  FloorRandomEvent,
  ModelBreakdownEntry,
  ModelFamily,
  NormalizedAgentState,
  OfficeEmployee,
  OfficeZone,
  PlazaFloor,
  PlazaSnapshot,
  SwarmBoardMessage,
  SwarmMentionEdge,
  SwarmTaskNode,
  SwarmTaskStatus,
  ToolActivityStatus,
} from '../shared/types.js';
import { getActiveFloorEvent, getFloorLayoutSeed } from './officeEvents.js';
import {
  buildSwarmMentionEdges,
  classifySwarmRole,
  scanBrainData,
  type BrainScanResult,
  type SubagentMeta,
  type SwarmMemberMeta,
  type TranscriptSummary,
} from './brainScanner.js';
import { GO_HOME_MINUTES, normalizeWorkspaceKey } from './config.js';
import {
  readConversationSummaries,
  resolveConversationWorkspaces,
  type ConversationSummaryRow,
  type ResolvedWorkspaceInfo,
} from './dbReader.js';
import { getDemoFloor } from './demoSimulator.js';

export const GO_HOME_START_MS = GO_HOME_MINUTES * 60_000;
export const GO_HOME_GONE_MS = (GO_HOME_MINUTES + 1.5) * 60_000;

/**
 * Filter non-working employees by inactivity age:
 * - working: always stays
 * - 8m..9.5m inactive (non-working): walks to ELEVATOR with activity 'going_home'
 * - >= 9.5m inactive (non-working): removed from office & counted in offDutyCount
 */
export function applyGoHomeLifecycle(
  employees: OfficeEmployee[],
  nowMs = Date.now(),
): { employees: OfficeEmployee[]; offDutyCount: number } {
  const present: OfficeEmployee[] = [];
  let offDutyCount = 0;

  for (const emp of employees) {
    if (emp.status === 'working') {
      present.push(emp);
      continue;
    }

    const lastActiveMs = parseTimestampMs(emp.lastActiveAt);
    const ageMs = lastActiveMs > 0 ? Math.max(0, nowMs - lastActiveMs) : GO_HOME_GONE_MS;

    if (ageMs >= GO_HOME_GONE_MS) {
      offDutyCount += 1;
      continue;
    }

    if (ageMs >= GO_HOME_START_MS) {
      emp.zone = 'ELEVATOR';
      emp.activity = 'going_home';
      emp.speechBubble = '🏠 Mesai bitti, eve gidiyorum!';
      emp.status = 'idle';
      emp.partnerId = undefined;
      emp.partnerName = undefined;
      emp.playerSlot = undefined;
      emp.isPresenter = undefined;
    }

    present.push(emp);
  }

  return { employees: present, offDutyCount };
}

export function classifyToolActivity(params: {
  status: OfficeEmployee['status'];
  toolName?: string;
  targetSummary?: string;
  lastStepStatus?: string;
}): ToolActivityStatus {
  if (params.status === 'error' || params.lastStepStatus?.toUpperCase() === 'ERROR') {
    return 'error';
  }
  if (params.status !== 'working') {
    return 'idle';
  }

  const tool = (params.toolName || '').toLowerCase();
  const target = (params.targetSummary || '').toLowerCase();

  if (tool.includes('command_status')) {
    return 'testing';
  }
  if (tool.includes('run_command') || tool === 'bash' || tool === 'shell') {
    if (
      target.includes('grep') ||
      target.includes('rg ') ||
      target.includes('select-string') ||
      target.includes('findstr')
    ) {
      return 'searching';
    }
    if (
      target.includes('get-content') ||
      target.includes('cat ') ||
      target.includes('head ') ||
      target.includes('tail ') ||
      target.includes('get-childitem') ||
      target.includes('ls ')
    ) {
      return 'reading';
    }
    return 'testing';
  }

  if (tool.includes('search') || tool === 'find_by_name') {
    return 'searching';
  }

  if (
    tool.includes('read') ||
    tool.includes('view_file') ||
    tool.includes('list') ||
    (tool === 'swarm' && (target === 'status' || target === 'models'))
  ) {
    return 'reading';
  }

  if (
    tool.includes('write') ||
    tool.includes('edit') ||
    tool.includes('replace') ||
    tool.includes('post_message') ||
    tool.includes('delete') ||
    tool === 'swarm'
  ) {
    return 'writing';
  }

  return tool ? 'writing' : 'reading';
}

export function computeModelBreakdown(employees: OfficeEmployee[]): ModelBreakdownEntry[] {
  const byModel = new Map<string, ModelBreakdownEntry>();

  for (const emp of employees) {
    const key = `${emp.modelFamily}::${emp.modelId}`;
    const tokens = emp.inputTokens + emp.cacheReadTokens + emp.outputTokens;
    const existing = byModel.get(key);
    if (existing) {
      existing.agentCount += 1;
      if (emp.status === 'working') existing.activeCount += 1;
      existing.totalTokens += tokens;
    } else {
      byModel.set(key, {
        modelFamily: emp.modelFamily,
        modelId: emp.modelId,
        agentCount: 1,
        activeCount: emp.status === 'working' ? 1 : 0,
        totalTokens: tokens,
      });
    }
  }

  return Array.from(byModel.values()).sort(
    (a, b) => b.agentCount - a.agentCount || b.totalTokens - a.totalTokens,
  );
}

export function computeFloorAnalytics(params: {
  employees: OfficeEmployee[];
  stepEventsByAgent?: Map<string, Array<{ timestamp: string; status: string }>>;
  nowMs: number;
}): FloorAnalytics {
  const BUCKET_COUNT = 12;
  const BUCKET_MS = 5 * 60_000;
  const windowStartMs = params.nowMs - BUCKET_COUNT * BUCKET_MS;

  const buckets: ActivityTimelineBucket[] = [];
  const activeAgentsPerBucket: Array<Set<string>> = [];

  for (let i = 0; i < BUCKET_COUNT; i++) {
    const startMs = windowStartMs + i * BUCKET_MS;
    const endMs = startMs + BUCKET_MS;
    buckets.push({
      bucketStart: new Date(startMs).toISOString(),
      label: new Date(endMs).toISOString().slice(11, 16),
      activeCount: 0,
      completedTasks: 0,
      errorCount: 0,
    });
    activeAgentsPerBucket.push(new Set<string>());
  }

  if (params.stepEventsByAgent) {
    for (const [agentId, events] of params.stepEventsByAgent.entries()) {
      for (const ev of events) {
        const tsMs = parseTimestampMs(ev.timestamp);
        if (tsMs < windowStartMs || tsMs > params.nowMs) continue;
        const idx = Math.min(
          BUCKET_COUNT - 1,
          Math.max(0, Math.floor((tsMs - windowStartMs) / BUCKET_MS)),
        );
        activeAgentsPerBucket[idx].add(agentId);
        if (ev.status.toUpperCase() === 'ERROR') {
          buckets[idx].errorCount += 1;
        } else {
          buckets[idx].completedTasks += 1;
        }
      }
    }
  }

  for (const emp of params.employees) {
    const lastMs = parseTimestampMs(emp.lastActiveAt);
    if (lastMs >= windowStartMs && lastMs <= params.nowMs) {
      const idx = Math.min(
        BUCKET_COUNT - 1,
        Math.max(0, Math.floor((lastMs - windowStartMs) / BUCKET_MS)),
      );
      activeAgentsPerBucket[idx].add(emp.id);
    }
    if (emp.status === 'working') {
      activeAgentsPerBucket[BUCKET_COUNT - 1].add(emp.id);
    }
  }

  let completedTasks60m = 0;
  let peakActive60m = 0;
  for (let i = 0; i < BUCKET_COUNT; i++) {
    buckets[i].activeCount = activeAgentsPerBucket[i].size;
    completedTasks60m += buckets[i].completedTasks;
    if (buckets[i].activeCount > peakActive60m) {
      peakActive60m = buckets[i].activeCount;
    }
  }

  const { agentResources, totalEstimatedTokens, totalEstimatedCostUsd } =
    computeAgentResources(params.employees);

  return {
    timeline60m: buckets,
    completedTasks60m,
    peakActive60m,
    modelBreakdown: computeModelBreakdown(params.employees),
    agentResources,
    totalEstimatedTokens,
    totalEstimatedCostUsd,
  };
}

const VERIFIED_OUTPUT_RE =
  /\b(PASS|DONE|EXIT\s*0|VERIFIED|tamamlandı|başarılı|commit\b|[0-9]+\/[0-9]+\s*(?:test|pass))|✅/i;

const MODEL_USD_PER_1M: Record<ModelFamily, number> = {
  argon: 2.5,
  pro: 3.0,
  claude: 3.0,
  gpt: 3.0,
  hydrogen: 1.25,
  carbon: 1.5,
  flash: 0.25,
  other: 1.0,
};

export function extractVerificationProof(texts: Array<string | undefined>): {
  isVerifiedOutput: boolean;
  verifiedLabel?: string;
  evidenceBadges: string[];
} {
  let isVerifiedOutput = false;
  let verifiedLabel: string | undefined;
  const badges: string[] = [];
  const seen = new Set<string>();
  const addBadge = (b: string) => {
    const clean = b.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    badges.push(clean);
  };

  for (const raw of texts) {
    if (!raw) continue;
    const match = VERIFIED_OUTPUT_RE.exec(raw);
    if (match && !isVerifiedOutput) {
      isVerifiedOutput = true;
      verifiedLabel = match[0].trim().toUpperCase();
      addBadge(verifiedLabel);
    }
    const testCountMatch = /\b\d+\/\d+\s*(?:test|pass)/i.exec(raw);
    if (testCountMatch) addBadge(testCountMatch[0]);
    const fileMatch = /[\w.-]+\.(?:tsx?|jsx?|json|md)\b/.exec(raw);
    if (fileMatch) addBadge(fileMatch[0]);
  }

  return {
    isVerifiedOutput,
    verifiedLabel,
    evidenceBadges: badges.slice(0, 4),
  };
}

export function computeAgentResources(employees: OfficeEmployee[]): {
  agentResources: AgentResourceUsage[];
  totalEstimatedTokens: number;
  totalEstimatedCostUsd: number;
} {
  let totalEstimatedTokens = 0;
  let totalEstimatedCostUsd = 0;

  const agentResources: AgentResourceUsage[] = employees.map((emp) => {
    const rawTokens =
      (emp.inputTokens || 0) + (emp.cacheReadTokens || 0) + (emp.outputTokens || 0);
    const estimatedTokens = rawTokens > 0 ? rawTokens : Math.max(0, emp.stepCount) * 850;
    const rate = MODEL_USD_PER_1M[emp.modelFamily] ?? 1.0;
    const estimatedCostUsd = Number(((estimatedTokens / 1_000_000) * rate).toFixed(4));
    totalEstimatedTokens += estimatedTokens;
    totalEstimatedCostUsd += estimatedCostUsd;

    return {
      agentId: emp.id,
      agentName: emp.name,
      modelName: emp.modelId,
      modelFamily: emp.modelFamily,
      estimatedTokens,
      estimatedCostUsd,
      completedTasks: Math.max(emp.health?.isVerifiedOutput ? 1 : 0, Math.floor(emp.stepCount / 3)),
      isEstimated: true,
    };
  });

  return {
    agentResources,
    totalEstimatedTokens,
    totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(4)),
  };
}

export function buildFloorTaskNodes(
  employees: OfficeEmployee[],
  boardMessages: SwarmBoardMessage[],
  swarmEdges: SwarmMentionEdge[],
): SwarmTaskNode[] {
  if (employees.length === 0) return [];
  const coordinator = employees.find((e) => e.isCoordinator) ?? employees[0];
  const rootTaskId = `task-${coordinator.id}`;
  const empByLowerName = new Map<string, OfficeEmployee>();
  for (const emp of employees) {
    empByLowerName.set(emp.name.toLowerCase(), emp);
  }

  return employees.map((emp) => {
    const isRoot = emp.id === coordinator.id;
    const empMsgs = boardMessages
      .filter((m) => m.agent.toLowerCase() === emp.name.toLowerCase())
      .map((m) => m.text);
    const proof = extractVerificationProof([
      ...empMsgs.slice(-3).reverse(),
      emp.speechBubble,
      emp.currentTarget,
    ]);

    const handoffTargetNames = [
      ...new Set(
        swarmEdges
          .filter((edge) => edge.from.toLowerCase() === emp.name.toLowerCase())
          .map((edge) => edge.to),
      ),
    ];

    const dependsOnTaskIds: string[] = [];
    if (!isRoot) {
      dependsOnTaskIds.push(rootTaskId);
      for (const edge of swarmEdges) {
        if (edge.to.toLowerCase() === emp.name.toLowerCase()) {
          const src = empByLowerName.get(edge.from.toLowerCase());
          if (src && src.id !== emp.id && src.id !== coordinator.id) {
            const depId = `task-${src.id}`;
            if (!dependsOnTaskIds.includes(depId)) dependsOnTaskIds.push(depId);
          }
        }
      }
    }

    let status: SwarmTaskStatus = 'pending';
    if (proof.isVerifiedOutput || emp.health?.isVerifiedOutput) {
      status = 'verified';
    } else if (emp.status === 'error') {
      status = 'blocked';
    } else if (emp.status === 'working') {
      status = 'running';
    } else if (emp.health?.normalizedState === 'completed') {
      status = 'completed';
    }

    const rawTitle = emp.currentTarget
      ? `${emp.roleTitle}: ${emp.currentTarget}`
      : emp.speechBubble || emp.roleTitle;
    const title = rawTitle.length > 72 ? `${rawTitle.slice(0, 69)}...` : rawTitle;

    const evidenceBadges = [...proof.evidenceBadges];
    if (emp.currentTool && !evidenceBadges.includes(emp.currentTool)) {
      evidenceBadges.push(emp.currentTool);
    }

    return {
      id: `task-${emp.id}`,
      title,
      ownerAgentId: emp.id,
      ownerName: emp.name,
      ownerRole: emp.roleTitle,
      parentTaskId: isRoot ? undefined : rootTaskId,
      dependsOnTaskIds,
      handoffTargetNames,
      status,
      verifiedKeyword: proof.verifiedLabel ?? emp.health?.verifiedLabel,
      evidenceBadges: evidenceBadges.slice(0, 4),
      updatedAt: emp.lastActiveAt,
      durationSec: emp.health?.elapsedSec,
    };
  });
}

export function aggregatePlazaAnalytics(
  floors: PlazaFloor[],
  nowMs: number,
): { timeline60m: ActivityTimelineBucket[]; modelBreakdown: ModelBreakdownEntry[] } {
  const BUCKET_COUNT = 12;
  const BUCKET_MS = 5 * 60_000;
  const windowStartMs = nowMs - BUCKET_COUNT * BUCKET_MS;

  const timeline60m: ActivityTimelineBucket[] = [];
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const startMs = windowStartMs + i * BUCKET_MS;
    const endMs = startMs + BUCKET_MS;
    timeline60m.push({
      bucketStart: new Date(startMs).toISOString(),
      label: new Date(endMs).toISOString().slice(11, 16),
      activeCount: 0,
      completedTasks: 0,
      errorCount: 0,
    });
  }

  const allEmployees: OfficeEmployee[] = [];
  for (const floor of floors) {
    allEmployees.push(...floor.employees);
    if (floor.analytics?.timeline60m) {
      for (let i = 0; i < Math.min(BUCKET_COUNT, floor.analytics.timeline60m.length); i++) {
        const b = floor.analytics.timeline60m[i];
        timeline60m[i].activeCount += b.activeCount;
        timeline60m[i].completedTasks += b.completedTasks;
        timeline60m[i].errorCount += b.errorCount;
      }
    }
  }

  return {
    timeline60m,
    modelBreakdown: computeModelBreakdown(allEmployees),
  };
}

export function classifyModelFamily(modelId: string | undefined | null): ModelFamily {
  const lower = (modelId || '').toLowerCase();
  if (lower.includes('argon') || lower.includes('orchestrator')) return 'argon';
  if (lower.includes('hydrogen')) return 'hydrogen';
  if (lower.includes('flash')) return 'flash';
  if (lower.includes('carbon')) return 'carbon';
  if (
    lower.includes('claude') ||
    lower.includes('sonnet') ||
    lower.includes('opus') ||
    lower.includes('haiku')
  ) {
    return 'claude';
  }
  if (
    lower.includes('gpt') ||
    lower.includes('chatgpt') ||
    /(^|[^a-z0-9])o[134]([^a-z0-9]|$)/.test(lower)
  ) {
    return 'gpt';
  }
  if (lower.includes('pro') || lower.includes('ultra')) return 'pro';
  return 'other';
}

export function computeEmployeeXpAndLevel(stepCount: number): { xp: number; level: number } {
  const safeSteps = Math.max(0, Math.floor(stepCount));
  const xp = safeSteps * 15;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 45)) + 1);
  return { xp, level };
}

export function computeCompanyTier(companyXp: number): {
  tier: CompanyTier;
  nextTierXp: number;
  unlockedProps: string[];
} {
  let tier: CompanyTier = 1;
  let nextTierXp = 500;

  if (companyXp >= 10000) {
    tier = 4;
    nextTierXp = 25000;
  } else if (companyXp >= 2500) {
    tier = 3;
    nextTierXp = 10000;
  } else if (companyXp >= 500) {
    tier = 2;
    nextTierXp = 2500;
  }

  const unlockedProps: string[] = [];
  if (tier >= 2) {
    unlockedProps.push('plants', 'dual_monitors');
  }
  if (tier >= 3) {
    unlockedProps.push('trophy', 'espresso');
  }
  if (tier >= 4) {
    unlockedProps.push('arcade', 'hologram');
  }

  return { tier, nextTierXp, unlockedProps };
}

export function computeEcoScore(employees: OfficeEmployee[]): number {
  if (employees.length === 0) return 85;

  let totalScore = 0;
  for (const emp of employees) {
    let score = 60;
    // Reward lightweight/efficient model families
    if (emp.modelFamily === 'flash') score += 22;
    else if (emp.modelFamily === 'hydrogen') score += 16;
    else if (emp.modelFamily === 'claude') score += 10;
    else if (emp.modelFamily === 'carbon' || emp.modelFamily === 'gpt') score += 8;
    else if (emp.modelFamily === 'pro') score += 6;
    else if (emp.modelFamily === 'argon') score += 4;

    // Reward prompt cache utilization
    const totalInput = emp.inputTokens + emp.cacheReadTokens;
    if (totalInput > 0) {
      const cacheRatio = emp.cacheReadTokens / totalInput;
      score += Math.round(cacheRatio * 15);
    }

    // Reward 0-token waiting discipline
    if (emp.status === 'waiting') {
      score += 10;
    } else if (emp.status === 'error') {
      score -= 10;
    }

    totalScore += Math.max(0, Math.min(100, score));
  }

  return Math.max(0, Math.min(100, Math.round(totalScore / employees.length)));
}

function truncateBubble(text: string | undefined, maxLen = 46): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, Math.max(0, maxLen - 3)).trimEnd() + '...';
}

function parseTimestampMs(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim()) {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) {
      return asNum > 1e12 ? asNum : asNum * 1000;
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function toIsoTimestamp(value: string | number | null | undefined): string {
  const ms = parseTimestampMs(value);
  return ms > 0 ? new Date(ms).toISOString() : new Date(0).toISOString();
}

export function determineEmployeeStatus(params: {
  rowStatus?: string | null;
  notFullyIdle?: number | null;
  hasPresenceLock: boolean;
  swarmMember?: SwarmMemberMeta;
  subagentMeta?: SubagentMeta;
  transcript?: TranscriptSummary;
  nowMs?: number;
  rootCoordinatorIdle?: boolean;
}): OfficeEmployee['status'] {
  const {
    rowStatus,
    notFullyIdle,
    swarmMember,
    subagentMeta,
    transcript,
    nowMs = Date.now(),
    rootCoordinatorIdle = false,
  } = params;

  const lastTranscriptMs = transcript?.lastTimestamp ? parseTimestampMs(transcript.lastTimestamp) : 0;
  const isRecentTranscriptActive =
    lastTranscriptMs > 0 &&
    nowMs - lastTranscriptMs <= 20_000 &&
    rowStatus !== 'CASCADE_RUN_STATUS_IDLE';

  const isExplicitlyRunning = rowStatus === 'CASCADE_RUN_STATUS_RUNNING' || notFullyIdle === 1;
  const isRunning =
    isExplicitlyRunning || (isRecentTranscriptActive && !rootCoordinatorIdle);

  const isSwarmWaiting =
    swarmMember !== undefined &&
    typeof swarmMember.waitSince === 'number' &&
    !isRunning;

  const subState = (subagentMeta?.state || '').toUpperCase();
  const isSubagentWaiting =
    subagentMeta !== undefined &&
    !isRunning &&
    (subState.includes('WAIT') || subState.includes('PARKED'));

  if (isRunning) {
    return 'working';
  }
  if (isSwarmWaiting || isSubagentWaiting) {
    return 'waiting';
  }
  if (transcript?.lastStepStatus === 'ERROR') {
    return 'error';
  }
  return 'idle';
}

export const computeEmployeeStatus = determineEmployeeStatus;

function getAssignedDesk(isCoordinator: boolean, roleTitle: string): OfficeZone {
  if (isCoordinator) return 'DESK_ARCHITECT';
  const lower = roleTitle.toLowerCase();
  if (
    lower.includes('verifier') ||
    lower.includes('analyst') ||
    lower.includes('research') ||
    lower.includes('qa')
  ) {
    return 'DESK_QA';
  }
  return 'DESK_CODING';
}

const MEETING_TOOLS = new Set([
  'send_message',
  'ask_question',
  'swarm',
  'post_message',
  'read_board',
]);
const TERMINAL_TOOLS = new Set(['run_command', 'manage_task']);
const CODING_TOOLS = new Set([
  'edit_file',
  'write_file',
  'replace_file_content',
  'multi_replace_file_content',
  'write_to_file',
]);
const READING_TOOLS = new Set([
  'read_file',
  'view_file',
  'grep_search',
  'find_by_name',
  'list_dir',
]);
const SEARCHING_TOOLS = new Set([
  'search_web',
  'read_url_content',
  'search_marketplace',
]);

export function determineZoneAndActivity(params: {
  status: OfficeEmployee['status'];
  isCoordinator: boolean;
  roleTitle: string;
  agentName: string;
  transcript?: TranscriptSummary;
  recentBoardMessages: SwarmBoardMessage[];
  nowMs?: number;
}): {
  zone: OfficeZone;
  activity: AgentActivityKind;
  speechBubble?: string;
} {
  const {
    status,
    isCoordinator,
    roleTitle,
    agentName,
    transcript,
    recentBoardMessages,
    nowMs = Date.now(),
  } = params;

  if (status === 'waiting') {
    return {
      zone: 'COFFEE_LOUNGE',
      activity: 'sleeping',
      speechBubble: 'Zzz (0 token)',
    };
  }

  if (status === 'idle') {
    return {
      zone: 'COFFEE_LOUNGE',
      activity: 'coffee',
      speechBubble: truncateBubble(transcript?.latestThoughtSnippet),
    };
  }

  const latestTool = transcript?.latestToolName || '';

  if (status === 'error') {
    const zone = TERMINAL_TOOLS.has(latestTool)
      ? 'SERVER_RACK'
      : getAssignedDesk(isCoordinator, roleTitle);
    return {
      zone,
      activity: 'error',
      speechBubble: truncateBubble(transcript?.latestThoughtSnippet || 'Hata tespit edildi'),
    };
  }

  // Check recent swarm board activity within last 60s
  const lowerName = agentName.toLowerCase();
  const recentBoardMatch = [...recentBoardMessages]
    .reverse()
    .find((msg) => {
      const msgMs = parseTimestampMs(msg.time);
      if (msgMs <= 0 || nowMs - msgMs > 60000) return false;
      const byAgent = msg.agent.toLowerCase() === lowerName;
      const mentionsAgent = msg.text.toLowerCase().includes(`@${lowerName}`);
      return byAgent || mentionsAgent;
    });

  if (recentBoardMatch || MEETING_TOOLS.has(latestTool)) {
    return {
      zone: 'WAR_ROOM',
      activity: 'meeting',
      speechBubble: truncateBubble(
        recentBoardMatch?.text || transcript?.latestThoughtSnippet,
      ),
    };
  }

  if (TERMINAL_TOOLS.has(latestTool)) {
    return {
      zone: 'SERVER_RACK',
      activity: 'terminal',
      speechBubble: truncateBubble(
        transcript?.latestTargetSummary || transcript?.latestThoughtSnippet,
      ),
    };
  }

  const desk = getAssignedDesk(isCoordinator, roleTitle);
  let activity: AgentActivityKind = 'thinking';
  if (CODING_TOOLS.has(latestTool)) {
    activity = 'coding';
  } else if (READING_TOOLS.has(latestTool)) {
    activity = 'reading';
  } else if (SEARCHING_TOOLS.has(latestTool)) {
    activity = 'searching';
  }

  return {
    zone: desk,
    activity,
    speechBubble: truncateBubble(
      transcript?.latestThoughtSnippet || transcript?.latestTargetSummary,
    ),
  };
}

const GAMING_CHATS: Array<[string, string]> = [
  ['🎮 Pas at, boşum!', '🎮 Gol be! 2-1!'],
  ['🎮 Street Fighter 1v1!', '🎮 Hadouken!! Kaçma!'],
  ['🎮 Mario Kart son tur!', '🎮 Mavi kabuk attım :D'],
  ['🎮 Co-op boss savaşı!', '🎮 Süper kombo! GG!'],
];

const PIZZA_BUBBLES = [
  '🍕 Sıcak pepperoni kap!',
  '🍕 Dilim efsane!',
  '🍕 Tam zamanında geldi!',
];
const WATERCOOLER_BUBBLES = [
  '💧 Su başı dedikodusu!',
  '💧 Flash 0 token yakıyor!',
];
const COFFEE_BREW_BUBBLES = [
  '☕ Taze espresso kokusu!',
  '☕ Duble shot zamanı!',
];
const ZOOMIES_BUBBLES = [
  '🐱 Kedi turboya geçti :D',
  '🤖 Maskot şov yapıyor!',
];
const CELEBRATION_BUBBLES = [
  '🎉 Sprint hedefi tamam!',
  '🚀 Şirket uçuyor!',
];
const STAR_WARS_BUBBLES = [
  '⚔️ Güç seninle olsun!',
  '⚔️ Işın kılıcı hazır!',
];
const SUPERHERO_BUBBLES = [
  '🦸 Pelerinler havaya!',
  '🦸 Bugünü biz kurtaracağız!',
];
const HALLOWEEN_BUBBLES = [
  '🎃 Şeker mi şaka mı?',
  '🎃 Balkabağı kostümüm nasıl?',
];

/**
 * Post-process COFFEE_LOUNGE (idle/waiting) employees on a floor to assign paired 2-player
 * console gaming, ambient micro-activities (lounging, coffee, watercooler, pizza), and
 * active floor event reactions. Never pulls `status === 'working'` employees off their work.
 */
export function applyLoungeActivities(
  employees: OfficeEmployee[],
  floorIndex: number,
  nowMs = Date.now(),
  activeEvent?: FloorRandomEvent | null,
): void {
  if (activeEvent?.kind === 'SPRINT_CELEBRATION') {
    for (const emp of employees) {
      if (emp.status === 'working' && !emp.speechBubble) {
        emp.speechBubble = '🎉 Harika gidiyoruz!';
      }
    }
  }

  const loungeEmployees = employees.filter(
    (e) => e.zone === 'COFFEE_LOUNGE' && (e.status === 'idle' || e.status === 'waiting'),
  );
  if (loungeEmployees.length === 0) return;

  const bucket = Math.floor(nowMs / 18000);
  const chatIdx = Math.floor(nowMs / 6000) % GAMING_CHATS.length;
  const claimedIds = new Set<string>();

  // 1. Active event reactions for idle/waiting lounge employees
  if (activeEvent?.kind === 'PIZZA_PARTY') {
    const count = Math.min(4, loungeEmployees.length);
    for (let i = 0; i < count; i++) {
      const emp = loungeEmployees[i];
      emp.activity = 'pizza';
      emp.partnerId = undefined;
      emp.partnerName = undefined;
      emp.playerSlot = undefined;
      emp.speechBubble = PIZZA_BUBBLES[i % PIZZA_BUBBLES.length];
      claimedIds.add(emp.id);
    }
  } else if (activeEvent?.kind === 'WATERCOOLER_GOSSIP') {
    const count = Math.min(3, loungeEmployees.length);
    for (let i = 0; i < count; i++) {
      const emp = loungeEmployees[i];
      emp.activity = 'watercooler';
      emp.partnerId = undefined;
      emp.partnerName = undefined;
      emp.playerSlot = undefined;
      emp.speechBubble = WATERCOOLER_BUBBLES[i % WATERCOOLER_BUBBLES.length];
      claimedIds.add(emp.id);
    }
  } else if (activeEvent?.kind === 'COFFEE_BREW') {
    const count = Math.min(4, loungeEmployees.length);
    for (let i = 0; i < count; i++) {
      const emp = loungeEmployees[i];
      emp.activity = 'coffee';
      emp.partnerId = undefined;
      emp.partnerName = undefined;
      emp.playerSlot = undefined;
      emp.speechBubble = COFFEE_BREW_BUBBLES[i % COFFEE_BREW_BUBBLES.length];
      claimedIds.add(emp.id);
    }
  }

  // 2. Paired 2-player console gaming among remaining unclaimed lounge employees
  const remainingForGaming = loungeEmployees.filter((e) => !claimedIds.has(e.id));
  if (
    remainingForGaming.length >= 2 &&
    (remainingForGaming.length >= 3 || (bucket + floorIndex) % 3 !== 0)
  ) {
    const idx1 = bucket % remainingForGaming.length;
    const idx2 = (idx1 + 1) % remainingForGaming.length;
    const p1 = remainingForGaming[idx1];
    const p2 = remainingForGaming[idx2];

    p1.activity = 'gaming';
    p1.playerSlot = 1;
    p1.partnerId = p2.id;
    p1.partnerName = p2.name;
    p1.speechBubble = GAMING_CHATS[chatIdx][0];

    p2.activity = 'gaming';
    p2.playerSlot = 2;
    p2.partnerId = p1.id;
    p2.partnerName = p1.name;
    p2.speechBubble = GAMING_CHATS[chatIdx][1];

    claimedIds.add(p1.id);
    claimedIds.add(p2.id);
  }

  // 3. Natural ambient micro-activities for remaining unclaimed lounge employees
  for (let empIdx = 0; empIdx < loungeEmployees.length; empIdx++) {
    const emp = loungeEmployees[empIdx];
    if (claimedIds.has(emp.id)) continue;

    emp.partnerId = undefined;
    emp.partnerName = undefined;
    emp.playerSlot = undefined;

    const slot = (empIdx + bucket) % 6;
    if (slot <= 2) {
      emp.activity = 'lounging';
      if (emp.status === 'waiting') {
        emp.speechBubble =
          (empIdx + bucket) % 2 === 0
            ? '🛋️ Koltukta dinleniyor (0 token)'
            : '😌 Zzz (0 token)';
      } else {
        emp.speechBubble = '🛋️ Kanepede mola keyfi';
      }
    } else if (slot === 3) {
      emp.activity = 'coffee';
      emp.speechBubble = '☕ Kahve & dinlenme';
    } else if (slot === 4) {
      emp.activity = 'watercooler';
      emp.speechBubble =
        (empIdx + bucket) % 2 === 0 ? '💧 Yeni modeli duydun mu?' : '💧 Su molası iyi geldi';
    } else {
      emp.activity = 'pizza';
      emp.speechBubble = '🍕 Atıştırmalık molası';
    }

    if (activeEvent?.kind === 'MASCOT_ZOOMIES') {
      emp.speechBubble = ZOOMIES_BUBBLES[empIdx % ZOOMIES_BUBBLES.length];
    } else if (activeEvent?.kind === 'SPRINT_CELEBRATION') {
      emp.speechBubble = CELEBRATION_BUBBLES[empIdx % CELEBRATION_BUBBLES.length];
    } else if (activeEvent?.kind === 'STAR_WARS_PARTY') {
      emp.speechBubble = STAR_WARS_BUBBLES[empIdx % STAR_WARS_BUBBLES.length];
    } else if (activeEvent?.kind === 'SUPERHERO_PARTY') {
      emp.speechBubble = SUPERHERO_BUBBLES[empIdx % SUPERHERO_BUBBLES.length];
    } else if (activeEvent?.kind === 'HALLOWEEN_PARTY') {
      emp.speechBubble = HALLOWEEN_BUBBLES[empIdx % HALLOWEEN_BUBBLES.length];
    }
  }
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Coordinate WAR_ROOM presentation: route active speakers & @mentioned teammates into WAR_ROOM,
 * designate exactly 1 Presenter (`isPresenter: true`, `activity: 'presenting'`), and set all
 * other WAR_ROOM employees as seated Attendees (`isPresenter: false`, `activity: 'meeting'`).
 */
export function applyWarRoomPresentation(
  employees: OfficeEmployee[],
  boardMessages: SwarmBoardMessage[],
  nowMs = Date.now(),
): void {
  const recentBoardMsgs = boardMessages.filter((msg) => {
    const msgMs = parseTimestampMs(msg.time);
    return msgMs > 0 && nowMs - msgMs <= 60_000;
  });

  const latestMsg = recentBoardMsgs.length > 0 ? recentBoardMsgs[recentBoardMsgs.length - 1] : null;

  if (recentBoardMsgs.length > 0) {
    const participantNames = new Set<string>();
    for (const msg of recentBoardMsgs) {
      if (msg.agent) participantNames.add(msg.agent.toLowerCase());
      const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
      let m: RegExpExecArray | null;
      while ((m = mentionRegex.exec(msg.text)) !== null) {
        participantNames.add(m[1].toLowerCase());
      }
    }

    for (const emp of employees) {
      if (emp.status !== 'working') continue;
      if (participantNames.has(emp.name.toLowerCase()) || participantNames.has('all')) {
        emp.zone = 'WAR_ROOM';
        emp.activity = 'meeting';
      }
    }
  }

  const warRoomEmployees = employees.filter((e) => e.zone === 'WAR_ROOM');
  if (warRoomEmployees.length === 0) return;

  const latestAuthor = latestMsg?.agent?.toLowerCase();
  const presenter =
    (latestAuthor && warRoomEmployees.find((e) => e.name.toLowerCase() === latestAuthor)) ||
    warRoomEmployees.find((e) => e.isCoordinator) ||
    warRoomEmployees[0];

  for (const emp of warRoomEmployees) {
    if (emp === presenter) {
      emp.isPresenter = true;
      emp.activity = 'presenting';
      emp.teleported = false;
      if (!emp.speechBubble) {
        const presenterSeed = hashSeed(String(latestMsg?.seq ?? Math.floor(nowMs / 15000)));
        emp.speechBubble = truncateBubble(
          latestMsg?.text ||
            (presenterSeed % 2 === 0
              ? '⚡ Ekibi beyaz tahtaya ışınladım!'
              : '📊 Mimari & ilerleme sunumu'),
        );
      }
    } else {
      emp.isPresenter = false;
      emp.activity = 'meeting';
      const inviteeSeed = hashSeed(`${emp.id}:${latestMsg?.seq ?? Math.floor(nowMs / 15000)}`);
      if (inviteeSeed % 2 === 0) {
        emp.teleported = true;
        if (!emp.speechBubble) {
          emp.speechBubble = '⚡ Beyaz tahtaya ışınlandım!';
        }
      } else {
        emp.teleported = false;
      }
    }
  }
}

function makeFloorId(workspacePath: string, isLobby: boolean): string {
  if (isLobby || !workspacePath) return 'lobby';
  const key = normalizeWorkspaceKey(workspacePath);
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
  const slug = workspacePath
    .split('/')
    .filter(Boolean)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
  return `${slug}-${hash}`;
}

function buildEmployeeFromRow(
  row: ConversationSummaryRow,
  scan: BrainScanResult,
  floorBoardMessages: SwarmBoardMessage[],
  nowMs: number,
  rootCoordinatorIdle = false,
): OfficeEmployee {
  const convId = row.conversation_id;
  const swarmMember = scan.swarmMemberByConvId.get(convId);
  const subagentMeta = scan.subagentMetaByConvId.get(convId);
  const transcript = scan.transcriptByConvId.get(convId);
  const hasPresenceLock = scan.presenceLocks.has(convId);

  const isCoordinator =
    Boolean(scan.swarmBoardsByRootConvId.has(convId)) ||
    swarmMember?.role === 'coordinator' ||
    (row.agent_name || '').toLowerCase().includes('coordinator');

  const name =
    swarmMember?.rosterName ||
    subagentMeta?.typeName ||
    row.agent_name?.trim() ||
    row.title?.trim() ||
    convId.slice(0, 8);

  const rawRole = swarmMember?.role === 'coordinator' ? 'Boss' : swarmMember?.role;
  const roleTitle =
    rawRole ||
    subagentMeta?.role ||
    (isCoordinator ? 'Boss' : 'Agent Worker');

  const modelId =
    swarmMember?.appliedModel ||
    swarmMember?.model ||
    (isCoordinator ? 'gemini-argon-orchestrator' : 'gemini-hydrogen');

  const modelFamily = classifyModelFamily(modelId);
  const status = determineEmployeeStatus({
    rowStatus: row.status,
    notFullyIdle: row.not_fully_idle,
    hasPresenceLock,
    swarmMember,
    subagentMeta,
    transcript,
    nowMs,
    rootCoordinatorIdle,
  });

  const { zone, activity, speechBubble } = determineZoneAndActivity({
    status,
    isCoordinator,
    roleTitle,
    agentName: name,
    transcript,
    recentBoardMessages: floorBoardMessages,
    nowMs,
  });

  const stepCount = Math.max(0, Number(row.step_count || 0));
  const { xp, level } = computeEmployeeXpAndLevel(stepCount);
  const toolActivity = classifyToolActivity({
    status,
    toolName: transcript?.latestToolName,
    targetSummary: transcript?.latestTargetSummary,
    lastStepStatus: transcript?.lastStepStatus,
  });
  const swarmRole = classifySwarmRole(swarmMember?.rosterName, swarmMember?.role, isCoordinator);

  const lastActiveAt = toIsoTimestamp(transcript?.lastTimestamp || row.last_modified_time);
  const recentSteps = transcript?.recentSteps ?? [];
  const stepErrorCount = recentSteps.filter((s) => s.status.toUpperCase() === 'ERROR').length;
  const errorCount = status === 'error' ? Math.max(1, stepErrorCount) : stepErrorCount;
  let consecutiveErrors = 0;
  for (let i = recentSteps.length - 1; i >= 0; i--) {
    if (recentSteps[i].status.toUpperCase() === 'ERROR') consecutiveErrors += 1;
    else break;
  }
  if (status === 'error' && consecutiveErrors === 0) consecutiveErrors = 1;
  const retryCount = Math.max(0, errorCount - consecutiveErrors);
  const totalSteps = Math.max(stepCount, recentSteps.length);
  const successRatePct =
    recentSteps.length > 0
      ? Math.round(((recentSteps.length - stepErrorCount) / recentSteps.length) * 100)
      : status === 'error'
        ? 0
        : 100;

  const agentBoardTexts = floorBoardMessages
    .filter((m) => m.agent.toLowerCase() === name.toLowerCase())
    .slice(-3)
    .reverse()
    .map((m) => m.text);
  const proof = extractVerificationProof([
    ...agentBoardTexts,
    speechBubble,
    transcript?.latestTargetSummary,
  ]);

  let hpScore = 100 - consecutiveErrors * 18 - Math.min(30, errorCount * 6);
  if (proof.isVerifiedOutput) hpScore += 5;
  hpScore = Math.max(0, Math.min(100, hpScore));

  let normalizedState: NormalizedAgentState = 'waiting';
  if (status === 'error') normalizedState = 'error';
  else if (status === 'working') normalizedState = 'active';
  else if (proof.isVerifiedOutput || activity === 'going_home') normalizedState = 'completed';

  let elapsedSec = stepCount * 8;
  if (recentSteps.length >= 2) {
    const firstMs = parseTimestampMs(recentSteps[0].timestamp);
    const lastMs = parseTimestampMs(recentSteps[recentSteps.length - 1].timestamp);
    if (firstMs > 0 && lastMs >= firstMs) {
      elapsedSec = Math.round((lastMs - firstMs) / 1000);
    }
  }

  const health: AgentHealthMetrics = {
    normalizedState,
    hpScore,
    successRatePct,
    totalSteps,
    errorCount,
    retryCount,
    consecutiveErrors,
    elapsedSec,
    isVerifiedOutput: proof.isVerifiedOutput,
    verifiedLabel: proof.verifiedLabel,
  };

  return {
    id: convId,
    name,
    roleTitle,
    isCoordinator,
    modelId,
    modelFamily,
    workspaceMode: swarmMember?.workspaceMode || 'inherit',
    status,
    toolActivity,
    swarmRole,
    zone,
    activity,
    speechBubble,
    currentTool: transcript?.latestToolName,
    currentTarget: transcript?.latestTargetSummary,
    xp,
    level,
    stepCount,
    inputTokens: transcript?.inputTokens || 0,
    cacheReadTokens: transcript?.cacheReadTokens || 0,
    outputTokens: transcript?.outputTokens || 0,
    lastActiveAt,
    health,
  };
}

/**
 * Build the complete PlazaSnapshot by reading SQLite summaries read-only,
 * scanning brain/swarm/transcript files, and applying gamification rules.
 */
export function buildPlazaSnapshot(
  agyDataDir: string,
  currentWorkspace: string,
  demoMode: boolean,
): PlazaSnapshot {
  const nowMs = Date.now();
  const rows = readConversationSummaries(agyDataDir);
  const convIds = rows.map((r) => r.conversation_id).filter(Boolean);
  const scan = scanBrainData(agyDataDir, convIds);
  const resolvedWorkspaces = resolveConversationWorkspaces(rows, scan.extraParentLinks, {
    agyDataDir,
    swarmConvIds: new Set(scan.swarmBoardsByRootConvId.keys()),
  });

  const rowMap = new Map<string, ConversationSummaryRow>();
  for (const row of rows) {
    if (row.conversation_id) rowMap.set(row.conversation_id, row);
  }

  // Group conversations by floor key
  interface FloorAccumulator {
    id: string;
    companyName: string;
    workspacePath: string;
    isLobby: boolean;
    rows: ConversationSummaryRow[];
    rootIds: Set<string>;
  }

  const floorGroups = new Map<string, FloorAccumulator>();

  for (const row of rows) {
    const resolved: ResolvedWorkspaceInfo = resolvedWorkspaces.get(row.conversation_id) || {
      workspacePath: '',
      companyName: 'Global Freelance Lobby',
      isLobby: true,
      rootConversationId: row.conversation_id,
    };

    const floorKey = resolved.isLobby
      ? 'lobby'
      : normalizeWorkspaceKey(resolved.workspacePath);

    let group = floorGroups.get(floorKey);
    if (!group) {
      group = {
        id: makeFloorId(resolved.workspacePath, resolved.isLobby),
        companyName: resolved.companyName,
        workspacePath: resolved.workspacePath,
        isLobby: resolved.isLobby,
        rows: [],
        rootIds: new Set<string>(),
      };
      floorGroups.set(floorKey, group);
    }

    group.rows.push(row);
    group.rootIds.add(resolved.rootConversationId);
  }

  const currentWorkspaceKey = normalizeWorkspaceKey(currentWorkspace);
  let activeProjectFloorId: string | null = null;

  const builtFloors: PlazaFloor[] = [];
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const [floorKey, group] of floorGroups.entries()) {
    if (!group.isLobby && currentWorkspaceKey && floorKey === currentWorkspaceKey) {
      activeProjectFloorId = group.id;
    }

    // Aggregate swarm board messages & title across ALL conversations on this floor
    let swarmTitle: string | undefined;
    const boardMessages: SwarmBoardMessage[] = [];
    const seenBoardKeys = new Set<string>();
    for (const row of group.rows) {
      const boardInfo = scan.swarmBoardsByRootConvId.get(row.conversation_id);
      if (boardInfo) {
        if (boardInfo.title && !swarmTitle) swarmTitle = boardInfo.title;
        for (const msg of boardInfo.messages) {
          const dedupKey = `${msg.agent}|${msg.time}|${msg.text}`;
          if (!seenBoardKeys.has(dedupKey)) {
            seenBoardKeys.add(dedupKey);
            boardMessages.push(msg);
          }
        }
      }
    }
    boardMessages.sort((a, b) => {
      const ta = parseTimestampMs(a.time);
      const tb = parseTimestampMs(b.time);
      if (ta && tb && ta !== tb) return ta - tb;
      return a.seq - b.seq;
    });
    const trimmedBoard = boardMessages.slice(-40);

    // Build candidate employees
    const candidatePairs = group.rows.map((row) => {
      const rootId = resolvedWorkspaces.get(row.conversation_id)?.rootConversationId;
      const rootRow = rootId ? rowMap.get(rootId) : undefined;
      const rootModifiedMs = rootRow ? parseTimestampMs(rootRow.last_modified_time) : 0;
      const rootCoordinatorIdle =
        Boolean(rootRow) &&
        rootRow!.conversation_id !== row.conversation_id &&
        rootRow!.status === 'CASCADE_RUN_STATUS_IDLE' &&
        rootRow!.not_fully_idle === 0 &&
        rootModifiedMs > 0 &&
        nowMs - rootModifiedMs > 60_000;

      return {
        row,
        employee: buildEmployeeFromRow(row, scan, trimmedBoard, nowMs, rootCoordinatorIdle),
        modifiedMs: parseTimestampMs(row.last_modified_time),
        killed:
          row.killed === 1 || scan.swarmMemberByConvId.get(row.conversation_id)?.killed === true,
      };
    });

    // Roster filter with Go-Home lifecycle (no 24h/5-agent inactive backfill):
    // - working agents always stay
    // - killed non-working agents are excluded
    // - non-working agents inactive 8m..9.5m walk to ELEVATOR ('going_home')
    // - non-working agents inactive >= 9.5m leave office & increment offDutyCount
    const nonKilledOrWorking = candidatePairs.filter(
      (c) => !c.killed || c.employee.status === 'working',
    );
    const { employees: lifecycleEmployees, offDutyCount } = applyGoHomeLifecycle(
      nonKilledOrWorking.map((c) => c.employee),
      nowMs,
    );

    const modifiedById = new Map(
      nonKilledOrWorking.map((c) => [c.row.conversation_id, c.modifiedMs]),
    );

    const employees = lifecycleEmployees
      .sort((a, b) => {
        const rank = (s: OfficeEmployee['status']) =>
          s === 'working' ? 0 : s === 'waiting' ? 1 : s === 'error' ? 2 : 3;
        const diff = rank(a.status) - rank(b.status);
        if (diff !== 0) return diff;
        return (modifiedById.get(b.id) || 0) - (modifiedById.get(a.id) || 0);
      })
      .slice(0, 14);

    const totalProjectSteps = group.rows.reduce(
      (sum, r) => sum + Math.max(0, Number(r.step_count || 0)),
      0,
    );
    const companyXp = totalProjectSteps * 20;
    const { tier, nextTierXp, unlockedProps } = computeCompanyTier(companyXp);
    const ecoScore = computeEcoScore(employees);

    const activeCount = employees.filter((e) => e.status === 'working').length;
    const waitingCount = employees.filter((e) => e.status === 'waiting').length;

    const latestModifiedMs = group.rows.reduce(
      (max, r) => Math.max(max, parseTimestampMs(r.last_modified_time)),
      0,
    );

    const stepEventsByAgent = new Map<string, Array<{ timestamp: string; status: string }>>();
    for (const r of group.rows) {
      const steps = scan.transcriptByConvId.get(r.conversation_id)?.recentSteps;
      if (steps && steps.length > 0) {
        stepEventsByAgent.set(r.conversation_id, steps);
      }
    }

    const swarmEdges = buildSwarmMentionEdges(
      trimmedBoard,
      employees.map((e) => e.name),
    );
    const taskNodes = buildFloorTaskNodes(employees, trimmedBoard, swarmEdges);
    const analytics = computeFloorAnalytics({
      employees,
      stepEventsByAgent,
      nowMs,
    });

    builtFloors.push({
      id: group.id,
      floorNumber: group.isLobby ? 0 : 1,
      companyName: group.companyName,
      workspacePath: group.workspacePath,
      tier,
      companyXp,
      nextTierXp,
      ecoScore,
      activeCount,
      waitingCount,
      offDutyCount,
      totalConversations: group.rows.length,
      unlockedProps,
      employees,
      boardMessages: trimmedBoard,
      swarmEdges,
      swarmTitle,
      taskNodes,
      analytics,
      lastModifiedAt:
        latestModifiedMs > 0 ? new Date(latestModifiedMs).toISOString() : new Date().toISOString(),
    });
  }

  // Assign deterministic floor numbers: Lobby = 0, Projects = 1..N (active project first, then by recent/XP)
  const lobbyFloor = builtFloors.find((f) => f.id === 'lobby');
  const projectFloors = builtFloors
    .filter((f) => f.id !== 'lobby')
    .sort((a, b) => {
      if (a.id === activeProjectFloorId) return -1;
      if (b.id === activeProjectFloorId) return 1;
      return b.companyXp - a.companyXp;
    });

  projectFloors.forEach((floor, idx) => {
    floor.floorNumber = idx + 1;
  });

  const floors: PlazaFloor[] = [];
  if (lobbyFloor) floors.push(lobbyFloor);
  floors.push(...projectFloors);

  for (const floor of floors) {
    floor.layoutSeed = getFloorLayoutSeed(floor.id);
    floor.activeEvent = getActiveFloorEvent(floor.id, nowMs);
    applyWarRoomPresentation(floor.employees, floor.boardMessages, nowMs);
    applyLoungeActivities(floor.employees, floor.floorNumber, nowMs, floor.activeEvent);
  }

  if (demoMode) {
    floors.push(getDemoFloor('throttled', nowMs));
  }

  const totalActiveAgents = floors.reduce((sum, f) => sum + f.activeCount, 0);
  const globalEcoScore =
    floors.length > 0
      ? Math.round(floors.reduce((sum, f) => sum + f.ecoScore, 0) / floors.length)
      : 100;
  const { timeline60m, modelBreakdown } = aggregatePlazaAnalytics(floors, nowMs);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    demoMode,
    activeProjectFloorId,
    totalActiveAgents,
    globalEcoScore,
    floors,
    timeline60m,
    modelBreakdown,
  };
}
