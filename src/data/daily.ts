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

export const DAILY_DIG_POOL: DailyDigDef[] = [
  { kind: 'squirrels', name: 'Squirrel Chaser', icon: '🐿️', text: 'Catch {n} squirrels', target: 3, rewardBones: DIG_BONES },
  { kind: 'letters', name: 'Mail Call', icon: '✉️', text: 'Open {n} letters', target: 4, rewardBones: DIG_BONES },
  { kind: 'whistle', name: 'Whistle Practice', icon: '📯', text: 'Whistle up {n} pups', target: 50, rewardBones: DIG_BONES },
  { kind: 'training', name: 'Good Boy School', icon: '🎓', text: 'Buy {n} training levels', target: 15, rewardBones: DIG_BONES },
  { kind: 'buildings', name: 'Builder Pup', icon: '🏗️', text: 'Upgrade {n} kennels or vehicles', target: 3, rewardBones: DIG_BONES },
  { kind: 'earn', name: 'Pay Day', icon: '💰', text: 'Earn {n}', target: 0, rewardBones: DIG_BONES },
  { kind: 'treat', name: 'Treat Time', icon: '🥓', text: 'Use {n} treat', target: 1, rewardBones: DIG_BONES },
  { kind: 'zoomies', name: 'Zoomie Master', icon: '💨', text: 'Hit max zoomies', target: 1, rewardBones: DIG_BONES },
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

/** Park Level thresholds: lifetime earnings needed for level i+1. Geometric, x10^0.25 per level from $1K. */
export const PARK_LEVEL_THRESHOLDS: number[] = Array.from({ length: 150 }, (_, i) =>
  Number((1e3 * Math.pow(10, 0.25 * i)).toPrecision(3)),
);

/** One title per 10 levels: index = floor(level / 10), clamped. */
export const PARK_TITLES: string[] = [
  'Puppy Walker', 'Dog Sitter', 'Pack Walker', 'Kennel Keeper', 'Top Dog', 'Hound Master',
  'Park Ranger', 'Canine Captain', 'Dog Mayor', 'Pup Tycoon', 'Galactic Alpha', 'Paw Park Legend',
];
