import { describe, expect, it } from 'vitest';
import {
  MAX_STREAK_FREEZES, PREMIUM_SHOP, PRODUCTS, STREAK_FREEZE_COST, TREATS, buyPremium, buyStreakFreeze,
  buyTreat, computeStats, grantPurchase, premiumCost, statValue,
} from '../src/core';
import { newState } from './helpers';

describe('grantPurchase', () => {
  it('adds stars and spend, and dedupes receipts', () => {
    const s = newState();
    expect(grantPurchase(s, 'stars_m', 'rcpt-1').ok).toBe(true);
    expect(s.premium.stars).toBe(550);
    expect(s.premium.spendCents).toBe(499);
    expect(grantPurchase(s, 'stars_m', 'rcpt-1').ok).toBe(false);
    expect(s.premium.stars).toBe(550);
    expect(s.premium.receipts).toEqual(['rcpt-1']);
    expect(grantPurchase(s, 'stars_s', 'rcpt-2').ok).toBe(true);
    expect(s.premium.stars).toBe(650);
    expect(grantPurchase(s, 'bogus', 'rcpt-3').ok).toBe(false);
    expect(grantPurchase(s, 'stars_s', '').ok).toBe(false);
  });
  it('products match the spec table', () => {
    expect(PRODUCTS.map((p) => [p.stars, p.priceCents])).toEqual([
      [100, 99], [550, 499], [1200, 999], [2600, 1999], [7000, 4999], [15000, 9999],
    ]);
  });
});

describe('premium shop', () => {
  it('cost = ceil(base x growth^level) and null at max', () => {
    const s = newState();
    expect(premiumCost(s, 'star_kibble')).toBe(100);
    s.premium.shop.star_kibble = 1;
    expect(premiumCost(s, 'star_kibble')).toBe(150);
    s.premium.shop.star_kibble = 2;
    expect(premiumCost(s, 'star_kibble')).toBe(225);
    s.premium.shop.star_kibble = 5;
    expect(premiumCost(s, 'star_kibble')).toBeNull();
    expect(premiumCost(s, 'bogus')).toBeNull();
  });
  it('buying spends stars, raises stats, respects max', () => {
    const s = newState();
    s.premium.stars = 10_000;
    const before = statValue(s, 'findValue');
    expect(buyPremium(s, 'star_kibble').ok).toBe(true);
    expect(s.premium.stars).toBe(9_900);
    expect(statValue(s, 'findValue')).toBeCloseTo(before * 1.05);
    for (let i = 0; i < 4; i++) expect(buyPremium(s, 'star_kibble').ok).toBe(true);
    expect(buyPremium(s, 'star_kibble').ok).toBe(false);
    expect(s.premium.shop.star_kibble).toBe(5);
  });
  it('is gated by Kennel Club tier and needs stars', () => {
    const s = newState();
    s.premium.stars = 100_000;
    expect(buyPremium(s, 'star_jar').ok).toBe(false);
    expect(buyPremium(s, 'star_hound').ok).toBe(false);
    s.premium.spendCents = 499;
    expect(buyPremium(s, 'star_jar').ok).toBe(false);
    s.premium.spendCents = 500;
    const off0 = computeStats(s).offlineCapSec;
    expect(buyPremium(s, 'star_jar').ok).toBe(true);
    expect(computeStats(s).offlineCapSec).toBe(off0 + 4 * 3600);
    expect(buyPremium(s, 'star_hound').ok).toBe(false);
    s.premium.spendCents = 2000;
    expect(buyPremium(s, 'star_hound').ok).toBe(true);
    expect(computeStats(s).squirrelHoundChance).toBeCloseTo(0.1);
    const poor = newState();
    expect(buyPremium(poor, 'star_beds').ok).toBe(false);
    expect(buyPremium(poor, 'nope').ok).toBe(false);
  });
  it('every shop def is well formed', () => {
    for (const d of PREMIUM_SHOP) {
      expect(d.requiredTier).toBeGreaterThanOrEqual(0);
      expect(d.maxLevel).toBeGreaterThan(0);
    }
  });
});

describe('streak freeze and star treats', () => {
  it('freeze costs stars and is capped', () => {
    const s = newState();
    expect(buyStreakFreeze(s).ok).toBe(false);
    s.premium.stars = 1000;
    expect(buyStreakFreeze(s).ok).toBe(true);
    expect(buyStreakFreeze(s).ok).toBe(true);
    expect(s.daily.streakFreezes).toBe(MAX_STREAK_FREEZES);
    expect(buyStreakFreeze(s).ok).toBe(false);
    expect(s.premium.stars).toBe(1000 - 2 * STREAK_FREEZE_COST);
  });
  it('treats can be bought with stars and bones', () => {
    const s = newState();
    const bacon = TREATS.find((t) => t.id === 'bacon_strip')!;
    expect(bacon.starCost).toBe(60);
    expect(TREATS.map((t) => t.starCost)).toEqual([60, 30, 90]);
    expect(buyTreat(s, 'bacon_strip', 'stars').ok).toBe(false);
    s.premium.stars = 100;
    const bones = s.goldenBones;
    expect(buyTreat(s, 'bacon_strip', 'stars').ok).toBe(true);
    expect(s.premium.stars).toBe(40);
    expect(s.goldenBones).toBe(bones);
    expect(s.treats[0].id).toBe('bacon_strip');
    s.goldenBones = 100;
    expect(buyTreat(s, 'bacon_strip').ok).toBe(true); // bones default
    expect(s.goldenBones).toBe(100 - bacon.cost);
    expect(buyTreat(s, 'nope', 'stars').ok).toBe(false);
  });
});
