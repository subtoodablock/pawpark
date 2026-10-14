// Paw Park — shared contract between engine (src/core, src/data) and UI (src/ui).
// Spec: docs/02-paw-park-design.md, docs/03-architecture.md.
// Changing anything here is a contract change: update both sides and the docs.

/** Every upgradeable stat in the game. Mode (mult/add) is fixed in STAT_MODES. */
export type Stat =
  // multiplicative: Π (1 + perLevel × level)
  | 'layRate'
  | 'findValue'
  | 'kennelCapacity'
  | 'shippingCapacity'
  | 'squirrelRate'
  // additive: Σ perLevel × level
  | 'adoptionCap'
  | 'adoptionRefill'
  | 'rescueRate'
  | 'fleetSlots'
  | 'zoomieBonus'
  | 'maxZoomies'
  | 'spiritPawBonus'
  | 'collarBonus'
  | 'offlineHours'
  | 'offlineRescue'
  | 'researchDiscount'
  | 'kennelDiscount'
  | 'fleetDiscount';

export type StatMode = 'mult' | 'add';

// ---------------------------------------------------------------- content defs

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  stat: Stat;
  perLevel: number;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
}

/** Common research ("Training"). Paid in cash, resets on prestige. */
export interface TrainingDef extends UpgradeDef {
  tier: number; // 1-based
}

export interface TrainingTierDef {
  tier: number;
  name: string;
  /** total training levels purchased (this run) required to unlock */
  unlockAt: number;
}

/** Epic research ("Academy"). Paid in Golden Bones, permanent. */
export type AcademyDef = UpgradeDef;

export interface KennelTierDef {
  id: string;
  name: string;
  icon: string;
  capacity: number;
  cost: number;
}

export interface VehicleTierDef {
  id: string;
  name: string;
  icon: string;
  capacityPerMin: number;
  cost: number;
}

export interface FindDef {
  id: string;
  name: string;
  icon: string;
  flavor: string;
  value: number;
  unlockParkValue: number;
  /** Golden Bones granted the first time this find is ever reached */
  unlockReward: number;
}

export type TreatEffect = 'earnings' | 'layRate' | 'adoption';

export interface TreatDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  effect: TreatEffect;
  multiplier: number;
  durationSec: number;
  cost: number; // Golden Bones
}

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  pupsRequired: number;
  collars: number;
}

// ---------------------------------------------------------------- runtime state

export interface ActiveTreat {
  id: string;
  remaining: number; // seconds
}

export type SquirrelReward =
  | { kind: 'cash'; incomeSeconds: number } // resolved to cash at catch time
  | { kind: 'goldenBones'; amount: number }
  | { kind: 'treat'; treatId: string; durationSec: number };

export interface Squirrel {
  id: number;
  age: number; // seconds since spawn
  lifetime: number; // despawns when age >= lifetime
  reward: SquirrelReward;
}

export interface GameStats {
  totalAdopted: number;
  totalTaps: number;
  squirrelsCaught: number;
  mailOpened: number;
  totalPlaySec: number;
}

export interface GameState {
  version: 1;
  cash: number;
  pups: number;
  adoptionStock: number;
  /** length KENNEL_SLOTS; tier index into KENNELS or null if empty */
  kennels: (number | null)[];
  /** length MAX_FLEET_SLOTS; tier index into VEHICLES or null if empty */
  vehicles: (number | null)[];
  findIndex: number;
  highestFindIndex: number;
  /** training id -> level (resets on prestige) */
  training: Record<string, number>;
  /** academy id -> level (permanent) */
  academy: Record<string, number>;
  goldenBones: number;
  spiritPaws: number;
  legendCollars: number;
  trophies: string[];
  zoomies: number;
  zoomieIdle: number;
  treats: ActiveTreat[];
  squirrels: Squirrel[];
  squirrelTimer: number;
  nextSquirrelId: number;
  mailTimer: number;
  mailReady: boolean;
  /** find indices for which findUpgradeAvailable was already emitted this run */
  notifiedFinds: number[];
  runEarnings: number;
  lifetimeEarnings: number;
  prestigeCount: number;
  createdAt: number; // epoch ms
  lastSaved: number; // epoch ms
  stats: GameStats;
}

/** Everything derived from state. Pure function of state: computeStats(state). */
export interface DerivedStats {
  kennelCapacity: number;
  builtKennels: number;
  fleetSlots: number;
  shipPerSec: number;
  digPerPupPerSec: number;
  digPerSec: number;
  deliveredPerSec: number;
  bottleneck: 'dig' | 'ship';
  findValue: number;
  earningsBonus: number;
  pawBonus: number; // per spirit paw, e.g. 0.10
  collarMult: number; // (1.05+)^collars
  maxZoomies: number;
  zoomieBonusPer: number;
  zoomieMult: number;
  treatMult: Record<TreatEffect, number>;
  incomePerSec: number;
  parkValue: number;
  adoptionCap: number;
  adoptionRefill: number; // stock / sec
  rescuePerSec: number; // pups / sec
  offlineCapSec: number;
  totalTrainingLevels: number;
  prestigeGain: number; // spirit paws if prestiged now
}

// ---------------------------------------------------------------- results/events

export interface ActionResult {
  ok: boolean;
  reason?: string; // human-readable, shown in a toast when ok=false
}

export type GameEvent =
  | { type: 'trophy'; trophyId: string; collars: number }
  | { type: 'findUpgradeAvailable'; findIndex: number }
  | { type: 'mailArrived' }
  | { type: 'squirrelSpawned'; squirrelId: number }
  | { type: 'treatExpired'; treatId: string };

export type RewardResult =
  | { kind: 'cash'; amount: number }
  | { kind: 'goldenBones'; amount: number }
  | { kind: 'treat'; treatId: string; durationSec: number };

export interface OfflineReport {
  elapsedSec: number;
  simulatedSec: number; // after Treat Jar cap
  earned: number;
  pupsGained: number;
}

/** Injectable RNG returning [0, 1). Defaults to Math.random. */
export type Rng = () => number;
