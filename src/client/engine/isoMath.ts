export const TILE_W = 64;
export const TILE_H = 32;
export const GRID_W = 16;
export const GRID_H = 14;

export interface IsoCamera {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface GridPoint {
  gx: number;
  gy: number;
}

export function clampZoom(zoom: number): number {
  return Math.max(0.75, Math.min(2.0, zoom));
}

/**
 * Converts 2D grid coordinates (gx, gy) to screen pixel coordinates
 * using standard 2:1 isometric projection.
 */
export function gridToScreen(gx: number, gy: number, camera: IsoCamera): ScreenPoint {
  const isoX = (gx - gy) * (TILE_W / 2);
  const isoY = (gx + gy) * (TILE_H / 2);
  return {
    x: isoX * camera.zoom + camera.offsetX,
    y: isoY * camera.zoom + camera.offsetY,
  };
}

/**
 * Converts screen pixel coordinates back into floating-point grid coordinates.
 */
export function screenToGrid(sx: number, sy: number, camera: IsoCamera): GridPoint {
  const localX = (sx - camera.offsetX) / camera.zoom;
  const localY = (sy - camera.offsetY) / camera.zoom;
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const gx = (localX / halfW + localY / halfH) / 2;
  const gy = (localY / halfH - localX / halfW) / 2;
  return { gx, gy };
}

/**
 * Computes a centered default camera for a given canvas size.
 */
export function getDefaultCamera(width: number, height: number): IsoCamera {
  const centerGx = GRID_W / 2 - 0.5;
  const centerGy = GRID_H / 2 - 0.5;
  const zoom = width < 760 ? 0.85 : 1.1;
  const isoCenterX = (centerGx - centerGy) * (TILE_W / 2);
  const isoCenterY = (centerGx + centerGy) * (TILE_H / 2);
  return {
    offsetX: width / 2 - isoCenterX * zoom,
    offsetY: height / 2 - isoCenterY * zoom + 28,
    zoom,
  };
}
