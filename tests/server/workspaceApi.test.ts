import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { AccountAuthManager } from '../../src/server/accountAuth.js';
import { createPlazaApp } from '../../src/server/index.js';
import { PromptRunner } from '../../src/server/promptRunner.js';
import { WorkspaceManager } from '../../src/server/workspaceManager.js';
import type { BrowseDirectoryResult, ManagedWorkspace, PlazaFloor } from '../../src/shared/types.js';

describe('Workspace & Account Auth API integration', () => {
  it('exposes /api/auth/accounts, /api/workspaces, /api/workspaces/browse, /api/workspaces/open-local and adds opened project floor to /api/plaza', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-ws-api-'));
    const projectDir = path.join(tempDir, 'my-retro-app');
    const subDir = path.join(projectDir, 'src');
    fs.mkdirSync(subDir, { recursive: true });

    const secretsFilePath = path.join(tempDir, 'secrets.json');
    const storagePath = path.join(tempDir, 'workspaces.json');

    const accountAuth = new AccountAuthManager({ secretsFilePath });
    const workspaceManager = new WorkspaceManager({
      storagePath,
      clonesRootDir: path.join(tempDir, 'clones'),
      execFileImpl: async () => ({ stdout: '', stderr: '' }),
    });
    const promptRunner = new PromptRunner({
      defaultWorkspace: process.cwd(),
      secretsFilePath,
    });

    const instance = createPlazaApp({
      agyDataDir: path.join(tempDir, 'nonexistent-agy'),
      initialDemoMode: true,
      broadcastIntervalMs: 0,
      promptRunner,
      accountAuth,
      workspaceManager,
    });

    await new Promise<void>((resolve) => {
      instance.server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = instance.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const authRes = await fetch(`${baseUrl}/api/auth/accounts`);
      assert.equal(authRes.status, 200);
      const authJson = (await authRes.json()) as {
        google: { connected: boolean };
        github: { connected: boolean };
      };
      assert.equal(authJson.google.connected, false);
      assert.equal(authJson.github.connected, false);

      const listRes = await fetch(`${baseUrl}/api/workspaces`);
      assert.equal(listRes.status, 200);
      const listJson = (await listRes.json()) as {
        workspaces: ManagedWorkspace[];
        activeWorkspaceId: string | null;
      };
      assert.deepEqual(listJson.workspaces, []);
      assert.equal(listJson.activeWorkspaceId, null);

      const browseRes = await fetch(
        `${baseUrl}/api/workspaces/browse?dir=${encodeURIComponent(tempDir)}`,
      );
      assert.equal(browseRes.status, 200);
      const browseJson = (await browseRes.json()) as BrowseDirectoryResult;
      assert.ok(browseJson.entries.some((e) => e.name === 'my-retro-app' && e.isDirectory));

      const openRes = await fetch(`${baseUrl}/api/workspaces/open-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectDir, trusted: true }),
      });
      assert.equal(openRes.status, 200);
      const openJson = (await openRes.json()) as { ok: boolean; workspace: ManagedWorkspace };
      assert.equal(openJson.ok, true);
      assert.equal(openJson.workspace.name, 'my-retro-app');
      assert.equal(openJson.workspace.source, 'local');
      assert.equal(openJson.workspace.trusted, true);
      assert.equal(promptRunner.getState().workspace, path.resolve(projectDir));

      const plazaRes = await fetch(`${baseUrl}/api/plaza`);
      assert.equal(plazaRes.status, 200);
      const plazaJson = (await plazaRes.json()) as { floors: PlazaFloor[] };
      const projectFloor = plazaJson.floors.find(
        (f) => f.managedWorkspaceId === openJson.workspace.id,
      );
      assert.ok(projectFloor);
      assert.equal(projectFloor.companyName, 'my-retro-app');
      assert.equal(projectFloor.workspaceSource, 'local');

      const activateRes = await fetch(
        `${baseUrl}/api/workspaces/${encodeURIComponent(openJson.workspace.id)}/activate`,
        { method: 'POST' },
      );
      assert.equal(activateRes.status, 200);

      const delRes = await fetch(
        `${baseUrl}/api/workspaces/${encodeURIComponent(openJson.workspace.id)}`,
        { method: 'DELETE' },
      );
      assert.equal(delRes.status, 200);

      const plazaAfterDel = (await (await fetch(`${baseUrl}/api/plaza`)).json()) as {
        floors: PlazaFloor[];
      };
      assert.equal(
        plazaAfterDel.floors.some((f) => f.managedWorkspaceId === openJson.workspace.id),
        false,
      );
    } finally {
      await instance.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
