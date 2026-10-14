import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ACADEMY, BASE_MAX_CARS, BASE_OFFLINE_HOURS, BASE_RESCUE_PER_MIN, CALENDAR_COLLAR_STREAK, CAR_COST_GROWTH,
  DISCOVER_DIVISOR, DUPLICATE_GROWTH_BY_TIER, FINDS, KENNELS, MAX_FLEET_SLOTS, PARK_VALUE_SECONDS, PRESTIGE_DIVISOR,
  PRESTIGE_EXP_EARLY, PRESTIGE_EXP_LATE, PRESTIGE_KNEE, PUP_RANK_TITLES, SAVE_VERSION, TRAINING,
  TRAINING_TIERS, VEHICLES, VEHICLE_DUPLICATE_GROWTH_BY_TIER, applyOfflineProgress, buySledCar, claimDailyTreat,
  buyVehicle, computeStats, deserialize, prestige, kennelTierCost, kennelUpgradeCost, prestigeGainFor, pupRankFor, resetPark, runAutomation,
  serialize, sledCarCost, statValue, stepSimulation, tick, upgradeFind, vehicleTierCost, vehicleUpgradeCost,
} from '../src/core';
import type { GameState } from '../src/core';
import { constRng, lockGates, newState, restoreGates } from './helpers';

const TOP = VEHICLES.length - 1;
const sig3 = (x: number) => Number(x.toPrecision(3));
const def = (id: string) => TRAINING.find((d) => d.id === id)!;

function quiet(s: GameState): GameState {
  s.squirrelTimer = 1e9;
  s.mailTimer = 1e9;
  return s;
}

describe('flat prices and ladders (§1, §2.1)', () => {
  it('every Find has costScale 1 and prices do not change across eras', () => {
    for (const f of FINDS) expect(f.costScale).toBe(1);
    const a = newState();
    a.kennels = [0, 1, null, null];
    const b = newState();
    b.kennels = [0, 1, null, null];
    b.findIndex = 9;
    expect(computeStats(b).costScale).toBe(1);
    expect(kennelUpgradeCost(b, 2)).toBe(kennelUpgradeCost(a, 2));
    expect(vehicleUpgradeCost(b, 0)).toBe(vehicleUpgradeCost(a, 0));
    expect(kennelTierCost(b, 3, 7)).toBe(kennelTierCost(a, 3, 7));
    expect(vehicleTierCost(b, 1, 5)).toBe(vehicleTierCost(a, 1, 5));
  });
  it('kennel ladder is 50 x 40^t and vehicle ladder 100 x 150^t, to 3 significant digits', () => {
    KENNELS.forEach((k, t) => expect(k.cost).toBe(sig3(50 * 40 ** t)));
    VEHICLES.forEach((v, t) => expect(v.cost).toBe(sig3(100 * 150 ** t)));
    expect(KENNELS).toHaveLength(18);
    expect(VEHICLES).toHaveLength(13);
    expect(KENNELS[17].cost).toBeGreaterThan(8e28);
    expect(KENNELS[17].cost).toBeLessThan(9e28);
  });
  it('duplicate growth is per tier: 1.35 low, rising to 3..5 for the top three tiers', () => {
    expect(DUPLICATE_GROWTH_BY_TIER).toHaveLength(KENNELS.length);
    expect(VEHICLE_DUPLICATE_GROWTH_BY_TIER).toHaveLength(VEHICLES.length);
    for (const arr of [DUPLICATE_GROWTH_BY_TIER, VEHICLE_DUPLICATE_GROWTH_BY_TIER]) {
      expect(arr[0]).toBe(1.35);
      for (let i = 1; i < arr.length; i++) expect(arr[i]).toBeGreaterThanOrEqual(arr[i - 1]);
      for (const g of arr.slice(-3)) {
        expect(g).toBeGreaterThanOrEqual(3);
        expect(g).toBeLessThanOrEqual(5);
      }
    }
  });
  it('the per-tier growth is what the cost functions apply (top tier)', () => {
    const s = newState();
    s.kennels = [17, null, null, null];
    expect(kennelUpgradeCost(s, 1)).toBeCloseTo(KENNELS[0].cost * DUPLICATE_GROWTH_BY_TIER[0], 8);
    expect(kennelTierCost(s, 1, 17)).toBeCloseTo(KENNELS[17].cost * DUPLICATE_GROWTH_BY_TIER[17], 4);
    s.vehicles = [TOP, ...new Array(11).fill(null)];
    expect(vehicleTierCost(s, 1, TOP)).toBeCloseTo(VEHICLES[TOP].cost * VEHICLE_DUPLICATE_GROWTH_BY_TIER[TOP], 4);
  });
});

describe('training: tiers 6-7, doublers, rescue line (§2.1, §2.4)', () => {
  it('tier gates are 0/12/40/85/130/185/250 and reachable', () => {
    expect(TRAINING_TIERS.map((t) => t.unlockAt)).toEqual([0, 12, 40, 85, 130, 185, 250]);
    const below7 = TRAINING.filter((d) => d.tier < 7).reduce((a, d) => a + d.maxLevel, 0);
    expect(below7).toBeGreaterThanOrEqual(250);
    for (const d of TRAINING) expect(TRAINING_TIERS.some((t) => t.tier === d.tier)).toBe(true);
  });
  it('tiers 6-7 hold ~10 items from ~1e22 to ~1e30', () => {
    const late = TRAINING.filter((d) => d.tier >= 6);
    expect(late.length).toBeGreaterThanOrEqual(10);
    expect(Math.min(...TRAINING.filter((d) => d.tier === 6).map((d) => d.baseCost))).toBeCloseTo(1e22, -21);
    expect(Math.min(...TRAINING.filter((d) => d.tier === 7).map((d) => d.baseCost))).toBeCloseTo(1e26, -25);
    const top = Math.max(...late.map((d) => d.baseCost * d.costGrowth ** (d.maxLevel - 1)));
    expect(top).toBeGreaterThan(1e29);
    expect(top).toBeLessThan(1e31);
  });
  it('has doublers across tiers 2-7 on mult stats', () => {
    const dbl = TRAINING.filter((d) => d.multPerLevel !== undefined);
    expect(dbl.length).toBeGreaterThanOrEqual(8);
    for (const t of [2, 3, 4, 5, 6, 7]) expect(dbl.some((d) => d.tier === t)).toBe(true);
    for (const d of dbl) {
      expect(d.multPerLevel).toBe(2);
      expect(d.maxLevel).toBeGreaterThanOrEqual(2);
      expect(d.maxLevel).toBeLessThanOrEqual(3);
      expect(['layRate', 'findValue', 'shippingCapacity']).toContain(d.stat);
    }
  });
  it('a doubler multiplies its stat by multPerLevel^level, on top of % items', () => {
    const s = newState();
    s.training = { double_digging: 2 };
    expect(statValue(s, 'layRate')).toBe(4);
    s.training = { double_digging: 1, comfy_beds: 5 };
    expect(statValue(s, 'layRate')).toBeCloseTo(2 * (1 + def('comfy_beds').perLevel * 5), 10);
    s.training = { master_appraisers: 3 };
    expect(statValue(s, 'findValue')).toBe(8);
    s.training = { bigger_trucks: 2 };
    expect(statValue(s, 'shippingCapacity')).toBe(4);
    s.training = {};
    expect(statValue(s, 'layRate')).toBe(1);
  });
  it('a doubler feeds income and park value', () => {
    const s = newState();
    s.pups = 100;
    s.kennels = [3, null, null, null];
    s.vehicles[0] = TOP;
    s.vehicleCars[0] = 1;
    const a = computeStats(s);
    s.training = { double_digging: 2 };
    const b = computeStats(s);
    expect(b.digPerPupPerSec / a.digPerPupPerSec).toBe(4);
    expect(b.parkValue / a.parkValue).toBeGreaterThan(3.9);
  });
  it('rescueMult items multiply rescue; rescue items exist in several tiers', () => {
    const items = TRAINING.filter((d) => d.stat === 'rescueMult');
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(new Set(items.map((d) => d.tier)).size).toBeGreaterThanOrEqual(3);
    const s = newState();
    const base = computeStats(s).rescuePerSec;
    s.training = { dispatch_desk: 2 };
    expect(statValue(s, 'rescueMult')).toBeCloseTo(1 + def('dispatch_desk').perLevel * 2, 10);
    expect(computeStats(s).rescuePerSec / base).toBeCloseTo(1 + def('dispatch_desk').perLevel * 2, 10);
  });
  it('Longer Sleds adds +5 sled cars', () => {
    const s = newState();
    expect(computeStats(s).maxCars).toBe(BASE_MAX_CARS);
    s.training = { longer_sleds: 1 };
    expect(statValue(s, 'sledCars')).toBe(5);
    expect(computeStats(s).maxCars).toBe(BASE_MAX_CARS + 5);
    expect(def('longer_sleds').tier).toBeGreaterThanOrEqual(6);
  });
});

describe('Calm Kennels: offline-only rescue boost (§2.4)', () => {
  const calm = ACADEMY.find((a) => a.id === 'calm_kennels')!;
  function park(): GameState {
    const s = quiet(newState());
    s.kennels = [3, null, null, null];
    s.pups = 0;
    return s;
  }
  it('is x3 at max level', () => {
    expect(calm.stat).toBe('offlineRescueMult');
    const s = newState();
    s.academy = { calm_kennels: calm.maxLevel };
    expect(statValue(s, 'offlineRescueMult')).toBeCloseTo(3, 10);
  });
  it('applies only offline; rescueMult applies always', () => {
    const rate = (BASE_RESCUE_PER_MIN * 1) / 60;
    const base = park();
    stepSimulation(base, 60, constRng(0.5), { offline: false });
    expect(base.pups).toBeCloseTo(rate * 60, 8);

    const calmOn = park();
    calmOn.academy = { calm_kennels: calm.maxLevel };
    stepSimulation(calmOn, 60, constRng(0.5), { offline: false });
    expect(calmOn.pups).toBeCloseTo(rate * 60, 8); // online: no Calm
    expect(computeStats(calmOn).rescuePerSec).toBeCloseTo(rate, 10);

    const off = park();
    off.academy = { calm_kennels: calm.maxLevel };
    stepSimulation(off, 60, constRng(0.5), { offline: true });
    expect(off.pups).toBeCloseTo(rate * 60 * 3, 8);

    const mult = park();
    mult.training = { dispatch_desk: 2 };
    const m = 1 + def('dispatch_desk').perLevel * 2;
    stepSimulation(mult, 60, constRng(0.5), { offline: false });
    expect(mult.pups).toBeCloseTo(rate * 60 * m, 8);
    mult.pups = 0;
    mult.academy = { calm_kennels: calm.maxLevel };
    stepSimulation(mult, 60, constRng(0.5), { offline: true });
    expect(mult.pups).toBeCloseTo(rate * 60 * m * 3, 8);
  });
  it('applyOfflineProgress uses Calm', () => {
    const a = lockedPark();
    const b = lockedPark();
    b.academy = { calm_kennels: calm.maxLevel };
    applyOfflineProgress(a, a.lastSaved + 600_000);
    applyOfflineProgress(b, b.lastSaved + 600_000);
    expect(b.pups).toBeCloseTo(a.pups * 3, 4);
    function lockedPark() {
      lockGates();
      const s = park();
      return s;
    }
    restoreGates();
  });
});

describe('Park Value (§2.2)', () => {
  function reference(s: GameState): number {
    const d = computeStats(s);
    const lay = statValue(s, 'layRate');
    const digPerPup = (6 / 60) * lay;
    const dig = s.pups * digPerPup;
    const shipFrac = dig > 0 ? Math.min(1, d.shipPerSec / dig) : 1;
    const empty = Math.max(0, d.kennelCapacity - s.pups);
    const rescuePerMinPerKennel = (BASE_RESCUE_PER_MIN + statValue(s, 'rescueRate')) * statValue(s, 'rescueMult');
    const offlineMin = (BASE_OFFLINE_HOURS + statValue(s, 'offlineHours')) * 60;
    const pop =
      s.pups * shipFrac + 0.2 * s.pups * (1 - shipFrac) + empty ** 0.6 + 0.25 * rescuePerMinPerKennel * d.builtKennels * offlineMin;
    const maxZoomieMult = 1 + d.maxZoomies * d.zoomieBonusPer;
    return d.findValue * digPerPup * d.earningsBonus * maxZoomieMult * pop * PARK_VALUE_SECONDS * statValue(s, 'earnings');
  }
  function rich(): GameState {
    const s = newState();
    s.kennels = [4, 3, 2, null];
    s.vehicles = [3, 2, ...new Array(10).fill(null)];
    s.pups = 3000;
    s.findIndex = 2;
    s.spiritPaws = 12;
    s.training = { comfy_beds: 4, premium_kibble: 6, rescue_program: 3, dispatch_desk: 2, zoomie_training: 2 };
    s.academy = { max_zoomies: 5, bigger_jar: 3 };
    return s;
  }
  it('matches the formula pieces', () => {
    const s = rich();
    expect(computeStats(s).parkValue).toBeCloseTo(reference(s), 3);
    const t = newState();
    expect(computeStats(t).parkValue).toBeCloseTo(reference(t), 6); // empty park: only empty space + rescue potential
    const u = rich();
    u.pups = 0;
    expect(computeStats(u).parkValue).toBeCloseTo(reference(u), 3);
  });
  it('uses MAX zoomies and ignores current zoomies and treats', () => {
    const s = rich();
    const a = computeStats(s).parkValue;
    s.zoomies = 17;
    s.treats = [{ id: 'bacon_strip', remaining: 100 }, { id: 'peanut_kong', remaining: 100 }];
    expect(computeStats(s).parkValue).toBe(a);
    s.academy.max_zoomies = 10;
    expect(computeStats(s).parkValue).toBeGreaterThan(a);
  });
  it('an unshipped surplus is worth 20%: shipping shortage lowers it, but never to zero', () => {
    const s = rich();
    s.vehicles = [TOP, ...new Array(11).fill(null)];
    s.vehicleCars[0] = 1;
    const shipped = computeStats(s).parkValue;
    s.vehicles = [null, ...new Array(11).fill(null)];
    const none = computeStats(s).parkValue;
    expect(none).toBeLessThan(shipped);
    expect(none).toBeGreaterThan(0);
  });
  it('rescue potential and empty space count with no pups', () => {
    const s = newState();
    s.pups = 0;
    expect(computeStats(s).parkValue).toBeGreaterThan(0);
    s.training = { dispatch_desk: 4 };
    const boosted = computeStats(s).parkValue;
    s.training = {};
    expect(boosted).toBeGreaterThan(computeStats(s).parkValue);
  });
  it('is independent of Calm Kennels (offline-only)', () => {
    const s = rich();
    const a = computeStats(s).parkValue;
    s.academy.calm_kennels = 10;
    expect(computeStats(s).parkValue).toBe(a);
  });
});

describe('gates and discovery (§2.3, §2.5)', () => {
  it('matches the table and is strictly monotonic', () => {
    const table = [0, 1.2e4, 2.3e5, 5.8e6, 2.3e8, 1.4e10, 1.4e12, 2.1e14, 5.3e16, 2.1e19, 1.3e22, 1e25, 1e28];
    expect(FINDS.map((f) => f.unlockParkValue)).toEqual(table);
    for (let i = 1; i < FINDS.length; i++) {
      expect(FINDS[i].unlockParkValue).toBeGreaterThan(FINDS[i - 1].unlockParkValue);
    }
  });
  describe('discoveredFind', () => {
    const saved = FINDS.map((f) => f.unlockParkValue);
    afterEach(() => FINDS.forEach((f, i) => (f.unlockParkValue = saved[i])));
    it('teases the next Find at gate / DISCOVER_DIVISOR', () => {
      expect(DISCOVER_DIVISOR).toBe(6.5);
      const s = newState();
      const pv = computeStats(s).parkValue;
      FINDS[1].unlockParkValue = pv * DISCOVER_DIVISOR * 1.01;
      expect(computeStats(s).discoveredFind).toBe(0);
      FINDS[1].unlockParkValue = pv * DISCOVER_DIVISOR * 0.99;
      expect(computeStats(s).discoveredFind).toBe(1);
    });
    it('only the next Find can be discovered through Park Value', () => {
      const s = newState();
      FINDS[1].unlockParkValue = Infinity;
      FINDS[2].unlockParkValue = 1;
      expect(computeStats(s).discoveredFind).toBe(0);
    });
    it('never drops below the highest Find ever reached', () => {
      const s = newState();
      s.highestFindIndex = 5;
      s.findIndex = 0;
      FINDS[6].unlockParkValue = Infinity;
      expect(computeStats(s).discoveredFind).toBe(5);
    });
  });
  it('upgradeFind still requires the full gate', () => {
    const s = newState();
    expect(upgradeFind(s).ok).toBe(false);
  });
});

describe('piecewise prestige (§2.5)', () => {
  it('uses the early exponent below the knee', () => {
    expect(PRESTIGE_EXP_EARLY).toBeCloseTo(0.3, 10);
    expect(prestigeGainFor(PRESTIGE_DIVISOR * 0.99)).toBe(0);
    expect(prestigeGainFor(PRESTIGE_DIVISOR)).toBe(1);
    expect(prestigeGainFor(1e9)).toBe(Math.floor((1e9 / PRESTIGE_DIVISOR) ** PRESTIGE_EXP_EARLY));
    expect(prestigeGainFor(1e12)).toBe(Math.floor((1e12 / PRESTIGE_DIVISOR) ** PRESTIGE_EXP_EARLY));
  });
  it('is continuous at the knee and flatter above it', () => {
    const at = (PRESTIGE_KNEE / PRESTIGE_DIVISOR) ** PRESTIGE_EXP_EARLY;
    expect(prestigeGainFor(PRESTIGE_KNEE)).toBe(Math.floor(at));
    expect(Math.abs(prestigeGainFor(PRESTIGE_KNEE * 1.0001) - prestigeGainFor(PRESTIGE_KNEE * 0.9999))).toBeLessThanOrEqual(1);
    const hi = prestigeGainFor(PRESTIGE_KNEE * 1e6);
    expect(hi).toBe(Math.floor(at * 1e6 ** PRESTIGE_EXP_LATE));
    // slope check: x100 earnings -> x(100^exp)
    const early = prestigeGainFor(1e11) / prestigeGainFor(1e9);
    expect(early).toBeGreaterThan(0.85 * 100 ** PRESTIGE_EXP_EARLY);
    expect(early).toBeLessThan(1.15 * 100 ** PRESTIGE_EXP_EARLY);
    expect(prestigeGainFor(1e22) / prestigeGainFor(1e20)).toBeCloseTo(100 ** PRESTIGE_EXP_LATE, 1);
  });
  it('is monotonic and exposed through computeStats', () => {
    let prev = 0;
    for (let e = 1e5; e < 1e30; e *= 3.7) {
      const g = prestigeGainFor(e);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
    const s = newState();
    s.runEarnings = 5e14;
    expect(computeStats(s).prestigeGain).toBe(prestigeGainFor(5e14));
  });
});

describe('Pup Rank (§2.6)', () => {
  it('floors log10 of the bonus percent, with exact boundaries', () => {
    expect(pupRankFor(1)).toBe(0);
    expect(pupRankFor(1.05)).toBe(0); // 5%
    expect(pupRankFor(1.0999)).toBe(0);
    expect(pupRankFor(1.1)).toBe(1); // 10%
    expect(pupRankFor(1.99)).toBe(1);
    expect(pupRankFor(2)).toBe(2); // 100%
    expect(pupRankFor(10.99)).toBe(2);
    expect(pupRankFor(11)).toBe(3); // 1000%
    expect(pupRankFor(1e6 + 1)).toBe(8);
  });
  it('titles', () => {
    expect(PUP_RANK_TITLES[0]).toBe('Pup');
    expect(PUP_RANK_TITLES[1]).toBe('Pup II');
    expect(PUP_RANK_TITLES[2]).toBe('Pup III');
    expect(PUP_RANK_TITLES[3]).toBe('Kilopup');
    expect(PUP_RANK_TITLES.at(-1)).toBe('Legendary Pup');
    for (const t of ['Megapup', 'Gigapup', 'Terapup', 'Petapup', 'Exapup', 'Zettapup', 'Yottapup']) {
      expect(PUP_RANK_TITLES).toContain(t);
    }
    const s = newState();
    expect(computeStats(s).pupRank).toBe(0);
    expect(computeStats(s).pupRankTitle).toBe('Pup');
    s.spiritPaws = 100; // EB 11 -> 1000% -> rank 3
    const d = computeStats(s);
    expect(d.pupRank).toBe(pupRankFor(d.earningsBonus));
    expect(d.pupRankTitle).toBe(PUP_RANK_TITLES[d.pupRank]);
    s.spiritPaws = 1e300;
    expect(computeStats(s).pupRankTitle).toBe('Legendary Pup');
  });
});

describe('sled cars (§2.7)', () => {
  function sled(cars = 1): GameState {
    const s = quiet(newState());
    s.vehicles[0] = TOP;
    s.vehicleCars[0] = cars;
    s.cash = 1e60;
    return s;
  }
  it('a slot reaching the top tier gets 1 car; lower tiers have 0', () => {
    const s = quiet(newState());
    s.vehicles[0] = TOP - 1;
    s.cash = 1e60;
    expect(s.vehicleCars[0]).toBe(0);
    expect(s.vehicleCars).toHaveLength(MAX_FLEET_SLOTS);
    // buyVehicle path
    expect(buyVehicle(s, 0).ok).toBe(true);
    expect(s.vehicles[0]).toBe(TOP);
    expect(s.vehicleCars[0]).toBe(1);
  });
  it('shipping = capacityPerMin x cars for the top tier', () => {
    const s = sled(1);
    const one = computeStats(s).shipPerSec;
    expect(one).toBeCloseTo(VEHICLES[TOP].capacityPerMin / 60, 4);
    s.vehicleCars[0] = 4;
    expect(computeStats(s).shipPerSec).toBeCloseTo(4 * one, 4);
    // other tiers ignore the car count
    const t = quiet(newState());
    t.vehicleCars[0] = 7;
    expect(computeStats(t).shipPerSec).toBeCloseTo(VEHICLES[0].capacityPerMin / 60, 8);
  });
  it('cost is topTierCost x CAR_COST_GROWTH^cars, capped by maxCars', () => {
    const s = sled(1);
    expect(sledCarCost(s, 0)).toBeCloseTo(VEHICLES[TOP].cost * CAR_COST_GROWTH, 4);
    s.vehicleCars[0] = 3;
    expect(sledCarCost(s, 0)).toBeCloseTo(VEHICLES[TOP].cost * CAR_COST_GROWTH ** 3, 4);
    s.vehicleCars[0] = BASE_MAX_CARS;
    expect(sledCarCost(s, 0)).toBeNull();
    s.training = { longer_sleds: 1 };
    expect(sledCarCost(s, 0)).not.toBeNull();
    s.vehicleCars[0] = BASE_MAX_CARS + 5;
    expect(sledCarCost(s, 0)).toBeNull();
  });
  it('is unavailable off the top tier, in locked or invalid slots', () => {
    const s = quiet(newState());
    expect(sledCarCost(s, 0)).toBeNull();
    expect(buySledCar(s, 0).ok).toBe(false);
    s.vehicles[8] = TOP; // locked slot (4 base slots)
    expect(sledCarCost(s, 8)).toBeNull();
    expect(buySledCar(s, 99).ok).toBe(false);
    expect(buySledCar(s, -1).ok).toBe(false);
  });
  it('buySledCar pays, adds a car, honours the cap and affordability', () => {
    const s = sled(1);
    const cost = sledCarCost(s, 0)!;
    const cash = s.cash;
    expect(buySledCar(s, 0).ok).toBe(true);
    expect(s.vehicleCars[0]).toBe(2);
    expect(cash - s.cash).toBeCloseTo(cost, -40);
    s.cash = 1;
    expect(buySledCar(s, 0).ok).toBe(false);
    expect(s.vehicleCars[0]).toBe(2);
    s.cash = 1e60;
    while (buySledCar(s, 0).ok) { /* fill */ }
    expect(s.vehicleCars[0]).toBe(BASE_MAX_CARS);
    expect(buySledCar(s, 0).ok).toBe(false);
  });
  it('fleet discount applies to cars', () => {
    const s = sled(1);
    const plain = sledCarCost(s, 0)!;
    s.academy = { fleet_deals: 5 };
    expect(sledCarCost(s, 0)).toBeLessThan(plain);
  });
  it('resets with the park (prestige and Find upgrade)', () => {
    const s = sled(4);
    resetPark(s, 0);
    expect(s.vehicleCars.every((c) => c === 0)).toBe(true);
    const p = sled(3);
    p.runEarnings = 1e12;
    expect(prestige(p).ok).toBe(true);
    expect(p.vehicleCars.every((c) => c === 0)).toBe(true);
  });
  it('automation buys cars when shipping is the bottleneck', () => {
    const s = quiet(newState());
    s.academy = { foreman_pup: 1 };
    s.automation = { ...s.automation, find: false, build: true };
    s.kennels = [17, 17, 17, 17];
    s.vehicles = [TOP, TOP, TOP, TOP, ...new Array(8).fill(null)];
    s.vehicleCars = [1, 1, 1, 1, ...new Array(8).fill(0)];
    s.pups = 1e9;
    expect(computeStats(s).bottleneck).toBe('ship');
    const cost = sledCarCost(s, 0)!;
    s.cash = cost * 1.01;
    runAutomation(s);
    expect(s.vehicleCars.slice(0, 4).reduce((a, b) => a + b, 0)).toBe(5);
    expect(s.cash).toBeLessThan(cost * 0.02);
    // and stops at the cap
    s.cash = 1e80;
    runAutomation(s);
    for (let i = 0; i < 4; i++) expect(s.vehicleCars[i]).toBeLessThanOrEqual(BASE_MAX_CARS);
  });
});

describe('calendar collar (§2.8)', () => {
  const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}`;
  it('grants a Legend Collar on every 28th consecutive streak day', () => {
    expect(CALENDAR_COLLAR_STREAK).toBe(28);
    const s = newState();
    s.daily.streak = 27;
    s.daily.bestStreak = 27;
    s.daily.lastClaimDay = day(1);
    s.daily.lastSeenDay = day(1);
    const r = claimDailyTreat(s, day(2));
    expect(r.ok).toBe(true);
    expect(r.streak).toBe(28);
    expect(r.events).toContainEqual({ type: 'calendarCollar', streak: 28 });
    expect(s.legendCollars).toBe(1);
  });
  it('does not grant one on other days or when the streak breaks', () => {
    const s = newState();
    s.daily.streak = 26;
    s.daily.lastClaimDay = day(1);
    s.daily.lastSeenDay = day(1);
    const r = claimDailyTreat(s, day(2));
    expect(r.events!.some((e) => e.type === 'calendarCollar')).toBe(false);
    expect(s.legendCollars).toBe(0);
    const t = newState();
    t.daily.streak = 27;
    t.daily.lastClaimDay = day(1);
    t.daily.lastSeenDay = day(1);
    const broke = claimDailyTreat(t, day(10)); // gap, no freezes -> streak 1
    expect(broke.streak).toBe(1);
    expect(t.legendCollars).toBe(0);
  });
  it('repeats at 56', () => {
    const s = newState();
    s.daily.streak = 55;
    s.daily.lastClaimDay = day(1);
    s.daily.lastSeenDay = day(1);
    const r = claimDailyTreat(s, day(2));
    expect(r.streak).toBe(56);
    expect(r.events).toContainEqual({ type: 'calendarCollar', streak: 56 });
  });
});

describe('findsDelivered', () => {
  beforeEach(() => lockGates());
  afterEach(() => restoreGates());
  function working(): GameState {
    const s = quiet(newState());
    s.kennels = [2, null, null, null];
    s.pups = 500;
    return s;
  }
  it('accumulates delivered finds online', () => {
    const s = working();
    const d = computeStats(s);
    expect(s.stats.findsDelivered).toBe(0);
    tick(s, 10, constRng(0.5));
    expect(s.stats.findsDelivered).toBeCloseTo(d.deliveredPerSec * 10, 6);
    expect(d.deliveredPerSec).toBeGreaterThan(0);
  });
  it('accumulates offline via the shared step', () => {
    const s = working();
    const d = computeStats(s);
    applyOfflineProgress(s, s.lastSaved + 300_000);
    expect(s.stats.findsDelivered).toBeGreaterThan(d.deliveredPerSec * 300 * 0.99);
    expect(s.stats.findsDelivered * computeStats(s).findValue).toBeGreaterThan(0);
  });
  it('is bounded by shipping', () => {
    const s = working();
    s.pups = 1e6;
    s.kennels = [17, null, null, null];
    tick(s, 4, constRng(0.5));
    expect(s.stats.findsDelivered).toBeLessThanOrEqual(computeStats(s).shipPerSec * 4 * 1.0001);
  });
});

describe('save v5 migration', () => {
  it('v4 saves gain vehicleCars (1 on top-tier slots), show, showHistory, findsDelivered', () => {
    expect(SAVE_VERSION).toBe(5);
    const s = newState();
    s.vehicles[0] = TOP;
    s.vehicles[1] = TOP - 1;
    const raw = JSON.parse(serialize(s));
    raw.version = 4;
    delete raw.vehicleCars;
    delete raw.show;
    delete raw.showHistory;
    delete raw.stats.findsDelivered;
    const g = deserialize(JSON.stringify(raw))!;
    expect(g.version).toBe(5);
    expect(g.vehicleCars).toHaveLength(MAX_FLEET_SLOTS);
    expect(g.vehicleCars[0]).toBe(1);
    expect(g.vehicleCars[1]).toBe(0);
    expect(g.vehicleCars.slice(2).every((c) => c === 0)).toBe(true);
    expect(g.show).toBeNull();
    expect(g.showHistory).toEqual([]);
    expect(g.stats.findsDelivered).toBe(0);
  });
  it('v5 round-trips cars and sanitizes bad car data', () => {
    const s = newState();
    s.vehicles[2] = TOP;
    s.vehicleCars[2] = 4;
    s.stats.findsDelivered = 123.5;
    expect(deserialize(serialize(s))).toEqual(s);
    const raw = JSON.parse(serialize(s));
    raw.vehicleCars = [9, 9, 'x', 9];
    raw.vehicles[0] = 0;
    const g = deserialize(JSON.stringify(raw))!;
    expect(g.vehicleCars[0]).toBe(0); // not a top-tier slot
    expect(g.vehicleCars[2]).toBe(1); // invalid value falls back to 1 on a top-tier slot
    expect(g.vehicleCars).toHaveLength(MAX_FLEET_SLOTS);
  });
  it('older saves (v1-v3) migrate too', () => {
    const s = newState();
    s.vehicles[0] = TOP;
    for (const v of [1, 2, 3]) {
      const raw = JSON.parse(serialize(s));
      raw.version = v;
      delete raw.vehicleCars;
      if (v === 1) raw.mailReady = false;
      const g = deserialize(JSON.stringify(raw));
      expect(g).not.toBeNull();
      expect(g!.vehicleCars[0]).toBe(1);
    }
  });
});
