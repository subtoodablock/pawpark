import type { Stat, StatMode } from '../core/types';

export const START_CASH = 0;
export const START_GOLDEN_BONES = 10;

// ---- v4 Find eras (docs/08)
/** Starting cash of a new era = ERA_START_CASH * costScale of the new Find (the first doghouse + bike) */
export const ERA_START_CASH = 600;
/**
 * v5: price of tier t in a slot is multiplied by DUPLICATE_GROWTH_BY_TIER[t] per OTHER slot already
 * holding tier >= t. 1.35 for low tiers, rising to x3..x5 for the top three tiers.
 * (Indexed by KENNELS tier / VEHICLES tier respectively.)
 */
export const DUPLICATE_GROWTH_BY_TIER: readonly number[] = [
  1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.6, 2, 2.5, 3, 4, 5,
];
export const VEHICLE_DUPLICATE_GROWTH_BY_TIER: readonly number[] = [
  1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.6, 2, 3, 4, 5,
];
/** v5: optional cap on the (normally 1) era price tax in FINDS[k].costScale */
export const MAX_COST_SCALE = 1.5;

export const KENNEL_SLOTS = 4;
export const BASE_FLEET_SLOTS = 4;
export const MAX_FLEET_SLOTS = 12;

export const BASE_DIG_PER_MIN = 6;
/** passive rescue: pups per minute per built kennel, before rescueRate training */
export const BASE_RESCUE_PER_MIN = 2;

export const BASE_ADOPTION_CAP = 50;
export const BASE_ADOPTION_REFILL = 1;
export const HOLD_ADOPT_PER_SEC = 6;

export const BASE_MAX_ZOOMIES = 20;
export const BASE_ZOOMIE_BONUS = 0.05;
export const ZOOMIE_GRACE_SEC = 1.0;
export const ZOOMIE_DECAY_PER_SEC = 10;

export const BASE_SPIRIT_PAW_BONUS = 0.1;
export const BASE_COLLAR_BONUS = 1.05;
/** v5 prestige (docs/10 §2.5): piecewise gain, continuous at PRESTIGE_KNEE (run earnings) */
export const PRESTIGE_DIVISOR = 1e6;
export const PRESTIGE_KNEE = 1e12;
export const PRESTIGE_EXP_EARLY = 0.3;
export const PRESTIGE_EXP_LATE = 0.2;
/** Park Value tuning constant (docs/10 §2.2) */
export const PARK_VALUE_SECONDS = 600;
/** Park Value popTerm weights (docs/10 §2.2): unshipped pups count this much, emptySpace^exp, rescue-potential factor */
export const PV_UNSHIPPED_WEIGHT = 0.2;
export const PV_EMPTY_SPACE_EXP = 0.5;
export const PV_RESCUE_FACTOR = 0.03;
/** a Find is "discovered" (carousel teaser) once parkValue >= gate / DISCOVER_DIVISOR */
export const DISCOVER_DIVISOR = 6.5;

// ---- v5 sled cars (docs/10 §2.7)
export const BASE_MAX_CARS = 5;
/** adding a car to a slot with c cars costs topTierCost * CAR_COST_GROWTH^c */
export const CAR_COST_GROWTH = 3;

export const BASE_OFFLINE_HOURS = 8;
/** offline simulation runs stepSimulation in chunks of at most this many seconds */
export const OFFLINE_MAX_CHUNK_SEC = 60;
export const OFFLINE_MIN_SEC = 5;
export const OFFLINE_MIN_CHUNK_SEC = 1;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_MIN = 60;

export const SQUIRREL_INTERVAL_MIN = 900;
export const SQUIRREL_INTERVAL_MAX = 1800;
export const SQUIRREL_LIFETIME_SEC = 7;
export const MAX_ACTIVE_SQUIRRELS = 2;
export const MIN_SQUIRREL_CASH_RATE = 1;
/** squirrel reward roll thresholds (cumulative) */
export const SQUIRREL_CASH_CHANCE = 0.6;
export const SQUIRREL_BONES_CHANCE = 0.95; // 0.6..0.95 = 35% bones, rest treat
export const SQUIRREL_CASH_SEC_MIN = 30;
export const SQUIRREL_CASH_SEC_MAX = 90;
export const SQUIRREL_BONES_MIN = 1;
export const SQUIRREL_BONES_MAX = 4;
export const SQUIRREL_TREAT_DURATION_FRAC = 0.5;

export const BASE_MAIL_CAPACITY = 6;
export const MAIL_INTERVAL_SEC = 7200;
export const MAIL_BONES_CHANCE = 0.55;
export const MAIL_CASH_CHANCE = 0.8; // cumulative; rest = treat
export const MAIL_BONES_MIN = 2;
export const MAIL_BONES_MAX = 7;
export const MAIL_CASH_SECONDS = 300;

export const MIN_COST_MULTIPLIER = 0.25;
export const AUTOSAVE_INTERVAL_SEC = 10;
export const SAVE_KEY = 'pawpark.save.v1';
export const SAVE_VERSION = 6;

// ---- automation ("The Pack")
export const AUTOMATION_INTERVAL_SEC = 2;
export const AUTOMATION_MAX_BUYS = 50;
/** side purchases are allowed when they cost <= this fraction of the cheapest priority item */
export const AUTO_SPLURGE_FRACTION = 0.1;
export const AUTO_PRESTIGE_MIN_RUN_SEC = 600;
export const AUTO_PRESTIGE_THRESHOLDS: readonly number[] = [0.1, 0.25, 0.5, 1, 2];
export const DEFAULT_AUTO_PRESTIGE_THRESHOLD = 0.5;

export const STAT_MODES: Record<Stat, StatMode> = {
  layRate: 'mult',
  findValue: 'mult',
  kennelCapacity: 'mult',
  shippingCapacity: 'mult',
  squirrelRate: 'mult',
  earnings: 'mult',
  mailRate: 'mult',
  rescueMult: 'mult',
  offlineRescueMult: 'mult',
  sledCars: 'add',
  adoptionCap: 'add',
  adoptionRefill: 'add',
  rescueRate: 'add',
  fleetSlots: 'add',
  zoomieBonus: 'add',
  maxZoomies: 'add',
  spiritPawBonus: 'add',
  collarBonus: 'add',
  offlineHours: 'add',
  mailCapacity: 'add',
  squirrelHound: 'add',
  autoBuild: 'add',
  autoTraining: 'add',
  autoPrestige: 'add',
  autoWhistle: 'add',
  researchDiscount: 'add',
  kennelDiscount: 'add',
  fleetDiscount: 'add',
};
