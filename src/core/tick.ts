import type { GameEvent, GameState, Rng, SquirrelReward } from './types';
import {
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
import { randInt } from './actions';
import { computeStats, statValue } from './stats';

export interface StepOptions {
  /** Offline mode: no zoomies, no squirrels, no find notifications; rescue scaled by rescueFactor. */
  offline?: { rescueFactor: number };
}

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

/** One simulation step (design §3.1). `tick` and offline progress both use this. */
export function stepSimulation(
  state: GameState,
  dt: number,
  rng: Rng,
  opts: StepOptions = {},
): GameEvent[] {
  const events: GameEvent[] = [];
  if (!(dt > 0)) return events;
  const offline = opts.offline;
  const s = computeStats(state);

  // 1. adoption stock
  state.adoptionStock = Math.min(s.adoptionCap, state.adoptionStock + s.adoptionRefill * dt);

  // 2. rescue
  const rescue = s.rescuePerSec * (offline ? offline.rescueFactor : 1);
  if (rescue > 0) {
    state.pups = Math.max(state.pups, Math.min(s.kennelCapacity, state.pups + rescue * dt));
  }

  // 3. zoomies
  if (offline) {
    state.zoomies = 0;
  } else {
    state.zoomieIdle += dt;
    if (state.zoomieIdle > ZOOMIE_GRACE_SEC) {
      state.zoomies = Math.max(0, state.zoomies - ZOOMIE_DECAY_PER_SEC * dt);
    }
    state.stats.totalPlaySec += dt;
  }

  // 4. earnings (stats from the start of the step)
  const earned = s.incomePerSec * dt;
  state.cash += earned;
  state.runEarnings += earned;
  state.lifetimeEarnings += earned;

  // 5. treats
  for (const t of state.treats) t.remaining -= dt;
  const expired = state.treats.filter((t) => t.remaining <= 0);
  if (expired.length > 0) {
    state.treats = state.treats.filter((t) => t.remaining > 0);
    for (const t of expired) events.push({ type: 'treatExpired', treatId: t.id });
  }

  // 6. squirrels
  if (!offline) {
    for (const q of state.squirrels) q.age += dt;
    state.squirrels = state.squirrels.filter((q) => q.age < q.lifetime);
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

  // 7. mail
  state.mailTimer -= dt;
  if (state.mailTimer <= 0) {
    if (!state.mailReady) {
      state.mailReady = true;
      events.push({ type: 'mailArrived' });
    }
    state.mailTimer = MAIL_INTERVAL_SEC;
  }

  // 8. trophies
  for (const tr of TROPHIES) {
    if (state.pups >= tr.pupsRequired && !state.trophies.includes(tr.id)) {
      state.trophies.push(tr.id);
      state.legendCollars += tr.collars;
      events.push({ type: 'trophy', trophyId: tr.id, collars: tr.collars });
    }
  }

  // 9. find upgrade notification
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

  return events;
}

export function tick(state: GameState, dt: number, rng: Rng = Math.random): GameEvent[] {
  return stepSimulation(state, dt, rng);
}
