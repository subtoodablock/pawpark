import { describe, expect, it } from 'vitest';
import {
  academyCost, adopt, buyAcademy, buyKennel, buyTraining, buyTreat, buyVehicle,
  catchSquirrel, computeStats, isTrainingTierUnlocked, kennelUpgradeCost, nextFind,
  openMail, prestige, resetForPrestige, trainingCost, trainingMaxBuy, upgradeFind,
  vehicleUpgradeCost, KENNELS, VEHICLES, FINDS, TRAINING, TREATS, PRESTIGE_DIVISOR, PRESTIGE_EXP_EARLY,
  BASE_SPIRIT_PAW_BONUS, MAIL_BONES_MAX, MAIL_CASH_SECONDS, ACADEMY,
} from '../src/core';

const COMFY = TRAINING.find((d) => d.id === 'comfy_beds')!;
const cost3 = COMFY.baseCost * (1 + COMFY.costGrowth + COMFY.costGrowth ** 2);
import { constRng, newState } from './helpers';

describe('adopt', () => {
  it('adopts up to n, limited by stock and capacity', () => {
    const s = newState();
    expect(adopt(s, 5, false)).toBe(5);
    expect(s.pups).toBe(5);
    expect(s.adoptionStock).toBe(45);
    expect(s.stats.totalAdopted).toBe(5);
    expect(adopt(s, 1000, false)).toBe(45);
    expect(s.adoptionStock).toBe(0);
    expect(adopt(s, 1, true)).toBe(0);
  });
  it('is limited by kennel capacity', () => {
    const s = newState();
    s.pups = 248.5;
    expect(adopt(s, 10, false)).toBe(1);
    expect(adopt(s, 10, false)).toBe(0);
  });
  it('fromTap false leaves zoomies alone; fromTap true raises and caps them', () => {
    const s = newState();
    adopt(s, 3, false);
    expect(s.zoomies).toBe(0);
    expect(s.stats.totalTaps).toBe(0);
    adopt(s, 3, true);
    expect(s.zoomies).toBe(3);
    expect(s.stats.totalTaps).toBe(1);
    s.zoomieIdle = 5;
    s.zoomies = 19;
    s.adoptionStock = 50;
    adopt(s, 10, true);
    expect(s.zoomies).toBe(20);
    expect(s.zoomieIdle).toBe(0);
  });
  it('failed adopt leaves zoomies unchanged', () => {
    const s = newState();
    s.adoptionStock = 0.9;
    s.zoomies = 5;
    s.zoomieIdle = 4;
    expect(adopt(s, 1, true)).toBe(0);
    expect(s.zoomies).toBe(5);
    expect(s.zoomieIdle).toBe(4);
  });
});

describe('kennels', () => {
  it('buys the next tier, charging the cost', () => {
    const s = newState();
    s.cash = KENNELS[0].cost * 2;
    s.kennels = [null, null, null, null]; // no duplicates yet
    expect(kennelUpgradeCost(s, 1)).toBe(KENNELS[0].cost);
    expect(buyKennel(s, 1)).toEqual({ ok: true });
    expect(s.kennels[1]).toBe(0);
    expect(s.cash).toBe(KENNELS[0].cost);
    expect(kennelUpgradeCost(s, 1)).toBe(KENNELS[1].cost);
  });
  it('fails when unaffordable, without mutating', () => {
    const s = newState();
    s.cash = KENNELS[0].cost - 1;
    const r = buyKennel(s, 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
    expect(s.kennels[1]).toBeNull();
    expect(s.cash).toBe(KENNELS[0].cost - 1);
  });
  it('fails when maxed or bad slot', () => {
    const s = newState();
    s.cash = 1e30;
    s.kennels[0] = KENNELS.length - 1;
    expect(kennelUpgradeCost(s, 0)).toBeNull();
    expect(buyKennel(s, 0).ok).toBe(false);
    expect(buyKennel(s, 99).ok).toBe(false);
    expect(buyKennel(s, -1).ok).toBe(false);
    expect(s.cash).toBe(1e30);
  });
  it('applies kennel discount', () => {
    const s = newState();
    s.kennels = [null, null, null, null];
    s.academy = { kennel_deals: 4 };
    const disc = ACADEMY.find((d) => d.id === 'kennel_deals')!.perLevel * 4;
    expect(kennelUpgradeCost(s, 1)).toBeCloseTo(KENNELS[0].cost * (1 - disc), 10);
  });
});

describe('vehicles', () => {
  it('buys and upgrades in unlocked slots', () => {
    const s = newState();
    s.vehicles[0] = null; // no duplicates
    s.cash = VEHICLES[0].cost + VEHICLES[1].cost;
    expect(vehicleUpgradeCost(s, 1)).toBe(VEHICLES[0].cost);
    expect(buyVehicle(s, 1).ok).toBe(true);
    expect(buyVehicle(s, 1).ok).toBe(true);
    expect(s.vehicles[1]).toBe(1);
    expect(s.cash).toBe(0);
    expect(buyVehicle(s, 1).ok).toBe(false);
  });
  it('rejects locked fleet slots until Fleet Expansion', () => {
    const s = newState();
    s.cash = 1e12;
    expect(vehicleUpgradeCost(s, 4)).toBeNull();
    const r = buyVehicle(s, 4);
    expect(r.ok).toBe(false);
    expect(s.vehicles[4]).toBeNull();
    s.training = { fleet_expansion: 1 };
    expect(buyVehicle(s, 4).ok).toBe(true);
  });
  it('rejects maxed', () => {
    const s = newState();
    s.vehicles[0] = VEHICLES.length - 1;
    s.cash = 1e30;
    expect(buyVehicle(s, 0).ok).toBe(false);
  });
});

describe('training', () => {
  it('buys one level with exponential cost', () => {
    const s = newState();
    s.cash = 1000;
    expect(trainingCost(s, 'comfy_beds')).toBe(COMFY.baseCost);
    expect(buyTraining(s, 'comfy_beds').ok).toBe(true);
    expect(s.training.comfy_beds).toBe(1);
    expect(s.cash).toBeCloseTo(1000 - COMFY.baseCost, 10);
    expect(trainingCost(s, 'comfy_beds')).toBeCloseTo(COMFY.baseCost * COMFY.costGrowth, 10);
  });
  it('buys several levels at once, all or nothing', () => {
    const s = newState();
    s.cash = cost3 - 0.01;
    expect(buyTraining(s, 'comfy_beds', 3).ok).toBe(false);
    expect(s.training.comfy_beds).toBeUndefined();
    s.cash = cost3;
    expect(buyTraining(s, 'comfy_beds', 3).ok).toBe(true);
    expect(s.training.comfy_beds).toBe(3);
    expect(s.cash).toBeCloseTo(0, 8);
  });
  it('Infinity buys as many as affordable, capped by max', () => {
    const s = newState();
    s.cash = cost3 + 1;
    const preview = trainingMaxBuy(s, 'comfy_beds');
    expect(preview.levels).toBe(3);
    expect(buyTraining(s, 'comfy_beds', Infinity).ok).toBe(true);
    expect(s.training.comfy_beds).toBe(3);
    expect(s.cash).toBeCloseTo(1 + 0, 6);
    s.cash = 1e15;
    buyTraining(s, 'comfy_beds', Infinity);
    expect(s.training.comfy_beds).toBe(COMFY.maxLevel);
    expect(buyTraining(s, 'comfy_beds').ok).toBe(false);
    expect(trainingCost(s, 'comfy_beds')).toBeNull();
    expect(trainingMaxBuy(s, 'comfy_beds')).toEqual({ levels: 0, cost: 0 });
  });
  it('Infinity with zero affordable fails without mutating', () => {
    const s = newState();
    s.cash = 1;
    expect(buyTraining(s, 'comfy_beds', Infinity).ok).toBe(false);
    expect(s.training).toEqual({});
  });
  it('locked tiers cannot be bought until enough total levels', () => {
    const s = newState();
    s.cash = 1e12;
    expect(isTrainingTierUnlocked(s, 1)).toBe(true);
    expect(isTrainingTierUnlocked(s, 2)).toBe(false);
    expect(buyTraining(s, 'bigger_holes').ok).toBe(false);
    expect(trainingMaxBuy(s, 'bigger_holes')).toEqual({ levels: 0, cost: 0 });
    s.training = { comfy_beds: 15 };
    expect(isTrainingTierUnlocked(s, 2)).toBe(true);
    expect(buyTraining(s, 'bigger_holes').ok).toBe(true);
  });
  it('unknown id fails; research discount applies', () => {
    const s = newState();
    s.cash = 1e6;
    expect(buyTraining(s, 'nope').ok).toBe(false);
    expect(trainingCost(s, 'nope')).toBeNull();
    s.academy = { bargain_hunter: 2 };
    const disc = ACADEMY.find((d) => d.id === 'bargain_hunter')!.perLevel * 2;
    expect(trainingCost(s, 'comfy_beds')).toBeCloseTo(COMFY.baseCost * (1 - disc), 10);
  });
  it('every def references a known tier', () => {
    for (const d of TRAINING) expect(d.tier).toBeGreaterThanOrEqual(1);
  });
});

describe('academy', () => {
  it('spends golden bones, rounds cost up, enforces max', () => {
    const s = newState();
    expect(academyCost(s, 'epic_digging')).toBe(5);
    expect(buyAcademy(s, 'epic_digging').ok).toBe(true);
    expect(s.goldenBones).toBe(5);
    expect(s.academy.epic_digging).toBe(1);
    expect(academyCost(s, 'epic_digging')).toBe(6); // ceil(5.9)
    s.goldenBones = 1e9;
    for (let i = 0; i < 60; i++) buyAcademy(s, 'epic_digging');
    expect(s.academy.epic_digging).toBe(50);
    expect(academyCost(s, 'epic_digging')).toBeNull();
    expect(buyAcademy(s, 'epic_digging').ok).toBe(false);
  });
  it('fails when unaffordable', () => {
    const s = newState();
    s.goldenBones = 4;
    expect(buyAcademy(s, 'epic_digging').ok).toBe(false);
    expect(s.goldenBones).toBe(4);
    expect(buyAcademy(s, 'nope').ok).toBe(false);
  });
});

describe('treats', () => {
  it('buys and extends duration without stacking multiplier', () => {
    const s = newState();
    s.goldenBones = 100;
    expect(buyTreat(s, 'bacon_strip').ok).toBe(true);
    expect(s.goldenBones).toBe(60);
    expect(s.treats).toEqual([{ id: 'bacon_strip', remaining: 14400 }]);
    s.treats[0].remaining = 100;
    buyTreat(s, 'bacon_strip');
    expect(s.treats).toEqual([{ id: 'bacon_strip', remaining: 14500 }]);
    expect(computeStats(s).treatMult.earnings).toBe(2);
  });
  it('fails when unaffordable or unknown', () => {
    const s = newState();
    s.goldenBones = 39;
    expect(buyTreat(s, 'bacon_strip').ok).toBe(false);
    expect(buyTreat(s, 'nope').ok).toBe(false);
    expect(s.treats).toEqual([]);
    expect(s.goldenBones).toBe(39);
    expect(TREATS).toHaveLength(3);
  });
});

describe('find upgrade', () => {
  function rich() {
    const s = newState();
    s.pups = 200;
    s.vehicles = [5, 5, 5, 5, ...new Array(8).fill(null)];
    s.training = { comfy_beds: COMFY.maxLevel, premium_kibble: 15 };
    return s;
  }
  it('fails when park value is too low', () => {
    const s = newState();
    const r = upgradeFind(s);
    expect(r.ok).toBe(false);
    expect(s.findIndex).toBe(0);
  });
  it('upgrades and pays the reward only the first time ever', () => {
    const s = rich();
    expect(nextFind(s)?.id).toBe('tennis_ball');
    expect(computeStats(s).parkValue).toBeGreaterThanOrEqual(FINDS[1].unlockParkValue);
    const bones = s.goldenBones;
    expect(upgradeFind(s).ok).toBe(true);
    expect(s.findIndex).toBe(1);
    expect(s.highestFindIndex).toBe(1);
    expect(s.goldenBones).toBe(bones + FINDS[1].unlockReward);
    // simulate a prestige: back to find 0, record kept
    Object.assign(s, rich());
    s.findIndex = 0;
    expect(upgradeFind(s).ok).toBe(true);
    expect(s.findIndex).toBe(1);
    expect(s.goldenBones).toBe(bones + FINDS[1].unlockReward);
  });
  it('fails at the top find', () => {
    const s = newState();
    s.findIndex = FINDS.length - 1;
    expect(nextFind(s)).toBeNull();
    expect(upgradeFind(s).ok).toBe(false);
  });
});

describe('squirrel catch', () => {
  it('resolves cash at catch time using current income', () => {
    const s = newState();
    s.squirrels = [{ id: 7, age: 1, lifetime: 7, reward: { kind: 'cash', incomeSeconds: 60 } }];
    // no income -> min rate 1
    expect(catchSquirrel(s, 7)).toEqual({ kind: 'cash', amount: 60 });
    expect(s.cash).toBe(60);
    expect(s.stats.squirrelsCaught).toBe(1);
    expect(s.squirrels).toHaveLength(0);
    expect(catchSquirrel(s, 7)).toBeNull();

    s.pups = 1000;
    s.vehicles[0] = 1;
    s.squirrels = [{ id: 8, age: 0, lifetime: 7, reward: { kind: 'cash', incomeSeconds: 30 } }];
    const income = computeStats(s).incomePerSec;
    expect(income).toBeGreaterThan(1);
    const r = catchSquirrel(s, 8);
    expect(r).toEqual({ kind: 'cash', amount: income * 30 });
  });
  it('gives golden bones and treats', () => {
    const s = newState();
    s.squirrels = [
      { id: 1, age: 0, lifetime: 7, reward: { kind: 'goldenBones', amount: 2 } },
      { id: 2, age: 0, lifetime: 7, reward: { kind: 'treat', treatId: 'steak_dinner', durationSec: 300 } },
    ];
    expect(catchSquirrel(s, 1)).toEqual({ kind: 'goldenBones', amount: 2 });
    expect(s.goldenBones).toBe(12);
    expect(catchSquirrel(s, 2)).toEqual({ kind: 'treat', treatId: 'steak_dinner', durationSec: 300 });
    expect(s.treats).toEqual([{ id: 'steak_dinner', remaining: 300 }]);
  });
});

describe('mail', () => {
  it('returns null when nothing is waiting', () => {
    const s = newState();
    expect(openMail(s)).toBeNull();
  });
  it('rolls bones, cash, treat', () => {
    const s = newState();
    s.mailCount = 3;
    expect(openMail(s, constRng(0.1, 0.999))).toEqual({ kind: 'goldenBones', amount: MAIL_BONES_MAX });
    expect(s.goldenBones).toBe(10 + MAIL_BONES_MAX);
    expect(s.mailCount).toBe(2);
    expect(s.stats.mailOpened).toBe(1);
    expect(openMail(s, constRng(0.7))).toEqual({ kind: 'cash', amount: MAIL_CASH_SECONDS });
    expect(s.cash).toBe(MAIL_CASH_SECONDS);
    expect(openMail(s, constRng(0.9, 0.5))).toEqual({ kind: 'treat', treatId: 'peanut_kong', durationSec: 14400 });
    expect(s.treats).toHaveLength(1);
    expect(s.mailCount).toBe(0);
    expect(openMail(s)).toBeNull();
  });
});

describe('prestige', () => {
  it('fails below 1 spirit paw', () => {
    const s = newState();
    s.runEarnings = PRESTIGE_DIVISOR * 0.9;
    const r = prestige(s);
    expect(r.ok).toBe(false);
    expect(s.prestigeCount).toBe(0);
  });
  it('computes gain, resets run state, keeps meta state', () => {
    const s = newState();
    s.runEarnings = PRESTIGE_DIVISOR * 1e5;
    const gain = Math.floor(1e5 ** PRESTIGE_EXP_EARLY);
    s.lifetimeEarnings = 5e10;
    s.cash = 123456;
    s.pups = 200;
    s.adoptionStock = 3;
    s.kennels = [2, 1, 0, null];
    s.vehicles = [3, 2, null, null, 1, null, null, null, null, null, null, null];
    s.findIndex = 3;
    s.highestFindIndex = 5;
    s.training = { comfy_beds: 5, louder_whistle: 4 };
    s.academy = { epic_digging: 3 };
    s.zoomies = 12;
    s.zoomieIdle = 0.3;
    s.treats = [{ id: 'bacon_strip', remaining: 10 }];
    s.squirrels = [{ id: 1, age: 0, lifetime: 7, reward: { kind: 'goldenBones', amount: 1 } }];
    s.goldenBones = 77;
    s.spiritPaws = 4;
    s.legendCollars = 2;
    s.trophies = ['pack_10k'];
    s.mailCount = 2;
    s.mailTimer = 42;
    s.runTimeSec = 5000;
    s.automation = { find: true, build: true, training: false, whistle: false, prestige: true, prestigeThreshold: 1 };
    s.stats.totalAdopted = 999;
    s.notifiedFinds = [4];

    const r = prestige(s);
    expect(r).toEqual({ ok: true, gained: gain });
    expect(s.spiritPaws).toBe(4 + gain);
    expect(s.prestigeCount).toBe(1);

    expect(s.cash).toBe(0);
    expect(s.pups).toBe(0);
    expect(s.adoptionStock).toBe(50);
    expect(s.kennels).toEqual([0, null, null, null]);
    expect(s.vehicles).toEqual([0, ...new Array(11).fill(null)]);
    expect(s.findIndex).toBe(0);
    expect(s.training).toEqual({});
    expect(s.zoomies).toBe(0);
    expect(s.runEarnings).toBe(0);
    expect(s.treats).toEqual([]);
    expect(s.squirrels).toEqual([]);

    expect(s.goldenBones).toBe(77);
    expect(s.academy).toEqual({ epic_digging: 3 });
    expect(s.legendCollars).toBe(2);
    expect(s.trophies).toEqual(['pack_10k']);
    expect(s.highestFindIndex).toBe(5);
    expect(s.lifetimeEarnings).toBe(5e10);
    expect(s.stats.totalAdopted).toBe(999);
    expect(s.mailCount).toBe(2);
    expect(s.mailTimer).toBe(42);
    expect(s.runTimeSec).toBe(0);
    expect(s.automation.build).toBe(true);
    expect(s.automation.prestigeThreshold).toBe(1);
  });
  it('earnings bonus rises after prestige', () => {
    const s = newState();
    s.runEarnings = PRESTIGE_DIVISOR * 1e5;
    const before = computeStats(s).earningsBonus;
    const gained = prestige(s).gained!;
    expect(gained).toBe(Math.floor((1e5) ** PRESTIGE_EXP_EARLY));
    expect(computeStats(s).earningsBonus).toBeCloseTo(1 + gained * BASE_SPIRIT_PAW_BONUS, 10);
    expect(computeStats(s).earningsBonus).toBeGreaterThan(before);
  });
  it('resetForPrestige alone does not award paws', () => {
    const s = newState();
    s.cash = 5;
    resetForPrestige(s);
    expect(s.spiritPaws).toBe(0);
    expect(s.cash).toBe(0);
  });
});
