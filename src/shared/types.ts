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
export type EmployeeGender = 'female' | 'male';

export type FloorEventKind =
  | 'STAR_WARS_PARTY'
  | 'SUPERHERO_PARTY'
  | 'HALLOWEEN_PARTY'
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

export type NormalizedAgentState = 'active' | 'waiting' | 'completed' | 'error';

export interface AgentHealthMetrics {
  normalizedState: NormalizedAgentState;
  hpScore: number;            // 0..100
  successRatePct: number;     // 0..100
  totalSteps: number;
  errorCount: number;
  retryCount: number;
  consecutiveErrors: number;
  elapsedSec: number;
  isVerifiedOutput: boolean;
  verifiedLabel?: string;     // e.g. 'PASS', 'DONE', 'EXIT 0'
}

export type SwarmTaskStatus = 'pending' | 'running' | 'blocked' | 'verified' | 'completed';

export interface SwarmTaskNode {
  id: string;
  title: string;
  ownerAgentId?: string;
  ownerName: string;
  ownerRole?: string;
  parentTaskId?: string;
  dependsOnTaskIds: string[];
  handoffTargetNames: string[];
  status: SwarmTaskStatus;
  verifiedKeyword?: string;
  evidenceBadges: string[];
  updatedAt: string;
  durationSec?: number;
}

export interface AgentResourceUsage {
  agentId: string;
  agentName: string;
  modelName: string;
  modelFamily: ModelFamily;
  estimatedTokens: number;
  estimatedCostUsd: number;
  completedTasks: number;
  isEstimated: true;
}

export interface FloorAnalytics {
  timeline60m: ActivityTimelineBucket[];
  completedTasks60m: number;
  peakActive60m: number;
  modelBreakdown: ModelBreakdownEntry[];
  agentResources?: AgentResourceUsage[];
  totalEstimatedTokens?: number;
  totalEstimatedCostUsd?: number;
}

export interface OfficeEmployee {
  id: string;
  name: string;
  roleTitle: string;
  gender?: EmployeeGender;
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
  teleported?: boolean;
  xp: number;
  level: number;
  stepCount: number;
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  lastActiveAt: string;
  health?: AgentHealthMetrics;
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
  taskNodes?: SwarmTaskNode[];
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

export type ResolutionScaleMode = 'low' | 'medium' | 'high' | 'native';
export type AntiAliasingMode = 'crisp' | 'smooth';
export type FpsLimitMode = 'eco' | '30' | '60' | 'unlimited';
export type GraphicsPreset = 'classic60' | 'balanced' | 'eco' | 'ultra' | 'custom';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  resolution: ResolutionScaleMode;
  antiAliasing: AntiAliasingMode;
  fpsLimit: FpsLimitMode;
  staticCache: boolean;
}

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  preset: 'classic60',
  resolution: 'high',
  antiAliasing: 'crisp',
  fpsLimit: '60',
  staticCache: true,
};
