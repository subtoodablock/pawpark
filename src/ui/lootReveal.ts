// Loot reveal: relic cards flip in one by one with a glow by rarity; a Legendary gets confetti.
import type { Relic } from '../core';
import { familyDef, parseStoneKey } from '../core';
import { h } from './dom';
import { confetti } from './fx/confetti';
import { rich } from './icons';
import { reducedMotion } from './motion';
import { showModal } from './Modal';
import { RARITY_CLASS, rarityName, relicEffectText, relicImg, stoneImg, stoneName, tierLabel } from './portalUi';

export interface LootBundle {
  relics: Relic[];
  stones?: string[];
  goldenBones?: number;
}

function card(r: Relic, i: number): { el: HTMLElement; flip: () => void } {
  const fam = familyDef(r.family);
  const front = h(
    'div',
    { cls: 'loot-face front' },
    h('div', { cls: 'loot-art' }, relicImg(r, 72)),
    h('div', { cls: 'loot-name', text: fam?.name ?? r.family }),
    h('div', { cls: 'loot-eff', text: relicEffectText(r) }),
    h('div', { cls: 'loot-rar' }, h('b', { text: rarityName(r.rarity) }), h('span', { text: tierLabel(r.tier) })),
  );
  const back = h('div', { cls: 'loot-face back' }, h('span', { cls: 'loot-back-mark' }, ...rich('{spiral}', 34)));
  const el = h('div', { cls: `loot-card ${RARITY_CLASS[r.rarity]}`, style: `--i:${i}` }, h('div', { cls: 'loot-inner' }, back, front));
  return { el, flip: () => el.classList.add('flipped') };
}

/** Shows the reveal modal. Resolves nothing; the loot is already in the save. */
export function showLootReveal(loot: LootBundle, title = 'Expedition loot'): void {
  const relics = [...loot.relics].sort((a, b) => a.rarity - b.rarity || a.tier - b.tier);
  const cards = relics.map((r, i) => card(r, i));
  const extras: HTMLElement[] = [];
  const stoneCounts = new Map<string, number>();
  for (const k of loot.stones ?? []) stoneCounts.set(k, (stoneCounts.get(k) ?? 0) + 1);
  for (const [k, n] of stoneCounts) {
    if (!parseStoneKey(k)) continue;
    extras.push(h('div', { cls: 'loot-extra' }, stoneImg(k, 30), h('span', { text: `${stoneName(k)}${n > 1 ? ` ×${n}` : ''}` })));
  }
  if ((loot.goldenBones ?? 0) > 0) extras.push(h('div', { cls: 'loot-extra' }, ...rich(`+${loot.goldenBones} {bone}`, 24), h('span', { text: 'Golden Bones' })));
  const extrasEl = h('div', { cls: 'loot-extras' }, ...extras);
  const grid = h('div', { cls: `loot-grid n${Math.min(3, Math.max(1, cards.length))}` }, ...cards.map((c) => c.el));
  const body = [grid, extras.length ? extrasEl : null];
  if (!relics.length) body.unshift(h('p', { cls: 'muted', text: 'No relics this time, but the crew brought something home.' }));

  showModal(title, body, [{ label: 'Nice!', primary: true }], { tone: 'purple' });

  // flip one by one (calm: 380 ms each, 330 ms apart); Legendary raises confetti as it turns.
  // The modal may be queued behind another one, so wait until it is actually on screen.
  const fast = reducedMotion();
  const step = fast ? 0 : 330;
  const first = fast ? 0 : 380;
  const run = (): void => {
    cards.forEach((c, i) => {
      window.setTimeout(() => {
        if (!c.el.isConnected) return;
        c.flip();
        if (relics[i].rarity === 3) {
          const r = c.el.getBoundingClientRect();
          window.setTimeout(() => confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 90, power: 0.9 }), fast ? 0 : 260);
        }
      }, first + i * step);
    });
    window.setTimeout(() => extrasEl.classList.add('on'), first + cards.length * step + 200);
  };
  let waited = 0;
  const poll = window.setInterval(() => {
    waited += 100;
    if (grid.isConnected) {
      window.clearInterval(poll);
      run();
    } else if (waited > 120_000) window.clearInterval(poll);
  }, 100);
}
