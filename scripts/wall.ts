/* Paw Park "wall table" (docs/04 §7). Run with `npx tsx scripts/wall.ts [--maxlog 15] [--step 1]`.
 * For an earnings bonus B, runs ONE fully-automated park (no prestige) offline for 1, 3 and 7 days and
 * reports the highest find reached, the plateau income and the plateau park value.
 * It answers: "how far does a single run get for a given bonus?" -- the core pacing lever. */
import {
  applyOfflineProgress, computeStats, createInitialState, FINDS,
} from '../src/core/index';
import type { GameState } from '../src/core/index';

const argv = process.argv.slice(2);
const flag = (n: string, d: number) => {
  const i = argv.indexOf(n);
  return i >= 0 ? Number(argv[i + 1]) : d;
};
const MAX_LOG = flag('--maxlog', 15);
const STEP = flag('--step', 1);
/** --find f: hold the find at index f (gates beyond it disabled) so the table shows X(B) = parkValue / value_f */
const HOLD = flag('--find', -1);
if (HOLD >= 0) for (let i = HOLD + 1; i < FINDS.length; i++) FINDS[i].unlockParkValue = Infinity;

let seed = 777;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Sets spiritPaws (no collars) so that computeStats(state).earningsBonus ~= B. */
function injectBonus(state: GameState, B: number): void {
  if (B <= 1) { state.spiritPaws = 0; return; }
  let lo = 0;
  let hi = 1;
  state.spiritPaws = hi;
  while (computeStats(state).earningsBonus < B) { hi *= 2; state.spiritPaws = hi; }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    state.spiritPaws = mid;
    if (computeStats(state).earningsBonus < B) lo = mid; else hi = mid;
  }
  state.spiritPaws = hi;
}

function freshAutomated(B: number): GameState {
  const s = createInitialState(0);
  s.lastSaved = 0;
  s.academy.foreman_pup = 1;
  s.academy.head_trainer = 1;
  s.academy.volunteer_walkers = 5;
  s.academy.bigger_jar = 20; // 48 h cap
  s.automation.build = true;
  s.automation.training = true;
  s.automation.whistle = true;
  s.automation.prestige = false;
  injectBonus(s, B);
  if (HOLD >= 0) { s.findIndex = HOLD; s.highestFindIndex = HOLD; }
  return s;
}

const DAYS = [1, 3, 7];
const l10 = (n: number) => Math.log10(Math.max(n, 1e-9));
console.log('Wall table: one automated park, no prestige, offline simulation\n');
console.log('log10 B | ' + DAYS.map((d) => `${d}d: find (log10 inc / log10 parkValue)`.padEnd(40)).join(' | '));
console.log('-'.repeat(140));
for (let b = 0; b <= MAX_LOG; b += STEP) {
  const s = freshAutomated(Math.pow(10, b));
  const cells: string[] = [];
  let tDone = 0;
  for (const d of DAYS) {
    while (tDone < d * 86400) {
      const step = Math.min(24 * 3600, d * 86400 - tDone);
      tDone += step;
      applyOfflineProgress(s, tDone * 1000);
    }
    const c = computeStats(s);
    cells.push(`${String(s.findIndex).padStart(2)} ${FINDS[s.findIndex].name.padEnd(13)} (${l10(c.incomePerSec).toFixed(1)} / ${l10(c.parkValue).toFixed(1)})`.padEnd(40));
  }
  console.log(`${String(b).padStart(7)} | ` + cells.join(' | '));
}
