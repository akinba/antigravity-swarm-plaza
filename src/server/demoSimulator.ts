import type {
  ActivityTimelineBucket,
  AgentActivityKind,
  AgentLogEntry,
  EmployeeGender,
  FloorAnalytics,
  OfficeEmployee,
  OfficeZone,
  PlazaFloor,
  SwarmBoardMessage,
  SwarmRole,
} from '../shared/types.js';
import { buildSwarmMentionEdges, extractMentions } from './brainScanner.js';
import { classifyToolActivity, computeModelBreakdown } from './gamification.js';
import { getActiveFloorEvent, getFloorLayoutSeed } from './officeEvents.js';

interface DemoEmployeeTemplate {
  id: string;
  name: string;
  roleTitle: string;
  gender?: EmployeeGender;
  isCoordinator: boolean;
  swarmRole: SwarmRole;
  modelId: string;
  modelFamily: OfficeEmployee['modelFamily'];
  workspaceMode: string;
  baseDesk: OfficeZone;
}

const DEMO_ROSTER: DemoEmployeeTemplate[] = [
  {
    id: 'demo-chief-architect',
    name: 'Chief-Architect',
    roleTitle: 'Boss',
    gender: 'female',
    isCoordinator: true,
    swarmRole: 'coordinator',
    modelId: 'gemini-argon-orchestrator',
    modelFamily: 'argon',
    workspaceMode: 'inherit',
    baseDesk: 'DESK_ARCHITECT',
  },
  {
    id: 'demo-coder-core',
    name: 'coder-core',
    roleTitle: 'Backend Engineer',
    gender: 'male',
    isCoordinator: false,
    swarmRole: 'worker',
    modelId: 'gemini-hydrogen-pro',
    modelFamily: 'hydrogen',
    workspaceMode: 'share',
    baseDesk: 'DESK_CODING',
  },
  {
    id: 'demo-coder-ui',
    name: 'coder-ui',
    roleTitle: 'Frontend Architect',
    gender: 'female',
    isCoordinator: false,
    swarmRole: 'worker',
    modelId: 'gemini-hydrogen-pro',
    modelFamily: 'hydrogen',
    workspaceMode: 'share',
    baseDesk: 'DESK_CODING',
  },
  {
    id: 'demo-analyst-grill',
    name: 'analyst-grill',
    roleTitle: 'Stall Monitor & Risk Analyst',
    gender: 'male',
    isCoordinator: false,
    swarmRole: 'monitor',
    modelId: 'gemini-flash-2.5',
    modelFamily: 'flash',
    workspaceMode: 'inherit',
    baseDesk: 'DESK_QA',
  },
  {
    id: 'demo-verifier-qa',
    name: 'verifier-qa',
    roleTitle: 'QA & Integration',
    gender: 'female',
    isCoordinator: false,
    swarmRole: 'verifier',
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
      gender: tmpl.gender,
      isCoordinator: tmpl.isCoordinator,
      modelId: tmpl.modelId,
      modelFamily: tmpl.modelFamily,
      workspaceMode: tmpl.workspaceMode,
      status: phase.status,
      swarmRole: tmpl.swarmRole,
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
    } else {
      // Every 3rd tick: showcase Meeting Room Presentation + Desk Coding + Lounge Relaxation
      employees[0].zone = 'WAR_ROOM';
      employees[0].status = 'working';
      employees[0].activity = 'presenting';
      employees[0].isPresenter = true;
      employees[0].speechBubble = '📊 Sprint mimari sunumu';

      employees[1].zone = 'WAR_ROOM';
      employees[1].status = 'working';
      employees[1].activity = 'meeting';
      employees[1].isPresenter = false;
      employees[1].speechBubble = 'Sunum dinleniyor';

      employees[3].zone = 'WAR_ROOM';
      employees[3].status = 'working';
      employees[3].activity = 'meeting';
      employees[3].isPresenter = false;
      employees[3].speechBubble = 'Notlar alınıyor...';

      employees[2].zone = 'DESK_CODING';
      employees[2].status = 'working';
      employees[2].activity = 'coding';
      employees[2].speechBubble = 'İzometrik UI kodlanıyor';

      employees[4].zone = 'COFFEE_LOUNGE';
      employees[4].status = 'waiting';
      employees[4].activity = 'lounging';
      employees[4].speechBubble = '🛋️ Koltukta dinleniyor (0 token)';
    }

    // Ensure any WAR_ROOM employees have exactly 1 presenter
    const warRoomEmps = employees.filter((e) => e.zone === 'WAR_ROOM');
    if (warRoomEmps.length > 0) {
      warRoomEmps.forEach((emp, i) => {
        if (i === 0) {
          emp.isPresenter = true;
          emp.activity = 'presenting';
        } else {
          emp.isPresenter = false;
          emp.activity = 'meeting';
        }
      });
    }

  const rawBoardMessages: SwarmBoardMessage[] = [
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
  const boardMessages: SwarmBoardMessage[] = rawBoardMessages.map((m) => ({
    ...m,
    mentions: extractMentions(m.text),
  }));
  const swarmEdges = buildSwarmMentionEdges(boardMessages);

  const nowMs = Date.now();
  const layoutSeed = getFloorLayoutSeed('demo-penthouse');
  const activeEvent = getActiveFloorEvent('demo-penthouse', nowMs);

  if (activeEvent) {
    const loungeEmps = employees.filter(
      (e) => e.zone === 'COFFEE_LOUNGE' && (e.status === 'idle' || e.status === 'waiting'),
    );
    if (activeEvent.kind === 'PIZZA_PARTY') {
      loungeEmps.slice(0, 4).forEach((emp, i) => {
        emp.activity = 'pizza';
        emp.partnerId = undefined;
        emp.partnerName = undefined;
        emp.playerSlot = undefined;
        emp.speechBubble = ['🍕 Sıcak pepperoni kap!', '🍕 Dilim efsane!', '🍕 Tam zamanında geldi!'][i % 3];
      });
    } else if (activeEvent.kind === 'WATERCOOLER_GOSSIP') {
      loungeEmps.slice(0, 3).forEach((emp, i) => {
        emp.activity = 'watercooler';
        emp.partnerId = undefined;
        emp.partnerName = undefined;
        emp.playerSlot = undefined;
        emp.speechBubble = ['💧 Su başı dedikodusu!', '💧 Flash 0 token yakıyor!'][i % 2];
      });
    } else if (activeEvent.kind === 'COFFEE_BREW') {
      loungeEmps.slice(0, 4).forEach((emp, i) => {
        emp.activity = 'coffee';
        emp.partnerId = undefined;
        emp.partnerName = undefined;
        emp.playerSlot = undefined;
        emp.speechBubble = ['☕ Taze espresso kokusu!', '☕ Duble shot zamanı!'][i % 2];
      });
    } else if (activeEvent.kind === 'MASCOT_ZOOMIES') {
      loungeEmps.forEach((emp, i) => {
        if (emp.activity !== 'gaming') {
          emp.speechBubble = ['🐱 Kedi turboya geçti :D', '🤖 Maskot şov yapıyor!'][i % 2];
        }
      });
    } else if (activeEvent.kind === 'SPRINT_CELEBRATION') {
      loungeEmps.forEach((emp, i) => {
        if (emp.activity !== 'gaming') {
          emp.speechBubble = ['🎉 Sprint hedefi tamam!', '🚀 Şirket uçuyor!'][i % 2];
        }
      });
    }
  }

  // Every 5th tick, one demo agent heads to the elevator to go home, returning fresh on the next tick
  if (demoTick > 0 && demoTick % 5 === 0 && employees[4]) {
    employees[4].zone = 'ELEVATOR';
    employees[4].status = 'idle';
    employees[4].activity = 'going_home';
    employees[4].partnerId = undefined;
    employees[4].partnerName = undefined;
    employees[4].playerSlot = undefined;
    employees[4].isPresenter = undefined;
    employees[4].speechBubble = '🏠 Mesai bitti, eve gidiyorum!';
    employees[4].currentTool = undefined;
    employees[4].currentTarget = undefined;
  }

  for (const emp of employees) {
    emp.toolActivity = classifyToolActivity({
      status: emp.status,
      toolName: emp.currentTool,
      targetSummary: emp.currentTarget,
    });
  }

  const activeCount = employees.filter((e) => e.status === 'working').length;
  const waitingCount = employees.filter((e) => e.status === 'waiting').length;

  const BUCKET_COUNT = 12;
  const BUCKET_MS = 5 * 60_000;
  const windowStartMs = nowMs - BUCKET_COUNT * BUCKET_MS;
  const timeline60m: ActivityTimelineBucket[] = [];
  let completedTasks60m = 0;
  let peakActive60m = activeCount;
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const startMs = windowStartMs + i * BUCKET_MS;
    const endMs = startMs + BUCKET_MS;
    const isLast = i === BUCKET_COUNT - 1;
    const bucketActive = isLast ? activeCount : 2 + ((demoTick + i) % 4);
    const completed = 3 + ((demoTick * 2 + i * 3) % 7);
    const err = (demoTick + i) % 11 === 0 ? 1 : 0;
    completedTasks60m += completed;
    if (bucketActive > peakActive60m) peakActive60m = bucketActive;
    timeline60m.push({
      bucketStart: new Date(startMs).toISOString(),
      label: new Date(endMs).toISOString().slice(11, 16),
      activeCount: bucketActive,
      completedTasks: completed,
      errorCount: err,
    });
  }

  const analytics: FloorAnalytics = {
    timeline60m,
    completedTasks60m,
    peakActive60m,
    modelBreakdown: computeModelBreakdown(employees),
  };

  return {
    id: 'demo-penthouse',
    floorNumber: 99,
    companyName: 'Swarm Simülasyon A.Ş. (Demo)',
    workspacePath: 'demo://penthouse',
    isDemo: true,
    layoutSeed,
    activeEvent,
    tier: 4,
    companyXp: 12400 + demoTick * 80,
    nextTierXp: 25000,
    ecoScore: 94,
    activeCount,
    waitingCount,
    offDutyCount: demoTick > 0 && demoTick % 5 === 1 ? 1 : 0,
    totalConversations: employees.length,
    unlockedProps: ['plants', 'dual_monitors', 'trophy', 'espresso', 'arcade', 'hologram'],
    employees,
    boardMessages,
    swarmEdges,
    swarmTitle: 'Antigravity Plaza Demo Swarm',
    analytics,
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
