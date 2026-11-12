import type { FloorEventKind, FloorRandomEvent } from '../shared/types.js';

const EVENT_KINDS: FloorEventKind[] = [
  'PIZZA_PARTY',
  'WATERCOOLER_GOSSIP',
  'SPRINT_CELEBRATION',
  'MASCOT_ZOOMIES',
  'COFFEE_BREW',
];

const EVENT_DURATION_MS = 16_000;

const layoutSeeds = new Map<string, number>();
const floorEvents = new Map<string, FloorRandomEvent>();
const lastEventIndex = new Map<string, number>();

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
  return event;
}

export function resetOfficeEventsState(): void {
  layoutSeeds.clear();
  floorEvents.clear();
  lastEventIndex.clear();
}
