/* Paw Park balance bot v4 (docs/04 §5, docs/06 §10, docs/10 §5, docs/11 §5).
 * Run with `npm run balance [-- --profile afkdaily|afk|daily|active|minnow|whale|all --days N --seed N --verbose --fit --full]`.
 * Simulates REAL days (day 0 = Thu 2026-01-01 starts at 18:00 UTC). Between check-ins it calls applyOfflineProgress,
 * i.e. the real offline path (Treat Jar cap, chunking, automation). Uses ONLY the public barrel.
 * v5/v6 behaviour: sled cars (manual policy; automation buys them too), Dog Show (join at the first check-in of each
 * Monday, claim medals; Active also whistles in the show park), Paw Portal (build, 3 expeditions sized to the next
 * check-in, collect, craft 3 -> 1, equip the best 4 relics by estimated value, recycle surplus).
 * AFK+Daily runs on until the endgame (4 Planet Paws full + Academy maxed); the other profiles stop at the Cosmic Bone
 * unless --full is passed. */
process.env.TZ = 'UTC';
import {
  ACADEMY, AUTO_SPLURGE_FRACTION, CREWS, DIMENSIONS, EXPEDITION_LENGTHS, FINDS, KENNELS, PARK_LEVEL_THRESHOLDS, PARK_TITLES, PORTAL_BUILD_COST, PREMIUM_SHOP, PRODUCTS,
  RELIC_FAMILIES, TOP_VEHICLE_TIER, VIP_TIERS, adopt, HOLD_ADOPT_PER_SEC, KENNEL_SLOTS, TRAINING,
  academyCost, applyOfflineProgress, buildPortal, buyAcademy, buyKennel, buyPremium, buySledCar, buyStreakFreeze, buyTraining, buyTreat, buyVehicle,
  catchSquirrel, claimDailyDig, claimDailyDigBonus, claimDailyTreat, claimShowGoal, collectAll, computeStats, craftCost, craftRelic, craftableRelics,
  createInitialState, crewStars, crewUnlocked, equipRelic, grantPurchase, joinShow, launchExpedition, fuelCost,
  isTrainingTierUnlocked, kennelUpgradeCost, openAllMail, parkLevel, premiumCost, prestige, recycleRelic, refreshDaily, refreshShow, relicEffect, setAutomation,
  sledCarCost, statMode, statValue, tick, trainingCost, unequipRelic, vehicleUpgradeCost, SHOW_REWARDS, TROPHIES, STAR_CAPACITY_BONUS,
} from '../src/core/index';
import { BASE_OFFLINE_HOURS, BASE_RESCUE_PER_MIN, PV_EMPTY_SPACE_EXP, PV_RESCUE_FACTOR, PV_UNSHIPPED_WEIGHT } from '../src/data';
import { readFileSync, writeFileSync } from 'node:fs';
import type { AutomationKey, GameState, Relic, Rng, Stat } from '../src/core/index';

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
const VERBOSE = argv.includes('--verbose');
let MAX_DAYS = Number(flag('--days') ?? 200);
const PROFILE_ARG = flag('--profile') ?? 'all';
/** diagnostic ablations for the Whale: ABL="vip,shop:star_spirit,..." zeroes those perks */
const SEED = Number(flag('--seed') ?? 12345);
/** diagnostic: --hold k disables find gates beyond index k (shows how B(t) grows while parked on find k) */
const HOLD = Number(flag('--hold') ?? -1);
if (HOLD >= 0) for (let i = HOLD + 1; i < FINDS.length; i++) FINDS[i].unlockParkValue = Infinity;
/** diagnostic: --gates "4:1e13,5:Infinity" overrides unlockParkValue (used by the gate calibration loop); --json prints raw results */
for (const kv of (flag('--gates') ?? '').split(',').filter(Boolean)) {
  const [k, v] = kv.split(':');
  FINDS[Number(k)].unlockParkValue = Number(v);
}
/** diagnostic: --cs "1:8,2:64" overrides costScale per find index */
for (const kv of (flag('--cs') ?? '').split(',').filter(Boolean)) {
  const [k, v] = kv.split(':');
  FINDS[Number(k)].costScale = Number(v);
}
/** diagnostic: ABL="vip,star_spirit,..." zeroes the VIP earnings bonus / the named shop items' perLevel */
for (const id of (process.env.ABL ?? '').split(',').filter(Boolean)) {
  if (id === 'vip') for (const t of VIP_TIERS) t.earningsBonus = 0;
  else { const d = PREMIUM_SHOP.find((x) => x.id === id); if (d) d.perLevel = 0; }
}
const JSON_OUT = argv.includes('--json');
/** diagnostic: stop the profile once this find index is reached (default: the last find) */
let STOP_ARG = flag('--stop');
let STOP_AT = Number(STOP_ARG ?? FINDS.length - 1);
/** --calibrate: gate calibration hook (see the calibration block below): running max of Park Value while in era `era` */
let cal: { era: number; max: number; trace: [number, number, number, number][] } | null = null;
/** --full: every profile runs on to the endgame (4 full Planet Paws + Academy maxed); default only AFK+Daily does */
const FULL = argv.includes('--full');

const H = 3600;
const DAY = 86400;
const START_HOUR = 18; // day 0 starts at 18:00
/** sim t = 0 is Thu 2026-01-01 18:00 UTC (TZ is forced to UTC); the engine's wall clock (offline, expeditions, Dog Show) is epoch ms */
const EPOCH0 = Date.UTC(2026, 0, 1, 18, 0, 0);
const msOf = (t: number) => EPOCH0 + t * 1000;
const tOf = (ms: number) => (ms - EPOCH0) / 1000;
const OPENING_SEC = 1800;
const FULL_WHISTLE_SEC = 600;

function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- profiles
type StarPolicy = 'none' | 'cheapest' | 'whale';
interface ProfileDef {
  name: 'afkdaily' | 'afk' | 'daily' | 'active' | 'minnow' | 'whale';
  label: string;
  /** check-in hours (local) */
  checkins: number[];
  sessionSec: number;
  /** optional daily online window [startHour, endHour) */
  window?: [number, number];
  /** daily ritual (refreshDaily + treat + 30 s whistle + digs); false = never calls refreshDaily (no Park of the Day) */
  daily: boolean;
  stars: StarPolicy;
  /** real-money purchases: [dayIndex, productId] granted at that day's first check-in */
  purchases?: [number, string][];
  /** during the online window, every other minute's whistle goes to the Dog Show park while its goals are open */
  showPlay?: boolean;
}
const AFK_CHECKINS = [8, 12.5, 18, 22.5];
const PROFILES: ProfileDef[] = [
  { name: 'afkdaily', label: 'AFK+Daily (primary)', checkins: AFK_CHECKINS, sessionSec: 180, daily: true, stars: 'cheapest' },
  { name: 'afk', label: 'AFK (no dailies, info)', checkins: AFK_CHECKINS, sessionSec: 180, daily: false, stars: 'none' },
  { name: 'daily', label: 'Daily', checkins: [20], sessionSec: 300, daily: true, stars: 'cheapest' },
  { name: 'active', label: 'Active', checkins: [8, 12.5, 22.5], sessionSec: 180, window: [18, 22], daily: true, stars: 'cheapest', showPlay: true },
  { name: 'minnow', label: 'Minnow ($4.99)', checkins: AFK_CHECKINS, sessionSec: 180, daily: true, stars: 'cheapest', purchases: [[0, 'stars_m']] },
  { name: 'whale', label: 'Whale ($250.96)', checkins: AFK_CHECKINS, sessionSec: 180, daily: true, stars: 'whale',
    purchases: [[0, 'stars_max'], [0, 'stars_s'], [2, 'stars_max'], [4, 'stars_xxl']] },
];
const DAILY_WHISTLE_SEC = 30;
/** sim day index -> 'YYYY-MM-DD' (arbitrary fixed start date; the seeded Digs/modifiers depend on it) */
const dayKeyFor = (dayIdx: number) => new Date(Date.UTC(2026, 0, 1 + dayIdx)).toISOString().slice(0, 10);
const WHALE_ORDER = ['star_kibble', 'star_beds', 'star_spirit', 'star_hound', 'star_jar', 'star_mailbox'];

// ---------------------------------------------------------------- manual buy policy (mirrors automation §3.3)
const SHIP_STATS: readonly Stat[] = ['shippingCapacity'];
const KENNEL_STATS: readonly Stat[] = ['kennelCapacity'];
const GROWTH_STATS: readonly Stat[] = ['layRate', 'findValue', 'rescueRate', 'adoptionRefill', 'adoptionCap'];

interface Cand { cost: number; inBucket: boolean; buy: () => boolean }

function policyBuys(state: GameState, doBuild: boolean, doTrain: boolean): number {
  let buys = 0;
  while (buys < 50 && (doBuild || doTrain)) {
    const s = computeStats(state);
    let bucketStats: readonly Stat[];
    let kBucket = false;
    let vBucket = false;
    if (s.bottleneck === 'ship') { vBucket = true; bucketStats = SHIP_STATS; }
    else if (state.pups >= 0.9 * s.kennelCapacity) { kBucket = true; bucketStats = KENNEL_STATS; }
    else bucketStats = GROWTH_STATS;

    const cands: Cand[] = [];
    if (doBuild) {
      for (let i = 0; i < KENNEL_SLOTS; i++) {
        const c = kennelUpgradeCost(state, i);
        if (c !== null) cands.push({ cost: c, inBucket: kBucket, buy: () => buyKennel(state, i).ok });
      }
      for (let i = 0; i < s.fleetSlots; i++) {
        const c = vehicleUpgradeCost(state, i);
        if (c !== null) cands.push({ cost: c, inBucket: vBucket, buy: () => buyVehicle(state, i).ok });
        const sc = state.vehicles[i] === TOP_VEHICLE_TIER ? sledCarCost(state, i) : null;
        if (sc !== null) cands.push({ cost: sc, inBucket: vBucket, buy: () => buySledCar(state, i).ok });
      }
    }
    if (doTrain) {
      for (const def of TRAINING) {
        if (!isTrainingTierUnlocked(state, def.tier)) continue;
        const c = trainingCost(state, def.id);
        if (c === null) continue;
        cands.push({ cost: c, inBucket: bucketStats.includes(def.stat), buy: () => buyTraining(state, def.id, 1).ok });
      }
    }
    if (cands.length === 0) break;
    let cheapestBucket = Infinity;
    let cheapestAff: Cand | null = null;
    for (const c of cands) {
      if (c.inBucket && c.cost < cheapestBucket) cheapestBucket = c.cost;
      if (c.cost <= state.cash && (!cheapestAff || c.cost < cheapestAff.cost)) cheapestAff = c;
    }
    let pick: Cand | null = null;
    if (cheapestBucket !== Infinity) {
      if (cheapestBucket <= state.cash) pick = cands.find((c) => c.inBucket && c.cost === cheapestBucket) ?? null;
      else if (cheapestAff && cheapestAff.cost <= AUTO_SPLURGE_FRACTION * cheapestBucket) pick = cheapestAff;
    } else pick = cheapestAff;
    if (!pick || !pick.buy()) break;
    buys++;
  }
  return buys;
}

// ---------------------------------------------------------------- simulation of one profile
const fmtDays = (d: number | null) => (d === null ? 'n/a' : d < 1 / 24 ? `${(d * 1440).toFixed(1)} min` : d < 1 ? `${(d * 24).toFixed(1)} h (d${d.toFixed(2)})` : `day ${d.toFixed(1)}`);
const fmtMin = (d: number | null) => (d === null ? 'n/a' : `${(d * 1440).toFixed(1)} min`);
/** diagnostic: the Park Value popTerm components (docs/10 §2.2) of a state, for --verbose find events */
function pvBreakdown(state: GameState): string {
  const s = computeStats(state);
  const lay = statValue(state, 'layRate');
  const dig = state.pups * (6 / 60) * lay;
  const shipFrac = dig > 0 ? Math.min(1, s.shipPerSec / dig) : 1;
  const pupsT = state.pups * shipFrac + PV_UNSHIPPED_WEIGHT * state.pups * (1 - shipFrac);
  const empty = Math.pow(Math.max(0, s.kennelCapacity - state.pups), PV_EMPTY_SPACE_EXP);
  const rescue = PV_RESCUE_FACTOR * (BASE_RESCUE_PER_MIN + statValue(state, 'rescueRate')) * statValue(state, 'rescueMult') * s.builtKennels * (BASE_OFFLINE_HOURS + statValue(state, 'offlineHours')) * 60;
  const f = (x: number) => x.toExponential(1);
  return `pop[pups ${f(pupsT)} empty ${f(empty)} rescue ${f(rescue)}] cap ${f(s.kennelCapacity)} shipFrac ${shipFrac.toFixed(2)} PV ${f(s.parkValue)} inc ${f(s.incomePerSec)} B ${f(s.earningsBonus)} paws ${Math.round(state.spiritPaws)} collars ${state.legendCollars} pb ${s.pawBonus.toFixed(3)} cm ${s.collarMult.toFixed(1)}`;
}
/** adoption treats (Bacon Strip) also speed rescues; the fill time is quoted without them */
const treatAdoption = (s: { treatMult: { adoption: number } }) => s.treatMult.adoption;
const sig = (n: number) => (n >= 1e6 ? n.toExponential(2) : n >= 100 ? n.toFixed(0) : n.toFixed(1));

interface DayRow {
  day: number; lv: number; stars: number; streak: number; log10B: number; log10Income: number; paws: number; find: number; gb: number; prestiges: number; academy: number; cash10: number;
  bones: number; rank: number; collars: number; relicPV: number; relicProd: number; crew: number; relics: number;
}
interface WeekRec { weekKey: string; findIndex: number; medals: number; delivered: number; targets: number[] }
interface EraRebuild { find: number; len: number; rebuild: number }
interface Result {
  def: ProfileDef;
  findT: (number | null)[]; // days
  findLogB: (number | null)[]; // log10 earnings bonus when the find was first unlocked
  firstPrestigeT: number | null;
  endT: number; // days simulated
  drought: number; // days
  droughtAt: number;
  rows: DayRow[];
  lastAcademyT: number | null;
  academyLevels: number;
  academyT: Record<string, number>;
  levels: Record<string, number>;
  maxPups: number;
  maxLadders: number;
  academySpent: number;
  nextCheapest: number;
  academyGap: number;
  academyGapAt: number;
  academyBuys: number;
  finalPaws: number;
  finalGB: number;
  prestiges: number;
  secs: number;
  /** first sim day each Park Level was reached (index = level) */
  levelT: (number | null)[];
  /** (day, log10 lifetime earnings) samples */
  curve: [number, number][];
  starsFree: number;
  starsSpent: number;
  stars30: number | null;
  bestStreak: number;
  /** v4 era log: one record per prestige run (docs/08 section 6) */
  runs: RunRec[];
  /** Dog Show results, one per closed week */
  weeks: WeekRec[];
  rebuilds: EraRebuild[];
  /** endgame: first day all 4 kennels are Planet Paws, first day after that pups >= 98% of capacity, Academy fully maxed */
  tPP: number | null;
  tFull: number | null;
  tAcademyMax: number | null;
  /** analytic offline fill time (days) of an empty endgame park at the moment the 4 Planet Paws stood */
  fillAnalytic: number | null;
  endgameT: number | null;
  portal: { built: number | null; launched: number; skipped: number; collected: number; crafted: number; recycled: number; crewRuns: number[]; maxTier: number; goldenFromLoot: number; goldenFromRecycle: number };
  collarsBySource: { trophies: number; show: number; calendar: number };
}

/** One prestige run: entry[k] = day when the park entered Find k in this run (undefined = never reached). */
interface RunRec {
  startT: number;
  endT: number | null;
  /** earnings bonus (B) at the start of the run */
  bonus: number;
  prevBest: number;
  maxFind: number;
  entry: number[];
}

function academyTotal(state: GameState): number {
  let n = 0;
  for (const d of ACADEMY) n += state.academy[d.id] ?? 0;
  return n;
}

function simulate(def: ProfileDef): Result {
  const t0 = Date.now();
  const rng = seeded(SEED);
  Math.random = rng; // applyOfflineProgress uses Math.random: make it deterministic
  const state = createInitialState(msOf(0));
  state.lastSaved = msOf(0);
  for (const kv of (process.env.CHEAT_FOR && process.env.CHEAT_FOR !== def.name ? '' : process.env.CHEAT ?? '').split(',').filter(Boolean)) { const [a, b] = kv.split('='); state.academy[a] = Number(b); }

  const findT: (number | null)[] = FINDS.map(() => null);
  const findLogB: (number | null)[] = FINDS.map(() => null);
  findT[0] = 0;
  let firstPrestigeT: number | null = null;
  const eventsT: number[] = []; // seconds of milestone events
  const rows: DayRow[] = [];
  let lastHF = 0;
  let lastTrophies = 0;
  let lastPrestiges = 0;
  let lastAcademyT: number | null = null;
  const academyT: Record<string, number> = {};
  const academyTimes: number[] = [];
  let academySpent = 0;
  let maxPups = 0;
  let nextLogDay = 0;
  let academyBuys = 0;
  let done = false;
  const levelT: (number | null)[] = PARK_LEVEL_THRESHOLDS.map(() => null);
  levelT[0] = 0;
  let lastLv = 1;
  const curve: [number, number][] = [];
  let lastSample = -1e9;
  let starsSpent = 0;
  let starsBought = 0;
  let stars30: number | null = null;
  let lastClaimIdx = -1;
  const runs: RunRec[] = [{ startT: 0, endT: null, bonus: 1, prevBest: 0, maxFind: 0, entry: [0] }];
  let lastFindIdx = 0;

  // ---- era rebuild tracking (docs/10 §5): time for automation to regain the previous era's peak kennel tiers
  const rebuilds: EraRebuild[] = [];
  const kennelSum = () => state.kennels.reduce<number>((a, k) => a + (k === null || k === undefined ? 0 : k + 1), 0);
  const eraTrack = { find: 0, start: 0, target: 0, rebuiltAt: null as number | null, peak: 0, prestiges: 0 };
  const closeEra = (t: number) => {
    if (eraTrack.target > 0) rebuilds.push({ find: eraTrack.find, len: t - eraTrack.start, rebuild: (eraTrack.rebuiltAt ?? t) - eraTrack.start });
  };
  // ---- endgame tracking
  const academyMaxTotal = ACADEMY.reduce((a, d) => a + d.maxLevel, 0);
  let tPP: number | null = null;
  let tFull: number | null = null;
  let tAcademyMax: number | null = null;
  let fillAnalytic: number | null = null;
  /** day-110 snapshot: offline fill time of an EMPTY park of 4 Planet Paws under the stats of that day (does not need the 4 Planet Paws to be built) */
  let fillHyp: number | null = null;
  let endgameT: number | null = null;
  const stopRule = STOP_ARG !== null ? 'find' : def.name === 'afkdaily' || FULL ? 'endgame' : 'find';

  let lastPv = '';
  let lastPvT = 0;
  const observe = (t: number) => {
    // era rebuild
    if (state.prestigeCount > eraTrack.prestiges) {
      closeEra(t / DAY);
      eraTrack.prestiges = state.prestigeCount;
      Object.assign(eraTrack, { find: 0, start: t / DAY, target: 0, rebuiltAt: null, peak: 0 });
    } else if (state.findIndex > eraTrack.find) {
      closeEra(t / DAY);
      Object.assign(eraTrack, { find: state.findIndex, start: t / DAY, target: eraTrack.peak, rebuiltAt: null, peak: 0 });
    }
    const ks = kennelSum();
    if (ks > eraTrack.peak) eraTrack.peak = ks;
    if (eraTrack.target > 0 && eraTrack.rebuiltAt === null && ks >= eraTrack.target) eraTrack.rebuiltAt = t / DAY;
    // endgame: 4 Planet Paws, rescue fill, Academy maxed
    if (tPP === null && state.kennels.every((k) => k === KENNELS.length - 1)) {
      tPP = t / DAY;
      const s = computeStats(state);
      const rate = s.rescuePerSec * statValue(state, 'offlineRescueMult');
      fillAnalytic = rate > 0 ? s.kennelCapacity / (rate / treatAdoption(s)) / DAY : Infinity;
      if (VERBOSE) console.log(`  [day ${(t / DAY).toFixed(1)}] 4 Planet Paws: cap ${s.kennelCapacity.toExponential(2)} pups ${state.pups.toExponential(2)} rescue/min/kennel base ${BASE_RESCUE_PER_MIN + statValue(state, 'rescueRate')} x mult ${statValue(state, 'rescueMult').toFixed(1)} x calm ${statValue(state, 'offlineRescueMult').toFixed(2)} => ${rate.toExponential(2)}/s, kennelMult ${statValue(state, 'kennelCapacity').toFixed(1)}`);
    }
    if (fillHyp === null && (t / DAY >= 110 || endgameT !== null)) {
      const s = computeStats(state);
      const cap = 4 * KENNELS[KENNELS.length - 1].capacity * statValue(state, 'kennelCapacity');
      const rate = (4 * (BASE_RESCUE_PER_MIN + statValue(state, 'rescueRate')) * statValue(state, 'rescueMult') * statValue(state, 'offlineRescueMult')) / 60;
      fillHyp = cap / rate / DAY;
      if (VERBOSE) console.log(`  [day ${(t / DAY).toFixed(1)}] hypothetical 4 Planet Paws: cap ${cap.toExponential(2)}, rescue/min/kennel ${(BASE_RESCUE_PER_MIN + statValue(state, 'rescueRate')).toFixed(0)} x ${statValue(state, 'rescueMult').toFixed(1)} x calm ${statValue(state, 'offlineRescueMult').toFixed(2)} => fill ${fillHyp.toFixed(2)} d (kennelMult ${statValue(state, 'kennelCapacity').toFixed(0)}, income ${s.incomePerSec.toExponential(1)})`);
    }
    if (tPP !== null && tFull === null && state.kennels.every((k) => k === KENNELS.length - 1) && state.pups >= 0.98 * computeStats(state).kennelCapacity) tFull = t / DAY;
    if (tAcademyMax === null && academyTotal(state) >= academyMaxTotal) tAcademyMax = t / DAY;
    if (endgameT === null && tPP !== null && tAcademyMax !== null && state.highestFindIndex >= FINDS.length - 1) endgameT = Math.max(tPP, tAcademyMax);

    // era log: prestige first (it resets findIndex), then era entries of the (new) run
    if (state.prestigeCount > runs.length - 1) {
      const cur = runs[runs.length - 1];
      cur.endT = t / DAY;
      runs.push({ startT: t / DAY, endT: null, bonus: computeStats(state).earningsBonus, prevBest: Math.max(cur.maxFind, cur.prevBest), maxFind: 0, entry: [t / DAY] });
      lastFindIdx = 0;
    }
    if (state.findIndex > lastFindIdx) {
      const cur = runs[runs.length - 1];
      for (let k = lastFindIdx + 1; k <= state.findIndex; k++) cur.entry[k] = t / DAY;
      if (state.findIndex > cur.maxFind) cur.maxFind = state.findIndex;
      lastFindIdx = state.findIndex;
    }
    if (state.highestFindIndex > lastHF) {
      for (let k = lastHF + 1; k <= state.highestFindIndex; k++) { findT[k] = t / DAY; findLogB[k] = Math.log10(computeStats(state).earningsBonus); }
      lastHF = state.highestFindIndex;
      eventsT.push(t);
      if (VERBOSE) console.log(`  [${fmtDays(t / DAY)}] FIND -> ${FINDS[lastHF].name}  pre-upgrade ${lastPv}`);
    }
    if (cal && state.findIndex === cal.era) {
      const cs = computeStats(state);
      if (cs.parkValue > cal.max) { cal.max = cs.parkValue; cal.trace.push([t / DAY, cs.parkValue, cs.earningsBonus, cs.incomePerSec]); }
    }
    if (VERBOSE && t - lastPvT >= 55) { lastPv = pvBreakdown(state); lastPvT = t; }
    if (state.trophies.length > lastTrophies) { lastTrophies = state.trophies.length; eventsT.push(t); }
    if (state.prestigeCount > lastPrestiges) {
      lastPrestiges = state.prestigeCount;
      eventsT.push(t);
      if (firstPrestigeT === null) firstPrestigeT = t / DAY;
    }
    if (stopRule === 'find' ? state.highestFindIndex >= STOP_AT : endgameT !== null) done = true;
    const lv = parkLevel(state.lifetimeEarnings);
    if (lv > lastLv) { for (let k = lastLv + 1; k <= lv; k++) levelT[k - 1] = t / DAY; lastLv = lv; }
    if (t - lastSample >= 30) { lastSample = t; curve.push([t / DAY, Math.log10(Math.max(state.lifetimeEarnings, 1))]); }
  };

  const logRow = (t: number) => {
    const day = t / DAY;
    if (day < nextLogDay) return;
    nextLogDay = Math.floor(day) + 1;
    const s = computeStats(state);
    if (stars30 === null && day >= 30) stars30 = state.premium.stars + starsSpent - starsBought;
    const rp = relicPower();
    if (process.env.DEBUGREL && state.portal && Math.floor(day) % 7 === 0) {
      console.log(`  d${Math.floor(day)} equipped: ` + state.portal.equipped.map((id) => { const r = state.portal!.relics.find((x) => x.id === id); return r ? `${r.family}:T${r.tier + 1}${'CREL'[r.rarity]}:+${(relicEffect(r) * 100).toFixed(0)}%` : '-'; }).join('  ') + `  pb ${s.pawBonus.toFixed(3)}`);
    }
    rows.push({
      day: Math.floor(day), lv: parkLevel(state.lifetimeEarnings), stars: state.premium.stars + starsSpent - starsBought, streak: state.daily.streak, log10B: Math.log10(s.earningsBonus), log10Income: Math.log10(Math.max(s.incomePerSec, 1e-9)), paws: state.spiritPaws,
      find: state.highestFindIndex, gb: state.goldenBones, prestiges: state.prestigeCount,
      academy: academyTotal(state), cash10: 0,
      bones: academySpent + state.goldenBones, rank: s.pupRank, collars: state.legendCollars, relicPV: rp.pv, relicProd: rp.prod,
      crew: state.portal ? CREWS.filter((c) => crewUnlocked(state, c.id)).length : 0, relics: state.portal ? state.portal.relics.length : 0,
    });
  };

  /** Academy purchases at a check-in. Priority list; if the top wanted item is unaffordable the bot saves. */
  const academyPhase = (t: number, longestGapSec: number) => {
    const bought = (id: string, cost: number) => {
      academySpent += cost;
      if (academyT[id] === undefined) academyT[id] = t / DAY;
      academyBuys++;
      academyTimes.push(t);
      lastAcademyT = t;
      eventsT.push(t);
    };
    for (let guard = 0; guard < 500; guard++) {
      const jarWanted = computeStats(state).offlineCapSec < longestGapSec;
      const prio: string[] = ['foreman_pup', 'head_trainer'];
      if (jarWanted) prio.push('bigger_jar');
      prio.push('volunteer_walkers', 'retirement_planner');
      let target: string | null = null;
      for (const id of prio) if (academyCost(state, id) !== null) { target = id; break; }
      if (target === null) {
        // cheapest remaining
        let best = Infinity;
        for (const d of ACADEMY) {
          const c = academyCost(state, d.id);
          if (c !== null && c < best) { best = c; target = d.id; }
        }
      }
      if (target === null) return;
      const cost = academyCost(state, target) ?? 0;
      if (!buyAcademy(state, target).ok) return; // saving
      bought(target, cost);
    }
  };

  const buyStarItem = (id: string): boolean => {
    const c = premiumCost(state, id);
    if (c === null || !buyPremium(state, id).ok) return false;
    starsSpent += c;
    return true;
  };
  /** spend Pup Stars per the profile's policy (docs/06 §10) */
  const spendStars = () => {
    if (def.stars === 'none') return;
    for (let guard = 0; guard < 200; guard++) {
      if (def.stars === 'whale') {
        let bought = false;
        for (const id of WHALE_ORDER) if (buyStarItem(id)) { bought = true; break; }
        if (!bought) break;
      } else {
        const tier = computeStats(state).vipTier;
        let best: string | null = null;
        let bestC = Infinity;
        for (const d of PREMIUM_SHOP) {
          const c = premiumCost(state, d.id);
          if (c !== null && d.requiredTier <= tier && c < bestC) { bestC = c; best = d.id; }
        }
        if (best === null || state.premium.stars < bestC || !buyStarItem(best)) break;
      }
    }
    if (def.stars === 'whale') while (state.daily.streakFreezes < 2 && WHALE_ORDER.every((id) => premiumCost(state, id) === null) && buyStreakFreeze(state).ok) starsSpent += 60;
  };
  const claimDigs = () => {
    const d = state.daily;
    d.digs.forEach((_, i) => claimDailyDig(state, i));
    if (process.env.DIGLOG && VERBOSE) console.log(`  dig d${d.digsDay} ${d.digs.map((x) => `${x.kind}${x.claimed ? '+' : '-'}`).join(' ')} mod ${d.modifierId}`);
    claimDailyDigBonus(state);
  };
  const dayIdxOf = (t: number) => Math.floor((t + START_HOUR * H) / DAY);
  let purchasesDone = 0;

  // ================================================================ v5/v6 behaviour (Dog Show, Paw Portal)
  const baseOfDay = (d: number) => d * DAY - START_HOUR * H;
  /** all check-in starts of calendar day d (the Active window end counts as a check-in too) */
  const startsOfDay = (d: number): number[] => {
    const out = def.checkins.map((h) => baseOfDay(d) + h * H);
    if (def.window) out.push(baseOfDay(d) + def.window[0] * H, baseOfDay(d) + def.window[1] * H);
    return out.sort((a, b) => a - b);
  };
  const nextCheckinAfter = (t: number): number => {
    const d0 = dayIdxOf(t);
    for (let d = d0 - 1; d <= d0 + 3; d++) for (const x of startsOfDay(d)) if (x > t + 120) return x;
    return t + 12 * H;
  };
  const firstCheckinAtOrAfter = (x: number, from: number): number => {
    let c = nextCheckinAfter(from);
    for (let g = 0; g < 400 && c < x - 60; g++) c = nextCheckinAfter(c);
    return c;
  };

  // ---- Dog Show
  const weeks: WeekRec[] = [];
  let showSnap: Omit<WeekRec, 'medals'> | null = null;
  const showPhase = (t: number) => {
    const now = msOf(t);
    if (state.show) {
      showSnap = { weekKey: state.show.weekKey, findIndex: state.show.findIndex, delivered: state.show.park.stats.findsDelivered, targets: state.show.goals.map((g) => g.target) };
    }
    for (const e of refreshShow(state, now)) {
      if (e.type === 'showEnded') weeks.push({ weekKey: e.weekKey, findIndex: showSnap?.findIndex ?? 0, medals: e.medals, delivered: showSnap?.delivered ?? 0, targets: showSnap?.targets ?? [] });
    }
    if (!state.show && new Date(now).getUTCDay() === 1) joinShow(state, now); // first check-in of a Monday
    if (state.show) for (let i = 0; i < state.show.goals.length; i++) claimShowGoal(state, i);
  };

  // ---- Paw Portal
  const P = { built: null as number | null, launched: 0, skipped: 0, collected: 0, crafted: 0, recycled: 0, goldenFromLoot: 0, goldenFromRecycle: 0 };
  let dimCounter = 0;
  const FAMILY_IMPORTANCE: Record<string, number> = {
    bacon_prism: 1, squeaky_orb: 1, bark_tablet: 1, wormhole_leash: 0.7, kennel_key: 0.5, rescue_beacon: 0.6, golden_bowl: 0.4, cosmic_frisbee: 0.3, timefold_collar: 0.2, lucky_acorn: 0.1,
  };

  /** estimated value of equipping relic r (log-scale): income + gate (Park Value) change, plus proxies for stats that act later */
  const scoreRelic = (r: Relic, base: ReturnType<typeof computeStats>): number => {
    equipRelic(state, r.id, 0);
    const s = computeStats(state);
    unequipRelic(state, 0);
    const e = relicEffect(r);
    const stat = RELIC_FAMILIES.find((f) => f.id === r.family)?.stat;
    let score = Math.log(Math.max(s.incomePerSec, 1e-9) / Math.max(base.incomePerSec, 1e-9)) + 0.7 * Math.log(Math.max(s.parkValue, 1e-9) / Math.max(base.parkValue, 1e-9));
    if (stat === 'rescueMult') score += (state.pups < 0.95 * base.kennelCapacity ? 0.6 : 0.15) * Math.log(1 + e);
    else if (stat === 'kennelCapacity') score += (state.pups >= 0.9 * base.kennelCapacity ? 0.5 : 0.25) * Math.log(1 + e);
    else if (stat === 'offlineHours') score += base.offlineCapSec < longestGapSec ? 0.5 * Math.log((base.offlineCapSec + e * 3600) / base.offlineCapSec) : 0;
    else if (stat === 'researchDiscount') score += 0.3 * -Math.log(1 - e);
    else if (stat === 'squirrelRate') score += 0.05 * Math.log(1 + e);
    return score;
  };
  const equipBest = () => {
    const p = state.portal;
    if (!p) return;
    for (let i = 0; i < p.equipped.length; i++) if (p.equipped[i] !== null) unequipRelic(state, i);
    const best = new Map<string, Relic>();
    for (const r of p.relics) {
      const c = best.get(r.family);
      if (!c || relicEffect(r) > relicEffect(c)) best.set(r.family, r);
    }
    if (best.size === 0) return;
    const base = computeStats(state);
    const scored = [...best.values()].map((r) => ({ r, v: scoreRelic(r, base) })).sort((a, b) => b.v - a.v);
    let slot = 0;
    for (const x of scored) {
      if (slot >= p.equipped.length || x.v <= 1e-9) break;
      equipRelic(state, x.r.id, slot++);
    }
  };
  const craftAll = () => {
    const p = state.portal;
    if (!p) return;
    for (let guard = 0; guard < 100; guard++) {
      let did = false;
      for (const f of RELIC_FAMILIES) {
        for (let tier = 0; tier < 3; tier++) {
          if (craftableRelics(state, f.id, tier).length >= 3 && state.cash >= craftCost(state, tier) && craftRelic(state, f.id, tier).ok) { P.crafted++; did = true; }
        }
      }
      if (!did) break;
    }
  };
  const recycleSurplus = () => {
    const p = state.portal;
    if (!p) return;
    // keep the best relic of every family; recycle dominated top-tier relics and fodder beyond 9 per family/tier
    const bestId = new Map<string, number>();
    for (const r of p.relics) {
      const c = bestId.get(r.family);
      const cr = c === undefined ? undefined : p.relics.find((x) => x.id === c);
      if (!cr || relicEffect(r) > relicEffect(cr)) bestId.set(r.family, r.id);
    }
    const groups = new Map<string, Relic[]>();
    for (const r of p.relics) {
      if (p.equipped.includes(r.id) || bestId.get(r.family) === r.id) continue;
      const k = `${r.family}|${r.tier}`;
      const g = groups.get(k);
      if (g) g.push(r); else groups.set(k, [r]);
    }
    for (const g of groups.values()) {
      g.sort((a, b) => a.rarity - b.rarity || a.id - b.id);
      const topTier = g[0].tier === 3;
      const surplus = topTier ? g.length : Math.max(0, g.length - 9);
      for (let i = 0; i < surplus; i++) {
        const r = recycleRelic(state, g[i].id);
        if (r.ok) { P.recycled++; P.goldenFromRecycle += r.goldenBones ?? 0; }
      }
    }
  };
  type Plan = { ci: number; li: number; score: number };
  const choosePlan = (t: number, slotFuelPaid: number): Plan | null => {
    let best: Plan | null = null;
    for (let ci = 0; ci < CREWS.length; ci++) {
      const crew = CREWS[ci];
      if (!crewUnlocked(state, crew.id)) continue;
      const stars = crewStars(state, crew.id);
      EXPEDITION_LENGTHS.forEach((len, li) => {
        if (state.cash < fuelCost(state, len) + slotFuelPaid) { return; }
        const wait = firstCheckinAtOrAfter(t + crew.durationsSec[len], t) - t;
        const count = crew.capacity[len] * (1 + STAR_CAPACITY_BONUS * stars);
        const q = Math.exp((0.9 * (ci + li) * 3) / (CREWS.length + 1));
        const score = (count * q) / wait;
        if (!best || score > best.score) best = { ci, li, score };
      });
    }
    return best;
  };
  const pickDimension = (ci: number): string => {
    const avail = DIMENSIONS.filter((d) => ci >= d.minCrew);
    const scored = avail.map((d) => {
      let sc = 0;
      let tot = 0;
      for (const f of RELIC_FAMILIES) {
        const w = d.familyWeights[f.id] ?? 0.25;
        tot += w;
        sc += w * (FAMILY_IMPORTANCE[f.id] ?? 0.2);
      }
      return { id: d.id, v: sc / tot };
    }).sort((a, b) => b.v - a.v);
    const top = scored.slice(0, Math.min(3, scored.length));
    return top[dimCounter++ % top.length].id;
  };
  const portalPhase = (t: number, launch = true) => {
    const p = state.portal;
    if (!p) return;
    const now = msOf(t);
    if (!p.built) {
      if (state.cash >= PORTAL_BUILD_COST && buildPortal(state).ok) P.built = t / DAY;
      if (!p.built) return;
    }
    const c = collectAll(state, now);
    if (c.ok) { P.collected += c.collected; P.goldenFromLoot += c.goldenBones ?? 0; }
    craftAll();
    recycleSurplus();
    equipBest();
    if (!launch) return;
    for (let slot = 0; slot < p.slots.length; slot++) {
      if (p.slots[slot]) continue;
      const plan = choosePlan(t, 0);
      if (!plan) { P.skipped++; continue; }
      const crew = CREWS[plan.ci];
      const r = launchExpedition(state, slot, crew.id, pickDimension(plan.ci), EXPEDITION_LENGTHS[plan.li], now, 'cash');
      if (r.ok) P.launched++; else P.skipped++;
    }
  };
  const relicPower = (): { pv: number; prod: number } => {
    const p = state.portal;
    if (!p || p.equipped.every((x) => x === null)) return { pv: 1, prod: 1 };
    const eq = [...p.equipped];
    const withS = computeStats(state);
    p.equipped = p.equipped.map(() => null);
    const without = computeStats(state);
    p.equipped = eq;
    let prod = 1;
    for (const id of eq) {
      const r = p.relics.find((x) => x.id === id);
      const f = r && RELIC_FAMILIES.find((x) => x.id === r.family);
      if (r && f && statMode(f.stat) === 'mult') prod *= 1 + relicEffect(r);
    }
    // Park Value ratio without the max-zoomies factor (zoomies never earn anything while away): the earnings-equivalent of the equipped relics
    const zoom = (1 + withS.maxZoomies * withS.zoomieBonusPer) / (1 + without.maxZoomies * without.zoomieBonusPer);
    return { pv: withS.parkValue / Math.max(without.parkValue, 1e-300) / zoom, prod };
  };

  const keys: AutomationKey[] = ['find', 'build', 'training', 'whistle', 'prestige'];
  const longestGapSec = (def.name === 'daily' ? 24 : 9.5) * H;

  /**
   * applyOfflineProgress in 60 s sub-steps (the engine's own chunk size) so era / prestige moments are observed with
   * ~1 min resolution. Same Treat Jar cap and 5 s minimum as one big call.
   */
  const advanceTo = (t: number) => {
    let u = tOf(state.lastSaved);
    if (t - u < 5) return;
    const cap = computeStats(state).offlineCapSec;
    if (t - u > cap) u = t - cap;
    state.lastSaved = msOf(u);
    while (t - u > 1e-6 && !done) {
      let step = Math.min(60, t - u);
      if (t - (u + step) < 5) step = t - u;
      applyOfflineProgress(state, msOf(u + step));
      u += step;
      observe(u);
    }
    state.lastSaved = msOf(t);
  };

  /** returns true when this is the first check-in of the local day (daily ritual start) */
  const checkin = (t: number): boolean => {
    if (state.lastSaved < msOf(t)) advanceTo(t);
    const dayIdx = dayIdxOf(t);
    let firstOfDay = false;
    if (def.daily) {
      const dk = dayKeyFor(dayIdx);
      refreshDaily(state, dk);
      if (dayIdx > lastClaimIdx) {
        lastClaimIdx = dayIdx;
        firstOfDay = true;
        claimDailyTreat(state, dk);
        for (const [pd, pid] of def.purchases ?? []) {
          if (pd === dayIdx) {
            const prod = grantPurchase(state, pid, `r-${def.name}-${purchasesDone++}`);
            if (prod.ok) starsBought += PRODUCTS.find((x) => x.id === pid)?.stars ?? 0;
          }
        }
      }
      if (def.stars === 'whale' && !process.env.NOBACON && ((t + START_HOUR * H) % DAY) / H >= 17) {
        // evening: Bacon Strip with stars if affordable, else bones
        if (!buyTreat(state, 'bacon_strip', 'stars').ok) buyTreat(state, 'bacon_strip', 'bones');
        else starsSpent += 60;
      }
    }
    openAllMail(state, rng);
    showPhase(t);
    portalPhase(t);
    academyPhase(t, longestGapSec);
    const s = computeStats(state);
    for (const k of keys) if (s.automationUnlocked[k] && !state.automation[k]) setAutomation(state, k, true);
    observe(t);
    logRow(t);
    return firstOfDay;
  };

  const session = (start: number, len: number, active: boolean) => {
    const firstOfDay = checkin(start);
    if (done) return;
    const dt = active && start > 0 ? 2 : 1;
    const end = start + len;
    for (let t = start; t < end; t += dt) {
      const rel = t - start;
      const first10 = start === 0 && rel < FULL_WHISTLE_SEC;
      const dailyWhistle = firstOfDay && rel < DAILY_WHISTLE_SEC;
      const activeWhistle = active && start >= 0 && (t % 60) < 10 && !(start === 0 && rel < FULL_WHISTLE_SEC);
      if (activeWhistle && def.showPlay && state.show && state.show.park.stats.findsDelivered < state.show.goals[state.show.goals.length - 1].target) {
        adopt(state.show.park, HOLD_ADOPT_PER_SEC * dt, true); // Active plays the Dog Show park every other minute while a goal is open
      } else if (first10 || activeWhistle || dailyWhistle) adopt(state, HOLD_ADOPT_PER_SEC * dt, true);
      if (active) for (const q of [...state.squirrels]) catchSquirrel(state, q.id);
      tick(state, dt, rng);
      const s = computeStats(state);
      const u = s.automationUnlocked;
      if (Math.floor(t) % 2 === 0) {
        if (!(u.build && state.automation.build) || !(u.training && state.automation.training)) {
          policyBuys(state, !(u.build && state.automation.build), !(u.training && state.automation.training));
        }
        if (!u.prestige && state.runTimeSec >= 600 && s.prestigeGain >= Math.max(1, 0.5 * state.spiritPaws)) prestige(state);
      }
      if (VERBOSE && start === 0 && t % 300 === 0 && t <= 3600) {
        console.log(`  [t+${t / 60}m] pups ${state.pups.toFixed(0)}/${s.kennelCapacity.toFixed(0)} cash ${sig(state.cash)} inc ${sig(s.incomePerSec)}/s dig ${sig(s.digPerSec)} ship ${sig(s.shipPerSec)} PV ${sig(s.parkValue)} k=${state.kennels.join(',')} v=${state.vehicles.filter((x) => x !== null).join(',')} lv=${Object.values(state.training).reduce((a, b) => a + b, 0)}`);
      }
      if (state.pups > maxPups) maxPups = state.pups;
      observe(t + dt);
      if (done) { state.lastSaved = msOf(t + dt); return; }
    }
    if (def.daily) {
      claimDigs();
      spendStars();
      academyPhase(end, longestGapSec);
    }
    if (len >= H) { showPhase(end); portalPhase(end); }
    state.lastSaved = msOf(end);
  };

  // sessions in chronological order
  const baseOf = (d: number) => d * DAY - START_HOUR * H; // t of 00:00 of calendar day d (day 0 may be < 0)
  let endT = 0;
  const openLen = def.window ? (def.window[1] - def.window[0]) * H : OPENING_SEC;
  session(0, openLen, !!def.window);
  endT = openLen;
  for (let d = 0; d <= MAX_DAYS + 1 && !done; d++) {
    const list: { t: number; len: number; active: boolean }[] = [];
    for (const h of def.checkins) list.push({ t: baseOf(d) + h * H, len: def.sessionSec, active: false });
    if (def.window) list.push({ t: baseOf(d) + def.window[0] * H, len: (def.window[1] - def.window[0]) * H, active: true });
    list.sort((a, b) => a.t - b.t);
    for (const x of list) {
      if (x.t < endT || x.t >= MAX_DAYS * DAY) continue;
      session(x.t, x.len, x.active);
      endT = Math.max(endT, x.t + x.len);
      if (done) break;
    }
    if ((d + 1) * DAY - START_HOUR * H > MAX_DAYS * DAY) break;
  }
  const finalT = Math.min(endT, MAX_DAYS * DAY);
  // droughts (up to reaching the end)
  eventsT.sort((a, b) => a - b);
  let drought = 0;
  let droughtAt = 0;
  let prev = 0;
  for (const e of [...eventsT, finalT]) {
    if (e - prev > drought) { drought = e - prev; droughtAt = prev; }
    prev = e;
  }
  // longest stretch without an Academy purchase once the Planner is owned (bones must not pile up unspent)
  const gapFrom = (academyT['retirement_planner'] ?? 0) * DAY;
  const times = academyTimes.filter((x) => x >= gapFrom);
  let academyGap = 0;
  let academyGapAt = 0;
  let pv = gapFrom;
  for (const x of [...times, finalT]) {
    if (x - pv > academyGap) { academyGap = x - pv; academyGapAt = pv; }
    pv = x;
  }
  let maxLadders = 0;
  for (const d of ACADEMY) if ((state.academy[d.id] ?? 0) >= d.maxLevel) maxLadders++;
  return {
    def, findT, findLogB, firstPrestigeT, endT: finalT / DAY, drought: drought / DAY, droughtAt: droughtAt / DAY, rows,
    lastAcademyT: lastAcademyT === null ? null : lastAcademyT / DAY, academyT, levels: { ...state.academy }, maxPups, academyLevels: academyTotal(state), maxLadders, academySpent, nextCheapest: ACADEMY.reduce((m, d) => Math.min(m, academyCost(state, d.id) ?? Infinity), Infinity), academyGap: academyGap / DAY, academyGapAt: academyGapAt / DAY,
    academyBuys: academyBuys, finalPaws: state.spiritPaws, finalGB: state.goldenBones, prestiges: state.prestigeCount,
    secs: (Date.now() - t0) / 1000,
    levelT, curve, starsFree: state.premium.stars + starsSpent - starsBought, starsSpent, stars30, bestStreak: state.daily.bestStreak,
    runs, weeks, rebuilds, tPP, tFull, tAcademyMax, fillAnalytic: fillHyp ?? fillAnalytic, endgameT: endgameT,
    portal: {
      ...P, built: P.built, crewRuns: CREWS.map((c) => state.portal?.crews[c.id]?.runs ?? 0),
      maxTier: Math.max(0, ...(state.portal?.relics.map((r) => r.tier + 1) ?? [0])),
    },
    collarsBySource: (() => {
      const trophies = state.trophies.reduce((a, id) => a + (TROPHIES.find((x) => x.id === id)?.collars ?? 0), 0);
      const show = weeks.filter((w) => w.medals >= 3).length * SHOW_REWARDS[2].collars;
      return { trophies, show, calendar: state.legendCollars - trophies - show };
    })(),
  };
}

// ---------------------------------------------------------------- reporting
interface Target { name: string; idx: number; lo: number; hi: number } // days
const TARGETS: Target[] = [
  // docs/10 §2.3 timeline; the window is roughly the centre +-20% (+-7% for the Cosmic Bone)
  { name: 'Tennis Ball (~10 min)', idx: 1, lo: 0, hi: 12 / 1440 },
  { name: 'Squeaky Toy (~30 min)', idx: 2, lo: 15 / 1440, hi: 45 / 1440 },
  { name: 'Rawhide (~2 h)', idx: 3, lo: 1 / 24, hi: 3.5 / 24 },
  { name: 'Lost Wallet (end day 1)', idx: 4, lo: 0.7, hi: 1.5 },
  { name: 'Pirate Coin (day 2-3)', idx: 5, lo: 2, hi: 3.2 },
  { name: 'Dino Fossil (day 5)', idx: 6, lo: 4, hi: 6.2 },
  { name: 'Crystal Bone (day 9)', idx: 7, lo: 7.5, hi: 10.8 },
  { name: 'Meteorite (day 15)', idx: 8, lo: 12, hi: 18 },
  { name: 'Ancient Relic (day 24)', idx: 9, lo: 20, hi: 28.5 },
  { name: 'Moon Rock (day 36)', idx: 10, lo: 31, hi: 42 },
  { name: 'Time Bone (day 52)', idx: 11, lo: 45, hi: 59 },
  { name: 'Cosmic Bone (day 75)', idx: 12, lo: 70, hi: 80 },
];
const inR = (v: number | null, lo: number, hi: number) => v !== null && v >= lo && v <= hi;
const tgtStr = (t: Target) => (t.hi < 1 / 24 + 1e-9 ? `${(t.lo * 1440).toFixed(0)}-${(t.hi * 1440).toFixed(0)} min` : t.hi < 1 ? `${(t.lo * 24).toFixed(1)}-${(t.hi * 24).toFixed(1)} h` : `day ${t.lo.toFixed(1)}-${t.hi.toFixed(1)}`);

let allPass = true;
const results: Record<string, Result> = {};
const selected = PROFILES.filter((p) => PROFILE_ARG === 'all' || PROFILE_ARG === p.name);
if (selected.length === 0) { console.error(`unknown profile ${PROFILE_ARG}`); process.exit(2); }
// every comparison is against AFK+Daily (primary), so always simulate it
const toSimulate = selected.some((p) => p.name === 'afkdaily') ? selected : [PROFILES[0], ...selected];

// ---------------------------------------------------------------- gate calibration (--calibrate)
/** target day on which AFK+Daily should unlock Find k (docs/10 §2.3) */
const CAL_TARGET_DAYS: number[] = [0, 10 / 1440, 30 / 1440, 2 / 24, 1, 2.5, 5, 9, 15, 24, 36, 52, 75];
if (argv.includes('--calibrate')) {
  const from = Number(flag('--cal-from') ?? 1);
  const to = Number(flag('--cal-to') ?? FINDS.length - 1);
  const targetScale = Number(flag('--cal-scale') ?? 1);
  STOP_ARG = '999';
  STOP_AT = 999;
  const out: string[] = [];
  for (let k = from; k <= to; k++) {
    for (let j = k; j < FINDS.length; j++) FINDS[j].unlockParkValue = Infinity;
    const T = CAL_TARGET_DAYS[k] * targetScale;
    MAX_DAYS = Math.ceil(T * 1.35 + 0.5);
    cal = { era: k - 1, max: 0, trace: [] };
    const r = simulate(PROFILES[0]);
    // the gate that first opens closest to the target day: a record-setting Park Value in era k-1
    let pick = cal.trace[cal.trace.length - 1];
    let bestErr = Infinity;
    for (const x of cal.trace) {
      const err = Math.abs(Math.log((x[0] + 1e-4) / (T + 1e-4)));
      if (err < bestErr) { bestErr = err; pick = x; }
    }
    if (argv.includes('--cal-trace')) console.log('  trace (day: PV, B): ' + cal.trace.map((x) => `${x[0].toFixed(3)}: ${x[1].toExponential(2)} B${x[2].toFixed(1)}`).join(' | '));
    if (!pick) { console.log(`k=${k}: no Park Value samples (era ${k - 1} never reached)`); break; }
    const gate = Number((pick[1] * (1 - 1e-6)).toPrecision(3));
    FINDS[k].unlockParkValue = gate;
    if (argv.includes('--write')) {
      const file = new URL('../src/data/finds.ts', import.meta.url);
      const src = readFileSync(file, 'utf8');
      const re = new RegExp(`(id: '${FINDS[k].id}'[^\\n]*unlockParkValue: )[^,]+(,)`);
      writeFileSync(file, src.replace(re, `$1${gate.toExponential(2).replace('e+', 'e')}$2`));
    }
    const line = `${k} ${FINDS[k].name.padEnd(14)} gate ${gate.toExponential(2)}  opens at day ${pick[0].toFixed(3)} (target ${T.toFixed(3)}) B ${pick[2].toExponential(1)} inc ${pick[3].toExponential(1)} paws ${Math.round(r.finalPaws)} prest ${r.prestiges} [sim ${r.secs.toFixed(1)}s]`;
    console.log(line);
    out.push(`  ${k}: ${gate.toExponential(2)}`);
  }
  console.log('\nunlockParkValue per find:\n' + FINDS.map((f, i) => `${i}: ${f.unlockParkValue}`).join('\n'));
  process.exit(0);
}

const T0 = Date.now();
for (const p of toSimulate) results[p.name] = simulate(p);
const prim = results['afkdaily'];

if (JSON_OUT) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { findT: r.findT, firstPrestigeT: r.firstPrestigeT, endT: r.endT, academyT: r.academyT, paws: r.finalPaws }]))));
  process.exit(0);
}

// ---------------------------------------------------------------- Park Level fit (--fit)
/** Target day (sim days since start) at which AFK+Daily should reach level L: piecewise anchors, see docs/06 section 6. */
function levelTargetDay(L: number, cosmicDay: number): number {
  if (L <= 20) return 0.001 * Math.pow(400, (L - 2) / 18); // Lv2 ~1.4 min .. Lv20 ~10 h
  const anchors: [number, number][] = [[20, 0.4], [40, 13], [70, 48], [100, cosmicDay]];
  for (let k = 1; k < anchors.length; k++) {
    if (L <= anchors[k][0]) {
      const [l0, d0] = anchors[k - 1];
      const [l1, d1] = anchors[k];
      return d0 + ((L - l0) / (l1 - l0)) * (d1 - d0);
    }
  }
  return cosmicDay;
}
if (argv.includes('--fit') && prim.findT[12] !== null) {
  const cosmicDay = prim.findT[12]!;
  const c = prim.curve;
  const at = (d: number) => {
    if (d <= c[0][0]) return c[0][1];
    for (let k = 1; k < c.length; k++) {
      if (c[k][0] >= d) {
        const f = (d - c[k - 1][0]) / Math.max(1e-12, c[k][0] - c[k - 1][0]);
        return c[k - 1][1] + f * (c[k][1] - c[k - 1][1]);
      }
    }
    return c[c.length - 1][1];
  };
  // smooth in log-time (+-12%) so prestige/find lumps in the lifetime curve do not make uneven $ steps
  const smooth = (d: number) => {
    let acc = 0;
    for (let k = -4; k <= 4; k++) acc += at(d * Math.exp(0.03 * k));
    return acc / 9;
  };
  const th: number[] = [1000];
  // Lv2..Lv20: geometric from $2.5K (the first minutes) to the fitted Lv20 threshold
  const lv20 = Math.pow(10, smooth(levelTargetDay(20, cosmicDay)));
  for (let L = 2; L <= 20; L++) th.push(2500 * Math.pow(lv20 / 2500, (L - 2) / 18));
  for (let L = 21; L <= 100; L++) th.push(Math.max(th[th.length - 1] * 1.05, Math.pow(10, smooth(levelTargetDay(L, cosmicDay)))));
  const top = th[th.length - 1];
  for (let L = 101; L <= 120; L++) th.push(Number((top * Math.pow(10, 0.15 * (L - 100))).toPrecision(3)));
  console.log('PARK_LEVEL_THRESHOLDS fit:\n' + JSON.stringify(th.map((x) => Number(x.toPrecision(3)))));
}

// ---------------------------------------------------------------- v4 era report (docs/08 section 6)
const quant = (a: number[], q: number) => {
  if (a.length === 0) return NaN;
  const b = [...a].sort((x, y) => x - y);
  const i = (b.length - 1) * q;
  const lo = Math.floor(i);
  return b[lo] + (b[Math.min(b.length - 1, lo + 1)] - b[lo]) * (i - lo);
};
const fx = (x: number, d = 1) => (Number.isNaN(x) ? 'n/a' : x.toFixed(d));
const fT = (d: number) => (Number.isNaN(d) ? 'n/a' : d < 1 / 24 ? `${(d * 1440).toFixed(1)}m` : d < 2 ? `${(d * 24).toFixed(1)}h` : `${d.toFixed(1)}d`);

const MIN_RATIO_BASE_DAYS = 5 / 1440;
interface EraStats {
  /** L[k] = list of (run index, days spent in Find k before the gate) for complete eras */
  L: { run: number; len: number }[][];
  ratios: { run: number; k: number; ratio: number }[];
  intervals: { t: number; gap: number }[];
  newEras: number[];
  traversed: number[];
}
function eraStats(r: Result): EraStats {
  const L: { run: number; len: number }[][] = FINDS.map(() => []);
  const ratios: { run: number; k: number; ratio: number }[] = [];
  r.runs.forEach((run, ri) => {
    for (let k = 0; k < run.maxFind; k++) {
      if (run.entry[k] === undefined || run.entry[k + 1] === undefined) continue;
      const len = run.entry[k + 1] - run.entry[k];
      L[k].push({ run: ri, len });
      if (k > 0 && run.entry[k - 1] !== undefined) {
        const prev = run.entry[k] - run.entry[k - 1];
        // L_{k-1} under 5 min is 60 s-chunk quantisation noise (a 1 min era vs a 3 min era reads as x3)
        if (prev >= MIN_RATIO_BASE_DAYS) ratios.push({ run: ri, k, ratio: len / prev });
      }
    }
  });
  const intervals: { t: number; gap: number }[] = [];
  let prevT = 0;
  for (const run of r.runs.slice(1)) { intervals.push({ t: run.startT, gap: run.startT - prevT }); prevT = run.startT; }
  const closed = r.runs.filter((x) => x.endT !== null);
  return {
    L, ratios, intervals,
    newEras: closed.map((x) => Math.max(0, x.maxFind - x.prevBest)),
    traversed: closed.map((x) => x.maxFind),
  };
}

let eraPass: { [k: string]: boolean } = {};
function printEraReport(r: Result): void {
  const e = eraStats(r);
  console.log('\n--- Era report (AFK+Daily, ~1 min resolution; L_k = time in Find k until its gate, the last era of a run is excluded) ---');
  console.log('Find k (era)'.padEnd(18) + 'run1 (B=1)'.padEnd(12) + 'median'.padEnd(10) + 'p10'.padEnd(10) + 'p90'.padEnd(10) + 'n'.padEnd(5) + 'ratio L_k/L_k-1: run1'.padEnd(24) + 'median'.padEnd(9) + 'min'.padEnd(8) + 'max'.padEnd(8) + 'n');
  for (let k = 0; k < FINDS.length - 1; k++) {
    const ls = e.L[k].map((x) => x.len);
    if (ls.length === 0) continue;
    const first = e.L[k].find((x) => x.run === 0);
    const rs = e.ratios.filter((x) => x.k === k);
    const r1 = rs.find((x) => x.run === 0);
    console.log(
      `${k} ${FINDS[k].name}`.padEnd(18) + (first ? fT(first.len) : '-').padEnd(12) + fT(quant(ls, 0.5)).padEnd(10) + fT(quant(ls, 0.1)).padEnd(10) + fT(quant(ls, 0.9)).padEnd(10) + String(ls.length).padEnd(5) +
      (k > 0 ? (r1 ? r1.ratio.toFixed(2) : '-') : '').padEnd(24) + (k > 0 && rs.length ? quant(rs.map((x) => x.ratio), 0.5).toFixed(2) : '').padEnd(9) + (k > 0 && rs.length ? Math.min(...rs.map((x) => x.ratio)).toFixed(2) : '').padEnd(8) + (k > 0 && rs.length ? Math.max(...rs.map((x) => x.ratio)).toFixed(2) : '').padEnd(8) + (k > 0 ? rs.length : ''),
    );
  }
  const allR = e.ratios.map((x) => x.ratio);
  const medK = new Set(e.ratios.map((x) => x.k));
  const medians = [...medK].map((k) => quant(e.ratios.filter((x) => x.k === k).map((x) => x.ratio), 0.5));
  const run1R = e.ratios.filter((x) => x.run === 0).map((x) => x.ratio);
  console.log(`ratio L_k/L_k-1 (same prestige): pooled median ${fx(quant(allR, 0.5), 2)}, p10 ${fx(quant(allR, 0.1), 2)}, p90 ${fx(quant(allR, 0.9), 2)}, share in [1.0,1.8] ${fx((100 * allR.filter((x) => x >= 1 && x <= 1.8).length) / Math.max(1, allR.length), 0)}%; per-k medians ${medians.map((x) => x.toFixed(2)).join(' ')}; run1 ${run1R.map((x) => x.toFixed(2)).join(' ')}`);
  eraPass['ratio'] = medians.length > 0 && medians.every((m) => m >= 1.0 && m <= 1.8) && run1R.every((x) => x >= 1.0 && x <= 1.8);
  const l0 = e.L[0].find((x) => x.run === 0)?.len ?? NaN;
  const l1 = e.L[1].find((x) => x.run === 0)?.len ?? NaN;
  eraPass['era1'] = l0 * 1440 >= 3 && l0 * 1440 <= 8;
  eraPass['era2'] = l1 * 1440 >= 8 && l1 * 1440 <= 20;
  console.log(`[info, v4 targets] Era 1 (Stick -> Tennis) ${fT(l0)}  v4 target 3-8 min ${eraPass['era1'] ? 'ok' : 'off'};  Era 2 (Tennis -> Squeaky) ${fT(l1)}  v4 target 8-20 min ${eraPass['era2'] ? 'ok' : 'off'};  era-length ratios 1.0-1.8: ${eraPass['ratio'] ? 'ok' : 'off'}`);

  // prestige rhythm by week
  console.log(`\nPrestige rhythm (${r.runs.length - 1} prestiges): interval in days by the week the prestige happened`);
  console.log('week'.padEnd(6) + 'n'.padEnd(5) + 'median'.padEnd(9) + 'p10'.padEnd(8) + 'p90'.padEnd(8) + 'new eras/prestige (mean)');
  const weeks = Math.ceil((r.endT || 1) / 7);
  const weekRows: string[] = [];
  const wk: number[][] = [];
  for (let w = 0; w < weeks; w++) wk.push(e.intervals.filter((x) => Math.floor(x.t / 7) === w).map((x) => x.gap));
  for (let w = 0; w < weeks; w++) {
    const g = wk[w];
    const ne = r.runs.slice(0, -1).filter((x) => x.endT !== null && Math.floor(x.endT! / 7) === w).map((x) => Math.max(0, x.maxFind - x.prevBest));
    if (g.length === 0) { weekRows.push(`${String(w + 1).padEnd(6)}${'0'.padEnd(5)}-`); continue; }
    weekRows.push(`${String(w + 1).padEnd(6)}${String(g.length).padEnd(5)}${fx(quant(g, 0.5), 2).padEnd(9)}${fx(quant(g, 0.1), 2).padEnd(8)}${fx(quant(g, 0.9), 2).padEnd(8)}${ne.length ? fx(ne.reduce((a, b) => a + b, 0) / ne.length, 2) : '-'}`);
  }
  console.log(weekRows.join('\n'));
  const wk1 = wk[0] ?? [];
  const lateStart = r.endT * (2 / 3);
  const late = e.intervals.filter((x) => x.t >= lateStart).map((x) => x.gap);
  const w1m = quant(wk1, 0.5);
  const latem = quant(late, 0.5);
  eraPass['week1'] = w1m >= 0.5 && w1m <= 1.5;
  eraPass['late'] = latem >= 3 && latem <= 7;
  console.log(`week-1 median ${fx(w1m, 2)} d (target ~1: 0.5-1.5) ${eraPass['week1'] ? 'ok' : 'off'};  last-third median ${fx(latem, 2)} d (target 3-7) ${eraPass['late'] ? 'ok' : 'off'}`);

  // eras climbed
  const hist = (a: number[]) => { const m = new Map<number, number>(); for (const x of a) m.set(x, (m.get(x) ?? 0) + 1); return [...m.entries()].sort((x, y) => x[0] - y[0]).map(([k, n]) => `${k}:${n}`).join(' '); };
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  console.log(`\nEras per prestige run (${e.newEras.length} closed runs)`);
  console.log(`new eras past the previous best: mean ${fx(mean(e.newEras), 2)}, histogram ${hist(e.newEras)}`);
  console.log(`eras climbed in the run (highest Find reached from Stick): mean ${fx(mean(e.traversed), 2)}, median ${fx(quant(e.traversed, 0.5), 1)}, histogram ${hist(e.traversed)}`);
  const growing = e.newEras.filter((x) => x > 0);
  console.log(`prestiges that set a new best era: ${growing.length}/${e.newEras.length}, mean new eras when they do ${fx(mean(growing), 2)}`);
  if (VERBOSE) {
    r.runs.forEach((run, i) => {
      const ls: string[] = [];
      for (let k = 0; k < run.maxFind; k++) if (run.entry[k] !== undefined && run.entry[k + 1] !== undefined) ls.push(fT(run.entry[k + 1] - run.entry[k]));
      console.log(`run ${i} start d${run.startT.toFixed(2)} B ${run.bonus.toExponential(2)} best ${run.prevBest}->${run.maxFind} L: ${ls.join(' ')}`);
    });
  }
}

const fmtStat = (x: number) => (x >= 1e6 ? x.toExponential(2) : x.toFixed(0));
const primCosmic = prim.findT[12];
const ratioOf = (r: Result) => (r.findT[12] !== null && primCosmic !== null ? r.findT[12]! / primCosmic : null);
const RATIO_TARGETS: Record<string, { text: string; ok: (x: number) => boolean }> = {
  daily: { text: '<= 1.5', ok: (x) => x <= 1.5 },
  active: { text: '>= 0.7', ok: (x) => x >= 0.7 },
  whale: { text: '>= 0.75', ok: (x) => x >= 0.75 },
  minnow: { text: '>= 0.92', ok: (x) => x >= 0.92 },
};


const medalIcons = ['·', '🥉', '🥈', '🥇'];
function printWeeks(r: Result): void {
  if (r.weeks.length === 0) return;
  const dist = [0, 0, 0, 0];
  for (const w of r.weeks) dist[w.medals]++;
  console.log(`\nDog Show (${r.weeks.length} weeks): medals per week  ${r.weeks.map((w) => `${w.medals}`).join('')}   |  0:${dist[0]} 1:${dist[1]} 2:${dist[2]} 3:${dist[3]}  (mean ${(r.weeks.reduce((a, w) => a + w.medals, 0) / r.weeks.length).toFixed(2)})`);
  if (VERBOSE) for (const w of r.weeks) console.log(`  ${w.weekKey} find ${w.findIndex} delivered ${sig(w.delivered)} goals ${w.targets.map(sig).join('/')} -> ${medalIcons[w.medals]}`);
}
/** the v5/v6 checks: collars, Dog Show, relics, endgame, rescue fill, era rebuild */
function addV5Rows(r: Result, rows: { name: string; value: string; target: string; pass: boolean | null; b?: string }[], isPrim: boolean, name: string): void {
  const rowAt = (d: number) => { let best = r.rows[0]; for (const x of r.rows) if (x.day <= d) best = x; return best; };
  const q = (a: number[], f: number) => quant(a, f);
  if (r.weeks.length > 0) {
    const m = r.weeks.map((w) => w.medals);
    const gold = m.filter((x) => x === 3).length / m.length;
    const mean = m.reduce((a, b) => a + b, 0) / m.length;
    if (name === 'active') rows.push({ name: 'Dog Show medals (gold share)', value: `${(100 * gold).toFixed(0)}% gold, mean ${mean.toFixed(2)}`, target: 'usually gold (>= 60%)', pass: gold >= 0.6 });
    else if (name === 'afkdaily') rows.push({ name: 'Dog Show medals (bronze+silver)', value: `${(100 * gold).toFixed(0)}% gold, mean ${mean.toFixed(2)}`, target: 'usually 2 (mean 1.6-2.4, gold <= 35%)', pass: mean >= 1.6 && mean <= 2.4 && gold <= 0.35 });
    else rows.push({ name: 'Dog Show medals (info)', value: `${(100 * gold).toFixed(0)}% gold, mean ${mean.toFixed(2)}`, target: '', pass: null });
  }
  if (!isPrim) return;
  const endRow = rowAt(120);
  rows.push({ name: 'Collars @ day 120', value: `${endRow.collars} (trophy ${r.collarsBySource.trophies}, show ${r.collarsBySource.show}, calendar ${r.collarsBySource.calendar})`, target: '40-60', pass: endRow.collars >= 40 && endRow.collars <= 60 });
  const r30 = rowAt(30), r100 = rowAt(100);
  rows.push({ name: 'Relic power @ day 30', value: `x${r30.relicPV.toFixed(2)} (raw product x${r30.relicProd.toFixed(2)})`, target: 'x2-3 (1.8-3.5)', pass: r30.relicPV >= 1.8 && r30.relicPV <= 3.5 });
  rows.push({ name: 'Relic power @ day 100', value: `x${r100.relicPV.toFixed(2)} (raw product x${r100.relicProd.toFixed(2)})`, target: 'x5-10 (4.5-11)', pass: r100.relicPV >= 4.5 && r100.relicPV <= 11 });
  rows.push({ name: 'Endgame: 4 Planet Paws', value: fmtDays(r.tPP), target: 'day 100-120', pass: r.tPP !== null && r.tPP >= 100 && r.tPP <= 120 });
  rows.push({ name: 'Endgame: Academy maxed', value: fmtDays(r.tAcademyMax), target: 'day 100-120', pass: r.tAcademyMax !== null && r.tAcademyMax >= 100 && r.tAcademyMax <= 120 });
  rows.push({ name: 'Endgame complete', value: fmtDays(r.endgameT), target: 'day 100-120', pass: r.endgameT !== null && r.endgameT >= 100 && r.endgameT <= 120 });
  rows.push({ name: 'Rescue fill, empty endgame park', value: r.fillAnalytic === null ? 'n/a' : `${r.fillAnalytic.toFixed(2)} d AFK (offline, Calm)`, target: '2-4 days', pass: r.fillAnalytic !== null && r.fillAnalytic >= 2 && r.fillAnalytic <= 4 });
  const eras = r.rebuilds.filter((x) => x.len >= 30 / 1440);
  const fr = eras.map((x) => x.rebuild / x.len);
  rows.push({ name: 'Era rebuild / era length', value: fr.length ? `median ${(100 * q(fr, 0.5)).toFixed(1)}%, p90 ${(100 * q(fr, 0.9)).toFixed(1)}% (n ${fr.length})` : 'n/a', target: '<= 15% (median)', pass: fr.length > 0 && q(fr, 0.5) <= 0.15 });
}

for (const p of selected) {
  const r = results[p.name];
  const isPrim = p.name === 'afkdaily';
  console.log(`\n=== Profile: ${p.label}  (seed ${SEED}, simulated ${r.endT.toFixed(1)} days in ${r.secs.toFixed(1)}s) ===`);
  if (isPrim || VERBOSE) {
    console.log('\nday  log10B  log10inc  paws          rank  find  collars  relicPV  relicProd  crew  relics  GB      prest  academyLv  ParkLv  stars');
    const step = Number(flag('--every') ?? 7);
    for (const row of r.rows) {
      if (!VERBOSE && row.day % step !== 0 && row.day !== r.rows[r.rows.length - 1].day && ![1, 2, 3].includes(row.day)) continue;
      console.log(`${String(row.day).padStart(3)}  ${row.log10B.toFixed(1).padStart(6)}  ${row.log10Income.toFixed(1).padStart(8)}  ${sig(row.paws).padEnd(12)}  ${String(row.rank).padStart(4)}  ${String(row.find).padStart(4)}  ${String(row.collars).padStart(7)}  ${('x' + row.relicPV.toFixed(2)).padStart(7)}  ${('x' + row.relicProd.toFixed(2)).padStart(9)}  ${String(row.crew).padStart(4)}  ${String(row.relics).padStart(6)}  ${sig(row.gb).padEnd(6)}  ${String(row.prestiges).padStart(5)}  ${String(row.academy).padStart(9)}  ${String(row.lv).padStart(6)}  ${String(row.stars).padStart(5)}`);
    }
    printWeeks(r);
    console.log('Golden Bones earned (Academy spent + banked) by day: ' + [10, 30, 60, 90, 100, 110, 120].map((d) => { const x = r.rows.find((y) => y.day === d); return x ? `d${d}:${sig(x.bones)}` : ''; }).filter(Boolean).join('  ') + `  | full Academy costs ${ACADEMY.reduce((a, d) => { let c = 0; for (let l = 0; l < d.maxLevel; l++) c += Math.ceil(d.baseCost * Math.pow(d.costGrowth, l)); return a + c; }, 0)}`);
  }
  console.log('\nMilestone'.padEnd(26) + 'Result'.padEnd(22) + 'Target'.padEnd(22) + 'log10 B'.padEnd(9));
  console.log('-'.repeat(76));
  const rows: { name: string; value: string; target: string; pass: boolean | null; b?: string }[] = [];
  for (const t of TARGETS) {
    const v = r.findT[t.idx];
    const full = isPrim || t.idx <= 3;
    rows.push({
      name: t.name, value: t.hi < 1 / 24 + 1e-9 ? fmtMin(v) : fmtDays(v),
      target: full ? tgtStr(t) : (prim.findT[t.idx] !== null && v !== null ? `AFK+D x${(v / prim.findT[t.idx]!).toFixed(2)}` : ''),
      pass: full ? (isPrim ? inR(v, t.lo, t.hi) : v !== null && v <= Math.max(t.hi * 1.5, [0, 15 / 1440, 45 / 1440, 1][t.idx])) : null, // other profiles: the early game must not be slower than the AFK+Daily window
      b: r.findLogB[t.idx] === null ? '' : r.findLogB[t.idx]!.toFixed(1),
    });
  }
  rows.push({ name: 'First prestige', value: fmtDays(r.firstPrestigeT), target: 'day 0-1', pass: inR(r.firstPrestigeT, 0, 1) });
  addV5Rows(r, rows, isPrim, p.name);
  if (isPrim) {
    const at = (id: string) => (r.academyT[id] === undefined ? null : r.academyT[id]);
    rows.push({ name: 'Foreman Pup bought', value: fmtDays(at('foreman_pup')), target: 'day 0', pass: inR(at('foreman_pup'), 0, 1) });
    rows.push({ name: 'Head Trainer bought', value: fmtDays(at('head_trainer')), target: 'by day 1', pass: inR(at('head_trainer'), 0, 1.0) });
    rows.push({ name: 'Retirement Planner bought', value: fmtDays(at('retirement_planner')), target: 'day 10-20', pass: inR(at('retirement_planner'), 10, 20) });
    rows.push({ name: 'Longest drought', value: `${r.drought.toFixed(2)} d @day ${r.droughtAt.toFixed(1)}`, target: '<= 3 days', pass: r.drought <= 3 });
    const lastA = r.lastAcademyT;
    rows.push({ name: 'Academy bought near end', value: lastA === null ? 'n/a' : `last @day ${lastA.toFixed(1)}`, target: 'within 2 d of end', pass: lastA !== null && r.endT - lastA <= 2 });
    rows.push({ name: 'Longest Academy drought', value: `${r.academyGap.toFixed(2)} d @day ${r.academyGapAt.toFixed(1)}`, target: '<= 2 d after Planner', pass: r.academyGap <= 2 });
    rows.push({ name: 'Academy ladders maxed (info)', value: `${r.maxLadders}/${ACADEMY.length}`, target: '', pass: null });
    const lv = (d: number) => r.rows.find((x) => x.day === d)?.lv ?? null;
    const l1 = lv(1), l14 = lv(14), l50 = lv(50);
    rows.push({ name: 'Park Lv @ day 1', value: String(l1), target: '>= 20', pass: l1 !== null && l1 >= 20 });
    rows.push({ name: 'Park Lv @ day 14', value: String(l14), target: '~40 (36-44)', pass: l14 !== null && l14 >= 36 && l14 <= 44 });
    rows.push({ name: 'Park Lv @ day 50', value: String(l50), target: '~70 (65-75)', pass: l50 !== null && l50 >= 65 && l50 <= 75 });
    const l100 = r.levelT[99];
    rows.push({ name: 'Park Lv 100 reached', value: fmtDays(l100), target: `Cosmic day +-5 (${primCosmic === null ? '?' : primCosmic.toFixed(1)})`, pass: l100 !== null && primCosmic !== null && Math.abs(l100 - primCosmic) <= 5 });
    rows.push({ name: 'Free stars by day 30', value: r.stars30 === null ? 'n/a' : String(r.stars30), target: '~100-300 (1-2 cheap lvls)', pass: r.stars30 !== null && r.stars30 >= 100 && r.stars30 <= 300 });
  }
  const ratio = ratioOf(r);
  const rt = RATIO_TARGETS[p.name];
  if (rt) rows.push({ name: `${p.name} / AFK+Daily Cosmic`, value: ratio === null ? 'n/a' : ratio.toFixed(2), target: rt.text, pass: ratio !== null && rt.ok(ratio) });
  for (const x of rows) {
    console.log(x.name.padEnd(26) + x.value.padEnd(22) + x.target.padEnd(26) + (x.b ?? '').padEnd(9) + (x.pass === null ? '' : x.pass ? 'PASS' : 'FAIL'));
    if (x.pass === false) allPass = false;
  }
  if (isPrim || VERBOSE) {
    console.log('final Academy levels: ' + ACADEMY.map((d) => `${d.id} ${r.levels[d.id] ?? 0}/${d.maxLevel}`).join(', '));
    console.log('first Academy buys (day): ' + Object.entries(r.academyT).map(([k, v]) => `${k}@${v.toFixed(1)}`).join(' '));
  }
  if (isPrim) {
    printEraReport(r);
    // the v4 era-rhythm checks (docs/08) are informational since docs/10 replaced the costScale model
  }
  console.log(`Portal: built day ${r.portal.built === null ? 'n/a' : r.portal.built.toFixed(2)}, launched ${r.portal.launched} (skipped ${r.portal.skipped}), collected ${r.portal.collected}, crafted ${r.portal.crafted}, recycled ${r.portal.recycled}, GB from loot ${r.portal.goldenFromLoot}, GB from recycling ${r.portal.goldenFromRecycle}, crew runs ${r.portal.crewRuns.join('/')}, best tier T${r.portal.maxTier}`);
  console.log(`(max pups ${sig(r.maxPups)}, paws ${sig(r.finalPaws)}, prestiges ${r.prestiges}, academy levels ${r.academyLevels}, unspent GB ${sig(r.finalGB)}, Academy spent ${sig(r.academySpent)}, free+bought stars ${fmtStat(r.starsFree)} (spent ${fmtStat(r.starsSpent)}), best streak ${r.bestStreak})`);
  if (isPrim) {
    const sample = [1, 3, 7, 14, 21, 30, 50, 75, 100].map((d) => r.rows.find((x) => x.day === d)).filter(Boolean).map((x) => `d${x!.day}:Lv${x!.lv}`);
    console.log('Park Level sample: ' + sample.join(' ') + `  | titles: ${PARK_TITLES.map((t, k) => `${k * 10}=${t}`).join(', ')}`);
  }
}
console.log(`\nTotal wall time ${((Date.now() - T0) / 1000).toFixed(1)}s`);
console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
