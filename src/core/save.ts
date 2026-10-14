import type { GameState } from './types';
import {
  ACADEMY,
  FINDS,
  KENNELS,
  KENNEL_SLOTS,
  MAX_FLEET_SLOTS,
  SAVE_KEY,
  SAVE_VERSION,
  TRAINING,
  TREATS,
  VEHICLES,
} from '../data';
import { createInitialState } from './state';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Numeric fields that must be finite numbers if present. */
const NUMERIC_KEYS = [
  'cash', 'pups', 'adoptionStock', 'findIndex', 'highestFindIndex', 'goldenBones',
  'spiritPaws', 'legendCollars', 'zoomies', 'zoomieIdle', 'squirrelTimer',
  'nextSquirrelId', 'mailTimer', 'runEarnings', 'lifetimeEarnings', 'prestigeCount',
  'createdAt', 'lastSaved',
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

export function deserialize(json: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(parsed) || parsed.version !== SAVE_VERSION) return null;
  for (const k of NUMERIC_KEYS) {
    if (k in parsed && !isNum(parsed[k])) return null;
  }

  const base = createInitialState(Date.now());
  const merged = { ...base, ...parsed } as GameState;

  merged.version = SAVE_VERSION as 1;
  merged.kennels = cleanSlots(parsed.kennels ?? base.kennels, KENNEL_SLOTS, KENNELS.length);
  merged.vehicles = cleanSlots(parsed.vehicles ?? base.vehicles, MAX_FLEET_SLOTS, VEHICLES.length);
  merged.training = cleanLevels(parsed.training, TRAINING);
  merged.academy = cleanLevels(parsed.academy, ACADEMY);
  merged.findIndex = Math.min(Math.max(0, Math.floor(merged.findIndex)), FINDS.length - 1);
  merged.highestFindIndex = Math.min(
    Math.max(merged.findIndex, Math.floor(merged.highestFindIndex)),
    FINDS.length - 1,
  );

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
  merged.mailReady = parsed.mailReady === true;
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
