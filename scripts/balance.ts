/* Paw Park balance bot v3 (docs/04 §5, docs/06 §10). Run with `npm run balance [-- --profile afkdaily|afk|daily|active|minnow|whale|all --days N --verbose --fit]`.
 * Simulates REAL days (day 0 starts at 18:00). Between check-ins it calls applyOfflineProgress,
 * i.e. the real offline path (Treat Jar cap, chunking, automation). Uses ONLY the public barrel. */
import {
  ACADEMY, AUTO_SPLURGE_FRACTION, FINDS, PARK_LEVEL_THRESHOLDS, PARK_TITLES, PREMIUM_SHOP, PRODUCTS, VIP_TIERS, adopt, HOLD_ADOPT_PER_SEC, KENNEL_SLOTS, TRAINING,
  academyCost, applyOfflineProgress, buyAcademy, buyKennel, buyPremium, buyStreakFreeze, buyTraining, buyTreat, buyVehicle,
  catchSquirrel, claimDailyDig, claimDailyDigBonus, claimDailyTreat, computeStats, createInitialState, grantPurchase,
  isTrainingTierUnlocked, kennelUpgradeCost, openAllMail, parkLevel, premiumCost, prestige, refreshDaily, setAutomation,
  tick, trainingCost, vehicleUpgradeCost,
} from '../src/core/index';
import type { AutomationKey, GameState, Rng, Stat } from '../src/core/index';

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
const VERBOSE = argv.includes('--verbose');
const MAX_DAYS = Number(flag('--days') ?? 200);
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
/** diagnostic: ABL="vip,star_spirit,..." zeroes the VIP earnings bonus / the named shop items' perLevel */
for (const id of (process.env.ABL ?? '').split(',').filter(Boolean)) {
  if (id === 'vip') for (const t of VIP_TIERS) t.earningsBonus = 0;
  else { const d = PREMIUM_SHOP.find((x) => x.id === id); if (d) d.perLevel = 0; }
}
const JSON_OUT = argv.includes('--json');
/** diagnostic: stop the profile once this find index is reached (default: the last find) */
const STOP_AT = Number(flag('--stop') ?? FINDS.length - 1);

const H = 3600;
const DAY = 86400;
const START_HOUR = 18; // day 0 starts at 18:00
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
}
const AFK_CHECKINS = [8, 12.5, 18, 22.5];
const PROFILES: ProfileDef[] = [
  { name: 'afkdaily', label: 'AFK+Daily (primary)', checkins: AFK_CHECKINS, sessionSec: 180, daily: true, stars: 'cheapest' },
  { name: 'afk', label: 'AFK (no dailies, info)', checkins: AFK_CHECKINS, sessionSec: 180, daily: false, stars: 'none' },
  { name: 'daily', label: 'Daily', checkins: [20], sessionSec: 300, daily: true, stars: 'cheapest' },
  { name: 'active', label: 'Active', checkins: [8, 12.5, 22.5], sessionSec: 180, window: [18, 22], daily: true, stars: 'cheapest' },
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
const sig = (n: number) => (n >= 1e6 ? n.toExponential(2) : n >= 100 ? n.toFixed(0) : n.toFixed(1));

interface DayRow { day: number; lv: number; stars: number; streak: number; log10B: number; log10Income: number; paws: number; find: number; gb: number; prestiges: number; academy: number; cash10: number }
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
  const state = createInitialState(0);
  state.lastSaved = 0;
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

  const observe = (t: number) => {
    if (state.highestFindIndex > lastHF) {
      for (let k = lastHF + 1; k <= state.highestFindIndex; k++) { findT[k] = t / DAY; findLogB[k] = Math.log10(computeStats(state).earningsBonus); }
      lastHF = state.highestFindIndex;
      eventsT.push(t);
      if (VERBOSE) console.log(`  [${fmtDays(t / DAY)}] FIND -> ${FINDS[lastHF].name}`);
    }
    if (state.trophies.length > lastTrophies) { lastTrophies = state.trophies.length; eventsT.push(t); }
    if (state.prestigeCount > lastPrestiges) {
      lastPrestiges = state.prestigeCount;
      eventsT.push(t);
      if (firstPrestigeT === null) firstPrestigeT = t / DAY;
    }
    if (state.highestFindIndex >= STOP_AT) done = true;
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
    rows.push({
      day: Math.floor(day), lv: parkLevel(state.lifetimeEarnings), stars: state.premium.stars + starsSpent - starsBought, streak: state.daily.streak, log10B: Math.log10(s.earningsBonus), log10Income: Math.log10(Math.max(s.incomePerSec, 1e-9)), paws: state.spiritPaws,
      find: state.highestFindIndex, gb: state.goldenBones, prestiges: state.prestigeCount,
      academy: academyTotal(state), cash10: 0,
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
    for (let i = 0; i < d.digs.length; i++) claimDailyDig(state, i);
    if (process.env.DIGLOG && VERBOSE) console.log(`  dig d${d.digsDay} ${d.digs.map((x) => `${x.kind}${x.claimed ? '+' : '-'}`).join(' ')} mod ${d.modifierId}`);
    claimDailyDigBonus(state);
  };
  const dayIdxOf = (t: number) => Math.floor((t + START_HOUR * H) / DAY);
  let purchasesDone = 0;

  const keys: AutomationKey[] = ['find', 'build', 'training', 'whistle', 'prestige'];
  const longestGapSec = (def.name === 'daily' ? 24 : 9.5) * H;

  /** returns true when this is the first check-in of the local day (daily ritual start) */
  const checkin = (t: number): boolean => {
    if (state.lastSaved < t * 1000) applyOfflineProgress(state, t * 1000);
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
      if (first10 || activeWhistle || dailyWhistle) adopt(state, HOLD_ADOPT_PER_SEC * dt, true);
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
      if (done) { state.lastSaved = (t + dt) * 1000; return; }
    }
    if (def.daily) {
      claimDigs();
      spendStars();
      academyPhase(end, longestGapSec);
    }
    state.lastSaved = end * 1000;
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
  };
}

// ---------------------------------------------------------------- reporting
interface Target { name: string; idx: number; lo: number; hi: number } // days
const TARGETS: Target[] = [
  { name: 'Tennis Ball', idx: 1, lo: 0, hi: 10 / 1440 },
  { name: 'Squeaky Toy', idx: 2, lo: 0, hi: 45 / 1440 },
  { name: 'Rawhide', idx: 3, lo: 0, hi: 1 },
  { name: 'Lost Wallet', idx: 4, lo: 1, hi: 3 },
  { name: 'Pirate Coin', idx: 5, lo: 4, hi: 8 },
  { name: 'Dino Fossil', idx: 6, lo: 9, hi: 16 },
  { name: 'Crystal Bone', idx: 7, lo: 17, hi: 28 },
  { name: 'Meteorite', idx: 8, lo: 29, hi: 42 },
  { name: 'Ancient Relic', idx: 9, lo: 43, hi: 58 },
  { name: 'Moon Rock', idx: 10, lo: 59, hi: 75 },
  { name: 'Time Bone', idx: 11, lo: 76, hi: 95 },
  { name: 'Cosmic Bone (endgame)', idx: 12, lo: 95, hi: 125 },
];
const inR = (v: number | null, lo: number, hi: number) => v !== null && v >= lo && v <= hi;
const tgtStr = (t: Target) => (t.hi < 1 && t.lo === 0 ? `<= ${(t.hi * 1440).toFixed(0)} min` : t.lo === 0 ? `day 0-${t.hi}` : `day ${t.lo}-${t.hi}`);

let allPass = true;
const results: Record<string, Result> = {};
const selected = PROFILES.filter((p) => PROFILE_ARG === 'all' || PROFILE_ARG === p.name);
if (selected.length === 0) { console.error(`unknown profile ${PROFILE_ARG}`); process.exit(2); }
// every comparison is against AFK+Daily (primary), so always simulate it
const toSimulate = selected.some((p) => p.name === 'afkdaily') ? selected : [PROFILES[0], ...selected];

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

const fmtStat = (x: number) => (x >= 1e6 ? x.toExponential(2) : x.toFixed(0));
const primCosmic = prim.findT[12];
const ratioOf = (r: Result) => (r.findT[12] !== null && primCosmic !== null ? r.findT[12]! / primCosmic : null);
const RATIO_TARGETS: Record<string, { text: string; ok: (x: number) => boolean }> = {
  daily: { text: '<= 1.5', ok: (x) => x <= 1.5 },
  active: { text: '>= 0.7', ok: (x) => x >= 0.7 },
  whale: { text: '>= 0.75', ok: (x) => x >= 0.75 },
  minnow: { text: '>= 0.92', ok: (x) => x >= 0.92 },
};

for (const p of selected) {
  const r = results[p.name];
  const isPrim = p.name === 'afkdaily';
  console.log(`\n=== Profile: ${p.label}  (seed ${SEED}, simulated ${r.endT.toFixed(1)} days in ${r.secs.toFixed(1)}s) ===`);
  if (isPrim || VERBOSE) {
    console.log('\nday  log10B  log10inc  paws          find  GB      prestiges  academyLv  ParkLv  stars');
    for (const row of r.rows) {
      if (!VERBOSE && row.day % 7 !== 0 && row.day !== r.rows[r.rows.length - 1].day && ![1, 2, 3].includes(row.day)) continue;
      console.log(`${String(row.day).padStart(3)}  ${row.log10B.toFixed(1).padStart(6)}  ${row.log10Income.toFixed(1).padStart(8)}  ${sig(row.paws).padEnd(12)}  ${String(row.find).padStart(4)}  ${sig(row.gb).padEnd(6)}  ${String(row.prestiges).padStart(9)}  ${String(row.academy).padStart(9)}  ${String(row.lv).padStart(6)}  ${String(row.stars).padStart(5)}`);
    }
  }
  console.log('\nMilestone'.padEnd(26) + 'Result'.padEnd(22) + 'Target'.padEnd(22) + 'log10 B'.padEnd(9));
  console.log('-'.repeat(76));
  const rows: { name: string; value: string; target: string; pass: boolean | null; b?: string }[] = [];
  for (const t of TARGETS) {
    const v = r.findT[t.idx];
    const full = isPrim || t.idx <= 3;
    rows.push({
      name: t.name, value: t.hi < 1 ? fmtMin(v) : fmtDays(v),
      target: full ? tgtStr(t) : (prim.findT[t.idx] !== null && v !== null ? `AFK+D x${(v / prim.findT[t.idx]!).toFixed(2)}` : ''),
      pass: full && (isPrim || t.idx <= 3) ? inR(v, t.lo, t.hi) : null,
      b: r.findLogB[t.idx] === null ? '' : r.findLogB[t.idx]!.toFixed(1),
    });
  }
  rows.push({ name: 'First prestige', value: fmtDays(r.firstPrestigeT), target: 'day 0-1', pass: inR(r.firstPrestigeT, 0, 1) });
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
  console.log(`(max pups ${sig(r.maxPups)}, paws ${sig(r.finalPaws)}, prestiges ${r.prestiges}, academy levels ${r.academyLevels}, unspent GB ${sig(r.finalGB)}, Academy spent ${sig(r.academySpent)}, free+bought stars ${fmtStat(r.starsFree)} (spent ${fmtStat(r.starsSpent)}), best streak ${r.bestStreak})`);
  if (isPrim) {
    const sample = [1, 3, 7, 14, 21, 30, 50, 75, 100].map((d) => r.rows.find((x) => x.day === d)).filter(Boolean).map((x) => `d${x!.day}:Lv${x!.lv}`);
    console.log('Park Level sample: ' + sample.join(' ') + `  | titles: ${PARK_TITLES.map((t, k) => `${k * 10}=${t}`).join(', ')}`);
  }
}
console.log(`\nTotal wall time ${((Date.now() - T0) / 1000).toFixed(1)}s`);
console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
