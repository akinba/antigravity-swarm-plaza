import type { FloorEventKind, FloorRandomEvent, OfficeEmployee, PlazaFloor } from '../shared/types.js';

const EVENT_KINDS: FloorEventKind[] = [
  'STAR_WARS_PARTY',
  'SUPERHERO_PARTY',
  'HALLOWEEN_PARTY',
  'PIZZA_PARTY',
  'WATERCOOLER_GOSSIP',
  'SPRINT_CELEBRATION',
  'MASCOT_ZOOMIES',
  'COFFEE_BREW',
];

const SOCIAL_EVENT_KINDS = new Set<FloorEventKind>([
  'STAR_WARS_PARTY',
  'SUPERHERO_PARTY',
  'HALLOWEEN_PARTY',
  'PIZZA_PARTY',
  'WATERCOOLER_GOSSIP',
  'COFFEE_BREW',
]);

const NON_SOCIAL_EVENT_KINDS: FloorEventKind[] = [
  'SPRINT_CELEBRATION',
  'MASCOT_ZOOMIES',
];

export const MIN_BREAK_AGENTS_FOR_SOCIAL_EVENT = 2;
export const AUTO_EVENT_COOLDOWN_MS = 150_000;
const EVENT_DURATION_MS = 16_000;

const layoutSeeds = new Map<string, number>();
const floorEvents = new Map<string, FloorRandomEvent>();
const lastEventIndex = new Map<string, number>();
const lastEventTriggeredAt = new Map<string, number>();

export function isSocialFloorEvent(kind: FloorEventKind): boolean {
  return SOCIAL_EVENT_KINDS.has(kind);
}

export function countOnBreakOrWaitingAgents(employees: OfficeEmployee[]): number {
  let count = 0;
  for (const emp of employees) {
    if (emp.activity === 'going_home') continue;
    if (
      emp.status === 'waiting' ||
      emp.status === 'idle' ||
      emp.zone === 'COFFEE_LOUNGE' ||
      emp.activity === 'coffee' ||
      emp.activity === 'gaming' ||
      emp.activity === 'sleeping' ||
      emp.activity === 'lounging' ||
      emp.activity === 'watercooler' ||
      emp.activity === 'pizza'
    ) {
      count += 1;
    }
  }
  return count;
}

export function getFloorLayoutSeed(floorId: string): number {
  return layoutSeeds.get(floorId) ?? 0;
}

export function rerollFloorLayout(floorId: string): number {
  const next = getFloorLayoutSeed(floorId) + 1;
  layoutSeeds.set(floorId, next);
  return next;
}

export function getActiveFloorEvent(
  floorId: string,
  nowMs = Date.now(),
): FloorRandomEvent | null {
  const existing = floorEvents.get(floorId);
  if (!existing) return null;
  if (existing.expiresAt <= nowMs) {
    floorEvents.delete(floorId);
    return null;
  }
  return existing;
}

export function triggerFloorEvent(
  floorId: string,
  preferredKind?: FloorEventKind,
  nowMs = Date.now(),
): FloorRandomEvent {
  let kind: FloorEventKind;
  if (preferredKind) {
    kind = preferredKind;
    const idx = EVENT_KINDS.indexOf(preferredKind);
    if (idx >= 0) lastEventIndex.set(floorId, idx);
  } else {
    const prevIdx = lastEventIndex.get(floorId) ?? -1;
    const nextIdx = (prevIdx + 1) % EVENT_KINDS.length;
    lastEventIndex.set(floorId, nextIdx);
    kind = EVENT_KINDS[nextIdx];
  }

  const event: FloorRandomEvent = {
    id: `${floorId}-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    startedAt: nowMs,
    expiresAt: nowMs + EVENT_DURATION_MS,
  };
  floorEvents.set(floorId, event);
  lastEventTriggeredAt.set(floorId, nowMs);
  return event;
}

export function canTriggerAutoFloorEvent(
  floor: Pick<PlazaFloor, 'id' | 'employees' | 'activeEvent'>,
  nowMs = Date.now(),
): boolean {
  if (floor.activeEvent || getActiveFloorEvent(floor.id, nowMs)) return false;
  if (floor.employees.length === 0) return false;
  const lastAt = lastEventTriggeredAt.get(floor.id);
  if (lastAt !== undefined && nowMs - lastAt < AUTO_EVENT_COOLDOWN_MS) {
    return false;
  }
  return true;
}

export function tryTriggerAutoFloorEvent(
  floor: Pick<PlazaFloor, 'id' | 'employees' | 'activeEvent'>,
  nowMs = Date.now(),
): FloorRandomEvent | null {
  if (!canTriggerAutoFloorEvent(floor, nowMs)) return null;

  const onBreakCount = countOnBreakOrWaitingAgents(floor.employees);
  const pool =
    onBreakCount >= MIN_BREAK_AGENTS_FOR_SOCIAL_EVENT
      ? EVENT_KINDS
      : NON_SOCIAL_EVENT_KINDS;

  const prevIdx = lastEventIndex.get(floor.id) ?? -1;
  let pickedKind: FloorEventKind = pool[0];
  for (let offset = 1; offset <= EVENT_KINDS.length; offset++) {
    const candidate = EVENT_KINDS[(prevIdx + offset) % EVENT_KINDS.length];
    if (pool.includes(candidate)) {
      pickedKind = candidate;
      break;
    }
  }

  return triggerFloorEvent(floor.id, pickedKind, nowMs);
}

export function resetOfficeEventsState(): void {
  layoutSeeds.clear();
  floorEvents.clear();
  lastEventIndex.clear();
  lastEventTriggeredAt.clear();
}
