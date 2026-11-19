import { Ollama } from 'ollama';
import type { ProviderModelInfo } from '../../shared/types.js';
import type {
  AgentToolCall,
  AgentTurnParams,
  AgentTurnResult,
  ProviderModelListResult,
  ProviderRuntimeConfig,
  UnifiedProviderAdapter,
} from './providerAdapter.js';

interface OllamaChatChunk {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function?: {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    }>;
  };
  done?: boolean;
}

export interface OllamaClientLike {
  list: () => Promise<{ models?: Array<{ name?: string; model?: string }> }>;
  chat: (body: Record<string, unknown>) => Promise<AsyncIterable<OllamaChatChunk>>;
}

export type OllamaClientFactory = (opts: {
  host: string;
  fetch?: typeof fetch;
}) => OllamaClientLike;

export class OllamaSdkAdapter implements UnifiedProviderAdapter {
  readonly provider = 'ollama' as const;
  private readonly clientFactory: OllamaClientFactory;

  constructor(clientFactory?: OllamaClientFactory) {
    this.clientFactory =
      clientFactory ??
      ((opts) =>
        new Ollama({
          host: opts.host,
          ...(opts.fetch ? { fetch: opts.fetch } : {}),
        }) as unknown as OllamaClientLike);
  }

  async listModels(config: ProviderRuntimeConfig): Promise<ProviderModelListResult> {
    const host = (config.baseUrl ?? 'http://localhost:11434').trim().replace(/\/+$/, '');
    try {
      const client = this.clientFactory({ host, fetch: config.fetchImpl });
      const res = await client.list();
      const models: ProviderModelInfo[] = (res.models ?? [])
        .map((m) => (m.name ?? m.model ?? '').trim())
        .filter(Boolean)
        .map((name) => ({
          id: name,
          displayName: name,
          provider: 'ollama',
        }));
      return { ok: true, models };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        error: `Ollama unreachable at ${host}: ${detail}`,
      };
    }
  }

  async runTurn(params: AgentTurnParams, config: ProviderRuntimeConfig): Promise<AgentTurnResult> {
    const host = (config.baseUrl ?? 'http://localhost:11434').trim().replace(/\/+$/, '');
    const client = this.clientFactory({ host, fetch: config.fetchImpl });

    const cleanModel = params.model.replace(/^ollama:/, '').trim();
    const messages = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

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

    const stream = await client.chat({
      model: cleanModel,
      messages,
      stream: true,
      ...(tools ? { tools } : {}),
    });

    let fullText = '';
    const toolCalls: AgentToolCall[] = [];
    let callIdx = 0;

    for await (const chunk of stream) {
      if (params.signal?.aborted) {
        return { text: fullText, toolCalls, finishReason: 'aborted' };
      }
      if (chunk.message?.content) {
        fullText += chunk.message.content;
        params.onDelta?.(chunk.message.content);
      }
      if (Array.isArray(chunk.message?.tool_calls)) {
        for (const tc of chunk.message.tool_calls) {
          if (!tc.function?.name) continue;
          callIdx += 1;
          const call: AgentToolCall = {
            id: `ollama-call-${callIdx}`,
            name: tc.function.name,
            args: tc.function.arguments ?? {},
          };
          toolCalls.push(call);
          params.onToolCall?.(call);
        }
      }
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
