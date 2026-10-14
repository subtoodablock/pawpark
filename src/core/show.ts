// Weekly Dog Show engine (docs/10-egg-inc-model.md §3).
// A temporary, separate "show park" (a full GameState) runs inside state.show.park. It is stepped from
// stepSimulation (online and offline), has its own simulated clock (park.lastSaved) and stops at the
// end of the show's week. Goals are claimed explicitly; refreshShow(state, now) closes a finished show.
import type {
  ActionResult, DogShowRewardDef, DogShowState, GameEvent, GameState, Rng, WeekKey,
} from './types';
import {
  ERA_START_CASH,
  FINDS,
  SHOW_CALIBRATION_CHUNK_SEC,
  SHOW_CALIBRATION_DAYS,
  SHOW_HISTORY_WEEKS,
  SHOW_NAMES,
  SHOW_REWARDS,
  TREATS,
  TROPHIES,
} from '../data';
import { createInitialState, resetPark } from './state';
import { hashString, seededRng } from './dates';
import { addTreat } from './actions';
import { stepSimulationDetailed } from './tick';
import { mirrorPortal } from './portal';

const fail = (reason: string): ActionResult => ({ ok: false, reason });
const pad2 = (n: number) => String(n).padStart(2, '0');
const DAY_MS = 86_400_000;
const WEEK_KEY_RE = /^(\d{4})-W(\d{2})$/;
/** Timers for systems the show park does not have (squirrels, mail) are parked far in the future. */
const NEVER = 1e12;

// ---------------------------------------------------------------- weeks

/** ISO week key 'YYYY-Www' (weeks start Monday) in LOCAL time. */
export function weekKeyOf(date: Date | number): WeekKey {
  const d = typeof date === 'number' ? new Date(date) : date;
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  // Thursday of this ISO week decides the ISO year
  const thu = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 3);
  const y = thu.getFullYear();
  const doy = Math.round((Date.UTC(y, thu.getMonth(), thu.getDate()) - Date.UTC(y, 0, 1)) / DAY_MS);
  return `${String(y).padStart(4, '0')}-W${pad2(Math.floor(doy / 7) + 1)}`;
}

/** Monday 00:00:00.000 local to Sunday 23:59:59.999 local, as epoch ms. Invalid keys give NaN. */
export function showWindow(weekKey: WeekKey): { start: number; end: number } {
  const m = WEEK_KEY_RE.exec(weekKey);
  if (!m) return { start: NaN, end: NaN };
  const y = Number(m[1]);
  const w = Number(m[2]);
  const jan4 = new Date(y, 0, 4);
  const mondayDay = 4 - ((jan4.getDay() + 6) % 7) + 7 * (w - 1);
  const start = new Date(y, 0, mondayDay).getTime();
  const end = new Date(y, 0, mondayDay + 7).getTime() - 1;
  return { start, end };
}

/** The Featured Find and name for a week. Deterministic from the week key and the player's highest Find. */
export function showForWeek(
  state: Pick<GameState, 'highestFindIndex'>,
  weekKey: WeekKey,
): { name: string; findIndex: number } {
  const rng = seededRng(hashString(weekKey));
  const max = Math.min(FINDS.length - 1, Math.max(2, state.highestFindIndex));
  const findIndex = Math.min(max, Math.floor(rng() * (max + 1)));
  const template = SHOW_NAMES[Math.floor(rng() * SHOW_NAMES.length)] ?? '{find} Show';
  return { name: template.replace('{find}', FINDS[findIndex].name), findIndex };
}

// ---------------------------------------------------------------- meta mirroring

/**
 * Copies the home meta into the show park and strips everything the show park must not have:
 * academy, spiritPaws, legendCollars, premium.shop + VIP spend and automation settings are mirrored
 * (find + prestige automation forced off); squirrels, mail, trophies, daily modifier and endgame are disabled.
 */
export function syncShowMeta(home: GameState, park: GameState): void {
  park.academy = { ...home.academy };
  park.spiritPaws = home.spiritPaws;
  park.legendCollars = home.legendCollars;
  park.premium.shop = { ...home.premium.shop };
  park.premium.spendCents = home.premium.spendCents;
  park.automation = { ...home.automation, find: false, prestige: false };
  park.daily.modifierId = null;
  park.squirrels = [];
  park.squirrelTimer = NEVER;
  park.mailCount = 0;
  park.mailTimer = NEVER;
  park.endgameReached = true;
  if (park.trophies.length !== TROPHIES.length) park.trophies = TROPHIES.map((t) => t.id);
  park.portal = mirrorPortal(home); // equipped relics apply in the show park too
  park.show = null;
  park.showHistory = [];
}

// ---------------------------------------------------------------- park creation + calibration

function createShowPark(home: GameState, findIndex: number, now: number): GameState {
  const park = createInitialState(now);
  park.findIndex = findIndex;
  park.highestFindIndex = findIndex;
  park.goldenBones = 0;
  syncShowMeta(home, park);
  resetPark(park, ERA_START_CASH * FINDS[findIndex].costScale);
  park.notifiedFinds = [];
  park.lastSaved = now; // the park's own simulated clock
  return park;
}

/** Finds delivered by a clone of `park` after SHOW_CALIBRATION_DAYS of AFK play with automation as owned. */
function calibrate(park: GameState, rng: Rng): number {
  const sim = structuredClone(park);
  const start = sim.stats.findsDelivered ?? 0;
  let remaining = SHOW_CALIBRATION_DAYS * 86_400;
  while (remaining > 1e-9) {
    const dt = Math.min(SHOW_CALIBRATION_CHUNK_SEC, remaining);
    stepSimulationDetailed(sim, dt, rng, { offline: true });
    remaining -= dt;
  }
  return (sim.stats.findsDelivered ?? 0) - start;
}

/** Goal targets from the AFK-delivered total: increasing, at least 1 and strictly ascending. */
function targetsFor(afk: number): number[] {
  const out: number[] = [];
  for (const r of SHOW_REWARDS) {
    const prev = out.length ? out[out.length - 1] : 0;
    out.push(Math.max(prev + 1, Math.round(r.goalFraction * afk), 1));
  }
  return out;
}

/** Whole-number AFK reference used for calibration (exposed for balance tooling and tests). */
export function calibrateShow(home: GameState, findIndex: number, now: number, rng?: Rng): number {
  const park = createShowPark(home, findIndex, now);
  return calibrate(park, rng ?? seededRng(hashString(`${weekKeyOf(now)}#${findIndex}`)));
}

// ---------------------------------------------------------------- actions

/** Joins this week's show if not already joined. Closes a previous, ended show first (see refreshShow). */
export function joinShow(
  state: GameState,
  now: number,
  rng?: Rng,
): ActionResult & { events?: GameEvent[] } {
  const events = refreshShow(state, now);
  const weekKey = weekKeyOf(now);
  if (state.show) return { ...fail('You already joined this week\'s show.'), events };
  if (state.showHistory.some((r) => r.weekKey === weekKey)) {
    return { ...fail('You already entered this week\'s show.'), events };
  }
  const { name, findIndex } = showForWeek(state, weekKey);
  const park = createShowPark(state, findIndex, now);
  const afk = calibrate(park, rng ?? seededRng(hashString(`${weekKey}#${findIndex}`)));
  state.show = {
    weekKey,
    name,
    findIndex,
    joinedAt: now,
    goals: targetsFor(afk).map((target) => ({ target, claimed: false })),
    park,
  };
  return { ok: true, events };
}

const delivered = (show: DogShowState): number => show.park.stats.findsDelivered ?? 0;
const goalReached = (show: DogShowState, i: number): boolean => delivered(show) >= show.goals[i].target;

/** Called from stepSimulationDetailed for the home park only. Emits showGoalReached once per crossing. */
export function stepShow(home: GameState, dt: number, rng: Rng, offline: boolean, events: GameEvent[]): void {
  const show = home.show;
  if (!show) return;
  const park = show.park;
  const end = showWindow(show.weekKey).end;
  const remainingMs = end + 1 - park.lastSaved;
  if (!(remainingMs > 0)) return; // the show's week is over for the park's clock
  const stepDt = Math.min(dt, remainingMs / 1000);
  syncShowMeta(home, park);
  const before = show.goals.map((_, i) => goalReached(show, i));
  stepSimulationDetailed(park, stepDt, rng, { offline, showPark: true });
  park.lastSaved += stepDt * 1000;
  show.goals.forEach((_, i) => {
    if (!before[i] && goalReached(show, i)) events.push({ type: 'showGoalReached', goalIndex: i });
  });
}

/** Gives a goal's reward to the HOME park. Requires the goal to be reached and unclaimed. */
export function claimShowGoal(
  state: GameState,
  goalIndex: number,
): ActionResult & { reward?: DogShowRewardDef } {
  const show = state.show;
  if (!show) return fail('No Dog Show is running.');
  const goal = show.goals[goalIndex];
  const reward = SHOW_REWARDS[goalIndex];
  if (!goal || !reward) return fail('No such goal.');
  if (goal.claimed) return fail('Already claimed.');
  if (!goalReached(show, goalIndex)) return fail('Goal not reached yet.');
  goal.claimed = true;
  state.goldenBones += reward.goldenBones;
  state.legendCollars += reward.collars;
  if (reward.treatId) {
    const def = TREATS.find((t) => t.id === reward.treatId);
    if (def) addTreat(state, def.id, def.durationSec);
  }
  return { ok: true, reward };
}

/**
 * Closes the show once its week has ended: auto-claims reached goals, appends the result to
 * showHistory (last SHOW_HISTORY_WEEKS), sets show to null and emits showEnded.
 * The UI should call this next to refreshDaily (e.g. on load, after offline progress and on a slow timer).
 */
export function refreshShow(state: GameState, now: number): GameEvent[] {
  const events: GameEvent[] = [];
  const show = state.show;
  if (!show) return events;
  const end = showWindow(show.weekKey).end;
  if (!(now > end)) return events;
  let medals = 0;
  show.goals.forEach((_, i) => {
    if (!goalReached(show, i)) return;
    medals++;
    if (!show.goals[i].claimed) claimShowGoal(state, i);
  });
  state.showHistory.push({ weekKey: show.weekKey, findIndex: show.findIndex, medals });
  if (state.showHistory.length > SHOW_HISTORY_WEEKS) {
    state.showHistory = state.showHistory.slice(-SHOW_HISTORY_WEEKS);
  }
  state.show = null;
  events.push({ type: 'showEnded', weekKey: show.weekKey, medals });
  return events;
}

export interface ShowProgress {
  delivered: number;
  goals: { target: number; reached: boolean; claimed: boolean }[];
  /** epoch ms of the last moment of the show's week */
  endsAt: number;
}

/** UI helper; null when no show is running. */
export function showProgress(state: GameState): ShowProgress | null {
  const show = state.show;
  if (!show) return null;
  return {
    delivered: delivered(show),
    goals: show.goals.map((g, i) => ({ target: g.target, reached: goalReached(show, i), claimed: g.claimed })),
    endsAt: showWindow(show.weekKey).end,
  };
}

/** Medal count of the running show (reached goals), or null. */
export function showMedals(state: GameState): number | null {
  const show = state.show;
  return show ? show.goals.filter((_, i) => goalReached(show, i)).length : null;
}
