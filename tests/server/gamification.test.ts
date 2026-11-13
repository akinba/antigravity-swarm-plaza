import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDemoFloor, resetDemoTick } from '../../src/server/demoSimulator.js';

describe('Demo Simulator Roster & Gender Diversity', () => {
  it('includes balanced female and male employees in getDemoFloor(true)', () => {
    resetDemoTick();
    const floor = getDemoFloor(true);

    const femaleCount = floor.employees.filter((e) => e.gender === 'female').length;
    const maleCount = floor.employees.filter((e) => e.gender === 'male').length;

    assert.ok(femaleCount >= 2, `Expected at least 2 female employees, got ${femaleCount}`);
    assert.ok(maleCount >= 2, `Expected at least 2 male employees, got ${maleCount}`);
  });
});
