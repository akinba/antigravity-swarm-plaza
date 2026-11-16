import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createPlazaApp } from '../../src/server/index.js';
import { applyActivePromptOverrides } from '../../src/server/gamification.js';
import {
  InvalidDiffPathError,
  PromptRunner,
  parseGitNumstat,
  resolveSafeWorkspaceFile,
} from '../../src/server/promptRunner.js';
import type { OfficeEmployee, PlazaFloor, PromptStreamEvent } from '../../src/shared/types.js';

function createNdjsonStream(lines: string[], delayMs = 0): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const line of lines) {
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
}

function makeFloorWithAgents(): PlazaFloor[] {
  const makeEmp = (
    id: string,
    name: string,
    status: OfficeEmployee['status'],
  ): OfficeEmployee => ({
    id,
    name,
    roleTitle: 'Engineer',
    gender: 'male',
    modelId: 'gemini-4-hydrogen-medium',
    modelFamily: 'hydrogen',
    isCoordinator: false,
    workspaceMode: 'share',
    status,
    zone: 'COFFEE_LOUNGE',
    activity: 'lounging',
    speechBubble: 'resting',
    stepCount: 10,
    xp: 100,
    level: 2,
    inputTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    lastActiveAt: new Date().toISOString(),
  });

  return [
    {
      id: 'floor-1',
      floorNumber: 1,
      companyName: 'Swarm',
      workspacePath: 'd:/Antigravity/Swarm-Dasboard',
      tier: 2,
      companyXp: 200,
      nextTierXp: 500,
      ecoScore: 95,
      activeCount: 0,
      waitingCount: 1,
      totalConversations: 2,
      unlockedProps: [],
      employees: [
        makeEmp('demo-coder-core', 'coder-core', 'idle'),
        makeEmp('demo-coder-ui', 'coder-ui', 'waiting'),
      ],
      boardMessages: [],
      lastModifiedAt: new Date().toISOString(),
    },
  ];
}

describe('PromptRunner & standalone prompt endpoints', () => {
  it('streams Ollama NDJSON chunks, detects files, collects git diffs, and transitions agent working -> idle', async () => {
    const events: PromptStreamEvent[] = [];
    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      fetchImpl: async () =>
        new Response(
          createNdjsonStream([
            JSON.stringify({ message: { content: 'Inspecting ' } }),
            JSON.stringify({ message: { content: 'src/server/index.ts now.' } }),
            JSON.stringify({ done: true }),
          ]),
          { status: 200 },
        ),
      execFileImpl: async (_cmd, args) => {
        if (args[0] === 'diff') {
          return { stdout: '12\t3\tsrc/server/index.ts\n', stderr: '' };
        }
        return { stdout: '', stderr: '' };
      },
    });
    runner.subscribe((ev) => events.push(ev));

    const { runId } = runner.startPrompt({
      prompt: 'Update server routes',
      model: 'qwen2.5-coder:14b',
      mode: 'turbo',
      mentions: ['coder-core'],
    });

    assert.ok(runId.startsWith('run-'));
    const floorsDuring = makeFloorWithAgents();
    applyActivePromptOverrides(floorsDuring, runner.getActiveOverrides());
    assert.equal(floorsDuring[0].employees[0].status, 'working');
    assert.equal(floorsDuring[0].employees[0].zone, 'DESK_CODING');
    assert.equal(floorsDuring[0].activeCount, 1);

    await runner.waitForIdle();

    assert.equal(runner.getState().status, 'idle');
    assert.ok(events.some((e) => e.type === 'chunk' && e.text?.includes('Inspecting')));
    assert.ok(events.some((e) => e.type === 'file' && e.file === 'src/server/index.ts'));
    assert.ok(
      events.some(
        (e) =>
          e.type === 'diff' &&
          e.diffs?.[0]?.path === 'src/server/index.ts' &&
          e.diffs[0].added === 12 &&
          e.diffs[0].removed === 3,
      ),
    );
    assert.equal(events[events.length - 1]?.type, 'done');

    const floorsAfter = makeFloorWithAgents();
    applyActivePromptOverrides(floorsAfter, runner.getActiveOverrides());
    assert.equal(floorsAfter[0].employees[0].status, 'idle');
    assert.equal(floorsAfter[0].activeCount, 0);
  });

  it('handles Ollama offline gracefully with a clear error event', async () => {
    const events: PromptStreamEvent[] = [];
    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
      },
    });
    runner.subscribe((ev) => events.push(ev));

    runner.startPrompt({
      prompt: 'Check status',
      model: 'qwen2.5-coder:14b',
      mode: 'safe',
      mentions: [],
    });

    await runner.waitForIdle();
    const state = runner.getState();
    assert.equal(state.status, 'error');
    const errEvent = events.find((e) => e.type === 'error');
    assert.ok(errEvent);
    assert.match(errEvent.text ?? '', /OLLAMA OFFLINE/);
  });

  it('supports acceptDiff, rejectDiff, and rejects path traversal attempts', async () => {
    const gitCalls: string[][] = [];
    const workspace = path.resolve(process.cwd());
    const runner = new PromptRunner({
      defaultWorkspace: workspace,
      execFileImpl: async (_cmd, args) => {
        gitCalls.push(args);
        return { stdout: '', stderr: '' };
      },
    });

    const accepted = await runner.acceptDiff('src/server/index.ts');
    assert.equal(accepted[0]?.status, 'accepted');

    const rejected = await runner.rejectDiff('src/server/index.ts');
    assert.equal(rejected[0]?.status, 'rejected');
    assert.deepEqual(gitCalls[0], ['checkout', '--', 'src/server/index.ts']);

    assert.throws(() => resolveSafeWorkspaceFile(workspace, '../outside.txt'), InvalidDiffPathError);
    assert.throws(() => resolveSafeWorkspaceFile(workspace, 'a/../../secret.txt'), InvalidDiffPathError);
    assert.throws(() => resolveSafeWorkspaceFile(workspace, 'src/ok.ts\0bad'), InvalidDiffPathError);
    await assert.rejects(() => runner.rejectDiff('../outside.txt'), InvalidDiffPathError);

    assert.deepEqual(parseGitNumstat('5\t2\tsrc/a.ts\n-\t-\tassets/logo.png\n'), [
      { path: 'src/a.ts', added: 5, removed: 2, status: 'pending' },
      { path: 'assets/logo.png', added: 0, removed: 0, status: 'pending' },
    ]);
  });

  it('exposes POST /api/prompt, 409 conflict, POST /api/prompt/stop, GET /api/prompt/state, GET /api/stream, and POST /api/diff/decision', async () => {
    const gitCalls: string[][] = [];
    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      fetchImpl: async (_url, init) => {
        const signal = init?.signal as AbortSignal | undefined;
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              const enc = new TextEncoder();
              controller.enqueue(
                enc.encode(`${JSON.stringify({ message: { content: 'Working on src/server/gamification.ts' } })}\n`),
              );
              const timer = setTimeout(() => {
                try {
                  controller.close();
                } catch {
                  // Ignore
                }
              }, 4000);
              signal?.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  try {
                    controller.close();
                  } catch {
                    // Ignore
                  }
                },
                { once: true },
              );
            },
          }),
          { status: 200 },
        );
      },
      execFileImpl: async (_cmd, args) => {
        gitCalls.push(args);
        return { stdout: '', stderr: '' };
      },
    });

    const instance = createPlazaApp({
      agyDataDir: path.join(os.tmpdir(), 'nonexistent-agy-test-dir'),
      initialDemoMode: true,
      broadcastIntervalMs: 0,
      promptRunner: runner,
    });

    await new Promise<void>((resolve) => {
      instance.server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = instance.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // Connect SSE stream
      const sseChunks: string[] = [];
      const sseReq = http.get(`${baseUrl}/api/stream`, (res) => {
        res.on('data', (buf: Buffer) => {
          sseChunks.push(buf.toString());
        });
      });

      await new Promise((r) => setTimeout(r, 40));

      const startRes = await fetch(`${baseUrl}/api/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Refactor gamification',
          model: 'qwen2.5-coder:14b',
          mode: 'turbo',
          mentions: ['coder-core'],
        }),
      });
      assert.equal(startRes.status, 200);
      const startJson = (await startRes.json()) as { ok: boolean; runId: string };
      assert.equal(startJson.ok, true);
      assert.ok(startJson.runId);

      // Second prompt while running -> 409 Conflict
      const conflictRes = await fetch(`${baseUrl}/api/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Second prompt',
          model: 'qwen2.5-coder:14b',
          mode: 'turbo',
          mentions: [],
        }),
      });
      assert.equal(conflictRes.status, 409);

      await new Promise((r) => setTimeout(r, 50));

      const plazaRes = await fetch(`${baseUrl}/api/plaza`);
      const plazaJson = (await plazaRes.json()) as { floors: PlazaFloor[] };
      const demoFloor = plazaJson.floors.find((f) => f.isDemo);
      const coderCore = demoFloor?.employees.find((e) => e.name === 'coder-core');
      assert.equal(coderCore?.status, 'working');

      const stopRes = await fetch(`${baseUrl}/api/prompt/stop`, { method: 'POST' });
      assert.equal(stopRes.status, 200);

      const stateRes = await fetch(`${baseUrl}/api/prompt/state`);
      const stateJson = (await stateRes.json()) as { status: string; activeAgents: unknown[] };
      assert.equal(stateJson.status, 'stopped');
      assert.equal(stateJson.activeAgents.length, 0);

      const badDiffRes = await fetch(`${baseUrl}/api/diff/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '../../etc/passwd', decision: 'reject' }),
      });
      assert.equal(badDiffRes.status, 400);

      const okDiffRes = await fetch(`${baseUrl}/api/diff/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'src/server/gamification.ts', decision: 'reject' }),
      });
      assert.equal(okDiffRes.status, 200);
      assert.ok(gitCalls.some((c) => c[0] === 'checkout' && c[2] === 'src/server/gamification.ts'));

      const joinedSse = sseChunks.join('');
      assert.ok(joinedSse.includes('data: '));
      assert.ok(joinedSse.includes(startJson.runId));

      sseReq.destroy();
    } finally {
      await instance.close();
    }
  });

  it('streams dynamic ollama:<model> models stripping prefix and using custom ollamaBaseUrl', async () => {
    let capturedUrl = '';
    let capturedModel = '';
    const events: PromptStreamEvent[] = [];

    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
        capturedModel = body.model ?? '';
        return new Response(
          createNdjsonStream([
            JSON.stringify({ message: { content: 'Hello from deepseek' } }),
            JSON.stringify({ done: true }),
          ]),
          { status: 200 },
        );
      },
    });
    runner.subscribe((ev) => events.push(ev));

    runner.startPrompt({
      prompt: 'Explain architecture',
      model: 'ollama:deepseek-r1:14b',
      provider: 'ollama',
      ollamaBaseUrl: 'http://127.0.0.1:11434/',
      mode: 'eco-swarm',
      mentions: ['local-deepseek'],
    });

    await runner.waitForIdle();
    assert.equal(capturedUrl, 'http://127.0.0.1:11434/api/chat');
    assert.equal(capturedModel, 'deepseek-r1:14b');
    assert.ok(events.some((e) => e.type === 'chunk' && e.text?.includes('Hello from deepseek')));
    assert.equal(runner.getState().status, 'idle');
  });

  it('exposes GET /api/ollama/models for tag discovery, offline fallback, and SSRF protection', async () => {
    let offline = false;
    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      fetchImpl: async (url) => {
        if (offline) {
          throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
        }
        assert.equal(String(url), 'http://localhost:11434/api/tags');
        return new Response(
          JSON.stringify({
            models: [
              { name: 'llama3.2', size: 2048, modified_at: '2026-11-16T00:00:00Z' },
              { name: 'deepseek-r1:14b', size: 9000 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });

    const instance = createPlazaApp({
      agyDataDir: path.join(os.tmpdir(), 'nonexistent-agy-test-dir'),
      initialDemoMode: true,
      broadcastIntervalMs: 0,
      promptRunner: runner,
    });

    await new Promise<void>((resolve) => {
      instance.server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = instance.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const okRes = await fetch(
        `${baseUrl}/api/ollama/models?baseUrl=${encodeURIComponent('http://localhost:11434')}`,
      );
      assert.equal(okRes.status, 200);
      const okJson = (await okRes.json()) as {
        ok: boolean;
        models: Array<{ name: string; size?: number; modifiedAt?: string }>;
      };
      assert.equal(okJson.ok, true);
      assert.deepEqual(
        okJson.models.map((m) => m.name),
        ['llama3.2', 'deepseek-r1:14b'],
      );

      offline = true;
      const offRes = await fetch(`${baseUrl}/api/ollama/models`);
      assert.equal(offRes.status, 200);
      const offJson = (await offRes.json()) as { ok: boolean; models: unknown[]; error?: string };
      assert.equal(offJson.ok, false);
      assert.deepEqual(offJson.models, []);
      assert.match(offJson.error ?? '', /unreachable/i);

      const ssrfRes = await fetch(
        `${baseUrl}/api/ollama/models?baseUrl=${encodeURIComponent('https://evil.example.com')}`,
      );
      assert.equal(ssrfRes.status, 400);
      const ssrfJson = (await ssrfRes.json()) as { ok: boolean; error?: string };
      assert.equal(ssrfJson.ok, false);
      assert.match(ssrfJson.error ?? '', /Disallowed external host/i);
    } finally {
      await instance.close();
    }
  });

  it('distinguishes single vs swarm orchestration and returns clean [CLI/API NOT CONFIGURED] or falls back to Gemini REST SSE', async () => {
    // 1. Missing CLI and no API key -> clean [CLI/API NOT CONFIGURED] message
    const noConfigEvents: PromptStreamEvent[] = [];
    const noConfigRunner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      resolveCliCommand: async () => null,
      geminiApiKey: '',
    });
    noConfigRunner.subscribe((ev) => noConfigEvents.push(ev));

    noConfigRunner.startPrompt({
      prompt: 'Analyze repo',
      model: 'gemini-4-hydrogen-medium',
      mode: 'turbo',
      orchestration: 'single',
      mentions: [],
    });
    await noConfigRunner.waitForIdle();

    assert.ok(noConfigEvents.some((e) => e.type === 'status' && e.text?.includes('[SINGLE]')));
    const errEv = noConfigEvents.find((e) => e.type === 'error');
    assert.ok(errEv);
    assert.match(errEv.text ?? '', /\[CLI\/API NOT CONFIGURED\]/);

    // 2. Missing CLI + geminiApiKey present -> Gemini REST SSE fallback + [SWARM MODE]
    const sseEvents: PromptStreamEvent[] = [];
    let restUrl = '';
    const restRunner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      resolveCliCommand: async () => null,
      geminiApiKey: 'test-gemini-key',
      fetchImpl: async (url) => {
        restUrl = String(url);
        return new Response(
          createNdjsonStream([
            `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini REST ok' }] } }] })}`,
            'data: [DONE]',
          ]),
          { status: 200 },
        );
      },
    });
    restRunner.subscribe((ev) => sseEvents.push(ev));

    restRunner.startPrompt({
      prompt: 'Run swarm task',
      model: 'gemini-3.8-flash-fast',
      mode: 'turbo',
      orchestration: 'swarm',
      mentions: ['coordinator'],
    });
    await restRunner.waitForIdle();

    assert.match(restUrl, /generativelanguage\.googleapis\.com.*gemini-2\.5-flash:streamGenerateContent\?alt=sse/);
    assert.ok(sseEvents.some((e) => e.type === 'status' && e.text?.includes('[SWARM MODE]')));
    assert.ok(sseEvents.some((e) => e.type === 'chunk' && e.text?.includes('Gemini REST ok')));
    assert.equal(restRunner.getState().status, 'idle');
  });
});
