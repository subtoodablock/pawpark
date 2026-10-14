import { describe, expect, it } from 'vitest';
import { applyOfflineProgress, computeStats, BASE_MAIL_CAPACITY } from '../src/core';
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
    expect(r.lostSec).toBe(0);
    expect(r.earned).toBeGreaterThan(income * 600 * 0.99);
    expect(r.earned).toBeCloseTo(s.cash, 6);
    // rescue (2 + 4)/min x 2 kennels, at 100% offline, for 10 minutes = 120 pups
    expect(r.pupsGained).toBeCloseTo(120, 4);
    expect(s.pups).toBeCloseTo(220, 4);
    expect(s.lastSaved).toBe(1_000_000 + 600_000);
    expect(r.purchases).toBe(0);
    expect(r.prestiges).toBe(0);
    expect(r.findsUnlocked).toEqual([]);
    expect(r.endgame).toBe(false);
  });

  it('caps at the Treat Jar size and reports the lost time', () => {
    const s = setup();
    const r = applyOfflineProgress(s, s.lastSaved + 10 * 3600 * 1000)!;
    expect(r.elapsedSec).toBe(36000);
    expect(r.simulatedSec).toBe(8 * 3600);
    expect(r.lostSec).toBe(2 * 3600);
    const t = setup();
    t.academy = { bigger_jar: 4 }; // +8h
    const r2 = applyOfflineProgress(t, t.lastSaved + 20 * 3600 * 1000)!;
    expect(r2.simulatedSec).toBe(16 * 3600);
    expect(r2.lostSec).toBe(4 * 3600);
  });

  it('drops zoomies and squirrels, keeps the mail timer running, ticks treats', () => {
    const s = setup();
    s.zoomies = 20;
    s.squirrels = [{ id: 1, age: 0, lifetime: 7, reward: { kind: 'goldenBones', amount: 1 } }];
    s.mailTimer = 100;
    s.treats = [{ id: 'bacon_strip', remaining: 60 }];
    const r = applyOfflineProgress(s, s.lastSaved + 300_000)!;
    expect(s.zoomies).toBe(0);
    expect(s.squirrels).toHaveLength(0);
    expect(s.mailCount).toBe(1);
    expect(r.mailWaiting).toBe(1);
    expect(s.treats).toHaveLength(0);
  });

  it('piles mail up to the mailbox capacity', () => {
    const s = setup();
    const r = applyOfflineProgress(s, s.lastSaved + 8 * 3600 * 1000)!;
    expect(r.mailWaiting).toBe(BASE_MAIL_CAPACITY);
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
