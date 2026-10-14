import type { AutomationKey, DailyModifierDef, DerivedStats, GameState, Stat, StatMode, TreatEffect, UpgradeDef } from './types';
import {
  ACADEMY,
  BASE_ADOPTION_CAP,
  BASE_ADOPTION_REFILL,
  BASE_COLLAR_BONUS,
  BASE_DIG_PER_MIN,
  BASE_FLEET_SLOTS,
  BASE_MAIL_CAPACITY,
  BASE_MAX_CARS,
  DISCOVER_DIVISOR,
  PRESTIGE_KNEE,
  PRESTIGE_EXP_EARLY,
  PRESTIGE_EXP_LATE,
  PUP_RANK_TITLES,
  PV_EMPTY_SPACE_EXP,
  PV_RESCUE_FACTOR,
  PV_UNSHIPPED_WEIGHT,
  BASE_RESCUE_PER_MIN,
  BASE_MAX_ZOOMIES,
  BASE_OFFLINE_HOURS,
  BASE_SPIRIT_PAW_BONUS,
  BASE_ZOOMIE_BONUS,
  DAILY_MODIFIERS,
  FINDS,
  KENNELS,
  MAX_FLEET_SLOTS,
  MIN_COST_MULTIPLIER,
  PARK_LEVEL_THRESHOLDS,
  PARK_TITLES,
  PARK_VALUE_SECONDS,
  PREMIUM_SHOP,
  PRESTIGE_DIVISOR,
  SECONDS_PER_HOUR,
  SECONDS_PER_MIN,
  STAT_MODES,
  TRAINING,
  TREATS,
  VEHICLES,
  VIP_TIERS,
} from '../data';
import { applyPortalStat } from './relics';

// local snapshots: the data barrel's re-export getters are costly in hot paths (automation runs computeStats ~50k times)
const L_STAT_MODES = STAT_MODES;
const L_VIP_TIERS = VIP_TIERS;
const L_KENNELS = KENNELS;
const L_VEHICLES = VEHICLES;
const L_FINDS = FINDS;
const L_TREATS = TREATS;
const L_BASE_DIG_PER_MIN = BASE_DIG_PER_MIN;
const L_BASE_RESCUE_PER_MIN = BASE_RESCUE_PER_MIN;
const L_SECONDS_PER_MIN = SECONDS_PER_MIN;
const L_SECONDS_PER_HOUR = SECONDS_PER_HOUR;
const L_BASE_FLEET_SLOTS = BASE_FLEET_SLOTS;
const L_MAX_FLEET_SLOTS = MAX_FLEET_SLOTS;
const L_BASE_OFFLINE_HOURS = BASE_OFFLINE_HOURS;
const L_BASE_ADOPTION_CAP = BASE_ADOPTION_CAP;
const L_BASE_ADOPTION_REFILL = BASE_ADOPTION_REFILL;
const L_BASE_MAX_ZOOMIES = BASE_MAX_ZOOMIES;
const L_BASE_ZOOMIE_BONUS = BASE_ZOOMIE_BONUS;
const L_BASE_SPIRIT_PAW_BONUS = BASE_SPIRIT_PAW_BONUS;
const L_BASE_COLLAR_BONUS = BASE_COLLAR_BONUS;
const L_BASE_MAIL_CAPACITY = BASE_MAIL_CAPACITY;
const L_PARK_VALUE_SECONDS = PARK_VALUE_SECONDS;
const L_BASE_MAX_CARS = BASE_MAX_CARS;
const L_DISCOVER_DIVISOR = DISCOVER_DIVISOR;
const L_PV_UNSHIPPED_WEIGHT = PV_UNSHIPPED_WEIGHT;
const L_PV_EMPTY_SPACE_EXP = PV_EMPTY_SPACE_EXP;
const L_PV_RESCUE_FACTOR = PV_RESCUE_FACTOR;


interface Source {
  def: UpgradeDef;
  kind: 'training' | 'academy' | 'premium';
}

const SOURCES: Record<string, Source[]> = {};
for (const def of TRAINING) (SOURCES[def.stat] ??= []).push({ def, kind: 'training' });
for (const def of ACADEMY) (SOURCES[def.stat] ??= []).push({ def, kind: 'academy' });
for (const def of PREMIUM_SHOP) (SOURCES[def.stat] ??= []).push({ def, kind: 'premium' });

export function statMode(stat: Stat): StatMode {
  return L_STAT_MODES[stat];
}

/** Park Level: number of thresholds reached (minimum 1). Never decreases with lifetime earnings. */
export function parkLevel(lifetimeEarnings: number): number {
  let lo = 0;
  let hi = PARK_LEVEL_THRESHOLDS.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (PARK_LEVEL_THRESHOLDS[mid] <= lifetimeEarnings) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(1, lo);
}

export function parkTitle(level: number): string {
  const i = Math.min(PARK_TITLES.length - 1, Math.max(0, Math.floor(level / 10)));
  return PARK_TITLES[i];
}

/** Kennel Club tier for a lifetime spend in cents. */
export function vipTierFor(spendCents: number): number {
  let tier = 0;
  for (const t of L_VIP_TIERS) if (spendCents >= t.minSpendCents) tier = t.tier;
  return tier;
}

/** M(stat) for mult stats (product of 1 + perLevel*level), A(stat) for add stats (sum). */
export function statValue(state: GameState, stat: Stat): number {
  const mode = L_STAT_MODES[stat];
  let acc = mode === 'mult' ? 1 : 0;
  for (const { def, kind } of SOURCES[stat] ?? []) {
    const level =
      (kind === 'training' ? state.training[def.id] : kind === 'academy' ? state.academy[def.id] : state.premium.shop[def.id]) ?? 0;
    if (level <= 0) continue;
    if (mode === 'mult') acc *= def.multPerLevel !== undefined ? Math.pow(def.multPerLevel, level) : 1 + def.perLevel * level;
    else acc += def.perLevel * level;
  }
  // Paw Portal: equipped relics + socketed stones
  if (state.portal) acc = applyPortalStat(state, stat, acc, mode === 'mult');
  // Kennel Club perks: the current tier replaces lower ones (no stacking)
  const vip = L_VIP_TIERS[vipTierFor(state.premium.spendCents)];
  if (vip) {
    if (stat === 'earnings') acc *= 1 + vip.earningsBonus;
    else if (stat === 'mailCapacity') acc += vip.mailCapacity;
    else if (stat === 'offlineHours') acc += vip.offlineHours;
  }
  // Park of the Day
  const mod = currentModifier(state);
  if (mod && mod.stat === stat && mode === 'mult') acc *= mod.multiplier;
  return acc;
}

function currentModifier(state: GameState): DailyModifierDef | null {
  const id = state.daily.modifierId;
  return (id && DAILY_MODIFIERS.find((m) => m.id === id)) || null;
}

/** Cost multiplier from a discount stat, clamped at MIN_COST_MULTIPLIER. */
export function costMultiplier(
  state: GameState,
  stat: 'researchDiscount' | 'kennelDiscount' | 'fleetDiscount',
): number {
  return Math.max(MIN_COST_MULTIPLIER, 1 - statValue(state, stat));
}

export function totalTrainingLevels(state: GameState): number {
  let total = 0;
  for (const def of TRAINING) total += state.training[def.id] ?? 0;
  return total;
}

function treatMultFor(state: GameState): Record<TreatEffect, number> {
  const m: Record<TreatEffect, number> = { earnings: 1, layRate: 1, adoption: 1 };
  for (const t of state.treats) {
    const def = L_TREATS.find((d) => d.id === t.id);
    if (def && t.remaining > 0) m[def.effect] *= def.multiplier;
  }
  return m;
}

/** v5 prestige gain (docs/10 §2.5): exponent EARLY below PRESTIGE_KNEE run earnings, LATE above, continuous at the knee. */
export function prestigeGainFor(runEarnings: number): number {
  const e = Math.max(0, runEarnings);
  const atKnee = Math.pow(PRESTIGE_KNEE / PRESTIGE_DIVISOR, PRESTIGE_EXP_EARLY);
  const raw =
    e <= PRESTIGE_KNEE
      ? Math.pow(e / PRESTIGE_DIVISOR, PRESTIGE_EXP_EARLY)
      : atKnee * Math.pow(e / PRESTIGE_KNEE, PRESTIGE_EXP_LATE);
  return Math.floor(raw);
}

/** Pup Rank (docs/10 §2.6): floor(log10(earnings bonus as a percent above base)), min 0. */
export function pupRankFor(earningsBonus: number): number {
  const pct = (earningsBonus - 1) * 100;
  if (!(pct >= 1)) return 0;
  return Math.max(0, Math.floor(Math.log10(pct) + 1e-9));
}

export function pupRankTitleFor(rank: number): string {
  return PUP_RANK_TITLES[Math.min(PUP_RANK_TITLES.length - 1, Math.max(0, rank))];
}

/** Index of the top vehicle tier (the Sled Express). */
export const TOP_VEHICLE_TIER = L_VEHICLES.length - 1;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function computeStats(state: GameState): DerivedStats {
  const treatMult = treatMultFor(state);

  let rawCapacity = 0;
  let builtKennels = 0;
  for (const tier of state.kennels) {
    if (tier === null || tier === undefined) continue;
    const def = L_KENNELS[tier];
    if (!def) continue;
    rawCapacity += def.capacity;
    builtKennels++;
  }
  const kennelCapacity = rawCapacity * statValue(state, 'kennelCapacity');

  const fleetSlots = Math.min(
    L_MAX_FLEET_SLOTS,
    L_BASE_FLEET_SLOTS + Math.floor(statValue(state, 'fleetSlots')),
  );
  let rawShip = 0;
  for (let i = 0; i < Math.min(fleetSlots, state.vehicles.length); i++) {
    const tier = state.vehicles[i];
    if (tier === null || tier === undefined) continue;
    const def = L_VEHICLES[tier];
    if (def) {
      const cars = tier === TOP_VEHICLE_TIER ? Math.max(1, state.vehicleCars?.[i] ?? 0) : 1;
      rawShip += (def.capacityPerMin * cars) / L_SECONDS_PER_MIN;
    }
  }
  const shipPerSec = rawShip * statValue(state, 'shippingCapacity');

  const layRate = statValue(state, 'layRate');
  const digPerPupPerSec = (L_BASE_DIG_PER_MIN / L_SECONDS_PER_MIN) * layRate * treatMult.layRate;
  const digPerSec = state.pups * digPerPupPerSec;
  const deliveredPerSec = Math.min(digPerSec, shipPerSec);
  const bottleneck: 'dig' | 'ship' = digPerSec <= shipPerSec ? 'dig' : 'ship';

  const find = L_FINDS[state.findIndex] ?? L_FINDS[0];
  const findValueMult = statValue(state, 'findValue');
  const findValue = find.value * findValueMult;

  const pawBonus = L_BASE_SPIRIT_PAW_BONUS + statValue(state, 'spiritPawBonus');
  const collarMult = Math.pow(
    L_BASE_COLLAR_BONUS + statValue(state, 'collarBonus'),
    state.legendCollars,
  );
  const earningsBonus = 1 + state.spiritPaws * pawBonus * collarMult;

  const maxZoomies = L_BASE_MAX_ZOOMIES + statValue(state, 'maxZoomies');
  const zoomieBonusPer = L_BASE_ZOOMIE_BONUS + statValue(state, 'zoomieBonus');
  const zoomieMult = 1 + Math.floor(state.zoomies) * zoomieBonusPer;

  const base = deliveredPerSec * findValue * earningsBonus;
  const earnings = statValue(state, 'earnings');
  const incomePerSec = base * zoomieMult * treatMult.earnings * earnings;
  const rescueMult = statValue(state, 'rescueMult');
  const offlineHours = L_BASE_OFFLINE_HOURS + statValue(state, 'offlineHours');
  // Park Value (docs/10 §2.2): max zoomies, no treats, population term with rescue potential
  const digPerPup = (L_BASE_DIG_PER_MIN / L_SECONDS_PER_MIN) * layRate;
  const digRaw = state.pups * digPerPup;
  const shipFrac = digRaw > 0 ? Math.min(1, shipPerSec / digRaw) : 1;
  const emptySpace = Math.max(0, kennelCapacity - state.pups);
  const rescueRate = statValue(state, 'rescueRate');
  const rescuePerMinPerKennel = (L_BASE_RESCUE_PER_MIN + rescueRate) * rescueMult;
  const popTerm =
    state.pups * shipFrac +
    L_PV_UNSHIPPED_WEIGHT * state.pups * (1 - shipFrac) +
    Math.pow(emptySpace, L_PV_EMPTY_SPACE_EXP) +
    L_PV_RESCUE_FACTOR * rescuePerMinPerKennel * builtKennels * offlineHours * 60;
  const maxZoomieMult = 1 + maxZoomies * zoomieBonusPer;
  const parkValue =
    find.value * findValueMult * digPerPup * earningsBonus * maxZoomieMult * popTerm *
    L_PARK_VALUE_SECONDS * earnings;

  const adoptionCap = L_BASE_ADOPTION_CAP + statValue(state, 'adoptionCap');
  const adoptionRefill =
    (L_BASE_ADOPTION_REFILL + statValue(state, 'adoptionRefill')) * treatMult.adoption;
  const rescuePerSec =
    ((builtKennels * (L_BASE_RESCUE_PER_MIN + rescueRate)) / L_SECONDS_PER_MIN) *
    treatMult.adoption *
    rescueMult;

  const offlineCapSec = offlineHours * L_SECONDS_PER_HOUR;

  const mailCapacity = L_BASE_MAIL_CAPACITY + Math.floor(statValue(state, 'mailCapacity'));
  const squirrelHoundChance = clamp01(statValue(state, 'squirrelHound'));
  const autoWhistleFrac = clamp01(statValue(state, 'autoWhistle'));
  const automationUnlocked: Record<AutomationKey, boolean> = {
    find: true,
    build: statValue(state, 'autoBuild') >= 1,
    training: statValue(state, 'autoTraining') >= 1,
    whistle: autoWhistleFrac > 0,
    prestige: statValue(state, 'autoPrestige') >= 1,
  };

  const prestigeGain = prestigeGainFor(state.runEarnings);
  const pupRank = pupRankFor(earningsBonus);
  const maxCars = L_BASE_MAX_CARS + Math.floor(statValue(state, 'sledCars'));
  const nextIdx = state.highestFindIndex + 1;
  const discoveredFind =
    L_FINDS[nextIdx] && parkValue >= L_FINDS[nextIdx].unlockParkValue / L_DISCOVER_DIVISOR
      ? nextIdx
      : state.highestFindIndex;

  return {
    kennelCapacity,
    builtKennels,
    fleetSlots,
    shipPerSec,
    digPerPupPerSec,
    digPerSec,
    deliveredPerSec,
    bottleneck,
    findValue,
    earningsBonus,
    pawBonus,
    collarMult,
    maxZoomies,
    zoomieBonusPer,
    zoomieMult,
    treatMult,
    incomePerSec,
    parkValue,
    adoptionCap,
    adoptionRefill,
    rescuePerSec,
    offlineCapSec,
    mailCapacity,
    squirrelHoundChance,
    autoWhistleFrac,
    automationUnlocked,
    parkLevel: parkLevel(state.lifetimeEarnings),
    parkTitle: parkTitle(parkLevel(state.lifetimeEarnings)),
    vipTier: vipTierFor(state.premium.spendCents),
    modifier: currentModifier(state),
    totalTrainingLevels: totalTrainingLevels(state),
    prestigeGain,
    costScale: find.costScale,
    pupRank,
    pupRankTitle: pupRankTitleFor(pupRank),
    maxCars,
    discoveredFind,
  };
}
