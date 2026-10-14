// Relic + stone stat folding. Kept free of imports from ./stats so stats.ts can use it.
import type { GameState, Relic, Stat } from './types';
import { RELIC_FAMILIES, RELIC_STATS, STONES } from '../data/portal';

const FAMILY_BY_ID = new Map(RELIC_FAMILIES.map((f) => [f.id, f]));
const STONE_BY_ID = new Map(STONES.map((s) => [s.id, s]));
const PORTAL_STAT_SET = new Set<Stat>([...RELIC_STATS, ...STONES.map((s) => s.stat)]);
/** `${stoneId}:${tier}` -> its stat and effect */
const STONE_KEY = new Map<string, { stat: Stat; effect: number }>();
for (const s of STONES) s.effect.forEach((e, t) => STONE_KEY.set(`${s.id}:${t}`, { stat: s.stat, effect: e }));

export const familyDef = (id: string) => FAMILY_BY_ID.get(id);
export const stoneDef = (id: string) => STONE_BY_ID.get(id);
export const isStoneKey = (key: string): boolean => STONE_KEY.has(key);
export const stoneKeyInfo = (key: string) => STONE_KEY.get(key);
export const stoneKey = (id: string, tier: number) => `${id}:${tier}`;
export function parseStoneKey(key: string): { id: string; tier: number } | null {
  if (!STONE_KEY.has(key)) return null;
  const i = key.lastIndexOf(':');
  return { id: key.slice(0, i), tier: Number(key.slice(i + 1)) };
}

/** Effect of the relic itself (not its stones): +fraction for mult stats, amount for add stats. */
export function relicEffect(relic: Pick<Relic, 'family' | 'tier' | 'rarity'>): number {
  return FAMILY_BY_ID.get(relic.family)?.effect[relic.tier]?.[relic.rarity] ?? 0;
}

/**
 * Folds equipped relics and their stones into a stat accumulator.
 * mult stats: acc x (1 + effect) per source; add stats: acc + effect.
 */
export function applyPortalStat(state: GameState, stat: Stat, acc: number, mult: boolean): number {
  const portal = state.portal;
  if (!portal || !PORTAL_STAT_SET.has(stat)) return acc;
  for (const id of portal.equipped) {
    if (id === null || id === undefined) continue;
    const relic = portal.relics.find((r) => r.id === id);
    if (!relic) continue;
    const fam = FAMILY_BY_ID.get(relic.family);
    if (fam && fam.stat === stat) {
      const e = fam.effect[relic.tier]?.[relic.rarity] ?? 0;
      acc = mult ? acc * (1 + e) : acc + e;
    }
    for (const k of relic.stones) {
      const info = STONE_KEY.get(k);
      if (info && info.stat === stat) acc = mult ? acc * (1 + info.effect) : acc + info.effect;
    }
  }
  return acc;
}
