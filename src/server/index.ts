import cors from 'cors';
import express, { type Express } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  AccountProvider,
  AgentDetailResponse,
  ApprovalDecision,
  OfficeEmployee,
  PlazaSnapshot,
  PromptRequest,
  PromptStreamEvent,
} from '../shared/types.js';
import { AccountAuthManager, defaultAccountAuthManager } from './accountAuth.js';
import { readAgentLogs } from './brainScanner.js';
import {
  AGY_DATA_DIR,
  BIND_HOST,
  CURRENT_WORKSPACE,
  PORT,
  resolveSidecarToken,
} from './config.js';
import { getDemoAgentLogs, getDemoEmployee, resetDemoTick } from './demoSimulator.js';
import { buildPlazaSnapshot } from './gamification.js';
import { listDriveEntries, pullDriveFolder, pushDriveFolder } from './googleDriveSync.js';
import { WorkspaceManager } from './workspaceManager.js';
import {
  InvalidDiffPathError,
  InvalidOllamaUrlError,
  PromptConflictError,
  PromptRunner,
  defaultPromptRunner,
  isCloudProviderId,
  isPromptProvider,
} from './promptRunner.js';
import {
  canTriggerAutoFloorEvent,
  rerollFloorLayout,
  scheduleFloorEvent,
  triggerFloorEvent,
  tryTriggerAutoFloorEvent,
} from './officeEvents.js';

export interface PlazaAppOptions {
  agyDataDir?: string;
  currentWorkspace?: string;
  initialDemoMode?: boolean;
  broadcastIntervalMs?: number;
  clientDistDir?: string;
  sidecarToken?: string;
  promptRunner?: PromptRunner;
  accountAuth?: AccountAuthManager;
  workspaceManager?: WorkspaceManager;
}

export interface PlazaAppInstance {
  app: Express;
  server: http.Server;
  wss: WebSocketServer;
  getSnapshot: () => PlazaSnapshot;
  broadcastSnapshot: () => PlazaSnapshot;
  close: () => Promise<void>;
}

export function rewriteHtmlWithSidecarToken(
  html: string,
  token: string,
  conversationId = '',
): string {
  if (!token) return html;
  const q =
    'token=' +
    encodeURIComponent(token) +
    (conversationId ? '&conversationId=' + encodeURIComponent(conversationId) : '');

  return html.replace(
    /\b(href|src)=(["'])(\/[^"'\s>]*)\2/g,
    (fullMatch, attr: string, quote: string, url: string) => {
      if (url.startsWith('//')) return fullMatch;
      const hashIdx = url.indexOf('#');
      const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
      const hashSuffix = hashIdx >= 0 ? url.slice(hashIdx) : '';
      const sep = base.includes('?') ? '&' : '?';
      return `${attr}=${quote}${base}${sep}${q}${hashSuffix}${quote}`;
    },
  );
}

export function createPlazaApp(options: PlazaAppOptions = {}): PlazaAppInstance {
  const agyDataDir = options.agyDataDir ?? AGY_DATA_DIR;
  const currentWorkspace = options.currentWorkspace ?? CURRENT_WORKSPACE;
  let demoMode = options.initialDemoMode ?? false;
  const broadcastIntervalMs = options.broadcastIntervalMs ?? 1500;
  const activeToken = options.sidecarToken ?? resolveSidecarToken();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/preload.js', (_req, res) => {
    res.type('application/javascript').send(`(function () {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('token') || '';
  var conversationId = params.get('conversationId') || '';
  window.sidecar = window.sidecar || { token: token, conversationId: conversationId };
  if (token && typeof window.fetch === 'function') {
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var nextInit = Object.assign({}, init || {});
      var headers = new Headers(nextInit.headers || undefined);
      if (!headers.has('X-Sidecar-Token')) {
        headers.set('X-Sidecar-Token', token);
      }
      nextInit.headers = headers;
      return origFetch(input, nextInit);
    };
  }
})();`);
  });

  if (activeToken) {
    app.use('/api', (req, res, next) => {
      if (req.method === 'GET') {
        next();
        return;
      }
      const headerToken = req.headers['x-sidecar-token'];
      const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
      const provided = typeof headerToken === 'string' ? headerToken : queryToken;
      if (provided !== activeToken) {
        res.status(401).json({ error: 'Unauthorized sidecar request' });
        return;
      }
      next();
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const promptRunner = options.promptRunner ?? defaultPromptRunner;
  const accountAuth = options.accountAuth ?? defaultAccountAuthManager;
  const workspaceManager = options.workspaceManager ?? new WorkspaceManager();
  const sseClients = new Set<express.Response>();

  const getSnapshot = (): PlazaSnapshot =>
    buildPlazaSnapshot(
      agyDataDir,
      currentWorkspace,
      demoMode,
      promptRunner.getActiveOverrides(),
      promptRunner.getActiveSwarmBoardSnapshot(),
      workspaceManager.listWorkspaces(),
    );

  const broadcastSnapshot = (): PlazaSnapshot => {
    const snapshot = getSnapshot();
    const payload = JSON.stringify({ type: 'plaza_snapshot', data: snapshot });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
    return snapshot;
  };

  const unsubscribePrompt = promptRunner.subscribe((event: PromptStreamEvent) => {
    const ssePayload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(ssePayload);
      } catch {
        sseClients.delete(client);
      }
    }
    const wsPayload = JSON.stringify({ type: 'prompt_event', payload: event });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(wsPayload);
      }
    }
    if (
      event.type === 'status' ||
      event.type === 'file' ||
      event.type === 'tool_call' ||
      event.type === 'board' ||
      event.type === 'approval_request' ||
      event.type === 'approval_resolved' ||
      event.type === 'done' ||
      event.type === 'error'
    ) {
      broadcastSnapshot();
    }
  });

  wss.on('connection', (ws, req) => {
    if (activeToken) {
      const reqUrl = req.url || '';
      const qIndex = reqUrl.indexOf('?');
      const params = new URLSearchParams(qIndex >= 0 ? reqUrl.slice(qIndex) : '');
      const wsToken = params.get('token') || '';
      if (wsToken !== activeToken) {
        ws.close(1008, 'Unauthorized sidecar WebSocket');
        return;
      }
    }
    try {
      const snapshot = getSnapshot();
      ws.send(JSON.stringify({ type: 'plaza_snapshot', data: snapshot }));
    } catch {
      // Ignore send errors on closing socket
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      time: new Date().toISOString(),
      nodeVersion: process.version,
    });
  });

  app.get('/api/plaza', (_req, res) => {
    const snapshot = getSnapshot();
    res.json(snapshot);
  });

  app.get('/api/floors/:floorId', (req, res) => {
    const snapshot = getSnapshot();
    const floor = snapshot.floors.find((f) => f.id === req.params.floorId);
    if (!floor) {
      res.status(404).json({ error: 'Floor not found' });
      return;
    }
    res.json(floor);
  });

  app.get('/api/agents/:agentId/logs', (req, res) => {
    const { agentId } = req.params;
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 25;

    if (agentId.startsWith('demo-')) {
      const demoEmployee = getDemoEmployee(agentId);
      if (!demoEmployee) {
        res.status(404).json({ error: 'Demo agent not found' });
        return;
      }
      const response: AgentDetailResponse = {
        employee: demoEmployee,
        recentLogs: getDemoAgentLogs(agentId, limit),
      };
      res.json(response);
      return;
    }

    const snapshot = getSnapshot();
    let foundEmployee: OfficeEmployee | undefined;
    for (const floor of snapshot.floors) {
      const match = floor.employees.find((e) => e.id === agentId);
      if (match) {
        foundEmployee = match;
        break;
      }
    }

    if (!foundEmployee) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const recentLogs = readAgentLogs(agyDataDir, agentId, limit);
    const response: AgentDetailResponse = {
      employee: foundEmployee,
      recentLogs,
    };
    res.json(response);
  });

  app.post('/api/demo/toggle', (_req, res) => {
    demoMode = !demoMode;
    if (demoMode) {
      resetDemoTick();
    }
    const snapshot = broadcastSnapshot();
    res.json({ demoMode, snapshot });
  });

  app.post('/api/floors/:floorId/reroll', (req, res) => {
    const layoutSeed = rerollFloorLayout(req.params.floorId);
    const snapshot = broadcastSnapshot();
    res.json({ layoutSeed, snapshot });
  });

  app.post('/api/floors/:floorId/event', (req, res) => {
    const body = (req.body ?? {}) as { kind?: import('../shared/types.js').FloorEventKind };
    const snap = getSnapshot();
    const floor = snap.floors.find((f) => f.id === req.params.floorId);
    const activeEvent = triggerFloorEvent(
      req.params.floorId,
      body.kind,
      Date.now(),
      floor?.employees,
    );
    const snapshot = broadcastSnapshot();
    res.json({ activeEvent, snapshot });
  });

  app.post('/api/floors/:floorId/schedule', (req, res) => {
    const body = (req.body ?? {}) as {
      kind?: import('../shared/types.js').FloorEventKind;
      delaySec?: number;
      proposedByName?: string;
    };
    const scheduledEvent = scheduleFloorEvent({
      floorId: req.params.floorId,
      kind: body.kind,
      delaySec: body.delaySec,
      proposedByName: body.proposedByName || 'Chief-Architect',
    });
    const snapshot = broadcastSnapshot();
    res.json({ scheduledEvent, snapshot });
  });

  app.get('/api/prompt/state', (_req, res) => {
    res.json(promptRunner.getState());
  });

  app.get('/api/settings/gemini-key', (_req, res) => {
    res.json(promptRunner.getGeminiApiKeyStatus());
  });

  app.post('/api/settings/gemini-key', (req, res) => {
    const body = (req.body ?? {}) as { apiKey?: unknown };
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
    const status = promptRunner.setGeminiApiKey(apiKey);
    res.json({ ok: true, ...status });
  });

  app.get('/api/settings/provider-key', (req, res) => {
    const provider = typeof req.query.provider === 'string' ? req.query.provider.trim() : '';
    if (!isCloudProviderId(provider)) {
      res.status(400).json({ error: `Unsupported cloud provider: ${provider || '(empty)'}` });
      return;
    }
    res.json(promptRunner.getProviderKeyStatus(provider));
  });

  app.post('/api/settings/provider-key', (req, res) => {
    const body = (req.body ?? {}) as { provider?: unknown; apiKey?: unknown; baseUrl?: unknown };
    const provider = typeof body.provider === 'string' ? body.provider.trim() : '';
    if (!isCloudProviderId(provider)) {
      res.status(400).json({ error: `Unsupported cloud provider: ${provider || '(empty)'}` });
      return;
    }
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl : undefined;
    const status = promptRunner.setProviderKey(provider, apiKey, baseUrl);
    res.json({ ok: true, ...status });
  });

  app.get('/api/ollama/models', async (req, res) => {
    const baseUrl = typeof req.query.baseUrl === 'string' ? req.query.baseUrl : undefined;
    try {
      const result = await promptRunner.fetchOllamaModels(baseUrl);
      res.json(result);
    } catch (err) {
      if (err instanceof InvalidOllamaUrlError) {
        res.status(400).json({ ok: false, models: [], error: err.message });
        return;
      }
      res.status(500).json({
        ok: false,
        models: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/gemini/models', async (_req, res) => {
    const result = await promptRunner.fetchGeminiModels();
    res.json(result);
  });

  app.get('/api/providers/models', async (req, res) => {
    const provider = typeof req.query.provider === 'string' ? req.query.provider.trim() : '';
    if (!isPromptProvider(provider)) {
      res.status(400).json({ ok: false, models: [], error: `Unsupported provider: ${provider}` });
      return;
    }
    const baseUrl = typeof req.query.baseUrl === 'string' ? req.query.baseUrl : undefined;
    try {
      const result = await promptRunner.fetchProviderModels(provider, baseUrl);
      res.json(result);
    } catch (err) {
      if (err instanceof InvalidOllamaUrlError) {
        res.status(400).json({ ok: false, models: [], error: err.message });
        return;
      }
      res.status(500).json({
        ok: false,
        models: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(': connected\n\n');

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.post('/api/prompt', (req, res) => {
    const body = (req.body ?? {}) as Partial<PromptRequest>;
    if (!body.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      res.status(400).json({ error: 'Prompt text is required' });
      return;
    }
    try {
      const { runId } = promptRunner.startPrompt({
        prompt: body.prompt,
        model: body.model ?? 'gemini-2.5-flash',
        mode: body.mode ?? 'turbo',
        orchestration: body.orchestration,
        swarmProfile: Array.isArray(body.swarmProfile) ? body.swarmProfile : undefined,
        mentions: Array.isArray(body.mentions) ? body.mentions : [],
        provider: body.provider,
        customBaseUrl: typeof body.customBaseUrl === 'string' ? body.customBaseUrl : undefined,
        localBaseUrl: body.localBaseUrl,
        localBaseUrls:
          body.localBaseUrls && typeof body.localBaseUrls === 'object'
            ? body.localBaseUrls
            : undefined,
        ollamaBaseUrl: body.ollamaBaseUrl,
        workspace: body.workspace,
        attachments: Array.isArray(body.attachments) ? body.attachments : undefined,
        floorId: body.floorId,
      });
      res.json({ ok: true, runId });
    } catch (err) {
      if (err instanceof PromptConflictError) {
        res.status(409).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/prompt/stop', (_req, res) => {
    const state = promptRunner.stopPrompt();
    broadcastSnapshot();
    res.json({ ok: true, state });
  });

  app.post('/api/prompt/approve', (req, res) => {
    const body = (req.body ?? {}) as { approvalId?: unknown; decision?: unknown };
    const approvalId = typeof body.approvalId === 'string' ? body.approvalId.trim() : '';
    const decision = body.decision;
    if (
      !approvalId ||
      (decision !== 'allow_once' && decision !== 'allow_session' && decision !== 'deny')
    ) {
      res.status(400).json({
        error: "Expected { approvalId: string, decision: 'allow_once' | 'allow_session' | 'deny' }",
      });
      return;
    }
    const resolved = promptRunner.resolveApproval(approvalId, decision as ApprovalDecision);
    if (!resolved) {
      res.status(404).json({ error: `Pending approval '${approvalId}' not found` });
      return;
    }
    res.json({ ok: true, approvalId, decision });
  });

  // --- Account Auth Routes (Google OAuth PKCE & GitHub) ---
  const resolveCallbackBaseUrl = (req: express.Request): string => {
    const proto =
      (typeof req.headers['x-forwarded-proto'] === 'string' && req.headers['x-forwarded-proto']) ||
      req.protocol ||
      'http';
    const host = req.headers.host || `127.0.0.1:${PORT}`;
    return `${proto}://${host}`;
  };

  app.get('/api/auth/accounts', (_req, res) => {
    res.json(accountAuth.getAccountsStatus());
  });

  app.post('/api/auth/google/client', (req, res) => {
    const body = (req.body ?? {}) as { clientId?: unknown; clientSecret?: unknown };
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret : undefined;
    try {
      const account = accountAuth.saveGoogleOAuthClient({ clientId, clientSecret });
      res.json({ ok: true, account });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/auth/google/start', (req, res) => {
    try {
      const result = accountAuth.startGoogleAuth(resolveCallbackBaseUrl(req));
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const result = await accountAuth.handleGoogleCallback(
      code,
      state,
      resolveCallbackBaseUrl(req),
    );
    res.status(result.ok ? 200 : 400).type('text/html; charset=utf-8').send(result.html);
  });

  app.post('/api/auth/github/import-gh', async (_req, res) => {
    const result = await accountAuth.importGhCliAccount();
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/auth/github/device/start', async (req, res) => {
    const body = (req.body ?? {}) as { clientId?: unknown };
    const clientId = typeof body.clientId === 'string' ? body.clientId : undefined;
    const result = await accountAuth.startGitHubDeviceFlow(clientId);
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/auth/github/device/poll', async (req, res) => {
    const body = (req.body ?? {}) as { deviceCode?: unknown; clientId?: unknown };
    const deviceCode = typeof body.deviceCode === 'string' ? body.deviceCode : '';
    const clientId = typeof body.clientId === 'string' ? body.clientId : undefined;
    if (!deviceCode) {
      res.status(400).json({ ok: false, status: 'error', error: 'deviceCode is required' });
      return;
    }
    const result = await accountAuth.pollGitHubDeviceFlow(deviceCode, clientId);
    res.json(result);
  });

  app.delete('/api/auth/accounts/:provider', (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'github') {
      res.status(400).json({ error: `Unsupported account provider: ${provider}` });
      return;
    }
    const account = accountAuth.disconnectAccount(provider as AccountProvider);
    res.json({ ok: true, account });
  });

  // --- Managed Workspace / Project Manager Routes ---
  app.get('/api/workspaces', (_req, res) => {
    res.json({
      workspaces: workspaceManager.listWorkspaces(),
      activeWorkspaceId: workspaceManager.getActiveWorkspaceId(),
    });
  });

  app.get('/api/workspaces/browse', async (req, res) => {
    const dir = typeof req.query.dir === 'string' ? req.query.dir : undefined;
    try {
      const result = await workspaceManager.browseDirectory(dir);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/workspaces/open-local', async (req, res) => {
    const body = (req.body ?? {}) as { path?: unknown; trusted?: unknown };
    const targetPath = typeof body.path === 'string' ? body.path : '';
    const trusted = Boolean(body.trusted);
    if (!targetPath.trim()) {
      res.status(400).json({ ok: false, error: 'path is required' });
      return;
    }
    try {
      const workspace = await workspaceManager.openLocalWorkspace(targetPath, trusted);
      promptRunner.setWorkspace(workspace.localPath);
      broadcastSnapshot();
      res.json({ ok: true, workspace });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/workspaces/github/repos', async (_req, res) => {
    try {
      const repos = await workspaceManager.listGitHubRepos(
        accountAuth.getGitHubToken() ?? undefined,
      );
      res.json({ ok: true, repos });
    } catch (err) {
      res.json({
        ok: false,
        repos: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/workspaces/github/clone', async (req, res) => {
    const body = (req.body ?? {}) as { repoUrl?: unknown; trusted?: unknown };
    const repoUrl = typeof body.repoUrl === 'string' ? body.repoUrl : '';
    const trusted = Boolean(body.trusted);
    if (!repoUrl.trim()) {
      res.status(400).json({ ok: false, error: 'repoUrl is required' });
      return;
    }
    try {
      const workspace = await workspaceManager.cloneGitHubRepo(repoUrl, {
        trusted,
        githubToken: accountAuth.getGitHubToken() ?? undefined,
      });
      promptRunner.setWorkspace(workspace.localPath);
      broadcastSnapshot();
      res.json({ ok: true, workspace });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/workspaces/gdrive/list', async (req, res) => {
    const folderId = typeof req.query.folderId === 'string' && req.query.folderId.trim()
      ? req.query.folderId.trim()
      : 'root';
    const token = await accountAuth.getValidGoogleAccessToken();
    if (!token) {
      res.json({ ok: false, entries: [], error: 'Google account is not connected.' });
      return;
    }
    try {
      const entries = await listDriveEntries(token, folderId);
      res.json({ ok: true, entries });
    } catch (err) {
      res.json({
        ok: false,
        entries: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/workspaces/gdrive/open', async (req, res) => {
    const body = (req.body ?? {}) as { folderId?: unknown; name?: unknown; trusted?: unknown };
    const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : '';
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Drive Project';
    const trusted = Boolean(body.trusted);
    if (!folderId) {
      res.status(400).json({ ok: false, error: 'folderId is required' });
      return;
    }
    const token = await accountAuth.getValidGoogleAccessToken();
    if (!token) {
      res.status(401).json({ ok: false, error: 'Google account is not connected.' });
      return;
    }
    try {
      const safeId = folderId.replace(/[^A-Za-z0-9_-]/g, '_');
      const localTargetDir = path.join(os.homedir(), 'SwarmPlazaWorkspaces', `gdrive-${safeId}`);
      await pullDriveFolder(token, folderId, localTargetDir);
      const workspace = await workspaceManager.registerDriveWorkspace({
        folderId,
        name,
        localPath: localTargetDir,
        trusted,
      });
      promptRunner.setWorkspace(workspace.localPath);
      broadcastSnapshot();
      res.json({ ok: true, workspace });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/workspaces/:id/sync-drive', async (req, res) => {
    const ws = workspaceManager.getWorkspaceById(req.params.id);
    if (!ws || ws.source !== 'gdrive' || !ws.gdriveFolderId) {
      res.status(404).json({ ok: false, error: 'Google Drive workspace not found.' });
      return;
    }
    const token = await accountAuth.getValidGoogleAccessToken();
    if (!token) {
      res.status(401).json({ ok: false, error: 'Google account is not connected.' });
      return;
    }
    try {
      const syncResult = await pushDriveFolder(token, ws.gdriveFolderId, ws.localPath);
      workspaceManager.markWorkspaceSynced(ws.id);
      res.json({ ok: true, ...syncResult });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/workspaces/:id/commit-push', async (req, res) => {
    const body = (req.body ?? {}) as { message?: unknown; push?: unknown };
    const message = typeof body.message === 'string' ? body.message : '';
    const push = Boolean(body.push);
    try {
      const result = await workspaceManager.commitAndPush(req.params.id, message, push);
      broadcastSnapshot();
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/workspaces/:id/activate', (req, res) => {
    try {
      const workspace = workspaceManager.setActiveWorkspace(req.params.id);
      promptRunner.setWorkspace(workspace.localPath);
      broadcastSnapshot();
      res.json({ ok: true, workspace });
    } catch (err) {
      res.status(404).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/workspaces/:id', (req, res) => {
    const removed = workspaceManager.removeWorkspace(req.params.id);
    if (!removed) {
      res.status(404).json({ ok: false, error: 'Workspace not found' });
      return;
    }
    broadcastSnapshot();
    res.json({ ok: true });
  });

  app.post('/api/diff/decision', async (req, res) => {
    const body = (req.body ?? {}) as { path?: string; decision?: string };
    if (!body.path || (body.decision !== 'accept' && body.decision !== 'reject')) {
      res.status(400).json({ error: "Expected { path, decision: 'accept' | 'reject' }" });
      return;
    }
    try {
      const diffs =
        body.decision === 'accept'
          ? await promptRunner.acceptDiff(body.path)
          : await promptRunner.rejectDiff(body.path);
      res.json({ ok: true, diffs });
    } catch (err) {
      if (err instanceof InvalidDiffPathError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Serve built frontend if dist/client/index.html exists
  const currentDir =
    typeof import.meta?.url === 'string'
      ? path.dirname(fileURLToPath(import.meta.url))
      : process.cwd();
  const clientCandidates = [
    ...(options.clientDistDir ? [options.clientDistDir] : []),
    path.resolve(currentDir, '../client'),
    path.resolve(currentDir, '../../dist/client'),
  ];
  const clientDistDir =
    clientCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ??
    clientCandidates[clientCandidates.length - 1];
  const clientIndexHtml = path.join(clientDistDir, 'index.html');

  if (fs.existsSync(clientIndexHtml)) {
    app.use(express.static(clientDistDir, { index: false }));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/ws') ||
        req.path === '/preload.js'
      ) {
        next();
        return;
      }
      const rawHtml = fs.readFileSync(clientIndexHtml, 'utf8');
      const reqToken =
        (typeof req.query.token === 'string' && req.query.token) ||
        (typeof req.headers['x-sidecar-token'] === 'string' &&
          req.headers['x-sidecar-token']) ||
        activeToken;
      const reqConvId =
        typeof req.query.conversationId === 'string' ? req.query.conversationId : '';
      const rewritten = rewriteHtmlWithSidecarToken(rawHtml, reqToken, reqConvId);
      res
        .status(200)
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'no-store')
        .send(rewritten);
    });
  }

  const timer =
    broadcastIntervalMs > 0
      ? setInterval(() => {
          if (wss.clients.size > 0) {
            broadcastSnapshot();
          }
        }, broadcastIntervalMs)
      : null;

  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }

  const ambientTimer =
    broadcastIntervalMs > 0
      ? setInterval(() => {
          const nowMs = Date.now();
          const snap = getSnapshot();
          const eligible = snap.floors.filter((f) => canTriggerAutoFloorEvent(f, nowMs));
          if (eligible.length > 0) {
            const pick = eligible[Math.floor(Math.random() * eligible.length)];
            if (tryTriggerAutoFloorEvent(pick, nowMs)) {
              broadcastSnapshot();
            }
          }
        }, 90_000)
      : null;

  if (ambientTimer && typeof ambientTimer.unref === 'function') {
    ambientTimer.unref();
  }

  const sseHeartbeatTimer = setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': heartbeat\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  }, 15_000);
  if (typeof sseHeartbeatTimer.unref === 'function') {
    sseHeartbeatTimer.unref();
  }

  const close = async (): Promise<void> => {
    unsubscribePrompt();
    clearInterval(sseHeartbeatTimer);
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // Ignore
      }
    }
    sseClients.clear();
    if (timer) clearInterval(timer);
    if (ambientTimer) clearInterval(ambientTimer);
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  };

  return {
    app,
    server,
    wss,
    getSnapshot,
    broadcastSnapshot,
    close,
  };
}

export const createPlazaServer = createPlazaApp;

const isMainModule =
  typeof import.meta?.url === 'string' &&
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  const instance = createPlazaApp();
  instance.server.listen(PORT, BIND_HOST, () => {
    console.log(`[antigravity-plaza] Server listening on http://${BIND_HOST}:${PORT}`);
  });
}
