import type { DogShowRewardDef } from '../core/types';

/** Weekly Dog Show (docs/10 §3). Index = goal index: bronze, silver, gold. */
export const SHOW_REWARDS: DogShowRewardDef[] = [
  { goalFraction: 0.55, goldenBones: 10, collars: 0 },
  { goalFraction: 1.0, goldenBones: 15, treatId: 'bacon_strip', collars: 0 },
  { goalFraction: 1.55, goldenBones: 25, collars: 1 },
];

export const SHOW_MEDAL_ICONS = ['🥉', '🥈', '🥇'] as const;

/** Days of headless AFK simulation used to calibrate goal targets at join time. */
export const SHOW_CALIBRATION_DAYS = 7;
/** Calibration steps with the same chunk as offline progress. */
export const SHOW_CALIBRATION_CHUNK_SEC = 120;
/** Weeks kept in GameState.showHistory. */
export const SHOW_HISTORY_WEEKS = 12;

/** {find} is replaced with the featured Find's name. */
export const SHOW_NAMES: string[] = [
  'The Great {find} Fetch-Off',
  '{find} Championship',
  'Best in {find}',
  'The {find} Grand Prix',
  'Wag-a-thon: {find} Edition',
  'The Golden {find} Cup',
  '{find} Frenzy Invitational',
  'Paws & {find} Spectacular',
];
