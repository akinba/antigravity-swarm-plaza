import type { PromptProvider } from '../../shared/types.js';
import { CopilotSdkAdapter, defaultCopilotSdkAdapter } from '../copilotSdkAdapter.js';
import { AnthropicSdkAdapter } from './anthropicSdkAdapter.js';
import { GeminiSdkAdapter } from './geminiSdkAdapter.js';
import { OllamaSdkAdapter } from './ollamaSdkAdapter.js';
import { OpenAiCompatibleSdkAdapter } from './openaiSdkAdapter.js';
import type { UnifiedProviderAdapter } from './providerAdapter.js';

export type {
  AgentToolCall,
  AgentToolDefinition,
  AgentToolParameterSchema,
  AgentTurnMessage,
  AgentTurnParams,
  AgentTurnResult,
  ProviderModelListResult,
  ProviderRuntimeConfig,
  UnifiedProviderAdapter,
} from './providerAdapter.js';
export {
  GeminiSdkAdapter,
  isVertexExpressApiKey,
  stripGeminiModelPrefix,
} from './geminiSdkAdapter.js';
export {
  OPENAI_COMPAT_BASE_URLS,
  OpenAiCompatibleSdkAdapter,
  type OpenAiCompatibleProvider,
} from './openaiSdkAdapter.js';
export { AnthropicSdkAdapter } from './anthropicSdkAdapter.js';
export { OllamaSdkAdapter } from './ollamaSdkAdapter.js';
export { CopilotSdkAdapter };

export interface ProviderRegistryOptions {
  copilotAdapter?: CopilotSdkAdapter;
}

export function createProviderRegistry(
  options: ProviderRegistryOptions = {},
): Record<PromptProvider, UnifiedProviderAdapter> {
  return {
    gemini: new GeminiSdkAdapter(),
    openai: new OpenAiCompatibleSdkAdapter('openai'),
    openrouter: new OpenAiCompatibleSdkAdapter('openrouter'),
    deepseek: new OpenAiCompatibleSdkAdapter('deepseek'),
    groq: new OpenAiCompatibleSdkAdapter('groq'),
    xai: new OpenAiCompatibleSdkAdapter('xai'),
    mistral: new OpenAiCompatibleSdkAdapter('mistral'),
    lmstudio: new OpenAiCompatibleSdkAdapter('lmstudio'),
    custom: new OpenAiCompatibleSdkAdapter('custom'),
    anthropic: new AnthropicSdkAdapter(),
    ollama: new OllamaSdkAdapter(),
    copilot: options.copilotAdapter ?? defaultCopilotSdkAdapter,
  };
}
