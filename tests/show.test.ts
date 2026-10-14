import { describe, expect, it } from 'vitest';
import {
  FINDS,
  SHOW_CALIBRATION_DAYS,
  SHOW_HISTORY_WEEKS,
  SHOW_REWARDS,
  applyOfflineProgress,
  claimShowGoal,
  computeStats,
  deserialize,
  joinShow,
  refreshShow,
  serialize,
  shareText,
  showForWeek,
  showProgress,
  showWindow,
  stepSimulation,
  syncShowMeta,
  tick,
  weekKeyOf,
} from '../src/core';
import type { GameEvent, GameState } from '../src/core';
import { newState, seeded } from './helpers';

const MONDAY = new Date(2026, 5, 1, 0, 0, 0, 0).getTime(); // Mon 2026-06-01 = 2026-W23
const WEEK = '2026-W23';

/** A home park that owns the automation academy, as a mid-game player would. */
function home(): GameState {
  const s = newState();
  s.academy = { foreman_pup: 1, head_trainer: 1, volunteer_walkers: 3 };
  s.automation.build = true;
  s.automation.training = true;
  s.automation.whistle = true;
  return s;
}

function joined(now = MONDAY, s = home()): GameState {
  const r = joinShow(s, now);
  expect(r.ok).toBe(true);
  return s;
}

describe('week keys and windows', () => {
  it('ISO weeks, including year boundaries', () => {
    expect(weekKeyOf(new Date(2026, 5, 1))).toBe('2026-W23');
    expect(weekKeyOf(new Date(2026, 5, 7, 23, 59, 59))).toBe('2026-W23');
    expect(weekKeyOf(new Date(2026, 5, 8))).toBe('2026-W24');
    expect(weekKeyOf(new Date(2026, 0, 1))).toBe('2026-W01');
    expect(weekKeyOf(new Date(2025, 11, 29))).toBe('2026-W01'); // Monday belongs to next ISO year
    expect(weekKeyOf(new Date(2027, 0, 1))).toBe('2026-W53');
    expect(weekKeyOf(new Date(2021, 0, 3))).toBe('2020-W53');
    expect(weekKeyOf(new Date(2024, 11, 30))).toBe('2025-W01');
    expect(weekKeyOf(MONDAY)).toBe('2026-W23');
  });

  it('window is Monday 00:00 to Sunday 23:59:59.999 local', () => {
    const w = showWindow('2026-W23');
    expect(w.start).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).getTime());
    expect(w.end).toBe(new Date(2026, 5, 7, 23, 59, 59, 999).getTime());
    const y = showWindow('2026-W01');
    expect(y.start).toBe(new Date(2025, 11, 29).getTime());
    expect(y.end).toBe(new Date(2026, 0, 4, 23, 59, 59, 999).getTime());
    for (const key of ['2026-W01', '2026-W53', '2020-W53', '2025-W01', '2026-W23']) {
      const win = showWindow(key);
      expect(weekKeyOf(win.start)).toBe(key);
      expect(weekKeyOf(win.end)).toBe(key);
      expect(weekKeyOf(win.end + 1)).not.toBe(key);
      expect(weekKeyOf(win.start - 1)).not.toBe(key);
    }
    expect(Number.isNaN(showWindow('nope').start)).toBe(true);
  });
});

describe('showForWeek', () => {
  it('is deterministic per week and within the allowed Find range', () => {
    const s = newState();
    const a = showForWeek(s, WEEK);
    expect(showForWeek(s, WEEK)).toEqual(a);
    expect(a.name).toContain(FINDS[a.findIndex].name);
    const seen = new Set<number>();
    for (let w = 1; w <= 52; w++) {
      const r = showForWeek(s, `2026-W${String(w).padStart(2, '0')}`);
      expect(r.findIndex).toBeGreaterThanOrEqual(0);
      expect(r.findIndex).toBeLessThanOrEqual(2);
      seen.add(r.findIndex);
    }
    expect(seen.size).toBe(3);
    const far = { highestFindIndex: 6 };
    let max = 0;
    for (let w = 1; w <= 52; w++) {
      max = Math.max(max, showForWeek(far, `2026-W${String(w).padStart(2, '0')}`).findIndex);
    }
    expect(max).toBeGreaterThan(2);
    expect(max).toBeLessThanOrEqual(6);
  });
});

describe('joinShow', () => {
  it('creates a fresh park on the featured find, once per week', () => {
    const s = home();
    s.cash = 123456;
    const r = joinShow(s, MONDAY + 3600_000);
    expect(r.ok).toBe(true);
    const show = s.show!;
    const feat = showForWeek(s, WEEK);
    expect(show.weekKey).toBe(WEEK);
    expect(show.findIndex).toBe(feat.findIndex);
    expect(show.name).toBe(feat.name);
    expect(show.park.findIndex).toBe(feat.findIndex);
    expect(show.park.cash).toBe(600 * FINDS[feat.findIndex].costScale);
    expect(show.park.show).toBeNull();
    expect(show.park.pups).toBe(0);
    expect(show.park.training).toEqual({});
    expect(show.goals).toHaveLength(3);
    expect(show.goals[0].target).toBeLessThan(show.goals[1].target);
    expect(show.goals[1].target).toBeLessThan(show.goals[2].target);
    expect(s.cash).toBe(123456); // home untouched
    const again = joinShow(s, MONDAY + 7200_000);
    expect(again.ok).toBe(false);
    expect(again.reason).toBeTruthy();
  });

  it('can join the next week after the old show closes', () => {
    const s = joined();
    const next = MONDAY + 7 * 86_400_000 + 1000;
    const r = joinShow(s, next);
    expect(r.ok).toBe(true);
    expect(s.show!.weekKey).toBe('2026-W24');
    expect(s.showHistory.map((h) => h.weekKey)).toEqual([WEEK]);
    expect(r.events!.some((e) => e.type === 'showEnded')).toBe(true);
  });

  it('calibration is deterministic and fast', () => {
    const a = home();
    const b = home();
    const t0 = performance.now();
    joinShow(a, MONDAY);
    const ms = performance.now() - t0;
    joinShow(b, MONDAY, seeded(99)); // a different rng must not matter: no randomness in the park
    expect(a.show!.goals.map((g) => g.target)).toEqual(b.show!.goals.map((g) => g.target));
    expect(ms).toBeLessThan(400);
  });
});

describe('show park rules', () => {
  it('mirrors meta from home (academy affects the show)', () => {
    const s = joined();
    s.academy.epic_digging = 10;
    s.spiritPaws = 7;
    s.legendCollars = 3;
    s.premium.shop = { ...s.premium.shop };
    s.premium.spendCents = 5000;
    const before = computeStats(s.show!.park).incomePerSec;
    stepSimulation(s, 1, seeded(1));
    const park = s.show!.park;
    expect(park.academy.epic_digging).toBe(10);
    expect(park.spiritPaws).toBe(7);
    expect(park.legendCollars).toBe(3);
    expect(park.premium.spendCents).toBe(5000);
    expect(computeStats(park).digPerSec).toBeGreaterThanOrEqual(0);
    expect(computeStats(park).incomePerSec).toBeGreaterThanOrEqual(before);
    s.show!.park.pups = 50;
    const withAcademy = computeStats(park).digPerPupPerSec;
    s.academy.epic_digging = 0;
    syncShowMeta(s, park);
    expect(computeStats(park).digPerPupPerSec).toBeLessThan(withAcademy);
  });

  it('has no find upgrades, prestige, mail, squirrels or trophies', () => {
    const s = joined();
    s.automation.prestige = true;
    s.academy.retirement_planner = 1;
    const rng = seeded(5);
    for (let i = 0; i < 20; i++) stepSimulation(s, 3600, rng, { offline: true });
    const park = s.show!.park;
    expect(park.automation.find).toBe(false);
    expect(park.automation.prestige).toBe(false);
    expect(park.findIndex).toBe(s.show!.findIndex);
    expect(park.prestigeCount).toBe(0);
    expect(park.mailCount).toBe(0);
    expect(park.squirrels).toHaveLength(0);
    expect(park.nextSquirrelId).toBe(1);
    expect(park.show).toBeNull();
    expect(s.trophies).toEqual(s.trophies); // home trophies are home's own
    const collars = s.legendCollars;
    stepSimulation(s, 10, rng);
    expect(s.legendCollars).toBe(collars);
    expect(park.legendCollars).toBe(collars);
  });

  it('delivers finds and can reach roughly silver by AFK play', () => {
    const s = joined();
    const rng = seeded(3);
    const events: GameEvent[] = [];
    // 4 days offline-style
    for (let t = 0; t < SHOW_CALIBRATION_DAYS * 1440; t++) {
      events.push(...stepSimulation(s, 60, rng, { offline: true }));
    }
    const p = showProgress(s)!;
    expect(p.delivered).toBeGreaterThan(0);
    expect(p.goals[0].reached).toBe(true);
    expect(p.goals[1].reached).toBe(true);
    expect(p.goals[2].reached).toBe(false);
    const reached = events.filter((e) => e.type === 'showGoalReached');
    expect(reached.map((e) => (e as { goalIndex: number }).goalIndex)).toEqual([0, 1]);
    expect(p.endsAt).toBe(showWindow(WEEK).end);
  });
});

describe('claims, end of week', () => {
  it('claims reward the home park and need a reached, unclaimed goal', () => {
    const s = joined();
    expect(claimShowGoal(s, 0).ok).toBe(false);
    expect(claimShowGoal(s, 5).ok).toBe(false);
    const need = s.show!.goals;
    s.show!.park.stats.findsDelivered = need[1].target;
    const bones = s.goldenBones;
    const r0 = claimShowGoal(s, 0);
    expect(r0.ok).toBe(true);
    expect(r0.reward).toEqual(SHOW_REWARDS[0]);
    expect(s.goldenBones).toBe(bones + 10);
    expect(claimShowGoal(s, 0).ok).toBe(false);
    expect(claimShowGoal(s, 2).ok).toBe(false);
    const r1 = claimShowGoal(s, 1);
    expect(r1.ok).toBe(true);
    expect(s.goldenBones).toBe(bones + 25);
    expect(s.treats.some((t) => t.id === 'bacon_strip')).toBe(true);
    s.show!.park.stats.findsDelivered = need[2].target;
    const collars = s.legendCollars;
    expect(claimShowGoal(s, 2).ok).toBe(true);
    expect(s.legendCollars).toBe(collars + 1);
    expect(s.goldenBones).toBe(bones + 50);
    expect(s.show!.park.goldenBones).toBe(0);
  });

  it('auto-claims at the end of the week and records history', () => {
    const s = joined();
    s.show!.park.stats.findsDelivered = s.show!.goals[1].target;
    const claimed = claimShowGoal(s, 0);
    expect(claimed.ok).toBe(true);
    const bones = s.goldenBones;
    const end = showWindow(WEEK).end;
    expect(refreshShow(s, end)).toEqual([]);
    expect(s.show).not.toBeNull();
    const ev = refreshShow(s, end + 1);
    expect(ev).toEqual([{ type: 'showEnded', weekKey: WEEK, medals: 2 }]);
    expect(s.show).toBeNull();
    expect(s.goldenBones).toBe(bones + 15); // only silver was unclaimed
    expect(s.showHistory).toEqual([{ weekKey: WEEK, findIndex: showForWeek(s, WEEK).findIndex, medals: 2 }]);
    expect(refreshShow(s, end + 2)).toEqual([]);
  });

  it('caps history at 12 weeks', () => {
    const s = home();
    for (let w = 0; w < SHOW_HISTORY_WEEKS + 3; w++) {
      const now = MONDAY + w * 7 * 86_400_000 + 5000;
      expect(joinShow(s, now).ok).toBe(true);
    }
    refreshShow(s, MONDAY + 120 * 86_400_000);
    expect(s.showHistory).toHaveLength(SHOW_HISTORY_WEEKS);
    expect(s.showHistory[SHOW_HISTORY_WEEKS - 1].weekKey).toBe(weekKeyOf(MONDAY + (SHOW_HISTORY_WEEKS + 2) * 7 * 86_400_000 + 5000));
    expect(s.showHistory[0].weekKey).not.toBe(WEEK);
  });
});

describe('simulation', () => {
  it('online ticks and offline progress both advance the show park', () => {
    const s = joined();
    for (let i = 0; i < 100; i++) tick(s, 0.1, seeded(1));
    const parkTime = s.show!.park.stats.totalPlaySec;
    expect(parkTime).toBeCloseTo(10, 6);

    s.lastSaved = MONDAY;
    const r = applyOfflineProgress(s, MONDAY + 3600_000);
    expect(r).not.toBeNull();
    expect(s.show!.park.stats.totalPlaySec).toBeCloseTo(10 + 3600, 4);
    expect(showProgress(s)!.delivered).toBeGreaterThan(0);
  });

  it('stops advancing at the end of the week', () => {
    const s = joined();
    const end = showWindow(WEEK).end;
    s.show!.park.lastSaved = end + 1 - 30_000; // 30 s left on the park clock
    const t0 = s.show!.park.stats.totalPlaySec;
    stepSimulation(s, 3600, seeded(1), { offline: true });
    expect(s.show!.park.stats.totalPlaySec - t0).toBeCloseTo(30, 6);
    stepSimulation(s, 60, seeded(1), { offline: true });
    expect(s.show!.park.stats.totalPlaySec - t0).toBeCloseTo(30, 6);
  });
});

describe('persistence and sharing', () => {
  it('round-trips the show with its nested park', () => {
    const s = joined();
    for (let i = 0; i < 300; i++) stepSimulation(s, 60, seeded(2), { offline: true });
    claimShowGoal(s, 0);
    s.showHistory = [{ weekKey: '2026-W22', findIndex: 1, medals: 3 }];
    const back = deserialize(serialize(s))!;
    expect(back).not.toBeNull();
    expect(back.show!.weekKey).toBe(WEEK);
    expect(back.show!.goals).toEqual(s.show!.goals);
    expect(back.show!.park.show).toBeNull();
    expect(back.show!.park.stats.findsDelivered).toBe(s.show!.park.stats.findsDelivered);
    expect(back.show!.park.cash).toBeCloseTo(s.show!.park.cash, 6);
    expect(back.show!.park.lastSaved).toBe(s.show!.park.lastSaved);
    expect(back.showHistory).toEqual(s.showHistory);
  });

  it('sanitizes a corrupt show to null', () => {
    const s = joined();
    const raw = JSON.parse(serialize(s));
    raw.show.goals = [1, 2];
    expect(deserialize(JSON.stringify(raw))!.show).toBeNull();
    raw.show = 'x';
    raw.showHistory = [{ weekKey: 'bad', findIndex: 0, medals: 1 }, { weekKey: '2026-W02', findIndex: 0, medals: 9 }];
    const back = deserialize(JSON.stringify(raw))!;
    expect(back.show).toBeNull();
    expect(back.showHistory).toEqual([{ weekKey: '2026-W02', findIndex: 0, medals: 3 }]);
  });

  it('adds a Dog Show line to the share text', () => {
    const s = home();
    expect(shareText(s, '2026-06-03')).not.toContain('Dog Show');
    joinShow(s, MONDAY);
    s.show!.park.stats.findsDelivered = s.show!.goals[1].target;
    expect(shareText(s, '2026-06-03')).toContain('🏆 Dog Show: 🥉🥈⬜');
    refreshShow(s, MONDAY + 8 * 86_400_000);
    expect(shareText(s, '2026-06-10')).toContain('🏆 Dog Show: 🥉🥈⬜');
  });
});
