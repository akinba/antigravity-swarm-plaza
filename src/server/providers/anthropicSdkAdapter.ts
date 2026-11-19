import Anthropic from '@anthropic-ai/sdk';
import type { ProviderModelInfo } from '../../shared/types.js';
import type {
  AgentToolCall,
  AgentTurnParams,
  AgentTurnResult,
  ProviderModelListResult,
  ProviderRuntimeConfig,
  UnifiedProviderAdapter,
} from './providerAdapter.js';

interface AnthropicModelItem {
  id: string;
  display_name?: string;
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  content_block?: {
    type?: string;
    id?: string;
    name?: string;
  };
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
  };
}

export interface AnthropicClientLike {
  models: {
    list: () => Promise<AsyncIterable<AnthropicModelItem> | { data?: AnthropicModelItem[] }>;
  };
  messages: {
    create: (
      body: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ) => Promise<AsyncIterable<AnthropicStreamEvent>>;
  };
}

export type AnthropicClientFactory = (opts: {
  apiKey: string;
  fetch?: typeof fetch;
}) => AnthropicClientLike;

export class AnthropicSdkAdapter implements UnifiedProviderAdapter {
  readonly provider = 'anthropic' as const;
  private readonly clientFactory: AnthropicClientFactory;

  constructor(clientFactory?: AnthropicClientFactory) {
    this.clientFactory =
      clientFactory ??
      ((opts) =>
        new Anthropic({
          apiKey: opts.apiKey,
          ...(opts.fetch ? { fetch: opts.fetch } : {}),
        }) as unknown as AnthropicClientLike);
  }

  async listModels(config: ProviderRuntimeConfig): Promise<ProviderModelListResult> {
    const apiKey = config.apiKey?.trim() ?? '';
    if (!apiKey) {
      return { ok: false, models: [], error: 'Anthropic API key is not configured.' };
    }

    try {
      const client = this.clientFactory({ apiKey, fetch: config.fetchImpl });
      const raw = await client.models.list();
      const collected: AnthropicModelItem[] = [];

      if (raw && typeof (raw as AsyncIterable<AnthropicModelItem>)[Symbol.asyncIterator] === 'function') {
        for await (const item of raw as AsyncIterable<AnthropicModelItem>) {
          collected.push(item);
        }
      } else if (raw && Array.isArray((raw as { data?: AnthropicModelItem[] }).data)) {
        collected.push(...((raw as { data?: AnthropicModelItem[] }).data ?? []));
      }

      const models: ProviderModelInfo[] = collected
        .filter((m) => typeof m.id === 'string' && m.id.trim().length > 0)
        .map((m) => ({
          id: m.id.trim(),
          displayName: (m.display_name ?? m.id).trim(),
          provider: 'anthropic',
        }));

      return { ok: true, models };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        error: `Anthropic SDK listModels failed: ${detail}`,
      };
    }
  }

  async runTurn(params: AgentTurnParams, config: ProviderRuntimeConfig): Promise<AgentTurnResult> {
    const apiKey = config.apiKey?.trim() ?? '';
    if (!apiKey) {
      throw new Error(
        '[ANTHROPIC API NOT CONFIGURED] Configure Anthropic API key in Settings -> Cloud APIs.',
      );
    }

    const client = this.clientFactory({ apiKey, fetch: config.fetchImpl });
    const systemText = params.messages
      .filter((m) => m.role === 'system' && m.content.trim())
      .map((m) => m.content.trim())
      .join('\n\n');

    const messages = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          const blocks: Array<Record<string, unknown>> = [];
          if (m.content) blocks.push({ type: 'text', text: m.content });
          for (const tc of m.toolCalls) {
            blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
          }
          return { role: 'assistant', content: blocks };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.toolCallId || 'tool-call',
                content: m.content,
              },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

    const tools =
      params.tools && params.tools.length > 0
        ? params.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
          }))
        : undefined;

    const cleanModel = params.model.replace(/^anthropic:/, '').trim();
    const stream = await client.messages.create(
      {
        model: cleanModel,
        max_tokens: 4096,
        ...(systemText ? { system: systemText } : {}),
        messages,
        ...(tools ? { tools } : {}),
        stream: true,
      },
      params.signal ? { signal: params.signal } : undefined,
    );

    let fullText = '';
    const activeToolBlocks = new Map<number, { id: string; name: string; jsonBuf: string }>();
    const toolCalls: AgentToolCall[] = [];

    for await (const event of stream) {
      if (params.signal?.aborted) {
        return { text: fullText, toolCalls, finishReason: 'aborted' };
      }
      if (
        event.type === 'content_block_start' &&
        event.content_block?.type === 'tool_use' &&
        event.content_block.name
      ) {
        const idx = event.index ?? 0;
        activeToolBlocks.set(idx, {
          id: event.content_block.id || `anthropic-call-${idx + 1}`,
          name: event.content_block.name,
          jsonBuf: '',
        });
      } else if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'text_delta' && event.delta.text) {
          fullText += event.delta.text;
          params.onDelta?.(event.delta.text);
        } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
          const idx = event.index ?? 0;
          const block = activeToolBlocks.get(idx);
          if (block) {
            block.jsonBuf += event.delta.partial_json;
          }
        }
      } else if (event.type === 'content_block_stop') {
        const idx = event.index ?? 0;
        const block = activeToolBlocks.get(idx);
        if (block) {
          activeToolBlocks.delete(idx);
          let args: Record<string, unknown> = {};
          if (block.jsonBuf.trim()) {
            try {
              args = JSON.parse(block.jsonBuf) as Record<string, unknown>;
            } catch {
              args = { raw: block.jsonBuf };
            }
          }
          const call: AgentToolCall = { id: block.id, name: block.name, args };
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
