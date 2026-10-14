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
  1000, 2500, 5510, 12100, 26700, 58900, 130000, 286000,
  630000, 1390000, 3060000, 6740000, 14900000, 32700000, 72100000, 159000000,
  350000000, 771000000, 1700000000, 3740000000, 57600000000, 2980000000000, 81400000000000, 401000000000000,
  1.16e15, 2.67e15, 4.81e15, 1.46e16, 4.94e16, 1.29e17, 2.62e17, 5.89e17,
  1.19e18, 2.11e18, 3.27e18, 6.88e18, 1.45e19, 2.81e19, 5.29e19, 1.05e20,
  2.88e20, 1.2e21, 5.06e21, 1.9e22, 5.16e22, 1.2e23, 2.52e23, 5.83e23,
  1.75e24, 5.71e24, 2.32e25, 6.92e25, 2.48e26, 6.72e26, 1.34e27, 2.22e27,
  3.34e27, 5.03e27, 7.4e27, 1.08e28, 1.82e28, 3.58e28, 7.56e28, 1.75e29,
  4.39e29, 1.06e30, 2.63e30, 6.44e30, 1.45e31, 3.2e31, 5.42e31, 9.2e31,
  1.5e32, 2.39e32, 3.44e32, 5.15e32, 7.8e32, 1.06e33, 1.67e33, 2.49e33,
  3.86e33, 6.36e33, 9.71e33, 1.68e34, 2.8e34, 4.9e34, 8.93e34, 1.52e35,
  2.64e35, 4.36e35, 7.86e35, 1.36e36, 2.42e36, 4.33e36, 7.25e36, 1.28e37,
  2.2e37, 3.54e37, 5.59e37, 9.12e37, 1.29e38, 1.82e38, 2.57e38, 3.63e38,
  5.13e38, 7.24e38, 1.02e39, 1.44e39, 2.04e39, 2.88e39, 4.07e39, 5.75e39,
  8.12e39, 1.15e40, 1.62e40, 2.29e40, 3.23e40, 4.57e40, 6.45e40, 9.12e40,
];

/** One title per 10 levels: index = floor(level / 10), clamped. Lv 100 (the Cosmic Bone) is the last title. */
export const PARK_TITLES: string[] = [
  'Puppy Walker', 'Dog Sitter', 'Pack Walker', 'Kennel Keeper', 'Top Dog', 'Hound Master',
  'Park Ranger', 'Canine Captain', 'Dog Mayor', 'Pup Tycoon', 'Paw Park Legend',
];
