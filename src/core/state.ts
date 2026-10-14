import type { AutomationSettings, GameState } from './types';
import {
  AUTOMATION_INTERVAL_SEC,
  BASE_ADOPTION_CAP,
  DEFAULT_AUTO_PRESTIGE_THRESHOLD,
  KENNEL_SLOTS,
  MAIL_INTERVAL_SEC,
  MAX_FLEET_SLOTS,
  SAVE_VERSION,
  SQUIRREL_INTERVAL_MIN,
  START_CASH,
  START_GOLDEN_BONES,
} from '../data';
import { computeStats } from './stats';

function emptySlots(n: number): (number | null)[] {
  const slots: (number | null)[] = new Array(n).fill(null);
  slots[0] = 0;
  return slots;
}

export function defaultAutomation(): AutomationSettings {
  return {
    find: true,
    build: false,
    training: false,
    whistle: false,
    prestige: false,
    prestigeThreshold: DEFAULT_AUTO_PRESTIGE_THRESHOLD,
  };
}

export function createInitialState(now: number): GameState {
  return {
    version: SAVE_VERSION as 2,
    cash: START_CASH,
    pups: 0,
    adoptionStock: BASE_ADOPTION_CAP,
    kennels: emptySlots(KENNEL_SLOTS),
    vehicles: emptySlots(MAX_FLEET_SLOTS),
    findIndex: 0,
    highestFindIndex: 0,
    training: {},
    academy: {},
    goldenBones: START_GOLDEN_BONES,
    spiritPaws: 0,
    legendCollars: 0,
    trophies: [],
    zoomies: 0,
    zoomieIdle: 0,
    treats: [],
    squirrels: [],
    squirrelTimer: SQUIRREL_INTERVAL_MIN,
    nextSquirrelId: 1,
    mailTimer: MAIL_INTERVAL_SEC,
    mailCount: 0,
    automation: defaultAutomation(),
    automationTimer: AUTOMATION_INTERVAL_SEC,
    runTimeSec: 0,
    endgameReached: false,
    notifiedFinds: [],
    runEarnings: 0,
    lifetimeEarnings: 0,
    prestigeCount: 0,
    createdAt: now,
    lastSaved: now,
    stats: { totalAdopted: 0, totalTaps: 0, squirrelsCaught: 0, mailOpened: 0, totalPlaySec: 0 },
  };
}

/** Resets the per-run parts of the state (see design §3.6). Does not award Spirit Paws. */
export function resetForPrestige(state: GameState): void {
  state.cash = START_CASH;
  state.pups = 0;
  state.kennels = emptySlots(KENNEL_SLOTS);
  state.vehicles = emptySlots(MAX_FLEET_SLOTS);
  state.findIndex = 0;
  state.training = {};
  state.zoomies = 0;
  state.zoomieIdle = 0;
  state.runEarnings = 0;
  state.runTimeSec = 0;
  state.treats = [];
  state.squirrels = [];
  state.notifiedFinds = [];
  state.adoptionStock = computeStats(state).adoptionCap;
}
