import type {
  FloorCelebration,
  OfficeEmployee,
  SocialReactionKind,
} from '../shared/types.js';

export const CELEBRATION_COOLDOWN_MS = 45_000;
export const CELEBRATION_DURATION_MS = 9_000;
export const HARD_TASK_MIN_STEPS = 8;
export const COFFEE_VISIT_COOLDOWN_MS = 75_000;
export const COFFEE_VISIT_COOLDOWN_DEMO_MS = 32_000;
export const COFFEE_VISIT_DURATION_MS = 10_000;
export const DEMO_CELEBRATION_PERIOD_MS = 120_000;
export const MAX_CELEBRATING_WORKERS = 2;

export const CELEBRATION_CHEER_BUBBLES = [
  '👏 Helal olsun!',
  '🎉 Bravo, zor işti!',
  '🚀 Harika iş çıkardın!',
] as const;
export const CELEBRATION_HERO_BUBBLES = ['🙌 Teşekkürler ekip!'] as const;
export const COFFEE_GIFT_BUBBLES = [
  '☕ Kahve getirdim, kolay gelsin!',
  '💪 Yaparsın, çok iyi gidiyor!',
  '🔥 Az kaldı, harikasın!',
  '⚡ Taze espresso takviyesi!',
] as const;
export const COFFEE_THANKS_BUBBLES = [
  '❤️ Çok teşekkürler, ilaç gibi geldi!',
  '☕ Süpersin, sağ ol!',
] as const;

interface CoffeeVisit {
  visitorId: string;
  targetId: string;
  startedAt: number;
  expiresAt: number;
}

const celebrations = new Map<string, FloorCelebration>();
const lastCelebrationAt = new Map<string, number>();
const verifiedSeen = new Map<string, Set<string>>();
const baselined = new Set<string>();
const coffeeVisits = new Map<string, CoffeeVisit>();
const lastCoffeeVisitAt = new Map<string, number>();
const coffeeCounters = new Map<string, number>();

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(pool: readonly T[], seed: string): T {
  return pool[hashString(seed) % pool.length];
}

function isDeskWorker(emp: OfficeEmployee): boolean {
  return (
    emp.status === 'working' &&
    emp.toolActivity !== 'error' &&
    (emp.zone === 'DESK_ARCHITECT' ||
      emp.zone === 'DESK_CODING' ||
      emp.zone === 'DESK_QA' ||
      emp.zone === 'SERVER_RACK')
  );
}

function isLoungeBreaker(emp: OfficeEmployee): boolean {
  return (
    emp.zone === 'COFFEE_LOUNGE' &&
    (emp.status === 'idle' || emp.status === 'waiting') &&
    emp.activity !== 'gaming' &&
    emp.activity !== 'going_home' &&
    !emp.partnerId
  );
}

export function getActiveCelebration(
  floorId: string,
  nowMs = Date.now(),
): FloorCelebration | null {
  const existing = celebrations.get(floorId);
  if (!existing) return null;
  if (existing.expiresAt <= nowMs) {
    celebrations.delete(floorId);
    return null;
  }
  return existing;
}

export function startFloorCelebration(
  floorId: string,
  hero: Pick<OfficeEmployee, 'id' | 'name'>,
  nowMs = Date.now(),
  verifiedLabel?: string,
): FloorCelebration {
  const celebration: FloorCelebration = {
    id: `${floorId}-celebration-${nowMs}`,
    heroAgentId: hero.id,
    heroName: hero.name,
    verifiedLabel,
    startedAt: nowMs,
    expiresAt: nowMs + CELEBRATION_DURATION_MS,
  };
  celebrations.set(floorId, celebration);
  lastCelebrationAt.set(floorId, nowMs);
  return celebration;
}

/**
 * Cheering reactions. Never touches status / zone / activity of any agent
 * (real-work integrity): only socialReaction + speechBubble.
 */
export function applyCelebrationReactions(
  employees: OfficeEmployee[],
  celebration: FloorCelebration,
): void {
  let workerCheers = 0;
  for (const emp of employees) {
    if (emp.activity === 'going_home') continue;
    if (emp.id === celebration.heroAgentId) {
      emp.speechBubble = pick(CELEBRATION_HERO_BUBBLES, emp.id + celebration.id);
      continue;
    }
    if (emp.status === 'working') {
      if (emp.toolActivity === 'error' || workerCheers >= MAX_CELEBRATING_WORKERS) continue;
      workerCheers += 1;
    }
    emp.socialReaction = 'cheering';
    emp.speechBubble = pick(CELEBRATION_CHEER_BUBBLES, emp.id + celebration.id);
  }
}

function detectHardTaskVerification(
  floorId: string,
  employees: OfficeEmployee[],
  nowMs: number,
): void {
  let seen = verifiedSeen.get(floorId);
  if (!seen) {
    seen = new Set<string>();
    verifiedSeen.set(floorId, seen);
  }
  const isFirstScan = !baselined.has(floorId);
  baselined.add(floorId);

  const currentlyVerified = new Set<string>();
  let hero: OfficeEmployee | null = null;
  for (const emp of employees) {
    if (!emp.health?.isVerifiedOutput) continue;
    currentlyVerified.add(emp.id);
    if (seen.has(emp.id)) continue;
    if (!isFirstScan && emp.stepCount >= HARD_TASK_MIN_STEPS && !hero) {
      hero = emp;
    }
  }
  seen.clear();
  for (const id of currentlyVerified) seen.add(id);

  if (!hero) return;
  const lastAt = lastCelebrationAt.get(floorId);
  if (lastAt !== undefined && nowMs - lastAt < CELEBRATION_COOLDOWN_MS) return;
  if (getActiveCelebration(floorId, nowMs)) return;
  startFloorCelebration(floorId, hero, nowMs);
}

function demoCelebration(
  floorId: string,
  employees: OfficeEmployee[],
  nowMs: number,
): FloorCelebration | null {
  const bucket = Math.floor(nowMs / DEMO_CELEBRATION_PERIOD_MS);
  const startedAt = bucket * DEMO_CELEBRATION_PERIOD_MS + 50_000;
  if (nowMs < startedAt || nowMs >= startedAt + CELEBRATION_DURATION_MS) return null;
  const workers = employees.filter((e) => e.status === 'working');
  if (workers.length === 0) return null;
  const hero = workers[bucket % workers.length];
  return {
    id: `${floorId}-demo-celebration-${bucket}`,
    heroAgentId: hero.id,
    heroName: hero.name,
    startedAt,
    expiresAt: startedAt + CELEBRATION_DURATION_MS,
  };
}

function applyCoffeeVisit(
  floorId: string,
  employees: OfficeEmployee[],
  nowMs: number,
  demo: boolean,
): void {
  const byId = new Map(employees.map((e) => [e.id, e]));
  let visit = coffeeVisits.get(floorId);

  if (visit) {
    const visitor = byId.get(visit.visitorId);
    const target = byId.get(visit.targetId);
    if (
      visit.expiresAt <= nowMs ||
      !visitor ||
      !target ||
      !isLoungeBreaker(visitor) ||
      !isDeskWorker(target)
    ) {
      coffeeVisits.delete(floorId);
      visit = undefined;
    }
  }

  if (!visit) {
    const cooldown = demo ? COFFEE_VISIT_COOLDOWN_DEMO_MS : COFFEE_VISIT_COOLDOWN_MS;
    const lastAt = lastCoffeeVisitAt.get(floorId);
    if (lastAt === undefined) {
      // Baseline on first sight so a visit never fires on the very first scan.
      lastCoffeeVisitAt.set(floorId, nowMs);
      return;
    }
    if (nowMs - lastAt < cooldown) return;

    const visitors = employees.filter(isLoungeBreaker);
    const targets = employees.filter(isDeskWorker);
    if (visitors.length === 0 || targets.length === 0) return;

    const counter = coffeeCounters.get(floorId) ?? 0;
    coffeeCounters.set(floorId, counter + 1);
    const visitor = visitors[counter % visitors.length];
    const target = targets[counter % targets.length];
    visit = {
      visitorId: visitor.id,
      targetId: target.id,
      startedAt: nowMs,
      expiresAt: nowMs + COFFEE_VISIT_DURATION_MS,
    };
    coffeeVisits.set(floorId, visit);
    lastCoffeeVisitAt.set(floorId, nowMs);
  }

  const visitor = byId.get(visit.visitorId);
  const target = byId.get(visit.targetId);
  if (!visitor || !target) return;

  const gift: SocialReactionKind = 'coffee_gift';
  visitor.visitTargetId = target.id;
  visitor.socialReaction = gift;
  visitor.activity = 'coffee';
  visitor.speechBubble = pick(COFFEE_GIFT_BUBBLES, visitor.id + visit.startedAt);

  if (nowMs - visit.startedAt >= COFFEE_VISIT_DURATION_MS * 0.4) {
    target.socialReaction = 'coffee_thanks';
    target.speechBubble = pick(COFFEE_THANKS_BUBBLES, target.id + visit.startedAt);
  }
}

/**
 * Hard-task celebration + coffee-delivery motivation for one floor.
 * Mutates only speechBubble / socialReaction / visitTargetId (and the visitor's own
 * lounge activity); never changes status, zone or activity of working agents.
 */
export function applyOfficeInteractions(
  floor: { id: string; employees: OfficeEmployee[] },
  nowMs = Date.now(),
  options: { demo?: boolean } = {},
): FloorCelebration | null {
  const demo = options.demo === true;
  let celebration: FloorCelebration | null;
  if (demo) {
    celebration = demoCelebration(floor.id, floor.employees, nowMs);
  } else {
    detectHardTaskVerification(floor.id, floor.employees, nowMs);
    celebration = getActiveCelebration(floor.id, nowMs);
  }

  if (celebration) {
    applyCelebrationReactions(floor.employees, celebration);
  } else {
    applyCoffeeVisit(floor.id, floor.employees, nowMs, demo);
  }
  return celebration;
}

export function resetOfficeInteractionsState(): void {
  celebrations.clear();
  lastCelebrationAt.clear();
  verifiedSeen.clear();
  baselined.clear();
  coffeeVisits.clear();
  lastCoffeeVisitAt.clear();
  coffeeCounters.clear();
}
