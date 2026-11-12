import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import {
  getCompanyNameFromPath,
  parseWorkspaceUri,
  parseWorkspaceUris,
  resolveConversationWorkspaces,
  type ConversationSummaryRow,
} from '../../src/server/dbReader.js';
import {
  getDemoAgentLogs,
  getDemoFloor,
  resetDemoTick,
} from '../../src/server/demoSimulator.js';
import {
  buildPlazaSnapshot,
  classifyModelFamily,
  computeCompanyTier,
  computeEcoScore,
  computeEmployeeXpAndLevel,
  determineZoneAndActivity,
} from '../../src/server/gamification.js';
import { createPlazaApp } from '../../src/server/index.js';

function makeTempDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'plaza-test-'));
}

function createTestRow(overrides: Partial<ConversationSummaryRow>): ConversationSummaryRow {
  return {
    conversation_id: 'conv-1',
    title: 'Test Conv',
    preview: null,
    step_count: 10,
    last_modified_time: new Date().toISOString(),
    workspace_uris: null,
    status: 'CASCADE_RUN_STATUS_IDLE',
    source: 'IDE',
    project_id: 'proj-1',
    agent_name: null,
    parent_conversation_id: null,
    nesting_depth: 0,
    not_fully_idle: 0,
    killed: 0,
    last_user_input_time: null,
    ...overrides,
  };
}

describe('URI decoding & workspace parsing', () => {
  it('decodes Windows and POSIX file URIs cleanly', () => {
    assert.equal(
      parseWorkspaceUri('file:///d%3A/Antigravity/Swarm-Dasboard'),
      'd:/Antigravity/Swarm-Dasboard',
    );
    assert.equal(parseWorkspaceUri('file:///home/dev/my-project/'), '/home/dev/my-project');
    assert.deepEqual(
      parseWorkspaceUris('["file:///d%3A/Antigravity/Swarm-Dasboard"]'),
      ['d:/Antigravity/Swarm-Dasboard'],
    );
    assert.equal(getCompanyNameFromPath('d:/Antigravity/Swarm-Dasboard'), 'Swarm-Dasboard');
    assert.deepEqual(parseWorkspaceUris('not-json['), []);
  });
});

describe('Parent floor inheritance', () => {
  it('inherits root ancestor workspace and guards against cycles', () => {
    const rows: ConversationSummaryRow[] = [
      createTestRow({
        conversation_id: 'root-coord',
        workspace_uris: '["file:///d%3A/Antigravity/Swarm-Dasboard"]',
      }),
      createTestRow({
        conversation_id: 'child-worker',
        parent_conversation_id: 'root-coord',
        workspace_uris: '[]',
      }),
      createTestRow({
        conversation_id: 'grandchild-helper',
        workspace_uris: null,
      }),
      createTestRow({
        conversation_id: 'freelance-conv',
        workspace_uris: '[]',
        project_id: 'outside-of-project',
      }),
      createTestRow({
        conversation_id: 'cycle-a',
        parent_conversation_id: 'cycle-b',
        workspace_uris: null,
      }),
      createTestRow({
        conversation_id: 'cycle-b',
        parent_conversation_id: 'cycle-a',
        workspace_uris: null,
      }),
    ];

    const extraParentLinks = new Map<string, string>([['grandchild-helper', 'child-worker']]);
    const resolved = resolveConversationWorkspaces(rows, extraParentLinks);

    assert.equal(resolved.get('root-coord')?.companyName, 'Swarm-Dasboard');
    assert.equal(resolved.get('child-worker')?.companyName, 'Swarm-Dasboard');
    assert.equal(
      resolved.get('grandchild-helper')?.workspacePath,
      'd:/Antigravity/Swarm-Dasboard',
    );
    assert.equal(resolved.get('grandchild-helper')?.isLobby, false);

    assert.equal(resolved.get('freelance-conv')?.isLobby, true);
    assert.equal(resolved.get('freelance-conv')?.companyName, 'Global Freelance Lobby');

    // Cycle should terminate safely and fall back to lobby
    assert.equal(resolved.get('cycle-a')?.isLobby, true);
  });
});

describe('Gamification rules', () => {
  it('classifies model families, XP/level, company tier, ecoScore, and zones', () => {
    assert.equal(classifyModelFamily('gemini-argon-orchestrator'), 'argon');
    assert.equal(classifyModelFamily('gemini-hydrogen-pro'), 'hydrogen');
    assert.equal(classifyModelFamily('gemini-2.5-flash'), 'flash');
    assert.equal(classifyModelFamily('gemini-carbon-lite'), 'carbon');
    assert.equal(classifyModelFamily('unknown-model'), 'other');

    const empXp = computeEmployeeXpAndLevel(20);
    assert.equal(empXp.xp, 300);
    assert.equal(empXp.level, Math.floor(Math.sqrt(300 / 45)) + 1);

    assert.deepEqual(computeCompanyTier(499), {
      tier: 1,
      nextTierXp: 500,
      unlockedProps: [],
    });
    assert.deepEqual(computeCompanyTier(500), {
      tier: 2,
      nextTierXp: 2500,
      unlockedProps: ['plants', 'dual_monitors'],
    });
    assert.deepEqual(computeCompanyTier(2500), {
      tier: 3,
      nextTierXp: 10000,
      unlockedProps: ['plants', 'dual_monitors', 'trophy', 'espresso'],
    });
    assert.deepEqual(computeCompanyTier(10000), {
      tier: 4,
      nextTierXp: 25000,
      unlockedProps: ['plants', 'dual_monitors', 'trophy', 'espresso', 'arcade', 'hologram'],
    });

    const waitingZone = determineZoneAndActivity({
      status: 'waiting',
      isCoordinator: false,
      roleTitle: 'coder',
      agentName: 'coder-core',
      recentBoardMessages: [],
    });
    assert.equal(waitingZone.zone, 'COFFEE_LOUNGE');
    assert.equal(waitingZone.activity, 'sleeping');
    assert.equal(waitingZone.speechBubble, 'Zzz (0 token)');

    const nowMs = Date.now();
    const meetingZone = determineZoneAndActivity({
      status: 'working',
      isCoordinator: false,
      roleTitle: 'coder',
      agentName: 'coder-core',
      recentBoardMessages: [
        {
          seq: 5,
          agent: 'coordinator',
          text: '@coder-core Check API contract',
          time: new Date(nowMs - 5000).toISOString(),
          kind: 'message',
        },
      ],
      nowMs,
    });
    assert.equal(meetingZone.zone, 'WAR_ROOM');
    assert.equal(meetingZone.activity, 'meeting');

    const eco = computeEcoScore([
      {
        id: '1',
        name: 'worker',
        roleTitle: 'QA',
        isCoordinator: false,
        modelId: 'gemini-flash',
        modelFamily: 'flash',
        workspaceMode: 'inherit',
        status: 'waiting',
        zone: 'COFFEE_LOUNGE',
        activity: 'sleeping',
        xp: 150,
        level: 2,
        stepCount: 10,
        inputTokens: 1000,
        cacheReadTokens: 800,
        outputTokens: 100,
        lastActiveAt: new Date().toISOString(),
      },
    ]);
    assert.ok(eco >= 90 && eco <= 100);
  });
});

describe('Demo simulator', () => {
  it('progresses ticks with 5 Pure-Gemini employees and provides logs', () => {
    resetDemoTick();
    const floor1 = getDemoFloor(true);
    const floor2 = getDemoFloor(true);

    assert.equal(floor1.id, 'demo-penthouse');
    assert.equal(floor1.floorNumber, 99);
    assert.equal(floor1.isDemo, true);
    assert.equal(floor1.employees.length, 5);
    assert.ok(floor2.companyXp > floor1.companyXp);

    const logs = getDemoAgentLogs('demo-coder-core', 10);
    assert.equal(logs.length, 10);
    assert.ok(logs[0].stepIndex > 0);
  });
});

describe('Read-only SQLite snapshot & Express API', () => {
  it('handles missing DB gracefully and builds snapshot from temp SQLite + brain files', async () => {
    const tmpDir = makeTempDataDir();
    try {
      // 1. Missing DB should not crash
      const emptySnap = buildPlazaSnapshot(tmpDir, 'd:\\Antigravity\\Swarm-Dasboard', false);
      assert.deepEqual(emptySnap.floors, []);
      assert.equal(emptySnap.totalActiveAgents, 0);

      // 2. Populate temp SQLite DB
      const dbPath = path.join(tmpDir, 'conversation_summaries.db');
      const db = new DatabaseSync(dbPath);
      db.exec(`
        CREATE TABLE conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          title TEXT,
          preview TEXT,
          step_count INTEGER,
          last_modified_time TEXT,
          workspace_uris TEXT,
          status TEXT,
          source TEXT,
          project_id TEXT,
          agent_name TEXT,
          parent_conversation_id TEXT,
          nesting_depth INTEGER,
          not_fully_idle INTEGER,
          killed INTEGER,
          last_user_input_time TEXT
        );
      `);

      const nowIso = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO conversation_summaries (
          conversation_id, title, step_count, last_modified_time, workspace_uris,
          status, project_id, agent_name, parent_conversation_id, nesting_depth,
          not_fully_idle, killed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        'coord-1',
        'Swarm Coordinator',
        30,
        nowIso,
        '["file:///d%3A/Antigravity/Swarm-Dasboard"]',
        'CASCADE_RUN_STATUS_RUNNING',
        'proj-swarm',
        'coordinator',
        null,
        0,
        1,
        0,
      );
      insert.run(
        'worker-1',
        'Backend Worker',
        20,
        nowIso,
        '[]',
        'CASCADE_RUN_STATUS_IDLE',
        'proj-swarm',
        'coder-core',
        'coord-1',
        1,
        0,
        0,
      );
      insert.run(
        'lobby-1',
        'Quick Question',
        5,
        nowIso,
        '[]',
        'CASCADE_RUN_STATUS_IDLE',
        'outside-of-project',
        null,
        null,
        0,
        0,
        0,
      );
      db.close();

      // 3. Populate brain files (swarm members, board, transcript, presence lock)
      const swarmDir = path.join(tmpDir, 'brain', 'coord-1', '.system_generated', 'swarm');
      const logsDir = path.join(tmpDir, 'brain', 'worker-1', '.system_generated', 'logs');
      const presenceDir = path.join(tmpDir, 'presence');
      fs.mkdirSync(swarmDir, { recursive: true });
      fs.mkdirSync(logsDir, { recursive: true });
      fs.mkdirSync(presenceDir, { recursive: true });

      fs.writeFileSync(path.join(presenceDir, 'coord-1.lock'), '');
      fs.writeFileSync(
        path.join(swarmDir, 'members.json'),
        JSON.stringify({
          title: 'Plaza Build Swarm',
          members: {
            'coder-core': {
              conversation_id: 'worker-1',
              role: 'Backend Engineer',
              applied_model: 'gemini-hydrogen-pro',
              workspace_mode: 'inherit',
              wait_since: 4,
            },
          },
        }),
      );
      fs.writeFileSync(
        path.join(swarmDir, 'board.jsonl'),
        JSON.stringify({
          seq: 1,
          agent: 'coordinator',
          text: '@coder-core Implement server',
          time: nowIso,
          kind: 'message',
        }) + '\n',
      );
      fs.writeFileSync(
        path.join(logsDir, 'transcript.jsonl'),
        JSON.stringify({
          step_index: 1,
          created_at: nowIso,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          usage: { input_tokens: 1200, cache_read_tokens: 900, output_tokens: 150 },
          tool_calls: [{ name: 'edit_file', args: { Path: 'd:/Antigravity/Swarm-Dasboard/src/server/index.ts' } }],
          thinking: 'Writing Express server endpoints.',
        }) + '\n',
      );

      const snapshot = buildPlazaSnapshot(tmpDir, 'd:\\Antigravity\\Swarm-Dasboard', false);
      assert.equal(snapshot.floors.length, 2);
      assert.ok(snapshot.activeProjectFloorId);

      const projectFloor = snapshot.floors.find((f) => f.id === snapshot.activeProjectFloorId);
      assert.ok(projectFloor);
      assert.equal(projectFloor.companyName, 'Swarm-Dasboard');
      assert.equal(projectFloor.swarmTitle, 'Plaza Build Swarm');
      assert.equal(projectFloor.employees.length, 2);
      assert.equal(projectFloor.activeCount, 1);
      assert.equal(projectFloor.waitingCount, 1);

      const worker = projectFloor.employees.find((e) => e.id === 'worker-1');
      assert.ok(worker);
      assert.equal(worker.status, 'waiting');
      assert.equal(worker.zone, 'COFFEE_LOUNGE');
      assert.equal(worker.modelFamily, 'hydrogen');
      assert.equal(worker.inputTokens, 1200);
      assert.equal(worker.cacheReadTokens, 900);

      // 4. Test Express app endpoints on ephemeral port
      const appInstance = createPlazaApp({
        agyDataDir: tmpDir,
        currentWorkspace: 'd:\\Antigravity\\Swarm-Dasboard',
        initialDemoMode: false,
        broadcastIntervalMs: 0,
      });

      await new Promise<void>((resolve) => {
        appInstance.server.listen(0, '127.0.0.1', () => resolve());
      });

      try {
        const addr = appInstance.server.address();
        assert.ok(addr && typeof addr === 'object');
        const baseUrl = `http://127.0.0.1:${addr.port}`;

        const healthRes = await fetch(`${baseUrl}/api/health`);
        assert.equal(healthRes.status, 200);
        const healthJson = (await healthRes.json()) as { ok: boolean };
        assert.equal(healthJson.ok, true);

        const logsRes = await fetch(`${baseUrl}/api/agents/worker-1/logs`);
        assert.equal(logsRes.status, 200);
        const logsJson = (await logsRes.json()) as { recentLogs: Array<{ toolName?: string }> };
        assert.equal(logsJson.recentLogs.length, 1);
        assert.equal(logsJson.recentLogs[0].toolName, 'edit_file');

        const toggleRes = await fetch(`${baseUrl}/api/demo/toggle`, { method: 'POST' });
        assert.equal(toggleRes.status, 200);
        const toggleJson = (await toggleRes.json()) as {
          demoMode: boolean;
          snapshot: { floors: Array<{ id: string }> };
        };
        assert.equal(toggleJson.demoMode, true);
        assert.ok(toggleJson.snapshot.floors.some((f) => f.id === 'demo-penthouse'));
      } finally {
        await appInstance.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
