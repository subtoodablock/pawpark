import { describe, expect, it } from 'vitest';
import {
  ACADEMY, FINDS, KENNELS, PRESTIGE_EXP_EARLY, PRESTIGE_EXP_LATE, TRAINING, TRAINING_TIERS, TROPHIES, VEHICLES,
} from '../src/core';

/** Guard rails for the v2 long-game balance (docs/04 §2 and §7): they keep later edits inside the pacing model. */
describe('balance data invariants', () => {
  it('find gates and values strictly increase', () => {
    for (let i = 1; i < FINDS.length; i++) {
      expect(FINDS[i].unlockParkValue).toBeGreaterThan(FINDS[i - 1].unlockParkValue);
      expect(FINDS[i].value).toBeGreaterThan(FINDS[i - 1].value);
    }
  });
  it('find value ladder is roughly x3.5 to x6 per step', () => {
    for (let i = 2; i < FINDS.length; i++) {
      const r = FINDS[i].value / FINDS[i - 1].value;
      expect(r).toBeGreaterThan(3.5);
      expect(r).toBeLessThan(6);
    }
  });
  it('kennel and vehicle costs grow at least x10 per tier', () => {
    for (let i = 1; i < KENNELS.length; i++) expect(KENNELS[i].cost / KENNELS[i - 1].cost).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < VEHICLES.length; i++) expect(VEHICLES[i].cost / VEHICLES[i - 1].cost).toBeGreaterThanOrEqual(10);
  });
  it('training stays bounded: capped levels, steep cost growth, reachable tier unlocks', () => {
    let levels = 0;
    for (const d of TRAINING) {
      expect(d.maxLevel).toBeLessThanOrEqual(20);
      expect(d.costGrowth).toBeGreaterThanOrEqual(d.maxLevel === 1 ? 1 : 1.4);
      levels += d.maxLevel;
    }
    for (const t of TRAINING_TIERS) expect(t.unlockAt).toBeLessThan(levels);
  });
  it('prestige exponent stays in the slow-growth band', () => {
    expect(PRESTIGE_EXP_EARLY).toBeGreaterThanOrEqual(0.15);
    expect(PRESTIGE_EXP_EARLY).toBeLessThanOrEqual(0.35);
    expect(PRESTIGE_EXP_LATE).toBeGreaterThanOrEqual(0.1);
    expect(PRESTIGE_EXP_LATE).toBeLessThanOrEqual(PRESTIGE_EXP_EARLY);
  });
  it('academy ladders and trophies have unique ids', () => {
    expect(new Set(ACADEMY.map((a) => a.id)).size).toBe(ACADEMY.length);
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
  });
});
