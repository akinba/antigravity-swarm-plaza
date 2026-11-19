import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  BrowseDirectoryResult,
  GitHubRepoInfo,
  ManagedWorkspace,
} from '../shared/types.js';

const execFileAsync = promisify(execFile);

export type WorkspaceExecFileFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

export interface WorkspaceManagerOptions {
  storagePath?: string;
  clonesRootDir?: string;
  execFileImpl?: WorkspaceExecFileFn;
  fetchImpl?: typeof fetch;
  platform?: NodeJS.Platform;
}

interface StoredWorkspacesState {
  activeWorkspaceId: string | null;
  workspaces: ManagedWorkspace[];
}

export interface CloneGitHubRepoOptions {
  trusted?: boolean;
  githubToken?: string;
  targetDir?: string;
}

export interface RegisterDriveWorkspaceParams {
  folderId: string;
  name: string;
  localPath?: string;
  trusted?: boolean;
}

export interface CommitAndPushResult {
  ok: boolean;
  committed: boolean;
  pushed: boolean;
  output: string;
}

const SAFE_SLUG_PART_REGEX = /^[a-zA-Z0-9._-]+$/;

export function parseGitHubRepoTarget(repoUrlOrSlug: string): {
  owner: string;
  repo: string;
  cloneUrl: string;
  htmlUrl: string;
} {
  const trimmed = repoUrlOrSlug.trim();
  if (!trimmed) {
    throw new Error('GitHub repository URL or owner/repo slug is required.');
  }

  let owner = '';
  let repo = '';

  // Match git@github.com:owner/repo(.git)
  const sshMatch = /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(trimmed);
  if (sshMatch) {
    owner = sshMatch[1];
    repo = sshMatch[2];
  } else if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(`Invalid GitHub repository URL: "${trimmed}"`);
    }
    if (
      parsed.hostname.toLowerCase() !== 'github.com' &&
      parsed.hostname.toLowerCase() !== 'www.github.com'
    ) {
      throw new Error(`Only github.com repository URLs are supported (got "${parsed.hostname}").`);
    }
    const parts = parsed.pathname
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Invalid GitHub repository path in URL: "${trimmed}"`);
    }
    owner = parts[0];
    repo = parts[1].replace(/\.git$/i, '');
  } else {
    // Match owner/repo(.git)
    const slugMatch = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(trimmed);
    if (!slugMatch) {
      throw new Error(
        `Invalid GitHub repository reference "${trimmed}". Expected "owner/repo" or "https://github.com/owner/repo".`,
      );
    }
    owner = slugMatch[1];
    repo = slugMatch[2];
  }

  if (
    !SAFE_SLUG_PART_REGEX.test(owner) ||
    !SAFE_SLUG_PART_REGEX.test(repo) ||
    owner === '.' ||
    owner === '..' ||
    repo === '.' ||
    repo === '..'
  ) {
    throw new Error(`Unsafe GitHub owner/repository name: "${owner}/${repo}"`);
  }

  return {
    owner,
    repo,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    htmlUrl: `https://github.com/${owner}/${repo}`,
  };
}

function normalizePathForCompare(p: string, platform: NodeJS.Platform): string {
  const resolved = path.resolve(p);
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export class WorkspaceManager {
  private readonly storagePath: string;
  private readonly clonesRootDir: string;
  private readonly execFileImpl: WorkspaceExecFileFn;
  private readonly fetchImpl: typeof fetch;
  private readonly platform: NodeJS.Platform;
  private workspaces: ManagedWorkspace[] = [];
  private activeWorkspaceId: string | null = null;

  constructor(options: WorkspaceManagerOptions = {}) {
    this.storagePath =
      options.storagePath ??
      path.join(os.homedir(), '.gemini', 'swarm-plaza-workspaces.json');
    this.clonesRootDir =
      options.clonesRootDir ?? path.join(os.homedir(), 'SwarmPlazaWorkspaces');
    this.execFileImpl =
      options.execFileImpl ??
      (async (cmd, args, opts) => {
        const res = await execFileAsync(cmd, args, {
          cwd: opts.cwd,
          timeout: 60_000,
          maxBuffer: 4 * 1024 * 1024,
        });
        return {
          stdout: String(res.stdout ?? ''),
          stderr: String(res.stderr ?? ''),
        };
      });
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.platform = options.platform ?? process.platform;

    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return;
      }
      const raw = fs.readFileSync(this.storagePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredWorkspacesState>;
      if (Array.isArray(parsed.workspaces)) {
        this.workspaces = parsed.workspaces.filter(
          (w): w is ManagedWorkspace =>
            Boolean(w && typeof w.id === 'string' && typeof w.localPath === 'string'),
        );
      }
      if (
        typeof parsed.activeWorkspaceId === 'string' &&
        this.workspaces.some((w) => w.id === parsed.activeWorkspaceId)
      ) {
        this.activeWorkspaceId = parsed.activeWorkspaceId;
      } else {
        this.activeWorkspaceId = this.workspaces[0]?.id ?? null;
      }
    } catch {
      this.workspaces = [];
      this.activeWorkspaceId = null;
    }
  }

  private saveToDisk(): void {
    const dir = path.dirname(this.storagePath);
    fs.mkdirSync(dir, { recursive: true });
    const payload: StoredWorkspacesState = {
      activeWorkspaceId: this.activeWorkspaceId,
      workspaces: this.workspaces,
    };
    fs.writeFileSync(this.storagePath, JSON.stringify(payload, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  public getClonesRootDir(): string {
    return this.clonesRootDir;
  }

  public listWorkspaces(): ManagedWorkspace[] {
    return this.workspaces.map((w) => ({ ...w }));
  }

  public getActiveWorkspaceId(): string | null {
    return this.activeWorkspaceId;
  }

  public getActiveWorkspace(): ManagedWorkspace | null {
    if (!this.activeWorkspaceId) return null;
    const found = this.workspaces.find((w) => w.id === this.activeWorkspaceId);
    return found ? { ...found } : null;
  }

  public getWorkspaceById(workspaceId: string): ManagedWorkspace | null {
    const found = this.workspaces.find((w) => w.id === workspaceId);
    return found ? { ...found } : null;
  }

  private detectSystemRoots(currentDir: string): string[] {
    if (this.platform === 'win32') {
      const roots = new Set<string>();
      const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZAB';
      for (const ch of letters) {
        const drive = `${ch}:\\`;
        try {
          if (fs.existsSync(drive)) {
            roots.add(drive);
          }
        } catch {
          // Ignore inaccessible drives
        }
      }
      const parsedRoot = path.parse(currentDir).root;
      if (parsedRoot) {
        roots.add(parsedRoot);
      }
      if (roots.size === 0) {
        roots.add('C:\\');
      }
      return Array.from(roots).sort();
    }
    return ['/'];
  }

  public async browseDirectory(dir?: string): Promise<BrowseDirectoryResult> {
    const targetDir = dir && dir.trim() ? path.resolve(dir.trim()) : os.homedir();
    let stat: fs.Stats;
    try {
      stat = await fsPromises.stat(targetDir);
    } catch {
      throw new Error(`Directory does not exist: "${targetDir}"`);
    }
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: "${targetDir}"`);
    }

    const parentCandidate = path.dirname(targetDir);
    const parentDir = parentCandidate !== targetDir ? parentCandidate : null;
    const roots = this.detectSystemRoots(targetDir);

    const dirents = await fsPromises.readdir(targetDir, { withFileTypes: true });
    const entries: Array<{ name: string; path: string; isDirectory: boolean }> = [];

    for (const d of dirents) {
      let isDirectory = d.isDirectory();
      if (d.isSymbolicLink()) {
        try {
          const linkStat = await fsPromises.stat(path.join(targetDir, d.name));
          isDirectory = linkStat.isDirectory();
        } catch {
          continue;
        }
      }
      entries.push({
        name: d.name,
        path: path.join(targetDir, d.name),
        isDirectory,
      });
    }

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      currentDir: targetDir,
      parentDir,
      roots,
      entries,
    };
  }

  private async detectGitMetadata(
    dirPath: string,
  ): Promise<{ gitBranch?: string; remoteUrl?: string }> {
    let gitBranch: string | undefined;
    let remoteUrl: string | undefined;

    try {
      const branchRes = await this.execFileImpl(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: dirPath },
      );
      const branch = branchRes.stdout.trim();
      if (branch) {
        gitBranch = branch;
      }
    } catch {
      // Not a git repository or no commits yet
    }

    try {
      const remoteRes = await this.execFileImpl(
        'git',
        ['config', '--get', 'remote.origin.url'],
        { cwd: dirPath },
      );
      const remote = remoteRes.stdout.trim();
      if (remote) {
        remoteUrl = remote;
      }
    } catch {
      // No origin remote configured
    }

    return { gitBranch, remoteUrl };
  }

  private upsertWorkspace(
    input: Omit<ManagedWorkspace, 'id' | 'openedAt'> & { id?: string },
  ): ManagedWorkspace {
    const normTarget = normalizePathForCompare(input.localPath, this.platform);
    const existing = this.workspaces.find(
      (w) =>
        (input.id && w.id === input.id) ||
        normalizePathForCompare(w.localPath, this.platform) === normTarget ||
        (input.gdriveFolderId &&
          w.source === 'gdrive' &&
          w.gdriveFolderId === input.gdriveFolderId),
    );

    const now = new Date().toISOString();
    if (existing) {
      existing.name = input.name || existing.name;
      existing.source = input.source;
      existing.localPath = path.resolve(input.localPath);
      existing.trusted = input.trusted;
      if (input.gitBranch !== undefined) existing.gitBranch = input.gitBranch;
      if (input.remoteUrl !== undefined) existing.remoteUrl = input.remoteUrl;
      if (input.gdriveFolderId !== undefined) {
        existing.gdriveFolderId = input.gdriveFolderId;
      }
      if (input.lastSyncedAt !== undefined) {
        existing.lastSyncedAt = input.lastSyncedAt;
      }
      existing.openedAt = now;
      this.activeWorkspaceId = existing.id;
      this.saveToDisk();
      return { ...existing };
    }

    const created: ManagedWorkspace = {
      id: input.id ?? `ws-${randomUUID().slice(0, 8)}`,
      name: input.name,
      source: input.source,
      localPath: path.resolve(input.localPath),
      trusted: input.trusted,
      gitBranch: input.gitBranch,
      remoteUrl: input.remoteUrl,
      gdriveFolderId: input.gdriveFolderId,
      lastSyncedAt: input.lastSyncedAt,
      openedAt: now,
    };

    this.workspaces.push(created);
    this.activeWorkspaceId = created.id;
    this.saveToDisk();
    return { ...created };
  }

  public async openLocalWorkspace(
    dirPath: string,
    trusted = true,
  ): Promise<ManagedWorkspace> {
    if (!dirPath || !dirPath.trim()) {
      throw new Error('Workspace directory path is required.');
    }
    const absPath = path.resolve(dirPath.trim());
    let stat: fs.Stats;
    try {
      stat = await fsPromises.stat(absPath);
    } catch {
      throw new Error(`Workspace directory does not exist: "${absPath}"`);
    }
    if (!stat.isDirectory()) {
      throw new Error(`Workspace path is not a directory: "${absPath}"`);
    }

    const { gitBranch, remoteUrl } = await this.detectGitMetadata(absPath);
    const name = path.basename(absPath) || absPath;

    return this.upsertWorkspace({
      name,
      source: 'local',
      localPath: absPath,
      trusted,
      gitBranch,
      remoteUrl,
    });
  }

  public async listGitHubRepos(githubToken?: string): Promise<GitHubRepoInfo[]> {
    const token = githubToken?.trim();
    if (token) {
      const response = await this.fetchImpl(
        'https://api.github.com/user/repos?sort=updated&per_page=50',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Antigravity-Swarm-Plaza',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `GitHub API returned HTTP ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as Array<{
        full_name?: string;
        name?: string;
        owner?: { login?: string };
        html_url?: string;
        clone_url?: string;
        private?: boolean;
        default_branch?: string;
        description?: string | null;
        updated_at?: string;
      }>;

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((item) => {
        const owner = item.owner?.login ?? '';
        const name = item.name ?? '';
        const fullName = item.full_name ?? (owner ? `${owner}/${name}` : name);
        const url = item.html_url ?? `https://github.com/${fullName}`;
        const cloneUrl = item.clone_url ?? `${url.replace(/\/+$/, '')}.git`;
        return {
          fullName,
          name,
          owner,
          url,
          cloneUrl,
          isPrivate: Boolean(item.private),
          defaultBranch: item.default_branch ?? undefined,
          description: item.description ?? undefined,
          updatedAt: item.updated_at ?? undefined,
        };
      });
    }

    // Fallback to gh CLI
    const ghRes = await this.execFileImpl(
      'gh',
      [
        'repo',
        'list',
        '--limit',
        '50',
        '--json',
        'nameWithOwner,name,owner,url,isPrivate,defaultBranchRef,description,updatedAt',
      ],
      { cwd: process.cwd() },
    );

    const parsed = JSON.parse(ghRes.stdout || '[]') as Array<{
      nameWithOwner?: string;
      name?: string;
      owner?: { login?: string } | string;
      url?: string;
      isPrivate?: boolean;
      defaultBranchRef?: { name?: string } | null;
      description?: string | null;
      updatedAt?: string;
    }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => {
      const owner =
        typeof item.owner === 'string'
          ? item.owner
          : item.owner?.login ?? item.nameWithOwner?.split('/')[0] ?? '';
      const name = item.name ?? item.nameWithOwner?.split('/')[1] ?? '';
      const fullName = item.nameWithOwner ?? (owner ? `${owner}/${name}` : name);
      const url = item.url ?? `https://github.com/${fullName}`;
      return {
        fullName,
        name,
        owner,
        url,
        cloneUrl: `${url.replace(/\/+$/, '')}.git`,
        isPrivate: Boolean(item.isPrivate),
        defaultBranch: item.defaultBranchRef?.name ?? undefined,
        description: item.description ?? undefined,
        updatedAt: item.updatedAt ?? undefined,
      };
    });
  }

  public async cloneGitHubRepo(
    repoUrlOrSlug: string,
    options: CloneGitHubRepoOptions = {},
  ): Promise<ManagedWorkspace> {
    const { owner, repo, cloneUrl, htmlUrl } = parseGitHubRepoTarget(repoUrlOrSlug);
    const targetDir = options.targetDir
      ? path.resolve(options.targetDir)
      : path.join(this.clonesRootDir, `${owner}-${repo}`);

    await fsPromises.mkdir(path.dirname(targetDir), { recursive: true });

    const dirExists = fs.existsSync(targetDir);
    const gitDirExists = fs.existsSync(path.join(targetDir, '.git'));

    if (dirExists && gitDirExists) {
      await this.execFileImpl('git', ['pull', '--ff-only'], { cwd: targetDir });
    } else {
      await this.execFileImpl('git', ['clone', cloneUrl, targetDir], {
        cwd: path.dirname(targetDir),
      });
      // Ensure directory exists in test environments where git clone is mocked
      await fsPromises.mkdir(targetDir, { recursive: true });
    }

    const { gitBranch, remoteUrl } = await this.detectGitMetadata(targetDir);

    return this.upsertWorkspace({
      name: `${owner}/${repo}`,
      source: 'github',
      localPath: targetDir,
      trusted: options.trusted ?? true,
      gitBranch,
      remoteUrl: remoteUrl ?? htmlUrl,
    });
  }

  public async commitAndPush(
    workspaceId: string,
    message: string,
    push = true,
  ): Promise<CommitAndPushResult> {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      throw new Error(`Workspace "${workspaceId}" not found.`);
    }
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      throw new Error('Commit message cannot be empty.');
    }

    const statusRes = await this.execFileImpl('git', ['status', '--porcelain'], {
      cwd: ws.localPath,
    });
    if (!statusRes.stdout.trim()) {
      return {
        ok: true,
        committed: false,
        pushed: false,
        output: 'Working tree clean; nothing to commit.',
      };
    }

    const outputs: string[] = [];
    await this.execFileImpl('git', ['add', '-A'], { cwd: ws.localPath });
    const commitRes = await this.execFileImpl(
      'git',
      ['commit', '-m', cleanMessage],
      { cwd: ws.localPath },
    );
    if (commitRes.stdout.trim()) outputs.push(commitRes.stdout.trim());
    if (commitRes.stderr.trim()) outputs.push(commitRes.stderr.trim());

    let pushed = false;
    if (push) {
      const pushRes = await this.execFileImpl('git', ['push'], {
        cwd: ws.localPath,
      });
      if (pushRes.stdout.trim()) outputs.push(pushRes.stdout.trim());
      if (pushRes.stderr.trim()) outputs.push(pushRes.stderr.trim());
      pushed = true;
    }

    const { gitBranch } = await this.detectGitMetadata(ws.localPath);
    if (gitBranch) {
      ws.gitBranch = gitBranch;
      this.saveToDisk();
    }

    return {
      ok: true,
      committed: true,
      pushed,
      output: outputs.join('\n') || 'Committed changes.',
    };
  }

  public async registerDriveWorkspace(
    params: RegisterDriveWorkspaceParams,
  ): Promise<ManagedWorkspace> {
    const cleanId = params.folderId.trim();
    if (!cleanId) {
      throw new Error('Google Drive folderId is required.');
    }
    const safeFolderSlug = cleanId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const localPath = params.localPath
      ? path.resolve(params.localPath)
      : path.join(this.clonesRootDir, `gdrive-${safeFolderSlug}`);

    await fsPromises.mkdir(localPath, { recursive: true });
    const now = new Date().toISOString();

    return this.upsertWorkspace({
      name: params.name.trim() || `Drive-${cleanId}`,
      source: 'gdrive',
      localPath,
      trusted: params.trusted ?? true,
      gdriveFolderId: cleanId,
      lastSyncedAt: now,
    });
  }

  public markWorkspaceSynced(
    workspaceId: string,
    syncedAt = new Date().toISOString(),
  ): ManagedWorkspace {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      throw new Error(`Workspace "${workspaceId}" not found.`);
    }
    ws.lastSyncedAt = syncedAt;
    this.saveToDisk();
    return { ...ws };
  }

  public setWorkspaceTrust(workspaceId: string, trusted: boolean): ManagedWorkspace {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      throw new Error(`Workspace "${workspaceId}" not found.`);
    }
    ws.trusted = Boolean(trusted);
    this.saveToDisk();
    return { ...ws };
  }

  public setActiveWorkspace(workspaceId: string): ManagedWorkspace {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      throw new Error(`Workspace "${workspaceId}" not found.`);
    }
    this.activeWorkspaceId = ws.id;
    this.saveToDisk();
    return { ...ws };
  }

  public removeWorkspace(workspaceId: string): boolean {
    const idx = this.workspaces.findIndex((w) => w.id === workspaceId);
    if (idx === -1) {
      return false;
    }
    this.workspaces.splice(idx, 1);
    if (this.activeWorkspaceId === workspaceId) {
      this.activeWorkspaceId = this.workspaces[0]?.id ?? null;
    }
    this.saveToDisk();
    return true;
  }
}
