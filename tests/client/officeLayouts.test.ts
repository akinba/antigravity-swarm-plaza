import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GRID_H, GRID_W } from '../../src/client/engine/isoMath.js';
import {
  ELEVATOR_SLOT,
  getFloorLayout,
  THEME_PALETTES,
  type FloorLayout,
} from '../../src/client/engine/officeLayouts.js';
import { buildWalkableGridForFurniture, findPath, type ZoneSlot } from '../../src/client/engine/pathfinding.js';
import type { OfficeZone } from '../../src/shared/types.js';

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
});
