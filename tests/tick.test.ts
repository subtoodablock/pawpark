import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASE_MAIL_CAPACITY, MAIL_INTERVAL_SEC, SQUIRREL_BONES_MAX, SQUIRREL_INTERVAL_MAX, SQUIRREL_INTERVAL_MIN,
  FINDS, START_GOLDEN_BONES, TRAINING, TROPHIES, computeStats, tick,
} from '../src/core';
import type { GameState } from '../src/core';
import { constRng, lockGates, newState, restoreGates, seeded } from './helpers';

const COMFY_MAX = TRAINING.find((d) => d.id === 'comfy_beds')!.maxLevel;

function productive(): GameState {
  const s = newState();
  s.pups = 200;
  s.kennels = [3, 3, null, null];
  s.training = { rescue_program: 2 };
  s.squirrelTimer = 1e9;
  s.mailTimer = 1e9;
  s.adoptionStock = 5;
  return s;
}

describe('tick', () => {
  beforeEach(() => lockGates());
  afterEach(() => restoreGates());
  it('is dt-invariant (10s vs 100 x 0.1s)', () => {
    const a = productive();
    const b = productive();
    tick(a, 10, seeded(1));
    for (let i = 0; i < 100; i++) tick(b, 0.1, seeded(1));
    expect(b.cash).toBeGreaterThan(0);
    expect(a.cash / b.cash).toBeCloseTo(1, 1);
    expect(Math.abs(a.cash - b.cash) / b.cash).toBeLessThan(0.01);
    expect(Math.abs(a.adoptionStock - b.adoptionStock)).toBeLessThan(1e-6);
    expect(Math.abs(a.runEarnings - b.runEarnings) / b.runEarnings).toBeLessThan(0.01);
  });

  it('refills adoption stock up to the cap', () => {
    const s = newState();
    s.adoptionStock = 0;
    tick(s, 10, constRng(0.5));
    expect(s.adoptionStock).toBeCloseTo(10, 10);
    tick(s, 1000, constRng(0.5));
    expect(s.adoptionStock).toBe(computeStats(s).adoptionCap);
  });

  it('rescue is clamped to capacity', () => {
    const s = productive();
    s.pups = 3990;
    tick(s, 1000, constRng(0.5));
    expect(s.pups).toBe(computeStats(s).kennelCapacity);
  });

  it('accumulates earnings in cash, run and lifetime totals', () => {
    const s = productive();
    const income = computeStats(s).incomePerSec;
    tick(s, 2, constRng(0.5));
    expect(s.cash).toBeCloseTo(income * 2, 8);
    expect(s.runEarnings).toBeCloseTo(income * 2, 8);
    expect(s.lifetimeEarnings).toBeCloseTo(income * 2, 8);
  });

  it('decays zoomies only after the grace period', () => {
    const s = newState();
    s.zoomies = 10;
    s.zoomieIdle = 0;
    tick(s, 0.5, constRng(0.5));
    expect(s.zoomies).toBe(10);
    tick(s, 0.6, constRng(0.5)); // idle 1.1 > 1.0
    expect(s.zoomies).toBeCloseTo(10 - 10 * 0.6, 8);
    tick(s, 5, constRng(0.5));
    expect(s.zoomies).toBe(0);
  });

  it('expires treats and emits an event', () => {
    const s = newState();
    s.treats = [{ id: 'bacon_strip', remaining: 3 }];
    s.squirrelTimer = 1e9;
    s.mailTimer = 1e9;
    expect(tick(s, 2, constRng(0.5))).toEqual([]);
    expect(s.treats[0].remaining).toBeCloseTo(1, 10);
    const ev = tick(s, 2, constRng(0.5));
    expect(ev).toContainEqual({ type: 'treatExpired', treatId: 'bacon_strip' });
    expect(s.treats).toHaveLength(0);
  });

  it('accumulates mail up to the mailbox capacity', () => {
    const s = newState();
    s.squirrelTimer = 1e9;
    s.mailTimer = 1;
    const ev = tick(s, 2, constRng(0.5));
    expect(ev).toContainEqual({ type: 'mailArrived' });
    expect(s.mailCount).toBe(1);
    expect(s.mailTimer).toBeCloseTo(MAIL_INTERVAL_SEC - 1, 8);
    for (let i = 0; i < 5; i++) {
      s.mailTimer = 1;
      tick(s, 2, constRng(0.5));
    }
    expect(s.mailCount).toBe(BASE_MAIL_CAPACITY);
    s.mailTimer = 1;
    expect(tick(s, 2, constRng(0.5)).some((e) => e.type === 'mailArrived')).toBe(false);
    s.academy = { bigger_mailbox: 2 };
    s.mailTimer = 1;
    tick(s, 2, constRng(0.5));
    expect(s.mailCount).toBe(BASE_MAIL_CAPACITY + 1);
  });

  it('delivers several letters for one long step', () => {
    const s = newState();
    s.squirrelTimer = 1e9;
    s.mailTimer = 10;
    tick(s, 2 * MAIL_INTERVAL_SEC + 10, constRng(0.5));
    expect(s.mailCount).toBe(3);
    expect(s.mailTimer).toBeCloseTo(MAIL_INTERVAL_SEC, 6);
  });

  it('awards trophies once, with collars', () => {
    const s = newState();
    s.squirrelTimer = 1e9;
    s.mailTimer = 1e9;
    s.kennels = [17, 17, 17, 17];
    s.pups = 1e5 + 1; // pack_1k, pack_10k, pack_100k
    const ev = tick(s, 0.1, constRng(0.5));
    expect(ev.filter((e) => e.type === 'trophy')).toHaveLength(3);
    expect(s.trophies).toEqual(['pack_1k', 'pack_10k', 'pack_100k']);
    const earned = ['pack_1k', 'pack_10k', 'pack_100k'].map((id) => TROPHIES.find((t) => t.id === id)!);
    const collars = earned.reduce((a, t) => a + t.collars, 0);
    const bones = earned.reduce((a, t) => a + t.goldenBones, 0);
    expect(s.legendCollars).toBe(collars);
    expect(s.goldenBones).toBe(START_GOLDEN_BONES + bones);
    expect(tick(s, 0.1, constRng(0.5)).filter((e) => e.type === 'trophy')).toHaveLength(0);
    expect(s.legendCollars).toBe(collars);
  });

  it('emits findUpgradeAvailable once per index', () => {
    const s = productive();
    s.squirrelTimer = 1e9;
    s.mailTimer = 1e9;
    s.runEarnings = 0;
    s.vehicles = [5, 5, 5, 5, ...new Array(8).fill(null)];
    s.pups = 200;
    s.training = { comfy_beds: COMFY_MAX, premium_kibble: 15 };
    restoreGates();
    expect(computeStats(s).parkValue).toBeGreaterThan(FINDS[1].unlockParkValue);
    const ev = tick(s, 0.1, constRng(0.5));
    expect(ev).toContainEqual({ type: 'findUpgradeAvailable', findIndex: 1 });
    expect(tick(s, 0.1, constRng(0.5)).some((e) => e.type === 'findUpgradeAvailable')).toBe(false);
    expect(s.notifiedFinds).toEqual([1]);
  });
});

describe('squirrels', () => {
  it('spawns with reward rolled at spawn and resets the timer', () => {
    const s = newState();
    s.squirrelTimer = 0.5;
    s.mailTimer = 1e9;
    // reward roll 0.1 -> cash; incomeSeconds rng 0.5 -> 60; interval rng 0 -> the minimum
    const ev = tick(s, 1, constRng(0.1, 0.5, 0));
    expect(ev).toContainEqual({ type: 'squirrelSpawned', squirrelId: 1 });
    expect(s.squirrels).toHaveLength(1);
    expect(s.squirrels[0].reward).toEqual({ kind: 'cash', incomeSeconds: 60 });
    expect(s.squirrels[0].lifetime).toBe(7);
    expect(s.squirrelTimer).toBeCloseTo(SQUIRREL_INTERVAL_MIN, 10);
    expect(s.nextSquirrelId).toBe(2);
  });

  it('timer scales with Squirrel Spotter', () => {
    const s = newState();
    s.academy = { squirrel_spotter: 25 }; // x2
    s.squirrelTimer = 0.5;
    s.mailTimer = 1e9;
    tick(s, 1, constRng(0.1, 0.5, 1));
    expect(s.squirrelTimer).toBeCloseTo(SQUIRREL_INTERVAL_MAX / 2, 6);
  });

  it('rolls bones and treat rewards', () => {
    const s = newState();
    s.squirrelTimer = 0;
    s.mailTimer = 1e9;
    tick(s, 0.1, constRng(0.7, 0.99, 0.5)); // bones: randInt(min, max) with .99 -> max
    expect(s.squirrels[0].reward).toEqual({ kind: 'goldenBones', amount: SQUIRREL_BONES_MAX });
    s.squirrelTimer = 0;
    tick(s, 0.1, constRng(0.99, 0, 0.5)); // treat 0 -> bacon at half duration
    expect(s.squirrels[1].reward).toEqual({ kind: 'treat', treatId: 'bacon_strip', durationSec: 7200 });
  });

  it('respects the active squirrel limit and expires old ones', () => {
    const s = newState();
    s.mailTimer = 1e9;
    for (let i = 0; i < 4; i++) {
      s.squirrelTimer = 0;
      tick(s, 0.1, constRng(0.1, 0.5, 0.5));
    }
    expect(s.squirrels).toHaveLength(2);
    s.squirrelTimer = 1e9;
    tick(s, 6.5, constRng(0.5));
    expect(s.squirrels).toHaveLength(2);
    tick(s, 0.5, constRng(0.5));
    expect(s.squirrels).toHaveLength(0);
  });
});
