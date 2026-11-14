import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  type AntiAliasingMode,
  type GraphicsSettings,
  type OfficeEmployee,
  type OfficeZone,
  type PlazaFloor,
  type ResolutionScaleMode,
} from '../../shared/types';
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
import {
  ELEVATOR_SLOT,
  getFloorLayout,
  isPartitionKind,
  resolvePartitionSeam,
  type FloorLayout,
} from './officeLayouts';
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
  isOverlayOpen?: boolean;
  graphicsSettings?: GraphicsSettings;
  onFpsSample?: (fps: number) => void;
  onOpenLegend?: () => void;
}

function resolveRenderDpr(mode: ResolutionScaleMode): number {
  if (mode === 'low') return 0.75;
  if (mode === 'medium') return 1;
  if (mode === 'high') return 2;
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

function applyAntiAliasing(targetCtx: CanvasRenderingContext2D, mode: AntiAliasingMode): void {
  if (mode === 'smooth') {
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = 'high';
  } else {
    targetCtx.imageSmoothingEnabled = false;
  }
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
const WORK_DESK_KINDS = new Set(['dev_desk', 'qa_desk', 'exec_desk', 'desk']);
const WORK_CHAIR_KINDS = new Set(['desk_chair', 'exec_chair', 'swivel_chair', 'chair']);
const DESK_SEAT_DISTANCE = 0.72;

function isBeanbagKind(kind: string): boolean {
  return (
    kind === 'gaming_seat' ||
    kind === 'beanbag' ||
    kind.startsWith('beanbag_') ||
    kind.startsWith('gaming_seat_')
  );
}

interface DeskSeatAlignment {
  deskGx: number;
  deskGy: number;
  deskDepth: number;
  seatGx: number;
  seatGy: number;
  deskFacing: Facing;
  chairDepth: number;
  empDepth: number;
}

interface LayoutSeatAlignments {
  deskSeatMap: Map<string, DeskSeatAlignment>;
  chairFacingMap: Map<string, Facing>;
  explicitWorkChairKeys: Set<string>;
  beanbagKeys: Set<string>;
}

function buildLayoutSeatAlignments(layout: FloorLayout): LayoutSeatAlignments {
  const deskSeatMap = new Map<string, DeskSeatAlignment>();
  const chairFacingMap = new Map<string, Facing>();
  const explicitWorkChairKeys = new Set<string>();
  const beanbagKeys = new Set<string>();

  const workDesks = layout.furniture.filter((f) => WORK_DESK_KINDS.has(f.kind));
  const warTables = layout.furniture.filter((f) => f.kind === 'war_table');
  const tvConsoles = layout.furniture.filter(
    (f) => f.kind === 'tv_console' || f.kind === 'gaming_tv',
  );

  const candidateSeats: Array<{ gx: number; gy: number }> = [];
  const seenCandidates = new Set<string>();
  const pushCandidate = (gx: number, gy: number) => {
    const k = `${gx},${gy}`;
    if (seenCandidates.has(k)) return;
    seenCandidates.add(k);
    candidateSeats.push({ gx, gy });
  };

  // Prioritize explicit work chairs first (orthogonal before diagonal), then desk zone slots
  const workChairItems = layout.furniture.filter((f) => WORK_CHAIR_KINDS.has(f.kind));
  for (const item of workChairItems) {
    explicitWorkChairKeys.add(`${item.gx},${item.gy}`);
  }
  const sortedChairItems = [...workChairItems].sort((a, b) => {
    const minA = Math.min(...workDesks.map((d) => Math.hypot(d.gx - a.gx, d.gy - a.gy)), 99);
    const minB = Math.min(...workDesks.map((d) => Math.hypot(d.gx - b.gx, d.gy - b.gy)), 99);
    return minA - minB;
  });
  for (const ch of sortedChairItems) {
    pushCandidate(ch.gx, ch.gy);
  }
  for (const slot of [
    ...layout.zoneSlots.DESK_ARCHITECT,
    ...layout.zoneSlots.DESK_CODING,
    ...layout.zoneSlots.DESK_QA,
  ]) {
    pushCandidate(slot.gx, slot.gy);
  }

  const claimedDesks = new Set<string>();
  for (const seat of candidateSeats) {
    let bestDesk: { gx: number; gy: number } | null = null;
    let bestScore = Infinity;

    for (const desk of workDesks) {
      const dx = desk.gx - seat.gx;
      const dy = desk.gy - seat.gy;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.05 || dist > 1.48) continue;

      const deskKey = `${desk.gx},${desk.gy}`;
      const claimedPenalty = claimedDesks.has(deskKey) ? 0.55 : 0;
      // Prefer desks directly north-east (dy === -1, dx === 0) on exact distance ties
      const dirBias = dx === 0 && dy === -1 ? -0.02 : 0;
      const score = dist + claimedPenalty + dirBias;
      if (score < bestScore) {
        bestScore = score;
        bestDesk = desk;
      }
    }

    if (!bestDesk) continue;
    claimedDesks.add(`${bestDesk.gx},${bestDesk.gy}`);

    const dx = bestDesk.gx - seat.gx;
    const dy = bestDesk.gy - seat.gy;
    const dist = Math.hypot(dx, dy);
    const seatGx = bestDesk.gx - (dx / dist) * DESK_SEAT_DISTANCE;
    const seatGy = bestDesk.gy - (dy / dist) * DESK_SEAT_DISTANCE;
    const deskDepth = bestDesk.gx + bestDesk.gy;
    const seatDepth = seatGx + seatGy;
    const deskFacing = facingFromDelta(dx, dy, 'SE');
    const isBehindDesk = seat.gx + seat.gy < deskDepth;

    let chairDepth: number;
    let empDepth: number;
    if (isBehindDesk) {
      // NW / NE behind desk: chair -> employee (seatX + seatY) -> desk occludes knees/lower legs
      empDepth = Math.min(deskDepth - 0.06, seatDepth);
      chairDepth = empDepth - 0.04;
    } else if (seatDepth <= deskDepth + 0.06) {
      // Diagonal-even depth tie-breaker: desk -> chair -> employee
      chairDepth = deskDepth + 0.03;
      empDepth = deskDepth + 0.07;
    } else {
      // SW / SE in front of desk: desk -> chair -> employee centered on cushion
      empDepth = seatDepth;
      chairDepth = empDepth - 0.04;
    }

    const seatKey = `${seat.gx},${seat.gy}`;
    deskSeatMap.set(seatKey, {
      deskGx: bestDesk.gx,
      deskGy: bestDesk.gy,
      deskDepth,
      seatGx,
      seatGy,
      deskFacing,
      chairDepth,
      empDepth,
    });
    chairFacingMap.set(seatKey, deskFacing);
  }

  for (const item of layout.furniture) {
    if (item.kind === 'meeting_chair' && warTables.length > 0) {
      let best: { gx: number; gy: number } | null = null;
      let bestD = Infinity;
      for (const wt of warTables) {
        const d = Math.hypot(wt.gx - item.gx, wt.gy - item.gy);
        if (d < bestD) {
          bestD = d;
          best = wt;
        }
      }
      if (best) {
        chairFacingMap.set(
          `${item.gx},${item.gy}`,
          facingFromDelta(best.gx - item.gx, best.gy - item.gy, 'SE'),
        );
      }
    } else if (isBeanbagKind(item.kind)) {
      const bagKey = `${item.gx},${item.gy}`;
      beanbagKeys.add(bagKey);
      if (tvConsoles.length > 0) {
        let best: { gx: number; gy: number } | null = null;
        let bestD = Infinity;
        for (const tv of tvConsoles) {
          const d = Math.hypot(tv.gx - item.gx, tv.gy - item.gy);
          if (d < bestD) {
            bestD = d;
            best = tv;
          }
        }
        if (best) {
          chairFacingMap.set(
            bagKey,
            facingFromDelta(best.gx - item.gx, best.gy - item.gy, 'NE'),
          );
        }
      }
    }
  }

  return { deskSeatMap, chairFacingMap, explicitWorkChairKeys, beanbagKeys };
}

export const OfficeCanvas: React.FC<OfficeCanvasProps> = ({
  floor,
  isNight,
  selectedEmployeeId,
  onSelectEmployee,
  onOpenWhiteboard,
  followCam = false,
  onFollowCamChange,
  onRegisterExportPng,
  isOverlayOpen = false,
  graphicsSettings = DEFAULT_GRAPHICS_SETTINGS,
  onFpsSample,
  onOpenLegend,
}) => {
  const { locale, t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const staticCacheRef = useRef<{ canvas: HTMLCanvasElement | null; key: string }>({
    canvas: null,
    key: '',
  });

  const layout = useMemo(
    () => getFloorLayout(floor.id, floor.floorNumber, floor.layoutSeed ?? 0),
    [floor.id, floor.floorNumber, floor.layoutSeed],
  );
  const layoutRef = useRef<FloorLayout>(layout);
  layoutRef.current = layout;

  const seatAlignments = useMemo(() => buildLayoutSeatAlignments(layout), [layout]);
  const seatAlignmentsRef = useRef<LayoutSeatAlignments>(seatAlignments);
  seatAlignmentsRef.current = seatAlignments;

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

  const isOverlayOpenRef = useRef(isOverlayOpen);
  isOverlayOpenRef.current = isOverlayOpen;

  const graphicsSettingsRef = useRef<GraphicsSettings>(graphicsSettings);
  graphicsSettingsRef.current = graphicsSettings;

  const onFpsSampleRef = useRef(onFpsSample);
  onFpsSampleRef.current = onFpsSample;

  const localeRef = useRef(locale);
  localeRef.current = locale;

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
    let nextGamingFallback = 0;
    const usedGamingIndices = new Set<number>();
    const gamingIds: string[] = [];

    floor.employees.forEach((emp) => {
      let slot = layout.zoneSlots.DESK_CODING[0];

      let visitSlot: typeof slot | null = null;
      if (emp.visitTargetId && emp.socialReaction === 'coffee_gift') {
        const targetActor = actors.get(emp.visitTargetId);
        if (targetActor) {
          const tgx = Math.round(targetActor.targetSlotGx);
          const tgy = Math.round(targetActor.targetSlotGy);
          const candidates: Array<[number, number]> = [
            [tgx + 1, tgy],
            [tgx, tgy + 1],
            [tgx - 1, tgy],
            [tgx, tgy - 1],
            [tgx + 1, tgy + 1],
            [tgx - 1, tgy - 1],
          ];
          for (const [cgx, cgy] of candidates) {
            if (
              cgy >= 0 &&
              cgy < GRID_H &&
              cgx >= 0 &&
              cgx < GRID_W &&
              walkableGrid[cgy][cgx]
            ) {
              visitSlot = {
                ...slot,
                gx: cgx,
                gy: cgy,
                facing: facingFromDelta(tgx - cgx, tgy - cgy, 'SE'),
              };
              break;
            }
          }
        }
      }

      if (visitSlot) {
        slot = visitSlot;
      } else if (emp.activity === 'going_home' || emp.zone === 'ELEVATOR') {
        slot = ELEVATOR_SLOT;
      } else if (emp.activity === 'gaming') {
        const nSlots = Math.max(1, layout.gamingSlots.length);
        const prefIdx = emp.playerSlot && emp.playerSlot >= 1 ? (emp.playerSlot - 1) % nSlots : 0;
        let chosenIdx = prefIdx;
        if (usedGamingIndices.has(chosenIdx)) {
          while (nextGamingFallback < nSlots && usedGamingIndices.has(nextGamingFallback)) {
            nextGamingFallback += 1;
          }
          chosenIdx = nextGamingFallback < nSlots ? nextGamingFallback : prefIdx;
        }
        usedGamingIndices.add(chosenIdx);
        slot = layout.gamingSlots[chosenIdx];
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

  // Resize observer (and instant resolution scale updates)
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const dpr = resolveRenderDpr(graphicsSettingsRef.current.resolution);
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
  }, [graphicsSettings.resolution]);

  // Configurable FPS animation loop + optional offscreen static architecture cache
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let lastRenderTime = 0;
    let fpsFrames = 0;
    let fpsWindowStart = performance.now();

    const tick = (now: number) => {
      if (typeof document !== 'undefined' && document.hidden) {
        lastTime = now;
        fpsWindowStart = now;
        fpsFrames = 0;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const gfx = graphicsSettingsRef.current;
      const actors = actorsRef.current;
      const currentFloor = floorRef.current;
      const eventKind = currentFloor.activeEvent?.kind;

      let minIntervalMs = 0;
      if (isOverlayOpenRef.current) {
        minIntervalMs = gfx.fpsLimit === 'eco' ? 250 : 125; // 4 FPS (eco) or 8 FPS (other modes)
      } else if (gfx.fpsLimit === 'eco') {
        minIntervalMs = 71; // 14 FPS calm office mode
        let anyAgentWalking = false;
        for (const actor of actors.values()) {
          if (
            actor.path.length > 0 ||
            actor.isWalking ||
            Math.hypot(actor.targetSlotGx - actor.gx, actor.targetSlotGy - actor.gy) > 0.03
          ) {
            anyAgentWalking = true;
            break;
          }
        }
        const hasActiveEffects =
          dragRef.current.active ||
          mentionSignalsRef.current.length > 0 ||
          teleportEffectsRef.current.length > 0 ||
          eventKind === 'SPRINT_CELEBRATION' ||
          eventKind === 'STAR_WARS_PARTY' ||
          eventKind === 'SUPERHERO_PARTY' ||
          eventKind === 'HALLOWEEN_PARTY' ||
          eventKind === 'MASCOT_ZOOMIES' ||
          Boolean(currentFloor.activeCelebration) ||
          currentFloor.employees.some((e) => Boolean(e.socialReaction));

        if (anyAgentWalking || hasActiveEffects) {
          minIntervalMs = 41; // 24 FPS active motion / particle mode
        }
      } else if (gfx.fpsLimit === '30') {
        minIntervalMs = 31.8; // ~30 FPS (VSync-tolerant on 60Hz/120Hz)
      } else if (gfx.fpsLimit === '60') {
        minIntervalMs = 15.2; // ~60 FPS (VSync-tolerant on 60Hz/120Hz)
      } else {
        minIntervalMs = 0; // 'unlimited' — full monitor refresh rate
      }

      if (minIntervalMs > 0 && lastRenderTime > 0 && now - lastRenderTime < minIntervalMs) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(0.28, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      lastRenderTime = now;
      const timeSec = now / 1000;

      fpsFrames += 1;
      if (now - fpsWindowStart >= 500) {
        const sampledFps = Math.round((fpsFrames * 1000) / Math.max(1, now - fpsWindowStart));
        onFpsSampleRef.current?.(sampledFps);
        fpsFrames = 0;
        fpsWindowStart = now;
      }

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

      const dpr = resolveRenderDpr(gfx.resolution);
      const antiAliasing = gfx.antiAliasing;
      const useStaticCache = gfx.staticCache !== false;
      const viewW = container.clientWidth;
      const viewH = container.clientHeight;
      const targetCanvasW = Math.max(1, Math.floor(viewW * dpr));
      const targetCanvasH = Math.max(1, Math.floor(viewH * dpr));
      if (canvas.width !== targetCanvasW) canvas.width = targetCanvasW;
      if (canvas.height !== targetCanvasH) canvas.height = targetCanvasH;

      const cam = cameraRef.current;
      const night = isNightRef.current;

      // Update actor positions along A* paths
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
          const targetSlotKey = `${Math.round(targetActor.gx)},${Math.round(targetActor.gy)}`;
          const targetAlign = !targetActor.isWalking
            ? seatAlignmentsRef.current.deskSeatMap.get(targetSlotKey)
            : undefined;
          const trackGx = targetAlign ? targetAlign.seatGx : targetActor.gx;
          const trackGy = targetAlign ? targetAlign.seatGy : targetActor.gy;
          const isoX = (trackGx - trackGy) * (TILE_W / 2);
          const isoY = (trackGx + trackGy) * (TILE_H / 2);
          const targetOffsetX = viewW / 2 - isoX * cam.zoom;
          const targetOffsetY = viewH / 2 - isoY * cam.zoom + 16 * cam.zoom;
          if (Math.hypot(targetOffsetX - cam.offsetX, targetOffsetY - cam.offsetY) < 0.35) {
            cam.offsetX = targetOffsetX;
            cam.offsetY = targetOffsetY;
          } else {
            const lerpAlpha = 1 - Math.exp(-8 * dt);
            cam.offsetX += (targetOffsetX - cam.offsetX) * lerpAlpha;
            cam.offsetY += (targetOffsetY - cam.offsetY) * lerpAlpha;
          }
        }
      }

      // Update roaming mascot
      const currentLayout = layoutRef.current;
      const currentGrid = walkableGridRef.current;
      const isZoomies = eventKind === 'MASCOT_ZOOMIES';
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

      const drawRadialPoolOn = (
        targetCtx: CanvasRenderingContext2D,
        gx: number,
        gy: number,
        radiusTiles: number,
        innerColor: string,
        outerColor: string,
      ) => {
        const pt = gridToScreen(gx, gy, cam);
        const rad = radiusTiles * TILE_W * cam.zoom;
        if (rad <= 0) return;
        targetCtx.save();
        const grad = targetCtx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
        grad.addColorStop(0, innerColor);
        grad.addColorStop(1, outerColor);
        targetCtx.fillStyle = grad;
        targetCtx.beginPath();
        targetCtx.ellipse(pt.x, pt.y, rad, rad * 0.55, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.restore();
      };

      const canvasW = canvas.width;
      const canvasH = canvas.height;
      const drawStaticArchitecture = (
        targetCtx: CanvasRenderingContext2D,
        archTimeSec: number,
      ) => {
        // Background sky / studio void
        targetCtx.fillStyle = night ? '#0b0e18' : '#182238';
        targetCtx.fillRect(0, 0, Math.ceil(canvasW / dpr) + 2, Math.ceil(canvasH / dpr) + 2);

        // Top-center vertex of tile (0,0)
        const tile00 = gridToScreen(0, 0, cam);
        const topVertexX = tile00.x;
        const topVertexY = tile00.y - 16 * cam.zoom;

        // Enhanced back walls, acoustic panels & panoramic cityscape windows
        drawEnhancedBackWalls(
          targetCtx,
          topVertexX,
          topVertexY,
          GRID_W,
          GRID_H,
          cam.zoom,
          night,
          archTimeSec,
          currentLayout.themePalette,
        );

        // Enhanced isometric floor tiles & zone carpets/wood/marble
        for (let gy = 0; gy < GRID_H; gy++) {
          for (let gx = 0; gx < GRID_W; gx++) {
            const p = gridToScreen(gx, gy, cam);
            const tileZone = currentLayout.getTileZone(gx, gy);
            drawEnhancedFloorTile(
              targetCtx,
              gx,
              gy,
              p.x,
              p.y,
              cam.zoom,
              tileZone,
              currentLayout.themePalette,
              night,
              archTimeSec,
            );
            // Distinct rich mahogany/espresso executive parquet glaze so outer wood dividers sit on an exact floor seam
            if (tileZone === 'DESK_ARCHITECT') {
              const hw = (TILE_W / 2) * cam.zoom;
              const hh = (TILE_H / 2) * cam.zoom;
              targetCtx.save();
              targetCtx.beginPath();
              targetCtx.moveTo(p.x, p.y - hh);
              targetCtx.lineTo(p.x + hw, p.y);
              targetCtx.lineTo(p.x, p.y + hh);
              targetCtx.lineTo(p.x - hw, p.y);
              targetCtx.closePath();
              targetCtx.fillStyle = night ? 'rgba(56, 20, 18, 0.46)' : 'rgba(88, 30, 20, 0.36)';
              targetCtx.fill();
              targetCtx.lineWidth = Math.max(0.6, 0.75 * cam.zoom);
              targetCtx.strokeStyle = night
                ? 'rgba(255, 209, 115, 0.16)'
                : 'rgba(130, 64, 30, 0.42)';
              targetCtx.stroke();
              targetCtx.restore();
            }
          }
        }

        // Static window daylight/moonlight beams & zone ambient glows
        const winBeamColor = night ? 'rgba(110, 165, 255, 0.11)' : 'rgba(255, 246, 200, 0.16)';
        drawRadialPoolOn(targetCtx, 3.5, 1.5, 2.6, winBeamColor, 'rgba(0,0,0,0)');
        drawRadialPoolOn(targetCtx, 10.5, 1.5, 2.8, winBeamColor, 'rgba(0,0,0,0)');
        drawRadialPoolOn(targetCtx, 1.5, 4.0, 2.2, winBeamColor, 'rgba(0,0,0,0)');

        const loungeAnchor = currentLayout.coffeeSlots[0] ?? currentLayout.loungeSeatSlots[0];
        if (loungeAnchor) {
          drawRadialPoolOn(
            targetCtx,
            loungeAnchor.gx,
            loungeAnchor.gy,
            2.2,
            night ? 'rgba(255, 184, 77, 0.18)' : 'rgba(255, 205, 120, 0.08)',
            'rgba(0,0,0,0)',
          );
        }

        // PlayStation Hobby Lounge Woven Gaming Rug & Dual Magenta + Cyan Neon Ambience
        const tvConsoleItem = currentLayout.furniture.find(
          (f) => f.kind === 'tv_console' || f.kind === 'gaming_tv',
        );
        if (tvConsoleItem) {
          const tx = tvConsoleItem.gx;
          const ty = tvConsoleItem.gy;
          const rugX0 = Math.max(-0.4, tx - 0.35);
          const rugY0 = Math.max(-0.4, ty - 0.35);
          const rugX1 = Math.min(GRID_W - 0.52, tx + 2.45);
          const rugY1 = Math.min(GRID_H - 0.52, ty + 2.45);
          const cTop = gridToScreen(rugX0, rugY0, cam);
          const cRight = gridToScreen(rugX1, rugY0, cam);
          const cBot = gridToScreen(rugX1, rugY1, cam);
          const cLeft = gridToScreen(rugX0, rugY1, cam);

          targetCtx.save();
          // Plush anthracite-indigo gaming zone area rug
          targetCtx.beginPath();
          targetCtx.moveTo(cTop.x, cTop.y);
          targetCtx.lineTo(cRight.x, cRight.y);
          targetCtx.lineTo(cBot.x, cBot.y);
          targetCtx.lineTo(cLeft.x, cLeft.y);
          targetCtx.closePath();
          targetCtx.fillStyle = night ? 'rgba(13, 16, 28, 0.84)' : 'rgba(20, 24, 38, 0.74)';
          targetCtx.fill();
          targetCtx.lineWidth = Math.max(1, 1.35 * cam.zoom);
          targetCtx.strokeStyle = night ? 'rgba(8, 10, 18, 0.9)' : 'rgba(12, 15, 26, 0.8)';
          targetCtx.stroke();

          // Dual neon LED woven border piping: Magenta (NW/SW) + Cyan (NE/SE)
          const inset = 0.09;
          const iTop = gridToScreen(rugX0 + inset, rugY0 + inset, cam);
          const iRight = gridToScreen(rugX1 - inset, rugY0 + inset, cam);
          const iBot = gridToScreen(rugX1 - inset, rugY1 - inset, cam);
          const iLeft = gridToScreen(rugX0 + inset, rugY1 - inset, cam);

          targetCtx.lineWidth = Math.max(1, 1.2 * cam.zoom);
          targetCtx.beginPath();
          targetCtx.moveTo(iTop.x, iTop.y);
          targetCtx.lineTo(iLeft.x, iLeft.y);
          targetCtx.lineTo(iBot.x, iBot.y);
          targetCtx.strokeStyle = night ? 'rgba(224, 64, 251, 0.54)' : 'rgba(224, 64, 251, 0.40)';
          targetCtx.stroke();

          targetCtx.beginPath();
          targetCtx.moveTo(iTop.x, iTop.y);
          targetCtx.lineTo(iRight.x, iRight.y);
          targetCtx.lineTo(iBot.x, iBot.y);
          targetCtx.strokeStyle = night ? 'rgba(0, 229, 255, 0.52)' : 'rgba(0, 229, 255, 0.38)';
          targetCtx.stroke();

          // Subtle PlayStation-inspired 4-symbol woven micro-motif near front corner of rug
          const motifPt = gridToScreen(
            Math.min(rugX1 - 0.35, tx + 1.9),
            Math.min(rugY1 - 0.35, ty + 1.9),
            cam,
          );
          const mz = cam.zoom;
          targetCtx.globalAlpha = night ? 0.34 : 0.24;
          targetCtx.fillStyle = '#3be87a';
          targetCtx.fillRect(motifPt.x - 9 * mz, motifPt.y - 2 * mz, 2.4 * mz, 2.2 * mz);
          targetCtx.fillStyle = '#ff4d6d';
          targetCtx.fillRect(motifPt.x - 3.5 * mz, motifPt.y - 3.5 * mz, 2.4 * mz, 2.2 * mz);
          targetCtx.fillStyle = '#00e5ff';
          targetCtx.fillRect(motifPt.x + 2 * mz, motifPt.y - 3.5 * mz, 2.4 * mz, 2.2 * mz);
          targetCtx.fillStyle = '#e040fb';
          targetCtx.fillRect(motifPt.x + 7.5 * mz, motifPt.y - 2 * mz, 2.4 * mz, 2.2 * mz);
          targetCtx.restore();

          // Magenta + Cyan Neon Floor Ambience Pools
          drawRadialPoolOn(
            targetCtx,
            tx - 0.25,
            ty + 0.65,
            2.35,
            night ? 'rgba(224, 64, 251, 0.17)' : 'rgba(224, 64, 251, 0.10)',
            'rgba(0,0,0,0)',
          );
          drawRadialPoolOn(
            targetCtx,
            tx + 1.35,
            ty + 0.95,
            2.35,
            night ? 'rgba(0, 229, 255, 0.14)' : 'rgba(0, 229, 255, 0.08)',
            'rgba(0,0,0,0)',
          );

          // Upper Wall / Ceiling Neon Cove Wash behind Gaming TV & Arcade Cabinet
          const wallLeftPt = gridToScreen(tx - 0.45, ty - 0.15, cam);
          const wallRightPt = gridToScreen(tx + 0.45, ty - 0.15, cam);
          const washRad = 1.65 * TILE_W * cam.zoom;
          if (washRad > 0) {
            targetCtx.save();
            const mWashY = wallLeftPt.y - 26 * cam.zoom;
            const mGrad = targetCtx.createRadialGradient(
              wallLeftPt.x,
              mWashY,
              0,
              wallLeftPt.x,
              mWashY,
              washRad,
            );
            mGrad.addColorStop(0, night ? 'rgba(224, 64, 251, 0.16)' : 'rgba(224, 64, 251, 0.10)');
            mGrad.addColorStop(1, 'rgba(0,0,0,0)');
            targetCtx.fillStyle = mGrad;
            targetCtx.beginPath();
            targetCtx.ellipse(wallLeftPt.x, mWashY, washRad, washRad * 0.62, 0, 0, Math.PI * 2);
            targetCtx.fill();

            const cWashY = wallRightPt.y - 26 * cam.zoom;
            const cGrad = targetCtx.createRadialGradient(
              wallRightPt.x,
              cWashY,
              0,
              wallRightPt.x,
              cWashY,
              washRad,
            );
            cGrad.addColorStop(0, night ? 'rgba(0, 229, 255, 0.14)' : 'rgba(0, 229, 255, 0.08)');
            cGrad.addColorStop(1, 'rgba(0,0,0,0)');
            targetCtx.fillStyle = cGrad;
            targetCtx.beginPath();
            targetCtx.ellipse(wallRightPt.x, cWashY, washRad, washRad * 0.62, 0, 0, Math.PI * 2);
            targetCtx.fill();
            targetCtx.restore();
          }
        }
        const serverAnchor = currentLayout.zoneSlots.SERVER_RACK[0];
        if (serverAnchor) {
          drawRadialPoolOn(
            targetCtx,
            serverAnchor.gx,
            serverAnchor.gy,
            1.9,
            night ? 'rgba(60, 235, 180, 0.16)' : 'rgba(60, 235, 180, 0.06)',
            'rgba(0,0,0,0)',
          );
        }
        drawRadialPoolOn(
          targetCtx,
          currentLayout.presenterSlot.gx,
          currentLayout.presenterSlot.gy,
          2.1,
          night ? 'rgba(80, 210, 255, 0.15)' : 'rgba(80, 210, 255, 0.06)',
          'rgba(0,0,0,0)',
        );
      };

      // 1 & 2. Optional Offscreen Static Layer Cache
      if (useStaticCache) {
        const staticCacheKey = `${canvasW}x${canvasH}|${dpr.toFixed(2)}|${antiAliasing}|${cam.zoom.toFixed(3)}|${Math.round(cam.offsetX)},${Math.round(cam.offsetY)}|${currentLayout.blueprintIndex}|${currentLayout.themePalette.nameEn}|${night ? 1 : 0}|${eventKind ?? 'none'}|${localeRef.current}`;

        let staticCanvas = staticCacheRef.current.canvas;
        if (!staticCanvas && typeof document !== 'undefined') {
          staticCanvas = document.createElement('canvas');
          staticCacheRef.current.canvas = staticCanvas;
        }

        if (staticCanvas && staticCacheRef.current.key !== staticCacheKey) {
          if (staticCanvas.width !== canvasW) staticCanvas.width = canvasW;
          if (staticCanvas.height !== canvasH) staticCanvas.height = canvasH;
          const sctx = staticCanvas.getContext('2d');
          if (sctx) {
            sctx.save();
            sctx.setTransform(1, 0, 0, 1, 0, 0);
            sctx.clearRect(0, 0, canvasW, canvasH);
            sctx.scale(dpr, dpr);
            applyAntiAliasing(sctx, antiAliasing);
            drawStaticArchitecture(sctx, 0);
            sctx.restore();
            staticCacheRef.current.key = staticCacheKey;
          }
        }

        if (staticCanvas && staticCacheRef.current.key === staticCacheKey) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          applyAntiAliasing(ctx, antiAliasing);
          ctx.drawImage(staticCanvas, 0, 0);
          ctx.restore();
        }
      } else if (staticCacheRef.current.key) {
        staticCacheRef.current.key = '';
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      applyAntiAliasing(ctx, antiAliasing);

      if (!useStaticCache) {
        drawStaticArchitecture(ctx, timeSec);
      }

      const drawRadialPool = (
        gx: number,
        gy: number,
        radiusTiles: number,
        innerColor: string,
        outerColor: string,
      ) => drawRadialPoolOn(ctx, gx, gy, radiusTiles, innerColor, outerColor);

      // 3. Collect depth-sorted renderables (furniture, unlocked props, mascot, employees)
      interface RenderItem {
        depth: number;
        draw: () => void;
      }
      const renderables: RenderItem[] = [];

      const currentAlignments = seatAlignmentsRef.current;

      // Occupied check for dev/qa desks, gaming TV console, presentation screen & pizza box
      const occupiedZones = new Set(
        currentFloor.employees.filter((e) => e.status === 'working').map((e) => e.zone),
      );
      let hasSeatedBeanbagGamer = false;
      for (const emp of currentFloor.employees) {
        const actor = actors.get(emp.id);
        if (!actor || actor.isWalking || emp.activity === 'going_home') continue;
        const sk = `${Math.round(actor.gx)},${Math.round(actor.gy)}`;
        if (currentAlignments.beanbagKeys.has(sk)) {
          hasSeatedBeanbagGamer = true;
          break;
        }
      }
      const isGamingOccupied =
        currentFloor.employees.some((e) => e.activity === 'gaming') || hasSeatedBeanbagGamer;
      const isPresenterActive = currentFloor.employees.some(
        (e) => e.activity === 'presenting' || e.isPresenter,
      );
      const isPizzaPartyEvent = currentFloor.activeEvent?.kind === 'PIZZA_PARTY';
      const isPizzaActive =
        isPizzaPartyEvent || currentFloor.employees.some((e) => e.activity === 'pizza');
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

      let beanbagCounter = 0;

      for (const item of currentLayout.furniture) {
        const itemKey = `${item.gx},${item.gy}`;
        const isWorkChair = WORK_CHAIR_KINDS.has(item.kind);
        const isBeanbag = isBeanbagKind(item.kind);
        const isPartition = isPartitionKind(item.kind);
        const itemColorIndex = isBeanbag ? beanbagCounter++ : undefined;
        const chairDeskAlign = isWorkChair ? currentAlignments.deskSeatMap.get(itemKey) : undefined;
        const partitionSeam = isPartition
          ? resolvePartitionSeam(item, currentLayout.getTileZone)
          : null;
        const renderItemGx = chairDeskAlign
          ? chairDeskAlign.seatGx
          : partitionSeam
            ? partitionSeam.gx
            : item.gx;
        const renderItemGy = chairDeskAlign
          ? chairDeskAlign.seatGy
          : partitionSeam
            ? partitionSeam.gy
            : item.gy;
        const itemDepth = chairDeskAlign ? chairDeskAlign.chairDepth : renderItemGx + renderItemGy;
        const itemFacing = currentAlignments.chairFacingMap.get(itemKey) ?? 'SE';
        const p = gridToScreen(renderItemGx, renderItemGy, cam);
        const isWb = item.kind === 'whiteboard_l' || item.kind === 'whiteboard_r';
        if (isWb) {
          wbMinX = Math.min(wbMinX, p.x - 22 * cam.zoom);
          wbMinY = Math.min(wbMinY, p.y - 46 * cam.zoom);
          wbMaxX = Math.max(wbMaxX, p.x + 22 * cam.zoom);
          wbMaxY = Math.max(wbMaxY, p.y + 4 * cam.zoom);
        }
        renderables.push({
          depth: itemDepth,
          draw: () => {
            let deskLevel = 1;
            let occupierModelFamily = 'pro';
            let deskHasWorking = false;
            let deskHasSeated = false;
            let deskHasVerified = false;
            if (WORK_DESK_KINDS.has(item.kind)) {
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
                  deskHasSeated = !actor.isWalking && emp.activity !== 'going_home';
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

            const isTvItem = item.kind === 'tv_console' || item.kind === 'gaming_tv';
            const occupied =
              (WORK_DESK_KINDS.has(item.kind) &&
                (deskHasWorking ||
                  deskHasSeated ||
                  (item.kind === 'dev_desk' && occupiedZones.has('DESK_CODING')) ||
                  (item.kind === 'qa_desk' && occupiedZones.has('DESK_QA')) ||
                  (item.kind === 'exec_desk' && occupiedZones.has('DESK_ARCHITECT')))) ||
              (isTvItem && isGamingOccupied) ||
              (item.kind === 'lounge_table' && isPizzaActive) ||
              ((item.kind === 'coffee_table' || item.kind === 'gaming_table') && isPizzaPartyEvent) ||
              (item.kind === 'elevator_doors' && isElevatorBusy) ||
              (isWb && isPresenterActive);

            // Soft elliptical furniture contact shadow (beanbags and seam-aligned partitions omit the generic oval shadow)
            if (
              !isBeanbag &&
              !isPartition &&
              item.kind !== 'glass_partition_y'
            ) {
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

            // Subtle live neon TV screen & ambilight bounce onto the PlayStation lounge rug
            if (isTvItem && (isGamingOccupied || night)) {
              const pulseAlpha = (
                (night ? 0.08 : 0.05) +
                0.025 * Math.sin(timeSec * 3.2)
              ).toFixed(3);
              drawRadialPool(
                item.gx + 0.55,
                item.gy + 0.75,
                1.65,
                `rgba(0, 229, 255, ${pulseAlpha})`,
                'rgba(0,0,0,0)',
              );
              drawRadialPool(
                item.gx - 0.15,
                item.gy + 0.35,
                1.35,
                `rgba(224, 64, 251, ${pulseAlpha})`,
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
              itemFacing,
              itemColorIndex,
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
      const renderedDynamicChairKeys = new Set<string>();
      for (const emp of currentFloor.employees) {
        const actor = actors.get(emp.id);
        if (!actor) continue;
        // Fade out employees stepping into the elevator to go home
        const distElev = Math.hypot(actor.gx - ELEVATOR_SLOT.gx, actor.gy - ELEVATOR_SLOT.gy);
        const alpha =
          emp.activity === 'going_home' ? Math.max(0, Math.min(1, distElev / 1.4)) : 1;
        if (alpha <= 0.02) continue;

        const isPresenting =
          !actor.isWalking && (emp.activity === 'presenting' || Boolean(emp.isPresenter));
        const slotKey = `${Math.round(actor.gx)},${Math.round(actor.gy)}`;
        const isSeatedStationary =
          !actor.isWalking && !isPresenting && emp.activity !== 'going_home';
        const isDeskZoneOrActivity =
          emp.zone === 'DESK_CODING' ||
          emp.zone === 'DESK_QA' ||
          emp.zone === 'DESK_ARCHITECT' ||
          emp.activity === 'coding' ||
          emp.activity === 'terminal';
        const deskSeatAlign =
          isSeatedStationary && isDeskZoneOrActivity
            ? currentAlignments.deskSeatMap.get(slotKey)
            : undefined;
        const isSeatedOnBeanbag =
          isSeatedStationary && !deskSeatAlign && currentAlignments.beanbagKeys.has(slotKey);
        const alignedChairFacing = isSeatedStationary
          ? currentAlignments.chairFacingMap.get(slotKey)
          : undefined;

        const renderGx = deskSeatAlign ? deskSeatAlign.seatGx : actor.gx;
        const renderGy = deskSeatAlign ? deskSeatAlign.seatGy : actor.gy;
        const celebrationHeroActor = currentFloor.activeCelebration
          ? actors.get(currentFloor.activeCelebration.heroAgentId)
          : undefined;
        const turnToHero =
          Boolean(celebrationHeroActor) &&
          !deskSeatAlign &&
          !actor.isWalking &&
          emp.id !== currentFloor.activeCelebration?.heroAgentId &&
          emp.status !== 'working';
        const renderFacing: Facing = turnToHero && celebrationHeroActor
          ? facingFromDelta(
              celebrationHeroActor.gx - actor.gx,
              celebrationHeroActor.gy - actor.gy,
              actor.facing,
            )
          : deskSeatAlign
            ? deskSeatAlign.deskFacing
            : (alignedChairFacing ?? actor.facing);
        const empDepth = deskSeatAlign ? deskSeatAlign.empDepth : actor.gx + actor.gy + 0.14;
        const p = gridToScreen(renderGx, renderGy, cam);
        const beanbagFlip = renderFacing === 'NW' || renderFacing === 'SW' ? -1 : 1;
        const empScreenX = isSeatedOnBeanbag ? p.x + beanbagFlip * 2.5 * cam.zoom : p.x;
        const empScreenY = isSeatedOnBeanbag ? p.y - 1.2 * cam.zoom : p.y;
        const renderEmp: OfficeEmployee =
          isSeatedOnBeanbag && emp.activity === 'lounging'
            ? { ...emp, activity: 'gaming' }
            : emp;

        // Ensure secondary desk slots without an explicit chair prop still render an ergonomic task chair beneath the seated employee
        if (
          deskSeatAlign &&
          !currentAlignments.explicitWorkChairKeys.has(slotKey) &&
          !renderedDynamicChairKeys.has(slotKey)
        ) {
          renderedDynamicChairKeys.add(slotKey);
          renderables.push({
            depth: deskSeatAlign.chairDepth,
            draw: () => {
              ctx.save();
              ctx.globalAlpha = (night ? 0.28 : 0.18) * alpha;
              ctx.fillStyle = '#070a14';
              ctx.beginPath();
              ctx.ellipse(p.x, p.y + 4 * cam.zoom, 14 * cam.zoom, 6 * cam.zoom, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
              drawEnhancedFurniture(
                ctx,
                emp.zone === 'DESK_ARCHITECT' ? 'exec_chair' : 'desk_chair',
                p.x,
                p.y,
                cam.zoom,
                timeSec,
                night,
                true,
                emp.modelFamily,
                false,
                '',
                emp.level,
                deskSeatAlign.deskFacing,
              );
            },
          });
        }

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
          x: empScreenX,
          y: empScreenY - 20 * cam.zoom,
          r: 22 * cam.zoom,
        });
        renderables.push({
          depth: empDepth,
          draw: () => {
            drawEmployeeSprite(
              ctx,
              renderEmp,
              empScreenX,
              empScreenY,
              cam.zoom,
              renderFacing,
              actor.isWalking,
              actor.walkPhase,
              timeSec,
              isHovered,
              isSelected,
              alpha,
              showSpeechBubble,
              currentFloor.activeEvent?.kind ?? null,
            );
            {
              const reaction = emp.socialReaction;
              const isHero = currentFloor.activeCelebration?.heroAgentId === emp.id;
              if (reaction === 'cheering' || reaction === 'coffee_thanks' || isHero) {
                const z = cam.zoom;
                const phase = timeSec * 5 + hashString(emp.id) * 0.37;
                const bounce = Math.abs(Math.sin(phase)) * 4 * z;
                ctx.save();
                if (alpha < 1) ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = `${Math.max(9, Math.round(13 * z))}px sans-serif`;
                const icon = reaction === 'coffee_thanks' ? '❤️' : isHero ? '🏆' : '👏';
                ctx.fillText(icon, empScreenX + 13 * z, empScreenY - 50 * z - bounce);
                if (isHero) {
                  for (let i = 0; i < 6; i++) {
                    const a = phase * 0.8 + (i * Math.PI * 2) / 6;
                    const rad = (16 + (i % 2) * 6) * z;
                    ctx.fillStyle = ['#ffd147', '#ff5666', '#3cd8ff', '#3be87a', '#b07cff', '#ffbe3b'][i];
                    ctx.fillRect(
                      Math.round(empScreenX + Math.cos(a) * rad),
                      Math.round(empScreenY - 26 * z + Math.sin(a) * rad * 0.7 - bounce),
                      Math.max(2, Math.ceil(2.5 * z)),
                      Math.max(2, Math.ceil(2.5 * z)),
                    );
                  }
                }
                ctx.restore();
              }
            }
            if (emp.health) {
              const z = cam.zoom;
              const bob = actor.isWalking
                ? Math.abs(Math.sin(actor.walkPhase * Math.PI * 2)) * 3 * z
                : 0;
              const seated =
                !actor.isWalking &&
                !isPresenting &&
                (Boolean(deskSeatAlign) ||
                  isSeatedOnBeanbag ||
                  renderEmp.activity === 'coding' ||
                  renderEmp.activity === 'terminal' ||
                  renderEmp.activity === 'reading' ||
                  renderEmp.activity === 'searching' ||
                  renderEmp.activity === 'thinking' ||
                  renderEmp.activity === 'meeting' ||
                  renderEmp.activity === 'lounging' ||
                  renderEmp.activity === 'sleeping' ||
                  renderEmp.activity === 'gaming');
              const baseY = empScreenY - bob + (seated ? 4 * z : 0);
              const hasErrorLoop =
                emp.health.consecutiveErrors >= 2 ||
                emp.toolActivity === 'error' ||
                emp.status === 'error';
              const hasActiveTool =
                (Boolean(emp.toolActivity) && emp.toolActivity !== 'idle') ||
                emp.status === 'error';
              const showNameTag = isHovered || isSelected;
              const badgeX = showNameTag
                ? empScreenX + (hasActiveTool && !showSpeechBubble ? 18 * z : 0)
                : empScreenX + (hasErrorLoop ? 15.5 * z : 12 * z);
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
        style={{
          display: 'block',
          cursor: cursorStyle,
          touchAction: 'none',
          imageRendering: graphicsSettings.antiAliasing === 'smooth' ? 'auto' : 'pixelated',
        }}
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
        {onOpenLegend && (
          <button
            className="pixel-btn"
            onClick={() => {
              playSelectBlip();
              onOpenLegend();
            }}
            type="button"
          >
            {t.hud.legend}
          </button>
        )}
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
