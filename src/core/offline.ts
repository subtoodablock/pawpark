import type { GameState, OfflineReport } from './types';
import {
  OFFLINE_CHUNKS,
  OFFLINE_MIN_CHUNK_SEC,
  OFFLINE_MIN_SEC,
  OFFLINE_RESCUE_BASE,
} from '../data';
import { computeStats, statValue } from './stats';
import { stepSimulation } from './tick';

const MS_PER_SEC = 1000;

export function applyOfflineProgress(state: GameState, now: number): OfflineReport | null {
  const elapsedSec = (now - state.lastSaved) / MS_PER_SEC;
  if (!(elapsedSec >= OFFLINE_MIN_SEC)) return null;

  const capSec = computeStats(state).offlineCapSec;
  const simulatedSec = Math.min(elapsedSec, capSec);
  const rescueFactor = Math.min(1, OFFLINE_RESCUE_BASE + statValue(state, 'offlineRescue'));

  const earnedBefore = state.lifetimeEarnings;
  const pupsBefore = state.pups;

  state.squirrels = [];
  state.zoomies = 0;
  state.zoomieIdle = 0;

  const chunk = Math.max(OFFLINE_MIN_CHUNK_SEC, simulatedSec / OFFLINE_CHUNKS);
  let remaining = simulatedSec;
  while (remaining > 1e-9) {
    const dt = Math.min(chunk, remaining);
    stepSimulation(state, dt, Math.random, { offline: { rescueFactor } });
    remaining -= dt;
  }

  state.lastSaved = now;
  return {
    elapsedSec,
    simulatedSec,
    earned: state.lifetimeEarnings - earnedBefore,
    pupsGained: state.pups - pupsBefore,
  };
}
