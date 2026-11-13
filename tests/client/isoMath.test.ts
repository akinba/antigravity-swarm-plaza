import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampZoom,
  getDefaultCamera,
  GRID_H,
  GRID_W,
  gridToScreen,
  screenToGrid,
  TILE_H,
  TILE_W,
  type IsoCamera,
} from '../../src/client/engine/isoMath.js';

describe('isoMath constants and zoom clamping', () => {
  it('exposes expected 2:1 isometric tile and grid dimensions', () => {
    assert.equal(TILE_W, 64);
    assert.equal(TILE_H, 32);
    assert.equal(GRID_W, 16);
    assert.equal(GRID_H, 14);
  });

  it('clamps zoom to [0.75, 2.0]', () => {
    assert.equal(clampZoom(0.1), 0.75);
    assert.equal(clampZoom(0.75), 0.75);
    assert.equal(clampZoom(1.25), 1.25);
    assert.equal(clampZoom(2.0), 2.0);
    assert.equal(clampZoom(4.5), 2.0);
  });
});

describe('isoMath coordinate conversions and round-trips', () => {
  it('projects grid origin and isometric axes correctly', () => {
    const cam: IsoCamera = { offsetX: 100, offsetY: 50, zoom: 1 };

    assert.deepEqual(gridToScreen(0, 0, cam), { x: 100, y: 50 });
    assert.deepEqual(gridToScreen(1, 0, cam), {
      x: 100 + TILE_W / 2,
      y: 50 + TILE_H / 2,
    });
    assert.deepEqual(gridToScreen(0, 1, cam), {
      x: 100 - TILE_W / 2,
      y: 50 + TILE_H / 2,
    });
  });

  it('round-trips gridToScreen -> screenToGrid across cameras and fractional tiles', () => {
    const cameras: IsoCamera[] = [
      { offsetX: 0, offsetY: 0, zoom: 1 },
      { offsetX: 420, offsetY: 160, zoom: 0.75 },
      { offsetX: -120, offsetY: 310, zoom: 1.5 },
      { offsetX: 640, offsetY: 240, zoom: 2.0 },
    ];
    const points = [
      { gx: 0, gy: 0 },
      { gx: 7, gy: 6 },
      { gx: 15, gy: 13 },
      { gx: 3.25, gy: 9.75 },
      { gx: 11.8, gy: 2.4 },
    ];

    for (const cam of cameras) {
      for (const pt of points) {
        const screen = gridToScreen(pt.gx, pt.gy, cam);
        const back = screenToGrid(screen.x, screen.y, cam);
        assert.ok(
          Math.abs(back.gx - pt.gx) < 1e-9,
          `gx mismatch for (${pt.gx},${pt.gy}): got ${back.gx}`,
        );
        assert.ok(
          Math.abs(back.gy - pt.gy) < 1e-9,
          `gy mismatch for (${pt.gx},${pt.gy}): got ${back.gy}`,
        );
      }
    }
  });

  it('round-trips screenToGrid -> gridToScreen', () => {
    const cam: IsoCamera = { offsetX: 512, offsetY: 180, zoom: 1.1 };
    const screenPoints = [
      { x: 512, y: 180 },
      { x: 300, y: 420 },
      { x: 960, y: 615 },
    ];

    for (const sp of screenPoints) {
      const grid = screenToGrid(sp.x, sp.y, cam);
      const back = gridToScreen(grid.gx, grid.gy, cam);
      assert.ok(Math.abs(back.x - sp.x) < 1e-9);
      assert.ok(Math.abs(back.y - sp.y) < 1e-9);
    }
  });

  it('centers the default camera and adjusts zoom by viewport width', () => {
    const narrow = getDefaultCamera(640, 480);
    assert.equal(narrow.zoom, 0.85);

    const wide = getDefaultCamera(1280, 800);
    assert.equal(wide.zoom, 1.1);

    const centerScreen = gridToScreen(GRID_W / 2 - 0.5, GRID_H / 2 - 0.5, wide);
    assert.ok(Math.abs(centerScreen.x - 640) < 1e-9);
    assert.ok(Math.abs(centerScreen.y - (400 + 28)) < 1e-9);
  });
});
