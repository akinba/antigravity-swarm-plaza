import type { ProviderModelInfo } from '../shared/types.js';

export interface CopilotStreamParams {
  model: string;
  prompt: string;
  systemMessage?: string;
  workspace?: string;
  githubToken?: string;
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
}

export interface CopilotSdkAdapterOptions {
  sdkLoader?: () => Promise<SdkModuleLike>;
}

export class CopilotSdkAdapter implements CopilotSdkAdapterLike {
  private readonly sdkLoader: () => Promise<SdkModuleLike>;
  private client: SdkClientLike | null = null;
  private clientTokenKey = '';
  private approveAllHandler: ((...args: unknown[]) => unknown) | null = null;

  constructor(options: CopilotSdkAdapterOptions = {}) {
    this.sdkLoader =
      options.sdkLoader ??
      (async () => (await import('@github/copilot-sdk')) as unknown as SdkModuleLike);
  }

  private async ensureClient(githubToken?: string): Promise<SdkClientLike> {
    const trimmed = (githubToken ?? '').trim();
    if (this.client && this.clientTokenKey === trimmed) {
      return this.client;
    }
    if (this.client) {
      await this.dispose();
    }

    const sdk = await this.sdkLoader();
    this.approveAllHandler = sdk.approveAll ?? (() => ({ kind: 'approved' }));
    const clientOptions: Record<string, unknown> = trimmed
      ? { gitHubToken: trimmed, useLoggedInUser: false }
      : { useLoggedInUser: true };

    const client = new sdk.CopilotClient(clientOptions);
    await client.start();
    this.client = client;
    this.clientTokenKey = trimmed;
    return client;
  }

  async listModels(
    githubToken?: string,
  ): Promise<{ ok: boolean; models: ProviderModelInfo[]; error?: string }> {
    try {
      const client = await this.ensureClient(githubToken);
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
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        models: [],
        error: `Copilot SDK listModels failed: ${detail}. Ensure GitHub Copilot CLI is installed and signed in (or provide a valid Copilot token).`,
      };
    }
  }

  async streamPrompt(params: CopilotStreamParams): Promise<void> {
    const client = await this.ensureClient(params.githubToken);
    const session = await client.createSession({
      model: params.model,
      streaming: true,
      onPermissionRequest: this.approveAllHandler ?? (() => ({ kind: 'approved' })),
      ...(params.workspace ? { workingDirectory: params.workspace } : {}),
      ...(params.systemMessage
        ? { systemMessage: { mode: 'append', content: params.systemMessage } }
        : {}),
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

    if (params.signal) {
      if (params.signal.aborted) {
        onAbort();
        unsubscribe();
        await this.closeSession(session);
        return;
      }
      params.signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      await session.sendAndWait({ prompt: params.prompt });
      if (params.signal?.aborted) {
        return;
      }
      if (sessionError) {
        throw new Error(`[COPILOT SDK ERROR] ${sessionError}`);
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

  async dispose(): Promise<void> {
    const active = this.client;
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
}

export const defaultCopilotSdkAdapter = new CopilotSdkAdapter();
