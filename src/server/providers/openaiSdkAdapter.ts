import OpenAI from 'openai';
import type { PromptProvider, ProviderModelInfo } from '../../shared/types.js';
import type {
  AgentToolCall,
  AgentTurnParams,
  AgentTurnResult,
  ProviderModelListResult,
  ProviderRuntimeConfig,
  UnifiedProviderAdapter,
} from './providerAdapter.js';

export type OpenAiCompatibleProvider =
  | 'openai'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'xai'
  | 'mistral'
  | 'lmstudio'
  | 'custom';

export const OPENAI_COMPAT_BASE_URLS: Record<OpenAiCompatibleProvider, string | undefined> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  lmstudio: 'http://localhost:1234/v1',
  custom: undefined,
};

interface OpenAiModelItem {
  id: string;
  name?: string;
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
}

export interface OpenAiClientLike {
  models: {
    list: () => Promise<AsyncIterable<OpenAiModelItem> | { data?: OpenAiModelItem[] }>;
  };
  chat: {
    completions: {
      create: (
        body: Record<string, unknown>,
        options?: { signal?: AbortSignal },
      ) => Promise<AsyncIterable<OpenAiStreamChunk>>;
    };
  };
}

export type OpenAiClientFactory = (opts: {
  apiKey: string;
  baseURL?: string;
  fetch?: typeof fetch;
}) => OpenAiClientLike;

function normalizeLmStudioBaseUrl(raw?: string): string {
  const trimmed = (raw ?? 'http://localhost:1234').trim().replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export class OpenAiCompatibleSdkAdapter implements UnifiedProviderAdapter {
  readonly provider: PromptProvider;
  private readonly clientFactory: OpenAiClientFactory;

  constructor(provider: OpenAiCompatibleProvider, clientFactory?: OpenAiClientFactory) {
    this.provider = provider;
    this.clientFactory =
      clientFactory ??
      ((opts) =>
        new OpenAI({
          apiKey: opts.apiKey,
          baseURL: opts.baseURL,
          ...(opts.fetch ? { fetch: opts.fetch } : {}),
        }) as unknown as OpenAiClientLike);
  }

  private resolveConfig(config: ProviderRuntimeConfig): { apiKey: string; baseURL?: string } {
    const prov = this.provider as OpenAiCompatibleProvider;
    const baseURL =
      prov === 'lmstudio'
        ? normalizeLmStudioBaseUrl(config.baseUrl)
        : (config.baseUrl?.trim().replace(/\/+$/, '') || OPENAI_COMPAT_BASE_URLS[prov]);

    if (prov === 'custom' && !baseURL) {
      throw new Error('[CUSTOM API NOT CONFIGURED] Provide a custom Base URL (https://.../v1).');
    }

    const rawKey = config.apiKey?.trim() ?? '';
    if (prov !== 'lmstudio' && prov !== 'custom' && !rawKey) {
      throw new Error(
        `[${prov.toUpperCase()} API NOT CONFIGURED] Configure ${prov} API key in Settings -> Cloud APIs.`,
      );
    }

    return {
      apiKey: rawKey || (prov === 'lmstudio' ? 'lm-studio' : 'custom-key'),
      baseURL,
    };
  }

  async listModels(config: ProviderRuntimeConfig): Promise<ProviderModelListResult> {
    let resolved: { apiKey: string; baseURL?: string };
    try {
      resolved = this.resolveConfig(config);
    } catch (err) {
      return {
        ok: false,
        models: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      const client = this.clientFactory({
        apiKey: resolved.apiKey,
        baseURL: resolved.baseURL,
        fetch: config.fetchImpl,
      });
      const raw = await client.models.list();
      const collected: OpenAiModelItem[] = [];

      if (raw && typeof (raw as AsyncIterable<OpenAiModelItem>)[Symbol.asyncIterator] === 'function') {
        for await (const item of raw as AsyncIterable<OpenAiModelItem>) {
          collected.push(item);
        }
      } else if (raw && Array.isArray((raw as { data?: OpenAiModelItem[] }).data)) {
        collected.push(...((raw as { data?: OpenAiModelItem[] }).data ?? []));
      }

      const models: ProviderModelInfo[] = collected
        .filter((m) => typeof m.id === 'string' && m.id.trim().length > 0)
        .map((m) => ({
          id: m.id.trim(),
          displayName: (m.name ?? m.id).trim(),
          provider: this.provider,
        }));

      return { ok: true, models };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        error: `${this.provider} SDK listModels failed: ${detail}`,
      };
    }
  }

  async runTurn(params: AgentTurnParams, config: ProviderRuntimeConfig): Promise<AgentTurnResult> {
    const resolved = this.resolveConfig(config);
    const client = this.clientFactory({
      apiKey: resolved.apiKey,
      baseURL: resolved.baseURL,
      fetch: config.fetchImpl,
    });

    const cleanModel = params.model.replace(new RegExp(`^${this.provider}:`), '').trim();
    const messages = params.messages.map((m) => {
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        };
      }
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId || 'tool-call',
          content: m.content,
        };
      }
      return { role: m.role, content: m.content };
    });

    const tools =
      params.tools && params.tools.length > 0
        ? params.tools.map((t) => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          }))
        : undefined;

    const stream = await client.chat.completions.create(
      {
        model: cleanModel,
        messages,
        stream: true,
        ...(tools ? { tools } : {}),
      },
      params.signal ? { signal: params.signal } : undefined,
    );

    let fullText = '';
    const pendingCalls = new Map<number, { id: string; name: string; argsRaw: string }>();

    for await (const chunk of stream) {
      if (params.signal?.aborted) {
        return { text: fullText, toolCalls: [], finishReason: 'aborted' };
      }
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;
      if (delta?.content) {
        fullText += delta.content;
        params.onDelta?.(delta.content);
      }
      if (Array.isArray(delta?.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = pendingCalls.get(idx) ?? {
            id: tc.id || `openai-call-${idx + 1}`,
            name: '',
            argsRaw: '',
          };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.argsRaw += tc.function.arguments;
          pendingCalls.set(idx, existing);
        }
      }
    }

    const toolCalls: AgentToolCall[] = [];
    for (const [, pending] of Array.from(pendingCalls.entries()).sort((a, b) => a[0] - b[0])) {
      if (!pending.name) continue;
      let parsedArgs: Record<string, unknown> = {};
      if (pending.argsRaw.trim()) {
        try {
          parsedArgs = JSON.parse(pending.argsRaw) as Record<string, unknown>;
        } catch {
          parsedArgs = { raw: pending.argsRaw };
        }
      }
      const call: AgentToolCall = { id: pending.id, name: pending.name, args: parsedArgs };
      toolCalls.push(call);
      params.onToolCall?.(call);
    }

    return {
      text: fullText,
      toolCalls,
      finishReason: params.signal?.aborted
        ? 'aborted'
        : toolCalls.length > 0
          ? 'tool_calls'
          : 'stop',
    };
  }
}
