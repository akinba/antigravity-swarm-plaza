import crypto from 'node:crypto';
import type {
  AgentActivityKind,
  CompanyTier,
  ModelFamily,
  OfficeEmployee,
  OfficeZone,
  PlazaFloor,
  PlazaSnapshot,
  SwarmBoardMessage,
} from '../shared/types.js';
import {
  scanBrainData,
  type BrainScanResult,
  type SubagentMeta,
  type SwarmMemberMeta,
  type TranscriptSummary,
} from './brainScanner.js';
import { normalizeWorkspaceKey } from './config.js';
import {
  readConversationSummaries,
  resolveConversationWorkspaces,
  type ConversationSummaryRow,
  type ResolvedWorkspaceInfo,
} from './dbReader.js';
import { getDemoFloor } from './demoSimulator.js';

export function classifyModelFamily(modelId: string | undefined | null): ModelFamily {
  const lower = (modelId || '').toLowerCase();
  if (lower.includes('argon') || lower.includes('orchestrator')) return 'argon';
  if (lower.includes('hydrogen')) return 'hydrogen';
  if (lower.includes('flash')) return 'flash';
  if (lower.includes('carbon')) return 'carbon';
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
    else if (emp.modelFamily === 'carbon') score += 8;
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
}): OfficeEmployee['status'] {
  const { rowStatus, notFullyIdle, hasPresenceLock, swarmMember, subagentMeta, transcript } =
    params;

  const isRunning =
    rowStatus === 'CASCADE_RUN_STATUS_RUNNING' || notFullyIdle === 1;

  const isSwarmWaiting =
    swarmMember !== undefined &&
    typeof swarmMember.waitSince === 'number' &&
    !isRunning;

  const subState = (subagentMeta?.state || '').toUpperCase();
  const isSubagentWaiting =
    subagentMeta !== undefined &&
    !isRunning &&
    (subState.includes('WAIT') || subState.includes('PARKED'));

  if (isRunning || (hasPresenceLock && !isSwarmWaiting && !isSubagentWaiting)) {
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

  // Check recent swarm board activity within last 45s
  const lowerName = agentName.toLowerCase();
  const recentBoardMatch = [...recentBoardMessages]
    .reverse()
    .find((msg) => {
      const msgMs = parseTimestampMs(msg.time);
      if (msgMs <= 0 || nowMs - msgMs > 45000) return false;
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

/**
 * Post-process COFFEE_LOUNGE employees on a floor to assign paired 2-player console gaming
 * and relaxed sofa/armchair lounging vs coffee breaks in smooth deterministic time buckets.
 */
export function applyLoungeActivities(
  employees: OfficeEmployee[],
  floorIndex: number,
  nowMs = Date.now(),
): void {
  const loungeEmployees = employees.filter((e) => e.zone === 'COFFEE_LOUNGE');
  if (loungeEmployees.length === 0) return;

  const bucket = Math.floor(nowMs / 18000);
  const chatIdx = Math.floor(nowMs / 6000) % GAMING_CHATS.length;
  const pairedIds = new Set<string>();

  if (
    loungeEmployees.length >= 2 &&
    (loungeEmployees.length >= 3 || (bucket + floorIndex) % 3 !== 0)
  ) {
    const idx1 = bucket % loungeEmployees.length;
    const idx2 = (idx1 + 1) % loungeEmployees.length;
    const p1 = loungeEmployees[idx1];
    const p2 = loungeEmployees[idx2];

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

    pairedIds.add(p1.id);
    pairedIds.add(p2.id);
  }

  for (let empIdx = 0; empIdx < loungeEmployees.length; empIdx++) {
    const emp = loungeEmployees[empIdx];
    if (pairedIds.has(emp.id)) continue;

    emp.partnerId = undefined;
    emp.partnerName = undefined;
    emp.playerSlot = undefined;

    if ((empIdx + bucket) % 4 !== 0) {
      emp.activity = 'lounging';
      if (emp.status === 'waiting') {
        emp.speechBubble =
          (empIdx + bucket) % 2 === 0
            ? '🛋️ Koltukta dinleniyor (0 token)'
            : '😌 Zzz (0 token)';
      } else {
        emp.speechBubble = '🛋️ Kanepede mola keyfi';
      }
    } else {
      emp.activity = 'coffee';
      emp.speechBubble = '☕ Kahve & dinlenme';
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

  const roleTitle =
    swarmMember?.role ||
    subagentMeta?.role ||
    (isCoordinator ? 'Swarm Coordinator' : 'Agent Worker');

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

  return {
    id: convId,
    name,
    roleTitle,
    isCoordinator,
    modelId,
    modelFamily,
    workspaceMode: swarmMember?.workspaceMode || 'inherit',
    status,
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
    lastActiveAt: toIsoTimestamp(transcript?.lastTimestamp || row.last_modified_time),
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
  const resolvedWorkspaces = resolveConversationWorkspaces(rows, scan.extraParentLinks);

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

    // Aggregate swarm board messages & title from any root/member conversation on this floor
    let swarmTitle: string | undefined;
    const boardMessages: SwarmBoardMessage[] = [];
    for (const row of group.rows) {
      const boardInfo = scan.swarmBoardsByRootConvId.get(row.conversation_id);
      if (boardInfo) {
        if (boardInfo.title && !swarmTitle) swarmTitle = boardInfo.title;
        boardMessages.push(...boardInfo.messages);
      }
    }
    boardMessages.sort((a, b) => a.seq - b.seq);
    const trimmedBoard = boardMessages.slice(-40);

    // Build candidate employees
    const candidatePairs = group.rows.map((row) => ({
      row,
      employee: buildEmployeeFromRow(row, scan, trimmedBoard, nowMs),
      modifiedMs: parseTimestampMs(row.last_modified_time),
      killed: row.killed === 1 || scan.swarmMemberByConvId.get(row.conversation_id)?.killed === true,
    }));

    // Roster filter:
    // Keep all 'working' and 'waiting' + recent non-killed in last 24h;
    // if < 3, backfill up to 5 most recent non-killed; cap at 14.
    const activeOrWaiting = candidatePairs.filter(
      (c) => c.employee.status === 'working' || c.employee.status === 'waiting',
    );
    const recentNonKilled = candidatePairs
      .filter(
        (c) =>
          !c.killed &&
          c.employee.status !== 'working' &&
          c.employee.status !== 'waiting' &&
          nowMs - c.modifiedMs <= DAY_MS,
      )
      .sort((a, b) => b.modifiedMs - a.modifiedMs);

    const selected = [...activeOrWaiting, ...recentNonKilled];

    if (selected.length < 3) {
      const selectedIds = new Set(selected.map((s) => s.row.conversation_id));
      const backfill = candidatePairs
        .filter((c) => !c.killed && !selectedIds.has(c.row.conversation_id))
        .sort((a, b) => b.modifiedMs - a.modifiedMs)
        .slice(0, Math.max(0, 5 - selected.length));
      selected.push(...backfill);
    }

    const employees = selected
      .sort((a, b) => {
        const rank = (s: OfficeEmployee['status']) =>
          s === 'working' ? 0 : s === 'waiting' ? 1 : s === 'error' ? 2 : 3;
        const diff = rank(a.employee.status) - rank(b.employee.status);
        return diff !== 0 ? diff : b.modifiedMs - a.modifiedMs;
      })
      .slice(0, 14)
      .map((s) => s.employee);

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
      totalConversations: group.rows.length,
      unlockedProps,
      employees,
      boardMessages: trimmedBoard,
      swarmTitle,
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
    applyLoungeActivities(floor.employees, floor.floorNumber, nowMs);
  }

  if (demoMode) {
    floors.push(getDemoFloor(true));
  }

  const totalActiveAgents = floors.reduce((sum, f) => sum + f.activeCount, 0);
  const globalEcoScore =
    floors.length > 0
      ? Math.round(floors.reduce((sum, f) => sum + f.ecoScore, 0) / floors.length)
      : 100;

  return {
    generatedAt: new Date(nowMs).toISOString(),
    demoMode,
    activeProjectFloorId,
    totalActiveAgents,
    globalEcoScore,
    floors,
  };
}
