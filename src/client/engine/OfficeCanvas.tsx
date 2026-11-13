import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { OfficeEmployee, OfficeZone, PlazaFloor } from '../../shared/types';
import { playGamepadBlip, playSelectBlip, playTeleportZap } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';
import {
  clampZoom,
  getDefaultCamera,
  GRID_H,
  GRID_W,
  gridToScreen,
  TILE_H,
  TILE_W,
  type GridPoint,
  type IsoCamera,
} from './isoMath';
import { ELEVATOR_SLOT, getFloorLayout, type FloorLayout } from './officeLayouts';
import {
  drawAgentHealthBadge,
  drawDeskVerifiedTrophy,
  drawEnhancedBackWalls,
  drawEnhancedFloorTile,
  drawEnhancedFurniture,
  drawMentionEnvelope,
} from './officePropsSprites';
import {
  buildWalkableGridForFurniture,
  facingFromDelta,
  findPath,
  type Facing,
} from './pathfinding';
import {
  drawEmployeeSprite,
  drawMascotSprite,
  hashString,
} from './pixelSprites';

interface OfficeCanvasProps {
  floor: PlazaFloor;
  isNight: boolean;
  selectedEmployeeId: string | null;
  onSelectEmployee: (emp: OfficeEmployee) => void;
  onOpenWhiteboard: () => void;
  followCam?: boolean;
  onFollowCamChange?: (enabled: boolean) => void;
  onRegisterExportPng?: (exportFn: (() => void) | null) => void;
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

interface TeleportEffect {
  fromGx: number;
  fromGy: number;
  toGx: number;
  toGy: number;
  inviterGx: number;
  inviterGy: number;
  startMs: number;
  durationMs: number;
}

const WALK_SPEED_TILES_PER_SEC = 3.2;

export const OfficeCanvas: React.FC<OfficeCanvasProps> = ({
  floor,
  isNight,
  selectedEmployeeId,
  onSelectEmployee,
  onOpenWhiteboard,
  followCam = false,
  onFollowCamChange,
  onRegisterExportPng,
}) => {
  const { locale, t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(
    () => getFloorLayout(floor.id, floor.floorNumber, floor.layoutSeed ?? 0),
    [floor.id, floor.floorNumber, floor.layoutSeed],
  );
  const layoutRef = useRef<FloorLayout>(layout);
  layoutRef.current = layout;

  const walkableGrid = useMemo(
    () => buildWalkableGridForFurniture(layout.furniture),
    [layout],
  );
  const walkableGridRef = useRef<boolean[][]>(walkableGrid);
  walkableGridRef.current = walkableGrid;

  const [camera, setCamera] = useState<IsoCamera>(() => getDefaultCamera(1000, 680));
  const cameraRef = useRef<IsoCamera>(camera);
  cameraRef.current = camera;

  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [hoveredWhiteboard, setHoveredWhiteboard] = useState(false);

  const actorsRef = useRef<Map<string, ActorState>>(new Map());
  const hasLoadedFloorActorsRef = useRef<boolean>(false);
  const mascotRef = useRef<{
    gx: number;
    gy: number;
    path: GridPoint[];
    facing: Facing;
    pauseUntil: number;
  }>({ gx: 7, gy: 7, path: [], facing: 'SE', pauseUntil: 0 });
  const prevLayoutSigRef = useRef<string>(`${floor.id}:${floor.layoutSeed ?? 0}`);
  const prevGamingSigRef = useRef<string>('');
  const teleportEffectsRef = useRef<TeleportEffect[]>([]);
  const lastTeleportSfxMsRef = useRef<number>(0);
  const floorRef = useRef<PlazaFloor>(floor);
  floorRef.current = floor;

  const isNightRef = useRef(isNight);
  isNightRef.current = isNight;

  const selectedIdRef = useRef(selectedEmployeeId);
  selectedIdRef.current = selectedEmployeeId;

  const followCamRef = useRef(followCam);
  followCamRef.current = followCam;

  const mentionSignalsRef = useRef<
    Array<{
      fromGx: number;
      fromGy: number;
      toGx: number;
      toGy: number;
      startSec: number;
      duration: number;
      color: string;
    }>
  >([]);
  const lastBoardSeqByFloorRef = useRef<Map<string, number>>(new Map());
  const bubbleTimersRef = useRef<Map<string, { lastBubbleText: string; bubbleShownAtMs: number }>>(
    new Map(),
  );

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

  // Register PNG snapshot export callback
  useEffect(() => {
    if (!onRegisterExportPng) return;
    const exportPng = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `swarm-office-f${floorRef.current.floorNumber}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    onRegisterExportPng(exportPng);
    return () => onRegisterExportPng(null);
  }, [onRegisterExportPng]);

  // Spawn @mention envelope animations when new swarm board messages arrive
  useEffect(() => {
    const msgs = floor.boardMessages || [];
    const maxSeq = msgs.reduce((m, msg) => Math.max(m, msg.seq), 0);
    const seenMap = lastBoardSeqByFloorRef.current;
    if (!seenMap.has(floor.id)) {
      seenMap.set(floor.id, maxSeq);
      return;
    }
    const prevSeq = seenMap.get(floor.id) ?? 0;
    if (maxSeq <= prevSeq) return;
    seenMap.set(floor.id, maxSeq);

    const actors = actorsRef.current;
    const findEmp = (nameOrId: string) => {
      const needle = nameOrId.toLowerCase();
      return floor.employees.find(
        (e) =>
          e.name.toLowerCase() === needle ||
          e.id.toLowerCase() === needle ||
          e.name.toLowerCase().includes(needle),
      );
    };

    const nowSec = performance.now() / 1000;
    for (const msg of msgs) {
      if (msg.seq <= prevSeq) continue;
      const senderEmp = findEmp(msg.agent);
      const senderActor = senderEmp ? actors.get(senderEmp.id) : undefined;
      if (!senderActor) continue;

      const mentionTokens =
        msg.mentions && msg.mentions.length > 0
          ? msg.mentions
          : Array.from(msg.text.matchAll(/@([a-zA-Z0-9_-]+)/g), (m) => m[1]);

      for (const target of mentionTokens) {
        if (target.toLowerCase() === 'all') {
          for (const emp of floor.employees) {
            if (emp.id === senderEmp?.id) continue;
            const recActor = actors.get(emp.id);
            if (!recActor) continue;
            mentionSignalsRef.current.push({
              fromGx: senderActor.gx,
              fromGy: senderActor.gy,
              toGx: recActor.gx,
              toGy: recActor.gy,
              startSec: nowSec,
              duration: 1.4,
              color: '#3cd8ff',
            });
          }
          continue;
        }
        const recEmp = findEmp(target);
        if (!recEmp || recEmp.id === senderEmp?.id) continue;
        const recActor = actors.get(recEmp.id);
        if (!recActor) continue;
        mentionSignalsRef.current.push({
          fromGx: senderActor.gx,
          fromGy: senderActor.gy,
          toGx: recActor.gx,
          toGy: recActor.gy,
          startSec: nowSec,
          duration: 1.4,
          color: '#ffd147',
        });
      }
    }
  }, [floor.id, floor.boardMessages, floor.employees]);

  // Re-center on initial mount or floor change
  useEffect(() => {
    resetCamera();
  }, [floor.id, resetCamera]);

  // Sync employees into actor states & trigger A* pathfinding when zone/slot changes
  useEffect(() => {
    const actors = actorsRef.current;
    const layoutSig = `${floor.id}:${floor.layoutSeed ?? 0}`;
    const layoutChanged = prevLayoutSigRef.current !== layoutSig;
    prevLayoutSigRef.current = layoutSig;

    if (layoutChanged) {
      actors.clear();
      hasLoadedFloorActorsRef.current = false;
      teleportEffectsRef.current = [];
      // Snap mascot onto a guaranteed walkable tile
      let mx = 7;
      let my = 7;
      outer: for (let gy = 3; gy < GRID_H - 1; gy++) {
        for (let gx = 3; gx < GRID_W - 1; gx++) {
          if (walkableGrid[gy][gx]) {
            mx = gx;
            my = gy;
            break outer;
          }
        }
      }
      mascotRef.current = { gx: mx, gy: my, path: [], facing: 'SE', pauseUntil: 0 };
    }

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
      ELEVATOR: 0,
    };

    let loungeSeatIdx = 0;
    let meetingChairIdx = 0;
    let watercoolerIdx = 0;
    let pizzaIdx = 0;
    let coffeeIdx = 0;
    const gamingIds: string[] = [];

    floor.employees.forEach((emp) => {
      let slot = layout.zoneSlots.DESK_CODING[0];

      if (emp.activity === 'going_home' || emp.zone === 'ELEVATOR') {
        slot = ELEVATOR_SLOT;
      } else if (emp.activity === 'gaming') {
        slot = layout.gamingSlots[emp.playerSlot === 2 ? 1 : 0];
        gamingIds.push(emp.id);
      } else if (emp.activity === 'watercooler') {
        slot = layout.watercoolerSlots[watercoolerIdx % layout.watercoolerSlots.length];
        watercoolerIdx += 1;
      } else if (emp.activity === 'pizza') {
        slot = layout.pizzaSlots[pizzaIdx % layout.pizzaSlots.length];
        pizzaIdx += 1;
      } else if (emp.zone === 'WAR_ROOM') {
        if (emp.activity === 'presenting' || emp.isPresenter) {
          slot = layout.presenterSlot;
        } else {
          slot = layout.meetingChairSlots[meetingChairIdx % layout.meetingChairSlots.length];
          meetingChairIdx += 1;
        }
      } else if (emp.zone === 'COFFEE_LOUNGE') {
        if (emp.activity === 'coffee' && coffeeIdx < layout.coffeeSlots.length) {
          slot = layout.coffeeSlots[coffeeIdx];
          coffeeIdx += 1;
        } else {
          slot = layout.loungeSeatSlots[loungeSeatIdx % layout.loungeSeatSlots.length];
          loungeSeatIdx += 1;
        }
      } else {
        const idx = zoneCounters[emp.zone] ?? 0;
        zoneCounters[emp.zone] = idx + 1;
        const slots = layout.zoneSlots[emp.zone] || layout.zoneSlots.DESK_CODING;
        slot = slots[idx % slots.length];
      }

      const existing = actors.get(emp.id);
      if (!existing) {
        if (hasLoadedFloorActorsRef.current && emp.activity !== 'going_home') {
          // Newly arrived employee steps out of the elevator (0, 6) and walks to their slot
          const arrivalPath = findPath(
            walkableGrid,
            { gx: ELEVATOR_SLOT.gx, gy: ELEVATOR_SLOT.gy },
            { gx: slot.gx, gy: slot.gy },
          );
          actors.set(emp.id, {
            gx: ELEVATOR_SLOT.gx,
            gy: ELEVATOR_SLOT.gy,
            path: arrivalPath,
            targetZone: emp.zone,
            targetSlotGx: slot.gx,
            targetSlotGy: slot.gy,
            facing: 'SE',
            targetFacing: slot.facing,
            walkPhase: 0,
            isWalking: arrivalPath.length > 0,
          });
        } else {
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
        }
      } else if (
        existing.targetZone !== emp.zone ||
        existing.targetSlotGx !== slot.gx ||
        existing.targetSlotGy !== slot.gy
      ) {
        const startGx = Math.round(existing.gx);
        const startGy = Math.round(existing.gy);
        const manhattan = Math.abs(startGx - slot.gx) + Math.abs(startGy - slot.gy);
        const enteringWarRoom = existing.targetZone !== 'WAR_ROOM' && emp.zone === 'WAR_ROOM';
        const nowSec = Math.floor(Date.now() / 1000);
        const empHash = hashString(emp.id);
        const ruleTeleport =
          enteringWarRoom &&
          (Boolean(emp.teleported) || (manhattan >= 6 && (empHash + Math.floor(nowSec / 8)) % 5 < 2));

        const path = ruleTeleport
          ? []
          : findPath(walkableGrid, { gx: startGx, gy: startGy }, { gx: slot.gx, gy: slot.gy });

        const pathBlockedForWarRoom =
          enteringWarRoom &&
          !ruleTeleport &&
          path.length === 0 &&
          (startGx !== slot.gx || startGy !== slot.gy);

        if (ruleTeleport || pathBlockedForWarRoom) {
          const fromGx = existing.gx;
          const fromGy = existing.gy;
          existing.gx = slot.gx;
          existing.gy = slot.gy;
          existing.path = [];
          existing.isWalking = false;
          existing.facing = slot.facing;
          existing.targetFacing = slot.facing;
          existing.targetZone = emp.zone;
          existing.targetSlotGx = slot.gx;
          existing.targetSlotGy = slot.gy;

          const nowMs = performance.now();
          teleportEffectsRef.current.push({
            fromGx,
            fromGy,
            toGx: slot.gx,
            toGy: slot.gy,
            inviterGx: layout.presenterSlot.gx,
            inviterGy: layout.presenterSlot.gy,
            startMs: nowMs,
            durationMs: 850,
          });
          if (nowMs - lastTeleportSfxMsRef.current >= 500) {
            lastTeleportSfxMsRef.current = nowMs;
            playTeleportZap();
          }
        } else {
          existing.path = path;
          existing.targetZone = emp.zone;
          existing.targetSlotGx = slot.gx;
          existing.targetSlotGy = slot.gy;
          existing.targetFacing = slot.facing;
        }
      }
    });

    const gamingSig = gamingIds.sort().join(',');
    if (gamingSig && gamingSig !== prevGamingSigRef.current) {
      playGamepadBlip();
    }
    prevGamingSigRef.current = gamingSig;
    hasLoadedFloorActorsRef.current = true;
  }, [floor.employees, floor.id, floor.layoutSeed, layout, walkableGrid]);

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

      // Follow Cam: smoothly track selected employee when enabled
      if (followCamRef.current && selectedIdRef.current && !dragRef.current.active) {
        const targetActor = actors.get(selectedIdRef.current);
        if (targetActor) {
          const isoX = (targetActor.gx - targetActor.gy) * (TILE_W / 2);
          const isoY = (targetActor.gx + targetActor.gy) * (TILE_H / 2);
          const targetOffsetX = viewW / 2 - isoX * cam.zoom;
          const targetOffsetY = viewH / 2 - isoY * cam.zoom + 16 * cam.zoom;
          const lerpAlpha = 1 - Math.exp(-8 * dt);
          cam.offsetX += (targetOffsetX - cam.offsetX) * lerpAlpha;
          cam.offsetY += (targetOffsetY - cam.offsetY) * lerpAlpha;
        }
      }

      // Update roaming mascot
      const currentLayout = layoutRef.current;
      const currentGrid = walkableGridRef.current;
      const isZoomies = currentFloor.activeEvent?.kind === 'MASCOT_ZOOMIES';
      const mascot = mascotRef.current;
      if (mascot.path.length > 0) {
        const next = mascot.path[0];
        const dx = next.gx - mascot.gx;
        const dy = next.gy - mascot.gy;
        const dist = Math.hypot(dx, dy);
        const speed = (isZoomies ? WALK_SPEED_TILES_PER_SEC * 2.8 : WALK_SPEED_TILES_PER_SEC * 0.75) * dt;
        if (dist <= speed) {
          mascot.gx = next.gx;
          mascot.gy = next.gy;
          mascot.path.shift();
          if (mascot.path.length === 0) {
            mascot.pauseUntil = timeSec + (isZoomies ? 0.25 : 3 + Math.random() * 2);
          }
        } else {
          mascot.gx += (dx / dist) * speed;
          mascot.gy += (dy / dist) * speed;
          mascot.facing = facingFromDelta(dx, dy, mascot.facing);
        }
      } else if (timeSec >= mascot.pauseUntil) {
        const rx = 1 + Math.floor(Math.random() * (GRID_W - 2));
        const ry = 1 + Math.floor(Math.random() * (GRID_H - 2));
        if (currentGrid[ry]?.[rx]) {
          mascot.path = findPath(
            currentGrid,
            { gx: Math.round(mascot.gx), gy: Math.round(mascot.gy) },
            { gx: rx, gy: ry },
          );
        } else {
          mascot.pauseUntil = timeSec + 0.5;
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

      // 1. Draw enhanced back walls & panoramic cityscape windows
      drawEnhancedBackWalls(
        ctx,
        topVertexX,
        topVertexY,
        GRID_W,
        GRID_H,
        cam.zoom,
        night,
        timeSec,
        currentLayout.themePalette,
      );

      // 2. Draw enhanced floor tiles using floor's dynamic blueprint & themePalette
      for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
          const p = gridToScreen(gx, gy, cam);
          drawEnhancedFloorTile(
            ctx,
            gx,
            gy,
            p.x,
            p.y,
            cam.zoom,
            currentLayout.getTileZone(gx, gy),
            currentLayout.themePalette,
            night,
            timeSec,
          );
        }
      }

      // 2b. 60 FPS Ambient Lighting Pools (radial gradients, zero expensive blur filters)
      const drawRadialPool = (
        gx: number,
        gy: number,
        radiusTiles: number,
        innerColor: string,
        outerColor: string,
      ) => {
        const pt = gridToScreen(gx, gy, cam);
        const rad = radiusTiles * TILE_W * cam.zoom;
        if (rad <= 0) return;
        ctx.save();
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
        grad.addColorStop(0, innerColor);
        grad.addColorStop(1, outerColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, rad, rad * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      // Window daylight / moonlight beams from panoramic back walls
      const winBeamColor = night ? 'rgba(110, 165, 255, 0.11)' : 'rgba(255, 246, 200, 0.16)';
      drawRadialPool(3.5, 1.5, 2.6, winBeamColor, 'rgba(0,0,0,0)');
      drawRadialPool(10.5, 1.5, 2.8, winBeamColor, 'rgba(0,0,0,0)');
      drawRadialPool(1.5, 4.0, 2.2, winBeamColor, 'rgba(0,0,0,0)');

      // Zone ambient glows (Coffee Lounge amber, Server Rack / War Room cyan-green)
      const loungeAnchor = currentLayout.coffeeSlots[0] ?? currentLayout.loungeSeatSlots[0];
      if (loungeAnchor) {
        drawRadialPool(
          loungeAnchor.gx,
          loungeAnchor.gy,
          2.2,
          night ? 'rgba(255, 184, 77, 0.18)' : 'rgba(255, 205, 120, 0.08)',
          'rgba(0,0,0,0)',
        );
      }
      const serverAnchor = currentLayout.zoneSlots.SERVER_RACK[0];
      if (serverAnchor) {
        drawRadialPool(
          serverAnchor.gx,
          serverAnchor.gy,
          1.9,
          night ? 'rgba(60, 235, 180, 0.16)' : 'rgba(60, 235, 180, 0.06)',
          'rgba(0,0,0,0)',
        );
      }
      drawRadialPool(
        currentLayout.presenterSlot.gx,
        currentLayout.presenterSlot.gy,
        2.1,
        night ? 'rgba(80, 210, 255, 0.15)' : 'rgba(80, 210, 255, 0.06)',
        'rgba(0,0,0,0)',
      );

      // 3. Collect depth-sorted renderables (furniture, unlocked props, mascot, employees)
      interface RenderItem {
        depth: number;
        draw: () => void;
      }
      const renderables: RenderItem[] = [];

      // Occupied check for dev/qa desks, gaming TV console, presentation screen & pizza box
      const occupiedZones = new Set(
        currentFloor.employees.filter((e) => e.status === 'working').map((e) => e.zone),
      );
      const isGamingOccupied = currentFloor.employees.some((e) => e.activity === 'gaming');
      const isPresenterActive = currentFloor.employees.some(
        (e) => e.activity === 'presenting' || e.isPresenter,
      );
      const isPizzaActive =
        currentFloor.activeEvent?.kind === 'PIZZA_PARTY' ||
        currentFloor.employees.some((e) => e.activity === 'pizza');
      let isElevatorBusy = false;
      const empById = new Map(currentFloor.employees.map((e) => [e.id, e]));
      for (const [id, actor] of actors.entries()) {
        const d = Math.hypot(actor.gx - ELEVATOR_SLOT.gx, actor.gy - ELEVATOR_SLOT.gy);
        const emp = empById.get(id);
        const alreadyLeft = emp?.activity === 'going_home' && d <= 0.12 && !actor.isWalking;
        if (!alreadyLeft && d <= 2.1) {
          isElevatorBusy = true;
          break;
        }
      }

      let wbMinX = Infinity;
      let wbMinY = Infinity;
      let wbMaxX = -Infinity;
      let wbMaxY = -Infinity;

      // Map verified off-desk employees (e.g. relaxing in Coffee Lounge) to an unclaimed home desk slot
      const claimedSlotKeys = new Set<string>();
      for (const emp of currentFloor.employees) {
        const actor = actors.get(emp.id);
        if (
          actor &&
          (emp.zone === 'DESK_ARCHITECT' || emp.zone === 'DESK_CODING' || emp.zone === 'DESK_QA')
        ) {
          claimedSlotKeys.add(`${actor.targetSlotGx},${actor.targetSlotGy}`);
        }
      }
      const fallbackDeskSlots: Array<{ gx: number; gy: number; emp: OfficeEmployee }> = [];
      for (const emp of currentFloor.employees) {
        if (!emp.health?.isVerifiedOutput || emp.activity === 'going_home') continue;
        if (emp.zone === 'DESK_ARCHITECT' || emp.zone === 'DESK_CODING' || emp.zone === 'DESK_QA') {
          continue;
        }
        const homeZone: OfficeZone = emp.isCoordinator
          ? 'DESK_ARCHITECT'
          : emp.swarmRole === 'verifier'
            ? 'DESK_QA'
            : 'DESK_CODING';
        const candidates = currentLayout.zoneSlots[homeZone] || currentLayout.zoneSlots.DESK_CODING;
        const freeSlot = candidates.find((s) => !claimedSlotKeys.has(`${s.gx},${s.gy}`));
        if (freeSlot) {
          claimedSlotKeys.add(`${freeSlot.gx},${freeSlot.gy}`);
          fallbackDeskSlots.push({ gx: freeSlot.gx, gy: freeSlot.gy, emp });
        }
      }

      for (const item of currentLayout.furniture) {
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
              (item.kind === 'qa_desk' && occupiedZones.has('DESK_QA')) ||
              (item.kind === 'tv_console' && isGamingOccupied) ||
              (item.kind === 'lounge_table' && isPizzaActive) ||
              (item.kind === 'elevator_doors' && isElevatorBusy) ||
              (isWb && isPresenterActive);
            let deskLevel = 1;
            let occupierModelFamily = 'pro';
            let deskHasWorking = false;
            let deskHasVerified = false;
            if (
              item.kind === 'dev_desk' ||
              item.kind === 'qa_desk' ||
              item.kind === 'exec_desk' ||
              item.kind === 'desk'
            ) {
              let bestDist = 1.65;
              let matchedActive = false;
              for (const emp of currentFloor.employees) {
                const actor = actors.get(emp.id);
                if (!actor) continue;
                const d = Math.hypot(item.gx - actor.targetSlotGx, item.gy - actor.targetSlotGy);
                if (d < bestDist) {
                  bestDist = d;
                  matchedActive = true;
                  deskLevel = emp.level;
                  occupierModelFamily = emp.modelFamily;
                  deskHasWorking = emp.status === 'working';
                  deskHasVerified = Boolean(emp.health?.isVerifiedOutput);
                }
              }
              if (!matchedActive && fallbackDeskSlots.length > 0) {
                let fbDist = 1.65;
                for (const fb of fallbackDeskSlots) {
                  const d = Math.hypot(item.gx - fb.gx, item.gy - fb.gy);
                  if (d < fbDist) {
                    fbDist = d;
                    deskLevel = fb.emp.level;
                    occupierModelFamily = fb.emp.modelFamily;
                    deskHasVerified = true;
                  }
                }
              }
            }

            // Soft elliptical furniture contact shadow
            if (item.kind !== 'glass_partition_x' && item.kind !== 'glass_partition_y') {
              ctx.save();
              ctx.globalAlpha = night ? 0.3 : 0.2;
              ctx.fillStyle = '#070a14';
              ctx.beginPath();
              ctx.ellipse(p.x, p.y + 4 * cam.zoom, 16 * cam.zoom, 7 * cam.zoom, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // Subtle monitor glow pool on active working desks
            if (deskHasWorking) {
              drawRadialPool(
                item.gx,
                item.gy,
                1.15,
                night ? 'rgba(92, 240, 255, 0.16)' : 'rgba(92, 240, 255, 0.06)',
                'rgba(0,0,0,0)',
              );
            }

            drawEnhancedFurniture(
              ctx,
              item.kind,
              p.x,
              p.y,
              cam.zoom,
              timeSec,
              night,
              occupied,
              occupierModelFamily,
              isWb && hoveredBoardRef.current,
              tRef.current.office.whiteboardLabel,
              deskLevel,
            );
            if (deskHasVerified) {
              drawDeskVerifiedTrophy(ctx, p.x, p.y, cam.zoom, timeSec);
            }
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

      // Tier-unlocked props placed on layout-specific decorative tiles
      const props = currentFloor.unlockedProps || [];
      for (const pr of currentLayout.propPositions) {
        if (props.includes(pr.key)) {
          const p = gridToScreen(pr.gx, pr.gy, cam);
          renderables.push({
            depth: pr.gx + pr.gy,
            draw: () => {
              ctx.save();
              ctx.globalAlpha = night ? 0.28 : 0.18;
              ctx.fillStyle = '#070a14';
              ctx.beginPath();
              ctx.ellipse(p.x, p.y + 4 * cam.zoom, 14 * cam.zoom, 6 * cam.zoom, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
              drawEnhancedFurniture(ctx, pr.kind, p.x, p.y, cam.zoom, timeSec, night, true, 'pro', false, '', 1);
            },
          });
        }
      }

      // Roaming Floor Mascot
      const mp = gridToScreen(mascot.gx, mascot.gy, cam);
      renderables.push({
        depth: mascot.gx + mascot.gy + 0.08,
        draw: () => {
          drawMascotSprite(
            ctx,
            currentLayout.mascotKind,
            mp.x,
            mp.y,
            cam.zoom,
            mascot.facing,
            timeSec,
            isZoomies,
          );
        },
      });

      // Employees
      const nextHitBoxes: Array<{ emp: OfficeEmployee; x: number; y: number; r: number }> = [];
      const bubbleTimers = bubbleTimersRef.current;
      for (const emp of currentFloor.employees) {
        const actor = actors.get(emp.id);
        if (!actor) continue;
        const p = gridToScreen(actor.gx, actor.gy, cam);
        // Fade out employees stepping into the elevator to go home
        const distElev = Math.hypot(actor.gx - ELEVATOR_SLOT.gx, actor.gy - ELEVATOR_SLOT.gy);
        const alpha =
          emp.activity === 'going_home' ? Math.max(0, Math.min(1, distElev / 1.4)) : 1;
        if (alpha <= 0.02) continue;

        let isBubbleFresh = false;
        if (emp.speechBubble) {
          const prev = bubbleTimers.get(emp.id);
          if (!prev || prev.lastBubbleText !== emp.speechBubble) {
            bubbleTimers.set(emp.id, { lastBubbleText: emp.speechBubble, bubbleShownAtMs: now });
            isBubbleFresh = true;
          } else {
            isBubbleFresh = now - prev.bubbleShownAtMs <= 4500;
          }
        } else {
          bubbleTimers.delete(emp.id);
        }

        const isHovered = hoveredAgentRef.current === emp.id;
        const isSelected = selectedIdRef.current === emp.id;
        const showSpeechBubble = Boolean(emp.speechBubble) && (isHovered || isSelected || isBubbleFresh);

        nextHitBoxes.push({
          emp,
          x: p.x,
          y: p.y - 20 * cam.zoom,
          r: 22 * cam.zoom,
        });
        renderables.push({
          depth: actor.gx + actor.gy + 0.14,
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
              isHovered,
              isSelected,
              alpha,
              showSpeechBubble,
              currentFloor.activeEvent?.kind ?? null,
            );
            if (emp.health) {
              const z = cam.zoom;
              const bob = actor.isWalking
                ? Math.abs(Math.sin(actor.walkPhase * Math.PI * 2)) * 3 * z
                : 0;
              const isPresenting =
                !actor.isWalking && (emp.activity === 'presenting' || Boolean(emp.isPresenter));
              const seated =
                !actor.isWalking &&
                !isPresenting &&
                (emp.activity === 'coding' ||
                  emp.activity === 'reading' ||
                  emp.activity === 'searching' ||
                  emp.activity === 'thinking' ||
                  emp.activity === 'meeting' ||
                  emp.activity === 'lounging' ||
                  emp.activity === 'sleeping' ||
                  emp.activity === 'gaming');
              const baseY = p.y - bob + (seated ? 4 * z : 0);
              const hasErrorLoop =
                emp.health.consecutiveErrors >= 2 ||
                emp.toolActivity === 'error' ||
                emp.status === 'error';
              const hasActiveTool =
                (Boolean(emp.toolActivity) && emp.toolActivity !== 'idle') ||
                emp.status === 'error';
              const showNameTag = isHovered || isSelected;
              const badgeX = showNameTag
                ? p.x + (hasActiveTool && !showSpeechBubble ? 18 * z : 0)
                : p.x + (hasErrorLoop ? 15.5 * z : 12 * z);
              const badgeY = showNameTag ? baseY - 59 * z : baseY - 47 * z;

              ctx.save();
              if (alpha < 1) {
                ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
              }
              drawAgentHealthBadge(
                ctx,
                badgeX,
                badgeY,
                z,
                timeSec,
                emp.health.hpScore,
                emp.health.isVerifiedOutput,
                hasErrorLoop,
              );
              ctx.restore();
            }
          },
        });
      }
      agentHitBoxesRef.current = nextHitBoxes;

      // Depth-sort & draw
      renderables.sort((a, b) => a.depth - b.depth);
      for (const r of renderables) {
        r.draw();
      }

      // Live @mention envelope signals arcing between sender and recipient
      if (mentionSignalsRef.current.length > 0) {
        const activeSignals = mentionSignalsRef.current.filter(
          (sig) => timeSec - sig.startSec <= sig.duration,
        );
        mentionSignalsRef.current = activeSignals;
        for (const sig of activeSignals) {
          const t = Math.max(0, Math.min(1, (timeSec - sig.startSec) / sig.duration));
          const fromPt = gridToScreen(sig.fromGx, sig.fromGy, cam);
          const toPt = gridToScreen(sig.toGx, sig.toGy, cam);
          const moveT = Math.min(1, t / 0.85);
          const x = fromPt.x + (toPt.x - fromPt.x) * moveT;
          const arcLift = Math.sin(moveT * Math.PI) * 38 * cam.zoom;
          const y = fromPt.y + (toPt.y - fromPt.y) * moveT - 22 * cam.zoom - arcLift;
          drawMentionEnvelope(ctx, x, y, cam.zoom, t, sig.color);
        }
      }

      // 2.5D Pixel Teleportation Beams & Isometric Rings (War Room arrivals)
      if (teleportEffectsRef.current.length > 0) {
        const nowMs = performance.now();
        teleportEffectsRef.current = teleportEffectsRef.current.filter(
          (fx) => nowMs - fx.startMs <= fx.durationMs,
        );
        for (const fx of teleportEffectsRef.current) {
          const p = Math.max(0, Math.min(1, (nowMs - fx.startMs) / fx.durationMs));
          const fade = 1 - p;
          const nodes: Array<{ gx: number; gy: number; color: string; beam: boolean }> = [
            { gx: fx.fromGx, gy: fx.fromGy, color: '#3cd8ff', beam: true },
            { gx: fx.inviterGx, gy: fx.inviterGy, color: '#ffd147', beam: false },
            { gx: fx.toGx, gy: fx.toGy, color: '#b07cff', beam: true },
          ];
          for (const node of nodes) {
            const pt = gridToScreen(node.gx, node.gy, cam);
            const ringScale = (0.35 + p * 0.9) * cam.zoom;
            const hw = (TILE_W * 0.42) * ringScale;
            const hh = (TILE_H * 0.42) * ringScale;
            ctx.save();
            ctx.globalAlpha = Math.max(0.1, fade * 0.85);
            ctx.strokeStyle = node.color;
            ctx.lineWidth = Math.max(1.5, 2 * cam.zoom);
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y - hh);
            ctx.lineTo(pt.x + hw, pt.y);
            ctx.lineTo(pt.x, pt.y + hh);
            ctx.lineTo(pt.x - hw, pt.y);
            ctx.closePath();
            ctx.stroke();

            if (node.beam) {
              const colW = Math.max(4, Math.round(12 * cam.zoom * (1 - p * 0.55)));
              const colH = Math.max(20, Math.round(68 * cam.zoom));
              ctx.globalAlpha = Math.max(0.08, fade * 0.42);
              ctx.fillStyle = node.color;
              ctx.fillRect(Math.round(pt.x - colW / 2), Math.round(pt.y - colH), colW, colH);
              ctx.globalAlpha = Math.max(0.15, fade * 0.85);
              for (let s = 0; s < 5; s++) {
                const ang = p * Math.PI * 3 + s * 1.25;
                const sx = pt.x + Math.cos(ang) * 10 * cam.zoom;
                const sy = pt.y - (s * 12 + p * 26) * cam.zoom;
                ctx.fillStyle = s % 2 === 0 ? '#ffffff' : node.color;
                ctx.fillRect(Math.round(sx), Math.round(sy), Math.max(2, Math.round(3 * cam.zoom)), Math.max(2, Math.round(3 * cam.zoom)));
              }
            }
            ctx.restore();
          }
        }
      }

      // Event ambient particles (Confetti, Star Wars hyperspace, Superhero aura, Halloween bats/embers)
      const eventKind = currentFloor.activeEvent?.kind;
      if (eventKind === 'SPRINT_CELEBRATION') {
        const confettiColors = ['#ffd147', '#3cd8ff', '#3be87a', '#ff5666', '#b07cff'];
        for (let i = 0; i < 42; i++) {
          const cx = ((i * 97 + Math.sin(timeSec * 2 + i) * 30) % Math.max(1, viewW));
          const cy = ((i * 53 + timeSec * (75 + (i % 4) * 20)) % Math.max(1, viewH));
          ctx.fillStyle = confettiColors[i % confettiColors.length];
          ctx.fillRect(Math.round(cx), Math.round(cy), 5, 5);
        }
      } else if (eventKind === 'STAR_WARS_PARTY') {
        for (let i = 0; i < 32; i++) {
          const sx = ((i * 113 + timeSec * (110 + (i % 3) * 40)) % Math.max(1, viewW));
          const sy = ((i * 67 + Math.sin(timeSec + i) * 14) % Math.max(1, viewH));
          ctx.fillStyle = i % 3 === 0 ? '#3cd8ff' : i % 3 === 1 ? '#ffd147' : '#ffffff';
          ctx.fillRect(Math.round(sx), Math.round(sy), i % 2 === 0 ? 7 : 3, 2);
        }
      } else if (eventKind === 'SUPERHERO_PARTY') {
        for (let i = 0; i < 28; i++) {
          const ax = ((i * 101 + Math.sin(timeSec * 1.8 + i) * 22) % Math.max(1, viewW));
          const ay = Math.max(1, viewH) - ((i * 49 + timeSec * (65 + (i % 3) * 18)) % Math.max(1, viewH));
          ctx.fillStyle = i % 2 === 0 ? '#ffd147' : '#7ef3ff';
          ctx.fillRect(Math.round(ax), Math.round(ay), 4, 4);
        }
      } else if (eventKind === 'HALLOWEEN_PARTY') {
        for (let i = 0; i < 18; i++) {
          const bx = ((i * 127 + timeSec * (45 + (i % 4) * 15)) % Math.max(1, viewW));
          const by = ((i * 71 + Math.sin(timeSec * 4 + i) * 18) % Math.max(1, viewH));
          if (i % 2 === 0) {
            // Pixel bat silhouette
            const wing = Math.sin(timeSec * 12 + i) > 0 ? -2 : 1;
            ctx.fillStyle = '#1b1628';
            ctx.fillRect(Math.round(bx - 4), Math.round(by + wing), 3, 2);
            ctx.fillRect(Math.round(bx - 1), Math.round(by), 2, 2);
            ctx.fillRect(Math.round(bx + 1), Math.round(by + wing), 3, 2);
          } else {
            ctx.fillStyle = i % 3 === 0 ? '#b07cff' : '#ff7b1c';
            ctx.fillRect(Math.round(bx), Math.round(by), 4, 4);
          }
        }
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
      camStartX: cameraRef.current.offsetX,
      camStartY: cameraRef.current.offsetY,
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
        if (!dragRef.current.moved && followCamRef.current) {
          onFollowCamChange?.(false);
        }
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
        onDoubleClick={() => {
          onFollowCamChange?.(false);
          resetCamera();
        }}
        onWheel={handleWheel}
        style={{ display: 'block', cursor: cursorStyle, touchAction: 'none' }}
      />

      {/* Active Random Event Pixel Banner */}
      {floor.activeEvent && (
        <div
          className="pixel-panel"
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            background: '#2a1f47',
            borderColor: '#ffd147',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span className="pixel-title" style={{ fontSize: 10, color: '#ffd147' }}>
            {t.events[floor.activeEvent.kind]}
          </span>
        </div>
      )}

      {/* Bottom-left Blueprint & Theme Badge */}
      <div
        className="pixel-badge"
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          color: '#9ee8ff',
          background: 'rgba(16, 19, 30, 0.88)',
          pointerEvents: 'none',
        }}
      >
        🏛 {t.blueprints[layout.blueprintIndex]} •{' '}
        {locale === 'tr' ? layout.themePalette.nameTr : layout.themePalette.nameEn}
      </div>

      {/* Empty floor / After-hours overlay */}
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
            maxWidth: 400,
          }}
        >
          <div className="pixel-title" style={{ fontSize: 11, color: '#ffbe3b', marginBottom: 8 }}>
            {(floor.offDutyCount ?? 0) > 0 ? t.office.afterHours : t.office.emptyFloor}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {(floor.offDutyCount ?? 0) > 0 ? t.office.afterHoursHint : t.office.emptyFloorHint}
          </div>
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
