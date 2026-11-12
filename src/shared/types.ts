export type ModelFamily = 'argon' | 'hydrogen' | 'flash' | 'carbon' | 'other';
export type OfficeZone = 'DESK_ARCHITECT' | 'DESK_CODING' | 'DESK_QA' | 'WAR_ROOM' | 'SERVER_RACK' | 'COFFEE_LOUNGE';
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
  | 'lounging'
  | 'gaming'
  | 'error';
export type CompanyTier = 1 | 2 | 3 | 4;

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
  totalConversations: number;
  unlockedProps: string[];
  employees: OfficeEmployee[];
  boardMessages: SwarmBoardMessage[];
  swarmTitle?: string;
  lastModifiedAt: string;
}

export interface PlazaSnapshot {
  generatedAt: string;
  demoMode: boolean;
  activeProjectFloorId: string | null;
  totalActiveAgents: number;
  globalEcoScore: number;
  floors: PlazaFloor[];
}

export interface AgentDetailResponse {
  employee: OfficeEmployee;
  recentLogs: AgentLogEntry[];
}
