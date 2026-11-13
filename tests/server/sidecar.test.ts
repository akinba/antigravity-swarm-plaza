import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { WebSocket } from 'ws';
import { resolveDefaultPort, resolveSidecarToken } from '../../src/server/config.js';
import { createPlazaServer } from '../../src/server/index.js';

describe('Sidecar config helpers', () => {
  it('resolveDefaultPort prioritizes ANTIGRAVITY_SIDECAR_WEB_PORT over PORT and 3210', () => {
    assert.equal(resolveDefaultPort({}), 3210);
    assert.equal(resolveDefaultPort({ PORT: '4000' }), 4000);
    assert.equal(
      resolveDefaultPort({ PORT: '4000', ANTIGRAVITY_SIDECAR_WEB_PORT: '4567' }),
      4567,
    );
    assert.equal(resolveDefaultPort({ ANTIGRAVITY_SIDECAR_WEB_PORT: 'invalid' }), 3210);
    assert.equal(resolveDefaultPort({ ANTIGRAVITY_SIDECAR_WEB_PORT: '70000' }), 3210);
  });

  it('resolveSidecarToken resolves token env vars with fallback', () => {
    assert.equal(resolveSidecarToken({}), '');
    assert.equal(
      resolveSidecarToken({ ANTIGRAVITY_SIDECAR_WEB_TOKEN: 'web-1' }),
      'web-1',
    );
    assert.equal(
      resolveSidecarToken({
        ANTIGRAVITY_SIDECAR_AUTH_TOKEN: 'auth-2',
        ANTIGRAVITY_SIDECAR_WEB_TOKEN: 'web-1',
      }),
      'auth-2',
    );
    assert.equal(
      resolveSidecarToken({
        ANTIGRAVITY_SIDECAR_UI_TOKEN: 'ui-3',
        ANTIGRAVITY_SIDECAR_AUTH_TOKEN: 'auth-2',
      }),
      'ui-3',
    );
  });
});

describe('Sidecar server auth, preload.js, and WebSocket enforcement', () => {
  it('enforces sidecarToken on non-GET /api/* and /ws while allowing GET /api/plaza and /preload.js', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plaza-sidecar-test-'));
    const appInstance = createPlazaServer({
      agyDataDir: tmpDir,
      currentWorkspace: tmpDir,
      initialDemoMode: false,
      broadcastIntervalMs: 0,
      sidecarToken: 'tok-abc',
    });

    await new Promise<void>((resolve) => {
      appInstance.server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const addr = appInstance.server.address();
      assert.ok(addr && typeof addr === 'object');
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      const wsBase = `ws://127.0.0.1:${addr.port}`;

      // GET /api/plaza -> 200 without token
      const plazaRes = await fetch(`${baseUrl}/api/plaza`);
      assert.equal(plazaRes.status, 200);

      // GET /preload.js -> 200 JS
      const preloadRes = await fetch(`${baseUrl}/preload.js`);
      assert.equal(preloadRes.status, 200);
      const contentType = preloadRes.headers.get('content-type') || '';
      assert.ok(contentType.includes('javascript'));
      const preloadBody = await preloadRes.text();
      assert.ok(preloadBody.includes('window.sidecar'));

      // POST /api/demo/toggle without token -> 401
      const unauthPost = await fetch(`${baseUrl}/api/demo/toggle`, { method: 'POST' });
      assert.equal(unauthPost.status, 401);

      // POST /api/demo/toggle with X-Sidecar-Token -> 200
      const authPost = await fetch(`${baseUrl}/api/demo/toggle`, {
        method: 'POST',
        headers: { 'X-Sidecar-Token': 'tok-abc' },
      });
      assert.equal(authPost.status, 200);
      const authJson = (await authPost.json()) as { demoMode: boolean };
      assert.equal(authJson.demoMode, true);

      // WebSocket /ws?token=tok-abc receives plaza_snapshot
      const validMsg = await new Promise<string>((resolve, reject) => {
        const ws = new WebSocket(`${wsBase}/ws?token=tok-abc`);
        ws.once('message', (data) => {
          ws.close();
          resolve(data.toString());
        });
        ws.once('error', reject);
      });
      const parsed = JSON.parse(validMsg) as { type: string };
      assert.equal(parsed.type, 'plaza_snapshot');

      // WebSocket /ws without token is closed with 1008
      const closeCode = await new Promise<number>((resolve, reject) => {
        const ws = new WebSocket(`${wsBase}/ws`);
        ws.once('close', (code) => resolve(code));
        ws.once('error', reject);
      });
      assert.equal(closeCode, 1008);
    } finally {
      await appInstance.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
