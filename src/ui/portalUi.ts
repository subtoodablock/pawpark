// Shared bits for the Paw Portal + Dog Show UI: rarity naming, relic art/labels, countdown text.
import { RARITY_NAMES, STONES, familyDef, formatDuration, parseStoneKey, relicEffect } from '../core';
import type { Relic, RelicRarity } from '../core';
import { artImg } from './gameArt';
import { statLabel } from './labels';

export const RARITY_CLASS = ['common', 'rare', 'epic', 'legendary'] as const;
const ROMAN = ['I', 'II', 'III', 'IV'];

export const rarityName = (r: number): string => RARITY_NAMES[r] ?? 'Common';
export const tierLabel = (t: number): string => `T${t + 1}`;
export const roman = (t: number): string => ROMAN[t] ?? String(t + 1);

type RelicLike = Pick<Relic, 'family' | 'tier' | 'rarity'>;

/** "Legendary Bacon Prism" */
export function relicTitle(r: RelicLike): string {
  return `${rarityName(r.rarity)} ${familyDef(r.family)?.name ?? r.family}`;
}

/** "+25% dig rate" */
export function relicEffectText(r: RelicLike): string {
  const fam = familyDef(r.family);
  return fam ? statLabel(fam.stat, relicEffect(r)) : '';
}

export function relicImg(r: RelicLike, px: number, cls = ''): HTMLImageElement {
  return artImg('relic', `${r.family}:${r.tier}:${r.rarity}`, px, cls);
}

export function relicArtKey(r: RelicLike): string {
  return `${r.family}:${r.tier}:${r.rarity}`;
}

export function stoneImg(key: string, px: number, cls = ''): HTMLImageElement {
  const p = parseStoneKey(key);
  return artImg('stone', p ? `${p.id}:${p.tier}` : 'x:0', px, cls);
}

export function stoneName(key: string): string {
  const p = parseStoneKey(key);
  if (!p) return 'Stone';
  return `${STONES.find((s) => s.id === p.id)?.name ?? p.id} ${roman(p.tier)}`;
}

/** "+3% dig rate" for a socketed stone key */
export function stoneEffectText(key: string): string {
  const p = parseStoneKey(key);
  const def = p ? STONES.find((s) => s.id === p.id) : undefined;
  return p && def ? statLabel(def.stat, def.effect[p.tier] ?? 0) : '';
}

/** Countdown text for a number of milliseconds: "3d 04h", "2h 05m", "4m 09s". */
export function countdown(ms: number): string {
  return formatDuration(Math.max(0, Math.ceil(ms / 1000)));
}

export const asRarity = (n: number): RelicRarity => Math.max(0, Math.min(3, n)) as RelicRarity;
