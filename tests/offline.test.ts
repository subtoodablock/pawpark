import { describe, expect, it } from 'vitest';
import { applyOfflineProgress, computeStats } from '../src/core';
import type { GameState } from '../src/core';
import { newState } from './helpers';

function setup(): GameState {
  const s = newState();
  s.kennels = [3, 3, null, null];
  s.pups = 100;
  s.training = { rescue_program: 2 };
  s.vehicles[0] = 3;
  return s;
}

describe('applyOfflineProgress', () => {
  it('does nothing and returns null under 5 seconds', () => {
    const s = setup();
    const before = JSON.stringify(s);
    expect(applyOfflineProgress(s, s.lastSaved + 4000)).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });

  it('simulates elapsed time and reports', () => {
    const s = setup();
    const income = computeStats(s).incomePerSec;
    const r = applyOfflineProgress(s, s.lastSaved + 600_000)!;
    expect(r.elapsedSec).toBe(600);
    expect(r.simulatedSec).toBe(600);
    expect(r.earned).toBeGreaterThan(income * 600 * 0.99);
    expect(r.earned).toBeCloseTo(s.cash, 6);
    // rescue 8/min * 0.5 offline factor for 10 minutes = 40 pups
    expect(r.pupsGained).toBeCloseTo(40, 4);
    expect(s.pups).toBeCloseTo(140, 4);
    expect(s.lastSaved).toBe(1_000_000 + 600_000);
  });

  it('caps at the Treat Jar size', () => {
    const s = setup();
    const r = applyOfflineProgress(s, s.lastSaved + 10 * 3600 * 1000)!;
    expect(r.elapsedSec).toBe(36000);
    expect(r.simulatedSec).toBe(3600);
    s.academy = { bigger_jar: 4 };
    const t = setup();
    t.academy = { bigger_jar: 4 };
    expect(applyOfflineProgress(t, t.lastSaved + 10 * 3600 * 1000)!.simulatedSec).toBe(3 * 3600);
  });

  it('drops zoomies and squirrels, keeps the mail timer running, ticks treats', () => {
    const s = setup();
    s.zoomies = 20;
    s.squirrels = [{ id: 1, age: 0, lifetime: 7, reward: { kind: 'goldenBones', amount: 1 } }];
    s.squirrelTimer = 1;
    s.mailTimer = 100;
    s.treats = [{ id: 'bacon_strip', remaining: 60 }];
    applyOfflineProgress(s, s.lastSaved + 300_000);
    expect(s.zoomies).toBe(0);
    expect(s.squirrels).toHaveLength(0);
    expect(s.squirrelTimer).toBe(1);
    expect(s.mailReady).toBe(true);
    expect(s.treats).toHaveLength(0);
  });

  it('Night Shift raises the offline rescue fraction', () => {
    const s = setup();
    s.academy = { night_shift: 5 };
    const r = applyOfflineProgress(s, s.lastSaved + 600_000)!;
    expect(r.pupsGained).toBeCloseTo(80, 4);
  });

  it('applies active treats while offline', () => {
    const a = setup();
    const b = setup();
    b.treats = [{ id: 'bacon_strip', remaining: 1e6 }];
    const ra = applyOfflineProgress(a, a.lastSaved + 300_000)!;
    const rb = applyOfflineProgress(b, b.lastSaved + 300_000)!;
    expect(rb.earned / ra.earned).toBeCloseTo(2, 3);
  });
});
