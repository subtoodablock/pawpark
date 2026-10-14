import type { ActionResult, AutomationKey, FindDef, GameState, RewardResult, Rng } from './types';
import {
  ACADEMY,
  AUTO_PRESTIGE_THRESHOLDS,
  FINDS,
  KENNELS,
  KENNEL_SLOTS,
  MAIL_BONES_CHANCE,
  MAIL_BONES_MAX,
  MAIL_BONES_MIN,
  MAIL_CASH_CHANCE,
  MAIL_CASH_SECONDS,
  MIN_SQUIRREL_CASH_RATE,
  TRAINING,
  TRAINING_TIERS,
  TREATS,
  VEHICLES,
} from '../data';
import { computeStats, costMultiplier } from './stats';
import { bumpCounter } from './counters';
import { resetForPrestige } from './state';

// ---------------------------------------------------------------- helpers

const fail = (reason: string): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Adds a treat, or extends the remaining time if it is already active. */
export function addTreat(state: GameState, treatId: string, durationSec: number): void {
  const existing = state.treats.find((t) => t.id === treatId);
  if (existing) existing.remaining += durationSec;
  else state.treats.push({ id: treatId, remaining: durationSec });
}

const isSlot = (slot: number, n: number) => Number.isInteger(slot) && slot >= 0 && slot < n;

// ---------------------------------------------------------------- adopt

export function adopt(state: GameState, n: number, fromTap: boolean): number {
  const s = computeStats(state);
  const k = Math.min(Math.floor(n), Math.floor(state.adoptionStock), Math.floor(s.kennelCapacity - state.pups));
  if (!(k > 0)) return 0;
  state.pups += k;
  state.adoptionStock -= k;
  state.stats.totalAdopted += k;
  if (fromTap) {
    state.stats.totalTaps += 1;
    bumpCounter(state, 'whistle', k);
    const before = state.zoomies;
    state.zoomies = Math.min(s.maxZoomies, state.zoomies + k);
    if (before < s.maxZoomies && state.zoomies >= s.maxZoomies) bumpCounter(state, 'zoomies');
    state.zoomieIdle = 0;
  }
  return k;
}

// ---------------------------------------------------------------- costs

function nextTier(current: number | null | undefined, tierCount: number): number | null {
  const next = current === null || current === undefined ? 0 : current + 1;
  return next < tierCount ? next : null;
}

export function kennelUpgradeCost(state: GameState, slot: number): number | null {
  if (!isSlot(slot, KENNEL_SLOTS)) return null;
  const next = nextTier(state.kennels[slot], KENNELS.length);
  if (next === null) return null;
  return KENNELS[next].cost * costMultiplier(state, 'kennelDiscount');
}

export function vehicleUpgradeCost(state: GameState, slot: number): number | null {
  const s = computeStats(state);
  if (!isSlot(slot, s.fleetSlots)) return null;
  const next = nextTier(state.vehicles[slot], VEHICLES.length);
  if (next === null) return null;
  return VEHICLES[next].cost * costMultiplier(state, 'fleetDiscount');
}

export function trainingCost(state: GameState, id: string): number | null {
  const def = TRAINING.find((d) => d.id === id);
  if (!def) return null;
  const level = state.training[id] ?? 0;
  if (level >= def.maxLevel) return null;
  return def.baseCost * Math.pow(def.costGrowth, level) * costMultiplier(state, 'researchDiscount');
}

export function isTrainingTierUnlocked(state: GameState, tier: number): boolean {
  const t = TRAINING_TIERS.find((x) => x.tier === tier);
  if (!t) return false;
  return computeStats(state).totalTrainingLevels >= t.unlockAt;
}

/** How many levels of a training item can be bought right now, and what they cost. */
export function trainingMaxBuy(state: GameState, id: string): { levels: number; cost: number } {
  const def = TRAINING.find((d) => d.id === id);
  if (!def || !isTrainingTierUnlocked(state, def.tier)) return { levels: 0, cost: 0 };
  const mult = costMultiplier(state, 'researchDiscount');
  let level = state.training[id] ?? 0;
  let levels = 0;
  let cost = 0;
  while (level < def.maxLevel) {
    const c = def.baseCost * Math.pow(def.costGrowth, level) * mult;
    if (cost + c > state.cash) break;
    cost += c;
    level++;
    levels++;
  }
  return { levels, cost };
}

export function academyCost(state: GameState, id: string): number | null {
  const def = ACADEMY.find((d) => d.id === id);
  if (!def) return null;
  const level = state.academy[id] ?? 0;
  if (level >= def.maxLevel) return null;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
}

export function nextFind(state: GameState): FindDef | null {
  return FINDS[state.findIndex + 1] ?? null;
}

// ---------------------------------------------------------------- purchases

function buySlot(
  state: GameState,
  slots: (number | null)[],
  slot: number,
  cost: number | null,
  noun: string,
): ActionResult {
  if (cost === null) return fail(`${noun} is already at the top tier.`);
  if (state.cash < cost) return fail(`Not enough cash for this ${noun.toLowerCase()}.`);
  state.cash -= cost;
  const cur = slots[slot];
  slots[slot] = cur === null || cur === undefined ? 0 : cur + 1;
  bumpCounter(state, 'buildings');
  return OK;
}

export function buyKennel(state: GameState, slot: number): ActionResult {
  if (!isSlot(slot, KENNEL_SLOTS)) return fail('No such kennel slot.');
  return buySlot(state, state.kennels, slot, kennelUpgradeCost(state, slot), 'Kennel');
}

export function buyVehicle(state: GameState, slot: number): ActionResult {
  if (!isSlot(slot, state.vehicles.length)) return fail('No such fleet slot.');
  if (slot >= computeStats(state).fleetSlots) return fail('Fleet slot locked. Buy Fleet Expansion training.');
  return buySlot(state, state.vehicles, slot, vehicleUpgradeCost(state, slot), 'Vehicle');
}

export function buyTraining(state: GameState, id: string, levels = 1): ActionResult {
  const def = TRAINING.find((d) => d.id === id);
  if (!def) return fail('Unknown training.');
  const tier = TRAINING_TIERS.find((t) => t.tier === def.tier);
  if (!tier || computeStats(state).totalTrainingLevels < tier.unlockAt) {
    return fail('This training tier is locked.');
  }
  const current = state.training[id] ?? 0;
  if (current >= def.maxLevel) return fail('Already at max level.');
  if (!(levels >= 1)) return fail('Invalid amount.');

  let n: number;
  let total: number;
  if (levels === Infinity) {
    const m = trainingMaxBuy(state, id);
    if (m.levels < 1) return fail('Not enough cash.');
    n = m.levels;
    total = m.cost;
  } else {
    n = Math.min(Math.floor(levels), def.maxLevel - current);
    const mult = costMultiplier(state, 'researchDiscount');
    total = 0;
    for (let i = 0; i < n; i++) total += def.baseCost * Math.pow(def.costGrowth, current + i) * mult;
    if (state.cash < total) return fail('Not enough cash.');
  }
  state.cash -= total;
  state.training[id] = current + n;
  bumpCounter(state, 'training', n);
  return OK;
}

/** Academy stats whose first level unlocks (and switches on) an automation. */
const AUTOMATION_UNLOCK_STATS: Partial<Record<string, AutomationKey>> = {
  autoBuild: 'build',
  autoTraining: 'training',
  autoWhistle: 'whistle',
  autoPrestige: 'prestige',
};

export function buyAcademy(state: GameState, id: string): ActionResult {
  const def = ACADEMY.find((d) => d.id === id);
  if (!def) return fail('Unknown academy course.');
  const cost = academyCost(state, id);
  if (cost === null) return fail('Already at max level.');
  if (state.goldenBones < cost) return fail('Not enough Golden Bones.');
  state.goldenBones -= cost;
  const level = (state.academy[id] ?? 0) + 1;
  state.academy[id] = level;
  const key = AUTOMATION_UNLOCK_STATS[def.stat];
  if (key && level === 1) state.automation[key] = true;
  return OK;
}

export function upgradeFind(state: GameState): ActionResult {
  const next = nextFind(state);
  if (!next) return fail('You already dig up the best find.');
  if (computeStats(state).parkValue < next.unlockParkValue) return fail('Park Value is too low.');
  state.findIndex += 1;
  if (state.findIndex > state.highestFindIndex) {
    state.highestFindIndex = state.findIndex;
    state.goldenBones += next.unlockReward;
  }
  return OK;
}

export function buyTreat(
  state: GameState,
  id: string,
  currency: 'bones' | 'stars' = 'bones',
): ActionResult {
  const def = TREATS.find((t) => t.id === id);
  if (!def) return fail('Unknown treat.');
  if (currency === 'stars') {
    if (state.premium.stars < def.starCost) return fail('Not enough Pup Stars.');
    state.premium.stars -= def.starCost;
  } else {
    if (state.goldenBones < def.cost) return fail('Not enough Golden Bones.');
    state.goldenBones -= def.cost;
  }
  addTreat(state, id, def.durationSec);
  bumpCounter(state, 'treat');
  return OK;
}

// ---------------------------------------------------------------- squirrels & mail

export function catchSquirrel(state: GameState, squirrelId: number): RewardResult | null {
  const idx = state.squirrels.findIndex((q) => q.id === squirrelId);
  if (idx < 0) return null;
  const [sq] = state.squirrels.splice(idx, 1);
  state.stats.squirrelsCaught += 1;
  bumpCounter(state, 'squirrels');
  const r = sq.reward;
  if (r.kind === 'cash') {
    const rate = Math.max(computeStats(state).incomePerSec, MIN_SQUIRREL_CASH_RATE);
    const amount = rate * r.incomeSeconds;
    state.cash += amount;
    return { kind: 'cash', amount };
  }
  if (r.kind === 'goldenBones') {
    state.goldenBones += r.amount;
    return { kind: 'goldenBones', amount: r.amount };
  }
  addTreat(state, r.treatId, r.durationSec);
  return { kind: 'treat', treatId: r.treatId, durationSec: r.durationSec };
}

export function openMail(state: GameState, rng: Rng = Math.random): RewardResult | null {
  if (!(state.mailCount > 0)) return null;
  state.mailCount -= 1;
  state.stats.mailOpened += 1;
  bumpCounter(state, 'letters');
  const roll = rng();
  if (roll < MAIL_BONES_CHANCE) {
    const amount = randInt(rng, MAIL_BONES_MIN, MAIL_BONES_MAX);
    state.goldenBones += amount;
    return { kind: 'goldenBones', amount };
  }
  if (roll < MAIL_CASH_CHANCE) {
    const amount = Math.max(computeStats(state).incomePerSec, MIN_SQUIRREL_CASH_RATE) * MAIL_CASH_SECONDS;
    state.cash += amount;
    return { kind: 'cash', amount };
  }
  const def = TREATS[Math.floor(rng() * TREATS.length)];
  addTreat(state, def.id, def.durationSec);
  return { kind: 'treat', treatId: def.id, durationSec: def.durationSec };
}

export function openAllMail(state: GameState, rng: Rng = Math.random): RewardResult[] {
  const out: RewardResult[] = [];
  while (state.mailCount > 0) {
    const r = openMail(state, rng);
    if (!r) break;
    out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- automation settings

const AUTOMATION_KEYS: readonly AutomationKey[] = ['find', 'build', 'training', 'whistle', 'prestige'];

export function setAutomation(state: GameState, key: AutomationKey, enabled: boolean): ActionResult {
  if (!AUTOMATION_KEYS.includes(key)) return fail('Unknown automation.');
  if (typeof enabled !== 'boolean') return fail('Invalid setting.');
  if (!computeStats(state).automationUnlocked[key]) return fail('This helper is not unlocked yet.');
  state.automation[key] = enabled;
  return OK;
}

export function setAutoPrestigeThreshold(state: GameState, t: number): ActionResult {
  if (!AUTO_PRESTIGE_THRESHOLDS.includes(t)) return fail('Invalid threshold.');
  state.automation.prestigeThreshold = t;
  return OK;
}

// ---------------------------------------------------------------- prestige

export function prestige(state: GameState): ActionResult & { gained?: number } {
  const gain = computeStats(state).prestigeGain;
  if (!(gain >= 1)) return fail('Earn more before opening a new park.');
  state.spiritPaws += gain;
  state.prestigeCount += 1;
  resetForPrestige(state);
  return { ok: true, gained: gain };
}
