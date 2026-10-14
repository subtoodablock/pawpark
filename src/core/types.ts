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
  | 'mailCapacity'
  | 'squirrelHound' // chance 0..1 that an uncaught squirrel is auto-caught
  // automation: unlock flags (>= 1 = unlocked) and auto-whistle strength
  | 'autoBuild'
  | 'autoTraining'
  | 'autoPrestige'
  | 'autoWhistle' // fraction of adoptionRefill auto-adopted per second
  // v3 (mult)
  | 'earnings' // multiplies incomePerSec and parkValue
  | 'mailRate' // divides MAIL_INTERVAL_SEC
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
  starCost: number; // Pup Stars (premium alternative)
}

export type TrophyKind = 'pups' | 'lifetimeEarnings' | 'prestiges' | 'find';

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  kind: TrophyKind;
  /** pups count, lifetime earnings, prestige count, or find index (vs highestFindIndex) */
  threshold: number;
  collars: number;
  goldenBones: number;
}

// ---------------------------------------------------------------- automation

export type AutomationKey = 'find' | 'build' | 'training' | 'whistle' | 'prestige';

export interface AutomationSettings {
  find: boolean;
  build: boolean;
  training: boolean;
  whistle: boolean;
  prestige: boolean;
  /** auto-prestige when gain >= max(1, prestigeThreshold × spiritPaws) */
  prestigeThreshold: number;
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
  version: 3;
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
  /** letters waiting, capped at DerivedStats.mailCapacity */
  mailCount: number;
  automation: AutomationSettings;
  /** seconds until the next automation pass (online); offline runs once per chunk */
  automationTimer: number;
  /** seconds (online + offline) since this park was opened; resets on prestige */
  runTimeSec: number;
  /** true once the endgame event has fired */
  endgameReached: boolean;
  daily: DailyState;
  premium: PremiumState;
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
  mailCapacity: number;
  squirrelHoundChance: number; // 0..1
  autoWhistleFrac: number; // 0..1
  /** unlocked (not necessarily enabled) automation */
  automationUnlocked: Record<AutomationKey, boolean>;
  // v3
  parkLevel: number;
  parkTitle: string;
  vipTier: number; // 0..VIP_TIERS.length-1
  modifier: DailyModifierDef | null;
  totalTrainingLevels: number;
  prestigeGain: number; // spirit paws if prestiged now
}

// ---------------------------------------------------------------- results/events

export interface ActionResult {
  ok: boolean;
  reason?: string; // human-readable, shown in a toast when ok=false
}

export type GameEvent =
  | { type: 'trophy'; trophyId: string; collars: number; goldenBones: number }
  | { type: 'findUpgradeAvailable'; findIndex: number }
  | { type: 'findUnlocked'; findIndex: number; auto: boolean; firstTime: boolean }
  | { type: 'autoPrestige'; gained: number }
  | { type: 'squirrelHound'; reward: RewardResult }
  | { type: 'endgame' }
  | { type: 'dailyDigComplete'; index: number }
  | { type: 'streakMilestone'; streak: number; stars: number }
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
  lostSec: number; // elapsedSec - simulatedSec
  earned: number; // cash earned from income (all parks, incl. across prestiges)
  pupsGained: number; // net change in pups (may be negative after a prestige)
  purchases: number; // automation buys
  findsUnlocked: number[]; // find indices upgraded to
  prestiges: number;
  spiritPawsGained: number;
  goldenBonesGained: number;
  squirrelsCaught: number;
  trophies: string[];
  mailWaiting: number;
  endgame: boolean;
}

/** Injectable RNG returning [0, 1). Defaults to Math.random. */
export type Rng = () => number;

// ---------------------------------------------------------------- v3: daily + premium
// Spec: docs/06-daily-social-premium.md

/** Local calendar date 'YYYY-MM-DD' */
export type DayKey = string;

export type DailyDigKind =
  | 'squirrels'
  | 'letters'
  | 'whistle'
  | 'training'
  | 'buildings'
  | 'earn'
  | 'treat'
  | 'zoomies';

export interface DailyDigDef {
  kind: DailyDigKind;
  name: string;
  icon: string;
  /** text with {n} placeholder for the target */
  text: string;
  /** fixed target; 'earn' computes its target at roll time instead */
  target: number;
  rewardBones: number;
}

export interface DailyDig {
  kind: DailyDigKind;
  target: number;
  claimed: boolean;
}

export type DailyCounters = Record<DailyDigKind, number>;

export type DailyTreatReward =
  | { kind: 'goldenBones'; amount: number }
  | { kind: 'treat'; treatId: string }
  | { kind: 'bundle'; goldenBones: number; stars: number };

export interface DailyModifierDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  stat: Stat; // must be a mult stat
  multiplier: number;
}

export interface DailyState {
  lastSeenDay: DayKey | null;
  lastClaimDay: DayKey | null;
  streak: number;
  bestStreak: number;
  streakFreezes: number;
  /** streak milestones (e.g. 30, 100, 365) already rewarded */
  streakMilestones: number[];
  digsDay: DayKey | null;
  digs: DailyDig[];
  digBonusClaimed: boolean;
  modifierId: string | null;
  counters: DailyCounters;
}

export interface ProductDef {
  id: string;
  name: string;
  stars: number;
  priceCents: number;
  /** optional marketing tag, e.g. 'Best value' */
  tag?: string;
}

export interface VipTierDef {
  tier: number;
  name: string;
  icon: string;
  minSpendCents: number;
  earningsBonus: number; // e.g. 0.04 → earnings ×1.04 (replaces lower tiers)
  mailCapacity: number; // extra mailbox slots
  offlineHours: number; // extra Treat Jar hours
}

export interface PremiumShopDef extends UpgradeDef {
  /** minimum Kennel Club tier to buy */
  requiredTier: number;
}

export interface PremiumState {
  stars: number;
  spendCents: number;
  receipts: string[];
  /** premium shop id -> level */
  shop: Record<string, number>;
}

