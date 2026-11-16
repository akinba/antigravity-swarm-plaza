import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DOCK_MODEL,
  DOCK_MODE_OPTIONS,
  DOCK_MODEL_OPTIONS,
  detectAutocompleteTrigger,
  extractMentions,
  filterMentionSuggestions,
  filterSlashSuggestions,
} from '../../src/client/components/RetroCommandDock';
import { DICTIONARIES } from '../../src/client/i18n/translations';

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

  it('exposes the 5 required models with Gemini 4 Hydrogen as default and 3 execution modes', () => {
    assert.equal(DEFAULT_DOCK_MODEL, 'gemini-4-hydrogen-medium');
    assert.deepEqual(
      DOCK_MODEL_OPTIONS.map((m) => m.id),
      [
        'gemini-4-carbon-medium',
        'gemini-4-argon-medium',
        'gemini-4-hydrogen-medium',
        'gemini-3.8-flash-fast',
        'qwen2.5-coder:14b',
      ],
    );
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
  });
});
