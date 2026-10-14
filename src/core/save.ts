import type { AutomationKey, GameState } from './types';
import {
  ACADEMY,
  AUTO_PRESTIGE_THRESHOLDS,
  DAILY_DIG_POOL,
  FINDS,
  KENNELS,
  MAX_STREAK_FREEZES,
  PREMIUM_SHOP,
  KENNEL_SLOTS,
  MAX_FLEET_SLOTS,
  SAVE_KEY,
  SAVE_VERSION,
  TRAINING,
  TREATS,
  VEHICLES,
} from '../data';
import { createInitialState } from './state';
import { createDailyState, emptyCounters } from './counters';
import { computeStats } from './stats';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Numeric fields that must be finite numbers if present. */
const NUMERIC_KEYS = [
  'cash', 'pups', 'adoptionStock', 'findIndex', 'highestFindIndex', 'goldenBones',
  'spiritPaws', 'legendCollars', 'zoomies', 'zoomieIdle', 'squirrelTimer',
  'nextSquirrelId', 'mailTimer', 'runEarnings', 'lifetimeEarnings', 'prestigeCount',
  'createdAt', 'lastSaved', 'mailCount', 'runTimeSec', 'automationTimer',
] as const;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

function cleanSlots(raw: unknown, length: number, tiers: number): (number | null)[] {
  const out: (number | null)[] = new Array(length).fill(null);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < length; i++) {
    const v = raw[i];
    out[i] = isNum(v) && Number.isInteger(v) && v >= 0 && v < tiers ? v : null;
  }
  return out;
}

function cleanLevels(raw: unknown, defs: { id: string; maxLevel: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  for (const d of defs) {
    const v = raw[d.id];
    if (isNum(v) && v > 0) out[d.id] = Math.min(Math.floor(v), d.maxLevel);
  }
  return out;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const cleanDay = (v: unknown): string | null => (typeof v === 'string' && DAY_RE.test(v) ? v : null);
const cleanCount = (v: unknown): number => (isNum(v) && v > 0 ? Math.floor(v) : 0);

function cleanDaily(raw: unknown): GameState['daily'] {
  const out = createDailyState();
  if (!isObj(raw)) return out;
  out.lastSeenDay = cleanDay(raw.lastSeenDay);
  out.lastClaimDay = cleanDay(raw.lastClaimDay);
  out.streak = cleanCount(raw.streak);
  out.bestStreak = Math.max(out.streak, cleanCount(raw.bestStreak));
  out.streakFreezes = Math.min(MAX_STREAK_FREEZES, cleanCount(raw.streakFreezes));
  out.streakMilestones = Array.isArray(raw.streakMilestones) ? raw.streakMilestones.filter(isNum) : [];
  out.digsDay = cleanDay(raw.digsDay);
  out.digBonusClaimed = raw.digBonusClaimed === true;
  out.modifierId = typeof raw.modifierId === 'string' ? raw.modifierId : null;
  if (isObj(raw.counters)) {
    for (const k of Object.keys(out.counters) as (keyof typeof out.counters)[]) {
      const v = raw.counters[k];
      if (isNum(v) && v > 0) out.counters[k] = v;
    }
  }
  out.digs = Array.isArray(raw.digs)
    ? raw.digs
        .filter(
          (d): d is { kind: string; target: number; claimed?: unknown } =>
            isObj(d) && DAILY_DIG_POOL.some((p) => p.kind === d.kind) && isNum(d.target),
        )
        .map((d) => ({ kind: d.kind as GameState['daily']['digs'][number]['kind'], target: d.target, claimed: d.claimed === true }))
    : [];
  if (out.digs.length === 0) {
    out.digsDay = null;
    out.counters = emptyCounters();
  }
  return out;
}

function cleanPremium(raw: unknown, base: GameState['premium']): GameState['premium'] {
  const out = { ...base, receipts: [] as string[], shop: {} as Record<string, number> };
  if (!isObj(raw)) return out;
  out.stars = Math.floor(isNum(raw.stars) && raw.stars > 0 ? raw.stars : 0);
  out.spendCents = Math.floor(isNum(raw.spendCents) && raw.spendCents > 0 ? raw.spendCents : 0);
  out.receipts = Array.isArray(raw.receipts) ? raw.receipts.filter((r): r is string => typeof r === 'string') : [];
  out.shop = cleanLevels(raw.shop, PREMIUM_SHOP);
  return out;
}

export function deserialize(json: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(parsed) || (parsed.version !== SAVE_VERSION && parsed.version !== 3 && parsed.version !== 2 && parsed.version !== 1)) return null;
  for (const k of NUMERIC_KEYS) {
    if (k in parsed && !isNum(parsed[k])) return null;
  }

  const fromV1 = parsed.version === 1;
  const base = createInitialState(Date.now());
  const merged = { ...base, ...parsed } as GameState;

  merged.version = SAVE_VERSION as 4; // v3 -> v4 only bumps the version
  merged.kennels = cleanSlots(parsed.kennels ?? base.kennels, KENNEL_SLOTS, KENNELS.length);
  merged.vehicles = cleanSlots(parsed.vehicles ?? base.vehicles, MAX_FLEET_SLOTS, VEHICLES.length);
  merged.training = cleanLevels(parsed.training, TRAINING);
  merged.academy = cleanLevels(parsed.academy, ACADEMY);
  merged.findIndex = Math.min(Math.max(0, Math.floor(merged.findIndex)), FINDS.length - 1);
  merged.highestFindIndex = Math.min(
    Math.max(merged.findIndex, Math.floor(merged.highestFindIndex)),
    FINDS.length - 1,
  );

  merged.daily = cleanDaily(parsed.daily);
  merged.premium = cleanPremium(parsed.premium, base.premium);

  merged.trophies = Array.isArray(parsed.trophies)
    ? parsed.trophies.filter((t): t is string => typeof t === 'string')
    : [];
  merged.notifiedFinds = Array.isArray(parsed.notifiedFinds)
    ? parsed.notifiedFinds.filter(isNum)
    : [];
  merged.treats = Array.isArray(parsed.treats)
    ? parsed.treats.filter(
        (t): t is { id: string; remaining: number } =>
          isObj(t) && typeof t.id === 'string' && isNum(t.remaining) &&
          TREATS.some((d) => d.id === t.id),
      ).map((t) => ({ id: t.id, remaining: t.remaining }))
    : [];
  merged.squirrels = Array.isArray(parsed.squirrels)
    ? (parsed.squirrels.filter(
        (q) =>
          isObj(q) && isNum(q.id) && isNum(q.age) && isNum(q.lifetime) && isObj(q.reward) &&
          typeof q.reward.kind === 'string',
      ) as unknown as GameState['squirrels'])
    : [];
  delete (merged as unknown as Record<string, unknown>).mailReady;
  merged.mailCount = fromV1
    ? parsed.mailReady === true ? 1 : 0
    : Math.max(0, Math.floor(isNum(parsed.mailCount) ? parsed.mailCount : 0));
  merged.mailCount = Math.min(merged.mailCount, computeStats(merged).mailCapacity);
  merged.runTimeSec = fromV1 ? 0 : Math.max(0, merged.runTimeSec);
  merged.automationTimer = fromV1 ? 0 : merged.automationTimer;
  merged.endgameReached = parsed.endgameReached === true;

  // automation: defaults for v1; for v2 take valid booleans. Locked keys are forced off.
  const unlocked = computeStats(merged).automationUnlocked;
  const rawAuto = isObj(parsed.automation) ? parsed.automation : {};
  const auto = { ...base.automation };
  for (const k of ['find', 'build', 'training', 'whistle', 'prestige'] as AutomationKey[]) {
    auto[k] = typeof rawAuto[k] === 'boolean' ? (rawAuto[k] as boolean) : unlocked[k];
    if (fromV1) auto[k] = unlocked[k];
    if (!unlocked[k]) auto[k] = false;
  }
  if (isNum(rawAuto.prestigeThreshold) && AUTO_PRESTIGE_THRESHOLDS.includes(rawAuto.prestigeThreshold)) {
    auto.prestigeThreshold = rawAuto.prestigeThreshold;
  }
  merged.automation = auto;
  merged.stats = { ...base.stats, ...(isObj(parsed.stats) ? parsed.stats : {}) };
  for (const k of Object.keys(base.stats) as (keyof GameState['stats'])[]) {
    if (!isNum(merged.stats[k])) merged.stats[k] = base.stats[k];
  }
  return merged;
}

export function saveGame(state: GameState, storage: StorageLike, now: number): void {
  state.lastSaved = now;
  try {
    storage.setItem(SAVE_KEY, serialize(state));
  } catch {
    // storage full / unavailable: the game keeps running, the save is skipped
  }
}

export function loadGame(storage: StorageLike): GameState | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function exportSave(state: GameState): string {
  const bytes = new TextEncoder().encode(serialize(state));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return globalThis.btoa(bin);
}

export function importSave(text: string): GameState | null {
  try {
    const bin = globalThis.atob(text.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return deserialize(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
