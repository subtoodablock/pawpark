import type { DayKey, Rng } from './types';

const pad2 = (n: number) => String(n).padStart(2, '0');
const DAY_MS = 86_400_000;
export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as 'YYYY-MM-DD'. */
export function dayKeyOf(date: Date): DayKey {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function utcOf(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole calendar days from a to b (b - a). DST-safe because it uses UTC midnights. */
export function dayDiff(a: DayKey, b: DayKey): number {
  return Math.round((utcOf(b) - utcOf(a)) / DAY_MS);
}

/** FNV-1a 32-bit string hash. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
