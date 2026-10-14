import { describe, expect, it } from 'vitest';
import {
  ACADEMY, BASE_COLLAR_BONUS, BASE_DIG_PER_MIN, BASE_OFFLINE_HOURS, BASE_SPIRIT_PAW_BONUS, BASE_ZOOMIE_BONUS, FINDS,
  KENNELS, PRESTIGE_DIVISOR, PRESTIGE_EXPONENT, STAT_MODES, TRAINING, VEHICLES, computeStats, statMode, statValue,
} from '../src/core';
import { newState } from './helpers';

/** per-level effect of a training / academy item, read from the data tables */
const per = (id: string): number => [...TRAINING, ...ACADEMY].find((d) => d.id === id)!.perLevel;

describe('stat modes', () => {
  it('matches the design table', () => {
    expect(statMode('layRate')).toBe('mult');
    expect(statMode('squirrelRate')).toBe('mult');
    expect(statMode('fleetSlots')).toBe('add');
    expect(statMode('fleetDiscount')).toBe('add');
    expect(Object.keys(STAT_MODES)).toHaveLength(25);
  });
});

describe('statValue', () => {
  it('multiplies mult sources across training and academy', () => {
    const s = newState();
    s.training = { comfy_beds: 5, bigger_holes: 2 };
    s.academy = { epic_digging: 4 };
    const expected = (1 + per('comfy_beds') * 5) * (1 + per('bigger_holes') * 2) * (1 + per('epic_digging') * 4);
    expect(statValue(s, 'layRate')).toBeCloseTo(expected, 10);
  });
  it('sums add sources', () => {
    const s = newState();
    s.training = { louder_whistle: 3 };
    expect(statValue(s, 'adoptionCap')).toBe(60);
    expect(statValue(s, 'maxZoomies')).toBe(0);
    expect(statValue(s, 'findValue')).toBe(1);
  });
});

describe('computeStats', () => {
  it('matches hand-computed values for a constructed state', () => {
    const s = newState();
    s.kennels = [0, 1, null, null]; // 250 + 500
    s.vehicles = [0, 1, null, null, null, null, null, null, null, null, null, null];
    s.pups = 100;
    s.training = { comfy_beds: 5, bigger_holes: 2, tune_ups: 4, premium_kibble: 3, zoomie_training: 3, extra_padding: 10 };
    s.findIndex = 1;
    s.spiritPaws = 10;
    s.legendCollars = 2;
    s.academy = { spirit_bond: 2 };
    s.zoomies = 10.7;
    s.treats = [{ id: 'bacon_strip', remaining: 100 }];

    const d = computeStats(s);
    const lay = (1 + per('comfy_beds') * 5) * (1 + per('bigger_holes') * 2);
    const fv = 1 + per('premium_kibble') * 3;
    const paw = BASE_SPIRIT_PAW_BONUS + per('spirit_bond') * 2;
    const collar = BASE_COLLAR_BONUS ** 2;
    const bonus = 1 + 10 * paw * collar;
    const zPer = BASE_ZOOMIE_BONUS + per('zoomie_training') * 3;
    expect(d.kennelCapacity).toBeCloseTo((KENNELS[0].capacity + KENNELS[1].capacity) * (1 + per('extra_padding') * 10), 8);
    expect(d.builtKennels).toBe(2);
    expect(d.fleetSlots).toBe(4);
    expect(d.shipPerSec).toBeCloseTo(((VEHICLES[0].capacityPerMin + VEHICLES[1].capacityPerMin) / 60) * (1 + per('tune_ups') * 4), 8);
    expect(d.digPerPupPerSec).toBeCloseTo((BASE_DIG_PER_MIN / 60) * lay, 10);
    expect(d.digPerSec).toBeCloseTo(100 * (BASE_DIG_PER_MIN / 60) * lay, 8);
    expect(d.deliveredPerSec).toBeCloseTo(d.digPerSec, 8);
    expect(d.bottleneck).toBe('dig');
    expect(d.findValue).toBeCloseTo(FINDS[1].value * fv, 10);
    expect(d.pawBonus).toBeCloseTo(paw, 10);
    expect(d.collarMult).toBeCloseTo(collar, 10);
    expect(d.earningsBonus).toBeCloseTo(bonus, 10);
    expect(d.zoomieBonusPer).toBeCloseTo(zPer, 10);
    expect(d.zoomieMult).toBeCloseTo(1 + 10 * zPer, 10);
    expect(d.treatMult.earnings).toBe(2);
    const base = d.digPerSec * FINDS[1].value * fv * bonus;
    expect(d.incomePerSec).toBeCloseTo(base * (1 + 10 * zPer) * 2, 8);
    expect(d.parkValue).toBeCloseTo(base * 3600, 6);
    expect(d.totalTrainingLevels).toBe(27);
  });

  it('reports ship bottleneck and ignores vehicles in locked slots', () => {
    const s = newState();
    s.pups = 1000;
    s.vehicles = [0, null, null, null, null, null, null, null, 5, null, null, null]; // slot 8 locked
    const d = computeStats(s);
    expect(d.shipPerSec).toBeCloseTo(5, 10);
    expect(d.digPerSec).toBeCloseTo(1000 * (BASE_DIG_PER_MIN / 60), 10);
    expect(d.bottleneck).toBe('ship');
    expect(d.deliveredPerSec).toBeCloseTo(5, 10);
  });

  it('unlocks fleet slots via additive stat, capped at max', () => {
    const s = newState();
    s.training = { fleet_expansion: 3 };
    expect(computeStats(s).fleetSlots).toBe(7);
    s.training = { fleet_expansion: 8 };
    expect(computeStats(s).fleetSlots).toBe(12);
  });

  it('derives adoption, rescue, offline cap and prestige gain', () => {
    const s = newState();
    s.training = { louder_whistle: 2, quick_refill: 2, rescue_program: 5 };
    s.academy = { bigger_jar: 4 };
    s.treats = [{ id: 'peanut_kong', remaining: 10 }];
    s.runEarnings = PRESTIGE_DIVISOR * 1024;
    const d = computeStats(s);
    expect(d.adoptionCap).toBe(90);
    expect(d.adoptionRefill).toBeCloseTo((1 + 1) * 5, 10);
    expect(d.rescuePerSec).toBeCloseTo((1 * (2 + 10)) / 60 * 5, 10);
    expect(d.offlineCapSec).toBeCloseTo((BASE_OFFLINE_HOURS + per('bigger_jar') * 4) * 3600, 6);
    expect(d.prestigeGain).toBe(Math.floor(1024 ** PRESTIGE_EXPONENT));
  });

  it('clamps discounts at 0.25', async () => {
    const { costMultiplier } = await import('../src/core');
    const s = newState();
    s.academy = { kennel_deals: 10 };
    expect(costMultiplier(s, 'kennelDiscount')).toBeCloseTo(1 - per('kennel_deals') * 10, 10);
    s.academy = { kennel_deals: 1000 };
    expect(costMultiplier(s, 'kennelDiscount')).toBe(0.25);
  });

  it('does not mutate state', () => {
    const s = newState();
    const before = JSON.stringify(s);
    computeStats(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});
