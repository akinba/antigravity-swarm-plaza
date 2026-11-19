import { GoogleGenAI } from '@google/genai';
import type { ProviderModelInfo } from '../../shared/types.js';
import type {
  AgentToolCall,
  AgentTurnParams,
  AgentTurnResult,
  ProviderModelListResult,
  ProviderRuntimeConfig,
  UnifiedProviderAdapter,
} from './providerAdapter.js';

interface GeminiStreamChunk {
  text?: string;
  functionCalls?: Array<{
    id?: string;
    name?: string;
    args?: Record<string, unknown>;
  }>;
}

interface GeminiListedModel {
  name?: string;
  displayName?: string;
  description?: string;
  supportedActions?: string[];
  supportedGenerationMethods?: string[];
}

export interface GeminiClientLike {
  models: {
    list: () => Promise<AsyncIterable<GeminiListedModel> | { models?: GeminiListedModel[] }>;
    generateContentStream: (params: Record<string, unknown>) => Promise<AsyncIterable<GeminiStreamChunk>>;
  };
}

export type GeminiClientFactory = (opts: { apiKey: string; vertexai?: boolean }) => GeminiClientLike;

const VERTEX_EXPRESS_DEFAULT_MODELS: readonly ProviderModelInfo[] = [
  { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash (Vertex Express)', provider: 'gemini' },
  { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro (Vertex Express)', provider: 'gemini' },
  { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash (Vertex Express)', provider: 'gemini' },
];

export function isVertexExpressApiKey(apiKey?: string): boolean {
  return Boolean(apiKey && apiKey.trim().startsWith('AQ.'));
}

export function stripGeminiModelPrefix(model: string): string {
  const clean = model.replace(/^(?:gemini:|models\/)/, '').trim();
  if (clean === 'gemini-4-carbon-medium') return 'gemini-2.5-pro';
  if (
    clean === 'gemini-4-argon-medium' ||
    clean === 'gemini-4-hydrogen-medium' ||
    clean === 'gemini-3.8-flash-fast'
  ) {
    return 'gemini-2.5-flash';
  }
  return clean || 'gemini-2.5-flash';
}

export class GeminiSdkAdapter implements UnifiedProviderAdapter {
  readonly provider = 'gemini' as const;
  private readonly clientFactory: GeminiClientFactory;

  constructor(clientFactory?: GeminiClientFactory) {
    this.clientFactory =
      clientFactory ??
      ((opts) =>
        new GoogleGenAI(
          opts.vertexai ? { apiKey: opts.apiKey, vertexai: true } : { apiKey: opts.apiKey },
        ) as unknown as GeminiClientLike);
  }

  async listModels(config: ProviderRuntimeConfig): Promise<ProviderModelListResult> {
    const apiKey = config.apiKey?.trim() ?? '';
    if (!apiKey) {
      return { ok: false, models: [], error: 'Gemini API key is not configured.' };
    }

    if (isVertexExpressApiKey(apiKey)) {
      return {
        ok: true,
        models: VERTEX_EXPRESS_DEFAULT_MODELS.map((m) => ({ ...m })),
      };
    }

    try {
      const client = this.clientFactory({ apiKey, vertexai: false });
      const raw = await client.models.list();
      const collected: GeminiListedModel[] = [];

      if (raw && typeof (raw as AsyncIterable<GeminiListedModel>)[Symbol.asyncIterator] === 'function') {
        for await (const item of raw as AsyncIterable<GeminiListedModel>) {
          collected.push(item);
        }
      } else if (raw && Array.isArray((raw as { models?: GeminiListedModel[] }).models)) {
        collected.push(...((raw as { models?: GeminiListedModel[] }).models ?? []));
      }

      const models: ProviderModelInfo[] = collected
        .filter((m) => {
          if (typeof m.name !== 'string' || !m.name.trim()) return false;
          const actions = m.supportedActions ?? m.supportedGenerationMethods;
          if (Array.isArray(actions) && actions.length > 0) {
            return actions.includes('generateContent');
          }
          return m.name.includes('gemini');
        })
        .map((m) => {
          const id = m.name!.replace(/^models\//, '').trim();
          return {
            id,
            displayName: (m.displayName ?? id).trim(),
            provider: 'gemini',
            description: m.description,
          };
        });

      return { ok: true, models };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        error: `Gemini SDK listModels failed: ${detail}`,
      };
    }
  }

  async runTurn(params: AgentTurnParams, config: ProviderRuntimeConfig): Promise<AgentTurnResult> {
    const apiKey = config.apiKey?.trim() ?? '';
    if (!apiKey) {
      throw new Error('[GEMINI API NOT CONFIGURED] Configure Gemini API key in Settings -> Cloud APIs.');
    }

    const vertexai = isVertexExpressApiKey(apiKey);
    const client = this.clientFactory({ apiKey, vertexai });

    const systemParts = params.messages
      .filter((m) => m.role === 'system' && m.content.trim())
      .map((m) => m.content.trim());
    const systemInstruction = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'assistant') {
          const parts: Array<Record<string, unknown>> = [];
          if (m.content) parts.push({ text: m.content });
          if (m.toolCalls && m.toolCalls.length > 0) {
            for (const tc of m.toolCalls) {
              parts.push({ functionCall: { name: tc.name, args: tc.args } });
            }
          }
          return { role: 'model', parts: parts.length > 0 ? parts : [{ text: '' }] };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: m.toolName || 'tool',
                  response: { result: m.content },
                },
              },
            ],
          };
        }
        return { role: 'user', parts: [{ text: m.content }] };
      });

    const tools =
      params.tools && params.tools.length > 0
        ? [
            {
              functionDeclarations: params.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          ]
        : undefined;

    const stream = await client.models.generateContentStream({
      model: stripGeminiModelPrefix(params.model),
      contents,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(tools ? { tools } : {}),
        ...(params.signal ? { abortSignal: params.signal } : {}),
      },
    });

    let fullText = '';
    const toolCalls: AgentToolCall[] = [];
    let callCounter = 0;

    for await (const chunk of stream) {
      if (params.signal?.aborted) {
        return { text: fullText, toolCalls, finishReason: 'aborted' };
      }
      if (chunk.text) {
        fullText += chunk.text;
        params.onDelta?.(chunk.text);
      }
      if (Array.isArray(chunk.functionCalls)) {
        for (const fc of chunk.functionCalls) {
          if (!fc.name) continue;
          callCounter += 1;
          const call: AgentToolCall = {
            id: fc.id || `gemini-call-${callCounter}`,
            name: fc.name,
            args: fc.args ?? {},
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
