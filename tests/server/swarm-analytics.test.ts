import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  buildSwarmMentionEdges,
  classifySwarmRole,
  extractMentions,
  scanBrainData,
} from '../../src/server/brainScanner.js';
import { getDemoFloor, resetDemoTick } from '../../src/server/demoSimulator.js';
import {
  buildPlazaSnapshot,
  classifyToolActivity,
  computeFloorAnalytics,
} from '../../src/server/gamification.js';
import type { OfficeEmployee } from '../../src/shared/types.js';

describe('Swarm board scanning, mentions & roles', () => {
  it('extracts @mentions, builds directed mention edges, and classifies worker/monitor/narrator roles', () => {
    const mentions = extractMentions('@coder-core @verifier-qa lütfen @coder-core kontrol et');
    assert.deepEqual(mentions, ['coder-core', 'verifier-qa']);

    const edges = buildSwarmMentionEdges([
      {
        seq: 1,
        agent: 'coordinator',
        text: '@coder-core @monitor Başla',
        time: '2026-11-13 10:00:00',
        kind: 'brief',
        mentions: ['coder-core', 'monitor'],
      },
      {
        seq: 2,
        agent: 'coordinator',
        text: '@coder-core Güncelleme?',
        time: '2026-11-13 10:05:00',
        kind: 'message',
        mentions: ['coder-core'],
      },
      {
        seq: 3,
        agent: 'monitor',
        text: '@monitor self-ping @narrator özetle',
        time: '2026-11-13 10:06:00',
        kind: 'message',
      },
    ]);

    const coordToCoder = edges.find((e) => e.from === 'coordinator' && e.to === 'coder-core');
    assert.ok(coordToCoder);
    assert.equal(coordToCoder.count, 2);
    assert.equal(coordToCoder.lastSeq, 2);

    const monitorToSelf = edges.find((e) => e.from === 'monitor' && e.to === 'monitor');
    assert.equal(monitorToSelf, undefined);

    const monitorToNarrator = edges.find((e) => e.from === 'monitor' && e.to === 'narrator');
    assert.ok(monitorToNarrator);
    assert.equal(monitorToNarrator.count, 1);

    assert.equal(classifySwarmRole('coordinator', undefined, true), 'coordinator');
    assert.equal(classifySwarmRole('stall-monitor', 'monitor', false), 'monitor');
    assert.equal(classifySwarmRole('narrator', 'narrator', false), 'narrator');
    assert.equal(classifySwarmRole('qa-verifier', 'verifier', false), 'verifier');
    assert.equal(classifySwarmRole('coder-core', 'worker', false), 'worker');
  });

  it('scans brain/<id>/.system_generated/swarm/ read-only without modifying files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-ro-test-'));
    try {
      const rootId = 'conv-root-swarm';
      const monitorId = 'conv-monitor';
      const narratorId = 'conv-narrator';
      const workerId = 'conv-worker';

      const swarmDir = path.join(tmpDir, 'brain', rootId, '.system_generated', 'swarm');
      fs.mkdirSync(swarmDir, { recursive: true });
      fs.writeFileSync(
        path.join(swarmDir, 'members.json'),
        JSON.stringify({
          title: 'Read-Only Swarm Test',
          members: {
            monitor: {
              conversation_id: monitorId,
              role: 'monitor',
              model: 'gemini-flash-2.5',
              workspace_mode: 'inherit',
            },
            narrator: {
              conversation_id: narratorId,
              role: 'narrator',
              model: 'gemini-flash-2.5',
              workspace_mode: 'inherit',
            },
            'coder-1': {
              conversation_id: workerId,
              role: 'worker',
              model: 'gemini-hydrogen-pro',
              workspace_mode: 'share',
            },
          },
        }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(swarmDir, 'board.jsonl'),
        [
          JSON.stringify({
            seq: 1,
            agent: 'coordinator',
            text: '@coder-1 @monitor Görev başladı',
            time: '2026-11-13 10:00:00',
            kind: 'brief',
          }),
          JSON.stringify({
            seq: 2,
            agent: 'narrator',
            text: '@all Günlük özet hazır',
            time: '2026-11-13 10:02:00',
            kind: 'message',
          }),
        ].join('\n') + '\n',
        'utf8',
      );

      const membersStatBefore = fs.statSync(path.join(swarmDir, 'members.json'));
      const boardStatBefore = fs.statSync(path.join(swarmDir, 'board.jsonl'));

      const scan = scanBrainData(tmpDir, [rootId, monitorId, narratorId, workerId]);
      assert.equal(scan.swarmMemberByConvId.get(monitorId)?.role, 'monitor');
      assert.equal(scan.swarmMemberByConvId.get(narratorId)?.role, 'narrator');
      assert.equal(scan.swarmMemberByConvId.get(workerId)?.role, 'worker');

      const board = scan.swarmBoardsByRootConvId.get(rootId);
      assert.ok(board);
      assert.equal(board.title, 'Read-Only Swarm Test');
      assert.equal(board.messages.length, 2);
      assert.deepEqual(board.messages[0].mentions, ['coder-1', 'monitor']);

      const membersStatAfter = fs.statSync(path.join(swarmDir, 'members.json'));
      const boardStatAfter = fs.statSync(path.join(swarmDir, 'board.jsonl'));
      assert.equal(membersStatAfter.mtimeMs, membersStatBefore.mtimeMs);
      assert.equal(boardStatAfter.mtimeMs, boardStatBefore.mtimeMs);
      assert.deepEqual(fs.readdirSync(swarmDir).sort(), ['board.jsonl', 'members.json']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Tool-level live activity status', () => {
  it('classifies reading, writing, testing, searching, error, and idle accurately', () => {
    assert.equal(
      classifyToolActivity({ status: 'working', toolName: 'read_file', targetSummary: 'types.ts' }),
      'reading',
    );
    assert.equal(
      classifyToolActivity({ status: 'working', toolName: 'edit_file', targetSummary: 'index.ts' }),
      'writing',
    );
    assert.equal(
      classifyToolActivity({
        status: 'working',
        toolName: 'run_command',
        targetSummary: 'npm test',
      }),
      'testing',
    );
    assert.equal(
      classifyToolActivity({
        status: 'working',
        toolName: 'grep_search',
        targetSummary: 'buildPlazaSnapshot',
      }),
      'searching',
    );
    assert.equal(
      classifyToolActivity({
        status: 'working',
        toolName: 'read_file',
        lastStepStatus: 'ERROR',
      }),
      'error',
    );
    assert.equal(
      classifyToolActivity({ status: 'error', toolName: 'edit_file' }),
      'error',
    );
    assert.equal(
      classifyToolActivity({ status: 'waiting', toolName: 'edit_file' }),
      'idle',
    );
    assert.equal(
      classifyToolActivity({ status: 'idle', toolName: 'read_file' }),
      'idle',
    );
  });
});

describe('Floor 60m activity timeline & analytics buckets', () => {
  it('computes 12x5m timeline buckets, completed tasks, peak active, and model breakdown', () => {
    const nowMs = Date.UTC(2026, 10, 13, 12, 0, 0);
    const employees: OfficeEmployee[] = [
      {
        id: 'a1',
        name: 'coord',
        roleTitle: 'Coordinator',
        isCoordinator: true,
        modelId: 'gemini-argon-orchestrator',
        modelFamily: 'argon',
        workspaceMode: 'inherit',
        status: 'working',
        zone: 'DESK_ARCHITECT',
        activity: 'thinking',
        xp: 150,
        level: 2,
        stepCount: 10,
        inputTokens: 1000,
        cacheReadTokens: 500,
        outputTokens: 200,
        lastActiveAt: new Date(nowMs - 2 * 60_000).toISOString(),
      },
      {
        id: 'a2',
        name: 'worker-1',
        roleTitle: 'Worker',
        isCoordinator: false,
        modelId: 'gemini-hydrogen-pro',
        modelFamily: 'hydrogen',
        workspaceMode: 'share',
        status: 'waiting',
        zone: 'COFFEE_LOUNGE',
        activity: 'lounging',
        xp: 75,
        level: 2,
        stepCount: 5,
        inputTokens: 400,
        cacheReadTokens: 200,
        outputTokens: 100,
        lastActiveAt: new Date(nowMs - 20 * 60_000).toISOString(),
      },
    ];

    const stepEventsByAgent = new Map<string, Array<{ timestamp: string; status: string }>>([
      [
        'a1',
        [
          { timestamp: new Date(nowMs - 3 * 60_000).toISOString(), status: 'DONE' },
          { timestamp: new Date(nowMs - 2 * 60_000).toISOString(), status: 'ERROR' },
        ],
      ],
      [
        'a2',
        [{ timestamp: new Date(nowMs - 20 * 60_000).toISOString(), status: 'DONE' }],
      ],
    ]);

    const analytics = computeFloorAnalytics({ employees, stepEventsByAgent, nowMs });
    assert.equal(analytics.timeline60m.length, 12);
    assert.equal(analytics.completedTasks60m, 2);
    assert.equal(analytics.peakActive60m, 1);
    assert.equal(analytics.timeline60m[11].errorCount, 1);
    assert.equal(analytics.modelBreakdown.length, 2);
    assert.equal(analytics.modelBreakdown[0].totalTokens, 1700);
  });

  it('populates toolActivity, swarmRole, swarmEdges, and analytics end-to-end in buildPlazaSnapshot and demoSimulator', () => {
    resetDemoTick();
    const demoFloor = getDemoFloor(true);
    assert.ok(demoFloor.swarmEdges && demoFloor.swarmEdges.length > 0);
    assert.ok(demoFloor.analytics);
    assert.equal(demoFloor.analytics.timeline60m.length, 12);
    assert.ok(demoFloor.analytics.modelBreakdown.length > 0);
    assert.ok(demoFloor.employees.every((e) => Boolean(e.toolActivity) && Boolean(e.swarmRole)));

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plaza-analytics-e2e-'));
    try {
      const db = new DatabaseSync(path.join(tmpDir, 'conversation_summaries.db'));
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
      db.prepare(
        `INSERT INTO conversation_summaries (
          conversation_id, title, preview, step_count, last_modified_time,
          workspace_uris, status, source, project_id, agent_name,
          parent_conversation_id, nesting_depth, not_fully_idle, killed, last_user_input_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'conv-e2e-1',
        'E2E Workspace',
        '',
        12,
        nowIso,
        JSON.stringify(['file:///d:/Dosyalar/swarm-dashboard']),
        'CASCADE_RUN_STATUS_RUNNING',
        '',
        '',
        'coder-e2e',
        null,
        0,
        1,
        0,
        nowIso,
      );
      db.close();

      const logsDir = path.join(tmpDir, 'brain', 'conv-e2e-1', '.system_generated', 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(
        path.join(logsDir, 'transcript.jsonl'),
        JSON.stringify({
          step_index: 1,
          created_at: nowIso,
          status: 'DONE',
          tool_calls: [{ name: 'run_command', args: { CommandLine: 'npm test' } }],
        }) + '\n',
        'utf8',
      );

      const snapshot = buildPlazaSnapshot(tmpDir, 'd:/Dosyalar/swarm-dashboard', false);
      assert.equal(snapshot.floors.length, 1);
      const floor = snapshot.floors[0];
      assert.equal(floor.employees[0].toolActivity, 'testing');
      assert.ok(floor.analytics);
      assert.equal(floor.analytics.timeline60m.length, 12);
      assert.ok(snapshot.timeline60m && snapshot.timeline60m.length === 12);
      assert.ok(snapshot.modelBreakdown && snapshot.modelBreakdown.length > 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Renamed project display names & subagent/task messages/*.json board', () => {
  it('resolves renamed Antigravity project names from ../config/projects/*.json by project_id and folderUri fallback', () => {
    const rootTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plaza-proj-rename-'));
    const agyDir = path.join(rootTmp, 'antigravity');
    const projectsConfigDir = path.join(rootTmp, 'config', 'projects');
    fs.mkdirSync(agyDir, { recursive: true });
    fs.mkdirSync(projectsConfigDir, { recursive: true });

    try {
      fs.writeFileSync(
        path.join(projectsConfigDir, 'proj-1.json'),
        JSON.stringify({
          id: 'proj-1',
          name: 'Bursa Veriler',
          projectResources: {
            resources: [{ folderUri: 'file:///c%3A/Users/demo/Downloads/msgs%C3%BC' }],
          },
        }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(projectsConfigDir, 'proj-2.json'),
        JSON.stringify({
          id: 'proj-2',
          name: 'Izmir Analiz',
          projectResources: {
            resources: [{ folderUri: 'file:///c%3A/Users/demo/Work/izmir-raw' }],
          },
        }),
        'utf8',
      );

      const db = new DatabaseSync(path.join(agyDir, 'conversation_summaries.db'));
      db.exec(`
        CREATE TABLE conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          title TEXT,
          step_count INTEGER,
          last_modified_time TEXT,
          workspace_uris TEXT,
          status TEXT,
          project_id TEXT,
          not_fully_idle INTEGER,
          killed INTEGER
        );
      `);
      const nowIso = new Date().toISOString();
      const stmt = db.prepare(
        `INSERT INTO conversation_summaries (conversation_id, title, step_count, last_modified_time, workspace_uris, status, project_id, not_fully_idle, killed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      // Match by project_id
      stmt.run(
        'conv-bursa',
        'Session 1',
        12,
        nowIso,
        '["file:///c%3A/Users/demo/Downloads/msgs%C3%BC"]',
        'CASCADE_RUN_STATUS_RUNNING',
        'proj-1',
        1,
        0,
      );
      // Fallback match by folderUri when project_id doesn't match
      stmt.run(
        'conv-izmir',
        'Session 2',
        8,
        nowIso,
        '["file:///c%3A/Users/demo/Work/izmir-raw"]',
        'CASCADE_RUN_STATUS_RUNNING',
        'unknown-proj-id',
        1,
        0,
      );
      db.close();

      const snap = buildPlazaSnapshot(agyDir, '', false);
      const bursaFloor = snap.floors.find((f) =>
        f.workspacePath.toLowerCase().includes('msgsü'),
      );
      const izmirFloor = snap.floors.find((f) =>
        f.workspacePath.toLowerCase().includes('izmir-raw'),
      );

      assert.ok(bursaFloor);
      assert.equal(bursaFloor.companyName, 'Bursa Veriler');
      assert.ok(izmirFloor);
      assert.equal(izmirFloor.companyName, 'Izmir Analiz');
    } finally {
      fs.rmSync(rootTmp, { recursive: true, force: true });
    }
  });

  it('populates boardMessages and multi-word swarmEdges from subagents/*.json and messages/*.json', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plaza-subagent-board-'));
    try {
      const db = new DatabaseSync(path.join(tmpDir, 'conversation_summaries.db'));
      db.exec(`
        CREATE TABLE conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          title TEXT,
          step_count INTEGER,
          last_modified_time TEXT,
          workspace_uris TEXT,
          status TEXT,
          project_id TEXT,
          agent_name TEXT,
          parent_conversation_id TEXT,
          not_fully_idle INTEGER,
          killed INTEGER
        );
      `);
      const nowIso = new Date().toISOString();
      const stmt = db.prepare(
        `INSERT INTO conversation_summaries (conversation_id, title, step_count, last_modified_time, workspace_uris, status, project_id, agent_name, parent_conversation_id, not_fully_idle, killed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      stmt.run(
        'root-conv-1',
        'Main Coordinator',
        20,
        nowIso,
        '["file:///d%3A/Projects/Bursa"]',
        'CASCADE_RUN_STATUS_RUNNING',
        'proj-bursa',
        'coordinator',
        null,
        1,
        0,
      );
      stmt.run(
        'sub-conv-1',
        'Swarm Skill Reader',
        10,
        nowIso,
        '[]',
        'CASCADE_RUN_STATUS_RUNNING',
        'proj-bursa',
        'Swarm Skill Reader',
        'root-conv-1',
        1,
        0,
      );
      db.close();

      // Create .system_generated/subagents and messages (NO swarm/ folder)
      const subDir = path.join(tmpDir, 'brain', 'root-conv-1', '.system_generated', 'subagents');
      const rootMsgDir = path.join(tmpDir, 'brain', 'root-conv-1', '.system_generated', 'messages');
      const subMsgDir = path.join(tmpDir, 'brain', 'sub-conv-1', '.system_generated', 'messages');
      fs.mkdirSync(subDir, { recursive: true });
      fs.mkdirSync(rootMsgDir, { recursive: true });
      fs.mkdirSync(subMsgDir, { recursive: true });

      fs.writeFileSync(
        path.join(subDir, 'sub-conv-1.json'),
        JSON.stringify({
          conversationId: 'sub-conv-1',
          subagentDescriptor: { typeName: 'skill-reader', role: 'Swarm Skill Reader' },
          state: 'RUNNING',
          prompt: 'Read all swarm skill specs',
          createdAt: new Date(Date.now() - 10_000).toISOString(),
        }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(rootMsgDir, 'msg-1.json'),
        JSON.stringify({
          id: 'm1',
          sender: 'root-conv-1',
          recipient: 'sub-conv-1',
          timestamp: new Date(Date.now() - 5_000).toISOString(),
          renderDetails: { messageTitle: 'Analyze Skills' },
          content: 'Please inspect SKILL.md and report back.',
        }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(subMsgDir, 'msg-2.json'),
        JSON.stringify({
          id: 'm2',
          sender: 'sub-conv-1',
          recipient: 'root-conv-1',
          timestamp: nowIso,
          renderDetails: { messageTitle: 'Skill Report' },
          content: 'Found 3 skills ready for review.',
        }),
        'utf8',
      );
      // Should be skipped (system & read.json)
      fs.writeFileSync(path.join(rootMsgDir, 'read.json'), JSON.stringify({ lastRead: 1 }), 'utf8');
      fs.writeFileSync(
        path.join(rootMsgDir, 'sys.json'),
        JSON.stringify({ sender: 'system', content: '[swarm] new board message #5' }),
        'utf8',
      );

      const snap = buildPlazaSnapshot(tmpDir, '', false);
      const floor = snap.floors.find((f) => f.companyName === 'Bursa');
      assert.ok(floor);
      assert.ok(floor.boardMessages.length >= 2);
      assert.ok(
        floor.boardMessages.some(
          (m) => m.agent === 'coordinator' && m.text.includes('@Swarm Skill Reader'),
        ),
      );
      assert.ok(
        floor.boardMessages.some(
          (m) => m.agent === 'Swarm Skill Reader' && m.text.includes('@coordinator'),
        ),
      );
      assert.ok(floor.swarmEdges && floor.swarmEdges.length >= 2);
      assert.ok(
        floor.swarmEdges.some(
          (e) => e.from === 'coordinator' && e.to === 'Swarm Skill Reader',
        ),
      );
      assert.ok(
        floor.swarmEdges.some(
          (e) => e.from === 'Swarm Skill Reader' && e.to === 'coordinator',
        ),
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
