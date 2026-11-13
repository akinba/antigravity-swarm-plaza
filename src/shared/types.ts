export type ModelFamily = 'argon' | 'hydrogen' | 'flash' | 'carbon' | 'pro' | 'claude' | 'gpt' | 'other';
export type OfficeZone = 'DESK_ARCHITECT' | 'DESK_CODING' | 'DESK_QA' | 'WAR_ROOM' | 'SERVER_RACK' | 'COFFEE_LOUNGE' | 'ELEVATOR';
export type AgentActivityKind =
  | 'coding'
  | 'reading'
  | 'searching'
  | 'terminal'
  | 'meeting'
  | 'presenting'
  | 'thinking'
  | 'sleeping'
  | 'coffee'
  | 'watercooler'
  | 'pizza'
  | 'lounging'
  | 'gaming'
  | 'going_home'
  | 'error';
export type CompanyTier = 1 | 2 | 3 | 4;

export type ToolActivityStatus = 'reading' | 'writing' | 'testing' | 'searching' | 'error' | 'idle';
export type SwarmRole = 'coordinator' | 'worker' | 'monitor' | 'narrator' | 'verifier' | 'other';

export type FloorEventKind =
  | 'PIZZA_PARTY'
  | 'WATERCOOLER_GOSSIP'
  | 'SPRINT_CELEBRATION'
  | 'MASCOT_ZOOMIES'
  | 'COFFEE_BREW';

export interface FloorRandomEvent {
  id: string;
  kind: FloorEventKind;
  startedAt: number;
  expiresAt: number;
}

export interface AgentLogEntry {
  stepIndex: number;
  timestamp: string;
  type: string;
  status: string;
  toolName?: string;
  targetSummary?: string;
  thoughtSnippet?: string;
}

export interface SwarmBoardMessage {
  seq: number;
  agent: string;
  text: string;
  time: string;
  kind: string;
  mentions?: string[];
}

export interface SwarmMentionEdge {
  from: string;
  to: string;
  count: number;
  lastSeq: number;
  lastTime: string;
}

export interface ActivityTimelineBucket {
  bucketStart: string;
  label: string;
  activeCount: number;
  completedTasks: number;
  errorCount: number;
}

export interface ModelBreakdownEntry {
  modelFamily: ModelFamily;
  modelId: string;
  agentCount: number;
  activeCount: number;
  totalTokens: number;
}

export interface FloorAnalytics {
  timeline60m: ActivityTimelineBucket[];
  completedTasks60m: number;
  peakActive60m: number;
  modelBreakdown: ModelBreakdownEntry[];
}

export interface OfficeEmployee {
  id: string;
  name: string;
  roleTitle: string;
  isCoordinator: boolean;
  modelId: string;
  modelFamily: ModelFamily;
  workspaceMode: string;
  status: 'working' | 'waiting' | 'idle' | 'error';
  toolActivity?: ToolActivityStatus;
  swarmRole?: SwarmRole;
  zone: OfficeZone;
  activity: AgentActivityKind;
  speechBubble?: string;
  currentTool?: string;
  currentTarget?: string;
  partnerId?: string;
  partnerName?: string;
  playerSlot?: 1 | 2;
  isPresenter?: boolean;
  xp: number;
  level: number;
  stepCount: number;
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  lastActiveAt: string;
}

export interface PlazaFloor {
  id: string;
  floorNumber: number;
  companyName: string;
  workspacePath: string;
  isDemo?: boolean;
  tier: CompanyTier;
  companyXp: number;
  nextTierXp: number;
  ecoScore: number;
  activeCount: number;
  waitingCount: number;
  offDutyCount?: number;
  totalConversations: number;
  unlockedProps: string[];
  employees: OfficeEmployee[];
  boardMessages: SwarmBoardMessage[];
  swarmEdges?: SwarmMentionEdge[];
  swarmTitle?: string;
  layoutSeed?: number;
  activeEvent?: FloorRandomEvent | null;
  analytics?: FloorAnalytics;
  lastModifiedAt: string;
}

export type AgentInfo = OfficeEmployee;
export type FloorInfo = PlazaFloor;

export interface PlazaSnapshot {
  generatedAt: string;
  demoMode: boolean;
  activeProjectFloorId: string | null;
  totalActiveAgents: number;
  globalEcoScore: number;
  floors: PlazaFloor[];
  timeline60m?: ActivityTimelineBucket[];
  modelBreakdown?: ModelBreakdownEntry[];
}

export interface AgentDetailResponse {
  employee: OfficeEmployee;
  recentLogs: AgentLogEntry[];
}
