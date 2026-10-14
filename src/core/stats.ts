import type { AutomationKey, DerivedStats, GameState, Stat, StatMode, TreatEffect, UpgradeDef } from './types';
import {
  ACADEMY,
  BASE_ADOPTION_CAP,
  BASE_ADOPTION_REFILL,
  BASE_COLLAR_BONUS,
  BASE_DIG_PER_MIN,
  BASE_FLEET_SLOTS,
  BASE_MAIL_CAPACITY,
  BASE_RESCUE_PER_MIN,
  BASE_MAX_ZOOMIES,
  BASE_OFFLINE_HOURS,
  BASE_SPIRIT_PAW_BONUS,
  BASE_ZOOMIE_BONUS,
  FINDS,
  KENNELS,
  MAX_FLEET_SLOTS,
  MIN_COST_MULTIPLIER,
  PARK_VALUE_SECONDS,
  PRESTIGE_DIVISOR,
  PRESTIGE_EXPONENT,
  SECONDS_PER_HOUR,
  SECONDS_PER_MIN,
  STAT_MODES,
  TRAINING,
  TREATS,
  VEHICLES,
} from '../data';

interface Source {
  def: UpgradeDef;
  kind: 'training' | 'academy';
}

const SOURCES: Record<string, Source[]> = {};
for (const def of TRAINING) (SOURCES[def.stat] ??= []).push({ def, kind: 'training' });
for (const def of ACADEMY) (SOURCES[def.stat] ??= []).push({ def, kind: 'academy' });

export function statMode(stat: Stat): StatMode {
  return STAT_MODES[stat];
}

/** M(stat) for mult stats (product of 1 + perLevel*level), A(stat) for add stats (sum). */
export function statValue(state: GameState, stat: Stat): number {
  const mode = STAT_MODES[stat];
  let acc = mode === 'mult' ? 1 : 0;
  for (const { def, kind } of SOURCES[stat] ?? []) {
    const level = (kind === 'training' ? state.training[def.id] : state.academy[def.id]) ?? 0;
    if (level <= 0) continue;
    if (mode === 'mult') acc *= 1 + def.perLevel * level;
    else acc += def.perLevel * level;
  }
  return acc;
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
    const def = TREATS.find((d) => d.id === t.id);
    if (def && t.remaining > 0) m[def.effect] *= def.multiplier;
  }
  return m;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function computeStats(state: GameState): DerivedStats {
  const treatMult = treatMultFor(state);

  let rawCapacity = 0;
  let builtKennels = 0;
  for (const tier of state.kennels) {
    if (tier === null || tier === undefined) continue;
    const def = KENNELS[tier];
    if (!def) continue;
    rawCapacity += def.capacity;
    builtKennels++;
  }
  const kennelCapacity = rawCapacity * statValue(state, 'kennelCapacity');

  const fleetSlots = Math.min(
    MAX_FLEET_SLOTS,
    BASE_FLEET_SLOTS + Math.floor(statValue(state, 'fleetSlots')),
  );
  let rawShip = 0;
  for (let i = 0; i < Math.min(fleetSlots, state.vehicles.length); i++) {
    const tier = state.vehicles[i];
    if (tier === null || tier === undefined) continue;
    const def = VEHICLES[tier];
    if (def) rawShip += def.capacityPerMin / SECONDS_PER_MIN;
  }
  const shipPerSec = rawShip * statValue(state, 'shippingCapacity');

  const digPerPupPerSec =
    (BASE_DIG_PER_MIN / SECONDS_PER_MIN) * statValue(state, 'layRate') * treatMult.layRate;
  const digPerSec = state.pups * digPerPupPerSec;
  const deliveredPerSec = Math.min(digPerSec, shipPerSec);
  const bottleneck: 'dig' | 'ship' = digPerSec <= shipPerSec ? 'dig' : 'ship';

  const find = FINDS[state.findIndex] ?? FINDS[0];
  const findValue = find.value * statValue(state, 'findValue');

  const pawBonus = BASE_SPIRIT_PAW_BONUS + statValue(state, 'spiritPawBonus');
  const collarMult = Math.pow(
    BASE_COLLAR_BONUS + statValue(state, 'collarBonus'),
    state.legendCollars,
  );
  const earningsBonus = 1 + state.spiritPaws * pawBonus * collarMult;

  const maxZoomies = BASE_MAX_ZOOMIES + statValue(state, 'maxZoomies');
  const zoomieBonusPer = BASE_ZOOMIE_BONUS + statValue(state, 'zoomieBonus');
  const zoomieMult = 1 + Math.floor(state.zoomies) * zoomieBonusPer;

  const base = deliveredPerSec * findValue * earningsBonus;
  const incomePerSec = base * zoomieMult * treatMult.earnings;
  const parkValue = base * PARK_VALUE_SECONDS;

  const adoptionCap = BASE_ADOPTION_CAP + statValue(state, 'adoptionCap');
  const adoptionRefill =
    (BASE_ADOPTION_REFILL + statValue(state, 'adoptionRefill')) * treatMult.adoption;
  const rescuePerSec =
    ((builtKennels * (BASE_RESCUE_PER_MIN + statValue(state, 'rescueRate'))) / SECONDS_PER_MIN) *
    treatMult.adoption;

  const offlineCapSec =
    (BASE_OFFLINE_HOURS + statValue(state, 'offlineHours')) * SECONDS_PER_HOUR;

  const mailCapacity = BASE_MAIL_CAPACITY + Math.floor(statValue(state, 'mailCapacity'));
  const squirrelHoundChance = clamp01(statValue(state, 'squirrelHound'));
  const autoWhistleFrac = clamp01(statValue(state, 'autoWhistle'));
  const automationUnlocked: Record<AutomationKey, boolean> = {
    find: true,
    build: statValue(state, 'autoBuild') >= 1,
    training: statValue(state, 'autoTraining') >= 1,
    whistle: autoWhistleFrac > 0,
    prestige: statValue(state, 'autoPrestige') >= 1,
  };

  const prestigeGain = Math.floor(
    Math.pow(Math.max(0, state.runEarnings) / PRESTIGE_DIVISOR, PRESTIGE_EXPONENT),
  );

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
    totalTrainingLevels: totalTrainingLevels(state),
    prestigeGain,
  };
}
