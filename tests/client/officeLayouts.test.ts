import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GRID_H, GRID_W } from '../../src/client/engine/isoMath.js';
import {
  ELEVATOR_SLOT,
  getFloorLayout,
  getVisualFloorKind,
  isPartitionKind,
  resolvePartitionSeam,
  THEME_PALETTES,
  type FloorLayout,
} from '../../src/client/engine/officeLayouts.js';
import {
  drawEnhancedBackWalls,
  drawEnhancedFloorTile,
  drawEnhancedFurniture,
  drawExtraFurnitureProp,
} from '../../src/client/engine/officePropsSprites.js';
import { buildWalkableGridForFurniture, findPath, type ZoneSlot } from '../../src/client/engine/pathfinding.js';
import type { OfficeZone } from '../../src/shared/types.js';

const MINI_ROOM_FIXTURE_KINDS = [
  'phone_booth',
  'snack_vending',
  'arcade_cabinet',
  'library_table',
  '3d_printer',
] as const;

const ALL_ZONES: OfficeZone[] = [
  'DESK_ARCHITECT',
  'DESK_CODING',
  'DESK_QA',
  'WAR_ROOM',
  'SERVER_RACK',
  'COFFEE_LOUNGE',
  'ELEVATOR',
];

function getAllFiveLayouts(): FloorLayout[] {
  const layouts: FloorLayout[] = [];
  for (let seed = 0; seed < 5; seed++) {
    layouts.push(getFloorLayout('test-floor', 0, seed));
  }
  layouts.sort((a, b) => a.blueprintIndex - b.blueprintIndex);
  return layouts;
}

describe('officeLayouts all 5 floor blueprints', () => {
  it('exposes 5 distinct blueprints and matching theme palettes', () => {
    const layouts = getAllFiveLayouts();
    assert.deepEqual(
      layouts.map((l) => l.blueprintIndex),
      [0, 1, 2, 3, 4],
    );
    for (const layout of layouts) {
      assert.equal(layout.themePalette, THEME_PALETTES[layout.themeIndex]);
    }
  });

  it('keeps all furniture, slots, and props within 16x14 grid bounds', () => {
    for (const layout of getAllFiveLayouts()) {
      for (const item of layout.furniture) {
        assert.ok(
          Number.isInteger(item.gx) && item.gx >= 0 && item.gx < GRID_W,
          `blueprint ${layout.blueprintIndex} furniture ${item.kind} gx out of bounds: ${item.gx}`,
        );
        assert.ok(
          Number.isInteger(item.gy) && item.gy >= 0 && item.gy < GRID_H,
          `blueprint ${layout.blueprintIndex} furniture ${item.kind} gy out of bounds: ${item.gy}`,
        );
      }

      const slotGroups: Array<[string, ZoneSlot[]]> = [
        ...ALL_ZONES.map((z) => [`zoneSlots.${z}`, layout.zoneSlots[z]] as [string, ZoneSlot[]]),
        ['presenterSlot', [layout.presenterSlot]],
        ['meetingChairSlots', layout.meetingChairSlots],
        ['gamingSlots', layout.gamingSlots],
        ['loungeSeatSlots', layout.loungeSeatSlots],
        ['coffeeSlots', layout.coffeeSlots],
        ['watercoolerSlots', layout.watercoolerSlots],
        ['pizzaSlots', layout.pizzaSlots],
      ];

      for (const [label, slots] of slotGroups) {
        assert.ok(slots.length > 0, `blueprint ${layout.blueprintIndex} ${label} is empty`);
        for (const slot of slots) {
          assert.ok(
            slot.gx >= 0 && slot.gx < GRID_W && slot.gy >= 0 && slot.gy < GRID_H,
            `blueprint ${layout.blueprintIndex} ${label} slot (${slot.gx},${slot.gy}) out of bounds`,
          );
        }
      }

      for (const prop of layout.propPositions) {
        assert.ok(
          prop.gx >= 0 && prop.gx < GRID_W && prop.gy >= 0 && prop.gy < GRID_H,
          `blueprint ${layout.blueprintIndex} prop ${prop.key} (${prop.gx},${prop.gy}) out of bounds`,
        );
      }
    }
  });

  it('has no overlapping furniture collisions on any blueprint', () => {
    for (const layout of getAllFiveLayouts()) {
      const seen = new Map<string, string>();
      for (const item of layout.furniture) {
        const key = `${item.gx},${item.gy}`;
        const prev = seen.get(key);
        assert.equal(
          prev,
          undefined,
          `blueprint ${layout.blueprintIndex} collision at (${key}): ${prev} vs ${item.kind}`,
        );
        seen.set(key, item.kind);
      }
    }
  });

  it('keeps elevator entrance gx:0 gy:6..7 walkable and all zone/activity slots reachable', () => {
    for (const layout of getAllFiveLayouts()) {
      const grid = buildWalkableGridForFurniture(layout.furniture);

      // Elevator entrance tiles gx:0, gy:6..7 must be walkable and mapped to ELEVATOR
      assert.equal(grid[6][0], true, `blueprint ${layout.blueprintIndex} (0,6) blocked`);
      assert.equal(grid[7][0], true, `blueprint ${layout.blueprintIndex} (0,7) blocked`);
      assert.equal(layout.getTileZone(0, 6), 'ELEVATOR');
      assert.equal(layout.getTileZone(0, 7), 'ELEVATOR');
      assert.deepEqual(layout.zoneSlots.ELEVATOR[0], ELEVATOR_SLOT);

      const allTargets: Array<[string, ZoneSlot]> = [
        ...ALL_ZONES.flatMap((z) =>
          layout.zoneSlots[z].map((s) => [`zoneSlots.${z}`, s] as [string, ZoneSlot]),
        ),
        ['presenterSlot', layout.presenterSlot],
        ...layout.meetingChairSlots.map((s) => ['meetingChairSlots', s] as [string, ZoneSlot]),
        ...layout.gamingSlots.map((s) => ['gamingSlots', s] as [string, ZoneSlot]),
        ...layout.loungeSeatSlots.map((s) => ['loungeSeatSlots', s] as [string, ZoneSlot]),
        ...layout.coffeeSlots.map((s) => ['coffeeSlots', s] as [string, ZoneSlot]),
        ...layout.watercoolerSlots.map((s) => ['watercoolerSlots', s] as [string, ZoneSlot]),
        ...layout.pizzaSlots.map((s) => ['pizzaSlots', s] as [string, ZoneSlot]),
      ];

      for (const [label, slot] of allTargets) {
        assert.equal(
          grid[slot.gy][slot.gx],
          true,
          `blueprint ${layout.blueprintIndex} ${label} (${slot.gx},${slot.gy}) is not walkable`,
        );

        for (const entrance of [
          { gx: 0, gy: 6 },
          { gx: 0, gy: 7 },
        ]) {
          const path = findPath(grid, entrance, slot);
          assert.deepEqual(path[path.length - 1], { gx: slot.gx, gy: slot.gy });
          if (slot.gx !== entrance.gx || slot.gy !== entrance.gy) {
            assert.ok(
              path.length > 1,
              `blueprint ${layout.blueprintIndex} ${label} (${slot.gx},${slot.gy}) unreachable from (${entrance.gx},${entrance.gy})`,
            );
            assert.deepEqual(path[0], entrance);
          }
        }
      }
    }
  });

  it('populates dead-space mini-rooms with all 5 custom fixtures on all 5 blueprints and keeps surrounding walkways reachable', () => {
    const deadSpaceZonesByBlueprint: Record<
      number,
      Array<{ label: string; x0: number; x1: number; y0: number; y1: number }>
    > = {
      0: [
        { label: 'SW nook (0..3,11..13)', x0: 0, x1: 3, y0: 11, y1: 13 },
        { label: 'East mid nook (13..15,6..8)', x0: 13, x1: 15, y0: 6, y1: 8 },
      ],
      1: [
        { label: 'NW nook (0..3,0..2)', x0: 0, x1: 3, y0: 0, y1: 2 },
        { label: 'East corridor (13..15,5..9)', x0: 13, x1: 15, y0: 5, y1: 9 },
        { label: 'SW maker nook (0..3,12..13)', x0: 0, x1: 3, y0: 12, y1: 13 },
      ],
      2: [
        { label: 'East corridor (13..15,5..8)', x0: 13, x1: 15, y0: 5, y1: 8 },
        { label: 'Mid-south nook (5..8,11..13)', x0: 5, x1: 8, y0: 11, y1: 13 },
      ],
      3: [
        { label: 'SE corner (11..15,11..13)', x0: 11, x1: 15, y0: 11, y1: 13 },
        { label: 'SW corner (0..3,11..13)', x0: 0, x1: 3, y0: 11, y1: 13 },
        { label: 'NE corner (12..15,0..2)', x0: 12, x1: 15, y0: 0, y1: 2 },
      ],
      4: [
        { label: 'SE corner (11..15,11..13)', x0: 11, x1: 15, y0: 11, y1: 13 },
        { label: 'Mid-south nook (5..9,11..13)', x0: 5, x1: 9, y0: 11, y1: 13 },
      ],
    };

    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const layout of getAllFiveLayouts()) {
      const kindsOnFloor = new Set(layout.furniture.map((f) => f.kind));
      for (const fixture of MINI_ROOM_FIXTURE_KINDS) {
        assert.equal(
          kindsOnFloor.has(fixture),
          true,
          `blueprint ${layout.blueprintIndex} (${layout.deskStyle}) missing custom fixture '${fixture}'`,
        );
      }

      for (const zone of deadSpaceZonesByBlueprint[layout.blueprintIndex]) {
        const count = layout.furniture.filter(
          (f) => f.gx >= zone.x0 && f.gx <= zone.x1 && f.gy >= zone.y0 && f.gy <= zone.y1,
        ).length;
        assert.ok(
          count >= 3,
          `blueprint ${layout.blueprintIndex} ${zone.label} still sparse (${count} items)`,
        );
      }

      // Every custom mini-room fixture must border >=1 walkable tile reachable from elevator (0,6)
      const grid = buildWalkableGridForFurniture(layout.furniture);
      for (const item of layout.furniture) {
        if (!(MINI_ROOM_FIXTURE_KINDS as readonly string[]).includes(item.kind)) continue;
        const walkableNeighbors = dirs
          .map(({ dx, dy }) => ({ gx: item.gx + dx, gy: item.gy + dy }))
          .filter(
            (p) => p.gx >= 0 && p.gx < GRID_W && p.gy >= 0 && p.gy < GRID_H && grid[p.gy][p.gx],
          );
        assert.ok(
          walkableNeighbors.length >= 1,
          `blueprint ${layout.blueprintIndex} ${item.kind} at (${item.gx},${item.gy}) has no adjacent open walkway`,
        );
        const reachableNeighbor = walkableNeighbors.some((n) => {
          const path = findPath(grid, { gx: 0, gy: 6 }, n);
          return (
            path[0].gx === 0 &&
            path[0].gy === 6 &&
            path[path.length - 1].gx === n.gx &&
            path[path.length - 1].gy === n.gy &&
            (n.gx === 0 && n.gy === 6 ? path.length === 1 : path.length > 1)
          );
        });
        assert.equal(
          reachableNeighbor,
          true,
          `blueprint ${layout.blueprintIndex} ${item.kind} at (${item.gx},${item.gy}) walkway unreachable from elevator`,
        );
      }
    }
  });

  it('renders all 5 custom 2.5D mini-room furniture props with strictly positive geometry across zoom 0.75..2.0', () => {
    const zooms = [0.75, 1.0, 1.35, 2.0];
    const times = [0, 1.25, 3.7];

    for (const kind of MINI_ROOM_FIXTURE_KINDS) {
      for (const zoom of zooms) {
        for (const timeSec of times) {
          for (const occupied of [false, true]) {
            const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
            const noop = () => {};
            const ctx = {
              fillStyle: '#000',
              strokeStyle: '#000',
              lineWidth: 1,
              beginPath: noop,
              closePath: noop,
              moveTo: noop,
              lineTo: noop,
              fill: noop,
              stroke: noop,
              fillRect: (x: number, y: number, w: number, h: number) => {
                rects.push({ x, y, w, h });
              },
              strokeRect: (x: number, y: number, w: number, h: number) => {
                rects.push({ x, y, w, h });
              },
            } as unknown as CanvasRenderingContext2D;

            const handled = drawExtraFurnitureProp(ctx, kind, 240, 180, zoom, timeSec, occupied);
            assert.equal(handled, true, `drawExtraFurnitureProp did not handle '${kind}'`);
            assert.ok(rects.length > 0, `drawExtraFurnitureProp '${kind}' drew no rects`);
            for (const r of rects) {
              assert.ok(
                Number.isFinite(r.x) && Number.isFinite(r.y) && r.w >= 1 && r.h >= 1,
                `Invalid rect for '${kind}' at zoom=${zoom}: ${JSON.stringify(r)}`,
              );
            }
          }
        }
      }
    }
  });

  it('renders drawEnhancedFloorTile, drawEnhancedBackWalls, and drawEnhancedFurniture cleanly across all 5 blueprints, day/night, and zoom 0.75..2.0 with balanced save/restore', () => {
    const zooms = [0.75, 1.0, 2.0];
    const zones: OfficeZone[] = ['DESK_CODING', 'COFFEE_LOUNGE', 'SERVER_RACK', 'WAR_ROOM'];
    const layouts = getAllFiveLayouts();

    const makeMockCtx = () => {
      const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
      let saveCount = 0;
      let restoreCount = 0;
      const noop = () => {};
      const gradStub = { addColorStop: noop };
      const ctx = {
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        font: '10px monospace',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        save: () => {
          saveCount += 1;
        },
        restore: () => {
          restoreCount += 1;
        },
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        quadraticCurveTo: noop,
        bezierCurveTo: noop,
        ellipse: noop,
        arc: noop,
        rect: noop,
        roundRect: noop,
        clip: noop,
        setLineDash: noop,
        fill: noop,
        stroke: noop,
        fillText: noop,
        strokeText: noop,
        measureText: (t: string) => ({ width: t.length * 6 }),
        createLinearGradient: () => gradStub,
        createRadialGradient: () => gradStub,
        fillRect: (x: number, y: number, w: number, h: number) => {
          rects.push({ x, y, w, h });
        },
        strokeRect: (x: number, y: number, w: number, h: number) => {
          rects.push({ x, y, w, h });
        },
      } as unknown as CanvasRenderingContext2D;
      return { ctx, rects, getBalance: () => ({ saveCount, restoreCount }) };
    };

    for (const layout of layouts) {
      const uniqueKinds = [...new Set(layout.furniture.map((f) => f.kind))];
      for (const night of [false, true]) {
        for (const zoom of zooms) {
          const mock = makeMockCtx();

          drawEnhancedBackWalls(
            mock.ctx,
            400,
            100,
            GRID_W,
            GRID_H,
            zoom,
            night,
            1.5,
            layout.themePalette,
          );

          for (const z of zones) {
            drawEnhancedFloorTile(mock.ctx, 2, 3, 400, 200, zoom, z, layout.themePalette, night, 1.5);
          }

          for (const kind of uniqueKinds) {
            drawEnhancedFurniture(
              mock.ctx,
              kind,
              320,
              240,
              zoom,
              1.5,
              night,
              true,
              'argon',
              false,
              'SWARM BOARD',
              2,
            );
          }

          const { saveCount, restoreCount } = mock.getBalance();
          assert.equal(
            saveCount,
            restoreCount,
            `Unbalanced save/restore on blueprint ${layout.blueprintIndex} (night=${night}, zoom=${zoom}): save=${saveCount}, restore=${restoreCount}`,
          );
          for (const r of mock.rects) {
            assert.ok(
              Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
              `Invalid enhanced rect on blueprint ${layout.blueprintIndex} (night=${night}, zoom=${zoom}): ${JSON.stringify(r)}`,
            );
          }
        }
      }
    }
  });

  it('aligns every glass and wood partition strictly on a visual floor zone seam without colliding with work desks', () => {
    const workDeskKinds = new Set(['dev_desk', 'qa_desk', 'exec_desk']);

    for (const layout of getAllFiveLayouts()) {
      const partitions = layout.furniture.filter((f) => isPartitionKind(f.kind));
      const workDesks = layout.furniture.filter((f) => workDeskKinds.has(f.kind));
      assert.ok(
        partitions.length >= 8,
        `blueprint ${layout.blueprintIndex} expected >= 8 partitions, found ${partitions.length}`,
      );

      for (const part of partitions) {
        const seam = resolvePartitionSeam(part, layout.getTileZone);
        const isYWall = part.kind === 'glass_partition' || part.kind === 'wood_partition';

        if (isYWall) {
          assert.equal(
            seam.gy,
            part.gy,
            `blueprint ${layout.blueprintIndex} ${part.kind} at (${part.gx},${part.gy}) unexpectedly shifted gy=${seam.gy}`,
          );
          assert.equal(
            Math.abs((seam.gx % 1) - 0.5) < 1e-6,
            true,
            `blueprint ${layout.blueprintIndex} ${part.kind} at (${part.gx},${part.gy}) did not snap to .5 gx seam (${seam.gx})`,
          );
          const leftGx = Math.floor(seam.gx);
          const rightGx = Math.ceil(seam.gx);
          assert.ok(
            leftGx >= 0 && rightGx < GRID_W,
            `blueprint ${layout.blueprintIndex} ${part.kind} seam gx=${seam.gx} out of interior bounds`,
          );
          const leftKind = getVisualFloorKind(layout.getTileZone(leftGx, part.gy));
          const rightKind = getVisualFloorKind(layout.getTileZone(rightGx, part.gy));
          assert.notEqual(
            leftKind,
            rightKind,
            `blueprint ${layout.blueprintIndex} floating ${part.kind} at (${part.gx},${part.gy}) -> seam (${seam.gx},${seam.gy}): both sides have floor kind '${leftKind}'`,
          );
        } else {
          assert.equal(
            seam.gx,
            part.gx,
            `blueprint ${layout.blueprintIndex} ${part.kind} at (${part.gx},${part.gy}) unexpectedly shifted gx=${seam.gx}`,
          );
          assert.equal(
            Math.abs((seam.gy % 1) - 0.5) < 1e-6,
            true,
            `blueprint ${layout.blueprintIndex} ${part.kind} at (${part.gx},${part.gy}) did not snap to .5 gy seam (${seam.gy})`,
          );
          const topGy = Math.floor(seam.gy);
          const botGy = Math.ceil(seam.gy);
          assert.ok(
            topGy >= 0 && botGy < GRID_H,
            `blueprint ${layout.blueprintIndex} ${part.kind} seam gy=${seam.gy} out of interior bounds`,
          );
          const topKind = getVisualFloorKind(layout.getTileZone(part.gx, topGy));
          const botKind = getVisualFloorKind(layout.getTileZone(part.gx, botGy));
          assert.notEqual(
            topKind,
            botKind,
            `blueprint ${layout.blueprintIndex} floating ${part.kind} at (${part.gx},${part.gy}) -> seam (${seam.gx},${seam.gy}): both sides have floor kind '${topKind}'`,
          );
        }

        for (const desk of workDesks) {
          const dist = Math.hypot(desk.gx - seam.gx, desk.gy - seam.gy);
          assert.ok(
            dist >= 1.0,
            `blueprint ${layout.blueprintIndex} ${part.kind} seam (${seam.gx},${seam.gy}) collides with ${desk.kind} at (${desk.gx},${desk.gy}), dist=${dist.toFixed(2)}`,
          );
        }
      }
    }
  });
});
