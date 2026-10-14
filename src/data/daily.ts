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

/** v5: every Nth consecutive streak day grants a Legend Collar */
export const CALENDAR_COLLAR_STREAK = 28;
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
 * Fitted (v5/v6 balance pass) to the AFK+Daily bot so levels are spread roughly evenly in days: Lv 20 on day 0, ~40 by day 14, ~70 by day 50,
 * Lv 100 at the Cosmic Bone. Levels 101-120 continue at x10^0.15 per level.
 */
export const PARK_LEVEL_THRESHOLDS: number[] = [
  1000, 2500, 5350, 11500, 24500, 52500, 112000, 241000,
  515000, 1100000, 2360000, 5050000, 10800000, 23100000, 49500000, 106000000,
  227000000, 486000000, 1040000000, 2230000000, 47200000000, 7700000000000, 48200000000000, 419000000000000,
  1.69e15, 4.62e15, 1.15e16, 2.95e16, 6.13e16, 1.18e17, 2.73e17, 6.02e17,
  1.04e18, 1.95e18, 4.85e18, 1.08e19, 2.72e19, 7.2e19, 1.23e20, 1.91e20,
  4.5e20, 1.11e21, 3.07e21, 8.54e21, 2.18e22, 4.6e22, 8.77e22, 1.89e23,
  5.21e23, 1.65e24, 6.94e24, 2.42e25, 9.22e25, 3.13e26, 7.5e26, 1.55e27,
  2.87e27, 4.91e27, 8.33e27, 1.35e28, 2.37e28, 5.05e28, 1.14e29, 2.69e29,
  6.53e29, 1.53e30, 3.46e30, 7.96e30, 1.9e31, 4.57e31, 8.61e31, 1.53e32,
  2.41e32, 4.06e32, 5.99e32, 9.94e32, 1.44e33, 2.25e33, 3.55e33, 5.47e33,
  9.89e33, 1.5e34, 2.87e34, 4.24e34, 8.51e34, 1.31e35, 2.5e35, 3.92e35,
  6.91e35, 1.11e36, 1.87e36, 3.38e36, 4.87e36, 9.94e36, 1.38e37, 2.77e37,
  3.92e37, 5.92e37, 1.03e38, 1.31e38, 1.85e38, 2.61e38, 3.69e38, 5.21e38,
  7.35e38, 1.04e39, 1.47e39, 2.07e39, 2.93e39, 4.14e39, 5.84e39, 8.25e39,
  1.17e40, 1.65e40, 2.33e40, 3.28e40, 4.64e40, 6.55e40, 9.26e40, 1.31e41,
];

/** One title per 10 levels: index = floor(level / 10), clamped. Lv 100 (the Cosmic Bone) is the last title. */
export const PARK_TITLES: string[] = [
  'Puppy Walker', 'Dog Sitter', 'Pack Walker', 'Kennel Keeper', 'Top Dog', 'Hound Master',
  'Park Ranger', 'Canine Captain', 'Dog Mayor', 'Pup Tycoon', 'Paw Park Legend',
];
