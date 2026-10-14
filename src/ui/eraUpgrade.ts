import { FINDS, formatNumber, nextFind, upgradeFind } from '../core';
import type { GameController } from './GameController';
import { h } from './dom';
import { confetti } from './fx/confetti';
import { showModal } from './Modal';
import { toast } from './Toasts';

/** "5", "4.6", "1.2k": short ×N text for ratios. */
export function formatRatio(n: number): string {
  if (!Number.isFinite(n)) return '?';
  if (n >= 100) return formatNumber(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

export function eraName(i: number): string {
  const f = FINDS[i];
  return f ? `${f.icon} ${f.name} Era` : 'Era';
}

const RESETS = ['Cash', 'Pups', 'Kennels', 'Fleet', 'Training'];
const KEEPS = ['Spirit Paws', 'Golden Bones', 'Academy', 'Pup Stars', 'Streak'];

/** Confirm modal for the manual Find upgrade (starts the next era). */
export function confirmEraUpgrade(c: GameController, onDone?: () => void): void {
  const s = c.state;
  const nf = nextFind(s);
  if (!nf) return;
  const cur = FINDS[s.findIndex];
  const valueMult = cur && cur.value > 0 ? nf.value / cur.value : 1;
  const priceMult = cur && cur.costScale > 0 ? nf.costScale / cur.costScale : nf.costScale;
  const list = (items: string[], mark: string): HTMLElement =>
    h('ul', { cls: 'era-list' }, ...items.map((t) => h('li', null, h('i', { text: mark }), h('span', { text: t }))));
  showModal(
    `Start the ${nf.icon} ${nf.name} Era?`,
    [
      h(
        'div',
        { cls: 'era-stats' },
        h('div', { cls: 'era-stat good' }, h('b', { text: `×${formatRatio(valueMult)}` }), h('span', { text: 'Find value' })),
        h('div', { cls: 'era-stat warn' }, h('b', { text: `×${formatRatio(priceMult)}` }), h('span', { text: 'Prices' })),
      ),
      h(
        'div',
        { cls: 'era-cols' },
        h('div', { cls: 'era-col reset' }, h('h3', { text: 'Resets' }), list(RESETS, '↺')),
        h('div', { cls: 'era-col keep' }, h('h3', { text: 'Keeps' }), list(KEEPS, '✓')),
      ),
    ],
    [
      { label: 'Not yet' },
      {
        label: 'Confirm',
        primary: true,
        onClick: () => {
          const name = `${nf.icon} ${nf.name}`;
          if (c.check(upgradeFind(c.state))) {
            toast(`Welcome to the ${name} Era!`, 'gold', 5000);
            confetti({ y: window.innerHeight * 0.3, count: 90, power: 0.9 });
            c.save();
            onDone?.();
          }
        },
      },
    ],
  );
}
