import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BrowseDirectoryResult,
  ConnectedAccountInfo,
  GitHubRepoInfo,
  GoogleDriveEntry,
  ManagedWorkspace,
  WorkspaceSource,
} from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

export function formatWorkspaceSourceIcon(source: WorkspaceSource): string {
  if (source === 'github') return '🐙';
  if (source === 'gdrive') return '☁️';
  return '📁';
}

export function filterGitHubRepos(repos: GitHubRepoInfo[], query: string): GitHubRepoInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return repos;
  return repos.filter(
    (r) =>
      r.fullName.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)),
  );
}

interface ProjectManagerModalProps {
  workspaces: ManagedWorkspace[];
  activeWorkspaceId: string | null;
  accounts: { google?: ConnectedAccountInfo; github?: ConnectedAccountInfo };
  onWorkspacesChanged: (workspaces: ManagedWorkspace[], activeWorkspaceId: string | null) => void;
  onOpenAccounts: () => void;
  onClose: () => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  workspaces,
  activeWorkspaceId,
  accounts,
  onWorkspacesChanged,
  onOpenAccounts,
  onClose,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'local' | 'github' | 'gdrive'>('local');
  const [trusted, setTrusted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local folder state
  const [browseResult, setBrowseResult] = useState<BrowseDirectoryResult | null>(null);
  const [pathDraft, setPathDraft] = useState('');
  const [browsing, setBrowsing] = useState(false);

  // GitHub state
  const [repos, setRepos] = useState<GitHubRepoInfo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoFilter, setRepoFilter] = useState('');
  const [repoUrlDraft, setRepoUrlDraft] = useState('');

  // Google Drive state
  const [driveStack, setDriveStack] = useState<Array<{ id: string; name: string }>>([]);
  const [driveEntries, setDriveEntries] = useState<GoogleDriveEntry[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);

  const currentDriveFolder = driveStack[driveStack.length - 1] ?? {
    id: 'root',
    name: t.projectsModal.driveRoot,
  };

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (!res.ok) return;
      const data = (await res.json()) as {
        workspaces?: ManagedWorkspace[];
        activeWorkspaceId?: string | null;
      };
      if (Array.isArray(data.workspaces)) {
        onWorkspacesChanged(data.workspaces, data.activeWorkspaceId ?? null);
      }
    } catch {
      // ignore
    }
  }, [onWorkspacesChanged]);

  const loadBrowse = useCallback(async (dir?: string) => {
    setBrowsing(true);
    setError(null);
    try {
      const qs = dir ? `?dir=${encodeURIComponent(dir)}` : '';
      const res = await fetch(`/api/workspaces/browse${qs}`);
      const data = (await res.json()) as BrowseDirectoryResult & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setBrowseResult(data);
        setPathDraft(data.currentDir);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setBrowsing(false);
    }
  }, []);

  const loadGitHubRepos = useCallback(async () => {
    setReposLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces/github/repos');
      const data = (await res.json()) as { ok?: boolean; repos?: GitHubRepoInfo[]; error?: string };
      if (res.ok && data.ok && Array.isArray(data.repos)) {
        setRepos(data.repos);
      } else {
        setRepos([]);
        if (data.error) setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch GitHub repos');
    } finally {
      setReposLoading(false);
    }
  }, []);

  const loadDriveFolder = useCallback(async (folderId: string) => {
    setDriveLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/gdrive/list?folderId=${encodeURIComponent(folderId)}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        entries?: GoogleDriveEntry[];
        error?: string;
      };
      if (res.ok && data.ok && Array.isArray(data.entries)) {
        setDriveEntries(data.entries);
      } else {
        setDriveEntries([]);
        if (data.error) setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list Google Drive');
    } finally {
      setDriveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'local' && !browseResult) {
      void loadBrowse();
    } else if (activeTab === 'github') {
      void loadGitHubRepos();
    } else if (activeTab === 'gdrive') {
      void loadDriveFolder(currentDriveFolder.id);
    }
  }, [activeTab, browseResult, loadBrowse, loadGitHubRepos, loadDriveFolder, currentDriveFolder.id]);

  const filteredRepos = useMemo(() => filterGitHubRepos(repos, repoFilter), [repos, repoFilter]);

  const handleOpenLocal = async (targetPath: string) => {
    if (!targetPath.trim()) return;
    playSelectBlip();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces/open-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath.trim(), trusted }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      await refreshWorkspaces();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open workspace');
    } finally {
      setBusy(false);
    }
  };

  const handleCloneGithub = async (repoUrl: string) => {
    const clean = repoUrl.trim();
    if (!clean) return;
    playSelectBlip();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces/github/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: clean, trusted }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      await refreshWorkspaces();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone repository');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDrive = async (folderId: string, name: string) => {
    playSelectBlip();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces/gdrive/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, name, trusted }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      await refreshWorkspaces();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open Drive folder');
    } finally {
      setBusy(false);
    }
  };

  const handleActivateWorkspace = async (id: string) => {
    playSelectBlip();
    setBusy(true);
    try {
      await fetch(`/api/workspaces/${encodeURIComponent(id)}/activate`, { method: 'POST' });
      await refreshWorkspaces();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveWorkspace = async (id: string) => {
    playSelectBlip();
    setBusy(true);
    try {
      await fetch(`/api/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshWorkspaces();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pixel-modal-backdrop" onClick={onClose}>
      <div
        className="pixel-panel pixel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 14, gap: 10, maxWidth: 720 }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            borderBottom: '2px solid #0a0c14',
            paddingBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
              {t.projectsModal.title}
            </span>
            <span style={{ fontSize: 11, color: '#9aa7c7' }}>{t.projectsModal.subtitle}</span>
          </div>
          <button
            type="button"
            className="pixel-btn danger"
            onClick={() => {
              playSelectBlip();
              onClose();
            }}
          >
            {t.projectsModal.close}
          </button>
        </div>

        {/* Source Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`pixel-btn ${activeTab === 'local' ? 'cyan' : ''}`}
            style={{ fontSize: 10, padding: '5px 10px' }}
            onClick={() => {
              playSelectBlip();
              setError(null);
              setActiveTab('local');
            }}
          >
            {t.projectsModal.tabLocal}
          </button>
          <button
            type="button"
            className={`pixel-btn ${activeTab === 'github' ? 'cyan' : ''}`}
            style={{ fontSize: 10, padding: '5px 10px' }}
            onClick={() => {
              playSelectBlip();
              setError(null);
              setActiveTab('github');
            }}
          >
            {t.projectsModal.tabGithub}
          </button>
          <button
            type="button"
            className={`pixel-btn ${activeTab === 'gdrive' ? 'cyan' : ''}`}
            style={{ fontSize: 10, padding: '5px 10px' }}
            onClick={() => {
              playSelectBlip();
              setError(null);
              setActiveTab('gdrive');
            }}
          >
            {t.projectsModal.tabGdrive}
          </button>
        </div>

        {error && (
          <div className="pixel-panel-inset" style={{ padding: '6px 10px', color: 'var(--accent-amber)', fontSize: 11 }}>
            ⚠ {error}
          </div>
        )}

        {/* Tab: Local Folder */}
        {activeTab === 'local' && (
          <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {browseResult && browseResult.roots.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.projectsModal.rootsLabel}:</span>
                {browseResult.roots.map((root) => (
                  <button
                    key={root}
                    type="button"
                    className="pixel-btn"
                    style={{ fontSize: 9, padding: '3px 7px' }}
                    onClick={() => {
                      playSelectBlip();
                      void loadBrowse(root);
                    }}
                  >
                    {root}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {browseResult?.parentDir && (
                <button
                  type="button"
                  className="pixel-btn"
                  style={{ fontSize: 9, padding: '5px 8px' }}
                  disabled={browsing}
                  onClick={() => {
                    playSelectBlip();
                    void loadBrowse(browseResult.parentDir!);
                  }}
                >
                  {t.projectsModal.parentDir}
                </button>
              )}
              <input
                type="text"
                className="retro-dock-select"
                style={{ flex: 1, minWidth: 200, maxWidth: 'none', cursor: 'text' }}
                value={pathDraft}
                onChange={(e) => setPathDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void loadBrowse(pathDraft);
                  }
                }}
              />
              <button
                type="button"
                className="pixel-btn active"
                style={{ fontSize: 9, padding: '5px 10px' }}
                disabled={busy || !pathDraft.trim()}
                onClick={() => void handleOpenLocal(pathDraft)}
              >
                {t.projectsModal.openLocalBtn}
              </button>
            </div>

            <div className="retro-project-list">
              {browsing ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 6 }}>{t.projectsModal.loading}</div>
              ) : !browseResult || browseResult.entries.filter((e) => e.isDirectory).length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 6 }}>{t.projectsModal.emptyDir}</div>
              ) : (
                browseResult.entries
                  .filter((e) => e.isDirectory)
                  .map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      className="retro-project-row"
                      onClick={() => {
                        playSelectBlip();
                        void loadBrowse(entry.path);
                      }}
                    >
                      <span>📁 {entry.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>→</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Tab: GitHub Repo */}
        {activeTab === 'github' && (
          <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!accounts.github?.connected && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '6px 8px', background: '#181e30', border: '1px solid #3cd8ff' }}>
                <span style={{ fontSize: 10, color: '#9ee8ff' }}>{t.projectsModal.accountRequiredHint}</span>
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ fontSize: 9, padding: '4px 8px' }}
                  onClick={() => {
                    playSelectBlip();
                    onOpenAccounts();
                  }}
                >
                  {t.projectsModal.openAccountsBtn}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="retro-dock-select"
                style={{ flex: 1, minWidth: 180, maxWidth: 'none', cursor: 'text' }}
                placeholder={t.projectsModal.githubFilterPlaceholder}
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
              />
              <button
                type="button"
                className="pixel-btn"
                style={{ fontSize: 9, padding: '5px 8px' }}
                disabled={reposLoading}
                onClick={() => {
                  playSelectBlip();
                  void loadGitHubRepos();
                }}
              >
                {t.projectsModal.refreshBtn}
              </button>
            </div>

            <div className="retro-project-list">
              {reposLoading ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 6 }}>{t.projectsModal.loading}</div>
              ) : (
                filteredRepos.map((repo) => (
                  <div key={repo.fullName} className="retro-project-row" style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ color: '#dce6ff', fontWeight: 700 }}>
                        {repo.isPrivate ? '🔒' : '🌐'} {repo.fullName}
                      </span>
                      {repo.description && (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {repo.description}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="pixel-btn active"
                      style={{ fontSize: 9, padding: '3px 8px', flexShrink: 0 }}
                      disabled={busy}
                      onClick={() => void handleCloneGithub(repo.cloneUrl || repo.url)}
                    >
                      {t.projectsModal.cloneOpenBtn}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="retro-dock-select"
                style={{ flex: 1, minWidth: 200, maxWidth: 'none', cursor: 'text' }}
                placeholder={t.projectsModal.githubUrlPlaceholder}
                value={repoUrlDraft}
                onChange={(e) => setRepoUrlDraft(e.target.value)}
              />
              <button
                type="button"
                className="pixel-btn cyan"
                style={{ fontSize: 9, padding: '5px 10px' }}
                disabled={busy || !repoUrlDraft.trim()}
                onClick={() => void handleCloneGithub(repoUrlDraft)}
              >
                {t.projectsModal.cloneOpenBtn}
              </button>
            </div>
          </div>
        )}

        {/* Tab: Google Drive */}
        {activeTab === 'gdrive' && (
          <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!accounts.google?.connected && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '6px 8px', background: '#181e30', border: '1px solid #3cd8ff' }}>
                <span style={{ fontSize: 10, color: '#9ee8ff' }}>{t.projectsModal.accountRequiredHint}</span>
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ fontSize: 9, padding: '4px 8px' }}
                  onClick={() => {
                    playSelectBlip();
                    onOpenAccounts();
                  }}
                >
                  {t.projectsModal.openAccountsBtn}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="pixel-btn"
                  style={{ fontSize: 9, padding: '3px 7px' }}
                  onClick={() => {
                    playSelectBlip();
                    setDriveStack([]);
                  }}
                >
                  ☁️ {t.projectsModal.driveRoot}
                </button>
                {driveStack.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>/</span>
                    <button
                      type="button"
                      className="pixel-btn"
                      style={{ fontSize: 9, padding: '3px 7px' }}
                      onClick={() => {
                        playSelectBlip();
                        setDriveStack((prev) => prev.slice(0, idx + 1));
                      }}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <button
                type="button"
                className="pixel-btn active"
                style={{ fontSize: 9, padding: '5px 10px' }}
                disabled={busy || !accounts.google?.connected}
                onClick={() => void handleOpenDrive(currentDriveFolder.id, currentDriveFolder.name)}
              >
                {t.projectsModal.pullOpenBtn}
              </button>
            </div>

            <div className="retro-project-list">
              {driveLoading ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 6 }}>{t.projectsModal.loading}</div>
              ) : (
                driveEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="retro-project-row"
                    style={{ cursor: entry.isFolder ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (!entry.isFolder) return;
                      playSelectBlip();
                      setDriveStack((prev) => [...prev, { id: entry.id, name: entry.name }]);
                    }}
                  >
                    <span>
                      {entry.isFolder ? '📁' : '📄'} {entry.name}
                    </span>
                    {entry.isFolder && (
                      <button
                        type="button"
                        className="pixel-btn cyan"
                        style={{ fontSize: 8, padding: '2px 7px' }}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleOpenDrive(entry.id, entry.name);
                        }}
                      >
                        {t.projectsModal.pullOpenBtn}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Workspace Trust Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#dce6ff', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={trusted}
            onChange={(e) => setTrusted(e.target.checked)}
          />
          <span>🛡️ {t.projectsModal.trustLabel}</span>
        </label>

        {/* Open Workspaces List */}
        <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="pixel-title" style={{ fontSize: 9, color: '#ffd147' }}>
            {t.projectsModal.openWorkspacesTitle} ({workspaces.length})
          </span>
          {workspaces.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.projectsModal.noOpenWorkspaces}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto' }}>
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                return (
                  <div key={ws.id} className="retro-dock-diff-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                      <span>{formatWorkspaceSourceIcon(ws.source)}</span>
                      <span style={{ color: '#dce6ff', fontWeight: 700 }}>{ws.name}</span>
                      {ws.gitBranch && (
                        <span className="pixel-badge" style={{ fontSize: 8, color: '#7ee7ff' }}>
                          ⎇ {ws.gitBranch}
                        </span>
                      )}
                      {isActive && (
                        <span className="pixel-badge" style={{ fontSize: 8, color: '#3be87a' }}>
                          {t.projectsModal.activeBadge}
                        </span>
                      )}
                      <span className="pixel-badge" style={{ fontSize: 8, color: ws.trusted ? '#3be87a' : '#ffbe3b' }}>
                        {ws.trusted ? t.projectsModal.trustedBadge : t.projectsModal.untrustedBadge}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {!isActive && (
                        <button
                          type="button"
                          className="pixel-btn cyan"
                          style={{ fontSize: 8, padding: '2px 7px' }}
                          disabled={busy}
                          onClick={() => void handleActivateWorkspace(ws.id)}
                        >
                          {t.projectsModal.switchBtn}
                        </button>
                      )}
                      <button
                        type="button"
                        className="pixel-btn danger"
                        style={{ fontSize: 8, padding: '2px 7px' }}
                        disabled={busy}
                        onClick={() => void handleRemoveWorkspace(ws.id)}
                      >
                        {t.projectsModal.removeBtn}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
