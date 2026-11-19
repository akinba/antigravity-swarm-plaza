import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createPlazaApp } from '../../src/server/index.js';
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

    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      secretsFilePath,
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
          ['https://models.github.ai/inference/chat/completions', 'gpt-4.1'],
          ['http://localhost:1234/v1/chat/completions', 'qwen2.5-14b-instruct'],
          ['https://api.anthropic.com/v1/messages', 'claude-3-7-sonnet'],
        ],
      );
      assert.ok(streamed.some((e) => e.type === 'chunk' && e.text === 'Claude '));
      assert.ok(streamed.some((e) => e.type === 'chunk' && e.text === 'stream!'));
      assert.ok(streamed.some((e) => e.type === 'chunk' && e.text === 'Chunk '));
    } finally {
      await instance.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects non-JSON/empty HTTP 200 text/plain responses on copilot instead of silently returning idle', async () => {
    const events: PromptStreamEvent[] = [];
    const runner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      providerKeys: { copilot: 'ghp_test12345678' },
      fetchImpl: async () =>
        new Response('OK\r\n', {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
    });
    runner.subscribe((ev) => events.push(ev));

    const catalogRes = await runner.fetchProviderModels('copilot');
    assert.equal(catalogRes.ok, false);
    assert.deepEqual(catalogRes.models, []);
    assert.match(catalogRes.error ?? '', /non-JSON/i);

    runner.startPrompt({
      prompt: 'Hello Copilot',
      model: 'copilot:gpt-4o',
      provider: 'copilot',
      mode: 'turbo',
      mentions: [],
    });
    await runner.waitForIdle();

    assert.equal(runner.getState().status, 'error');
    const errEv = events.find((e) => e.type === 'error');
    assert.ok(errEv);
    assert.match(errEv.text ?? '', /\[COPILOT STREAM ERROR\].*text\/plain/i);
  });
});
