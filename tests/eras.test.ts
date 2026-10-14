import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DUPLICATE_GROWTH_BY_TIER, VEHICLE_DUPLICATE_GROWTH_BY_TIER, MAX_COST_SCALE, ERA_START_CASH, FINDS, KENNELS, SAVE_VERSION, TRAINING, VEHICLES,
  applyOfflineProgress, buyKennel, buyTraining, buyVehicle, computeStats, deserialize, kennelUpgradeCost,
  nextFind, prestige, runAutomation, serialize, trainingCost, trainingMaxBuy, upgradeFind,
  vehicleUpgradeCost, academyCost, PRESTIGE_DIVISOR, PRESTIGE_EXP_EARLY, START_CASH,
} from '../src/core';
import type { GameState } from '../src/core';
import { newState } from './helpers';

const COMFY = TRAINING.find((d) => d.id === 'comfy_beds')!;

/** A park rich enough to pass the Tennis Ball gate, with some state in every reset/kept category. */
function ready(): GameState {
  const s = newState();
  s.squirrelTimer = 1e9;
  s.mailTimer = 1e9;
  s.pups = 200;
  s.kennels = [3, 2, null, null];
  s.vehicles = [5, 5, 5, 5, ...new Array(8).fill(null)];
  s.training = { comfy_beds: COMFY.maxLevel, premium_kibble: 15 };
  s.cash = 12345;
  s.zoomies = 7;
  s.adoptionStock = 3;
  return s;
}

describe('find data', () => {
  it('v5 prices are flat: costScale is 1 in every era (an optional tax of at most MAX_COST_SCALE)', () => {
    for (const f of FINDS) {
      expect(f.costScale).toBeGreaterThanOrEqual(1);
      expect(f.costScale).toBeLessThanOrEqual(MAX_COST_SCALE);
      expect(f.costScale).toBe(1);
    }
  });
  it('computeStats exposes the era costScale', () => {
    const s = newState();
    s.findIndex = 3;
    expect(computeStats(s).costScale).toBe(FINDS[3].costScale);
  });
});

describe('upgradeFind era reset', () => {
  it('resets the park and keeps run/meta state', () => {
    const s = ready();
    s.runEarnings = 777;
    s.runTimeSec = 321;
    s.lifetimeEarnings = 999;
    s.spiritPaws = 4;
    s.legendCollars = 1;
    s.academy = { kennel_deals: 1 };
    s.treats = [{ id: 'bacon_strip', remaining: 50 }];
    s.squirrels = [{ id: 9, age: 1, lifetime: 7, reward: { kind: 'cash', incomeSeconds: 60 } }];
    s.mailCount = 2;
    s.trophies = ['x'];
    s.automation.build = true;
    s.daily.streak = 3;
    s.premium.stars = 12;
    const bones = s.goldenBones;
    const next = nextFind(s)!;
    expect(upgradeFind(s).ok).toBe(true);
    // reset
    expect(s.findIndex).toBe(1);
    expect(s.cash).toBe(ERA_START_CASH * next.costScale);
    expect(s.pups).toBe(0);
    expect(s.kennels).toEqual([0, null, null, null]);
    expect(s.vehicles).toEqual([0, ...new Array(11).fill(null)]);
    expect(s.training).toEqual({});
    expect(s.zoomies).toBe(0);
    expect(s.adoptionStock).toBe(computeStats(s).adoptionCap);
    // kept
    expect(s.runEarnings).toBe(777);
    expect(s.runTimeSec).toBe(321);
    expect(s.lifetimeEarnings).toBe(999);
    expect(s.spiritPaws).toBe(4);
    expect(s.legendCollars).toBe(1);
    expect(s.academy).toEqual({ kennel_deals: 1 });
    expect(s.treats).toEqual([{ id: 'bacon_strip', remaining: 50 }]);
    expect(s.squirrels).toHaveLength(1);
    expect(s.mailCount).toBe(2);
    expect(s.trophies).toEqual(['x']);
    expect(s.automation.build).toBe(true);
    expect(s.daily.streak).toBe(3);
    expect(s.premium.stars).toBe(12);
    expect(s.goldenBones).toBe(bones + next.unlockReward);
  });

  it('adoption stock refills to a cap computed after the reset', () => {
    const s = ready();
    s.academy = {};
    upgradeFind(s);
    expect(s.adoptionStock).toBe(computeStats(s).adoptionCap);
    expect(s.adoptionStock).toBeGreaterThanOrEqual(50);
  });

  it('stake cash equals one era-priced doghouse and rebuilds from the free tier-0 slots', () => {
    const s = ready();
    upgradeFind(s);
    const k = FINDS[1].costScale;
    expect(s.cash).toBe(ERA_START_CASH * k);
    s.kennels = [null, null, null, null];
    expect(buyKennel(s, 0).ok).toBe(true);
    expect(s.cash).toBeCloseTo(ERA_START_CASH * k - KENNELS[0].cost * k, 6);
  });

  it('prestige gain counts every era of the run', () => {
    const s = ready();
    s.runEarnings = PRESTIGE_DIVISOR * 10;
    upgradeFind(s);
    expect(s.runEarnings).toBe(PRESTIGE_DIVISOR * 10);
    s.runEarnings += PRESTIGE_DIVISOR * 90;
    const gain = Math.floor((100) ** PRESTIGE_EXP_EARLY);
    expect(computeStats(s).prestigeGain).toBe(gain);
    expect(prestige(s)).toEqual({ ok: true, gained: gain });
    expect(s.findIndex).toBe(0);
    expect(s.runEarnings).toBe(0);
    expect(s.runTimeSec).toBe(0);
    expect(s.cash).toBe(START_CASH);
    expect(s.highestFindIndex).toBe(1);
  });
});

describe('era cost scaling (engine still supports a costScale tax)', () => {
  const saved = FINDS.map((f) => f.costScale);
  beforeEach(() => FINDS.forEach((f, i) => { if (i > 0) f.costScale = 1 + 0.1 * i; }));
  afterEach(() => FINDS.forEach((f, i) => { f.costScale = saved[i]; }));
  function atEra(k: number): GameState {
    const s = newState();
    s.findIndex = k;
    s.kennels = [null, null, null, null];
    s.vehicles = new Array(12).fill(null);
    return s;
  }
  it('scales kennel, vehicle and training prices', () => {
    const e = FINDS[4].costScale;
    const s = atEra(4);
    expect(kennelUpgradeCost(s, 0)).toBeCloseTo(KENNELS[0].cost * e, 6);
    expect(vehicleUpgradeCost(s, 0)).toBeCloseTo(VEHICLES[0].cost * e, 6);
    expect(trainingCost(s, 'comfy_beds')).toBeCloseTo(COMFY.baseCost * e, 6);
  });
  it('scales purchases themselves', () => {
    const e = FINDS[2].costScale;
    const s = atEra(2);
    s.cash = 1e9;
    buyKennel(s, 0);
    expect(1e9 - s.cash).toBeCloseTo(KENNELS[0].cost * e, 4);
    s.cash = 1e9;
    buyVehicle(s, 0);
    expect(1e9 - s.cash).toBeCloseTo(VEHICLES[0].cost * e, 4);
    s.cash = 1e9;
    buyTraining(s, 'comfy_beds', 3);
    const want = COMFY.baseCost * (1 + COMFY.costGrowth + COMFY.costGrowth ** 2) * e;
    expect(1e9 - s.cash).toBeCloseTo(want, 4);
  });
  it('scales trainingMaxBuy', () => {
    const e = FINDS[2].costScale;
    const s = atEra(2);
    s.cash = COMFY.baseCost * e * 2.4; // level 1 at base, level 2 at 1.5x: only 1 affordable
    const m = trainingMaxBuy(s, 'comfy_beds');
    expect(m.levels).toBe(1);
    expect(m.cost).toBeCloseTo(COMFY.baseCost * e, 6);
    s.cash = COMFY.baseCost * e - 1;
    expect(trainingMaxBuy(s, 'comfy_beds').levels).toBe(0);
  });
  it('applies scale before the discount', () => {
    const e = FINDS[2].costScale;
    const s = atEra(2);
    s.academy = { bargain_hunter: 2 };
    const plain = atEra(2);
    expect(trainingCost(s, 'comfy_beds')! / trainingCost(plain, 'comfy_beds')!).toBeLessThan(1);
    expect(trainingCost(plain, 'comfy_beds')).toBeCloseTo(COMFY.baseCost * e, 6);
  });
  it('does not scale bones/academy prices', () => {
    const s = newState();
    s.goldenBones = 1e6;
    const a = ACADEMY_COST(s);
    s.findIndex = 5;
    expect(ACADEMY_COST(s)).toBe(a);
  });
  it('automation pays era-scaled prices (training, kennel, vehicle)', () => {
    const e = FINDS[3].costScale;
    const s = atEra(3);
    s.squirrelTimer = 1e9;
    s.mailTimer = 1e9;
    s.academy = { foreman_pup: 1, head_trainer: 1 };
    s.automation = { ...s.automation, find: false, build: true, training: true };
    s.kennels = [0, null, null, null];
    s.vehicles = [0, ...new Array(11).fill(null)];
    s.pups = 10;
    // too poor for any base-priced thing times e: cheapest is comfy_beds at 25*e
    s.cash = COMFY.baseCost * e - 1;
    runAutomation(s);
    expect(s.training).toEqual({});
    expect(s.cash).toBe(COMFY.baseCost * e - 1);
    s.cash = COMFY.baseCost * e + 0.5;
    runAutomation(s);
    expect(s.training.comfy_beds).toBe(1);
    expect(s.cash).toBeCloseTo(0.5, 4);
  });
});

const ACADEMY_COST = (s: GameState): number => academyCost(s, 'kennel_deals')!;

const DG = (t: number) => DUPLICATE_GROWTH_BY_TIER[t];
const VG = (t: number) => VEHICLE_DUPLICATE_GROWTH_BY_TIER[t];

describe('duplicate-tier pricing', () => {
  it('kennels: x DUPLICATE_GROWTH_BY_TIER[t] per other slot holding tier >= t', () => {
    const s = newState();
    s.kennels = [0, null, null, null];
    expect(kennelUpgradeCost(s, 1)).toBeCloseTo(KENNELS[0].cost * DG(0), 8);
    s.kennels = [0, 0, null, null];
    expect(kennelUpgradeCost(s, 2)).toBeCloseTo(KENNELS[0].cost * DG(0) ** 2, 8);
    // upgrading slot 0 to tier 1: slot 1 holds tier 0 < 1, so no duplicate
    expect(kennelUpgradeCost(s, 0)).toBeCloseTo(KENNELS[1].cost, 8);
    // higher tiers elsewhere count too (tier >= t)
    s.kennels = [0, 2, 1, null];
    expect(kennelUpgradeCost(s, 3)).toBeCloseTo(KENNELS[0].cost * DG(0) ** 3, 8);
    expect(kennelUpgradeCost(s, 0)).toBeCloseTo(KENNELS[1].cost * DG(1) ** 2, 8);
  });
  it('vehicles: same rule', () => {
    const s = newState();
    s.vehicles = [0, 1, null, null, ...new Array(8).fill(null)];
    expect(vehicleUpgradeCost(s, 2)).toBeCloseTo(VEHICLES[0].cost * VG(0) ** 2, 8);
    expect(vehicleUpgradeCost(s, 0)).toBeCloseTo(VEHICLES[1].cost * VG(1), 8);
    expect(vehicleUpgradeCost(s, 1)).toBeCloseTo(VEHICLES[2].cost, 8);
  });
  it('is charged by the buy and composes with era scale and discount', () => {
    const s = newState();
    s.findIndex = 1;
    s.kennels = [0, null, null, null];
    s.academy = { kennel_deals: 2 };
    const cost = kennelUpgradeCost(s, 1)!;
    s.cash = cost;
    expect(buyKennel(s, 1).ok).toBe(true);
    expect(s.cash).toBeCloseTo(0, 6);
    expect(cost).toBeLessThan(KENNELS[0].cost * FINDS[1].costScale * DG(0));
  });
});

describe('offline across eras', () => {
  it('auto-find crosses eras and still records first-time finds', () => {
    const s = newState();
    s.squirrelTimer = 1e9;
    s.mailTimer = 1e9;
    s.academy = { foreman_pup: 1, head_trainer: 1, retirement_planner: 1, kennel_deals: 0 };
    s.automation = { ...s.automation, find: true, build: true, training: true };
    s.cash = 5e4;
    s.pups = 50;
    s.premium.shop = { treat_jar: 0 } as Record<string, number>;
    s.lastSaved = 0;
    const r = applyOfflineProgress(s, 8 * 3600 * 1000)!;
    expect(s.findIndex).toBeGreaterThanOrEqual(2);
    expect(r.findsUnlocked.length).toBe(s.highestFindIndex);
    expect(r.findsUnlocked).toEqual(Array.from({ length: s.highestFindIndex }, (_, i) => i + 1));
    expect(s.runEarnings).toBeGreaterThan(s.lifetimeEarnings * 0.99);
    expect(s.runEarnings).toBeGreaterThan(FINDS[1].unlockParkValue * 0.1);
  });
});

describe('save v5', () => {
  it('SAVE_VERSION is 5 and v3 saves migrate', () => {
    expect(SAVE_VERSION).toBe(5);
    const v3 = JSON.parse(serialize(ready()));
    v3.version = 3;
    const g = deserialize(JSON.stringify(v3))!;
    expect(g.version).toBe(5);
    expect(g.kennels).toEqual(v3.kennels);
    expect(g.cash).toBe(v3.cash);
    expect(g.findIndex).toBe(v3.findIndex);
  });
  it('round-trips and rejects unknown versions', () => {
    const s = ready();
    expect(deserialize(serialize(s))).toEqual(s);
    expect(deserialize(JSON.stringify({ ...s, version: 6 }))).toBeNull();
  });
});
