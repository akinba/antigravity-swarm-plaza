import cors from 'cors';
import express, { type Express } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type { AgentDetailResponse, OfficeEmployee, PlazaSnapshot } from '../shared/types.js';
import { readAgentLogs } from './brainScanner.js';
import { AGY_DATA_DIR, CURRENT_WORKSPACE, PORT } from './config.js';
import { getDemoAgentLogs, getDemoEmployee } from './demoSimulator.js';
import { buildPlazaSnapshot } from './gamification.js';

export interface PlazaAppOptions {
  agyDataDir?: string;
  currentWorkspace?: string;
  initialDemoMode?: boolean;
  broadcastIntervalMs?: number;
}

export interface PlazaAppInstance {
  app: Express;
  server: http.Server;
  wss: WebSocketServer;
  getSnapshot: () => PlazaSnapshot;
  broadcastSnapshot: () => PlazaSnapshot;
  close: () => Promise<void>;
}

export function createPlazaApp(options: PlazaAppOptions = {}): PlazaAppInstance {
  const agyDataDir = options.agyDataDir ?? AGY_DATA_DIR;
  const currentWorkspace = options.currentWorkspace ?? CURRENT_WORKSPACE;
  let demoMode = options.initialDemoMode ?? false;
  const broadcastIntervalMs = options.broadcastIntervalMs ?? 1500;

  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const getSnapshot = (): PlazaSnapshot =>
    buildPlazaSnapshot(agyDataDir, currentWorkspace, demoMode);

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

  wss.on('connection', (ws) => {
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
    const snapshot = broadcastSnapshot();
    res.json({ demoMode, snapshot });
  });

  // Serve built frontend if dist/client/index.html exists
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDistDir = path.resolve(__dirname, '../../dist/client');
  const clientIndexHtml = path.join(clientDistDir, 'index.html');

  if (fs.existsSync(clientIndexHtml)) {
    app.use(express.static(clientDistDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
        next();
        return;
      }
      res.sendFile(clientIndexHtml);
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

  const close = async (): Promise<void> => {
    if (timer) clearInterval(timer);
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

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  const instance = createPlazaApp();
  instance.server.listen(PORT, () => {
    console.log(`[antigravity-plaza] Server listening on http://localhost:${PORT}`);
  });
}
