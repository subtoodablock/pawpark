import type { GameState, OfflineReport } from './types';
import { OFFLINE_MAX_CHUNK_SEC, OFFLINE_MIN_SEC } from '../data';
import { computeStats } from './stats';
import { stepSimulationDetailed } from './tick';
import { syncDigNotifications } from './daily';

const MS_PER_SEC = 1000;

/**
 * Fast-forwards the park by the time away (capped by the Treat Jar) using the same
 * stepSimulation as the online tick, in chunks of at most OFFLINE_MAX_CHUNK_SEC.
 */
export function applyOfflineProgress(state: GameState, now: number): OfflineReport | null {
  const elapsedSec = (now - state.lastSaved) / MS_PER_SEC;
  if (!(elapsedSec >= OFFLINE_MIN_SEC)) return null;

  const simulatedSec = Math.min(elapsedSec, computeStats(state).offlineCapSec);

  const earnedBefore = state.lifetimeEarnings;
  const pupsBefore = state.pups;
  const pawsBefore = state.spiritPaws;
  const bonesBefore = state.goldenBones;
  const caughtBefore = state.stats.squirrelsCaught;

  state.squirrels = [];
  state.zoomies = 0;
  state.zoomieIdle = 0;

  let purchases = 0;
  let prestiges = 0;
  let endgame = false;
  const findsUnlocked: number[] = [];
  const trophies: string[] = [];

  let remaining = simulatedSec;
  while (remaining > 1e-9) {
    const dt = Math.min(OFFLINE_MAX_CHUNK_SEC, remaining);
    const r = stepSimulationDetailed(state, dt, Math.random, { offline: true });
    remaining -= dt;
    purchases += r.purchases;
    for (const e of r.events) {
      if (e.type === 'autoPrestige') prestiges++;
      else if (e.type === 'findUnlocked' && e.firstTime) findsUnlocked.push(e.findIndex);
      else if (e.type === 'trophy') trophies.push(e.trophyId);
      else if (e.type === 'endgame') endgame = true;
    }
  }

  syncDigNotifications(state);
  state.lastSaved = now;
  return {
    elapsedSec,
    simulatedSec,
    lostSec: elapsedSec - simulatedSec,
    earned: state.lifetimeEarnings - earnedBefore,
    pupsGained: state.pups - pupsBefore,
    purchases,
    findsUnlocked,
    prestiges,
    spiritPawsGained: state.spiritPaws - pawsBefore,
    goldenBonesGained: state.goldenBones - bonesBefore,
    squirrelsCaught: state.stats.squirrelsCaught - caughtBefore,
    trophies,
    mailWaiting: state.mailCount,
    endgame,
  };
}
