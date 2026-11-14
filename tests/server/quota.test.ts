import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyQuotaPool,
  extractQuotaObservations,
  parseTranscriptSummary,
} from '../../src/server/brainScanner.js';
import {
  LAST_ERROR_RETENTION_MS,
  buildEmployeeLastError,
  buildQuotaPools,
  getModelContextLimit,
} from '../../src/server/gamification.js';

describe('Account quota & context window parsing', () => {
  const nowMs = Date.parse('2026-11-14T13:00:00Z');

  it('classifies model names into quota pools', () => {
    assert.equal(classifyQuotaPool('gemini-4-hydrogen-medium'), 'gemini');
    assert.equal(classifyQuotaPool('claude-sonnet-5-5-medium'), 'claude_gpt');
    assert.equal(classifyQuotaPool('gpt-oss-120b-medium'), 'claude_gpt');
    assert.equal(classifyQuotaPool('unknown-model'), null);
  });

  it('parses [quota] system messages and swarm models quotas JSON', () => {
    const warning = JSON.stringify({
      created_at: '2026-11-14T12:50:00Z',
      type: 'SYSTEM',
      content:
        '[quota] model gemini-4-hydrogen-medium is low on quota (18% remaining, resets at 2026-11-14T17:33:45Z)',
    });
    const obs = extractQuotaObservations(warning, '2026-11-14T12:50:00Z');
    assert.equal(obs.length, 1);
    assert.equal(obs[0].pool, 'gemini');
    assert.equal(obs[0].remainingPct, 18);
    assert.equal(obs[0].resetsAt, '2026-11-14T17:33:45Z');

    const modelsOutput = JSON.stringify({
      created_at: '2026-11-14T12:55:00Z',
      type: 'TOOL_RESPONSE',
      content: JSON.stringify({
        quotas: {
          'claude-opus-5-5-high': { quota_remaining: '46%', quota_resets: '2026-11-19T18:46:43Z' },
          'gemini-4-argon-low': { quota_remaining: '18%', quota_resets: '2026-11-14T17:33:45Z' },
        },
      }),
    });
    const obs2 = extractQuotaObservations(modelsOutput, '2026-11-14T12:55:00Z');
    const byPool = new Map(obs2.map((o) => [o.pool, o]));
    assert.equal(byPool.get('claude_gpt')?.remainingPct, 46);
    assert.equal(byPool.get('gemini')?.remainingPct, 18);
  });

  it('tracks last-turn context tokens (input + cache read), reflecting compaction', () => {
    const lines = [
      JSON.stringify({
        type: 'PLANNER_RESPONSE',
        created_at: '2026-11-14T12:00:00Z',
        usage: { input_tokens: 100_000, cache_read_tokens: 400_000, output_tokens: 500 },
      }),
      JSON.stringify({
        type: 'PLANNER_RESPONSE',
        created_at: '2026-11-14T12:10:00Z',
        usage: { input_tokens: 8_240, cache_read_tokens: 51_832, output_tokens: 300 },
      }),
    ].join('\n');
    const summary = parseTranscriptSummary(lines);
    assert.equal(summary.lastContextTokens, 60_072);
    assert.equal(summary.inputTokens, 108_240);
  });

  it('builds quota pools, dropping observations whose reset time already passed', () => {
    const fresh = parseTranscriptSummary(
      JSON.stringify({
        created_at: '2026-11-14T12:50:00Z',
        content:
          '[quota] model gemini-4-hydrogen-medium is low on quota (14% remaining, resets at 2026-11-14T13:38:00Z)',
      }),
    );
    const stale = parseTranscriptSummary(
      JSON.stringify({
        created_at: '2026-11-13T08:00:00Z',
        content:
          '[quota] model claude-sonnet-5-5-medium is low on quota (9% remaining, resets at 2026-11-13T09:00:00Z)',
      }),
    );
    const pools = buildQuotaPools([fresh, stale], nowMs);
    assert.equal(pools.length, 1);
    assert.equal(pools[0].pool, 'gemini');
    assert.equal(pools[0].remainingPct, 14);
    assert.equal(pools[0].isLowWarning, true);
    assert.deepEqual(buildQuotaPools([], nowMs), []);
  });

  it('maps model ids to context window limits', () => {
    assert.equal(getModelContextLimit('gemini-4-hydrogen-medium'), 1_000_000);
    assert.equal(getModelContextLimit('claude-sonnet-5-5-medium'), 200_000);
    assert.equal(getModelContextLimit('gpt-oss-120b-medium'), 128_000);
  });

  it('preserves lastError across subsequent DONE steps and marks resolved: true', () => {
    const errTs = '2026-11-14T12:58:00Z';
    const lines = [
      JSON.stringify({
        step_index: 7,
        type: 'TOOL_RESPONSE',
        status: 'ERROR',
        created_at: errTs,
        tool_calls: [{ name: 'run_command', args: { CommandLine: 'npm test' } }],
        error: { message: 'AssertionError: expected 1 to equal 2' },
      }),
      JSON.stringify({
        step_index: 8,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-14T12:58:05Z',
        content: 'Recovered and continuing.',
      }),
    ].join('\n');

    const summary = parseTranscriptSummary(lines);
    assert.equal(summary.lastStepStatus, 'DONE');
    assert.ok(summary.lastError);
    assert.equal(summary.lastError.stepIndex, 7);
    assert.equal(summary.lastError.timestamp, errTs);
    assert.equal(summary.lastError.toolName, 'run_command');
    assert.equal(summary.lastError.target, 'npm test');
    assert.equal(summary.lastError.message, 'AssertionError: expected 1 to equal 2');

    const resolvedErr = buildEmployeeLastError('conv-1', summary, 'working', 0, nowMs);
    assert.ok(resolvedErr);
    assert.equal(resolvedErr.resolved, true);
    assert.equal(resolvedErr.message, 'AssertionError: expected 1 to equal 2');

    const activeErr = buildEmployeeLastError('conv-1', summary, 'error', 1, nowMs);
    assert.ok(activeErr);
    assert.equal(activeErr.resolved, false);

    // Errors older than LAST_ERROR_RETENTION_MS (60m) are dropped
    const expiredErr = buildEmployeeLastError(
      'conv-1',
      summary,
      'working',
      0,
      Date.parse(errTs) + LAST_ERROR_RETENTION_MS + 1000,
    );
    assert.equal(expiredErr, undefined);
  });
});
