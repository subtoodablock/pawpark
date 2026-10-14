import type { AutomationKey, GameEvent, GameState, Stat } from './types';
import {
  AUTOMATION_MAX_BUYS,
  AUTO_PRESTIGE_MIN_RUN_SEC,
  AUTO_SPLURGE_FRACTION,
  KENNELS,
  KENNEL_SLOTS,
  TRAINING,
  TRAINING_TIERS,
  VEHICLES,
} from '../data';
import { prestige, upgradeFind } from './actions';
import { computeStats, costMultiplier } from './stats';

export interface AutomationResult {
  events: GameEvent[];
  /** kennel / vehicle / training purchases made */
  purchases: number;
}

interface Candidate {
  cost: number;
  inBucket: boolean;
  /** 0 kennel, 1 vehicle, 2 training */
  kind: 0 | 1 | 2;
  /** slot index (kennel / vehicle) or training def index */
  idx: number;
  /** tier or level to set */
  to: number;
}

const SHIP_STATS: readonly Stat[] = ['shippingCapacity'];
const KENNEL_STATS: readonly Stat[] = ['kennelCapacity'];
const GROWTH_STATS: readonly Stat[] = ['layRate', 'findValue', 'rescueRate', 'adoptionRefill', 'adoptionCap'];

function isOn(state: GameState, unlocked: Record<AutomationKey, boolean>, key: AutomationKey): boolean {
  return state.automation[key] && unlocked[key];
}

function upgradeFinds(state: GameState, events: GameEvent[]): void {
  for (;;) {
    const before = state.highestFindIndex;
    if (!upgradeFind(state).ok) return;
    events.push({
      type: 'findUnlocked',
      findIndex: state.findIndex,
      auto: true,
      firstTime: state.highestFindIndex > before,
    });
  }
}

/** The purchase loop (§3.3 step 2). Returns the number of buys. */
function buyLoop(state: GameState): number {
  let buys = 0;
  while (buys < AUTOMATION_MAX_BUYS) {
    const s = computeStats(state);
    const build = isOn(state, s.automationUnlocked, 'build');
    const train = isOn(state, s.automationUnlocked, 'training');
    if (!build && !train) break;

    let bucketStats: readonly Stat[];
    let bucketKennels = false;
    let bucketVehicles = false;
    if (s.bottleneck === 'ship') {
      bucketVehicles = true;
      bucketStats = SHIP_STATS;
    } else if (state.pups >= 0.9 * s.kennelCapacity) {
      bucketKennels = true;
      bucketStats = KENNEL_STATS;
    } else {
      bucketStats = GROWTH_STATS;
    }

    const cands: Candidate[] = [];
    if (build) {
      const kMult = costMultiplier(state, 'kennelDiscount');
      for (let slot = 0; slot < KENNEL_SLOTS; slot++) {
        const cur = state.kennels[slot];
        const next = cur === null || cur === undefined ? 0 : cur + 1;
        if (next >= KENNELS.length) continue;
        cands.push({
          cost: KENNELS[next].cost * kMult,
          inBucket: bucketKennels,
          kind: 0,
          idx: slot,
          to: next,
        });
      }
      const vMult = costMultiplier(state, 'fleetDiscount');
      const slots = Math.min(s.fleetSlots, state.vehicles.length);
      for (let slot = 0; slot < slots; slot++) {
        const cur = state.vehicles[slot];
        const next = cur === null || cur === undefined ? 0 : cur + 1;
        if (next >= VEHICLES.length) continue;
        cands.push({
          cost: VEHICLES[next].cost * vMult,
          inBucket: bucketVehicles,
          kind: 1,
          idx: slot,
          to: next,
        });
      }
    }
    if (train) {
      const tMult = costMultiplier(state, 'researchDiscount');
      for (let d = 0; d < TRAINING.length; d++) {
        const def = TRAINING[d];
        const level = state.training[def.id] ?? 0;
        if (level >= def.maxLevel) continue;
        const tier = TRAINING_TIERS.find((t) => t.tier === def.tier);
        if (!tier || s.totalTrainingLevels < tier.unlockAt) continue;
        cands.push({
          cost: def.baseCost * Math.pow(def.costGrowth, level) * tMult,
          inBucket: bucketStats.includes(def.stat),
          kind: 2,
          idx: d,
          to: level + 1,
        });
      }
    }
    if (cands.length === 0) break;

    let cheapestBucket = Infinity;
    let pick: Candidate | null = null;
    let cheapestAffordable: Candidate | null = null;
    for (const c of cands) {
      if (c.inBucket && c.cost < cheapestBucket) cheapestBucket = c.cost;
      if (c.cost <= state.cash && (!cheapestAffordable || c.cost < cheapestAffordable.cost)) {
        cheapestAffordable = c;
      }
    }
    if (cheapestBucket !== Infinity) {
      if (cheapestBucket <= state.cash) {
        for (const c of cands) {
          if (c.inBucket && c.cost === cheapestBucket) {
            pick = c;
            break;
          }
        }
      } else if (cheapestAffordable && cheapestAffordable.cost <= AUTO_SPLURGE_FRACTION * cheapestBucket) {
        pick = cheapestAffordable;
      }
    } else {
      // nothing left in the priority bucket: spend on whatever is cheapest
      pick = cheapestAffordable;
    }
    if (!pick) break;
    // same math as buyKennel / buyVehicle / buyTraining; validity was checked above
    state.cash -= pick.cost;
    if (pick.kind === 0) state.kennels[pick.idx] = pick.to;
    else if (pick.kind === 1) state.vehicles[pick.idx] = pick.to;
    else state.training[TRAINING[pick.idx].id] = pick.to;
    buys++;
  }
  return buys;
}

/** One automation pass (spec §3.3). Deterministic, no RNG. */
export function automate(state: GameState): AutomationResult {
  const events: GameEvent[] = [];
  let purchases = 0;

  const restart = () => {
    const s = computeStats(state);
    if (isOn(state, s.automationUnlocked, 'find')) upgradeFinds(state, events);
    purchases += buyLoop(state);
  };
  restart();

  const s = computeStats(state);
  if (isOn(state, s.automationUnlocked, 'prestige') && state.runTimeSec >= AUTO_PRESTIGE_MIN_RUN_SEC) {
    const need = Math.max(1, state.automation.prestigeThreshold * state.spiritPaws);
    if (s.prestigeGain >= need) {
      const r = prestige(state);
      if (r.ok) {
        events.push({ type: 'autoPrestige', gained: r.gained ?? 0 });
        restart();
      }
    }
  }
  return { events, purchases };
}

export function runAutomation(state: GameState): GameEvent[] {
  return automate(state).events;
}
