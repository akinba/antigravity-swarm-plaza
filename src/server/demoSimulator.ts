import type {
  AgentActivityKind,
  AgentLogEntry,
  OfficeEmployee,
  OfficeZone,
  PlazaFloor,
  SwarmBoardMessage,
} from '../shared/types.js';

interface DemoEmployeeTemplate {
  id: string;
  name: string;
  roleTitle: string;
  isCoordinator: boolean;
  modelId: string;
  modelFamily: OfficeEmployee['modelFamily'];
  workspaceMode: string;
  baseDesk: OfficeZone;
}

const DEMO_ROSTER: DemoEmployeeTemplate[] = [
  {
    id: 'demo-chief-architect',
    name: 'Chief-Architect',
    roleTitle: 'Swarm Coordinator',
    isCoordinator: true,
    modelId: 'gemini-argon-orchestrator',
    modelFamily: 'argon',
    workspaceMode: 'inherit',
    baseDesk: 'DESK_ARCHITECT',
  },
  {
    id: 'demo-coder-core',
    name: 'coder-core',
    roleTitle: 'Backend Engineer',
    isCoordinator: false,
    modelId: 'gemini-hydrogen-pro',
    modelFamily: 'hydrogen',
    workspaceMode: 'share',
    baseDesk: 'DESK_CODING',
  },
  {
    id: 'demo-coder-ui',
    name: 'coder-ui',
    roleTitle: 'Frontend Architect',
    isCoordinator: false,
    modelId: 'gemini-hydrogen-pro',
    modelFamily: 'hydrogen',
    workspaceMode: 'share',
    baseDesk: 'DESK_CODING',
  },
  {
    id: 'demo-analyst-grill',
    name: 'analyst-grill',
    roleTitle: 'Spec & Risk Analyst',
    isCoordinator: false,
    modelId: 'gemini-flash-2.5',
    modelFamily: 'flash',
    workspaceMode: 'inherit',
    baseDesk: 'DESK_QA',
  },
  {
    id: 'demo-verifier-qa',
    name: 'verifier-qa',
    roleTitle: 'QA & Integration',
    isCoordinator: false,
    modelId: 'gemini-flash-2.5',
    modelFamily: 'flash',
    workspaceMode: 'inherit',
    baseDesk: 'DESK_QA',
  },
];

interface PhaseStep {
  zone: OfficeZone;
  activity: AgentActivityKind;
  status: OfficeEmployee['status'];
  speechBubble?: string;
  currentTool?: string;
  currentTarget?: string;
}

const DEMO_CYCLES: Record<string, PhaseStep[]> = {
  'demo-chief-architect': [
    {
      zone: 'WAR_ROOM',
      activity: 'meeting',
      status: 'working',
      speechBubble: '@coder-core API kontratı hazır!',
      currentTool: 'post_message',
      currentTarget: 'board.jsonl',
    },
    {
      zone: 'DESK_ARCHITECT',
      activity: 'thinking',
      status: 'working',
      speechBubble: 'Mimari plan güncelleniyor...',
      currentTool: 'swarm',
      currentTarget: 'status',
    },
    {
      zone: 'COFFEE_LOUNGE',
      activity: 'lounging',
      status: 'waiting',
      speechBubble: '🛋️ Koltukta dinleniyor (0 token)',
    },
    {
      zone: 'WAR_ROOM',
      activity: 'meeting',
      status: 'working',
      speechBubble: '@verifier-qa E2E testi başlat',
      currentTool: 'post_message',
      currentTarget: 'board.jsonl',
    },
  ],
  'demo-coder-core': [
    {
      zone: 'DESK_CODING',
      activity: 'coding',
      status: 'working',
      speechBubble: 'SQLite read-only katmanı yazılıyor',
      currentTool: 'edit_file',
      currentTarget: 'dbReader.ts',
    },
    {
      zone: 'SERVER_RACK',
      activity: 'terminal',
      status: 'working',
      speechBubble: 'npm.cmd test çalıştırılıyor',
      currentTool: 'run_command',
      currentTarget: 'npm.cmd test',
    },
    {
      zone: 'WAR_ROOM',
      activity: 'meeting',
      status: 'working',
      speechBubble: '@Chief-Architect WS yayını aktif',
      currentTool: 'post_message',
      currentTarget: 'board.jsonl',
    },
    {
      zone: 'COFFEE_LOUNGE',
      activity: 'coffee',
      status: 'idle',
      speechBubble: 'Kısa kahve molası',
    },
  ],
  'demo-coder-ui': [
    {
      zone: 'DESK_CODING',
      activity: 'coding',
      status: 'working',
      speechBubble: 'İzometrik ofis sahnesi çiziliyor',
      currentTool: 'write_file',
      currentTarget: 'PlazaCanvas.tsx',
    },
    {
      zone: 'DESK_CODING',
      activity: 'reading',
      status: 'working',
      speechBubble: 'Shared tipler kontrol ediliyor',
      currentTool: 'read_file',
      currentTarget: 'types.ts',
    },
    {
      zone: 'COFFEE_LOUNGE',
      activity: 'lounging',
      status: 'waiting',
      speechBubble: '🛋️ Koltukta dinleniyor (0 token)',
    },
    {
      zone: 'WAR_ROOM',
      activity: 'meeting',
      status: 'working',
      speechBubble: '@coder-core /ws bağlandı!',
      currentTool: 'post_message',
      currentTarget: 'board.jsonl',
    },
  ],
  'demo-analyst-grill': [
    {
      zone: 'DESK_QA',
      activity: 'searching',
      status: 'working',
      speechBubble: 'Edge-case senaryoları taranıyor',
      currentTool: 'search_web',
      currentTarget: 'node:sqlite uri',
    },
    {
      zone: 'WAR_ROOM',
      activity: 'meeting',
      status: 'working',
      speechBubble: '@coder-core cycle guard ekle!',
      currentTool: 'post_message',
      currentTarget: 'board.jsonl',
    },
    {
      zone: 'DESK_QA',
      activity: 'reading',
      status: 'working',
      speechBubble: 'EcoScore formülü doğrulanıyor',
      currentTool: 'read_file',
      currentTarget: 'gamification.ts',
    },
    {
      zone: 'COFFEE_LOUNGE',
      activity: 'lounging',
      status: 'waiting',
      speechBubble: '🛋️ Koltukta dinleniyor (0 token)',
    },
  ],
  'demo-verifier-qa': [
    {
      zone: 'COFFEE_LOUNGE',
      activity: 'lounging',
      status: 'waiting',
      speechBubble: '🛋️ Koltukta dinleniyor (0 token)',
    },
    {
      zone: 'DESK_QA',
      activity: 'reading',
      status: 'working',
      speechBubble: 'Test kapsamı inceleniyor',
      currentTool: 'read_file',
      currentTarget: 'core.test.ts',
    },
    {
      zone: 'SERVER_RACK',
      activity: 'terminal',
      status: 'working',
      speechBubble: 'tsc --noEmit & test: PASS',
      currentTool: 'run_command',
      currentTarget: 'npx.cmd tsc --noEmit',
    },
    {
      zone: 'WAR_ROOM',
      activity: 'meeting',
      status: 'working',
      speechBubble: '@Chief-Architect Tüm testler yeşil',
      currentTool: 'post_message',
      currentTarget: 'board.jsonl',
    },
  ],
};

let demoTick = 0;

export function getDemoTick(): number {
  return demoTick;
}

export function resetDemoTick(): void {
  demoTick = 0;
}

export function advanceDemoTick(): number {
  demoTick += 1;
  return demoTick;
}

/**
 * Generate the stateful Demo Penthouse floor, advancing simulation state on each call.
 */
export function getDemoFloor(advance = true): PlazaFloor {
  if (advance) {
    demoTick += 1;
  }

  const now = new Date().toISOString();
  const employees: OfficeEmployee[] = DEMO_ROSTER.map((tmpl, idx) => {
    const cycle = DEMO_CYCLES[tmpl.id];
    const phase = cycle[(demoTick + idx) % cycle.length];
    const stepCount = 35 + demoTick * 2 + idx * 9;
    const xp = stepCount * 15;
    const level = Math.max(1, Math.floor(Math.sqrt(xp / 45)) + 1);

    return {
      id: tmpl.id,
      name: tmpl.name,
      roleTitle: tmpl.roleTitle,
      isCoordinator: tmpl.isCoordinator,
      modelId: tmpl.modelId,
      modelFamily: tmpl.modelFamily,
      workspaceMode: tmpl.workspaceMode,
      status: phase.status,
      zone: phase.zone,
      activity: phase.activity,
      speechBubble: phase.speechBubble,
      currentTool: phase.currentTool,
      currentTarget: phase.currentTarget,
      xp,
      level,
      stepCount,
      inputTokens: 14000 + demoTick * 420 + idx * 1200,
      cacheReadTokens: 9800 + demoTick * 310 + idx * 800,
      outputTokens: 2100 + demoTick * 95 + idx * 300,
      lastActiveAt: now,
    };
  });

    // Pair 2 employees for a 2-player console match regularly (ticks where demoTick % 3 !== 0)
    if (demoTick % 3 !== 0) {
      const pairIndices = demoTick % 2 === 1 ? [2, 4] : [1, 3];
      const p1 = employees[pairIndices[0]];
      const p2 = employees[pairIndices[1]];
      if (p1 && p2) {
        const chats: Array<[string, string]> = [
          ['🎮 Pas at, boşum!', '🎮 Gol be! 2-1!'],
          ['🎮 Street Fighter 1v1!', '🎮 Hadouken!! Kaçma!'],
          ['🎮 Mario Kart son tur!', '🎮 Mavi kabuk attım :D'],
        ];
        const chat = chats[demoTick % chats.length];
        p1.zone = 'COFFEE_LOUNGE';
        p1.status = 'idle';
        p1.activity = 'gaming';
        p1.playerSlot = 1;
        p1.partnerId = p2.id;
        p1.partnerName = p2.name;
        p1.speechBubble = chat[0];
        p1.currentTool = undefined;
        p1.currentTarget = undefined;

        p2.zone = 'COFFEE_LOUNGE';
        p2.status = 'idle';
        p2.activity = 'gaming';
        p2.playerSlot = 2;
        p2.partnerId = p1.id;
        p2.partnerName = p1.name;
        p2.speechBubble = chat[1];
        p2.currentTool = undefined;
        p2.currentTarget = undefined;
      }

      // Ensure a third employee relaxes on the sofa/armchair alongside the gaming pair
      const lounger = employees[demoTick % 2 === 1 ? 3 : 4];
      if (lounger && lounger.activity !== 'gaming') {
        lounger.zone = 'COFFEE_LOUNGE';
        lounger.status = 'waiting';
        lounger.activity = 'lounging';
        lounger.speechBubble = '🛋️ Koltukta dinleniyor (0 token)';
        lounger.currentTool = undefined;
        lounger.currentTarget = undefined;
      }
    }

  const boardMessages: SwarmBoardMessage[] = [
    {
      seq: 1 + demoTick,
      agent: 'Chief-Architect',
      text: '@coder-core @coder-ui Phase 2 paralel geliştirme başladı.',
      time: now,
      kind: 'message',
    },
    {
      seq: 2 + demoTick,
      agent: 'analyst-grill',
      text: '@coder-core parent_conversation_id cycle guard eklendi mi?',
      time: now,
      kind: 'message',
    },
    {
      seq: 3 + demoTick,
      agent: 'coder-core',
      text: '@analyst-grill Evet, Set + maxDepth 25 ile korundu.',
      time: now,
      kind: 'message',
    },
    {
      seq: 4 + demoTick,
      agent: 'verifier-qa',
      text: '@Chief-Architect @all Demo Penthouse simülasyonu stabil.',
      time: now,
      kind: 'message',
    },
  ];

  const activeCount = employees.filter((e) => e.status === 'working').length;
  const waitingCount = employees.filter((e) => e.status === 'waiting').length;

  return {
    id: 'demo-penthouse',
    floorNumber: 99,
    companyName: 'Swarm Simülasyon A.Ş. (Demo)',
    workspacePath: 'demo://penthouse',
    isDemo: true,
    tier: 4,
    companyXp: 12400 + demoTick * 80,
    nextTierXp: 25000,
    ecoScore: 94,
    activeCount,
    waitingCount,
    totalConversations: employees.length,
    unlockedProps: ['plants', 'dual_monitors', 'trophy', 'espresso', 'arcade', 'hologram'],
    employees,
    boardMessages,
    swarmTitle: 'Antigravity Plaza Demo Swarm',
    lastModifiedAt: now,
  };
}

export function getDemoEmployee(agentId: string): OfficeEmployee | null {
  const floor = getDemoFloor(false);
  return floor.employees.find((e) => e.id === agentId) || null;
}

export function getDemoAgentLogs(agentId: string, limit = 25): AgentLogEntry[] {
  const cycle = DEMO_CYCLES[agentId];
  if (!cycle) return [];

  const logs: AgentLogEntry[] = [];
  const total = Math.min(limit, 12);
  const nowMs = Date.now();

  for (let i = 0; i < total; i++) {
    const phase = cycle[(demoTick + i) % cycle.length];
    logs.push({
      stepIndex: demoTick + i + 1,
      timestamp: new Date(nowMs - (total - i) * 5000).toISOString(),
      type: 'PLANNER_RESPONSE',
      status: phase.status === 'error' ? 'ERROR' : 'DONE',
      toolName: phase.currentTool,
      targetSummary: phase.currentTarget,
      thoughtSnippet: phase.speechBubble,
    });
  }

  return logs;
}
