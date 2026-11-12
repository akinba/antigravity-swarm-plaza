import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { OfficeEmployee, OfficeZone, PlazaFloor } from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';
import {
  clampZoom,
  getDefaultCamera,
  GRID_H,
  GRID_W,
  gridToScreen,
  type GridPoint,
  type IsoCamera,
} from './isoMath';
import {
  buildWalkableGrid,
  facingFromDelta,
  findPath,
  FURNITURE_BLOCKS,
  getTileZone,
  ZONE_SLOTS,
  type Facing,
} from './pathfinding';
import { drawBackWalls, drawEmployeeSprite, drawFloorTile, drawFurniture } from './pixelSprites';

interface OfficeCanvasProps {
  floor: PlazaFloor;
  isNight: boolean;
  selectedEmployeeId: string | null;
  onSelectEmployee: (emp: OfficeEmployee) => void;
  onOpenWhiteboard: () => void;
}

interface ActorState {
  gx: number;
  gy: number;
  path: GridPoint[];
  targetZone: OfficeZone;
  targetSlotGx: number;
  targetSlotGy: number;
  facing: Facing;
  targetFacing: Facing;
  walkPhase: number;
  isWalking: boolean;
}

const WALK_SPEED_TILES_PER_SEC = 3.2;

export const OfficeCanvas: React.FC<OfficeCanvasProps> = ({
  floor,
  isNight,
  selectedEmployeeId,
  onSelectEmployee,
  onOpenWhiteboard,
}) => {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const walkableGrid = useMemo(() => buildWalkableGrid(), []);

  const [camera, setCamera] = useState<IsoCamera>(() => getDefaultCamera(1000, 680));
  const cameraRef = useRef<IsoCamera>(camera);
  cameraRef.current = camera;

  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [hoveredWhiteboard, setHoveredWhiteboard] = useState(false);

  const actorsRef = useRef<Map<string, ActorState>>(new Map());
  const floorRef = useRef<PlazaFloor>(floor);
  floorRef.current = floor;

  const isNightRef = useRef(isNight);
  isNightRef.current = isNight;

  const selectedIdRef = useRef(selectedEmployeeId);
  selectedIdRef.current = selectedEmployeeId;

  const hoveredAgentRef = useRef(hoveredAgentId);
  hoveredAgentRef.current = hoveredAgentId;

  const hoveredBoardRef = useRef(hoveredWhiteboard);
  hoveredBoardRef.current = hoveredWhiteboard;

  const tRef = useRef(t);
  tRef.current = t;

  // Screen-space hit boxes updated every frame
  const agentHitBoxesRef = useRef<Array<{ emp: OfficeEmployee; x: number; y: number; r: number }>>([]);
  const whiteboardHitBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Drag state
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });

  const resetCamera = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCamera(getDefaultCamera(el.clientWidth, el.clientHeight));
  }, []);

  // Re-center on initial mount or floor change
  useEffect(() => {
    resetCamera();
  }, [floor.id, resetCamera]);

  // Sync employees into actor states & trigger A* pathfinding when zone/slot changes
  useEffect(() => {
    const actors = actorsRef.current;
    const activeIds = new Set(floor.employees.map((e) => e.id));

    for (const id of actors.keys()) {
      if (!activeIds.has(id)) {
        actors.delete(id);
      }
    }

    const zoneCounters: Record<OfficeZone, number> = {
      DESK_ARCHITECT: 0,
      DESK_CODING: 0,
      DESK_QA: 0,
      WAR_ROOM: 0,
      SERVER_RACK: 0,
      COFFEE_LOUNGE: 0,
    };

    floor.employees.forEach((emp) => {
      const idx = zoneCounters[emp.zone] ?? 0;
      zoneCounters[emp.zone] = idx + 1;
      const slots = ZONE_SLOTS[emp.zone] || ZONE_SLOTS.DESK_CODING;
      const slot = slots[idx % slots.length];

      const existing = actors.get(emp.id);
      if (!existing) {
        actors.set(emp.id, {
          gx: slot.gx,
          gy: slot.gy,
          path: [],
          targetZone: emp.zone,
          targetSlotGx: slot.gx,
          targetSlotGy: slot.gy,
          facing: slot.facing,
          targetFacing: slot.facing,
          walkPhase: 0,
          isWalking: false,
        });
      } else if (
        existing.targetZone !== emp.zone ||
        existing.targetSlotGx !== slot.gx ||
        existing.targetSlotGy !== slot.gy
      ) {
        const path = findPath(
          walkableGrid,
          { gx: Math.round(existing.gx), gy: Math.round(existing.gy) },
          { gx: slot.gx, gy: slot.gy },
        );
        existing.path = path;
        existing.targetZone = emp.zone;
        existing.targetSlotGx = slot.gx;
        existing.targetSlotGy = slot.gy;
        existing.targetFacing = slot.facing;
      }
    });
  }, [floor.employees, walkableGrid]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Main 60 FPS animation loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now / 1000;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewW = container.clientWidth;
      const viewH = container.clientHeight;
      const cam = cameraRef.current;
      const currentFloor = floorRef.current;
      const night = isNightRef.current;

      // Update actor positions along A* paths
      const actors = actorsRef.current;
      for (const actor of actors.values()) {
        if (actor.path.length > 0) {
          const next = actor.path[0];
          const dx = next.gx - actor.gx;
          const dy = next.gy - actor.gy;
          const dist = Math.hypot(dx, dy);
          const step = WALK_SPEED_TILES_PER_SEC * dt;

          if (dist <= step) {
            actor.gx = next.gx;
            actor.gy = next.gy;
            actor.path.shift();
            if (actor.path.length === 0) {
              actor.isWalking = false;
              actor.facing = actor.targetFacing;
            }
          } else {
            actor.gx += (dx / dist) * step;
            actor.gy += (dy / dist) * step;
            actor.facing = facingFromDelta(dx, dy, actor.facing);
            actor.isWalking = true;
            actor.walkPhase = (actor.walkPhase + dt * 3.5) % 1;
          }
        } else {
          actor.isWalking = false;
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;

      // Background sky / studio void
      ctx.fillStyle = night ? '#0b0e18' : '#182238';
      ctx.fillRect(0, 0, viewW, viewH);

      // Compute top-center vertex of tile (0,0)
      const tile00 = gridToScreen(0, 0, cam);
      const topVertexX = tile00.x;
      const topVertexY = tile00.y - 16 * cam.zoom;

      // 1. Draw back walls & panoramic windows
      drawBackWalls(ctx, topVertexX, topVertexY, GRID_W, GRID_H, cam.zoom, night, timeSec);

      // 2. Draw floor tiles
      for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
          const p = gridToScreen(gx, gy, cam);
          drawFloorTile(ctx, p.x, p.y, gx, gy, getTileZone(gx, gy), cam.zoom, night);
        }
      }

      // 3. Collect depth-sorted renderables (furniture, unlocked props, employees)
      interface RenderItem {
        depth: number;
        draw: () => void;
      }
      const renderables: RenderItem[] = [];

      // Occupied check for dev/qa desks
      const occupiedZones = new Set(
        currentFloor.employees.filter((e) => e.status === 'working').map((e) => e.zone),
      );

      let wbMinX = Infinity;
      let wbMinY = Infinity;
      let wbMaxX = -Infinity;
      let wbMaxY = -Infinity;

      for (const item of FURNITURE_BLOCKS) {
        const p = gridToScreen(item.gx, item.gy, cam);
        const isWb = item.kind === 'whiteboard_l' || item.kind === 'whiteboard_r';
        if (isWb) {
          wbMinX = Math.min(wbMinX, p.x - 22 * cam.zoom);
          wbMinY = Math.min(wbMinY, p.y - 46 * cam.zoom);
          wbMaxX = Math.max(wbMaxX, p.x + 22 * cam.zoom);
          wbMaxY = Math.max(wbMaxY, p.y + 4 * cam.zoom);
        }
        renderables.push({
          depth: item.gx + item.gy,
          draw: () => {
            const occupied =
              (item.kind === 'dev_desk' && occupiedZones.has('DESK_CODING')) ||
              (item.kind === 'qa_desk' && occupiedZones.has('DESK_QA'));
            drawFurniture(
              ctx,
              item.kind,
              p.x,
              p.y,
              cam.zoom,
              timeSec,
              occupied,
              isWb && hoveredBoardRef.current,
              tRef.current.office.whiteboardLabel,
            );
          },
        });
      }

      if (wbMinX < wbMaxX) {
        whiteboardHitBoxRef.current = {
          x: wbMinX,
          y: wbMinY,
          w: wbMaxX - wbMinX,
          h: wbMaxY - wbMinY,
        };
      }

      // Tier-unlocked props placed on safe decorative tiles
      const props = currentFloor.unlockedProps || [];
      const propCoords: Array<{ key: string; kind: string; gx: number; gy: number }> = [
        { key: 'plants', kind: 'prop_plant', gx: 0.4, gy: 4.2 },
        { key: 'plants', kind: 'prop_plant', gx: 14.5, gy: 0.5 },
        { key: 'trophy', kind: 'prop_trophy', gx: 4.1, gy: 1.2 },
        { key: 'arcade', kind: 'prop_arcade', gx: 14.2, gy: 8.5 },
        { key: 'hologram', kind: 'prop_hologram', gx: 7.5, gy: 11.2 },
      ];
      for (const pr of propCoords) {
        if (props.includes(pr.key)) {
          const p = gridToScreen(pr.gx, pr.gy, cam);
          renderables.push({
            depth: pr.gx + pr.gy,
            draw: () => {
              drawFurniture(ctx, pr.kind, p.x, p.y, cam.zoom, timeSec, true, false, '');
            },
          });
        }
      }

      // Employees
      const nextHitBoxes: Array<{ emp: OfficeEmployee; x: number; y: number; r: number }> = [];
      for (const emp of currentFloor.employees) {
        const actor = actors.get(emp.id);
        if (!actor) continue;
        const p = gridToScreen(actor.gx, actor.gy, cam);
        nextHitBoxes.push({
          emp,
          x: p.x,
          y: p.y - 20 * cam.zoom,
          r: 22 * cam.zoom,
        });
        renderables.push({
          depth: actor.gx + actor.gy + 0.05,
          draw: () => {
            drawEmployeeSprite(
              ctx,
              emp,
              p.x,
              p.y,
              cam.zoom,
              actor.facing,
              actor.isWalking,
              actor.walkPhase,
              timeSec,
              hoveredAgentRef.current === emp.id,
              selectedIdRef.current === emp.id,
            );
          },
        });
      }
      agentHitBoxesRef.current = nextHitBoxes;

      // Depth-sort & draw
      renderables.sort((a, b) => a.depth - b.depth);
      for (const r of renderables) {
        r.draw();
      }

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      camStartX: camera.offsetX,
      camStartY: camera.offsetY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.moved = true;
      }
      if (dragRef.current.moved) {
        setCamera((prev) => ({
          ...prev,
          offsetX: dragRef.current.camStartX + dx,
          offsetY: dragRef.current.camStartY + dy,
        }));
      }
      return;
    }

    // Hover hit-testing (top-most employee first)
    let foundAgent: string | null = null;
    for (let i = agentHitBoxesRef.current.length - 1; i >= 0; i--) {
      const box = agentHitBoxesRef.current[i];
      if (Math.hypot(lx - box.x, ly - box.y) <= box.r) {
        foundAgent = box.emp.id;
        break;
      }
    }
    setHoveredAgentId(foundAgent);

    if (!foundAgent && whiteboardHitBoxRef.current) {
      const wb = whiteboardHitBoxRef.current;
      const overWb = lx >= wb.x && lx <= wb.x + wb.w && ly >= wb.y && ly <= wb.y + wb.h;
      setHoveredWhiteboard(overWb);
    } else {
      setHoveredWhiteboard(false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (wasMoved) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    // Check employee click
    for (let i = agentHitBoxesRef.current.length - 1; i >= 0; i--) {
      const box = agentHitBoxesRef.current[i];
      if (Math.hypot(lx - box.x, ly - box.y) <= box.r) {
        playSelectBlip();
        onSelectEmployee(box.emp);
        return;
      }
    }

    // Check whiteboard click
    if (whiteboardHitBoxRef.current) {
      const wb = whiteboardHitBoxRef.current;
      if (lx >= wb.x && lx <= wb.x + wb.w && ly >= wb.y && ly <= wb.y + wb.h) {
        playSelectBlip();
        onOpenWhiteboard();
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    setCamera((prev) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = clampZoom(prev.zoom * factor);
      const scale = nextZoom / prev.zoom;
      return {
        zoom: nextZoom,
        offsetX: lx - (lx - prev.offsetX) * scale,
        offsetY: ly - (ly - prev.offsetY) * scale,
      };
    });
  };

  const cursorStyle = hoveredAgentId || hoveredWhiteboard ? 'pointer' : dragRef.current.active ? 'grabbing' : 'grab';

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{ display: 'block', cursor: cursorStyle, touchAction: 'none' }}
      />

      {/* Empty floor overlay */}
      {floor.employees.length === 0 && (
        <div
          className="pixel-panel"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '18px 24px',
            textAlign: 'center',
            pointerEvents: 'none',
            maxWidth: 380,
          }}
        >
          <div className="pixel-title" style={{ fontSize: 11, color: '#ffbe3b', marginBottom: 8 }}>
            {t.office.emptyFloor}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t.office.emptyFloorHint}</div>
        </div>
      )}

      {/* Bottom-right camera controls & hint */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          className="pixel-badge"
          style={{ color: 'var(--text-dim)', background: 'rgba(16, 19, 30, 0.88)' }}
        >
          {t.office.zoomHint} ({Math.round(camera.zoom * 100)}%)
        </div>
        <button className="pixel-btn" onClick={resetCamera} type="button">
          {t.hud.resetCamera}
        </button>
      </div>
    </div>
  );
};
