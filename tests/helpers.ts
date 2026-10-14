import { FINDS, createInitialState } from '../src/core';
import type { GameState, Rng } from '../src/core';

export function newState(): GameState {
  return createInitialState(1_000_000);
}

/** Deterministic seeded RNG (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function constRng(...values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

export function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const ORIGINAL_GATES = FINDS.map((f) => f.unlockParkValue);
/** Test isolation: disable Find upgrades (module state is per test file). */
export function lockGates(): void {
  for (let i = 1; i < FINDS.length; i++) FINDS[i].unlockParkValue = Infinity;
}
export function restoreGates(): void {
  FINDS.forEach((f, i) => (f.unlockParkValue = ORIGINAL_GATES[i]));
}
