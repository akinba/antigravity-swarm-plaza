import type { OfficeZone } from '../../shared/types';
import { GRID_H, GRID_W, type GridPoint } from './isoMath';

export type Facing = 'SE' | 'SW' | 'NE' | 'NW';

export interface ZoneSlot {
  gx: number;
  gy: number;
  facing: Facing;
}

/**
 * Blocked furniture coordinates on the 16x14 grid.
 * Kept in sync with furniture placement in OfficeCanvas / pixelSprites.
 */
export const FURNITURE_BLOCKS: ReadonlyArray<{ gx: number; gy: number; kind: string }> = [
  // Executive corner
  { gx: 2, gy: 2, kind: 'exec_desk' },
  // War room whiteboard & table
  { gx: 6, gy: 1, kind: 'whiteboard_l' },
  { gx: 7, gy: 1, kind: 'whiteboard_r' },
  { gx: 7, gy: 3, kind: 'war_table' },
  // Server racks & test terminal
  { gx: 11, gy: 1, kind: 'server_rack' },
  { gx: 12, gy: 1, kind: 'server_rack' },
  { gx: 13, gy: 1, kind: 'server_rack' },
  { gx: 12, gy: 3, kind: 'qa_desk' },
  // Developer dual-monitor desks
  { gx: 2, gy: 6, kind: 'dev_desk' },
  { gx: 5, gy: 6, kind: 'dev_desk' },
  { gx: 2, gy: 9, kind: 'dev_desk' },
  { gx: 5, gy: 9, kind: 'dev_desk' },
  // QA desks
  { gx: 9, gy: 6, kind: 'qa_desk' },
  { gx: 9, gy: 8, kind: 'qa_desk' },
  // Coffee, Lounge & Gaming Corner (gx: 8..15, gy: 9..13)
  { gx: 14, gy: 9, kind: 'coffee_machine' },
  { gx: 13, gy: 10, kind: 'tv_console' },
  { gx: 12, gy: 11, kind: 'gaming_seat' },
  { gx: 13, gy: 11, kind: 'gaming_seat' },
  { gx: 8, gy: 12, kind: 'sofa_l' },
  { gx: 9, gy: 12, kind: 'sofa_r' },
  { gx: 7, gy: 11, kind: 'armchair' },
  { gx: 10, gy: 11, kind: 'armchair' },
  { gx: 11, gy: 12, kind: 'armchair' },
  { gx: 14, gy: 12, kind: 'armchair' },
  { gx: 9, gy: 11, kind: 'lounge_table' },
];

export const GAMING_SLOTS: ZoneSlot[] = [
  { gx: 12, gy: 11, facing: 'NE' },
  { gx: 13, gy: 11, facing: 'NW' },
];

export const LOUNGE_SEAT_SLOTS: ZoneSlot[] = [
  { gx: 8, gy: 12, facing: 'NE' },
  { gx: 9, gy: 12, facing: 'NE' },
  { gx: 7, gy: 11, facing: 'SE' },
  { gx: 10, gy: 11, facing: 'SW' },
  { gx: 11, gy: 12, facing: 'NW' },
  { gx: 14, gy: 12, facing: 'NW' },
];

export const COFFEE_SLOT: ZoneSlot = { gx: 14, gy: 10, facing: 'NW' };

export const ZONE_SLOTS: Record<OfficeZone, ZoneSlot[]> = {
  DESK_ARCHITECT: [
    { gx: 2, gy: 3, facing: 'NE' },
    { gx: 3, gy: 2, facing: 'NW' },
    { gx: 1, gy: 3, facing: 'NE' },
    { gx: 3, gy: 3, facing: 'NW' },
  ],
  WAR_ROOM: [
    { gx: 6, gy: 2, facing: 'NE' },
    { gx: 7, gy: 2, facing: 'NE' },
    { gx: 8, gy: 2, facing: 'NW' },
    { gx: 6, gy: 3, facing: 'SE' },
    { gx: 8, gy: 3, facing: 'SW' },
    { gx: 7, gy: 4, facing: 'NE' },
  ],
  SERVER_RACK: [
    { gx: 11, gy: 2, facing: 'NE' },
    { gx: 12, gy: 2, facing: 'NE' },
    { gx: 13, gy: 2, facing: 'NE' },
    { gx: 11, gy: 3, facing: 'SE' },
    { gx: 13, gy: 3, facing: 'SW' },
  ],
  DESK_CODING: [
    { gx: 2, gy: 7, facing: 'NE' },
    { gx: 5, gy: 7, facing: 'NE' },
    { gx: 2, gy: 10, facing: 'NE' },
    { gx: 5, gy: 10, facing: 'NE' },
    { gx: 3, gy: 6, facing: 'NW' },
    { gx: 6, gy: 6, facing: 'NW' },
    { gx: 3, gy: 9, facing: 'NW' },
    { gx: 6, gy: 9, facing: 'NW' },
  ],
  DESK_QA: [
    { gx: 9, gy: 7, facing: 'NE' },
    { gx: 9, gy: 9, facing: 'NE' },
    { gx: 10, gy: 6, facing: 'NW' },
    { gx: 10, gy: 8, facing: 'NW' },
    { gx: 8, gy: 7, facing: 'SE' },
    { gx: 8, gy: 9, facing: 'SE' },
  ],
  COFFEE_LOUNGE: [
    COFFEE_SLOT,
    ...LOUNGE_SEAT_SLOTS,
  ],
};

/**
 * Returns the floor zone for a given tile coordinate.
 */
export function getTileZone(gx: number, gy: number): OfficeZone {
  if (gx <= 4 && gy <= 4) return 'DESK_ARCHITECT';
  if (gx >= 5 && gx <= 9 && gy <= 4) return 'WAR_ROOM';
  if (gx >= 10 && gy <= 4) return 'SERVER_RACK';
  if (gx <= 7 && gy >= 5) return 'DESK_CODING';
  if (gx >= 8 && gx <= 11 && gy >= 5 && gy <= 9) return 'DESK_QA';
  return 'COFFEE_LOUNGE';
}

const SEAT_FURNITURE_KINDS = new Set(['sofa_l', 'sofa_r', 'armchair', 'gaming_seat']);

/**
 * Builds a 16x14 walkability grid (`true` = walkable, `false` = blocked).
 * Seat cushions remain walkable so A* walks characters directly onto sofas/chairs/poufs.
 */
export function buildWalkableGrid(): boolean[][] {
  const grid: boolean[][] = Array.from({ length: GRID_H }, () =>
    Array.from({ length: GRID_W }, () => true),
  );
  for (const b of FURNITURE_BLOCKS) {
    if (SEAT_FURNITURE_KINDS.has(b.kind)) continue;
    if (b.gy >= 0 && b.gy < GRID_H && b.gx >= 0 && b.gx < GRID_W) {
      grid[b.gy][b.gx] = false;
    }
  }
  return grid;
}

export function facingFromDelta(dx: number, dy: number, fallback: Facing = 'SE'): Facing {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'SE' : 'NW';
  }
  return dy > 0 ? 'SW' : 'NE';
}

function keyOf(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

function findNearestWalkable(grid: boolean[][], target: GridPoint): GridPoint {
  const tx = Math.max(0, Math.min(GRID_W - 1, Math.round(target.gx)));
  const ty = Math.max(0, Math.min(GRID_H - 1, Math.round(target.gy)));
  if (grid[ty][tx]) return { gx: tx, gy: ty };

  for (let r = 1; r < Math.max(GRID_W, GRID_H); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && grid[ny][nx]) {
          return { gx: nx, gy: ny };
        }
      }
    }
  }
  return { gx: 0, gy: 0 };
}

/**
 * 4-directional A* pathfinder on the 16x14 office grid.
 */
export function findPath(grid: boolean[][], startRaw: GridPoint, goalRaw: GridPoint): GridPoint[] {
  const start = findNearestWalkable(grid, startRaw);
  const goal = findNearestWalkable(grid, goalRaw);

  if (start.gx === goal.gx && start.gy === goal.gy) {
    return [goal];
  }

  const open: Array<{ gx: number; gy: number; g: number; f: number }> = [
    {
      gx: start.gx,
      gy: start.gy,
      g: 0,
      f: Math.abs(goal.gx - start.gx) + Math.abs(goal.gy - start.gy),
    },
  ];

  const cameFrom = new Map<string, GridPoint>();
  const gScore = new Map<string, number>([[keyOf(start.gx, start.gy), 0]]);
  const closed = new Set<string>();

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const cKey = keyOf(current.gx, current.gy);

    if (current.gx === goal.gx && current.gy === goal.gy) {
      const path: GridPoint[] = [];
      let curr: GridPoint | undefined = { gx: current.gx, gy: current.gy };
      while (curr) {
        path.unshift(curr);
        curr = cameFrom.get(keyOf(curr.gx, curr.gy));
      }
      return path;
    }

    closed.add(cKey);

    for (const { dx, dy } of dirs) {
      const nx = current.gx + dx;
      const ny = current.gy + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      if (!grid[ny][nx]) continue;
      const nKey = keyOf(nx, ny);
      if (closed.has(nKey)) continue;

      const tentativeG = current.g + 1;
      const prevG = gScore.get(nKey);
      if (prevG === undefined || tentativeG < prevG) {
        cameFrom.set(nKey, { gx: current.gx, gy: current.gy });
        gScore.set(nKey, tentativeG);
        const f = tentativeG + Math.abs(goal.gx - nx) + Math.abs(goal.gy - ny);
        const existing = open.find((o) => o.gx === nx && o.gy === ny);
        if (existing) {
          existing.g = tentativeG;
          existing.f = f;
        } else {
          open.push({ gx: nx, gy: ny, g: tentativeG, f });
        }
      }
    }
  }

  return [goal];
}
