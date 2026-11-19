import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterGitHubRepos,
  formatWorkspaceSourceIcon,
} from '../../src/client/components/ProjectManagerModal';
import { DICTIONARIES } from '../../src/client/i18n/translations';
import type { GitHubRepoInfo } from '../../src/shared/types';

describe('ProjectManagerModal helpers & Phase 2 i18n', () => {
  it('maps workspace sources to retro icons', () => {
    assert.equal(formatWorkspaceSourceIcon('local'), '📁');
    assert.equal(formatWorkspaceSourceIcon('github'), '🐙');
    assert.equal(formatWorkspaceSourceIcon('gdrive'), '☁️');
  });

  it('filters GitHub repositories by fullName and description', () => {
    const repos: GitHubRepoInfo[] = [
      {
        fullName: 'octo/swarm-dashboard',
        name: 'swarm-dashboard',
        owner: 'octo',
        url: 'https://github.com/octo/swarm-dashboard',
        cloneUrl: 'https://github.com/octo/swarm-dashboard.git',
        isPrivate: false,
        description: '2.5D pixel office visualizer',
      },
      {
        fullName: 'octo/private-api',
        name: 'private-api',
        owner: 'octo',
        url: 'https://github.com/octo/private-api',
        cloneUrl: 'https://github.com/octo/private-api.git',
        isPrivate: true,
        description: 'Backend service',
      },
    ];

    assert.equal(filterGitHubRepos(repos, '').length, 2);
    assert.equal(filterGitHubRepos(repos, 'SWARM').length, 1);
    assert.equal(filterGitHubRepos(repos, 'pixel').length, 1);
    assert.equal(filterGitHubRepos(repos, 'backend')[0].name, 'private-api');
  });

  it('provides complete TR and EN translations for ProjectsModal, Accounts tab, and Dock sync', () => {
    for (const key of Object.keys(DICTIONARIES.en.projectsModal) as Array<
      keyof typeof DICTIONARIES.en.projectsModal
    >) {
      assert.ok(DICTIONARIES.tr.projectsModal[key].length > 0, `tr.projectsModal.${key}`);
      assert.ok(DICTIONARIES.en.projectsModal[key].length > 0, `en.projectsModal.${key}`);
    }

    assert.ok(DICTIONARIES.tr.hud.projects.length > 0);
    assert.ok(DICTIONARIES.en.hud.projects.length > 0);
    assert.ok(DICTIONARIES.tr.elevator.openProject.length > 0);
    assert.ok(DICTIONARIES.en.elevator.openProject.length > 0);
    assert.ok(DICTIONARIES.tr.settingsModal.tabAccounts.length > 0);
    assert.ok(DICTIONARIES.en.settingsModal.tabAccounts.length > 0);
    assert.ok(DICTIONARIES.tr.dock.commitPushBtn.length > 0);
    assert.ok(DICTIONARIES.en.dock.driveSyncBtn.length > 0);
  });
});
