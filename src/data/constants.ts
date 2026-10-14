import type { Stat, StatMode } from '../core/types';

export const START_CASH = 0;
export const START_GOLDEN_BONES = 10;

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
export const PRESTIGE_DIVISOR = 1e8;
export const PRESTIGE_EXPONENT = 0.3;
export const PARK_VALUE_SECONDS = 3600;

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
export const SAVE_VERSION = 3;

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
