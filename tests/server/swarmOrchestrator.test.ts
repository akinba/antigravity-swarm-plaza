import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type {
  ApprovalRequestPayload,
  PromptProvider,
  PromptStreamEvent,
} from '../../src/shared/types.js';
import type {
  AgentTurnParams,
  AgentTurnResult,
  UnifiedProviderAdapter,
} from '../../src/server/providers/providerAdapter.js';
import {
  FileLockManager,
  SwarmBoard,
} from '../../src/server/swarm/swarmBoard.js';
import {
  SwarmOrchestrator,
  resolveSwarmModelProvider,
} from '../../src/server/swarm/swarmOrchestrator.js';
import {
  ApprovalGate,
  WORKSPACE_TOOL_DEFINITIONS,
  WorkspacePathTraversalError,
  WorkspaceToolExecutor,
  isDangerousCommand,
  resolveSafeWorkspacePath,
} from '../../src/server/swarm/workspaceTools.js';

function createMockAdapter(
  provider: PromptProvider,
  handler: (params: AgentTurnParams) => Promise<AgentTurnResult> | AgentTurnResult,
): UnifiedProviderAdapter {
  return {
    provider,
    async listModels() {
      return { ok: true, models: [] };
    },
    async runTurn(params: AgentTurnParams) {
      return await handler(params);
    },
  };
}

describe('SwarmBoard & FileLockManager', () => {
  it('enforces file locks and task file ownership rules', () => {
    const locks = new FileLockManager();

    assert.equal(locks.acquire('src/server/a.ts', 'coder-core'), true);
    // Same role can re-acquire
    assert.equal(locks.acquire('./src/server/a.ts', 'Coder Core'), true);
    // Another role is blocked
    assert.equal(locks.acquire('src/server/a.ts', 'coder-ui'), false);
    assert.equal(
      locks.checkOwnership('src/server/a.ts', 'coder-ui', ['src/server/a.ts']),
      false,
    );

    // Ownership list check
    assert.equal(
      locks.checkOwnership('src/client/App.tsx', 'coder-ui', ['src/client/**']),
      true,
    );
    assert.equal(
      locks.checkOwnership('src/server/index.ts', 'coder-ui', ['src/client/**']),
      false,
    );

    // Release by wrong owner fails
    assert.equal(locks.release('src/server/a.ts', 'coder-ui'), false);
    // Release by owner succeeds
    assert.equal(locks.release('src/server/a.ts', 'coder-core'), true);
    assert.equal(locks.acquire('src/server/a.ts', 'coder-ui'), true);

    assert.equal(locks.releaseAll('coder-ui'), 1);
    assert.equal(locks.getLockOwner('src/server/a.ts'), undefined);
  });

  it('tracks inter-agent messages, @mention edges, and DAG tasks on SwarmBoard', () => {
    const board = new SwarmBoard();
    board.setTasks([
      {
        id: 't1',
        role: 'Coder Core',
        title: 'Build API adapter',
        ownedFiles: ['src/api.ts'],
        dependsOn: [],
      },
      {
        id: 't2',
        role: 'Coder UI',
        title: 'Build UI view',
        ownedFiles: ['src/view.tsx'],
        dependsOn: ['t1'],
      },
    ]);

    const m1 = board.postMessage({
      from: 'coordinator',
      to: 'coder-core',
      text: 'Start working on @coder-core API module',
      artifacts: ['src/api.ts'],
    });
    const m2 = board.postMessage({
      from: 'coder-core',
      to: 'coder-ui',
      text: 'API ready for @coder-ui integration',
    });

    assert.equal(m1.seq, 1);
    assert.equal(m2.seq, 2);
    assert.equal(board.readMessages().length, 2);
    assert.equal(board.readMessages(1).length, 1);
    assert.equal(board.readMessages(1)[0].agent, 'coder-core');

    board.updateTaskStatus('t1', 'completed', { verifiedKeyword: 'DONE' });
    const snapshot = board.toWhiteboardSnapshot();

    assert.equal(snapshot.messages.length, 2);
    assert.equal(snapshot.taskNodes.length, 2);
    assert.equal(snapshot.taskNodes[0].status, 'completed');
    assert.equal(snapshot.edges.length, 2);
    assert.deepEqual(
      snapshot.edges.map((e) => `${e.from}->${e.to}`),
      ['coordinator->coder-core', 'coder-core->coder-ui'],
    );
    assert.ok(board.getCompactSummary().includes('Build API adapter'));
  });
});

describe('WorkspaceToolExecutor & ApprovalGate', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swarm-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('exposes all 8 workspace tool schemas and blocks path traversal & dangerous commands', async () => {
    assert.equal(WORKSPACE_TOOL_DEFINITIONS.length, 8);
    const names = WORKSPACE_TOOL_DEFINITIONS.map((t) => t.name);
    assert.deepEqual(names, [
      'list_dir',
      'read_file',
      'search_files',
      'write_file',
      'edit_file',
      'run_command',
      'post_board',
      'read_board',
    ]);

    assert.throws(
      () => resolveSafeWorkspacePath(tmpDir, '../../etc/passwd'),
      WorkspacePathTraversalError,
    );

    assert.equal(isDangerousCommand('rm -rf /'), true);
    assert.equal(isDangerousCommand('del /s /q C:\\Windows'), true);
    assert.equal(isDangerousCommand('format c:'), true);
    assert.equal(isDangerousCommand('shutdown /s /t 0'), true);
    assert.equal(isDangerousCommand('npm test'), false);

    const board = new SwarmBoard();
    const lockManager = new FileLockManager();
    const executor = new WorkspaceToolExecutor({
      workspaceRoot: tmpDir,
      mode: 'turbo',
      board,
      lockManager,
    });

    const dangerousRes = await executor.executeTool('coder-core', undefined, {
      id: 'cmd-1',
      name: 'run_command',
      args: { command: 'rm -rf /' },
    });
    assert.equal(dangerousRes.ok, false);
    assert.match(dangerousRes.output, /SECURITY BLOCK/);

    const traversalRes = await executor.executeTool('coder-core', undefined, {
      id: 'write-escape',
      name: 'write_file',
      args: { path: '../outside.txt', content: 'hack' },
    });
    assert.equal(traversalRes.ok, false);
    assert.match(traversalRes.output, /Path traversal blocked/);
  });

  it('prevents concurrent file writes across agents via FileLockManager', async () => {
    const board = new SwarmBoard();
    const lockManager = new FileLockManager();
    const executor = new WorkspaceToolExecutor({
      workspaceRoot: tmpDir,
      mode: 'turbo',
      board,
      lockManager,
    });

    // coder-core writes src/shared.ts and holds lock
    const write1 = await executor.executeTool('coder-core', ['src/shared.ts'], {
      id: 'w1',
      name: 'write_file',
      args: { path: 'src/shared.ts', content: 'export const v = 1;\n' },
    });
    assert.equal(write1.ok, true);

    // coder-ui tries to write the same locked file
    const write2 = await executor.executeTool('coder-ui', ['src/shared.ts'], {
      id: 'w2',
      name: 'write_file',
      args: { path: 'src/shared.ts', content: 'export const v = 2;\n' },
    });
    assert.equal(write2.ok, false);
    assert.match(write2.output, /FILE LOCK/);

    // coder-ui tries to write a file outside its ownedFiles
    const write3 = await executor.executeTool('coder-ui', ['src/client/**'], {
      id: 'w3',
      name: 'write_file',
      args: { path: 'src/server/secret.ts', content: 'export const s = 1;\n' },
    });
    assert.equal(write3.ok, false);
    assert.match(write3.output, /does not own/);
  });

  it('supports Safe mode ApprovalGate (allow_once, allow_session, deny)', async () => {
    const pendingRequests: ApprovalRequestPayload[] = [];
    const decisionsQueue: Array<'deny' | 'allow_once' | 'allow_session'> = [
      'deny',
      'allow_once',
      'allow_session',
    ];
    const gate = new ApprovalGate({
      onApprovalRequest: (req) => {
        pendingRequests.push(req);
        const decision = decisionsQueue.shift() ?? 'deny';
        setImmediate(() => {
          gate.resolveApproval(req.approvalId, decision);
        });
      },
    });
    const board = new SwarmBoard();
    const lockManager = new FileLockManager();
    const executor = new WorkspaceToolExecutor({
      workspaceRoot: tmpDir,
      mode: 'safe',
      board,
      lockManager,
      approvalGate: gate,
    });

    // 1) deny write_file
    const denyRes = await executor.executeTool('coder-core', ['a.txt'], {
      id: 'c1',
      name: 'write_file',
      args: { path: 'a.txt', content: 'denied content' },
    });
    assert.equal(pendingRequests.length, 1);
    assert.equal(denyRes.ok, false);
    assert.match(denyRes.output, /APPROVAL DENIED/);

    // 2) allow_once write_file
    const allowOnceRes = await executor.executeTool('coder-core', ['a.txt'], {
      id: 'c2',
      name: 'write_file',
      args: { path: 'a.txt', content: 'hello world' },
    });
    assert.equal(pendingRequests.length, 2);
    assert.equal(allowOnceRes.ok, true);

    // 3) allow_session on edit_file -> second edit_file should not prompt again!
    const edit1Res = await executor.executeTool('coder-core', ['a.txt'], {
      id: 'c3',
      name: 'edit_file',
      args: { path: 'a.txt', target: 'hello', replacement: 'hi' },
    });
    assert.equal(pendingRequests.length, 3);
    assert.equal(edit1Res.ok, true);

    // Second edit_file executes immediately without adding to pendingRequests
    const edit2Res = await executor.executeTool('coder-core', ['a.txt'], {
      id: 'c4',
      name: 'edit_file',
      args: { path: 'a.txt', target: 'world', replacement: 'swarm' },
    });
    assert.equal(edit2Res.ok, true);
    assert.equal(pendingRequests.length, 3);

    const finalContent = await fs.readFile(path.join(tmpDir, 'a.txt'), 'utf8');
    assert.equal(finalContent, 'hi swarm');
  });
});

describe('SwarmOrchestrator multi-provider DAG, parallel waves & 2-round Self-Healing', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swarm-orch-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'src', 'core.ts'), 'export const x = 1;\n', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src', 'ui.tsx'), 'export const ui = "v1";\n', 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('resolves flexible provider:model assignments across cloud and local providers', () => {
    assert.deepEqual(resolveSwarmModelProvider('copilot:claude-sonnet-4'), {
      provider: 'copilot',
      modelId: 'claude-sonnet-4',
    });
    assert.deepEqual(resolveSwarmModelProvider('ollama:qwen2.5-coder:14b'), {
      provider: 'ollama',
      modelId: 'qwen2.5-coder:14b',
    });
    assert.deepEqual(resolveSwarmModelProvider('deepseek:deepseek-coder'), {
      provider: 'deepseek',
      modelId: 'deepseek-coder',
    });
    assert.deepEqual(resolveSwarmModelProvider('groq:llama-3.3-70b'), {
      provider: 'groq',
      modelId: 'llama-3.3-70b',
    });
  });

  it('plans a DAG, runs independent tasks in parallel across providers, exchanges board messages, and releases locks', async () => {
    const activeConcurrency = { current: 0, maxObserved: 0 };
    const invokedProviders: string[] = [];
    const stateChanges: Array<{ agentKey: string; state: string }> = [];

    // Architect on Gemini plans two parallel tasks (t1: Coder Core, t2: Coder UI)
    const geminiAdapter = createMockAdapter('gemini', async (params) => {
      invokedProviders.push(`gemini:${params.model}`);
      return {
        text: JSON.stringify({
          tasks: [
            {
              id: 't1',
              role: 'Coder Core',
              title: 'Update core.ts and post to board',
              ownedFiles: ['src/core.ts'],
              dependsOn: [],
            },
            {
              id: 't2',
              role: 'Coder UI',
              title: 'Update ui.tsx and read board',
              ownedFiles: ['src/ui.tsx'],
              dependsOn: [],
            },
          ],
        }),
        toolCalls: [],
        finishReason: 'stop',
      };
    });

    let coreTurn = 0;
    const copilotAdapter = createMockAdapter('copilot', async (params) => {
      invokedProviders.push(`copilot:${params.model}`);
      activeConcurrency.current += 1;
      activeConcurrency.maxObserved = Math.max(
        activeConcurrency.maxObserved,
        activeConcurrency.current,
      );
      await new Promise((r) => setTimeout(r, 35));
      activeConcurrency.current -= 1;

      coreTurn += 1;
      if (coreTurn === 1) {
        return {
          text: 'Editing core.ts and posting board message',
          toolCalls: [
            {
              id: 'tc-core-1',
              name: 'edit_file',
              args: {
                path: 'src/core.ts',
                target: 'export const x = 1;',
                replacement: 'export const x = 42;',
              },
            },
            {
              id: 'tc-core-2',
              name: 'post_board',
              args: {
                to: 'coder-ui',
                text: 'Core updated x to 42',
                artifacts: ['src/core.ts'],
              },
            },
          ],
          finishReason: 'tool_calls',
        };
      }
      return {
        text: 'Coder Core finished.',
        toolCalls: [],
        finishReason: 'stop',
      };
    });

    let uiTurn = 0;
    const ollamaAdapter = createMockAdapter('ollama', async (params) => {
      invokedProviders.push(`ollama:${params.model}`);
      activeConcurrency.current += 1;
      activeConcurrency.maxObserved = Math.max(
        activeConcurrency.maxObserved,
        activeConcurrency.current,
      );
      await new Promise((r) => setTimeout(r, 35));
      activeConcurrency.current -= 1;

      uiTurn += 1;
      if (uiTurn === 1) {
        return {
          text: 'Updating ui.tsx and checking board',
          toolCalls: [
            {
              id: 'tc-ui-1',
              name: 'edit_file',
              args: {
                path: 'src/ui.tsx',
                target: 'export const ui = "v1";',
                replacement: 'export const ui = "v2";',
              },
            },
            {
              id: 'tc-ui-2',
              name: 'read_board',
              args: {},
            },
          ],
          finishReason: 'tool_calls',
        };
      }
      return {
        text: 'Coder UI finished.',
        toolCalls: [],
        finishReason: 'stop',
      };
    });

    const lockManager = new FileLockManager();
    const orchestrator = new SwarmOrchestrator({
      adapters: {
        gemini: geminiAdapter,
        copilot: copilotAdapter,
        ollama: ollamaAdapter,
      },
      defaultWorkspace: tmpDir,
    });

    const events: PromptStreamEvent[] = [];
    const result = await orchestrator.run({
      runId: 'run-dag-1',
      prompt: 'Update core and ui in parallel',
      mode: 'turbo',
      orchestratorModel: 'gemini:gemini-2.5-pro',
      swarmProfile: [
        { role: 'Architect', model: 'gemini:gemini-2.5-pro', level: 'high' },
        { role: 'Coder Core', model: 'copilot:gpt-4o', level: 'high' },
        { role: 'Coder UI', model: 'ollama:qwen2.5-coder:14b', level: 'medium' },
      ],
      lockManager,
      onEvent: (ev) => events.push(ev),
      onAgentStateChange: (agentKey, state) => {
        stateChanges.push({ agentKey, state });
      },
    });

    // Both independent tasks ran concurrently via Promise.all
    assert.equal(activeConcurrency.maxObserved, 2);
    assert.equal(result.verified, true);
    assert.equal(result.tasks.length, 2);

    // Files were modified on disk
    const coreText = await fs.readFile(path.join(tmpDir, 'src', 'core.ts'), 'utf8');
    const uiText = await fs.readFile(path.join(tmpDir, 'src', 'ui.tsx'), 'utf8');
    assert.match(coreText, /42/);
    assert.match(uiText, /v2/);

    // Board captured messages & edges
    assert.ok(
      result.whiteboard.messages.some((m) => m.text.includes('Core updated x to 42')),
    );
    assert.ok(events.some((e) => e.type === 'tool_call'));
    assert.ok(events.some((e) => e.type === 'board'));

    // All locks cleaned up in Stage 4
    assert.deepEqual(lockManager.getActiveLocks(), {});
    assert.ok(
      stateChanges.some((s) => s.agentKey === 'coder-core' && s.state === 'idle'),
    );
  });

  it('executes 2-round Verifier Self-Healing loop when build/tests fail initially', async () => {
    let verifierRunCount = 0;
    let coderHealCount = 0;

    const adapter = createMockAdapter('gemini', async (params) => {
      const sys = params.messages[0]?.content ?? '';

      // Stage 0 Architect
      if (sys.includes('Swarm Architect')) {
        return {
          text: JSON.stringify({
            tasks: [
              {
                id: 't-core',
                role: 'Coder Core',
                title: 'Implement core feature',
                ownedFiles: ['src/core.ts'],
                dependsOn: [],
              },
            ],
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }

      // Verifier role: fails first 2 times, passes on 3rd verification (after 2 self-healing rounds)
      if (sys.includes('You are Verifier')) {
        const hasToolResult = params.messages.some((m) => m.role === 'tool');
        if (!hasToolResult) {
          verifierRunCount += 1;
          return {
            text: `Verifier attempt #${verifierRunCount}`,
            toolCalls: [
              {
                id: `verify-cmd-${verifierRunCount}`,
                name: 'run_command',
                args: { command: 'npm test' },
              },
            ],
            finishReason: 'tool_calls',
          };
        }

        if (verifierRunCount <= 2) {
          return {
            text: `[FAIL] @coder-core Type error in src/core.ts on attempt ${verifierRunCount}`,
            toolCalls: [],
            finishReason: 'stop',
          };
        }
        return {
          text: '[PASS] All tests passing!',
          toolCalls: [],
          finishReason: 'stop',
        };
      }

      // Coder Core role (initial + 2 healing rounds)
      const userMsg = params.messages[1]?.content ?? '';
      if (userMsg.includes('SELF-HEALING ROUND')) {
        coderHealCount += 1;
      }
      return {
        text: `Coder Core completed turn (healCount=${coderHealCount})`,
        toolCalls: [],
        finishReason: 'stop',
      };
    });

    let cmdCalls = 0;
    const orchestrator = new SwarmOrchestrator({
      adapters: { gemini: adapter },
      defaultWorkspace: tmpDir,
      maxHealingRounds: 2,
      commandRunner: async () => {
        cmdCalls += 1;
        // Fail first 2 verification command runs, succeed on 3rd
        if (cmdCalls <= 2) {
          return { exitCode: 1, stdout: '', stderr: `Test failed on run #${cmdCalls}` };
        }
        return { exitCode: 0, stdout: 'PASS', stderr: '' };
      },
    });

    const result = await orchestrator.run({
      runId: 'run-heal-2',
      prompt: 'Implement and verify feature',
      mode: 'turbo',
      swarmProfile: [
        { role: 'Architect', model: 'gemini:gemini-2.5-pro', level: 'high' },
        { role: 'Coder Core', model: 'gemini:gemini-2.5-flash', level: 'medium' },
        { role: 'Verifier', model: 'gemini:gemini-2.5-flash', level: 'medium' },
      ],
    });

    assert.equal(result.healingRoundsUsed, 2);
    assert.equal(coderHealCount, 2);
    assert.equal(verifierRunCount, 3);
    assert.equal(result.verified, true);
    assert.ok(
      result.whiteboard.messages.some((m) => m.text.includes('[SELF-HEAL ROUND 1]')),
    );
    assert.ok(
      result.whiteboard.messages.some((m) => m.text.includes('[SELF-HEAL ROUND 2]')),
    );
  });
});
