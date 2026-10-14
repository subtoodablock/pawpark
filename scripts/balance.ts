/* Paw Park balance bot v2 (docs/04 §5). Run with `npm run balance [-- --profile afk|daily|active|all --days N --verbose]`.
 * Simulates REAL days (day 0 starts at 18:00). Between check-ins it calls applyOfflineProgress,
 * i.e. the real offline path (Treat Jar cap, chunking, automation). Uses ONLY the public barrel. */
import {
  ACADEMY, AUTO_SPLURGE_FRACTION, FINDS, adopt, HOLD_ADOPT_PER_SEC, KENNEL_SLOTS, TRAINING,
  academyCost, applyOfflineProgress, buyAcademy, buyKennel, buyTraining, buyVehicle,
  catchSquirrel, computeStats, createInitialState, isTrainingTierUnlocked, kennelUpgradeCost,
  openAllMail, prestige, setAutomation, tick, trainingCost, vehicleUpgradeCost,
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
const SEED = Number(flag('--seed') ?? 12345);
/** diagnostic: --hold k disables find gates beyond index k (shows how B(t) grows while parked on find k) */
const HOLD = Number(flag('--hold') ?? -1);
if (HOLD >= 0) for (let i = HOLD + 1; i < FINDS.length; i++) FINDS[i].unlockParkValue = Infinity;
/** diagnostic: --gates "4:1e13,5:Infinity" overrides unlockParkValue (used by the gate calibration loop); --json prints raw results */
for (const kv of (flag('--gates') ?? '').split(',').filter(Boolean)) {
  const [k, v] = kv.split(':');
  FINDS[Number(k)].unlockParkValue = Number(v);
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
interface ProfileDef {
  name: 'afk' | 'daily' | 'active';
  label: string;
  /** check-in hours (local) */
  checkins: number[];
  sessionSec: number;
  /** optional daily online window [startHour, endHour) */
  window?: [number, number];
}
const PROFILES: ProfileDef[] = [
  { name: 'afk', label: 'AFK (primary)', checkins: [8, 12.5, 18, 22.5], sessionSec: 180 },
  { name: 'daily', label: 'Daily', checkins: [20], sessionSec: 300 },
  { name: 'active', label: 'Active', checkins: [8, 12.5, 22.5], sessionSec: 180, window: [18, 22] },
];

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

interface DayRow { day: number; log10B: number; log10Income: number; paws: number; find: number; gb: number; prestiges: number; academy: number; cash10: number }
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
  };

  const logRow = (t: number) => {
    const day = t / DAY;
    if (day < nextLogDay) return;
    nextLogDay = Math.floor(day) + 1;
    const s = computeStats(state);
    rows.push({
      day: Math.floor(day), log10B: Math.log10(s.earningsBonus), log10Income: Math.log10(Math.max(s.incomePerSec, 1e-9)), paws: state.spiritPaws,
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

  const keys: AutomationKey[] = ['find', 'build', 'training', 'whistle', 'prestige'];
  const longestGapSec = (def.name === 'daily' ? 24 : 9.5) * H;

  const checkin = (t: number) => {
    if (state.lastSaved < t * 1000) applyOfflineProgress(state, t * 1000);
    openAllMail(state, rng);
    academyPhase(t, longestGapSec);
    const s = computeStats(state);
    for (const k of keys) if (s.automationUnlocked[k] && !state.automation[k]) setAutomation(state, k, true);
    observe(t);
    logRow(t);
  };

  const session = (start: number, len: number, active: boolean) => {
    checkin(start);
    if (done) return;
    const dt = active && start > 0 ? 2 : 1;
    const end = start + len;
    for (let t = start; t < end; t += dt) {
      const rel = t - start;
      const first10 = start === 0 && rel < FULL_WHISTLE_SEC;
      const activeWhistle = active && start >= 0 && (t % 60) < 10 && !(start === 0 && rel < FULL_WHISTLE_SEC);
      if (first10 || activeWhistle) adopt(state, HOLD_ADOPT_PER_SEC * dt, true);
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
// Daily/Active comparisons need AFK, so always simulate AFK when comparing
const toSimulate = selected.some((p) => p.name === 'afk') ? selected : [PROFILES[0], ...selected];

const T0 = Date.now();
for (const p of toSimulate) results[p.name] = simulate(p);

if (JSON_OUT) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { findT: r.findT, firstPrestigeT: r.firstPrestigeT, endT: r.endT, academyT: r.academyT, paws: r.finalPaws }]))));
  process.exit(0);
}
for (const p of selected) {
  const r = results[p.name];
  const afk = results['afk'];
  console.log(`\n=== Profile: ${p.label}  (seed ${SEED}, simulated ${r.endT.toFixed(1)} days in ${r.secs.toFixed(1)}s) ===`);
  if (p.name === 'afk' || VERBOSE) {
    console.log('\nday  log10B  log10inc  paws          find  GB      prestiges  academyLv');
    for (const row of r.rows) {
      if (!VERBOSE && row.day % 7 !== 0 && row.day !== r.rows[r.rows.length - 1].day) continue;
      console.log(`${String(row.day).padStart(3)}  ${row.log10B.toFixed(1).padStart(6)}  ${row.log10Income.toFixed(1).padStart(8)}  ${sig(row.paws).padEnd(12)}  ${String(row.find).padStart(4)}  ${sig(row.gb).padEnd(6)}  ${String(row.prestiges).padStart(9)}  ${String(row.academy).padStart(9)}`);
    }
  }
  console.log('\nMilestone'.padEnd(26) + 'Result'.padEnd(22) + 'Target'.padEnd(22) + 'log10 B'.padEnd(9));
  console.log('-'.repeat(76));
  const rows: { name: string; value: string; target: string; pass: boolean | null; b?: string }[] = [];
  for (const t of TARGETS) {
    const v = r.findT[t.idx];
    const full = p.name === 'afk' || t.idx <= 3;
    rows.push({
      name: t.name, value: t.hi < 1 ? fmtMin(v) : fmtDays(v),
      target: full ? tgtStr(t) : (afk.findT[t.idx] !== null && v !== null ? `AFK x${(v / afk.findT[t.idx]!).toFixed(2)}` : ''),
      pass: full ? inR(v, t.lo, t.hi) : null,
      b: r.findLogB[t.idx] === null ? '' : r.findLogB[t.idx]!.toFixed(1),
    });
  }
  rows.push({ name: 'First prestige', value: fmtDays(r.firstPrestigeT), target: 'day 0-1', pass: inR(r.firstPrestigeT, 0, 1) });
  if (p.name === 'afk') {
    const at = (id: string) => (r.academyT[id] === undefined ? null : r.academyT[id]);
    rows.push({ name: 'Foreman Pup bought', value: fmtDays(at('foreman_pup')), target: 'day 0', pass: inR(at('foreman_pup'), 0, 1) });
    rows.push({ name: 'Head Trainer bought', value: fmtDays(at('head_trainer')), target: 'by day 1', pass: inR(at('head_trainer'), 0, 1.0) });
    rows.push({ name: 'Retirement Planner bought', value: fmtDays(at('retirement_planner')), target: 'day 10-20', pass: inR(at('retirement_planner'), 10, 20) });
    rows.push({ name: 'Longest drought', value: `${r.drought.toFixed(2)} d @day ${r.droughtAt.toFixed(1)}`, target: '<= 3 days', pass: r.drought <= 3 });
    const lastA = r.lastAcademyT;
    rows.push({ name: 'Academy bought near end', value: lastA === null ? 'n/a' : `last @day ${lastA.toFixed(1)}`, target: 'within 2 d of end', pass: lastA !== null && r.endT - lastA <= 2 });
    rows.push({ name: 'Longest Academy drought', value: `${r.academyGap.toFixed(2)} d @day ${r.academyGapAt.toFixed(1)}`, target: '<= 2 d after Planner', pass: r.academyGap <= 2 });
    rows.push({ name: 'Academy ladders maxed (info)', value: `${r.maxLadders}/${ACADEMY.length}`, target: '', pass: null });
  }
  const cosmic = r.findT[12];
  if (p.name === 'daily') {
    const a = afk.findT[12];
    const ratio = cosmic !== null && a !== null ? cosmic / a : null;
    rows.push({ name: 'Daily / AFK days to Cosmic', value: ratio === null ? 'n/a' : ratio.toFixed(2), target: '<= 1.5', pass: ratio !== null && ratio <= 1.5 });
  }
  if (p.name === 'active') {
    const a = afk.findT[12];
    const ratio = cosmic !== null && a !== null ? cosmic / a : null;
    rows.push({ name: 'Active / AFK days to Cosmic', value: ratio === null ? 'n/a' : ratio.toFixed(2), target: '>= 0.7', pass: ratio !== null && ratio >= 0.7 });
  }
  for (const x of rows) {
    console.log(x.name.padEnd(26) + x.value.padEnd(22) + x.target.padEnd(22) + (x.b ?? '').padEnd(9) + (x.pass === null ? '' : x.pass ? 'PASS' : 'FAIL'));
    if (x.pass === false) allPass = false;
  }
  console.log('final Academy levels: ' + ACADEMY.map((d) => `${d.id} ${r.levels[d.id] ?? 0}/${d.maxLevel}`).join(', '));
  console.log('first Academy buys (day): ' + Object.entries(r.academyT).map(([k, v]) => `${k}@${v.toFixed(1)}`).join(' '));
  console.log(`(max pups ${sig(r.maxPups)}, paws ${sig(r.finalPaws)}, prestiges ${r.prestiges}, academy levels ${r.academyLevels}, unspent GB ${sig(r.finalGB)}, Academy spent ${sig(r.academySpent)}, next cheapest ${sig(r.nextCheapest)})`);
}
console.log(`\nTotal wall time ${((Date.now() - T0) / 1000).toFixed(1)}s`);
console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
