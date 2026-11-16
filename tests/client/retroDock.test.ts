import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DOCK_MODEL,
  DOCK_MODE_OPTIONS,
  SWARM_ROLES,
  appendPromptStreamLog,
  buildDefaultSwarmProfile,
  buildDockModelOptions,
  detectAutocompleteTrigger,
  extractMentions,
  filterMentionSuggestions,
  filterSlashSuggestions,
  getProjectSwarmStorageKey,
  resolveOrchestration,
  resolvePromptProvider,
} from '../../src/client/components/RetroCommandDock';
import { deriveMentionFromModel } from '../../src/client/components/SettingsModal';
import { DICTIONARIES } from '../../src/client/i18n/translations';
import type { GeminiModelInfo, LocalAgentConfig } from '../../src/shared/types';

describe('RetroCommandDock helpers & i18n', () => {
  it('detects @ and / autocomplete triggers at cursor position', () => {
    assert.deepEqual(detectAutocompleteTrigger('@cod', 4), {
      kind: '@',
      query: 'cod',
      startIndex: 0,
    });
    assert.deepEqual(detectAutocompleteTrigger('Fix bug @local', 14), {
      kind: '@',
      query: 'local',
      startIndex: 8,
    });
    assert.deepEqual(detectAutocompleteTrigger('/sw', 3), {
      kind: '/',
      query: 'sw',
      startIndex: 0,
    });
    assert.equal(detectAutocompleteTrigger('email@domain.com', 16), null);
    assert.equal(detectAutocompleteTrigger('plain prompt', 12), null);
  });

  it('filters @mention suggestions across live floor employees and static roles', () => {
    const live = [
      { id: 'e1', name: 'coder-ui', roleTitle: 'Frontend' },
      { id: 'e2', name: 'coordinator', roleTitle: 'Lead' },
    ];
    const all = filterMentionSuggestions('', live);
    assert.ok(all.some((m) => m.id === 'coder-ui' && m.badge === 'FRONTEND'));
    assert.ok(all.some((m) => m.id === 'local-gpu' && m.badge === 'OLLAMA'));
    // coordinator should not be duplicated
    assert.equal(all.filter((m) => m.id === 'coordinator').length, 1);

    const filtered = filterMentionSuggestions('coder', live);
    assert.ok(filtered.some((m) => m.id === 'coder-ui'));
    assert.ok(filtered.some((m) => m.id === 'coder-lead'));
    assert.ok(filtered.some((m) => m.id === 'coder-rapid'));
    assert.ok(!filtered.some((m) => m.id === 'flash-ops'));
  });

  it('filters / slash command suggestions', () => {
    const all = filterSlashSuggestions('');
    assert.deepEqual(
      all.map((c) => c.command),
      ['/swarm', '/grill-me', '/review', '/compact', '/clear'],
    );
    const rev = filterSlashSuggestions('rev');
    assert.deepEqual(
      rev.map((c) => c.command),
      ['/review'],
    );
  });

  it('extracts unique @mentions from prompt text', () => {
    assert.deepEqual(extractMentions('@coder-ui check @local-gpu and @coder-ui'), [
      'coder-ui',
      'local-gpu',
    ]);
    assert.deepEqual(extractMentions('no mentions here'), []);
  });

  it('returns empty model list when neither Gemini models nor Ollama agents are configured, and exposes 3 execution modes', () => {
    assert.equal(DEFAULT_DOCK_MODEL, '');
    assert.deepEqual(buildDockModelOptions([], []), []);
    assert.deepEqual(DOCK_MODE_OPTIONS, ['turbo', 'safe', 'eco-swarm']);
  });

  it('provides complete TR and EN dock translations', () => {
    assert.equal(DICTIONARIES.en.dock.placeholder, 'Ask anything, @ to mention, / for actions');
    for (const key of Object.keys(DICTIONARIES.en.dock) as Array<
      keyof typeof DICTIONARIES.en.dock
    >) {
      assert.ok(DICTIONARIES.tr.dock[key].length > 0, `tr.dock.${key}`);
      assert.ok(DICTIONARIES.en.dock[key].length > 0, `en.dock.${key}`);
    }
    assert.ok(DICTIONARIES.tr.settingsModal.localAgentsSection.length > 0);
    assert.ok(DICTIONARIES.en.settingsModal.localAgentsSection.length > 0);
    assert.ok(DICTIONARIES.tr.settingsModal.fetchModelsBtn.length > 0);
    assert.ok(DICTIONARIES.en.settingsModal.fetchModelsBtn.length > 0);
  });

  it('dynamically lists user-configured Ollama local agents in dock models, @mentions, and provider resolution', () => {
    const localAgents: LocalAgentConfig[] = [
      {
        id: 'la-1',
        name: 'DeepSeek Coder',
        mention: 'local-deepseek',
        provider: 'ollama',
        model: 'deepseek-r1:14b',
        baseUrl: 'http://localhost:11434',
        enabled: true,
      },
      {
        id: 'la-2',
        name: 'Disabled Llama',
        mention: 'local-llama',
        provider: 'ollama',
        model: 'llama3.2',
        baseUrl: 'http://127.0.0.1:11434',
        enabled: false,
      },
    ];

    const geminiModels: GeminiModelInfo[] = [
      { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
    ];

    const options = buildDockModelOptions(localAgents, geminiModels);
    assert.equal(options.length, 3); // 2 fetched Gemini + 1 enabled Ollama
    assert.ok(options.some((o) => o.id === 'gemini-2.5-flash' && o.provider === 'gemini'));
    assert.ok(options.some((o) => o.id === 'ollama:deepseek-r1:14b' && o.provider === 'ollama'));
    assert.ok(!options.some((o) => o.id === 'ollama:llama3.2'));

    const profile = buildDefaultSwarmProfile(options);
    assert.deepEqual(
      profile.map((p) => p.role),
      [...SWARM_ROLES],
    );
    assert.equal(profile[0].model, 'gemini-2.5-flash');
    assert.equal(profile[0].level, 'medium');
    assert.equal(getProjectSwarmStorageKey('floor-1'), 'swarm_plaza_project_swarm_floor-1');
    assert.equal(getProjectSwarmStorageKey(null), 'swarm_plaza_project_swarm_default');

    const mentions = filterMentionSuggestions('deep', [], localAgents);
    assert.equal(mentions.length, 1);
    assert.equal(mentions[0].label, '@local-deepseek');
    assert.ok(mentions[0].badge.includes('OLLAMA'));

    assert.deepEqual(resolvePromptProvider('ollama:deepseek-r1:14b', localAgents), {
      provider: 'ollama',
      ollamaBaseUrl: 'http://localhost:11434',
    });
    assert.deepEqual(resolvePromptProvider('gemini-4-hydrogen-medium', localAgents), {
      provider: 'gemini',
    });
    assert.equal(deriveMentionFromModel('qwen2.5-coder:14b'), 'local-qwen2.5-coder');
  });

  it('resolves single vs swarm orchestration mode for ENTER and RUN SWARM buttons', () => {
    assert.equal(resolveOrchestration('Fix header alignment'), 'single');
    assert.equal(resolveOrchestration('/swarm refactor dock'), 'swarm');
    assert.equal(resolveOrchestration('Fix header alignment', 'swarm'), 'swarm');
    assert.equal(resolveOrchestration('/swarm refactor dock', 'single'), 'single');
    assert.equal(DICTIONARIES.en.dock.enterSingle, '↵ ENTER');
    assert.equal(DICTIONARIES.tr.dock.enterSingle, '↵ ENTER');
    assert.ok(DICTIONARIES.tr.settingsModal.geminiKeySection.length > 0);
    assert.ok(DICTIONARIES.en.settingsModal.geminiKeySection.length > 0);
  });

  it('concatenates consecutive chunk events for the same runId into a single flowing log line', () => {
    let logs = appendPromptStreamLog([], 'status', '> Hello', 'run-1');
    logs = appendPromptStreamLog(logs, 'chunk', 'Hello', 'run-1');
    logs = appendPromptStreamLog(logs, 'chunk', '!', 'run-1');
    logs = appendPromptStreamLog(logs, 'chunk', ' It seems', 'run-1');
    logs = appendPromptStreamLog(logs, 'chunk', ' fixed.', 'run-1');
    logs = appendPromptStreamLog(logs, 'done', '[DONE]', 'run-1');
    logs = appendPromptStreamLog(logs, 'chunk', 'Next run', 'run-2');

    assert.equal(logs.length, 4);
    assert.equal(logs[0].text, '> Hello');
    assert.equal(logs[1].text, 'Hello! It seems fixed.');
    assert.equal(logs[2].text, '[DONE]');
    assert.equal(logs[3].text, 'Next run');
  });
});
