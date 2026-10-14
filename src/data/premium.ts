import type { PremiumShopDef, ProductDef, VipTierDef } from '../core/types';

export const PRODUCTS: ProductDef[] = [
  { id: 'stars_s', name: 'Pocket of Stars', stars: 100, priceCents: 99 },
  { id: 'stars_m', name: 'Bag of Stars', stars: 550, priceCents: 499 },
  { id: 'stars_l', name: 'Crate of Stars', stars: 1200, priceCents: 999, tag: 'Popular' },
  { id: 'stars_xl', name: 'Barrel of Stars', stars: 2600, priceCents: 1999 },
  { id: 'stars_xxl', name: 'Wagon of Stars', stars: 7000, priceCents: 4999 },
  { id: 'stars_max', name: 'Galaxy of Stars', stars: 15000, priceCents: 9999, tag: 'Best value' },
];

export const VIP_TIERS: VipTierDef[] = [
  { tier: 0, name: 'None', icon: '', minSpendCents: 0, earningsBonus: 0, mailCapacity: 0, offlineHours: 0 },
  { tier: 1, name: 'Bronze', icon: '🥉', minSpendCents: 500, earningsBonus: 0.02, mailCapacity: 0, offlineHours: 0 },
  { tier: 2, name: 'Silver', icon: '🥈', minSpendCents: 2000, earningsBonus: 0.04, mailCapacity: 1, offlineHours: 0 },
  { tier: 3, name: 'Gold', icon: '🥇', minSpendCents: 5000, earningsBonus: 0.06, mailCapacity: 1, offlineHours: 2 },
  { tier: 4, name: 'Platinum', icon: '🏅', minSpendCents: 10000, earningsBonus: 0.08, mailCapacity: 1, offlineHours: 2 },
  { tier: 5, name: 'Diamond', icon: '💎', minSpendCents: 25000, earningsBonus: 0.1, mailCapacity: 1, offlineHours: 2 },
];

export const PREMIUM_SHOP: PremiumShopDef[] = [
  { id: 'star_kibble', name: 'Star Kibble', icon: '⭐', description: 'Permanent +5% find value per level.', stat: 'findValue', perLevel: 0.05, maxLevel: 5, baseCost: 100, costGrowth: 1.5, requiredTier: 0 },
  { id: 'star_beds', name: 'Star Beds', icon: '🛏️', description: 'Permanent +5% dig rate per level.', stat: 'layRate', perLevel: 0.05, maxLevel: 5, baseCost: 100, costGrowth: 1.5, requiredTier: 0 },
  { id: 'star_jar', name: 'Star Treat Jar', icon: '🫙', description: '4 more offline hours per level.', stat: 'offlineHours', perLevel: 4, maxLevel: 3, baseCost: 150, costGrowth: 1.6, requiredTier: 1 },
  { id: 'star_mailbox', name: 'Star Mailbox', icon: '📮', description: 'Hold one more letter per level.', stat: 'mailCapacity', perLevel: 1, maxLevel: 2, baseCost: 200, costGrowth: 2, requiredTier: 1 },
  { id: 'star_hound', name: 'Star Hound', icon: '🐕‍🦺', description: '+10% squirrel auto-catch per level.', stat: 'squirrelHound', perLevel: 0.1, maxLevel: 3, baseCost: 150, costGrowth: 1.6, requiredTier: 2 },
  { id: 'star_spirit', name: 'Star Spirit', icon: '👻', description: 'Each Spirit Paw is worth a bit more.', stat: 'spiritPawBonus', perLevel: 0.005, maxLevel: 4, baseCost: 400, costGrowth: 1.6, requiredTier: 3 },
];
