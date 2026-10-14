import { describe, expect, it } from 'vitest';
import {
  ACADEMY, DAILY_DIG_POOL, DAILY_MODIFIERS, DAILY_TREATS, DIGS_PER_DAY, DIG_BONUS_BONES, DIG_BONUS_STARS,
  EARN_DIG_MIN, PARK_LEVEL_THRESHOLDS, PARK_TITLES, STREAK_MILESTONES, TRAINING, TROPHIES, VIP_TIERS,
  applyOfflineProgress, buyKennel, buyTraining, buyTreat, catchSquirrel, claimDailyDig, claimDailyDigBonus,
  claimDailyTreat, computeStats, createInitialState, dailyDigProgress, dayDiff, dayKeyOf, deserialize,
  hashString, openMail, parkLevel, parkTitle, prestige, refreshDaily, runAutomation, seededRng, serialize,
  shareText, statValue, tick, adopt, buyVehicle, vipTierFor,
} from '../src/core';
import type { GameState } from '../src/core';
import { newState, seeded } from './helpers';

const d = (n: number) => `2026-03-${String(n).padStart(2, '0')}`;

function withDigs(s: GameState, kinds: string[], day = d(1)) {
  s.daily.digsDay = day;
  s.daily.lastSeenDay = day;
  s.daily.digs = kinds.map((k) => ({ kind: k as never, target: DAILY_DIG_POOL.find((p) => p.kind === k)!.target, claimed: false }));
}

describe('date utils', () => {
  it('dayKeyOf formats local dates', () => {
    expect(dayKeyOf(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
    expect(dayKeyOf(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });
  it('dayDiff handles month, year, leap and DST boundaries', () => {
    expect(dayDiff('2026-03-01', '2026-03-02')).toBe(1);
    expect(dayDiff('2026-03-02', '2026-03-01')).toBe(-1);
    expect(dayDiff('2026-01-31', '2026-02-01')).toBe(1);
    expect(dayDiff('2025-12-31', '2026-01-01')).toBe(1);
    expect(dayDiff('2024-02-28', '2024-03-01')).toBe(2);
    expect(dayDiff('2026-03-07', '2026-03-09')).toBe(2); // US spring forward
    expect(dayDiff('2026-10-31', '2026-11-02')).toBe(2); // fall back
    expect(dayDiff('2026-01-01', '2027-01-01')).toBe(365);
    expect(dayDiff('2026-05-05', '2026-05-05')).toBe(0);
  });
  it('hash and rng are deterministic', () => {
    expect(hashString('2026-03-01')).toBe(hashString('2026-03-01'));
    expect(hashString('2026-03-01')).not.toBe(hashString('2026-03-02'));
    const a = seededRng(5); const b = seededRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const v = seededRng(9)();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

describe('daily treat streak', () => {
  it('first claim starts a streak and pays day 1', () => {
    const s = newState();
    const bones = s.goldenBones;
    const r = claimDailyTreat(s, d(1));
    expect(r.ok).toBe(true);
    expect(r.streak).toBe(1);
    expect(r.reward).toEqual(DAILY_TREATS[0]);
    expect(s.goldenBones).toBe(bones + (DAILY_TREATS[0] as { amount: number }).amount);
  });
  it('same-day double claim fails', () => {
    const s = newState();
    claimDailyTreat(s, d(1));
    const bones = s.goldenBones;
    expect(claimDailyTreat(s, d(1)).ok).toBe(false);
    expect(s.goldenBones).toBe(bones);
    expect(s.daily.streak).toBe(1);
  });
  it('consecutive days increase and day 6/7 rewards are right', () => {
    const s = newState();
    for (let i = 1; i <= 5; i++) claimDailyTreat(s, d(i));
    const r6 = claimDailyTreat(s, d(6));
    expect(r6.reward).toEqual({ kind: 'treat', treatId: 'bacon_strip' });
    expect(s.treats.some((t) => t.id === 'bacon_strip')).toBe(true);
    const bones = s.goldenBones;
    const r7 = claimDailyTreat(s, d(7));
    expect(r7.streak).toBe(7);
    const bundle = DAILY_TREATS[6] as { goldenBones: number; stars: number };
    expect(s.goldenBones).toBe(bones + bundle.goldenBones);
    expect(s.premium.stars).toBe(bundle.stars);
    expect(claimDailyTreat(s, d(8)).reward).toEqual(DAILY_TREATS[0]); // cycle wraps
    expect(s.daily.bestStreak).toBe(8);
  });
  it('a gap without freezes resets to 1 but keeps bestStreak', () => {
    const s = newState();
    claimDailyTreat(s, d(1)); claimDailyTreat(s, d(2)); claimDailyTreat(s, d(3));
    const r = claimDailyTreat(s, d(5));
    expect(r.streak).toBe(1);
    expect(s.daily.bestStreak).toBe(3);
  });
  it('freezes cover missed days and are consumed', () => {
    const s = newState();
    claimDailyTreat(s, d(1)); claimDailyTreat(s, d(2));
    s.daily.streakFreezes = 2;
    const r = claimDailyTreat(s, d(4)); // missed 1 day
    expect(r.streak).toBe(3);
    expect(s.daily.streakFreezes).toBe(1);
    const r2 = claimDailyTreat(s, d(7)); // missed 2 days, only 1 freeze -> reset
    expect(r2.streak).toBe(1);
    expect(s.daily.streakFreezes).toBe(1);
  });
  it('two freezes cover a three-day gap', () => {
    const s = newState();
    claimDailyTreat(s, d(1));
    s.daily.streakFreezes = 2;
    expect(claimDailyTreat(s, d(4)).streak).toBe(2);
    expect(s.daily.streakFreezes).toBe(0);
  });
  it('anti-rewind: earlier day is refused and changes nothing', () => {
    const s = newState();
    refreshDaily(s, d(10));
    const before = JSON.stringify(s.daily);
    expect(claimDailyTreat(s, d(9)).ok).toBe(false);
    expect(refreshDaily(s, d(9))).toEqual([]);
    expect(JSON.stringify(s.daily)).toBe(before);
    expect(s.daily.lastSeenDay).toBe(d(10));
  });
  it('milestones pay stars once, ever', () => {
    const s = newState();
    s.daily.streak = 29; s.daily.lastClaimDay = d(1); s.daily.lastSeenDay = d(1);
    const r = claimDailyTreat(s, d(2));
    expect(r.streak).toBe(30);
    expect(r.events).toEqual([{ type: 'streakMilestone', streak: 30, stars: STREAK_MILESTONES[0].stars }]);
    expect(s.premium.stars).toBe(STREAK_MILESTONES[0].stars);
    // lose the streak then climb to 30 again
    s.daily.streak = 29; s.daily.lastClaimDay = d(10);
    const r2 = claimDailyTreat(s, d(11));
    expect(r2.streak).toBe(30);
    expect(r2.events).toEqual([]);
    expect(s.premium.stars).toBe(STREAK_MILESTONES[0].stars);
  });
});

describe('daily digs', () => {
  it('are deterministic per dayKey and distinct', () => {
    const a = newState(); const b = newState();
    refreshDaily(a, '2026-10-14'); refreshDaily(b, '2026-10-14');
    expect(a.daily.digs.map((x) => x.kind)).toEqual(b.daily.digs.map((x) => x.kind));
    expect(a.daily.modifierId).toBe(b.daily.modifierId);
    expect(a.daily.digs).toHaveLength(DIGS_PER_DAY);
    const kinds = new Set<string>();
    const mods = new Set<string>();
    for (let i = 1; i <= 28; i++) {
      const s = newState();
      refreshDaily(s, `2026-02-${String(i).padStart(2, '0')}`);
      const k = s.daily.digs.map((x) => x.kind);
      expect(new Set(k).size).toBe(DIGS_PER_DAY);
      k.forEach((x) => kinds.add(x));
      mods.add(s.daily.modifierId!);
      expect(DAILY_MODIFIERS.some((m) => m.id === s.daily.modifierId)).toBe(true);
    }
    expect(kinds.size).toBeGreaterThan(5);
    expect(mods.size).toBeGreaterThan(2);
  });
  it('refresh is idempotent within a day and resets on a new day', () => {
    const s = newState();
    refreshDaily(s, d(1));
    s.daily.counters.letters = 2;
    s.daily.digs[0].claimed = true;
    s.daily.digBonusClaimed = true;
    refreshDaily(s, d(1));
    expect(s.daily.counters.letters).toBe(2);
    expect(s.daily.digs[0].claimed).toBe(true);
    refreshDaily(s, d(2));
    expect(s.daily.counters.letters).toBe(0);
    expect(s.daily.digs.every((x) => !x.claimed)).toBe(true);
    expect(s.daily.digBonusClaimed).toBe(false);
    expect(s.daily.digsDay).toBe(d(2));
  });
  it('earn target is max(min, income x 1h)', () => {
    // find a day that rolls "earn"
    let day = '';
    for (let i = 1; i <= 28 && !day; i++) {
      const k = `2026-02-${String(i).padStart(2, '0')}`;
      const t = newState(); refreshDaily(t, k);
      if (t.daily.digs.some((x) => x.kind === 'earn')) day = k;
    }
    expect(day).not.toBe('');
    const s = newState();
    refreshDaily(s, day);
    expect(s.daily.digs.find((x) => x.kind === 'earn')!.target).toBe(EARN_DIG_MIN);
    const r = newState();
    r.kennels = [3, null, null, null]; r.vehicles = [3, null, null, null]; r.pups = 5000;
    const inc = computeStats(r).incomePerSec;
    expect(inc * 3600).toBeGreaterThan(EARN_DIG_MIN);
    refreshDaily(r, day);
    expect(r.daily.digs.find((x) => x.kind === 'earn')!.target).toBeCloseTo(inc * 3600, 6);
  });
  it('claim and bonus rules', () => {
    const s = newState();
    withDigs(s, ['letters', 'squirrels', 'treat']);
    expect(claimDailyDig(s, 0).ok).toBe(false); // not done
    expect(claimDailyDig(s, 9).ok).toBe(false);
    expect(claimDailyDigBonus(s).ok).toBe(false);
    s.daily.counters.letters = 4; s.daily.counters.squirrels = 3; s.daily.counters.treat = 1;
    expect(dailyDigProgress(s, 0)).toEqual({ value: 4, target: 4, done: true });
    const bones = s.goldenBones;
    expect(claimDailyDig(s, 0).ok).toBe(true);
    expect(s.goldenBones).toBe(bones + DAILY_DIG_POOL.find((p) => p.kind === 'letters')!.rewardBones);
    expect(claimDailyDig(s, 0).ok).toBe(false);
    expect(claimDailyDigBonus(s).ok).toBe(false); // not all claimed
    claimDailyDig(s, 1); claimDailyDig(s, 2);
    const b2 = s.goldenBones;
    expect(claimDailyDigBonus(s).ok).toBe(true);
    expect(s.goldenBones).toBe(b2 + DIG_BONUS_BONES);
    expect(s.premium.stars).toBe(DIG_BONUS_STARS);
    expect(claimDailyDigBonus(s).ok).toBe(false);
  });
  it('progress is capped at target', () => {
    const s = newState();
    withDigs(s, ['letters', 'squirrels', 'treat']);
    s.daily.counters.letters = 99;
    expect(dailyDigProgress(s, 0).value).toBe(4);
  });
});

describe('daily counters', () => {
  const c = (s: GameState) => s.daily.counters;
  it('squirrels (manual) and letters', () => {
    const s = newState();
    s.squirrels.push({ id: 1, age: 0, lifetime: 7, reward: { kind: 'goldenBones', amount: 1 } });
    catchSquirrel(s, 1);
    expect(c(s).squirrels).toBe(1);
    s.mailCount = 2;
    openMail(s, seeded(1));
    expect(c(s).letters).toBe(1);
  });
  it('whistle counts only taps; zoomies counts crossing the target once', () => {
    const s = newState();
    s.kennels = [5, 5, null, null];
    s.adoptionStock = 1000;
    adopt(s, 5, false);
    expect(c(s).whistle).toBe(0);
    adopt(s, 5, true);
    expect(c(s).whistle).toBe(5);
    expect(c(s).zoomies).toBe(0);
    adopt(s, 30, true);
    expect(c(s).zoomies).toBe(1);
    adopt(s, 5, true);
    expect(c(s).zoomies).toBe(1);
    expect(DAILY_DIG_POOL.find((p) => p.kind === 'zoomies')!.target).toBe(20);
  });
  it('zoomies dig still counts when max zoomies exceeds the adoption stock', () => {
    const s = newState();
    s.kennels = [5, 5, null, null];
    s.adoptionStock = 50;
    s.academy.max_zoomies = 5;
    adopt(s, 19, true);
    expect(c(s).zoomies).toBe(0);
    adopt(s, 1, true);
    expect(c(s).zoomies).toBe(1);
  });
  it('training and buildings count manual purchases', () => {
    const s = newState();
    s.cash = 1e12;
    const id = TRAINING[0].id;
    buyTraining(s, id, 3);
    expect(c(s).training).toBe(3);
    buyKennel(s, 1);
    buyVehicle(s, 1);
    expect(c(s).buildings).toBe(2);
    expect(buyKennel(newState(), 1).ok).toBe(false);
  });
  it('automation purchases count', () => {
    const s = newState();
    s.academy = { foreman_pup: 1, head_trainer: 1 };
    s.automation.build = true; s.automation.training = true;
    s.cash = 1e6; s.pups = 50;
    runAutomation(s);
    expect(c(s).training + c(s).buildings).toBeGreaterThan(0);
    const total = Object.values(s.training).reduce((a, b) => a + b, 0)
      + s.kennels.filter((x, i) => x !== null && (i > 0 || x > 0)).length;
    expect(c(s).training + c(s).buildings).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThan(0);
  });
  it('earn counts online and offline; treats count buys and free activations', () => {
    const s = newState();
    s.kennels = [3, null, null, null]; s.vehicles = [3, null, null, null]; s.pups = 2000;
    const inc = computeStats(s).incomePerSec;
    tick(s, 10, seeded(1));
    expect(c(s).earn).toBeCloseTo(inc * 10, 3);
    s.lastSaved = 0;
    const e0 = c(s).earn;
    applyOfflineProgress(s, 3600 * 1000);
    expect(c(s).earn).toBeGreaterThan(e0 + inc * 1000);
    const t = newState();
    t.goldenBones = 100;
    buyTreat(t, 'bacon_strip');
    expect(t.daily.counters.treat).toBe(1);
  });
  it('daily treat day 6 activates a free treat that counts', () => {
    const s = newState();
    s.daily.streak = 5; s.daily.lastClaimDay = d(5); s.daily.lastSeenDay = d(5);
    claimDailyTreat(s, d(6));
    expect(c(s).treat).toBe(1);
  });
  it('hound catches offline count squirrels', () => {
    const s = newState();
    s.academy = { squirrel_hound: 20 };
    s.lastSaved = 0;
    applyOfflineProgress(s, 8 * 3600 * 1000);
    expect(s.stats.squirrelsCaught).toBeGreaterThan(0);
    expect(c(s).squirrels).toBe(s.stats.squirrelsCaught);
  });
  it('emits dailyDigComplete once, only online', () => {
    const s = newState();
    withDigs(s, ['letters', 'squirrels', 'treat']);
    expect(tick(s, 1, seeded(1)).filter((e) => e.type === 'dailyDigComplete')).toHaveLength(0);
    s.mailCount = 4;
    for (let i = 0; i < 4; i++) openMail(s, seeded(i + 1));
    const ev = tick(s, 1, seeded(1)).filter((e) => e.type === 'dailyDigComplete');
    expect(ev).toEqual([{ type: 'dailyDigComplete', index: 0 }]);
    expect(tick(s, 1, seeded(1)).filter((e) => e.type === 'dailyDigComplete')).toHaveLength(0);
    // offline completion is silent
    const o = newState();
    withDigs(o, ['letters', 'squirrels', 'treat']);
    tick(o, 1, seeded(1));
    o.daily.counters.letters = 4;
    o.lastSaved = 0;
    applyOfflineProgress(o, 60_000);
    expect(tick(o, 1, seeded(1)).filter((e) => e.type === 'dailyDigComplete')).toHaveLength(0);
  });
  it('prestige keeps daily and premium', () => {
    const s = newState();
    s.runEarnings = 1e12; s.lifetimeEarnings = 1e12;
    s.daily.streak = 4; s.premium.stars = 7; s.premium.spendCents = 500; s.premium.shop = { star_beds: 2 };
    expect(prestige(s).ok).toBe(true);
    expect(s.daily.streak).toBe(4);
    expect(s.premium.stars).toBe(7);
    expect(s.premium.shop).toEqual({ star_beds: 2 });
  });
});

describe('modifier, park level, vip in stats', () => {
  it('daily modifier multiplies its stat', () => {
    const s = newState();
    const base = statValue(s, 'findValue');
    s.daily.modifierId = 'fetch_fest';
    expect(statValue(s, 'findValue')).toBeCloseTo(base * 1.15);
    expect(computeStats(s).modifier?.id).toBe('fetch_fest');
    s.daily.modifierId = 'lucky_paws';
    s.kennels = [3, null, null, null]; s.vehicles = [3, null, null, null]; s.pups = 2000;
    const a = computeStats(s);
    s.daily.modifierId = null;
    const b = computeStats(s);
    expect(a.incomePerSec / b.incomePerSec).toBeCloseTo(1.1);
    expect(a.parkValue / b.parkValue).toBeCloseTo(1.1);
    expect(b.modifier).toBeNull();
  });
  it('mail rush doubles letter rate', () => {
    const s = newState();
    s.daily.modifierId = 'mail_rush';
    s.mailTimer = 3600;
    tick(s, 3601, seeded(1));
    expect(s.mailCount).toBe(1);
    expect(s.mailTimer).toBeGreaterThan(3500); // next one in ~1 h
  });
  it('park level is monotonic and titles step every 10 levels', () => {
    expect(parkLevel(0)).toBe(1);
    expect(parkLevel(999)).toBe(1);
    expect(parkLevel(1000)).toBe(1);
    expect(parkLevel(PARK_LEVEL_THRESHOLDS[1])).toBe(2);
    let prev = 0;
    for (let e = 0; e < 45; e += 0.5) {
      const l = parkLevel(Math.pow(10, e));
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
    expect(parkLevel(1e300)).toBe(PARK_LEVEL_THRESHOLDS.length);
    for (let i = 1; i < PARK_LEVEL_THRESHOLDS.length; i++) {
      expect(PARK_LEVEL_THRESHOLDS[i]).toBeGreaterThan(PARK_LEVEL_THRESHOLDS[i - 1]);
    }
    expect(parkTitle(1)).toBe(PARK_TITLES[0]);
    expect(parkTitle(9)).toBe(PARK_TITLES[0]);
    expect(parkTitle(10)).toBe(PARK_TITLES[1]);
    expect(parkTitle(10_000)).toBe(PARK_TITLES[PARK_TITLES.length - 1]);
    const s = newState();
    s.lifetimeEarnings = 1e9;
    const st = computeStats(s);
    expect(st.parkLevel).toBe(parkLevel(1e9));
    expect(st.parkTitle).toBe(parkTitle(st.parkLevel));
  });
  it('vip perks replace instead of stacking', () => {
    expect(vipTierFor(0)).toBe(0);
    expect(vipTierFor(499)).toBe(0);
    expect(vipTierFor(500)).toBe(1);
    expect(vipTierFor(2000)).toBe(2);
    expect(vipTierFor(5000)).toBe(3);
    expect(vipTierFor(10000)).toBe(4);
    expect(vipTierFor(25000)).toBe(5);
    expect(vipTierFor(1e9)).toBe(5);
    const s = newState();
    const mail0 = computeStats(s).mailCapacity;
    const off0 = computeStats(s).offlineCapSec;
    s.premium.spendCents = 500;
    expect(statValue(s, 'earnings')).toBeCloseTo(1 + VIP_TIERS[1].earningsBonus);
    s.premium.spendCents = 2000;
    expect(statValue(s, 'earnings')).toBeCloseTo(1 + VIP_TIERS[2].earningsBonus);
    expect(computeStats(s).mailCapacity).toBe(mail0 + 1);
    s.premium.spendCents = 5000;
    expect(statValue(s, 'earnings')).toBeCloseTo(1 + VIP_TIERS[3].earningsBonus);
    expect(computeStats(s).offlineCapSec).toBe(off0 + 2 * 3600);
    s.premium.spendCents = 25000;
    expect(statValue(s, 'earnings')).toBeCloseTo(1 + VIP_TIERS[5].earningsBonus);
    expect(computeStats(s).vipTier).toBe(5);
  });
});

describe('share text', () => {
  it('matches the snapshot format', () => {
    const s = newState();
    s.lifetimeEarnings = PARK_LEVEL_THRESHOLDS[24]; // Park Level 25
    s.findIndex = 2;
    s.spiritPaws = 3_400_000;
    s.trophies = ['a', 'b'];
    s.daily.streak = 12;
    withDigs(s, ['letters', 'squirrels', 'treat'], '2026-10-14');
    s.daily.digs[0].claimed = true;
    s.daily.counters.squirrels = 3;
    expect(parkLevel(s.lifetimeEarnings)).toBe(25);
    expect(shareText(s, '2026-10-14')).toMatchInlineSnapshot(`
      "🐾 Paw Park — Lv 25 · Pack Walker
      🧸 Squeaky Toy · 🔥 12-day streak
      🐾 3.4M Spirit Paws · 🏆 2/${TROPHIES.length}
      📅 Oct 14 Daily Digs: ✅✅⬜"
    `);
  });
  it('shows the Diamond badge and empty digs for a stale day', () => {
    const s = newState();
    s.premium.spendCents = 25000;
    const t = shareText(s, '2026-01-05');
    expect(t.split('\n')[0]).toBe('🐾 Paw Park — Lv 1 · Puppy Walker 💎');
    expect(t.split('\n')[3]).toBe('📅 Jan 5 Daily Digs: ⬜⬜⬜');
  });
});

describe('save v3', () => {
  it('migrates v2 saves with default daily/premium', () => {
    const v3 = newState();
    v3.cash = 55;
    const v2 = JSON.parse(serialize(v3)) as Record<string, unknown>;
    v2.version = 2;
    delete v2.daily; delete v2.premium;
    const g = deserialize(JSON.stringify(v2))!;
    expect(g.version).toBe(3);
    expect(g.cash).toBe(55);
    expect(g.daily.streak).toBe(0);
    expect(g.daily.counters.letters).toBe(0);
    expect(g.premium).toEqual({ stars: 0, spendCents: 0, receipts: [], shop: {} });
  });
  it('round-trips daily/premium and sanitizes junk', () => {
    const s = newState();
    refreshDaily(s, d(3));
    s.daily.streak = 5; s.daily.bestStreak = 5; s.daily.streakFreezes = 1; s.premium.stars = 40;
    s.premium.shop = { star_beds: 2 }; s.premium.receipts = ['r1'];
    expect(deserialize(serialize(s))).toEqual(s);
    const bad = JSON.parse(serialize(s));
    bad.daily = { streak: 'x', streakFreezes: 99, digs: [{ kind: 'nope', target: 1 }] };
    bad.premium = { stars: -5, shop: { star_beds: 99, bogus: 1 } };
    const g = deserialize(JSON.stringify(bad))!;
    expect(g.daily.streak).toBe(0);
    expect(g.daily.streakFreezes).toBe(2);
    expect(g.daily.digs).toEqual([]);
    expect(g.premium.stars).toBe(0);
    expect(g.premium.shop).toEqual({ star_beds: 5 });
  });
  it('total play time includes offline seconds', () => {
    const s = newState();
    s.lastSaved = 0;
    applyOfflineProgress(s, 3600 * 1000);
    expect(s.stats.totalPlaySec).toBeCloseTo(3600, 3);
  });
  it('createInitialState has v3 fields', () => {
    const s = createInitialState(1);
    expect(s.version).toBe(3);
    expect(ACADEMY.length).toBeGreaterThan(0);
  });
});
