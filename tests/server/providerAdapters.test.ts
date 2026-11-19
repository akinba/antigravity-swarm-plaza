import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AnthropicSdkAdapter,
  CopilotSdkAdapter,
  GeminiSdkAdapter,
  OPENAI_COMPAT_BASE_URLS,
  OllamaSdkAdapter,
  OpenAiCompatibleSdkAdapter,
  createProviderRegistry,
  isVertexExpressApiKey,
  type AgentToolCall,
  type AgentToolDefinition,
} from '../../src/server/providers/index.js';

const SAMPLE_TOOLS: AgentToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read a file from workspace',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path' } },
      required: ['path'],
    },
  },
];

async function* asAsyncIter<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

describe('Official SDK Provider Adapters', () => {
  it('GeminiSdkAdapter detects AI Studio (AIza) vs Vertex Express (AQ.), lists models, and streams text + functionCalls', async () => {
    assert.equal(isVertexExpressApiKey('AQ.Ab8RN6TestKey'), true);
    assert.equal(isVertexExpressApiKey('AIzaSyTestKey'), false);

    const capturedOpts: Array<{ apiKey: string; vertexai?: boolean }> = [];
    const adapter = new GeminiSdkAdapter((opts) => {
      capturedOpts.push(opts);
      return {
        models: {
          list: async () =>
            asAsyncIter([
              {
                name: 'models/gemini-2.5-flash',
                displayName: 'Gemini 2.5 Flash',
                supportedActions: ['generateContent'],
              },
              {
                name: 'models/embedding-001',
                displayName: 'Embedding',
                supportedActions: ['embedContent'],
              },
            ]),
          generateContentStream: async () =>
            asAsyncIter([
              { text: 'Checking ' },
              {
                text: 'file...',
                functionCalls: [{ id: 'g-1', name: 'read_file', args: { path: 'package.json' } }],
              },
            ]),
        },
      };
    });

    const aiStudioModels = await adapter.listModels({ apiKey: 'AIzaSyTest1234' });
    assert.equal(aiStudioModels.ok, true);
    assert.deepEqual(
      aiStudioModels.models.map((m) => m.id),
      ['gemini-2.5-flash'],
    );
    assert.equal(capturedOpts[0]?.vertexai, false);

    const vertexModels = await adapter.listModels({ apiKey: 'AQ.VertexExpress1234' });
    assert.equal(vertexModels.ok, true);
    assert.ok(vertexModels.models.some((m) => m.id === 'gemini-2.5-pro'));

    const deltas: string[] = [];
    const calls: AgentToolCall[] = [];
    const turn = await adapter.runTurn(
      {
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Read package.json' },
        ],
        tools: SAMPLE_TOOLS,
        workspace: process.cwd(),
        onDelta: (t) => deltas.push(t),
        onToolCall: (c) => calls.push(c),
      },
      { apiKey: 'AQ.VertexExpress1234' },
    );

    assert.equal(capturedOpts[1]?.vertexai, true);
    assert.equal(turn.text, 'Checking file...');
    assert.equal(deltas.join(''), 'Checking file...');
    assert.equal(turn.finishReason, 'tool_calls');
    assert.deepEqual(calls, [{ id: 'g-1', name: 'read_file', args: { path: 'package.json' } }]);
  });

  it('OpenAiCompatibleSdkAdapter routes deepseek/groq/xai/mistral/custom baseURLs and assembles streamed tool_calls', async () => {
    const seenBaseUrls: Array<string | undefined> = [];

    for (const [provider, expectedUrl] of [
      ['deepseek', OPENAI_COMPAT_BASE_URLS.deepseek],
      ['groq', OPENAI_COMPAT_BASE_URLS.groq],
      ['xai', OPENAI_COMPAT_BASE_URLS.xai],
      ['mistral', OPENAI_COMPAT_BASE_URLS.mistral],
      ['custom', 'https://my-proxy.local/v1'],
    ] as const) {
      const adapter = new OpenAiCompatibleSdkAdapter(provider, (opts) => {
        seenBaseUrls.push(opts.baseURL);
        return {
          models: {
            list: async () => asAsyncIter([{ id: `${provider}-model-1` }]),
          },
          chat: {
            completions: {
              create: async () =>
                asAsyncIter([
                  { choices: [{ delta: { content: 'Working ' } }] },
                  {
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            { index: 0, id: 'tc-1', function: { name: 'read_', arguments: '{"path":' } },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            { index: 0, function: { name: 'file', arguments: '"README.md"}' } },
                          ],
                        },
                      },
                    ],
                  },
                ]),
            },
          },
        };
      });

      const cfg =
        provider === 'custom'
          ? { apiKey: 'sk-custom', baseUrl: 'https://my-proxy.local/v1' }
          : { apiKey: `sk-${provider}` };

      const listRes = await adapter.listModels(cfg);
      assert.equal(listRes.ok, true);
      assert.equal(listRes.models[0]?.id, `${provider}-model-1`);

      const calls: AgentToolCall[] = [];
      const turn = await adapter.runTurn(
        {
          model: `${provider}:${provider}-model-1`,
          messages: [{ role: 'user', content: 'Inspect README' }],
          tools: SAMPLE_TOOLS,
          workspace: process.cwd(),
          onToolCall: (c) => calls.push(c),
        },
        cfg,
      );

      assert.equal(seenBaseUrls[seenBaseUrls.length - 1], expectedUrl);
      assert.equal(turn.text, 'Working ');
      assert.equal(turn.finishReason, 'tool_calls');
      assert.deepEqual(calls, [{ id: 'tc-1', name: 'read_file', args: { path: 'README.md' } }]);
    }
  });

  it('AnthropicSdkAdapter lists models and streams text_delta + tool_use blocks', async () => {
    const adapter = new AnthropicSdkAdapter(() => ({
      models: {
        list: async () => asAsyncIter([{ id: 'claude-3-7-sonnet', display_name: 'Claude 3.7 Sonnet' }]),
      },
      messages: {
        create: async () =>
          asAsyncIter([
            { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Reading ' } },
            {
              type: 'content_block_start',
              index: 1,
              content_block: { type: 'tool_use', id: 'anth-1', name: 'read_file' },
            },
            {
              type: 'content_block_delta',
              index: 1,
              delta: { type: 'input_json_delta', partial_json: '{"path":"src/index.ts"}' },
            },
            { type: 'content_block_stop', index: 1 },
          ]),
      },
    }));

    const models = await adapter.listModels({ apiKey: 'sk-ant-test' });
    assert.equal(models.ok, true);
    assert.equal(models.models[0]?.id, 'claude-3-7-sonnet');

    const calls: AgentToolCall[] = [];
    const turn = await adapter.runTurn(
      {
        model: 'anthropic:claude-3-7-sonnet',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'Check index' },
        ],
        tools: SAMPLE_TOOLS,
        workspace: process.cwd(),
        onToolCall: (c) => calls.push(c),
      },
      { apiKey: 'sk-ant-test' },
    );

    assert.equal(turn.text, 'Reading ');
    assert.equal(turn.finishReason, 'tool_calls');
    assert.deepEqual(calls, [{ id: 'anth-1', name: 'read_file', args: { path: 'src/index.ts' } }]);
  });

  it('OllamaSdkAdapter lists models and streams chat chunks + tool_calls', async () => {
    const adapter = new OllamaSdkAdapter(() => ({
      list: async () => ({ models: [{ name: 'qwen2.5-coder:14b' }] }),
      chat: async () =>
        asAsyncIter([
          { message: { content: 'Local ' } },
          {
            message: {
              content: 'check',
              tool_calls: [{ function: { name: 'read_file', arguments: { path: 'tsconfig.json' } } }],
            },
            done: true,
          },
        ]),
    }));

    const models = await adapter.listModels({ baseUrl: 'http://localhost:11434' });
    assert.equal(models.ok, true);
    assert.equal(models.models[0]?.id, 'qwen2.5-coder:14b');

    const calls: AgentToolCall[] = [];
    const turn = await adapter.runTurn(
      {
        model: 'ollama:qwen2.5-coder:14b',
        messages: [{ role: 'user', content: 'Check tsconfig' }],
        tools: SAMPLE_TOOLS,
        workspace: process.cwd(),
        onToolCall: (c) => calls.push(c),
      },
      { baseUrl: 'http://localhost:11434' },
    );

    assert.equal(turn.text, 'Local check');
    assert.equal(turn.finishReason, 'tool_calls');
    assert.equal(calls[0]?.name, 'read_file');
    assert.deepEqual(calls[0]?.args, { path: 'tsconfig.json' });
  });

  it('CopilotSdkAdapter implements UnifiedProviderAdapter with defineTool and createProviderRegistry exposes all 12 providers', async () => {
    const definedTools: string[] = [];
    const copilotAdapter = new CopilotSdkAdapter({
      sdkLoader: async () => ({
        approveAll: () => ({ kind: 'approved' }),
        defineTool: (name: string, cfg: Record<string, unknown>) => {
          definedTools.push(name);
          return { name, ...cfg };
        },
        CopilotClient: class {
          async start() {}
          async stop() {
            return [];
          }
          async listModels() {
            return [{ id: 'gpt-4.1', name: 'GPT-4.1' }];
          }
          async createSession(cfg: Record<string, unknown>) {
            const tools = (cfg.tools as Array<{ handler?: (args: Record<string, unknown>) => Promise<unknown> }>) ?? [];
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
                handler?.({ type: 'assistant.message_delta', data: { deltaContent: 'Copilot ' } });
                if (tools[0]?.handler) {
                  await tools[0].handler({ path: 'package.json' });
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

    const calls: AgentToolCall[] = [];
    const turn = await copilotAdapter.runTurn(
      {
        model: 'copilot:gpt-4.1',
        messages: [{ role: 'user', content: 'Check package.json' }],
        tools: SAMPLE_TOOLS,
        workspace: process.cwd(),
        onToolCall: (c) => calls.push(c),
      },
      {},
    );

    assert.deepEqual(definedTools, ['read_file']);
    assert.equal(turn.text, 'Copilot ');
    assert.equal(turn.finishReason, 'tool_calls');
    assert.deepEqual(calls[0]?.args, { path: 'package.json' });

    const registry = createProviderRegistry({ copilotAdapter });
    assert.deepEqual(Object.keys(registry).sort(), [
      'anthropic',
      'copilot',
      'custom',
      'deepseek',
      'gemini',
      'groq',
      'lmstudio',
      'mistral',
      'ollama',
      'openai',
      'openrouter',
      'xai',
    ]);
  });
});
