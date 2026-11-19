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
  | 'arcade'
  | 'vending'
  | 'card_game'
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
  | 'COFFEE_BREW'
  | 'CARD_GAME';

export interface FloorRandomEvent {
  id: string;
  kind: FloorEventKind;
  startedAt: number;
  expiresAt: number;
  targetZone?: 'WAR_ROOM' | 'COFFEE_LOUNGE';
  participantIds?: string[];
}

export interface ScheduledOfficeEvent {
  id: string;
  kind: FloorEventKind;
  scheduledFor: number;
  createdAt: number;
  proposedById?: string;
  proposedByName: string;
  participantNames?: string[];
  announcementText?: string;
}

export type SocialReactionKind = 'cheering' | 'coffee_gift' | 'coffee_thanks';

export interface FloorCelebration {
  id: string;
  heroAgentId: string;
  heroName: string;
  verifiedLabel?: string;
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
  leftAt?: string;
  visitTargetId?: string;
  standingGuest?: boolean;
  socialReaction?: SocialReactionKind;
  contextUsedTokens?: number;
  contextLimitTokens?: number;
  lastError?: AgentLastError;
}

export interface AgentLastError {
  id: string;
  stepIndex: number;
  timestamp: string;
  message: string;
  toolName?: string;
  target?: string;
  resolved: boolean;
}

export type QuotaPoolId = 'gemini' | 'claude_gpt';

export interface QuotaPoolStatus {
  pool: QuotaPoolId;
  label: string;
  remainingPct: number | null;
  resetsAt?: string;
  observedAt?: string;
  sourceModel?: string;
  isLowWarning?: boolean;
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
  scheduledEvents?: ScheduledOfficeEvent[];
  recentlyLeftEmployees?: OfficeEmployee[];
  activeCelebration?: FloorCelebration | null;
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
  quotaPools?: QuotaPoolStatus[];
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

export type PromptModelId =
  | 'gemini-4-carbon-medium'
  | 'gemini-4-argon-medium'
  | 'gemini-4-hydrogen-medium'
  | 'gemini-3.8-flash-fast'
  | 'qwen2.5-coder:14b'
  | `ollama:${string}`
  | (string & {});

export type ExecutionMode = 'turbo' | 'safe' | 'eco-swarm';

export type CloudProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'copilot';
export type LocalProviderId = 'ollama' | 'lmstudio';
export type PromptProvider = CloudProviderId | LocalProviderId;

export interface LocalAgentConfig {
  id: string;
  name: string;
  mention: string;
  provider: LocalProviderId;
  model: string;
  baseUrl: string;
  enabled: boolean;
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
  modifiedAt?: string;
}

export interface GeminiModelInfo {
  id: string;
  displayName: string;
  description?: string;
}

export interface ProviderModelInfo {
  id: string;
  displayName: string;
  provider: PromptProvider;
  description?: string;
}

export type ThinkingLevel = 'low' | 'medium' | 'high';

export interface SwarmRoleAssignment {
  role: string;
  model: string;
  level: ThinkingLevel;
}

export interface PromptRequest {
  prompt: string;
  model: PromptModelId;
  mode: ExecutionMode;
  orchestration?: 'single' | 'swarm';
  swarmProfile?: SwarmRoleAssignment[];
  mentions: string[];
  provider?: PromptProvider;
  localBaseUrl?: string;
  localBaseUrls?: Record<string, string>;
  ollamaBaseUrl?: string;
  workspace?: string;
  attachments?: string[];
  floorId?: string;
}

export interface DiffFileChange {
  path: string;
  added: number;
  removed: number;
  status: 'pending' | 'accepted' | 'rejected';
  preview?: string;
}

export interface PromptStreamEvent {
  runId: string;
  type: 'status' | 'chunk' | 'file' | 'diff' | 'done' | 'error';
  agentId?: string;
  text?: string;
  file?: string;
  diffs?: DiffFileChange[];
  status?: 'running' | 'idle' | 'stopped' | 'error';
  timestamp: number;
}
