import { FINDS, formatMoney, formatNumber, nextFind, upgradeFind } from '../core';
import type { GameState } from '../core';
import type { GameController } from './GameController';
import { h } from './dom';
import { artImg } from './gameArt';
import { icon } from './icons';
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
  return f ? `${f.name} Era` : 'Era';
}

const RESETS = ['Cash', 'Pups', 'Kennels', 'Fleet', 'Training'];
const KEEPS = ['Spirit Paws', 'Golden Bones', 'Academy', 'Pup Stars', 'Streak'];

/** Confirm modal for the manual Find upgrade (starts the next era). */
export function confirmEraUpgrade(c: GameController, onDone?: () => void): void {
  const s = c.home;
  const nf = nextFind(s);
  if (!nf) return;
  const cur = FINDS[s.findIndex];
  const valueMult = cur && cur.value > 0 ? nf.value / cur.value : 1;
  const startIndex = s.findIndex;
  const list = (items: string[], keep: boolean): HTMLElement =>
    h(
      'ul',
      { cls: 'era-list' },
      ...items.map((t) => h('li', null, keep ? icon('check-bold', { size: 14, color: 'var(--green)' }) : icon('arrow-counter-clockwise-bold', { size: 14, color: 'var(--red)' }), h('span', { text: t }))),
    );
  showModal(
    `Start the ${nf.name} Era?`,
    [
      h('div', { cls: 'era-art' }, artImg('find', s.findIndex + 1, 96)),
      h(
        'div',
        { cls: 'era-stats' },
        h('div', { cls: 'era-stat good' }, h('b', { text: `×${formatRatio(valueMult)}` }), h('span', { text: 'Find value' }), cur ? h('small', { text: `${formatMoney(cur.value)} → ${formatMoney(nf.value)} each` }) : null),
      ),
      h(
        'div',
        { cls: 'era-cols' },
        h('div', { cls: 'era-col reset' }, h('h3', { text: 'Resets' }), list(RESETS, false)),
        h('div', { cls: 'era-col keep' }, h('h3', { text: 'Keeps' }), list(KEEPS, true)),
      ),
    ],
    [
      { label: 'Not yet' },
      {
        label: 'Confirm',
        primary: true,
        onClick: () => {
          // automation (or another panel) may have started this era while the modal was open:
          // close quietly and just refresh, no error toast
          if (c.home.findIndex !== startIndex) {
            onDone?.();
            return;
          }
          const name = nf.name;
          if (c.check(upgradeFind(c.home))) {
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

/** 0..1 log-scale progress from the current Find's gate to the next one (same curve as the HUD ring). */
export function eraProgress(s: GameState, parkValue: number): number {
  const nf = nextFind(s);
  if (!nf) return 1;
  if (parkValue >= nf.unlockParkValue) return 1;
  const cur = Math.max(1, FINDS[s.findIndex]?.unlockParkValue ?? 1);
  const next = Math.max(cur * 1.0001, nf.unlockParkValue);
  const frac = (Math.log(Math.max(1, parkValue)) - Math.log(cur)) / (Math.log(next) - Math.log(cur));
  return Math.max(0, Math.min(1, frac));
}
