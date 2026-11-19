import type { PromptProvider, ProviderModelInfo, ThinkingLevel } from '../../shared/types.js';

export interface AgentToolParameterSchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string };
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AgentToolParameterSchema>;
    required?: string[];
  };
}

export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AgentTurnMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
  toolName?: string;
}

export interface AgentTurnParams {
  model: string;
  messages: AgentTurnMessage[];
  tools?: AgentToolDefinition[];
  thinkingLevel?: ThinkingLevel;
  workspace: string;
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  onToolCall?: (call: AgentToolCall) => void;
}

export interface AgentTurnResult {
  text: string;
  toolCalls: AgentToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'aborted' | 'error';
}

export interface ProviderRuntimeConfig {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ProviderModelListResult {
  ok: boolean;
  models: ProviderModelInfo[];
  error?: string;
}

export interface UnifiedProviderAdapter {
  readonly provider: PromptProvider;
  listModels(config: ProviderRuntimeConfig): Promise<ProviderModelListResult>;
  runTurn(params: AgentTurnParams, config: ProviderRuntimeConfig): Promise<AgentTurnResult>;
}
