import type { ProviderModelInfo } from '../shared/types.js';
import type {
  AgentToolCall,
  AgentTurnParams,
  AgentTurnResult,
  ProviderModelListResult,
  ProviderRuntimeConfig,
  UnifiedProviderAdapter,
} from './providers/providerAdapter.js';

export interface CopilotStreamParams {
  model: string;
  prompt: string;
  systemMessage?: string;
  workspace?: string;
  githubToken?: string;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler?: (args: Record<string, unknown>) => Promise<unknown> | unknown;
  }>;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export interface CopilotSdkAdapterLike {
  listModels(
    githubToken?: string,
  ): Promise<{ ok: boolean; models: ProviderModelInfo[]; error?: string }>;
  streamPrompt(params: CopilotStreamParams): Promise<void>;
  dispose(): Promise<void>;
}

interface SdkSessionEvent {
  type: string;
  data?: {
    deltaContent?: string;
    content?: string;
    message?: string;
  };
}

interface SdkSessionLike {
  on(handler: (event: SdkSessionEvent) => void): () => void;
  sendAndWait(options: { prompt: string }, timeout?: number): Promise<unknown>;
  abort(): Promise<void>;
  disconnect?: () => Promise<void>;
  destroy?: () => Promise<void>;
}

interface SdkClientLike {
  start(): Promise<void>;
  stop(): Promise<unknown>;
  listModels(): Promise<Array<{ id: string; name?: string; policy?: { state?: string } }>>;
  createSession(config: Record<string, unknown>): Promise<SdkSessionLike>;
}

interface SdkModuleLike {
  CopilotClient: new (options?: Record<string, unknown>) => SdkClientLike;
  approveAll: (...args: unknown[]) => unknown;
  defineTool?: (name: string, config: Record<string, unknown>) => unknown;
}

export interface CopilotSdkAdapterOptions {
  sdkLoader?: () => Promise<SdkModuleLike>;
}

const COPILOT_AUTH_ERROR_PATTERN =
  /authorization error|credentials?\s+may\s+be\s+expired|bad\s+credentials?|invalid\s+(?:or\s+expired\s+)?(?:credentials?|token)|token\s+(?:is\s+)?invalid|(?<![\w:])(?:401|403)(?![\w:])|\bunauthorized\b|\bunauthenticated\b|\bnot\s+authenticated\b|\bauthentication\s+failed\b|expired.*(?:token|credential)|(?:token|credential).*expired/i;

export function isCopilotAuthError(message: string): boolean {
  return COPILOT_AUTH_ERROR_PATTERN.test(message);
}

function prefixCopilotSdkError(message: string): string {
  return message.includes('[COPILOT SDK ERROR]')
    ? message
    : `[COPILOT SDK ERROR] ${message}`;
}

function formatCopilotAuthError(detail: string, hadExplicitToken: boolean): string {
  const base = prefixCopilotSdkError(detail);
  const hint = hadExplicitToken
    ? 'Hint: Clear or update the saved GitHub Copilot token in Settings -> Models & Agents -> GitHub Copilot, or re-authenticate via "gh auth login" / Copilot CLI.'
    : 'Hint: Re-authenticate your local GitHub Copilot session via "gh auth login" or Copilot CLI, and verify your account has active Copilot access.';
  return `${base} ${hint}`;
}

export class CopilotSdkAdapter implements CopilotSdkAdapterLike, UnifiedProviderAdapter {
  readonly provider = 'copilot' as const;
  private readonly sdkLoader: () => Promise<SdkModuleLike>;
  private readonly rejectedAuthTokens = new Set<string>();
  private client: SdkClientLike | null = null;
  private clientTokenKey = '';
  private clientGeneration = 0;
  private disposeGeneration = 0;
  private clientLock: Promise<void> = Promise.resolve();
  private approveAllHandler: ((...args: unknown[]) => unknown) | null = null;
  private defineToolFn: ((name: string, config: Record<string, unknown>) => unknown) | null = null;

  constructor(options: CopilotSdkAdapterOptions = {}) {
    this.sdkLoader =
      options.sdkLoader ??
      (async () => (await import('@github/copilot-sdk')) as unknown as SdkModuleLike);
  }

  private runSerialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.clientLock.then(task);
    this.clientLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private resolveTokenState(githubToken?: string): {
    rawTrimmed: string;
    effectiveToken: string;
  } {
    const rawTrimmed = (githubToken ?? '').trim();
    const effectiveToken =
      rawTrimmed && this.rejectedAuthTokens.has(rawTrimmed) ? '' : rawTrimmed;
    return { rawTrimmed, effectiveToken };
  }

  private async ensureClientWithGeneration(
    githubToken?: string,
    onGeneration?: (generation: number) => void,
  ): Promise<{ client: SdkClientLike; generation: number }> {
    const entryDisposeGen = this.disposeGeneration;
    return this.runSerialized(async () => {
      if (this.disposeGeneration !== entryDisposeGen) {
        throw new Error('Copilot client was disposed during startup.');
      }

      const { effectiveToken } = this.resolveTokenState(githubToken);
      if (this.client && this.clientTokenKey === effectiveToken) {
        onGeneration?.(this.clientGeneration);
        return { client: this.client, generation: this.clientGeneration };
      }
      if (this.client) {
        await this.stopActiveClientLocked();
      }

      const startupGen = this.clientGeneration;
      onGeneration?.(startupGen);

      const sdk = await this.sdkLoader();
      if (this.clientGeneration !== startupGen || this.disposeGeneration !== entryDisposeGen) {
        throw new Error('Copilot client was disposed during startup.');
      }

      this.approveAllHandler = sdk.approveAll ?? (() => ({ kind: 'approved' }));
      this.defineToolFn = sdk.defineTool ?? null;
      const clientOptions: Record<string, unknown> = effectiveToken
        ? { gitHubToken: effectiveToken, useLoggedInUser: false }
        : { useLoggedInUser: true };

      const client = new sdk.CopilotClient(clientOptions);
      await client.start();
      if (this.clientGeneration !== startupGen || this.disposeGeneration !== entryDisposeGen) {
        try {
          await client.stop();
        } catch {
          // Ignore stop errors
        }
        throw new Error('Copilot client was disposed during startup.');
      }

      this.client = client;
      this.clientTokenKey = effectiveToken;
      return { client, generation: this.clientGeneration };
    });
  }

  private async runWithAuthFallback<T>(options: {
    githubToken?: string;
    operation: (
      token: string,
      onGeneration: (generation: number) => void,
    ) => Promise<T>;
    canRetry?: () => boolean;
    isAborted?: () => boolean;
    abortedValue?: T;
    formatAuthFailure: (detail: string, hadExplicitToken: boolean) => T;
    formatNonAuthFailure: (err: unknown, isRetry: boolean) => T;
  }): Promise<T> {
    if (options.isAborted?.()) {
      return options.abortedValue as T;
    }

    const entryDisposeGen = this.disposeGeneration;
    const { rawTrimmed, effectiveToken } = this.resolveTokenState(options.githubToken);
    let activeGen = -1;

    try {
      return await options.operation(effectiveToken, (gen) => {
        activeGen = gen;
      });
    } catch (err) {
      if (options.isAborted?.()) {
        return options.abortedValue as T;
      }

      const detail = err instanceof Error ? err.message : String(err);
      if (!isCopilotAuthError(detail)) {
        return options.formatNonAuthFailure(err, false);
      }

      const isCurrentGen =
        activeGen >= 0 &&
        activeGen === this.clientGeneration &&
        entryDisposeGen === this.disposeGeneration;
      if (effectiveToken && isCurrentGen) {
        this.rejectedAuthTokens.add(effectiveToken);
      }

      if (activeGen >= 0) {
        await this.disposeClientIfGeneration(activeGen);
      }

      if (options.isAborted?.()) {
        return options.abortedValue as T;
      }

      const canRetry =
        Boolean(effectiveToken) &&
        entryDisposeGen === this.disposeGeneration &&
        (options.canRetry ? options.canRetry() : true);

      if (canRetry) {
        let retryGen = -1;
        try {
          return await options.operation('', (gen) => {
            retryGen = gen;
          });
        } catch (retryErr) {
          if (options.isAborted?.()) {
            return options.abortedValue as T;
          }
          const retryDetail = retryErr instanceof Error ? retryErr.message : String(retryErr);
          if (isCopilotAuthError(retryDetail)) {
            if (retryGen >= 0) {
              await this.disposeClientIfGeneration(retryGen);
            }
            if (options.isAborted?.()) {
              return options.abortedValue as T;
            }
            return options.formatAuthFailure(retryDetail, Boolean(rawTrimmed));
          }
          return options.formatNonAuthFailure(retryErr, true);
        }
      }

      return options.formatAuthFailure(detail, Boolean(rawTrimmed));
    }
  }

  private async fetchModelsWithToken(
    token: string,
    onGeneration?: (generation: number) => void,
  ): Promise<{ ok: true; models: ProviderModelInfo[] }> {
    const { client } = await this.ensureClientWithGeneration(token, onGeneration);
    const rawModels = await client.listModels();
    const models: ProviderModelInfo[] = (rawModels ?? [])
      .filter((m) => typeof m.id === 'string' && m.id.trim().length > 0)
      .map((m) => ({
        id: m.id.trim(),
        displayName: (m.name ?? m.id).trim(),
        provider: 'copilot',
        description: m.policy?.state,
      }));
    return { ok: true, models };
  }

  async listModels(
    tokenOrConfig?: string | ProviderRuntimeConfig,
  ): Promise<ProviderModelListResult> {
    const githubToken =
      typeof tokenOrConfig === 'string' ? tokenOrConfig : tokenOrConfig?.apiKey;
    return this.runWithAuthFallback<ProviderModelListResult>({
      githubToken,
      operation: (token, onGeneration) => this.fetchModelsWithToken(token, onGeneration),
      formatAuthFailure: (detail, hadExplicitToken) => ({
        ok: false,
        models: [],
        error: `Copilot SDK listModels failed: ${formatCopilotAuthError(detail, hadExplicitToken)}`,
      }),
      formatNonAuthFailure: (err, isRetry) => {
        const detail = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          models: [],
          error: isRetry
            ? `Copilot SDK listModels failed: ${detail}`
            : `Copilot SDK listModels failed: ${detail}. Ensure GitHub Copilot CLI is installed and signed in (or provide a valid Copilot token).`,
        };
      },
    });
  }

  async runTurn(params: AgentTurnParams, config: ProviderRuntimeConfig): Promise<AgentTurnResult> {
    const systemMessage = params.messages
      .filter((m) => m.role === 'system' && m.content.trim())
      .map((m) => m.content.trim())
      .join('\n\n');
    const conversationPrompt = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n');

    let fullText = '';
    const toolCalls: AgentToolCall[] = [];
    let callIdx = 0;

    const sdkTools = params.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
      handler: async (args: Record<string, unknown>) => {
        callIdx += 1;
        const call: AgentToolCall = {
          id: `copilot-call-${callIdx}`,
          name: t.name,
          args: args ?? {},
        };
        toolCalls.push(call);
        params.onToolCall?.(call);
        return { captured: true };
      },
    }));

    await this.streamPrompt({
      model: params.model.replace(/^copilot:/, '').trim(),
      prompt: conversationPrompt,
      systemMessage: systemMessage || undefined,
      workspace: params.workspace,
      githubToken: config.apiKey,
      tools: sdkTools,
      onDelta: (delta) => {
        fullText += delta;
        params.onDelta?.(delta);
      },
      signal: params.signal,
    });

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

  private async executeStreamOnce(
    params: CopilotStreamParams,
    token: string,
    onGeneration?: (generation: number) => void,
  ): Promise<void> {
    if (params.signal?.aborted) {
      return;
    }

    const { client } = await this.ensureClientWithGeneration(token, onGeneration);
    if (params.signal?.aborted) {
      return;
    }

    const tools =
      params.tools && params.tools.length > 0 && this.defineToolFn
        ? params.tools.map((t) =>
            this.defineToolFn!(t.name, {
              description: t.description,
              parameters: t.parameters,
              handler: t.handler ?? (async () => ({ ok: true })),
            }),
          )
        : undefined;
    const session = await client.createSession({
      model: params.model,
      streaming: true,
      onPermissionRequest: this.approveAllHandler ?? (() => ({ kind: 'approved' })),
      ...(params.workspace ? { workingDirectory: params.workspace } : {}),
      ...(params.systemMessage
        ? { systemMessage: { mode: 'append', content: params.systemMessage } }
        : {}),
      ...(tools ? { tools } : {}),
    });

    let deltaCount = 0;
    let finalContent = '';
    let sessionError = '';

    const unsubscribe = session.on((event) => {
      if (event.type === 'assistant.message_delta') {
        const delta = event.data?.deltaContent ?? '';
        if (delta) {
          deltaCount += 1;
          params.onDelta(delta);
        }
      } else if (event.type === 'assistant.message') {
        finalContent = event.data?.content ?? '';
      } else if (event.type === 'session.error') {
        sessionError = event.data?.message || 'Copilot session error';
      }
    });

    const onAbort = () => {
      void session.abort().catch(() => {});
    };

    params.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      if (params.signal?.aborted) {
        onAbort();
        return;
      }
      await session.sendAndWait({ prompt: params.prompt });
      if (params.signal?.aborted) {
        return;
      }
      if (sessionError) {
        throw new Error(prefixCopilotSdkError(sessionError));
      }
      if (deltaCount === 0 && finalContent) {
        params.onDelta(finalContent);
      }
    } finally {
      unsubscribe();
      params.signal?.removeEventListener('abort', onAbort);
      await this.closeSession(session);
    }
  }

  async streamPrompt(params: CopilotStreamParams): Promise<void> {
    let emittedAnyDelta = false;
    const trackedParams: CopilotStreamParams = {
      ...params,
      onDelta: (text) => {
        emittedAnyDelta = true;
        params.onDelta(text);
      },
    };

    await this.runWithAuthFallback<void>({
      githubToken: params.githubToken,
      operation: (token, onGeneration) =>
        this.executeStreamOnce(trackedParams, token, onGeneration),
      canRetry: () => !emittedAnyDelta,
      isAborted: () => Boolean(params.signal?.aborted),
      abortedValue: undefined,
      formatAuthFailure: (detail, hadExplicitToken) => {
        throw new Error(formatCopilotAuthError(detail, hadExplicitToken));
      },
      formatNonAuthFailure: (err) => {
        throw err;
      },
    });
  }

  private async closeSession(session: SdkSessionLike): Promise<void> {
    try {
      if (typeof session.disconnect === 'function') {
        await session.disconnect();
      } else if (typeof session.destroy === 'function') {
        await session.destroy();
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private async stopActiveClientLocked(): Promise<void> {
    const active = this.client;
    this.clientGeneration += 1;
    this.client = null;
    this.clientTokenKey = '';
    if (active) {
      try {
        await active.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }

  private async disposeClientIfGeneration(generation: number): Promise<void> {
    await this.runSerialized(async () => {
      if (this.client && this.clientGeneration === generation) {
        await this.stopActiveClientLocked();
      }
    });
  }

  async dispose(): Promise<void> {
    this.rejectedAuthTokens.clear();
    this.disposeGeneration += 1;
    this.clientGeneration += 1;
    await this.runSerialized(() => this.stopActiveClientLocked());
  }
}

export const defaultCopilotSdkAdapter = new CopilotSdkAdapter();
