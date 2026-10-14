import { FINDS, computeStats, formatMoney, formatNumber, prestige } from '../core';
import type { GameController } from './GameController';
import { h } from './dom';
import { confetti } from './fx/confetti';
import { showModal } from './Modal';
import { toast } from './Toasts';

export interface PrestigeSummary {
  gain: number;
  /** earnings bonus now / after prestiging */
  now: number;
  after: number;
  pctGain: number;
  runEarnings: number;
  /** "Back to the 🪵 Stick Era with +N Spirit Paws (+X% earnings)" */
  line: string;
}

export function prestigeSummary(c: GameController): PrestigeSummary {
  const s = c.state;
  const d = computeStats(s);
  const gain = d.prestigeGain;
  const after = 1 + (s.spiritPaws + gain) * d.pawBonus * d.collarMult;
  const pctGain = d.earningsBonus > 0 ? Math.round((after / d.earningsBonus - 1) * 100) : 0;
  const stick = FINDS[0];
  const line =
    gain >= 1
      ? `Back to the ${stick?.icon ?? ''} ${stick?.name ?? 'Stick'} Era with +${formatNumber(gain)} Spirit Paws (+${formatNumber(pctGain)}% earnings)`
      : 'Earn more this run to gain Spirit Paws.';
  return { gain, now: d.earningsBonus, after, pctGain, runEarnings: s.runEarnings, line };
}

/** Confirm + perform a prestige ("Open a New Park"). */
export function confirmPrestige(c: GameController): void {
  const d = computeStats(c.state);
  showModal(
    'Open a New Park?',
    [
      h('p', { text: `You will gain ${formatNumber(d.prestigeGain)} Spirit Paws \u{1F43E}.` }),
      h('p', { text: 'Your cash, pups, kennels, fleet, finds and Training reset. Golden Bones, Academy, Spirit Paws, Legend Collars and trophies are kept.' }),
    ],
    [
      { label: 'Not yet' },
      {
        label: 'Open it!',
        primary: true,
        onClick: () => {
          const r = prestige(c.state);
          if (c.check(r)) {
            toast(`\u{1F43E} New park opened! +${formatNumber(r.gained ?? 0)} Spirit Paws`, 'gold', 5000);
            confetti();
            c.save();
          }
        },
      },
    ],
  );
}

/** The prestige "info card" opened by the purple bar in the Find panel. */
export function showPrestigeInfo(c: GameController): void {
  const p = prestigeSummary(c);
  const stick = FINDS[0];
  const body = [
    h('p', {
      text:
        p.gain >= 1
          ? `Back to the ${stick?.icon ?? ''} ${stick?.name ?? 'Stick'} Era with +${formatNumber(p.gain)} Spirit Paws (+${formatNumber(p.pctGain)}% earnings). Spirit Paws are earned from everything you sold this prestige.`
          : `Open a new park to go back to the ${stick?.icon ?? ''} ${stick?.name ?? 'Stick'} Era and earn Spirit Paws from everything you sold this prestige. Earn a bit more first.`,
    }),
    h(
      'ul',
      { cls: 'report-list' },
      h('li', null, h('span', { text: 'Earnings bonus' }), h('b', { text: `×${formatNumber(p.now)} → ×${formatNumber(p.after)}` })),
      h('li', null, h('span', { text: 'Sold this prestige' }), h('b', { text: formatMoney(p.runEarnings) })),
    ),
  ];
  showModal(
    '\u{1F43E} Prestige',
    body,
    p.gain >= 1
      ? [{ label: 'Close' }, { label: `Open a New Park`, primary: true, onClick: () => confirmPrestige(c) }]
      : [{ label: 'Got it', primary: true }],
  );
}
