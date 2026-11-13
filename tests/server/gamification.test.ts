import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_STEP_INTERVAL_MS,
  getDemoFloor,
  resetDemoTick,
} from '../../src/server/demoSimulator.js';

describe('Demo Simulator Roster & Gender Diversity', () => {
  it('includes balanced female and male employees in getDemoFloor(true)', () => {
    resetDemoTick();
    const floor = getDemoFloor(true);

    const femaleCount = floor.employees.filter((e) => e.gender === 'female').length;
    const maleCount = floor.employees.filter((e) => e.gender === 'male').length;

    assert.ok(femaleCount >= 2, `Expected at least 2 female employees, got ${femaleCount}`);
    assert.ok(maleCount >= 2, `Expected at least 2 male employees, got ${maleCount}`);
  });

  it('throttles demo progression across rapid 1.5s polls and keeps paired steps zone-stable', () => {
    resetDemoTick();
    const f0 = getDemoFloor('throttled', 100_000);
    const f1 = getDemoFloor('throttled', 101_500);
    const f2 = getDemoFloor('throttled', 110_000);

    assert.equal(f1.companyXp, f0.companyXp);
    assert.equal(f2.companyXp, f0.companyXp);
    assert.deepEqual(
      f1.employees.map((e) => ({ id: e.id, zone: e.zone, activity: e.activity })),
      f0.employees.map((e) => ({ id: e.id, zone: e.zone, activity: e.activity })),
    );
    assert.deepEqual(
      f2.employees.map((e) => ({ id: e.id, zone: e.zone, activity: e.activity })),
      f0.employees.map((e) => ({ id: e.id, zone: e.zone, activity: e.activity })),
    );

    const fNext = getDemoFloor('throttled', 100_000 + DEMO_STEP_INTERVAL_MS);
    assert.ok(fNext.companyXp > f0.companyXp);
    assert.deepEqual(
      fNext.employees.map((e) => ({ id: e.id, zone: e.zone })),
      f0.employees.map((e) => ({ id: e.id, zone: e.zone })),
    );
  });
});
