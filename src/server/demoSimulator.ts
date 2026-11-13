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
import {
  buildFloorTaskNodes,
  classifyToolActivity,
  computeAgentResources,
  computeModelBreakdown,
} from './gamification.js';
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

export const DEMO_STEP_INTERVAL_MS = 16_000;

let demoTick = 0;
let lastDemoAdvanceMs: number | null = null;

export function getDemoTick(): number {
  return demoTick;
}

export function resetDemoTick(): void {
  demoTick = 0;
  lastDemoAdvanceMs = null;
}

export function advanceDemoTick(): number {
  demoTick += 1;
  lastDemoAdvanceMs = Date.now();
  return demoTick;
}

/**
 * Generate the stateful Demo Penthouse floor, advancing simulation state on each call
 * or throttling progression to `DEMO_STEP_INTERVAL_MS` when `advance === 'throttled'`.
 */
export function getDemoFloor(
  advance: boolean | 'throttled' = true,
  nowMs = Date.now(),
): PlazaFloor {
  if (advance === true) {
    demoTick += 1;
    lastDemoAdvanceMs = nowMs;
  } else if (advance === 'throttled') {
    if (demoTick === 0 || lastDemoAdvanceMs === null) {
      demoTick = 1;
      lastDemoAdvanceMs = nowMs;
    } else if (nowMs - lastDemoAdvanceMs >= DEMO_STEP_INTERVAL_MS) {
      demoTick += 1;
      lastDemoAdvanceMs = nowMs;
    }
  }

  const effectiveTick = Math.max(1, demoTick);
  const now = new Date(nowMs).toISOString();
  const employees: OfficeEmployee[] = DEMO_ROSTER.map((tmpl, idx) => {
    const cycle = DEMO_CYCLES[tmpl.id];
    const phase = cycle[(effectiveTick + idx) % cycle.length];
    const stepCount = 35 + effectiveTick * 2 + idx * 9;
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
      inputTokens: 14000 + effectiveTick * 420 + idx * 1200,
      cacheReadTokens: 9800 + effectiveTick * 310 + idx * 800,
      outputTokens: 2100 + effectiveTick * 95 + idx * 300,
      lastActiveAt: now,
    };
  });

  // Calm 8-step office choreography (16s per step = 128s cycle; paired slots keep agents zone-stable for 32s+)
  const slot = (effectiveTick - 1) % 8;
  const isTeleportCycle = Math.floor((effectiveTick - 1) / 8) % 2 === 1;
  const setEmp = (
    emp: OfficeEmployee,
    zone: OfficeZone,
    status: OfficeEmployee['status'],
    activity: AgentActivityKind,
    speechBubble: string,
    opts?: {
      currentTool?: string;
      currentTarget?: string;
      partnerId?: string;
      partnerName?: string;
      playerSlot?: 1 | 2;
      isPresenter?: boolean;
      teleported?: boolean;
    },
  ) => {
    emp.zone = zone;
    emp.status = status;
    emp.activity = activity;
    emp.speechBubble = speechBubble;
    emp.currentTool = opts?.currentTool;
    emp.currentTarget = opts?.currentTarget;
    emp.partnerId = opts?.partnerId;
    emp.partnerName = opts?.partnerName;
    emp.playerSlot = opts?.playerSlot;
    emp.isPresenter = opts?.isPresenter;
    emp.teleported = opts?.teleported;
  };

  const [chief, coderCore, coderUi, analyst, verifier] = employees;

  if (slot === 0 || slot === 1) {
    setEmp(
      chief,
      'DESK_ARCHITECT',
      'working',
      'thinking',
      slot === 0 ? '@coder-core API kontratı hazır!' : 'Mimari plan güncelleniyor...',
      { currentTool: 'swarm', currentTarget: 'board.jsonl' },
    );
    setEmp(coderCore, 'DESK_CODING', 'working', 'coding', 'SQLite read-only katmanı yazılıyor', {
      currentTool: 'edit_file',
      currentTarget: 'src/server/gamification.ts',
    });
    setEmp(
      analyst,
      'COFFEE_LOUNGE',
      'waiting',
      'lounging',
      slot === 0 ? '🛋️ Koltukta dinleniyor (0 token)' : '😌 Zzz (0 token)',
    );
    setEmp(
      coderUi,
      'COFFEE_LOUNGE',
      'idle',
      'gaming',
      slot === 0 ? '🎮 Pas at, boşum!' : '🎮 Street Fighter 1v1!',
      { partnerId: verifier.id, partnerName: verifier.name, playerSlot: 1 },
    );
    setEmp(
      verifier,
      'COFFEE_LOUNGE',
      'idle',
      'gaming',
      slot === 0 ? '🎮 Gol be! 2-1!' : '🎮 Hadouken!! Kaçma!',
      { partnerId: coderUi.id, partnerName: coderUi.name, playerSlot: 2 },
    );
  } else if (slot === 2 || slot === 3) {
    setEmp(
      chief,
      'DESK_ARCHITECT',
      'working',
      'thinking',
      slot === 2 ? 'Mimari plan güncelleniyor...' : '@verifier-qa E2E testi başlat',
      { currentTool: 'swarm', currentTarget: 'board.jsonl' },
    );
    if (slot === 2) {
      setEmp(coderCore, 'DESK_CODING', 'working', 'coding', 'SQLite read-only katmanı yazılıyor', {
        currentTool: 'edit_file',
        currentTarget: 'src/server/demoSimulator.ts',
      });
    } else {
      setEmp(coderCore, 'SERVER_RACK', 'working', 'terminal', 'npm.cmd test çalıştırılıyor', {
        currentTool: 'run_command',
        currentTarget: 'npm.cmd test',
      });
    }
    setEmp(
      coderUi,
      'DESK_CODING',
      'working',
      slot === 3 ? 'reading' : 'coding',
      slot === 3 ? 'Shared tipler kontrol ediliyor' : 'İzometrik UI kodlanıyor',
      {
        currentTool: slot === 3 ? 'read_file' : 'edit_file',
        currentTarget: 'src/client/engine/OfficeCanvas.tsx',
      },
    );
    setEmp(
      analyst,
      'DESK_QA',
      'working',
      slot === 2 ? 'searching' : 'reading',
      slot === 2 ? 'Edge-case senaryoları taranıyor' : 'EcoScore formülü doğrulanıyor',
      {
        currentTool: slot === 2 ? 'grep_search' : 'read_file',
        currentTarget: 'src/server/gamification.ts',
      },
    );
    if (slot === 2) {
      setEmp(verifier, 'DESK_QA', 'working', 'reading', 'Test kapsamı inceleniyor', {
        currentTool: 'read_file',
        currentTarget: 'tests/server/core.test.ts',
      });
    } else {
      setEmp(verifier, 'SERVER_RACK', 'working', 'terminal', 'npm.cmd test çalıştırılıyor', {
        currentTool: 'run_command',
        currentTarget: 'npm.cmd test',
      });
    }
  } else if (slot === 4 || slot === 5) {
    setEmp(coderUi, 'DESK_CODING', 'working', 'coding', 'İzometrik UI kodlanıyor', {
      currentTool: 'edit_file',
      currentTarget: 'src/client/engine/OfficeCanvas.tsx',
    });
    setEmp(verifier, 'SERVER_RACK', 'working', 'terminal', 'npm.cmd test çalıştırılıyor', {
      currentTool: 'run_command',
      currentTarget: 'npm.cmd test',
    });
    setEmp(
      chief,
      'COFFEE_LOUNGE',
      'waiting',
      'lounging',
      slot === 4 ? '🛋️ Koltukta dinleniyor (0 token)' : '😌 Zzz (0 token)',
    );
    setEmp(
      coderCore,
      'COFFEE_LOUNGE',
      'idle',
      'gaming',
      slot === 4 ? '🎮 Street Fighter 1v1!' : '🎮 Mario Kart son tur!',
      { partnerId: analyst.id, partnerName: analyst.name, playerSlot: 1 },
    );
    setEmp(
      analyst,
      'COFFEE_LOUNGE',
      'idle',
      'gaming',
      slot === 4 ? '🎮 Hadouken!! Kaçma!' : '🎮 Mavi kabuk attım :D',
      { partnerId: coderCore.id, partnerName: coderCore.name, playerSlot: 2 },
    );
  } else {
    // slot === 6 || slot === 7: War Room Meeting
    setEmp(
      chief,
      'WAR_ROOM',
      'working',
      'presenting',
      isTeleportCycle ? '⚡ Ekibi beyaz tahtaya ışınladım!' : '📊 Sprint mimari sunumu',
      { isPresenter: true, teleported: false },
    );
    setEmp(
      coderCore,
      'WAR_ROOM',
      'working',
      'meeting',
      isTeleportCycle ? '⚡ Beyaz tahtaya ışınlandım!' : 'Sunum dinleniyor',
      { isPresenter: false, teleported: isTeleportCycle },
    );
    setEmp(
      analyst,
      'WAR_ROOM',
      'working',
      'meeting',
      isTeleportCycle ? '⚡ Beyaz tahtaya ışınlandım!' : 'Notlar alınıyor...',
      { isPresenter: false, teleported: isTeleportCycle },
    );
    setEmp(coderUi, 'DESK_CODING', 'working', 'coding', 'İzometrik UI kodlanıyor', {
      currentTool: 'edit_file',
      currentTarget: 'src/client/engine/OfficeCanvas.tsx',
    });
    setEmp(
      verifier,
      'COFFEE_LOUNGE',
      'waiting',
      'lounging',
      slot === 6 ? '🛋️ Koltukta dinleniyor (0 token)' : '😌 Zzz (0 token)',
    );
  }

  const rawBoardMessages: SwarmBoardMessage[] = [
    {
      seq: 1 + effectiveTick,
      agent: 'Chief-Architect',
      text: '@coder-core @coder-ui Phase 2 paralel geliştirme başladı.',
      time: now,
      kind: 'message',
    },
    {
      seq: 2 + effectiveTick,
      agent: 'analyst-grill',
      text: '@coder-core parent_conversation_id cycle guard eklendi mi?',
      time: now,
      kind: 'message',
    },
    {
      seq: 3 + effectiveTick,
      agent: 'coder-core',
      text: '@analyst-grill Evet, Set + maxDepth 25 ile korundu.',
      time: now,
      kind: 'message',
    },
    {
      seq: 4 + effectiveTick,
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
    } else if (activeEvent.kind === 'STAR_WARS_PARTY') {
      loungeEmps.forEach((emp, i) => {
        if (emp.activity !== 'gaming') {
          emp.speechBubble = ['⚔️ Güç seninle olsun!', '⚔️ Işın kılıcı hazır!'][i % 2];
        }
      });
    } else if (activeEvent.kind === 'SUPERHERO_PARTY') {
      loungeEmps.forEach((emp, i) => {
        if (emp.activity !== 'gaming') {
          emp.speechBubble = ['🦸 Pelerinler havaya!', '🦸 Bugünü biz kurtaracağız!'][i % 2];
        }
      });
    } else if (activeEvent.kind === 'HALLOWEEN_PARTY') {
      loungeEmps.forEach((emp, i) => {
        if (emp.activity !== 'gaming') {
          emp.speechBubble = ['🎃 Şeker mi şaka mı?', '🎃 Balkabağı kostümüm nasıl?'][i % 2];
        }
      });
    }
  }

  for (let idx = 0; idx < employees.length; idx++) {
    const emp = employees[idx];
    emp.toolActivity = classifyToolActivity({
      status: emp.status,
      toolName: emp.currentTool,
      targetSummary: emp.currentTarget,
    });
    const isVerifier = emp.id === 'demo-verifier-qa';
    const isCoreVerified = emp.id === 'demo-coder-core' && effectiveTick % 2 === 0;
    const isVerifiedOutput = isVerifier || isCoreVerified;
    const errorCount = emp.id === 'demo-analyst-grill' ? 1 : 0;
    const retryCount = errorCount;
    emp.health = {
      normalizedState:
        emp.status === 'working'
          ? 'active'
          : isVerifiedOutput
            ? 'completed'
            : 'waiting',
      hpScore: isVerifiedOutput ? 100 : errorCount > 0 ? 94 : 98,
      successRatePct: errorCount > 0 ? 96 : 100,
      totalSteps: emp.stepCount,
      errorCount,
      retryCount,
      consecutiveErrors: 0,
      elapsedSec: 120 + effectiveTick * 16 + idx * 25,
      isVerifiedOutput,
      verifiedLabel: isVerifier ? 'PASS' : isCoreVerified ? 'EXIT 0' : undefined,
    };
  }

  const taskNodes = buildFloorTaskNodes(employees, boardMessages, swarmEdges);
  const { agentResources, totalEstimatedTokens, totalEstimatedCostUsd } =
    computeAgentResources(employees);

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
    const bucketActive = isLast ? activeCount : 2 + ((effectiveTick + i) % 4);
    const completed = 3 + ((effectiveTick * 2 + i * 3) % 7);
    const err = (effectiveTick + i) % 11 === 0 ? 1 : 0;
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
    agentResources,
    totalEstimatedTokens,
    totalEstimatedCostUsd,
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
    companyXp: 4600 + effectiveTick * 125,
    nextTierXp: 25000,
    ecoScore: 94,
    activeCount,
    waitingCount,
    offDutyCount: 0,
    totalConversations: employees.length,
    unlockedProps: ['plants', 'dual_monitors', 'trophy', 'espresso', 'arcade', 'hologram'],
    employees,
    boardMessages,
    swarmEdges,
    swarmTitle: 'Antigravity Plaza Demo Swarm',
    taskNodes,
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
