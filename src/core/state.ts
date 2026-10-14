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
import { createDailyState } from './counters';

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
    version: SAVE_VERSION as 5,
    cash: START_CASH,
    pups: 0,
    adoptionStock: BASE_ADOPTION_CAP,
    kennels: emptySlots(KENNEL_SLOTS),
    vehicles: emptySlots(MAX_FLEET_SLOTS),
    vehicleCars: new Array(MAX_FLEET_SLOTS).fill(0),
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
    daily: createDailyState(),
    premium: { stars: 0, spendCents: 0, receipts: [], shop: {} },
    show: null,
    showHistory: [],
    notifiedFinds: [],
    runEarnings: 0,
    lifetimeEarnings: 0,
    prestigeCount: 0,
    createdAt: now,
    lastSaved: now,
    stats: { totalAdopted: 0, totalTaps: 0, squirrelsCaught: 0, mailOpened: 0, totalPlaySec: 0, findsDelivered: 0 },
  };
}

/**
 * Shared park rebuild used by Find eras and prestige: sets cash, empties pups, kennels, fleet,
 * training and zoomies, and refills adoption stock to the cap computed after the reset.
 */
export function resetPark(state: GameState, cash: number): void {
  state.cash = cash;
  state.pups = 0;
  state.kennels = emptySlots(KENNEL_SLOTS);
  state.vehicles = emptySlots(MAX_FLEET_SLOTS);
  state.vehicleCars = new Array(MAX_FLEET_SLOTS).fill(0);
  state.training = {};
  state.zoomies = 0;
  state.zoomieIdle = 0;
  state.adoptionStock = computeStats(state).adoptionCap;
}

/** Resets the per-run parts of the state (see design §3.6). Does not award Spirit Paws. */
export function resetForPrestige(state: GameState): void {
  state.findIndex = 0;
  state.runEarnings = 0;
  state.runTimeSec = 0;
  state.treats = [];
  state.squirrels = [];
  state.notifiedFinds = [];
  resetPark(state, START_CASH);
}
