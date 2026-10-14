import type { DailyCounters, DailyDigKind, DailyState, GameState } from './types';
import { DAILY_DIG_POOL } from '../data';

/** Adds to a Daily Dig counter (spec 06 §4). Offline time counts too. */
export function bumpCounter(state: GameState, kind: DailyDigKind, n = 1): void {
  if (!(n > 0)) return;
  const c = state.daily.counters;
  c[kind] = (c[kind] ?? 0) + n;
}

export const DIG_KINDS: DailyDigKind[] = DAILY_DIG_POOL.map((d) => d.kind);

export function emptyCounters(): DailyCounters {
  const c = {} as DailyCounters;
  for (const k of DIG_KINDS) c[k] = 0;
  return c;
}

export function createDailyState(): DailyState {
  return {
    lastSeenDay: null,
    lastClaimDay: null,
    streak: 0,
    bestStreak: 0,
    streakFreezes: 0,
    streakMilestones: [],
    digsDay: null,
    digs: [],
    digBonusClaimed: false,
    modifierId: null,
    counters: emptyCounters(),
  };
}

