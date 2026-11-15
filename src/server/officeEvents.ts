import type {
  FloorEventKind,
  FloorRandomEvent,
  OfficeEmployee,
  PlazaFloor,
  ScheduledOfficeEvent,
} from '../shared/types.js';

export const EVENT_KINDS: FloorEventKind[] = [
  'STAR_WARS_PARTY',
  'SUPERHERO_PARTY',
  'HALLOWEEN_PARTY',
  'PIZZA_PARTY',
  'WATERCOOLER_GOSSIP',
  'SPRINT_CELEBRATION',
  'MASCOT_ZOOMIES',
  'COFFEE_BREW',
  'CARD_GAME',
];

const SOCIAL_EVENT_KINDS = new Set<FloorEventKind>([
  'STAR_WARS_PARTY',
  'SUPERHERO_PARTY',
  'HALLOWEEN_PARTY',
  'PIZZA_PARTY',
  'WATERCOOLER_GOSSIP',
  'COFFEE_BREW',
  'CARD_GAME',
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
const scheduledEventsByFloor = new Map<string, ScheduledOfficeEvent[]>();
const nextScheduleIndex = new Map<string, number>();

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

export function resolveCardGameTargetZone(
  employees: OfficeEmployee[],
): 'WAR_ROOM' | 'COFFEE_LOUNGE' {
  const warRoomBusy = employees.some(
    (emp) =>
      emp.zone === 'WAR_ROOM' &&
      (emp.status === 'working' || emp.activity === 'meeting' || emp.activity === 'presenting'),
  );
  return warRoomBusy ? 'COFFEE_LOUNGE' : 'WAR_ROOM';
}

export function triggerFloorEvent(
  floorId: string,
  preferredKind?: FloorEventKind,
  nowMs = Date.now(),
  employees?: OfficeEmployee[],
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

  let targetZone: FloorRandomEvent['targetZone'];
  let participantIds: string[] | undefined;
  if (kind === 'CARD_GAME') {
    const list = employees ?? [];
    targetZone = resolveCardGameTargetZone(list);
    participantIds = list
      .filter((e) => e.status !== 'working' && e.activity !== 'going_home')
      .slice(0, 6)
      .map((e) => e.id);
  }

  const event: FloorRandomEvent = {
    id: `${floorId}-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    startedAt: nowMs,
    expiresAt: nowMs + EVENT_DURATION_MS,
    targetZone,
    participantIds,
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

  return triggerFloorEvent(floor.id, pickedKind, nowMs, floor.employees);
}

const SCHEDULE_POOL: FloorEventKind[] = [
  'CARD_GAME',
  'PIZZA_PARTY',
  'STAR_WARS_PARTY',
  'SUPERHERO_PARTY',
  'HALLOWEEN_PARTY',
  'COFFEE_BREW',
];

export function getScheduledFloorEvents(floorId: string): ScheduledOfficeEvent[] {
  return [...(scheduledEventsByFloor.get(floorId) ?? [])].sort(
    (a, b) => a.scheduledFor - b.scheduledFor,
  );
}

export function scheduleFloorEvent(params: {
  floorId: string;
  kind?: FloorEventKind;
  delaySec?: number;
  proposedById?: string;
  proposedByName: string;
  participantNames?: string[];
  announcementText?: string;
  nowMs?: number;
}): ScheduledOfficeEvent {
  const nowMs = params.nowMs ?? Date.now();
  const delaySec = Math.max(5, Math.min(3600, Math.round(params.delaySec ?? 60)));
  let kind = params.kind;
  if (!kind) {
    const idx = nextScheduleIndex.get(params.floorId) ?? 0;
    kind = SCHEDULE_POOL[idx % SCHEDULE_POOL.length];
    nextScheduleIndex.set(params.floorId, idx + 1);
  }
  const entry: ScheduledOfficeEvent = {
    id: `${params.floorId}-sched-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    scheduledFor: nowMs + delaySec * 1000,
    createdAt: nowMs,
    proposedById: params.proposedById,
    proposedByName: params.proposedByName,
    participantNames: params.participantNames,
    announcementText: params.announcementText,
  };
  const list = [...(scheduledEventsByFloor.get(params.floorId) ?? []), entry]
    .sort((a, b) => a.scheduledFor - b.scheduledFor)
    .slice(0, 8);
  scheduledEventsByFloor.set(params.floorId, list);
  return entry;
}

export function tickScheduledFloorEvents(
  floor: Pick<PlazaFloor, 'id' | 'employees' | 'activeEvent'>,
  nowMs = Date.now(),
): { activeEvent: FloorRandomEvent | null; scheduledEvents: ScheduledOfficeEvent[] } {
  const list = scheduledEventsByFloor.get(floor.id) ?? [];
  let active = floor.activeEvent ?? getActiveFloorEvent(floor.id, nowMs);

  if (!active && list.length > 0) {
    list.sort((a, b) => a.scheduledFor - b.scheduledFor);
    const due = list[0];
    if (due.scheduledFor <= nowMs) {
      if (
        isSocialFloorEvent(due.kind) &&
        countOnBreakOrWaitingAgents(floor.employees) < MIN_BREAK_AGENTS_FOR_SOCIAL_EVENT
      ) {
        // Not enough idle/break agents yet — defer slightly instead of firing in an empty room.
        due.scheduledFor = nowMs + 30_000;
      } else {
        list.shift();
        active = triggerFloorEvent(floor.id, due.kind, nowMs, floor.employees);
      }
      scheduledEventsByFloor.set(floor.id, list);
    }
  }

  return {
    activeEvent: active,
    scheduledEvents: getScheduledFloorEvents(floor.id),
  };
}

export function resetOfficeEventsState(): void {
  layoutSeeds.clear();
  floorEvents.clear();
  lastEventIndex.clear();
  lastEventTriggeredAt.clear();
  scheduledEventsByFloor.clear();
  nextScheduleIndex.clear();
}
