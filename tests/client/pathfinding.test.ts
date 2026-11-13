import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GRID_H, GRID_W, type GridPoint } from '../../src/client/engine/isoMath.js';
import {
  buildWalkableGrid,
  buildWalkableGridForFurniture,
  facingFromDelta,
  findPath,
  getTileZone,
} from '../../src/client/engine/pathfinding.js';

function makeEmptyGrid(): boolean[][] {
  return Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => true));
}

function assertValidWalkablePath(grid: boolean[][], path: GridPoint[]): void {
  assert.ok(path.length >= 1, 'path should be non-empty');
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    assert.ok(p.gx >= 0 && p.gx < GRID_W, `gx out of bounds: ${p.gx}`);
    assert.ok(p.gy >= 0 && p.gy < GRID_H, `gy out of bounds: ${p.gy}`);
    assert.equal(grid[p.gy][p.gx], true, `step (${p.gx},${p.gy}) is not walkable`);
    if (i > 0) {
      const prev = path[i - 1];
      const manhattan = Math.abs(p.gx - prev.gx) + Math.abs(p.gy - prev.gy);
      assert.equal(manhattan, 1, `non-adjacent step from (${prev.gx},${prev.gy}) to (${p.gx},${p.gy})`);
    }
  }
}

describe('pathfinding walkability grid and helpers', () => {
  it('blocks non-seat furniture while keeping seat cushions walkable', () => {
    const grid = buildWalkableGridForFurniture([
      { gx: 2, gy: 2, kind: 'exec_desk' },
      { gx: 2, gy: 3, kind: 'desk_chair' },
      { gx: 8, gy: 12, kind: 'sofa_l' },
      { gx: 0, gy: 6, kind: 'elevator_doors' },
      { gx: -1, gy: 99, kind: 'dev_desk' }, // out-of-bounds ignored safely
    ]);

    assert.equal(grid.length, GRID_H);
    assert.equal(grid[0].length, GRID_W);
    assert.equal(grid[2][2], false);
    assert.equal(grid[3][2], true);
    assert.equal(grid[12][8], true);
    assert.equal(grid[6][0], true);
  });

  it('computes isometric facing from movement deltas', () => {
    assert.equal(facingFromDelta(0, 0), 'SE');
    assert.equal(facingFromDelta(0, 0, 'NW'), 'NW');
    assert.equal(facingFromDelta(1, 0), 'SE');
    assert.equal(facingFromDelta(-1, 0), 'NW');
    assert.equal(facingFromDelta(0, 1), 'SW');
    assert.equal(facingFromDelta(0, -1), 'NE');
  });

  it('maps grid tiles to expected default office zones', () => {
    assert.equal(getTileZone(2, 2), 'DESK_ARCHITECT');
    assert.equal(getTileZone(7, 2), 'WAR_ROOM');
    assert.equal(getTileZone(12, 2), 'SERVER_RACK');
    assert.equal(getTileZone(3, 7), 'DESK_CODING');
    assert.equal(getTileZone(9, 7), 'DESK_QA');
    assert.equal(getTileZone(12, 11), 'COFFEE_LOUNGE');
  });
});

describe('pathfinding A* shortest paths, obstacles, and unreachable targets', () => {
  it('returns [goal] when start equals goal', () => {
    const grid = makeEmptyGrid();
    assert.deepEqual(findPath(grid, { gx: 4, gy: 5 }, { gx: 4, gy: 5 }), [{ gx: 4, gy: 5 }]);
  });

  it('finds a shortest 4-directional path on an open grid', () => {
    const grid = makeEmptyGrid();
    const start = { gx: 1, gy: 2 };
    const goal = { gx: 6, gy: 5 };
    const path = findPath(grid, start, goal);

    assertValidWalkablePath(grid, path);
    assert.deepEqual(path[0], start);
    assert.deepEqual(path[path.length - 1], goal);
    assert.equal(path.length, Math.abs(goal.gx - start.gx) + Math.abs(goal.gy - start.gy) + 1);
  });

  it('avoids obstacle walls when routing between start and goal', () => {
    const grid = makeEmptyGrid();
    // Vertical barrier at gx=5 from gy=0..11, leaving a gap at gy=12..13
    for (let gy = 0; gy <= 11; gy++) {
      grid[gy][5] = false;
    }

    const start = { gx: 3, gy: 4 };
    const goal = { gx: 7, gy: 4 };
    const path = findPath(grid, start, goal);

    assertValidWalkablePath(grid, path);
    assert.deepEqual(path[0], start);
    assert.deepEqual(path[path.length - 1], goal);
    assert.ok(path.some((p) => p.gx === 5 && p.gy >= 12), 'expected path to route through gap');
  });

  it('snaps blocked or out-of-bounds start/goal to nearest walkable tile', () => {
    const grid = makeEmptyGrid();
    grid[5][5] = false;

    const path = findPath(grid, { gx: -3, gy: 0 }, { gx: 5, gy: 5 });
    assertValidWalkablePath(grid, path);
    assert.deepEqual(path[0], { gx: 0, gy: 0 });
    const end = path[path.length - 1];
    assert.equal(grid[end.gy][end.gx], true);
    assert.ok(Math.abs(end.gx - 5) <= 1 && Math.abs(end.gy - 5) <= 1);
  });

  it('returns [goal] fallback when the target is completely walled off (unreachable)', () => {
    const grid = makeEmptyGrid();
    // Surround (10, 10) with blocked tiles so it is walkable itself but unreachable
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      grid[10 + dy][10 + dx] = false;
    }

    const path = findPath(grid, { gx: 0, gy: 6 }, { gx: 10, gy: 10 });
    assert.deepEqual(path, [{ gx: 10, gy: 10 }]);
  });

  it('routes across the default furniture layout from elevator to lounge', () => {
    const grid = buildWalkableGrid();
    const path = findPath(grid, { gx: 0, gy: 6 }, { gx: 14, gy: 10 });

    assertValidWalkablePath(grid, path);
    assert.deepEqual(path[0], { gx: 0, gy: 6 });
    assert.deepEqual(path[path.length - 1], { gx: 14, gy: 10 });
  });
});
