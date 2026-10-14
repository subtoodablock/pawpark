/* Paw Park balance bot (design §9). Run with `npm run balance [-- --verbose]`.
 * Uses ONLY the public engine API. Deterministic (seeded rng, dt = 1s). */
import {
  FINDS, HOLD_ADOPT_PER_SEC, KENNELS, KENNEL_SLOTS, TRAINING, VEHICLES,
  adopt, buyKennel, buyTraining, buyVehicle, computeStats, createInitialState,
  isTrainingTierUnlocked, kennelUpgradeCost, prestige, tick, trainingCost,
  upgradeFind, vehicleUpgradeCost,
} from '../src/core/index';
import type { GameState, Rng } from '../src/core/index';

const VERBOSE = process.argv.includes('--verbose');
const CAP_SEC = 3 * 3600;
const FULL_WHISTLE_SEC = 600;
/** Fallback purchases must cost <= this fraction of the cheapest bottleneck item (else the bot saves). */
const SAVE_FRACTION = 0.1;

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

type Kind = 'capacity' | 'ship' | 'dig' | 'value' | 'other';
interface Candidate { label: string; cost: number; kind: Kind; buy: () => boolean }

const CAP_STATS = new Set(['kennelCapacity']);
const SHIP_STATS = new Set(['shippingCapacity', 'fleetSlots']);
const DIG_STATS = new Set(['layRate']);
const VALUE_STATS = new Set(['findValue']);

function candidates(state: GameState): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < KENNEL_SLOTS; i++) {
    const c = kennelUpgradeCost(state, i);
    if (c !== null) {
      const next = (state.kennels[i] ?? -1) + 1;
      out.push({ label: `kennel[${i}] -> ${KENNELS[next].name}`, cost: c, kind: 'capacity', buy: () => buyKennel(state, i).ok });
    }
  }
  for (let i = 0; i < state.vehicles.length; i++) {
    const c = vehicleUpgradeCost(state, i);
    if (c !== null) {
      const next = (state.vehicles[i] ?? -1) + 1;
      out.push({ label: `vehicle[${i}] -> ${VEHICLES[next].name}`, cost: c, kind: 'ship', buy: () => buyVehicle(state, i).ok });
    }
  }
  for (const def of TRAINING) {
    if (!isTrainingTierUnlocked(state, def.tier)) continue;
    const c = trainingCost(state, def.id);
    if (c === null) continue;
    const kind: Kind = CAP_STATS.has(def.stat) ? 'capacity' : SHIP_STATS.has(def.stat) ? 'ship' : DIG_STATS.has(def.stat) ? 'dig' : VALUE_STATS.has(def.stat) ? 'value' : 'other';
    out.push({ label: `train ${def.id} L${(state.training[def.id] ?? 0) + 1}`, cost: c, kind, buy: () => buyTraining(state, def.id, 1).ok });
  }
  return out;
}

function pickPurchase(state: GameState): Candidate | null {
  const s = computeStats(state);
  const all = candidates(state);
  const afford = all.filter((c) => c.cost <= state.cash);
  const cheapest = (list: Candidate[]) => list.reduce((a, b) => (b.cost < a.cost ? b : a));
  let want: Kind[];
  if (s.bottleneck === 'dig' && state.pups >= 0.95 * s.kennelCapacity) want = ['capacity'];
  else if (s.bottleneck === 'ship') want = ['ship'];
  else want = ['dig', 'value'];
  const isWant = (c: Candidate) => want.includes(c.kind);
  const preferred = afford.filter(isWant);
  if (preferred.length > 0) return cheapest(preferred);
  if (afford.length === 0) return null;
  // Fallback: cheapest overall, but do not burn the cash we are saving for the
  // cheapest bottleneck-widening item unless the fallback is a small fraction of it.
  const target = all.filter(isWant);
  const pick = cheapest(afford);
  if (target.length > 0 && pick.cost > SAVE_FRACTION * cheapest(target).cost) return null;
  return pick;
}

interface RunResult {
  findTimes: Record<number, number>;
  prestigeTime: number | null;
  rawhideTime: number | null;
  longestGap: number;
  longestGapAt: number;
  maxPurchaseGap: number;
  findAt60: number;
  income: Record<number, number>;
  gain: number;
  state: GameState;
}

function runOnce(state: GameState, rng: Rng, label: string, stopAtPrestige: boolean, minSec = 0): RunResult {
  const res: RunResult = { findTimes: {}, prestigeTime: null, rawhideTime: null, longestGap: 0, longestGapAt: 0, maxPurchaseGap: 0, findAt60: 0, income: {}, gain: 0, state };
  let t = 0;
  let gap = 0;
  let idle = 0;
  const marks = new Set([5, 15, 30, 60]);
  while (t < CAP_SEC) {
    // whistle
    const whistling = t < FULL_WHISTLE_SEC || t % 60 < 10;
    if (whistling) adopt(state, HOLD_ADOPT_PER_SEC, true);
    let bought = false;
    while (upgradeFind(state).ok) {
      bought = true;
      res.findTimes[state.findIndex] = t;
      if (VERBOSE && label !== 'obs') console.log(`[${label} ${fmtT(t)}] FIND -> ${FINDS[state.findIndex].name}`);
    }
    for (let guard = 0; guard < 200; guard++) {
      const p = pickPurchase(state);
      if (!p) break;
      const cost = p.cost;
      if (!p.buy()) break;
      bought = true;
      if (VERBOSE && label !== 'obs') console.log(`[${label} ${fmtT(t)}] buy ${p.label} (${cost.toExponential(2)})`);
      while (upgradeFind(state).ok) {
        res.findTimes[state.findIndex] = t;
        if (VERBOSE && label !== 'obs') console.log(`[${label} ${fmtT(t)}] FIND -> ${FINDS[state.findIndex].name}`);
      }
    }
    const anyAffordable = bought || candidates(state).some((c) => c.cost <= state.cash);
    if (!bought && !anyAffordable) { /* dead second */ } else { res.maxPurchaseGap = Math.max(res.maxPurchaseGap, t < 3600 ? idle : 0); }
    if (bought) idle = 0; else idle++;
    if (anyAffordable) gap = 0;
    else {
      gap++;
      if (t < 3600 && gap > res.longestGap) { res.longestGap = gap; res.longestGapAt = t; }
    }
    tick(state, 1, rng);
    t++;
    if (VERBOSE && label !== 'obs' && t % 300 === 0) { const q = computeStats(state); console.log(`[${label} ${fmtT(t)}] SNAP pups=${state.pups.toFixed(0)}/${q.kennelCapacity.toFixed(0)} dig=${q.digPerSec.toFixed(1)} ship=${q.shipPerSec.toFixed(1)} val=${q.findValue.toFixed(2)} inc=${q.incomePerSec.toFixed(1)} cash=${state.cash.toFixed(0)} bn=${q.bottleneck}`); }
    if (t === 3600) res.findAt60 = state.findIndex;
    if (marks.has(t / 60)) res.income[t / 60] = computeStats(state).incomePerSec;
    const g = computeStats(state).prestigeGain;
    if (res.prestigeTime === null && g >= 5) res.prestigeTime = t;
    if (res.rawhideTime === null && state.findIndex >= 3) res.rawhideTime = t;
    if (t >= minSec && res.rawhideTime !== null && (!stopAtPrestige || res.prestigeTime !== null)) break;
  }
  // keep sampling income marks if loop ended early
  res.gain = computeStats(state).prestigeGain;
  return res;
}

function fmtT(sec: number | null): string {
  if (sec === null) return 'n/a';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}m${String(s).padStart(2, '0')}s`;
}
function fmtN(n: number): string {
  if (n >= 1e6) return n.toExponential(2);
  return n.toFixed(n < 10 ? 2 : 0);
}

// Observation run (no prestige): same seed/decisions as run 1, but kept going to 60 min for income samples.
const obs = runOnce(createInitialState(0), seeded(12345), 'obs', true, 3600);
const rng = seeded(12345);
const state = createInitialState(0);
const r1 = runOnce(state, rng, 'run1', true);
// income marks beyond end of loop are unavailable if run ended earlier; fine.
const pr = prestige(state);
const gained = pr.ok ? pr.gained ?? 0 : 0;
const r2 = runOnce(state, rng, 'run2', false);

const minutes = (s: number | null) => (s === null ? null : s / 60);
const speedup = r1.rawhideTime && r2.rawhideTime ? (1 - r2.rawhideTime / r1.rawhideTime) * 100 : null;

interface Row { name: string; value: string; target: string; pass: boolean }
const inRange = (v: number | null, lo: number, hi: number) => v !== null && v >= lo && v <= hi;
const rows: Row[] = [
  { name: 'Tennis Ball (find 1)', value: fmtT(r1.findTimes[1] ?? null), target: '3-6 min', pass: inRange(minutes(r1.findTimes[1] ?? null), 3, 6) },
  { name: 'Squeaky Toy (find 2)', value: fmtT(r1.findTimes[2] ?? null), target: '10-20 min', pass: inRange(minutes(r1.findTimes[2] ?? null), 10, 20) },
  { name: 'Rawhide (find 3)', value: fmtT(r1.rawhideTime), target: '25-45 min', pass: inRange(minutes(r1.rawhideTime), 25, 45) },
  { name: 'Prestige gain >= 5 SP', value: fmtT(r1.prestigeTime), target: '30-60 min', pass: inRange(minutes(r1.prestigeTime), 30, 60) },
  { name: 'Longest idle gap (first 60m)', value: `${r1.longestGap}s @${fmtT(r1.longestGapAt)}`, target: '< 90 s', pass: r1.longestGap < 90 },
  { name: 'Longest gap between buys (info)', value: `${r1.maxPurchaseGap}s`, target: '', pass: true },
  { name: 'Obs: find index @60 min', value: String(obs.findAt60), target: '', pass: true },
  { name: 'Run 2 Rawhide', value: `${fmtT(r2.rawhideTime)} (+${gained} SP)`, target: '', pass: true },
  { name: 'Run 2 speedup vs run 1', value: speedup === null ? 'n/a' : `${speedup.toFixed(1)}%`, target: '>= 30 %', pass: speedup !== null && speedup >= 30 },
];

console.log('\nPaw Park balance report (seed 12345, dt=1s)\n');
const w = [32, 24, 12];
console.log('Milestone'.padEnd(w[0]) + 'Result'.padEnd(w[1]) + 'Target'.padEnd(w[2]) + ' ');
console.log('-'.repeat(76));
for (const r of rows) console.log(r.name.padEnd(w[0]) + r.value.padEnd(w[1]) + r.target.padEnd(w[2]) + ' ' + (r.target ? (r.pass ? 'PASS' : 'FAIL') : ''));
console.log('\nIncome/s: ' + [5, 15, 30, 60].map((m) => `${m}m=${obs.income[m] !== undefined ? fmtN(obs.income[m]) : 'n/a'}`).join('  '));
console.log('Run 1 find times: ' + Object.entries(r1.findTimes).map(([i, t]) => `${i}@${fmtT(t)}`).join('  '));
console.log('Run 2 find times: ' + Object.entries(r2.findTimes).map(([i, t]) => `${i}@${fmtT(t)}`).join('  '));
const allPass = rows.every((r) => r.pass);
console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
