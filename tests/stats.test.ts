import { describe, expect, it } from 'vitest';
import { computeStats, statMode, statValue, STAT_MODES } from '../src/core';
import { newState } from './helpers';

describe('stat modes', () => {
  it('matches the design table', () => {
    expect(statMode('layRate')).toBe('mult');
    expect(statMode('squirrelRate')).toBe('mult');
    expect(statMode('fleetSlots')).toBe('add');
    expect(statMode('fleetDiscount')).toBe('add');
    expect(Object.keys(STAT_MODES)).toHaveLength(18);
  });
});

describe('statValue', () => {
  it('multiplies mult sources across training and academy', () => {
    const s = newState();
    s.training = { comfy_beds: 5, bigger_holes: 2 };
    s.academy = { epic_digging: 4 };
    // 1.5 * 1.3 * 1.2
    expect(statValue(s, 'layRate')).toBeCloseTo(2.34, 10);
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
    expect(d.kennelCapacity).toBeCloseTo(750 * 1.5, 8);
    expect(d.builtKennels).toBe(2);
    expect(d.fleetSlots).toBe(4);
    expect(d.shipPerSec).toBeCloseTo(((300 + 1000) / 60) * 1.2, 8); // 26
    expect(d.digPerPupPerSec).toBeCloseTo((2 / 60) * 1.95, 10); // 0.065
    expect(d.digPerSec).toBeCloseTo(6.5, 8);
    expect(d.deliveredPerSec).toBeCloseTo(6.5, 8);
    expect(d.bottleneck).toBe('dig');
    expect(d.findValue).toBeCloseTo(1.25 * 1.3, 10);
    expect(d.pawBonus).toBeCloseTo(0.12, 10);
    expect(d.collarMult).toBeCloseTo(1.1025, 10);
    expect(d.earningsBonus).toBeCloseTo(1 + 10 * 0.12 * 1.1025, 10); // 2.323
    expect(d.zoomieBonusPer).toBeCloseTo(0.08, 10);
    expect(d.zoomieMult).toBeCloseTo(1.8, 10);
    expect(d.treatMult.earnings).toBe(2);
    const base = 6.5 * 1.625 * 2.323;
    expect(d.incomePerSec).toBeCloseTo(base * 1.8 * 2, 8);
    expect(d.parkValue).toBeCloseTo(base * 3600, 6);
    expect(d.totalTrainingLevels).toBe(27);
  });

  it('reports ship bottleneck and ignores vehicles in locked slots', () => {
    const s = newState();
    s.pups = 1000;
    s.vehicles = [0, null, null, null, null, null, null, null, 5, null, null, null]; // slot 8 locked
    const d = computeStats(s);
    expect(d.shipPerSec).toBeCloseTo(5, 10);
    expect(d.digPerSec).toBeCloseTo(1000 * (2 / 60), 10);
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
    s.runEarnings = 1e5 * 1024; // (1024)^0.4 = 16
    const d = computeStats(s);
    expect(d.adoptionCap).toBe(90);
    expect(d.adoptionRefill).toBeCloseTo((1 + 1) * 10, 10);
    expect(d.rescuePerSec).toBeCloseTo((1 * 10) / 60 * 10, 10);
    expect(d.offlineCapSec).toBeCloseTo(3 * 3600, 6);
    expect(d.prestigeGain).toBe(16);
  });

  it('clamps discounts at 0.25', async () => {
    const { costMultiplier } = await import('../src/core');
    const s = newState();
    s.academy = { kennel_deals: 10 };
    expect(costMultiplier(s, 'kennelDiscount')).toBeCloseTo(0.5, 10);
    s.academy = { kennel_deals: 20 };
    expect(costMultiplier(s, 'kennelDiscount')).toBe(0.25);
  });

  it('does not mutate state', () => {
    const s = newState();
    const before = JSON.stringify(s);
    computeStats(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});
