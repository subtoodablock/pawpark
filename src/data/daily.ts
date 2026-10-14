import type { DailyDigDef, DailyModifierDef, DailyTreatReward } from '../core/types';

export const DAILY_TREATS: DailyTreatReward[] = [
  { kind: 'goldenBones', amount: 3 },
  { kind: 'goldenBones', amount: 3 },
  { kind: 'goldenBones', amount: 5 },
  { kind: 'goldenBones', amount: 5 },
  { kind: 'goldenBones', amount: 8 },
  { kind: 'treat', treatId: 'bacon_strip' },
  { kind: 'bundle', goldenBones: 10, stars: 20 },
];

export const STREAK_MILESTONES: { streak: number; stars: number }[] = [
  { streak: 30, stars: 25 },
  { streak: 100, stars: 25 },
  { streak: 365, stars: 25 },
];

export const DIGS_PER_DAY = 3;
export const DIG_BONUS_BONES = 6;
export const DIG_BONUS_STARS = 5;
export const EARN_DIG_SECONDS = 3600;
export const EARN_DIG_MIN = 100;
export const STREAK_FREEZE_COST = 60;
export const MAX_STREAK_FREEZES = 2;

const DIG_BONES = 3;
/** Zoomies Daily Dig target: counted when zoomies cross this value upward (reachable: base max zoomies is 20). */
export const ZOOMIES_DIG_TARGET = 20;

export const DAILY_DIG_POOL: DailyDigDef[] = [
  { kind: 'squirrels', name: 'Squirrel Chaser', icon: '🐿️', text: 'Catch {n} squirrels', target: 3, rewardBones: DIG_BONES },
  { kind: 'letters', name: 'Mail Call', icon: '✉️', text: 'Open {n} letters', target: 4, rewardBones: DIG_BONES },
  { kind: 'whistle', name: 'Whistle Practice', icon: '📯', text: 'Whistle up {n} pups', target: 50, rewardBones: DIG_BONES },
  { kind: 'training', name: 'Good Boy School', icon: '🎓', text: 'Buy {n} training levels', target: 15, rewardBones: DIG_BONES },
  { kind: 'buildings', name: 'Builder Pup', icon: '🏗️', text: 'Upgrade {n} kennels or vehicles', target: 3, rewardBones: DIG_BONES },
  { kind: 'earn', name: 'Pay Day', icon: '💰', text: 'Earn {n}', target: 0, rewardBones: DIG_BONES },
  { kind: 'treat', name: 'Treat Time', icon: '🥓', text: 'Use {n} treat', target: 1, rewardBones: DIG_BONES },
  { kind: 'zoomies', name: 'Zoomie Master', icon: '💨', text: 'Reach {n} zoomies', target: ZOOMIES_DIG_TARGET, rewardBones: DIG_BONES },
];

export const DAILY_MODIFIERS: DailyModifierDef[] = [
  { id: 'fetch_fest', name: 'Fetch Fest', icon: '🎾', description: 'Finds are worth 15% more today.', stat: 'findValue', multiplier: 1.15 },
  { id: 'dig_day', name: 'Dig Day', icon: '⛏️', description: 'Pups dig 15% faster today.', stat: 'layRate', multiplier: 1.15 },
  { id: 'squirrel_storm', name: 'Squirrel Storm', icon: '🌪️', description: 'Squirrels show up twice as often today.', stat: 'squirrelRate', multiplier: 2 },
  { id: 'express_day', name: 'Express Day', icon: '🚚', description: 'Shipping capacity is 20% higher today.', stat: 'shippingCapacity', multiplier: 1.2 },
  { id: 'cozy_kennels', name: 'Cozy Kennels', icon: '🛏️', description: 'Kennels hold 10% more pups today.', stat: 'kennelCapacity', multiplier: 1.1 },
  { id: 'lucky_paws', name: 'Lucky Paws', icon: '🍀', description: 'All earnings are 10% higher today.', stat: 'earnings', multiplier: 1.1 },
  { id: 'mail_rush', name: 'Mail Rush', icon: '📬', description: 'Letters arrive twice as often today.', stat: 'mailRate', multiplier: 2 },
];

/**
 * Park Level thresholds: lifetime earnings needed for level i+1 (docs/06 section 6, fitted by `npm run balance -- --fit`).
 * Fitted to the AFK+Daily bot so levels are spread roughly evenly in days: Lv 20 on day 0, ~40 by day 14, ~70 by day 50,
 * Lv 100 at the Cosmic Bone. Levels 101-120 continue at x10^0.15 per level.
 */
export const PARK_LEVEL_THRESHOLDS: number[] = [
  1000, 2500, 7800, 24300, 76000, 237000, 740000, 2310000,
  7210000, 22500000, 70200000, 219000000, 684000000, 2130000000, 6660000000, 20800000000,
  64800000000, 202000000000, 631000000000, 1970000000000, 64100000000000, 2.55e15, 5.91e16, 9.08e17,
  7.58e18, 9.28e19, 3.91e20, 1.51e21, 5.68e21, 1.91e22, 4.12e22, 8.44e22,
  1.62e23, 2.99e23, 5.41e23, 8.55e23, 1.26e24, 2.03e24, 2.93e24, 4.14e24,
  9.37e24, 1.98e25, 3.86e25, 6.35e25, 9.83e25, 1.41e26, 1.87e26, 2.44e26,
  3.47e26, 4.86e26, 6.63e26, 9.82e26, 1.47e27, 2.37e27, 3.59e27, 5.2e27,
  7.66e27, 1.18e28, 1.65e28, 2.28e28, 3.12e28, 4.09e28, 5.23e28, 6.7e28,
  8.66e28, 1.06e29, 1.27e29, 1.49e29, 1.8e29, 2.23e29, 3.19e29, 4.68e29,
  6.87e29, 1e30, 1.6e30, 2.61e30, 4.13e30, 6.6e30, 1.04e31, 1.55e31,
  2.25e31, 3.23e31, 4.51e31, 6.06e31, 8.17e31, 1.11e32, 1.49e32, 1.98e32,
  2.7e32, 3.76e32, 5.16e32, 6.86e32, 9.14e32, 1.24e33, 1.58e33, 1.99e33,
  2.42e33, 2.85e33, 3.26e33, 3.71e33, 5.24e33, 7.4e33, 1.04e34, 1.48e34,
  2.08e34, 2.94e34, 4.16e34, 5.88e34, 8.3e34, 1.17e35, 1.66e35, 2.34e35,
  3.3e35, 4.67e35, 6.59e35, 9.31e35, 1.32e36, 1.86e36, 2.62e36, 3.71e36,
];

/** One title per 10 levels: index = floor(level / 10), clamped. Lv 100 (the Cosmic Bone) is the last title. */
export const PARK_TITLES: string[] = [
  'Puppy Walker', 'Dog Sitter', 'Pack Walker', 'Kennel Keeper', 'Top Dog', 'Hound Master',
  'Park Ranger', 'Canine Captain', 'Dog Mayor', 'Pup Tycoon', 'Paw Park Legend',
];
