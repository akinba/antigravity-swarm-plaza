import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createPlazaApp } from '../../src/server/index.js';
import {
  CopilotSdkAdapter,
  isCopilotAuthError,
  type CopilotSdkAdapterLike,
} from '../../src/server/copilotSdkAdapter.js';
import { applyActivePromptOverrides } from '../../src/server/gamification.js';
import {
  InvalidDiffPathError,
  PromptRunner,
  mapGeminiRestModel,
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

  it('manages Gemini API key via GET/POST /api/settings/gemini-key with masking, persistence, clearing, and REST model mapping', async () => {
    assert.equal(mapGeminiRestModel('gemini-4-carbon-medium'), 'gemini-2.5-pro');
    assert.equal(mapGeminiRestModel('gemini-4-argon-medium'), 'gemini-2.5-flash');
    assert.equal(mapGeminiRestModel('gemini-4-hydrogen-medium'), 'gemini-2.5-flash');
    assert.equal(mapGeminiRestModel('gemini-3.8-flash-fast'), 'gemini-2.5-flash');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-secrets-'));
    const secretsFilePath = path.join(tempDir, 'swarm-plaza-secrets.json');
    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      secretsFilePath,
      geminiApiKey: '',
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
      const initRes = await fetch(`${baseUrl}/api/settings/gemini-key`);
      assert.equal(initRes.status, 200);
      const initJson = (await initRes.json()) as {
        configured: boolean;
        masked: string;
        source: string;
      };
      assert.equal(initJson.configured, false);
      assert.equal(initJson.masked, '');
      assert.equal(initJson.source, 'none');

      const rawKey = 'AIzaSyTestSecretKey1234567890';
      const saveRes = await fetch(`${baseUrl}/api/settings/gemini-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: rawKey }),
      });
      assert.equal(saveRes.status, 200);
      const saveJson = (await saveRes.json()) as {
        ok: boolean;
        configured: boolean;
        masked: string;
        source: string;
      };
      assert.equal(saveJson.ok, true);
      assert.equal(saveJson.configured, true);
      assert.equal(saveJson.masked, 'AIza...7890');
      assert.equal(saveJson.source, 'settings');
      assert.ok(!JSON.stringify(saveJson).includes(rawKey));

      // Persisted on disk and loaded by a fresh PromptRunner instance
      const reloaded = new PromptRunner({
        defaultWorkspace: process.cwd(),
        secretsFilePath,
      });
      assert.equal(reloaded.getGeminiApiKeyStatus().configured, true);
      assert.equal(reloaded.getGeminiApiKeyStatus().masked, 'AIza...7890');
      assert.equal(reloaded.getGeminiApiKeyStatus().source, 'settings');

      const clearRes = await fetch(`${baseUrl}/api/settings/gemini-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: '' }),
      });
      assert.equal(clearRes.status, 200);
      const clearJson = (await clearRes.json()) as {
        ok: boolean;
        configured: boolean;
        masked: string;
      };
      assert.equal(clearJson.ok, true);
      assert.equal(clearJson.configured, false);
      assert.equal(clearJson.masked, '');
    } finally {
      await instance.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('exposes GET /api/gemini/models filtering generateContent models and logs swarmProfile in [SWARM MODE]', async () => {
    const noKeyRunner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      geminiApiKey: '',
    });
    const noKeyRes = await noKeyRunner.fetchGeminiModels();
    assert.equal(noKeyRes.ok, false);
    assert.deepEqual(noKeyRes.models, []);
    assert.equal(noKeyRes.error, 'Gemini API key is not configured.');

    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      geminiApiKey: 'AIzaSyTestKey1234',
      resolveCliCommand: async () => null,
      fetchImpl: async (url) => {
        const u = String(url);
        if (u.includes('/v1beta/models?key=')) {
          return new Response(
            JSON.stringify({
              models: [
                {
                  name: 'models/gemini-2.5-flash',
                  displayName: 'Gemini 2.5 Flash',
                  supportedGenerationMethods: ['generateContent', 'countTokens'],
                },
                {
                  name: 'models/embedding-001',
                  displayName: 'Embedding 001',
                  supportedGenerationMethods: ['embedContent'],
                },
                {
                  name: 'models/gemini-2.5-pro',
                  displayName: 'Gemini 2.5 Pro',
                  supportedGenerationMethods: ['generateContent'],
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          createNdjsonStream([
            `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Swarm done' }] } }] })}`,
            'data: [DONE]',
          ]),
          { status: 200 },
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
      const modelsRes = await fetch(`${baseUrl}/api/gemini/models`);
      assert.equal(modelsRes.status, 200);
      const modelsJson = (await modelsRes.json()) as {
        ok: boolean;
        models: Array<{ id: string; displayName: string }>;
      };
      assert.equal(modelsJson.ok, true);
      assert.deepEqual(
        modelsJson.models.map((m) => m.id),
        ['gemini-2.5-flash', 'gemini-2.5-pro'],
      );

      const events: PromptStreamEvent[] = [];
      runner.subscribe((ev) => events.push(ev));
      runner.startPrompt({
        prompt: 'Plan feature',
        model: 'models/gemini-2.5-pro',
        mode: 'turbo',
        orchestration: 'swarm',
        swarmProfile: [
          { role: 'Architect', model: 'gemini-2.5-pro', level: 'high' },
          { role: 'Verifier', model: 'gemini-2.5-flash', level: 'low' },
        ],
        mentions: ['coordinator'],
      });
      await runner.waitForIdle();

      const statusEv = events.find((e) => e.type === 'status');
      assert.ok(statusEv);
      assert.match(statusEv.text ?? '', /\[SWARM MODE\]/);
      assert.match(statusEv.text ?? '', /Architect=gemini-2\.5-pro\(high\)/);
      assert.match(statusEv.text ?? '', /Verifier=gemini-2\.5-flash\(low\)/);
      assert.equal(mapGeminiRestModel('models/gemini-2.5-pro'), 'gemini-2.5-pro');
    } finally {
      await instance.close();
    }
  });

  it('supports multi-provider keys, model discovery, SSRF guard for lmstudio, and SSE streaming for openai, anthropic, openrouter, lmstudio, and copilot', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-multi-secrets-'));
    const secretsFilePath = path.join(tempDir, 'swarm-plaza-secrets.json');
    const capturedRequests: Array<{ url: string; model?: string; headers: Record<string, string> }> = [];
    const copilotAdapterCalls: string[] = [];

    const mockCopilotAdapter: CopilotSdkAdapterLike = {
      async listModels() {
        return {
          ok: true,
          models: [{ id: 'gpt-4o', displayName: 'GPT-4o', provider: 'copilot' }],
        };
      },
      async streamPrompt(params) {
        copilotAdapterCalls.push(params.model);
        params.onDelta('Copilot SDK delta');
      },
      async dispose() {},
    };

    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      secretsFilePath,
      copilotAdapter: mockCopilotAdapter,
      providerKeys: {
        gemini: '',
        openai: '',
        anthropic: '',
        openrouter: '',
        copilot: '',
      },
      fetchImpl: async (url, init) => {
        const u = String(url);
        const hdrs = (init?.headers ?? {}) as Record<string, string>;
        const method = init?.method ?? 'GET';

        if (method === 'GET') {
          if (u === 'https://api.openai.com/v1/models') {
            return new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'o3-mini' }] }), {
              status: 200,
            });
          }
          if (u === 'https://api.anthropic.com/v1/models') {
            assert.equal(hdrs['anthropic-version'], '2023-06-01');
            return new Response(
              JSON.stringify({
                data: [{ id: 'claude-3-7-sonnet', display_name: 'Claude 3.7 Sonnet' }],
              }),
              { status: 200 },
            );
          }
          if (u === 'https://openrouter.ai/api/v1/models') {
            return new Response(
              JSON.stringify({ data: [{ id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' }] }),
              { status: 200 },
            );
          }
          if (u === 'https://models.github.ai/catalog/models') {
            return new Response('Not Found', { status: 404 });
          }
          if (u === 'http://localhost:1234/v1/models') {
            return new Response(JSON.stringify({ data: [{ id: 'qwen2.5-14b-instruct' }] }), {
              status: 200,
            });
          }
        }

        const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
        capturedRequests.push({ url: u, model: body.model, headers: hdrs });

        if (u === 'https://api.anthropic.com/v1/messages') {
          return new Response(
            createNdjsonStream([
              'event: content_block_delta',
              `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Claude ' } })}`,
              `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'stream!' } })}`,
            ]),
            { status: 200 },
          );
        }

        return new Response(
          createNdjsonStream([
            `data: ${JSON.stringify({ choices: [{ delta: { content: 'Chunk ' } }] })}`,
            `data: ${JSON.stringify({ choices: [{ delta: { content: 'OK' } }] })}`,
            'data: [DONE]',
          ]),
          { status: 200 },
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
      // Save keys for openai, anthropic, openrouter, copilot
      for (const [prov, key] of [
        ['openai', 'sk-openai-1234567890'],
        ['anthropic', 'sk-ant-1234567890'],
        ['openrouter', 'sk-or-1234567890'],
        ['copilot', 'ghp_copilot12345678'],
      ] as const) {
        const postRes = await fetch(`${baseUrl}/api/settings/provider-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: prov, apiKey: key }),
        });
        assert.equal(postRes.status, 200);
        const postJson = (await postRes.json()) as { ok: boolean; configured: boolean; masked: string };
        assert.equal(postJson.ok, true);
        assert.equal(postJson.configured, true);
        assert.ok(!JSON.stringify(postJson).includes(key));

        const getRes = await fetch(`${baseUrl}/api/settings/provider-key?provider=${prov}`);
        assert.equal(getRes.status, 200);
        const getJson = (await getRes.json()) as { configured: boolean; source: string };
        assert.equal(getJson.configured, true);
        assert.equal(getJson.source, 'settings');
      }

      // Model discovery across all new providers
      const openaiModels = (await (await fetch(`${baseUrl}/api/providers/models?provider=openai`)).json()) as {
        ok: boolean;
        models: Array<{ id: string; provider: string }>;
      };
      assert.equal(openaiModels.ok, true);
      assert.equal(openaiModels.models[0]?.id, 'gpt-4o');

      const anthropicModels = (await (await fetch(`${baseUrl}/api/providers/models?provider=anthropic`)).json()) as {
        ok: boolean;
        models: Array<{ id: string; displayName: string }>;
      };
      assert.equal(anthropicModels.ok, true);
      assert.equal(anthropicModels.models[0]?.id, 'claude-3-7-sonnet');

      const orModels = (await (await fetch(`${baseUrl}/api/providers/models?provider=openrouter`)).json()) as {
        ok: boolean;
        models: Array<{ id: string }>;
      };
      assert.equal(orModels.ok, true);
      assert.equal(orModels.models[0]?.id, 'deepseek/deepseek-r1');

      const copilotModels = (await (await fetch(`${baseUrl}/api/providers/models?provider=copilot`)).json()) as {
        ok: boolean;
        models: Array<{ id: string }>;
      };
      assert.equal(copilotModels.ok, true);
      assert.ok(copilotModels.models.some((m) => m.id === 'gpt-4o'));

      const lmsModels = (
        await (
          await fetch(
            `${baseUrl}/api/providers/models?provider=lmstudio&baseUrl=${encodeURIComponent('http://localhost:1234')}`,
          )
        ).json()
      ) as { ok: boolean; models: Array<{ id: string }> };
      assert.equal(lmsModels.ok, true);
      assert.equal(lmsModels.models[0]?.id, 'qwen2.5-14b-instruct');

      // SSRF protection for lmstudio external URL
      const lmsSsrf = await fetch(
        `${baseUrl}/api/providers/models?provider=lmstudio&baseUrl=${encodeURIComponent('https://evil.example.com')}`,
      );
      assert.equal(lmsSsrf.status, 400);

      // Stream tests for each provider
      const streamed: PromptStreamEvent[] = [];
      runner.subscribe((ev) => streamed.push(ev));

      for (const req of [
        { provider: 'openai' as const, model: 'openai:gpt-4o' },
        { provider: 'openrouter' as const, model: 'openrouter:deepseek/deepseek-r1' },
        { provider: 'copilot' as const, model: 'copilot:gpt-4.1' },
        { provider: 'lmstudio' as const, model: 'lmstudio:qwen2.5-14b-instruct', localBaseUrl: 'http://localhost:1234' },
        { provider: 'anthropic' as const, model: 'anthropic:claude-3-7-sonnet' },
      ]) {
        runner.startPrompt({
          prompt: 'Hi',
          model: req.model,
          provider: req.provider,
          localBaseUrl: req.localBaseUrl,
          mode: 'turbo',
          mentions: [],
        });
        await runner.waitForIdle();
      }

      assert.deepEqual(
        capturedRequests.map((r) => [r.url, r.model]),
        [
          ['https://api.openai.com/v1/chat/completions', 'gpt-4o'],
          ['https://openrouter.ai/api/v1/chat/completions', 'deepseek/deepseek-r1'],
          ['http://localhost:1234/v1/chat/completions', 'qwen2.5-14b-instruct'],
          ['https://api.anthropic.com/v1/messages', 'claude-3-7-sonnet'],
        ],
      );
      assert.deepEqual(copilotAdapterCalls, ['gpt-4.1']);
      assert.ok(streamed.some((e) => e.type === 'chunk' && e.text === 'Copilot SDK delta'));
      assert.ok(streamed.some((e) => e.type === 'chunk' && e.text === 'Claude '));
      assert.ok(streamed.some((e) => e.type === 'chunk' && e.text === 'stream!'));
      assert.ok(streamed.some((e) => e.type === 'chunk' && e.text === 'Chunk '));
    } finally {
      await instance.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects non-JSON/empty HTTP 200 text/plain responses on OpenAI-compatible streams instead of silently returning idle', async () => {
    const events: PromptStreamEvent[] = [];
    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      providerKeys: { openai: 'sk-test12345678' },
      fetchImpl: async () =>
        new Response('OK\r\n', {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
    });
    runner.subscribe((ev) => events.push(ev));

    runner.startPrompt({
      prompt: 'Hello OpenAI',
      model: 'openai:gpt-4o',
      provider: 'openai',
      mode: 'turbo',
      mentions: [],
    });
    await runner.waitForIdle();

    assert.equal(runner.getState().status, 'error');
    const errEv = events.find((e) => e.type === 'error');
    assert.ok(errEv);
    assert.match(errEv.text ?? '', /\[OPENAI STREAM ERROR\].*text\/plain/i);
  });

  it('CopilotSdkAdapter lists models via logged-in user, streams deltas, supports abort, and cleans up sessions', async () => {
    let disconnected = false;
    let aborted = false;
    let stopped = false;
    let capturedClientOpts: Record<string, unknown> | undefined;

    const adapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          constructor(opts?: Record<string, unknown>) {
            capturedClientOpts = opts;
          }
          async start() {}
          async stop() {
            stopped = true;
            return [];
          }
          async listModels() {
            return [{ id: 'gpt-4.1', name: 'GPT-4.1', policy: { state: 'enabled' } }];
          }
          async createSession() {
            let handler: ((ev: { type: string; data?: { deltaContent?: string } }) => void) | null =
              null;
            return {
              on(h: typeof handler) {
                handler = h;
                return () => {
                  handler = null;
                };
              },
              async sendAndWait() {
                handler?.({ type: 'assistant.message_delta', data: { deltaContent: 'SDK ' } });
                handler?.({ type: 'assistant.message_delta', data: { deltaContent: 'streaming!' } });
                return undefined;
              },
              async abort() {
                aborted = true;
              },
              async disconnect() {
                disconnected = true;
              },
            };
          }
        },
      }),
    });

    const modelsRes = await adapter.listModels();
    assert.equal(modelsRes.ok, true);
    assert.equal(capturedClientOpts?.useLoggedInUser, true);
    assert.equal(modelsRes.models[0]?.id, 'gpt-4.1');

    const deltas: string[] = [];
    await adapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'Hi',
      onDelta: (t) => deltas.push(t),
    });
    assert.equal(deltas.join(''), 'SDK streaming!');
    assert.equal(disconnected, true);

    const acPre = new AbortController();
    acPre.abort();
    await adapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'Pre-cancelled',
      onDelta: () => {},
      signal: acPre.signal,
    });
    assert.equal(aborted, false);

    disconnected = false;
    const acMid = new AbortController();
    await adapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'Cancelled mid-stream',
      onDelta: () => acMid.abort(),
      signal: acMid.signal,
    });
    assert.equal(aborted, true);
    assert.equal(disconnected, true);

    await adapter.dispose();
    assert.equal(stopped, true);
  });

  it('supports Copilot without PAT, stopPrompt cancellation, and mixed 3-provider (copilot + ollama + gemini) swarm orchestration', async () => {
    const executionOrder: string[] = [];
    const seenRolePrompts: Record<string, string> = {};

    const copilotAdapter: CopilotSdkAdapterLike = {
      async listModels(token) {
        assert.equal(token, undefined);
        return {
          ok: true,
          models: [{ id: 'gpt-4.1', displayName: 'GPT-4.1', provider: 'copilot' }],
        };
      },
      async streamPrompt(params) {
        executionOrder.push(`copilot:${params.model}`);
        seenRolePrompts.copilot = params.prompt;
        if (params.prompt.includes('CANCEL_ME')) {
          await new Promise<void>((resolve) => {
            params.signal?.addEventListener('abort', () => resolve(), { once: true });
          });
          return;
        }
        params.onDelta('Architect plan ready.');
      },
      async dispose() {},
    };

    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      copilotAdapter,
      resolveCliCommand: async () => null,
      providerKeys: { gemini: 'AIzaSySwarmTest1234', copilot: '' },
      fetchImpl: async (url, init) => {
        const u = String(url);
        if (u.includes('/api/chat')) {
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            model?: string;
            messages?: Array<{ content?: string }>;
          };
          executionOrder.push(`ollama:${body.model}`);
          seenRolePrompts.ollama = body.messages?.[1]?.content ?? '';
          return new Response(
            createNdjsonStream([
              JSON.stringify({ message: { content: 'Ollama implemented core.' } }),
              JSON.stringify({ done: true }),
            ]),
            { status: 200 },
          );
        }
        executionOrder.push('gemini:rest');
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          contents?: Array<{ parts?: Array<{ text?: string }> }>;
        };
        seenRolePrompts.gemini = body.contents?.[0]?.parts?.[0]?.text ?? '';
        return new Response(
          createNdjsonStream([
            `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini verified all.' }] } }] })}`,
            'data: [DONE]',
          ]),
          { status: 200 },
        );
      },
    });

    // 1. List Copilot models without manual PAT
    const copilotList = await runner.fetchProviderModels('copilot');
    assert.equal(copilotList.ok, true);
    assert.equal(copilotList.models[0]?.id, 'gpt-4.1');

    // 2. Cancel running Copilot prompt via stopPrompt()
    runner.startPrompt({
      prompt: 'CANCEL_ME',
      model: 'copilot:gpt-4.1',
      provider: 'copilot',
      mode: 'turbo',
      mentions: ['coordinator'],
    });
    const stoppedState = runner.stopPrompt();
    assert.equal(stoppedState.status, 'stopped');
    await runner.waitForIdle();

    // 3. Mixed 3-provider swarm orchestration (Architect runs first even if listed second!)
    executionOrder.length = 0;
    const swarmEvents: PromptStreamEvent[] = [];
    const unsub = runner.subscribe((ev) => swarmEvents.push(ev));

    runner.startPrompt({
      prompt: 'Build multi-provider swarm',
      model: 'copilot:gpt-4.1',
      mode: 'turbo',
      orchestration: 'swarm',
      swarmProfile: [
        { role: 'Coder Core', model: 'ollama:qwen2.5-coder:14b', level: 'medium' },
        { role: 'Architect', model: 'copilot:gpt-4.1', level: 'high' },
        { role: 'Verifier', model: 'gemini:gemini-2.5-flash', level: 'low' },
      ],
      mentions: [],
    });
    await runner.waitForIdle();
    unsub();

    assert.deepEqual(executionOrder, ['copilot:gpt-4.1', 'ollama:qwen2.5-coder:14b', 'gemini:rest']);
    assert.match(seenRolePrompts.ollama ?? '', /Architect plan ready/);
    assert.match(seenRolePrompts.gemini ?? '', /Ollama implemented core/);
    assert.ok(swarmEvents.some((e) => e.type === 'chunk' && e.text?.includes('[SWARM COMPLETE]')));
    assert.equal(runner.getState().status, 'idle');
  });

  it('isCopilotAuthError detects auth failures and ignores unrelated errors', () => {
    assert.equal(
      isCopilotAuthError(
        'Authorization error. Your credentials may be expired or invalid. (Request ID: 60CB:FD500:280B886:2A247A1:6AFF770D)',
      ),
      true,
    );
    assert.equal(isCopilotAuthError('401 Unauthorized'), true);
    assert.equal(isCopilotAuthError('403 Forbidden'), true);
    assert.equal(isCopilotAuthError('Token expired'), true);
    assert.equal(isCopilotAuthError('not authenticated'), true);
    assert.equal(isCopilotAuthError('Bad credentials'), true);
    assert.equal(isCopilotAuthError('Token is invalid'), true);
    assert.equal(isCopilotAuthError('Token invalid'), true);

    assert.equal(isCopilotAuthError('Model not found'), false);
    assert.equal(isCopilotAuthError('Network timeout'), false);
    assert.equal(isCopilotAuthError('Rate limit exceeded'), false);
    assert.equal(
      isCopilotAuthError('Upstream failure (Request ID: 60CB:401:280B886:403:6AFF770D)'),
      false,
    );
    assert.equal(isCopilotAuthError('Timeout after 401ms'), false);
  });

  it('CopilotSdkAdapter.streamPrompt falls back to logged-in user on auth failure, caches rejected tokens, and respects dispose/abort/partial deltas', async () => {
    const clientOpts: Array<Record<string, unknown> | undefined> = [];
    let stopCount = 0;

    type MockEvent = {
      type: string;
      data?: { deltaContent?: string; content?: string; message?: string };
    };

    const adapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          private readonly opts: Record<string, unknown> | undefined;
          constructor(opts?: Record<string, unknown>) {
            this.opts = opts;
            clientOpts.push(opts);
          }
          async start() {}
          async stop() {
            stopCount += 1;
            return [];
          }
          async listModels() {
            return [];
          }
          async createSession() {
            let handler: ((ev: MockEvent) => void) | null = null;
            return {
              on(h: typeof handler) {
                handler = h;
                return () => {
                  handler = null;
                };
              },
              sendAndWait: async () => {
                if (this.opts?.gitHubToken === 'ghp_bad') {
                  handler?.({
                    type: 'session.error',
                    data: {
                      message:
                        'Authorization error. Your credentials may be expired or invalid. (Request ID: TEST-1)',
                    },
                  });
                  return undefined;
                }
                if (this.opts?.useLoggedInUser === true) {
                  handler?.({
                    type: 'assistant.message_delta',
                    data: { deltaContent: 'Logged-in fallback!' },
                  });
                  return undefined;
                }
                if (this.opts?.gitHubToken === 'gho_good') {
                  handler?.({
                    type: 'assistant.message_delta',
                    data: { deltaContent: 'Good token!' },
                  });
                  return undefined;
                }
                return undefined;
              },
              async abort() {},
              async disconnect() {},
            };
          }
        },
      }),
    });

    // 1. Bad explicit token disposes failed client, retries once with logged-in user, and succeeds
    const deltas1: string[] = [];
    await adapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'First call',
      githubToken: 'ghp_bad',
      onDelta: (t) => deltas1.push(t),
    });
    assert.equal(deltas1.join(''), 'Logged-in fallback!');
    assert.equal(stopCount, 1);
    assert.equal(clientOpts.length, 2);
    assert.deepEqual(clientOpts[0], { gitHubToken: 'ghp_bad', useLoggedInUser: false });
    assert.deepEqual(clientOpts[1], { useLoggedInUser: true });

    // 2. Second call with same rejected token reuses active logged-in client without recreating
    const deltas2: string[] = [];
    await adapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'Second call',
      githubToken: 'ghp_bad',
      onDelta: (t) => deltas2.push(t),
    });
    assert.equal(deltas2.join(''), 'Logged-in fallback!');
    assert.equal(clientOpts.length, 2);
    assert.equal(stopCount, 1);

    // 3. After dispose(), rejected token cache and client are reset; valid token uses explicit auth
    await adapter.dispose();
    assert.equal(stopCount, 2);
    const deltas3: string[] = [];
    await adapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'Third call',
      githubToken: 'gho_good',
      onDelta: (t) => deltas3.push(t),
    });
    assert.equal(deltas3.join(''), 'Good token!');
    assert.equal(clientOpts.length, 3);
    assert.deepEqual(clientOpts[2], { gitHubToken: 'gho_good', useLoggedInUser: false });

    // 4. Partial deltas already emitted -> no retry on mid-stream auth failure
    const partialClientOpts: Array<Record<string, unknown> | undefined> = [];
    let partialStopCount = 0;
    const partialAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          constructor(opts?: Record<string, unknown>) {
            partialClientOpts.push(opts);
          }
          async start() {}
          async stop() {
            partialStopCount += 1;
            return [];
          }
          async listModels() {
            return [];
          }
          async createSession() {
            let handler: ((ev: MockEvent) => void) | null = null;
            return {
              on(h: typeof handler) {
                handler = h;
                return () => {
                  handler = null;
                };
              },
              async sendAndWait() {
                handler?.({
                  type: 'assistant.message_delta',
                  data: { deltaContent: 'Partial ' },
                });
                handler?.({
                  type: 'session.error',
                  data: { message: '401 Unauthorized' },
                });
                return undefined;
              },
              async abort() {},
              async disconnect() {},
            };
          }
        },
      }),
    });

    const partialDeltas: string[] = [];
    await assert.rejects(
      () =>
        partialAdapter.streamPrompt({
          model: 'gpt-4.1',
          prompt: 'Partial stream',
          githubToken: 'ghp_partial',
          onDelta: (t) => partialDeltas.push(t),
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /401 Unauthorized/);
        assert.match(err.message, /Hint: Clear or update the saved GitHub Copilot token/);
        assert.equal(err.message.split('[COPILOT SDK ERROR]').length - 1, 1);
        return true;
      },
    );
    assert.deepEqual(partialDeltas, ['Partial ']);
    assert.equal(partialClientOpts.length, 1);
    assert.equal(partialStopCount, 1);

    // 5. Aborted stream -> returns cleanly without retrying
    const abortClientOpts: Array<Record<string, unknown> | undefined> = [];
    const ac = new AbortController();
    const abortAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          constructor(opts?: Record<string, unknown>) {
            abortClientOpts.push(opts);
          }
          async start() {}
          async stop() {
            return [];
          }
          async listModels() {
            return [];
          }
          async createSession() {
            return {
              on() {
                return () => {};
              },
              async sendAndWait() {
                ac.abort();
                throw new Error('401 Unauthorized');
              },
              async abort() {},
              async disconnect() {},
            };
          }
        },
      }),
    });

    await abortAdapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'Abort during auth error',
      githubToken: 'ghp_aborted',
      onDelta: () => {},
      signal: ac.signal,
    });
    assert.equal(abortClientOpts.length, 1);
  });

  it('CopilotSdkAdapter.streamPrompt disposes stale client and surfaces Request ID + recovery hint on auth failures', async () => {
    let clientCreates = 0;
    let stopCount = 0;
    let shouldFail = true;

    type MockEvent = {
      type: string;
      data?: { deltaContent?: string; content?: string; message?: string };
    };

    const loggedInAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          async start() {}
          async stop() {
            stopCount += 1;
            return [];
          }
          async listModels() {
            return [];
          }
          async createSession() {
            clientCreates += 1;
            let handler: ((ev: MockEvent) => void) | null = null;
            return {
              on(h: typeof handler) {
                handler = h;
                return () => {
                  handler = null;
                };
              },
              async sendAndWait() {
                if (shouldFail) {
                  handler?.({
                    type: 'session.error',
                    data: {
                      message:
                        'Authorization error. Your credentials may be expired or invalid. (Request ID: REQ-LOGGEDIN-1)',
                    },
                  });
                } else {
                  handler?.({
                    type: 'assistant.message_delta',
                    data: { deltaContent: 'Recovered!' },
                  });
                }
                return undefined;
              },
              async abort() {},
              async disconnect() {},
            };
          }
        },
      }),
    });

    await assert.rejects(
      () =>
        loggedInAdapter.streamPrompt({
          model: 'gpt-4.1',
          prompt: 'Hello',
          onDelta: () => {},
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /REQ-LOGGEDIN-1/);
        assert.match(err.message, /Hint: Re-authenticate your local GitHub Copilot session/);
        assert.equal(err.message.split('[COPILOT SDK ERROR]').length - 1, 1);
        return true;
      },
    );
    assert.equal(stopCount, 1);

    // Next call must instantiate a fresh client instead of reusing the failed one
    shouldFail = false;
    const recoveredDeltas: string[] = [];
    await loggedInAdapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'Retry after reauth',
      onDelta: (t) => recoveredDeltas.push(t),
    });
    assert.equal(recoveredDeltas.join(''), 'Recovered!');
    assert.equal(clientCreates, 2);

    // Both explicit token and logged-in fallback fail -> both disposed, explicit-token hint emitted
    let bothStopCount = 0;
    const bothFailOpts: Array<Record<string, unknown> | undefined> = [];
    const bothFailAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          private readonly opts: Record<string, unknown> | undefined;
          constructor(opts?: Record<string, unknown>) {
            this.opts = opts;
            bothFailOpts.push(opts);
          }
          async start() {}
          async stop() {
            bothStopCount += 1;
            return [];
          }
          async listModels() {
            return [];
          }
          async createSession() {
            let handler: ((ev: MockEvent) => void) | null = null;
            return {
              on(h: typeof handler) {
                handler = h;
                return () => {
                  handler = null;
                };
              },
              sendAndWait: async () => {
                const reqId = this.opts?.gitHubToken ? 'REQ-EXPLICIT' : 'REQ-FALLBACK';
                handler?.({
                  type: 'session.error',
                  data: { message: `401 Unauthorized (Request ID: ${reqId})` },
                });
                return undefined;
              },
              async abort() {},
              async disconnect() {},
            };
          }
        },
      }),
    });

    await assert.rejects(
      () =>
        bothFailAdapter.streamPrompt({
          model: 'gpt-4.1',
          prompt: 'Both fail',
          githubToken: 'ghp_expired',
          onDelta: () => {},
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /REQ-FALLBACK/);
        assert.match(err.message, /Hint: Clear or update the saved GitHub Copilot token/);
        assert.equal(err.message.split('[COPILOT SDK ERROR]').length - 1, 1);
        return true;
      },
    );
    assert.equal(bothFailOpts.length, 2);
    assert.equal(bothStopCount, 2);
  });

  it('CopilotSdkAdapter.listModels falls back to logged-in user when explicit token fails auth', async () => {
    const clientOpts: Array<Record<string, unknown> | undefined> = [];
    let stopCount = 0;

    const adapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          private readonly opts: Record<string, unknown> | undefined;
          constructor(opts?: Record<string, unknown>) {
            this.opts = opts;
            clientOpts.push(opts);
          }
          async start() {}
          async stop() {
            stopCount += 1;
            return [];
          }
          async listModels() {
            if (this.opts?.gitHubToken === 'ghp_bad') {
              throw new Error('401 Unauthorized');
            }
            return [{ id: 'gpt-4.1', name: 'GPT-4.1', policy: { state: 'enabled' } }];
          }
          async createSession() {
            return {
              on() {
                return () => {};
              },
              async sendAndWait() {
                return undefined;
              },
              async abort() {},
              async disconnect() {},
            };
          }
        },
      }),
    });

    const res = await adapter.listModels('ghp_bad');
    assert.equal(res.ok, true);
    assert.equal(res.models.length, 1);
    assert.equal(res.models[0]?.id, 'gpt-4.1');
    assert.equal(stopCount, 1);
    assert.deepEqual(clientOpts, [
      { gitHubToken: 'ghp_bad', useLoggedInUser: false },
      { useLoggedInUser: true },
    ]);

    // Subsequent listModels with the rejected token reuses the logged-in client directly
    const res2 = await adapter.listModels('ghp_bad');
    assert.equal(res2.ok, true);
    assert.equal(clientOpts.length, 2);
  });

  it('PromptRunner ignores GITHUB_TOKEN, recognizes COPILOT_GITHUB_TOKEN, and disposes copilotAdapter on setProviderKey', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-copilot-env-'));
    const secretsFilePath = path.join(tempDir, 'swarm-plaza-secrets.json');
    const prevGithubToken = process.env.GITHUB_TOKEN;
    const prevCopilotGithubToken = process.env.COPILOT_GITHUB_TOKEN;
    const prevCopilotToken = process.env.COPILOT_TOKEN;

    let disposeCount = 0;
    const mockCopilotAdapter: CopilotSdkAdapterLike = {
      async listModels() {
        return { ok: true, models: [] };
      },
      async streamPrompt() {},
      async dispose() {
        disposeCount += 1;
      },
    };

    try {
      delete process.env.GITHUB_TOKEN;
      delete process.env.COPILOT_GITHUB_TOKEN;
      delete process.env.COPILOT_TOKEN;

      process.env.GITHUB_TOKEN = 'ghp_plain_git_token';
      const runnerWithGithubToken = new PromptRunner({
        defaultWorkspace: process.cwd(),
        secretsFilePath,
        copilotAdapter: mockCopilotAdapter,
      });
      const githubStatus = runnerWithGithubToken.getProviderKeyStatus('copilot');
      assert.equal(githubStatus.configured, false);
      assert.equal(githubStatus.source, 'none');

      const savedStatus = runnerWithGithubToken.setProviderKey('copilot', 'gho_test');
      assert.equal(savedStatus.configured, true);
      assert.equal(savedStatus.source, 'settings');
      assert.equal(disposeCount, 1);

      const clearedStatus = runnerWithGithubToken.setProviderKey('copilot', '');
      assert.equal(clearedStatus.configured, false);
      assert.equal(clearedStatus.source, 'none');
      assert.equal(disposeCount, 2);

      process.env.COPILOT_GITHUB_TOKEN = 'gho_copilot_env_token';
      const runnerWithCopilotEnv = new PromptRunner({
        defaultWorkspace: process.cwd(),
        secretsFilePath,
        copilotAdapter: mockCopilotAdapter,
      });
      const copilotEnvStatus = runnerWithCopilotEnv.getProviderKeyStatus('copilot');
      assert.equal(copilotEnvStatus.configured, true);
      assert.equal(copilotEnvStatus.source, 'env');
    } finally {
      if (prevGithubToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = prevGithubToken;
      }
      if (prevCopilotGithubToken === undefined) {
        delete process.env.COPILOT_GITHUB_TOKEN;
      } else {
        process.env.COPILOT_GITHUB_TOKEN = prevCopilotGithubToken;
      }
      if (prevCopilotToken === undefined) {
        delete process.env.COPILOT_TOKEN;
      } else {
        process.env.COPILOT_TOKEN = prevCopilotToken;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('CopilotSdkAdapter treats whitespace-only token as logged-in user and surfaces logged-in hint on auth error', async () => {
    const clientOpts: Array<Record<string, unknown> | undefined> = [];
    let stopCount = 0;

    const adapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          constructor(opts?: Record<string, unknown>) {
            clientOpts.push(opts);
          }
          async start() {}
          async stop() {
            stopCount += 1;
            return [];
          }
          async listModels(): Promise<
            Array<{ id: string; name?: string; policy?: { state?: string } }>
          > {
            throw new Error('Bad credentials (Request ID: REQ-WS-1)');
          }
          async createSession() {
            let handler: ((ev: { type: string; data?: { message?: string } }) => void) | null =
              null;
            return {
              on(h: typeof handler) {
                handler = h;
                return () => {
                  handler = null;
                };
              },
              async sendAndWait() {
                handler?.({
                  type: 'session.error',
                  data: { message: 'Token is invalid (Request ID: REQ-WS-2)' },
                });
                return undefined;
              },
              async abort() {},
              async disconnect() {},
            };
          }
        },
      }),
    });

    const modelsRes = await adapter.listModels('   ');
    assert.equal(modelsRes.ok, false);
    assert.match(modelsRes.error ?? '', /REQ-WS-1/);
    assert.match(modelsRes.error ?? '', /Hint: Re-authenticate your local GitHub Copilot session/);
    assert.equal((modelsRes.error ?? '').split('[COPILOT SDK ERROR]').length - 1, 1);

    await assert.rejects(
      () =>
        adapter.streamPrompt({
          model: 'gpt-4.1',
          prompt: 'Whitespace token',
          githubToken: '   ',
          onDelta: () => {},
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /REQ-WS-2/);
        assert.match(err.message, /Hint: Re-authenticate your local GitHub Copilot session/);
        assert.equal(err.message.split('[COPILOT SDK ERROR]').length - 1, 1);
        return true;
      },
    );

    assert.deepEqual(clientOpts, [{ useLoggedInUser: true }, { useLoggedInUser: true }]);
    assert.equal(stopCount, 2);
  });

  it('CopilotSdkAdapter.listModels reports logged-in auth failure and explicit + fallback auth failure', async () => {
    const loggedInOpts: Array<Record<string, unknown> | undefined> = [];
    let loggedInStops = 0;

    const loggedInAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          constructor(opts?: Record<string, unknown>) {
            loggedInOpts.push(opts);
          }
          async start() {}
          async stop() {
            loggedInStops += 1;
            return [];
          }
          async listModels(): Promise<
            Array<{ id: string; name?: string; policy?: { state?: string } }>
          > {
            throw new Error('403 Forbidden (Request ID: REQ-LM-LI)');
          }
          async createSession() {
            return {
              on: () => () => {},
              sendAndWait: async () => undefined,
              abort: async () => {},
              disconnect: async () => {},
            };
          }
        },
      }),
    });

    const loggedInFail = await loggedInAdapter.listModels();
    assert.equal(loggedInFail.ok, false);
    assert.deepEqual(loggedInOpts, [{ useLoggedInUser: true }]);
    assert.equal(loggedInStops, 1);
    assert.match(loggedInFail.error ?? '', /REQ-LM-LI/);
    assert.match(
      loggedInFail.error ?? '',
      /Hint: Re-authenticate your local GitHub Copilot session/,
    );
    assert.equal((loggedInFail.error ?? '').split('[COPILOT SDK ERROR]').length - 1, 1);

    const bothOpts: Array<Record<string, unknown> | undefined> = [];
    let bothStops = 0;

    const bothFailAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          private readonly opts: Record<string, unknown> | undefined;
          constructor(opts?: Record<string, unknown>) {
            this.opts = opts;
            bothOpts.push(opts);
          }
          async start() {}
          async stop() {
            bothStops += 1;
            return [];
          }
          async listModels(): Promise<
            Array<{ id: string; name?: string; policy?: { state?: string } }>
          > {
            const reqId = this.opts?.gitHubToken ? 'REQ-LM-EXPLICIT' : 'REQ-LM-FALLBACK';
            throw new Error(`401 Unauthorized (Request ID: ${reqId})`);
          }
          async createSession() {
            return {
              on: () => () => {},
              sendAndWait: async () => undefined,
              abort: async () => {},
              disconnect: async () => {},
            };
          }
        },
      }),
    });

    const bothFail = await bothFailAdapter.listModels('ghp_expired');
    assert.equal(bothFail.ok, false);
    assert.deepEqual(bothOpts, [
      { gitHubToken: 'ghp_expired', useLoggedInUser: false },
      { useLoggedInUser: true },
    ]);
    assert.equal(bothStops, 2);
    assert.match(bothFail.error ?? '', /REQ-LM-FALLBACK/);
    assert.match(
      bothFail.error ?? '',
      /Hint: Clear or update the saved GitHub Copilot token/,
    );
    assert.equal((bothFail.error ?? '').split('[COPILOT SDK ERROR]').length - 1, 1);
  });

  it('PromptRunner falls back to COPILOT_TOKEN env var when COPILOT_GITHUB_TOKEN is unset', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-copilot-tok-'));
    const secretsFilePath = path.join(tempDir, 'swarm-plaza-secrets.json');
    const prevGithubToken = process.env.GITHUB_TOKEN;
    const prevCopilotGithubToken = process.env.COPILOT_GITHUB_TOKEN;
    const prevCopilotToken = process.env.COPILOT_TOKEN;

    const seenTokens: Array<string | undefined> = [];
    const mockCopilotAdapter: CopilotSdkAdapterLike = {
      async listModels(githubToken?: string) {
        seenTokens.push(githubToken);
        return { ok: true, models: [] };
      },
      async streamPrompt() {},
      async dispose() {},
    };

    try {
      delete process.env.GITHUB_TOKEN;
      delete process.env.COPILOT_GITHUB_TOKEN;
      process.env.COPILOT_TOKEN = 'gho_copilot_token_fallback';

      const runner = new PromptRunner({
        defaultWorkspace: process.cwd(),
        secretsFilePath,
        copilotAdapter: mockCopilotAdapter,
      });

      const status = runner.getProviderKeyStatus('copilot');
      assert.equal(status.configured, true);
      assert.equal(status.source, 'env');

      await runner.fetchProviderModels('copilot');
      assert.deepEqual(seenTokens, ['gho_copilot_token_fallback']);
    } finally {
      if (prevGithubToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = prevGithubToken;
      }
      if (prevCopilotGithubToken === undefined) {
        delete process.env.COPILOT_GITHUB_TOKEN;
      } else {
        process.env.COPILOT_GITHUB_TOKEN = prevCopilotGithubToken;
      }
      if (prevCopilotToken === undefined) {
        delete process.env.COPILOT_TOKEN;
      } else {
        process.env.COPILOT_TOKEN = prevCopilotToken;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('CopilotSdkAdapter serializes concurrent ensureClient calls and isolates dispose() mid-start from newer clients', async () => {
    // 1. Concurrent listModels calls with async start() share a single CopilotClient
    let concurrentConstructs = 0;
    let concurrentStarts = 0;
    let concurrentStops = 0;

    const concurrentAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          constructor() {
            concurrentConstructs += 1;
          }
          async start() {
            concurrentStarts += 1;
            await new Promise((r) => setTimeout(r, 15));
          }
          async stop() {
            concurrentStops += 1;
            return [];
          }
          async listModels() {
            return [{ id: 'gpt-4.1', name: 'GPT-4.1' }];
          }
          async createSession() {
            return {
              on: () => () => {},
              sendAndWait: async () => undefined,
              abort: async () => {},
              disconnect: async () => {},
            };
          }
        },
      }),
    });

    const [cRes1, cRes2] = await Promise.all([
      concurrentAdapter.listModels('gho_same'),
      concurrentAdapter.listModels('gho_same'),
    ]);
    assert.equal(cRes1.ok, true);
    assert.equal(cRes2.ok, true);
    assert.equal(concurrentConstructs, 1);
    assert.equal(concurrentStarts, 1);
    assert.equal(concurrentStops, 0);

    // 2. dispose() mid-start() stops the in-flight client and prevents stale auth failure from killing a newer client
    let resolveFirstStart!: () => void;
    let notifyFirstStartEntered!: () => void;
    const firstStartEntered = new Promise<void>((r) => {
      notifyFirstStartEntered = r;
    });
    const clientRecords: Array<{
      opts: Record<string, unknown> | undefined;
      stopped: boolean;
    }> = [];

    const raceAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          private readonly rec: { opts: Record<string, unknown> | undefined; stopped: boolean };
          private readonly index: number;
          constructor(opts?: Record<string, unknown>) {
            this.rec = { opts, stopped: false };
            this.index = clientRecords.push(this.rec) - 1;
          }
          async start() {
            if (this.index === 0) {
              notifyFirstStartEntered();
              await new Promise<void>((resolve) => {
                resolveFirstStart = resolve;
              });
            }
          }
          async stop() {
            this.rec.stopped = true;
            return [];
          }
          async listModels() {
            return [{ id: 'gpt-4.1', name: 'GPT-4.1' }];
          }
          async createSession() {
            return {
              on: () => () => {},
              sendAndWait: async () => undefined,
              abort: async () => {},
              disconnect: async () => {},
            };
          }
        },
      }),
    });

    const staleCall = raceAdapter.listModels('gho_reused');
    await firstStartEntered;
    const disposeCall = raceAdapter.dispose();
    const freshCall = raceAdapter.listModels('gho_reused');

    resolveFirstStart();
    const [staleRes, , freshRes] = await Promise.all([staleCall, disposeCall, freshCall]);

    assert.equal(staleRes.ok, false);
    assert.match(staleRes.error ?? '', /disposed during startup/i);
    assert.equal(freshRes.ok, true);
    assert.equal(clientRecords.length, 2);
    assert.equal(clientRecords[0]?.stopped, true);
    assert.equal(clientRecords[1]?.stopped, false);

    // 3. Stale mid-flight auth rejection after dispose() + new client does not poison token or stop newer client
    let rejectFirstListModels!: (err: Error) => void;
    let notifyListModelsEntered!: () => void;
    const listModelsEntered = new Promise<void>((r) => {
      notifyListModelsEntered = r;
    });
    const staleClients: Array<{
      opts: Record<string, unknown> | undefined;
      stopped: boolean;
    }> = [];

    const staleFailureAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          private readonly rec: { opts: Record<string, unknown> | undefined; stopped: boolean };
          private readonly index: number;
          constructor(opts?: Record<string, unknown>) {
            this.rec = { opts, stopped: false };
            this.index = staleClients.push(this.rec) - 1;
          }
          async start() {}
          async stop() {
            this.rec.stopped = true;
            return [];
          }
          async listModels() {
            if (this.index === 0) {
              notifyListModelsEntered();
              return new Promise<Array<{ id: string; name?: string }>>((_, reject) => {
                rejectFirstListModels = reject;
              });
            }
            return [{ id: 'gpt-4.1', name: 'GPT-4.1' }];
          }
          async createSession() {
            return {
              on: () => () => {},
              sendAndWait: async () => undefined,
              abort: async () => {},
              disconnect: async () => {},
            };
          }
        },
      }),
    });

    const inflightStale = staleFailureAdapter.listModels('gho_reused');
    await listModelsEntered;
    await staleFailureAdapter.dispose();
    const newerRes1 = await staleFailureAdapter.listModels('gho_reused');
    assert.equal(newerRes1.ok, true);

    rejectFirstListModels(new Error('401 Unauthorized'));
    const inflightStaleRes = await inflightStale;
    assert.equal(inflightStaleRes.ok, false);

    // Newer client must remain alive and gho_reused must not be poisoned in rejectedAuthTokens
    const newerRes2 = await staleFailureAdapter.listModels('gho_reused');
    assert.equal(newerRes2.ok, true);
    assert.equal(staleClients.length, 2);
    assert.equal(staleClients[0]?.stopped, true);
    assert.equal(staleClients[1]?.stopped, false);
    assert.deepEqual(staleClients[1]?.opts, {
      gitHubToken: 'gho_reused',
      useLoggedInUser: false,
    });
  });

  it('CopilotSdkAdapter.streamPrompt skips fallback retry when abort occurs during disposeClientIfGeneration', async () => {
    const ac = new AbortController();
    const clientOpts: Array<Record<string, unknown> | undefined> = [];
    let stopCount = 0;

    const adapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        CopilotClient: class {
          constructor(opts?: Record<string, unknown>) {
            clientOpts.push(opts);
          }
          async start() {}
          async stop() {
            stopCount += 1;
            ac.abort();
            return [];
          }
          async listModels() {
            return [];
          }
          async createSession() {
            return {
              on: () => () => {},
              async sendAndWait() {
                throw new Error('401 Unauthorized');
              },
              async abort() {},
              async disconnect() {},
            };
          }
        },
      }),
    });

    await adapter.streamPrompt({
      model: 'gpt-4.1',
      prompt: 'Abort during dispose',
      githubToken: 'ghp_bad',
      onDelta: () => {},
      signal: ac.signal,
    });

    assert.equal(stopCount, 1);
    assert.deepEqual(clientOpts, [{ gitHubToken: 'ghp_bad', useLoggedInUser: false }]);
  });

  it('supports deepseek, groq, custom baseUrl persistence, POST /api/prompt/approve, and liveSwarmBoard snapshot merging', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-phase1c-'));
    const secretsFilePath = path.join(tempDir, 'secrets.json');

    // Mock SwarmOrchestrator that requests a Safe-mode approval and posts to SwarmBoard
    const { SwarmOrchestrator } = await import('../../src/server/swarm/swarmOrchestrator.js');
    const orchestrator = new SwarmOrchestrator({
      adapters: {
        deepseek: {
          provider: 'deepseek',
          async listModels() {
            return { ok: true, models: [] };
          },
          async runTurn() {
            return { text: 'Done', toolCalls: [], finishReason: 'stop' };
          },
        },
      },
    });
    // Override run() on this test orchestrator to exercise ApprovalGate + SwarmBoard + onEvent
    orchestrator.run = async (params) => {
      params.onAgentStateChange?.('coder-core', 'working', {
        role: 'Coder Core',
        currentFile: 'src/server/index.ts',
      });
      params.board?.postMessage({
        from: 'Architect',
        to: 'Coder Core',
        text: '@coder-core Update index routes',
      });
      params.onEvent?.({
        runId: params.runId,
        type: 'tool_call',
        agentId: 'coder-core',
        toolName: 'edit_file',
        toolArgs: { path: 'src/server/index.ts' },
        timestamp: Date.now(),
      });
      const decision = await params.approvalGate!.requestApproval({
        approvalId: 'apr-test-1',
        runId: params.runId,
        role: 'Coder Core',
        toolName: 'edit_file',
        summary: 'Edit src/server/index.ts',
        timestamp: Date.now(),
      });
      params.onEvent?.({
        runId: params.runId,
        type: 'chunk',
        agentId: 'coder-core',
        text: `Decision=${decision}`,
        timestamp: Date.now(),
      });
      return {
        runId: params.runId,
        tasks: [],
        whiteboard: params.board!.toWhiteboardSnapshot(),
        healingRoundsUsed: 0,
        verified: true,
        roleOutputs: { 'Coder Core': `Decision=${decision}` },
      };
    };

    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      secretsFilePath,
      swarmOrchestrator: orchestrator,
      providerKeys: { deepseek: '', groq: '', custom: '' },
      fetchImpl: async (url) => {
        const u = String(url);
        if (u === 'https://api.deepseek.com/v1/models') {
          return new Response(JSON.stringify({ data: [{ id: 'deepseek-chat' }] }), { status: 200 });
        }
        if (u === 'https://api.groq.com/openai/v1/models') {
          return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }] }), {
            status: 200,
          });
        }
        if (u === 'https://custom-llm.local/v1/models') {
          return new Response(JSON.stringify({ data: [{ id: 'custom-7b' }] }), { status: 200 });
        }
        return new Response('{}', { status: 404 });
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
      // 1. Save deepseek, groq, and custom (with baseUrl) keys & fetch models
      await fetch(`${baseUrl}/api/settings/provider-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'deepseek', apiKey: 'sk-ds-12345678' }),
      });
      await fetch(`${baseUrl}/api/settings/provider-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'groq', apiKey: 'gsk_1234567890' }),
      });
      const customSave = (await (
        await fetch(`${baseUrl}/api/settings/provider-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'custom',
            apiKey: 'sk-cust-123456',
            baseUrl: 'https://custom-llm.local/v1/',
          }),
        })
      ).json()) as { ok: boolean; baseUrl?: string };
      assert.equal(customSave.ok, true);
      assert.equal(customSave.baseUrl, 'https://custom-llm.local/v1');

      const dsModels = (await (await fetch(`${baseUrl}/api/providers/models?provider=deepseek`)).json()) as {
        ok: boolean;
        models: Array<{ id: string }>;
      };
      assert.equal(dsModels.ok, true);
      assert.equal(dsModels.models[0]?.id, 'deepseek-chat');

      const groqModels = (await (await fetch(`${baseUrl}/api/providers/models?provider=groq`)).json()) as {
        ok: boolean;
        models: Array<{ id: string }>;
      };
      assert.equal(groqModels.ok, true);
      assert.equal(groqModels.models[0]?.id, 'llama-3.3-70b-versatile');

      const customModels = (await (await fetch(`${baseUrl}/api/providers/models?provider=custom`)).json()) as {
        ok: boolean;
        models: Array<{ id: string }>;
      };
      assert.equal(customModels.ok, true);
      assert.equal(customModels.models[0]?.id, 'custom-7b');

      // 2. Start swarm run and test POST /api/prompt/approve
      const events: PromptStreamEvent[] = [];
      runner.subscribe((ev) => events.push(ev));

      const startRes = await fetch(`${baseUrl}/api/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Update routes',
          model: 'deepseek:deepseek-chat',
          mode: 'safe',
          orchestration: 'swarm',
          swarmProfile: [{ role: 'Coder Core', model: 'deepseek:deepseek-chat', level: 'medium' }],
          mentions: [],
        }),
      });
      assert.equal(startRes.status, 200);

      await new Promise((r) => setTimeout(r, 40));

      const badApprove = await fetch(`${baseUrl}/api/prompt/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: 'apr-test-1', decision: 'invalid' }),
      });
      assert.equal(badApprove.status, 400);

      const missingApprove = await fetch(`${baseUrl}/api/prompt/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: 'unknown-id', decision: 'allow_once' }),
      });
      assert.equal(missingApprove.status, 404);

      const okApprove = await fetch(`${baseUrl}/api/prompt/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: 'apr-test-1', decision: 'allow_once' }),
      });
      assert.equal(okApprove.status, 200);

      await runner.waitForIdle();

      assert.ok(events.some((e) => e.type === 'approval_request' && e.approval?.approvalId === 'apr-test-1'));
      assert.ok(events.some((e) => e.type === 'approval_resolved'));
      assert.ok(events.some((e) => e.type === 'chunk' && e.text === 'Decision=allow_once'));

      // 3. Verify getActiveSwarmBoardSnapshot() merges into /api/plaza
      const boardSnap = runner.getActiveSwarmBoardSnapshot();
      assert.ok(boardSnap);
      assert.ok(boardSnap.messages.some((m) => m.text.includes('Update index routes')));

      const plazaRes = await fetch(`${baseUrl}/api/plaza`);
      const plazaJson = (await plazaRes.json()) as { floors: PlazaFloor[] };
      const demoFloor = plazaJson.floors.find((f) => f.isDemo);
      assert.ok(demoFloor?.boardMessages.some((m) => m.text.includes('Update index routes')));
    } finally {
      await instance.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
