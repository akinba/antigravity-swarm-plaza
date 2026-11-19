import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  WorkspaceManager,
  parseGitHubRepoTarget,
  type WorkspaceExecFileFn,
} from '../../src/server/workspaceManager.js';

describe('WorkspaceManager multi-source project manager', () => {
  let tmpRoot: string;
  let storagePath: string;
  let clonesRootDir: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'swarm-ws-mgr-'));
    storagePath = path.join(tmpRoot, 'workspaces.json');
    clonesRootDir = path.join(tmpRoot, 'clones');
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('browses local directories and sorts subdirectories before files', async () => {
    const sampleDir = path.join(tmpRoot, 'sample-project');
    await fs.mkdir(path.join(sampleDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(sampleDir, 'docs'), { recursive: true });
    await fs.writeFile(path.join(sampleDir, 'README.md'), '# Sample\n', 'utf8');
    await fs.writeFile(path.join(sampleDir, 'package.json'), '{}\n', 'utf8');

    const mgr = new WorkspaceManager({
      storagePath,
      clonesRootDir,
    });

    const result = await mgr.browseDirectory(sampleDir);
    assert.equal(result.currentDir, sampleDir);
    assert.equal(result.parentDir, tmpRoot);
    assert.ok(result.roots.length >= 1);
    assert.deepEqual(
      result.entries.map((e) => `${e.name}:${e.isDirectory ? 'dir' : 'file'}`),
      ['docs:dir', 'src:dir', 'package.json:file', 'README.md:file'],
    );
  });

  it('opens a local workspace, detects git branch/remote, updates trust, and persists state', async () => {
    const projectA = path.join(tmpRoot, 'project-a');
    const projectB = path.join(tmpRoot, 'project-b');
    await fs.mkdir(projectA, { recursive: true });
    await fs.mkdir(projectB, { recursive: true });

    const execCalls: Array<{ cmd: string; args: string[]; cwd: string }> = [];
    const mockExec: WorkspaceExecFileFn = async (cmd, args, opts) => {
      execCalls.push({ cmd, args, cwd: opts.cwd });
      if (args[0] === 'rev-parse') {
        return { stdout: 'feat/multi-provider\n', stderr: '' };
      }
      if (args[0] === 'config') {
        return {
          stdout: 'https://github.com/akinba/antigravity-swarm-plaza.git\n',
          stderr: '',
        };
      }
      return { stdout: '', stderr: '' };
    };

    const mgr = new WorkspaceManager({
      storagePath,
      clonesRootDir,
      execFileImpl: mockExec,
    });

    const wsA = await mgr.openLocalWorkspace(projectA, false);
    assert.equal(wsA.name, 'project-a');
    assert.equal(wsA.source, 'local');
    assert.equal(wsA.trusted, false);
    assert.equal(wsA.gitBranch, 'feat/multi-provider');
    assert.equal(
      wsA.remoteUrl,
      'https://github.com/akinba/antigravity-swarm-plaza.git',
    );
    assert.equal(mgr.getActiveWorkspace()?.id, wsA.id);

    const trustedA = mgr.setWorkspaceTrust(wsA.id, true);
    assert.equal(trustedA.trusted, true);

    const wsB = await mgr.openLocalWorkspace(projectB, true);
    assert.equal(mgr.listWorkspaces().length, 2);
    assert.equal(mgr.getActiveWorkspace()?.id, wsB.id);

    // Reload from disk in a fresh WorkspaceManager instance
    const reloaded = new WorkspaceManager({
      storagePath,
      clonesRootDir,
      execFileImpl: mockExec,
    });
    assert.equal(reloaded.listWorkspaces().length, 2);
    assert.equal(reloaded.getActiveWorkspace()?.id, wsB.id);
    assert.equal(reloaded.getWorkspaceById(wsA.id)?.trusted, true);

    reloaded.setActiveWorkspace(wsA.id);
    assert.equal(reloaded.getActiveWorkspace()?.id, wsA.id);

    assert.equal(reloaded.removeWorkspace(wsA.id), true);
    assert.equal(reloaded.getActiveWorkspace()?.id, wsB.id);
  });

  it('lists GitHub repos via REST token or gh CLI fallback', async () => {
    const fetchCalls: string[] = [];
    const mockFetch: typeof fetch = async (input) => {
      fetchCalls.push(String(input));
      return new Response(
        JSON.stringify([
          {
            full_name: 'akinba/swarm-plaza',
            name: 'swarm-plaza',
            owner: { login: 'akinba' },
            html_url: 'https://github.com/akinba/swarm-plaza',
            clone_url: 'https://github.com/akinba/swarm-plaza.git',
            private: true,
            default_branch: 'main',
            description: '2.5D Isometric Swarm Dashboard',
            updated_at: '2026-11-20T00:00:00Z',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const mockExec: WorkspaceExecFileFn = async (cmd, args) => {
      assert.equal(cmd, 'gh');
      assert.equal(args[0], 'repo');
      return {
        stdout: JSON.stringify([
          {
            nameWithOwner: 'akinba/cli-repo',
            name: 'cli-repo',
            owner: { login: 'akinba' },
            url: 'https://github.com/akinba/cli-repo',
            isPrivate: false,
            defaultBranchRef: { name: 'develop' },
            description: 'From gh CLI',
            updatedAt: '2026-11-19T00:00:00Z',
          },
        ]),
        stderr: '',
      };
    };

    const mgr = new WorkspaceManager({
      storagePath,
      clonesRootDir,
      fetchImpl: mockFetch,
      execFileImpl: mockExec,
    });

    const tokenRepos = await mgr.listGitHubRepos('ghp_test_token_123');
    assert.equal(fetchCalls.length, 1);
    assert.equal(tokenRepos.length, 1);
    assert.equal(tokenRepos[0].fullName, 'akinba/swarm-plaza');
    assert.equal(tokenRepos[0].isPrivate, true);
    assert.equal(tokenRepos[0].defaultBranch, 'main');

    const cliRepos = await mgr.listGitHubRepos();
    assert.equal(cliRepos.length, 1);
    assert.equal(cliRepos[0].fullName, 'akinba/cli-repo');
    assert.equal(cliRepos[0].defaultBranch, 'develop');
  });

  it('clones or pulls a GitHub repository and executes commitAndPush', async () => {
    assert.deepEqual(parseGitHubRepoTarget('akinba/swarm-plaza'), {
      owner: 'akinba',
      repo: 'swarm-plaza',
      cloneUrl: 'https://github.com/akinba/swarm-plaza.git',
      htmlUrl: 'https://github.com/akinba/swarm-plaza',
    });
    assert.throws(() => parseGitHubRepoTarget('https://evil.example.com/a/b'));

    const gitCommands: string[] = [];
    let porcelainOutput = ' M src/index.ts\n';

    const mockExec: WorkspaceExecFileFn = async (cmd, args) => {
      gitCommands.push(`${cmd} ${args.join(' ')}`);
      if (args[0] === 'rev-parse') {
        return { stdout: 'main\n', stderr: '' };
      }
      if (args[0] === 'status' && args[1] === '--porcelain') {
        return { stdout: porcelainOutput, stderr: '' };
      }
      if (args[0] === 'commit') {
        return { stdout: '[main abc1234] feat: update\n', stderr: '' };
      }
      if (args[0] === 'push') {
        return { stdout: 'To https://github.com/akinba/swarm-plaza.git\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    };

    const mgr = new WorkspaceManager({
      storagePath,
      clonesRootDir,
      execFileImpl: mockExec,
    });

    // 1) Initial clone
    const clonedWs = await mgr.cloneGitHubRepo('https://github.com/akinba/swarm-plaza');
    const expectedTarget = path.join(clonesRootDir, 'akinba-swarm-plaza');
    assert.equal(clonedWs.source, 'github');
    assert.equal(clonedWs.name, 'akinba/swarm-plaza');
    assert.equal(clonedWs.localPath, expectedTarget);
    assert.equal(clonedWs.gitBranch, 'main');
    assert.ok(
      gitCommands.some((c) =>
        c.startsWith(`git clone https://github.com/akinba/swarm-plaza.git ${expectedTarget}`),
      ),
    );

    // 2) Create .git directory so subsequent clone triggers git pull --ff-only
    await fs.mkdir(path.join(expectedTarget, '.git'), { recursive: true });
    await mgr.cloneGitHubRepo('akinba/swarm-plaza');
    assert.ok(gitCommands.includes('git pull --ff-only'));

    // 3) commitAndPush with dirty tree
    const pushRes = await mgr.commitAndPush(clonedWs.id, 'feat: update from dock', true);
    assert.equal(pushRes.ok, true);
    assert.equal(pushRes.committed, true);
    assert.equal(pushRes.pushed, true);
    assert.ok(gitCommands.includes('git add -A'));
    assert.ok(gitCommands.includes('git commit -m feat: update from dock'));
    assert.ok(gitCommands.includes('git push'));

    // 4) commitAndPush with clean tree
    porcelainOutput = '';
    const cleanRes = await mgr.commitAndPush(clonedWs.id, 'chore: no changes', true);
    assert.equal(cleanRes.committed, false);
    assert.equal(cleanRes.pushed, false);

    // 5) Google Drive workspace registration & sync timestamp update
    const driveWs = await mgr.registerDriveWorkspace({
      folderId: '1AbCdEfGhIjK',
      name: 'Drive Project',
      trusted: true,
    });
    assert.equal(driveWs.source, 'gdrive');
    assert.equal(driveWs.gdriveFolderId, '1AbCdEfGhIjK');
    const synced = mgr.markWorkspaceSynced(driveWs.id, '2026-11-20T02:00:00.000Z');
    assert.equal(synced.lastSyncedAt, '2026-11-20T02:00:00.000Z');
  });
});
