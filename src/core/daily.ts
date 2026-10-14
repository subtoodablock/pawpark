import type {
  ActionResult, DailyTreatReward, DayKey, GameEvent, GameState,
} from './types';
import {
  CALENDAR_COLLAR_STREAK,
  DAILY_DIG_POOL,
  DAILY_MODIFIERS,
  DAILY_TREATS,
  DIGS_PER_DAY,
  DIG_BONUS_BONES,
  DIG_BONUS_STARS,
  EARN_DIG_MIN,
  EARN_DIG_SECONDS,
  FINDS,
  STREAK_MILESTONES,
  TREATS,
  TROPHIES,
  VIP_TIERS,
} from '../data';
import { bumpCounter, createDailyState, emptyCounters } from './counters';
import { DAY_KEY_RE, dayDiff, hashString, seededRng } from './dates';
import { addTreat } from './actions';
import { computeStats } from './stats';
import { formatNumber } from './format';

export { dayKeyOf, dayDiff, hashString, seededRng } from './dates';
export { createDailyState, emptyCounters };

const fail = (reason: string): ActionResult => ({ ok: false, reason });

/** Dig-complete events already emitted per state (not part of the saved contract). */
const notified = new WeakMap<GameState, Set<string>>();

function doneKey(state: GameState, index: number): string {
  return `${state.daily.digsDay}:${index}`;
}

export function dailyDigProgress(
  state: GameState,
  index: number,
): { value: number; target: number; done: boolean } {
  const dig = state.daily.digs[index];
  if (!dig) return { value: 0, target: 0, done: false };
  const raw = state.daily.counters[dig.kind] ?? 0;
  return { value: Math.min(raw, dig.target), target: dig.target, done: raw >= dig.target };
}

/** Marks digs that are already complete as announced, without emitting events. */
export function syncDigNotifications(state: GameState): void {
  const set = new Set<string>();
  state.daily.digs.forEach((_, i) => {
    if (dailyDigProgress(state, i).done) set.add(doneKey(state, i));
  });
  notified.set(state, set);
}

/** Emits dailyDigComplete once per dig, the first time its counter reaches the target (online tick). */
export function checkDigCompletion(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const set = notified.get(state);
  if (!set) {
    syncDigNotifications(state);
    return events;
  }
  state.daily.digs.forEach((_, i) => {
    const k = doneKey(state, i);
    if (!set.has(k) && dailyDigProgress(state, i).done) {
      set.add(k);
      events.push({ type: 'dailyDigComplete', index: i });
    }
  });
  return events;
}

/** True when `dayKey` is usable; also applies the anti-rewind rule and records lastSeenDay. */
function seeDay(state: GameState, dayKey: DayKey): boolean {
  if (typeof dayKey !== 'string' || !DAY_KEY_RE.test(dayKey)) return false;
  const last = state.daily.lastSeenDay;
  if (last && dayKey < last) return false;
  state.daily.lastSeenDay = dayKey;
  return true;
}

/** Rolls the day's Digs and Park of the Day when the calendar day changed. */
export function refreshDaily(state: GameState, dayKey: DayKey): GameEvent[] {
  const events: GameEvent[] = [];
  if (!seeDay(state, dayKey)) return events;
  const d = state.daily;
  if (d.digsDay === dayKey) {
    if (!notified.has(state)) syncDigNotifications(state);
    return events;
  }

  const rng = seededRng(hashString(dayKey));
  const pool = DAILY_DIG_POOL.slice();
  for (let i = 0; i < DIGS_PER_DAY && i < pool.length; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // earn target from base income (today's modifier must not inflate it)
  const prevModifier = d.modifierId;
  d.modifierId = null;
  const earnTarget = Math.max(EARN_DIG_MIN, computeStats(state).incomePerSec * EARN_DIG_SECONDS);
  d.digs = pool.slice(0, DIGS_PER_DAY).map((def) => ({
    kind: def.kind,
    target: def.kind === 'earn' ? earnTarget : def.target,
    claimed: false,
  }));
  d.modifierId = DAILY_MODIFIERS[Math.floor(rng() * DAILY_MODIFIERS.length)]?.id ?? prevModifier;
  d.counters = emptyCounters();
  d.digBonusClaimed = false;
  d.digsDay = dayKey;
  notified.set(state, new Set());
  return events;
}

export function claimDailyTreat(
  state: GameState,
  dayKey: DayKey,
): ActionResult & { reward?: DailyTreatReward; streak?: number; events?: GameEvent[] } {
  const d = state.daily;
  if (typeof dayKey !== 'string' || !DAY_KEY_RE.test(dayKey)) return fail('Invalid day.');
  if (d.lastSeenDay && dayKey < d.lastSeenDay) return fail('The clock went backwards.');
  if (d.lastClaimDay === dayKey) return fail('Already claimed today. Come back tomorrow!');
  if (d.lastClaimDay && dayKey < d.lastClaimDay) return fail('The clock went backwards.');
  seeDay(state, dayKey);

  let streak = 1;
  if (d.lastClaimDay) {
    const gap = dayDiff(d.lastClaimDay, dayKey);
    if (gap === 1) streak = d.streak + 1;
    else if (gap >= 2 && d.streakFreezes >= gap - 1) {
      d.streakFreezes -= gap - 1;
      streak = d.streak + 1;
    }
  }
  d.streak = streak;
  d.bestStreak = Math.max(d.bestStreak, streak);
  d.lastClaimDay = dayKey;

  const reward = DAILY_TREATS[(streak - 1) % DAILY_TREATS.length];
  if (reward.kind === 'goldenBones') state.goldenBones += reward.amount;
  else if (reward.kind === 'bundle') {
    state.goldenBones += reward.goldenBones;
    state.premium.stars += reward.stars;
  } else {
    const def = TREATS.find((t) => t.id === reward.treatId);
    if (def) {
      addTreat(state, def.id, def.durationSec);
      bumpCounter(state, 'treat');
    }
  }

  const events: GameEvent[] = [];
  for (const m of STREAK_MILESTONES) {
    if (streak === m.streak && !d.streakMilestones.includes(m.streak)) {
      d.streakMilestones.push(m.streak);
      state.premium.stars += m.stars;
      events.push({ type: 'streakMilestone', streak: m.streak, stars: m.stars });
    }
  }
  // v5 calendar collar: one Legend Collar per 28 consecutive streak days
  if (streak > 0 && streak % CALENDAR_COLLAR_STREAK === 0) {
    state.legendCollars += 1;
    events.push({ type: 'calendarCollar', streak });
  }
  return { ok: true, reward, streak, events };
}

export function claimDailyDig(state: GameState, index: number): ActionResult {
  const dig = state.daily.digs[index];
  if (!dig) return fail('No such dig.');
  if (dig.claimed) return fail('Already claimed.');
  if (!dailyDigProgress(state, index).done) return fail('Not finished yet.');
  const def = DAILY_DIG_POOL.find((p) => p.kind === dig.kind);
  dig.claimed = true;
  state.goldenBones += def?.rewardBones ?? 0;
  return { ok: true };
}

export function claimDailyDigBonus(state: GameState): ActionResult {
  const d = state.daily;
  if (d.digBonusClaimed) return fail('Already claimed.');
  if (d.digs.length === 0 || !d.digs.every((x) => x.claimed)) return fail('Claim all three digs first.');
  d.digBonusClaimed = true;
  state.goldenBones += DIG_BONUS_BONES;
  state.premium.stars += DIG_BONUS_STARS;
  return { ok: true };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shareText(state: GameState, dayKey: DayKey): string {
  const s = computeStats(state);
  const find = FINDS[state.findIndex] ?? FINDS[0];
  const badge = s.vipTier >= VIP_TIERS.length - 1 ? ' 💎' : '';
  const [, m, day] = dayKey.split('-').map(Number);
  const date = `${MONTHS[(m || 1) - 1] ?? '???'} ${day || 0}`;
  const d = state.daily;
  const marks =
    d.digsDay === dayKey && d.digs.length > 0
      ? d.digs.map((dig, i) => (dig.claimed || dailyDigProgress(state, i).done ? '✅' : '⬜')).join('')
      : '⬜'.repeat(DIGS_PER_DAY);
  const lines = [
    `🐾 Paw Park — Lv ${s.parkLevel} · ${s.parkTitle}${badge}`,
    `${find.icon} ${find.name} · 🔥 ${d.streak}-day streak`,
    `🐾 ${formatNumber(state.spiritPaws)} Spirit Paws · 🏆 ${state.trophies.length}/${TROPHIES.length}`,
    `📅 ${date} Daily Digs: ${marks}`,
  ];
  // Dog Show: live medals while a show runs, otherwise the most recent result
  const show = state.show;
  const medals = show
    ? show.goals.filter((g) => (show.park.stats.findsDelivered ?? 0) >= g.target).length
    : state.showHistory?.length
      ? state.showHistory[state.showHistory.length - 1].medals
      : null;
  if (medals !== null) {
    const icons = ['🥉', '🥈', '🥇'];
    lines.push(`🏆 Dog Show: ${icons.map((ic, i) => (i < medals ? ic : '⬜')).join('')}`);
  }
  return lines.join('\n');
}
