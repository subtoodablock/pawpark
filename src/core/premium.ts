import type { ActionResult, GameState } from './types';
import { MAX_STREAK_FREEZES, PREMIUM_SHOP, PRODUCTS, STREAK_FREEZE_COST } from '../data';
import { vipTierFor } from './stats';

const fail = (reason: string): ActionResult => ({ ok: false, reason });

/** Adds a purchased star pack. Duplicate receipt ids are ignored (ok: false). */
export function grantPurchase(state: GameState, productId: string, receiptId: string): ActionResult {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return fail('Unknown product.');
  if (typeof receiptId !== 'string' || receiptId.length === 0) return fail('Missing receipt.');
  if (state.premium.receipts.includes(receiptId)) return fail('This purchase was already applied.');
  state.premium.receipts.push(receiptId);
  state.premium.stars += product.stars;
  state.premium.spendCents += product.priceCents;
  return { ok: true };
}

/** Next level cost in Pup Stars, or null at max level / unknown id. */
export function premiumCost(state: GameState, id: string): number | null {
  const def = PREMIUM_SHOP.find((d) => d.id === id);
  if (!def) return null;
  const level = state.premium.shop[id] ?? 0;
  if (level >= def.maxLevel) return null;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
}

export function buyPremium(state: GameState, id: string): ActionResult {
  const def = PREMIUM_SHOP.find((d) => d.id === id);
  if (!def) return fail('Unknown shop item.');
  if (vipTierFor(state.premium.spendCents) < def.requiredTier) return fail('Reach a higher Kennel Club tier to unlock this.');
  const cost = premiumCost(state, id);
  if (cost === null) return fail('Already at max level.');
  if (state.premium.stars < cost) return fail('Not enough Pup Stars.');
  state.premium.stars -= cost;
  state.premium.shop[id] = (state.premium.shop[id] ?? 0) + 1;
  return { ok: true };
}

export function buyStreakFreeze(state: GameState): ActionResult {
  if (state.daily.streakFreezes >= MAX_STREAK_FREEZES) return fail('You can hold at most 2 Streak Freezes.');
  if (state.premium.stars < STREAK_FREEZE_COST) return fail('Not enough Pup Stars.');
  state.premium.stars -= STREAK_FREEZE_COST;
  state.daily.streakFreezes += 1;
  return { ok: true };
}
