import type { DerivedStats, GameEvent, GameState, Rng, SquirrelReward } from './types';
import {
  AUTOMATION_INTERVAL_SEC,
  FINDS,
  MAIL_INTERVAL_SEC,
  MAX_ACTIVE_SQUIRRELS,
  SQUIRREL_BONES_CHANCE,
  SQUIRREL_BONES_MAX,
  SQUIRREL_BONES_MIN,
  SQUIRREL_CASH_CHANCE,
  SQUIRREL_CASH_SEC_MAX,
  SQUIRREL_CASH_SEC_MIN,
  SQUIRREL_INTERVAL_MAX,
  SQUIRREL_INTERVAL_MIN,
  SQUIRREL_LIFETIME_SEC,
  SQUIRREL_TREAT_DURATION_FRAC,
  TREATS,
  TROPHIES,
  ZOOMIE_DECAY_PER_SEC,
  ZOOMIE_GRACE_SEC,
} from '../data';
import { adopt, catchSquirrel, randInt } from './actions';
import { automate } from './automation';
import { computeStats, statValue } from './stats';
import { bumpCounter } from './counters';
import { checkDigCompletion } from './daily';
import { stepShow } from './show';

export interface StepOptions {
  /** Offline mode: no zoomies, squirrels resolve instantly via the hound, automation fires once per call. */
  offline: boolean;
}

export interface StepResult {
  events: GameEvent[];
  /** automation purchases made during this step */
  purchases: number;
}

/** Fractional auto-whistle carry per state, so it works at small dt (not part of the saved contract). */
const whistleCarry = new WeakMap<GameState, number>();

function rollSquirrelReward(rng: Rng): SquirrelReward {
  const roll = rng();
  if (roll < SQUIRREL_CASH_CHANCE) {
    const incomeSeconds =
      SQUIRREL_CASH_SEC_MIN + rng() * (SQUIRREL_CASH_SEC_MAX - SQUIRREL_CASH_SEC_MIN);
    return { kind: 'cash', incomeSeconds };
  }
  if (roll < SQUIRREL_BONES_CHANCE) {
    return { kind: 'goldenBones', amount: randInt(rng, SQUIRREL_BONES_MIN, SQUIRREL_BONES_MAX) };
  }
  const def = TREATS[Math.floor(rng() * TREATS.length)];
  return { kind: 'treat', treatId: def.id, durationSec: def.durationSec * SQUIRREL_TREAT_DURATION_FRAC };
}

function checkTrophies(state: GameState, events: GameEvent[]): void {
  for (const tr of TROPHIES) {
    if (state.trophies.includes(tr.id)) continue;
    let value: number;
    switch (tr.kind) {
      case 'pups': value = state.pups; break;
      case 'lifetimeEarnings': value = state.lifetimeEarnings; break;
      case 'prestiges': value = state.prestigeCount; break;
      case 'find': value = state.highestFindIndex; break;
    }
    if (value >= tr.threshold) {
      state.trophies.push(tr.id);
      state.legendCollars += tr.collars;
      state.goldenBones += tr.goldenBones;
      events.push({ type: 'trophy', trophyId: tr.id, collars: tr.collars, goldenBones: tr.goldenBones });
    }
  }
}

function checkEndgame(state: GameState, events: GameEvent[]): void {
  if (!state.endgameReached && state.highestFindIndex >= FINDS.length - 1) {
    state.endgameReached = true;
    events.push({ type: 'endgame' });
  }
}

/** Hound catches a squirrel that is already in state.squirrels. */
function houndCatch(state: GameState, squirrelId: number, events: GameEvent[]): void {
  const reward = catchSquirrel(state, squirrelId);
  if (reward) events.push({ type: 'squirrelHound', reward });
}

function autoWhistle(state: GameState, s: DerivedStats, dt: number): void {
  const carried = whistleCarry.get(state) ?? 0;
  if (!state.automation.whistle || !s.automationUnlocked.whistle) {
    if (carried) whistleCarry.delete(state);
    return;
  }
  const total = carried + s.autoWhistleFrac * s.adoptionRefill * dt;
  const whole = Math.floor(total);
  if (whole >= 1) adopt(state, whole, false);
  whistleCarry.set(state, total - whole);
}

/**
 * One simulation step (spec 04 §3). `tick` and offline progress share this path.
 * Also reports how many automation purchases happened (used by the offline report).
 */
export function stepSimulationDetailed(
  state: GameState,
  dt: number,
  rng: Rng,
  opts: StepOptions = { offline: false },
): StepResult {
  const events: GameEvent[] = [];
  let purchases = 0;
  if (!(dt > 0)) return { events, purchases };
  const offline = opts.offline;
  const s = computeStats(state);

  // 1. adoption stock, then volunteer walkers
  state.adoptionStock = Math.min(s.adoptionCap, state.adoptionStock + s.adoptionRefill * dt);
  autoWhistle(state, s, dt);

  // 2. rescue (100% offline too)
  // Calm Kennels (offlineRescueMult) applies only while offline
  const rescuePerSec = offline ? s.rescuePerSec * statValue(state, 'offlineRescueMult') : s.rescuePerSec;
  if (rescuePerSec > 0) {
    state.pups = Math.max(state.pups, Math.min(s.kennelCapacity, state.pups + rescuePerSec * dt));
  }

  // 3. zoomies
  if (offline) {
    state.zoomies = 0;
    state.zoomieIdle = 0;
  } else {
    state.zoomieIdle += dt;
    if (state.zoomieIdle > ZOOMIE_GRACE_SEC) {
      state.zoomies = Math.max(0, state.zoomies - ZOOMIE_DECAY_PER_SEC * dt);
    }
  }
  state.stats.totalPlaySec += dt;
  state.runTimeSec += dt;

  // 4. earnings (stats from the start of the step)
  const earned = s.incomePerSec * dt;
  state.cash += earned;
  state.stats.findsDelivered += s.deliveredPerSec * dt;
  state.runEarnings += earned;
  state.lifetimeEarnings += earned;
  bumpCounter(state, 'earn', earned);

  // 5. treats
  for (const t of state.treats) t.remaining -= dt;
  const expired = state.treats.filter((t) => t.remaining <= 0);
  if (expired.length > 0) {
    state.treats = state.treats.filter((t) => t.remaining > 0);
    for (const t of expired) events.push({ type: 'treatExpired', treatId: t.id });
  }

  // 6. squirrels
  if (offline) {
    state.squirrels = [];
    state.squirrelTimer -= dt;
    let guard = 0;
    while (state.squirrelTimer <= 0 && guard++ < 1000) {
      const id = state.nextSquirrelId++;
      state.squirrels.push({ id, age: 0, lifetime: SQUIRREL_LIFETIME_SEC, reward: rollSquirrelReward(rng) });
      if (s.squirrelHoundChance > 0 && rng() < s.squirrelHoundChance) houndCatch(state, id, events);
      state.squirrels = [];
      const interval =
        SQUIRREL_INTERVAL_MIN + rng() * (SQUIRREL_INTERVAL_MAX - SQUIRREL_INTERVAL_MIN);
      state.squirrelTimer += interval / statValue(state, 'squirrelRate');
    }
  } else {
    for (const q of state.squirrels) q.age += dt;
    const gone = state.squirrels.filter((q) => q.age >= q.lifetime);
    if (gone.length > 0) {
      for (const q of gone) {
        if (s.squirrelHoundChance > 0 && rng() < s.squirrelHoundChance) houndCatch(state, q.id, events);
      }
      state.squirrels = state.squirrels.filter((q) => q.age < q.lifetime);
    }
    state.squirrelTimer -= dt;
    if (state.squirrelTimer <= 0) {
      if (state.squirrels.length < MAX_ACTIVE_SQUIRRELS) {
        const id = state.nextSquirrelId++;
        state.squirrels.push({
          id,
          age: 0,
          lifetime: SQUIRREL_LIFETIME_SEC,
          reward: rollSquirrelReward(rng),
        });
        events.push({ type: 'squirrelSpawned', squirrelId: id });
      }
      const interval =
        SQUIRREL_INTERVAL_MIN + rng() * (SQUIRREL_INTERVAL_MAX - SQUIRREL_INTERVAL_MIN);
      state.squirrelTimer = interval / statValue(state, 'squirrelRate');
    }
  }

  // 7. mail: letters pile up to the mailbox capacity, timer carries over
  state.mailTimer -= dt;
  if (state.mailTimer <= 0) {
    const interval = MAIL_INTERVAL_SEC / statValue(state, 'mailRate');
    const letters = 1 + Math.floor(-state.mailTimer / interval);
    state.mailTimer += letters * interval;
    const before = state.mailCount;
    state.mailCount = Math.min(s.mailCapacity, state.mailCount + letters);
    if (state.mailCount > before) events.push({ type: 'mailArrived' });
  }
  if (state.mailCount > s.mailCapacity) state.mailCount = s.mailCapacity;

  // 8. trophies
  checkTrophies(state, events);

  // 9. automation
  state.automationTimer -= dt;
  if (offline || state.automationTimer <= 0) {
    state.automationTimer = AUTOMATION_INTERVAL_SEC;
    const a = automate(state);
    purchases += a.purchases;
    events.push(...a.events);
    if (a.events.length > 0 || a.purchases > 0) checkTrophies(state, events);
  }

  // 10. endgame
  checkEndgame(state, events);

  // 11. find upgrade notification (online only)
  if (!offline) {
    const nextIdx = state.findIndex + 1;
    const next = FINDS[nextIdx];
    if (next && !state.notifiedFinds.includes(nextIdx)) {
      if (computeStats(state).parkValue >= next.unlockParkValue) {
        state.notifiedFinds.push(nextIdx);
        events.push({ type: 'findUpgradeAvailable', findIndex: nextIdx });
      }
    }
  }

  if (!offline) events.push(...checkDigCompletion(state));

  // 12. Dog Show park (home only: the show park's own show is null)
  if (state.show) stepShow(state, dt, rng, offline, events);

  return { events, purchases };
}

export function stepSimulation(
  state: GameState,
  dt: number,
  rng: Rng,
  opts: StepOptions = { offline: false },
): GameEvent[] {
  return stepSimulationDetailed(state, dt, rng, opts).events;
}

export function tick(state: GameState, dt: number, rng: Rng = Math.random): GameEvent[] {
  return stepSimulation(state, dt, rng, { offline: false });
}
