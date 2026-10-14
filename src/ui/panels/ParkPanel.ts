import {
  FINDS,
  TROPHIES,
  clearSave,
  computeStats,
  exportSave,
  formatDuration,
  formatMoney,
  formatNumber,
  importSave,
  nextFind,
  prestige,
  upgradeFind,
} from '../../core';
import type { TrophyDef, TrophyKind } from '../../core';
import type { GameController } from '../GameController';
import { h, meter, setClass, setDisabled, setHidden, setMeter, setText } from '../dom';
import { showModal } from '../Modal';
import { toast } from '../Toasts';
import { burst } from '../motion';
import { confetti } from '../fx/confetti';
import { createShareCard } from '../share';
import { section, type Panel } from './common';

export function createParkPanel(c: GameController): Panel {
  const el = h('div', { cls: 'panel' });

  // ---- next find card
  const nfTitle = h('div', { cls: 'row-title' });
  const nfDesc = h('div', { cls: 'row-desc' });
  const nfMeter = meter('find-progress');
  const nfLabel = h('div', { cls: 'row-meta' });
  const nfBtn = h('button', {
    cls: 'btn primary',
    text: 'Upgrade find!',
    on: {
      click: () => {
        if (c.check(upgradeFind(c.state))) burst(nfBtn, 'coins', 10);
        update();
      },
    },
  });
  const nfCard = h('div', { cls: 'card' }, nfTitle, nfDesc, nfMeter.el, nfLabel, nfBtn);
  const ladder = FINDS.map((f, i) => {
    const meta = h('span', { cls: 'row-meta' });
    const row = h('div', { cls: 'ladder-row' }, h('span', { cls: 'ladder-icon', text: f.icon }), h('span', { cls: 'ladder-name', text: f.name }), meta);
    return { i, row, meta, f };
  });
  el.append(section('\u{1F9B4} Finds', nfCard, h('div', { cls: 'ladder' }, ...ladder.map((l) => l.row))));

  const shareCard = createShareCard(c);
  el.append(section('\u{1F4E4} Share', shareCard.el));

  // ---- prestige
  const prInfo = h('div', { cls: 'row-desc' });
  const prBonus = h('div', { cls: 'row-meta' });
  const prBtn = h('button', { cls: 'btn primary', on: { click: () => confirmPrestige() } });
  el.append(section('\u{1F3DE}️ Open a New Park', h('div', { cls: 'card' }, prInfo, prBonus, prBtn)));

  function confirmPrestige(): void {
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

  // ---- trophies
  const KIND_TITLES: Record<TrophyKind, string> = {
    pups: '\u{1F415} Pups',
    lifetimeEarnings: '\u{1F4B0} Lifetime earnings',
    prestiges: '\u{1F3DE}️ Parks opened',
    find: '\u{1F9B4} Finds',
  };
  function thresholdLabel(t: TrophyDef): string {
    switch (t.kind) {
      case 'pups':
        return `${formatNumber(t.threshold)} pups`;
      case 'lifetimeEarnings':
        return `${formatMoney(t.threshold)} earned`;
      case 'prestiges':
        return `${formatNumber(t.threshold)} park${t.threshold === 1 ? '' : 's'}`;
      case 'find': {
        const f = FINDS[t.threshold];
        return f ? `${f.icon} ${f.name}` : `Find #${t.threshold + 1}`;
      }
    }
  }
  function rewardLabel(t: TrophyDef): string {
    const parts: string[] = [];
    if (t.collars > 0) parts.push(`+${t.collars}\u{1F3F7}️`);
    if (t.goldenBones > 0) parts.push(`+${formatNumber(t.goldenBones)}\u{1F9B4}`);
    return parts.join(' ');
  }
  const trophyEls = TROPHIES.map((t) => {
    const e = h(
      'div',
      { cls: 'trophy' },
      h('div', { cls: 'trophy-icon', text: t.icon }),
      h('div', { cls: 'trophy-name', text: t.name }),
      h('div', { cls: 'row-meta', text: thresholdLabel(t) }),
      h('div', { cls: 'row-meta', text: rewardLabel(t) }),
    );
    return { t, e };
  });
  const collars = h('div', { cls: 'row-meta' });
  const trophyGroups: Node[] = [];
  for (const kind of ['pups', 'lifetimeEarnings', 'prestiges', 'find'] as TrophyKind[]) {
    const items = trophyEls.filter((x) => x.t.kind === kind).sort((x, y) => x.t.threshold - y.t.threshold);
    if (!items.length) continue;
    trophyGroups.push(h('div', { cls: 'trophy-group', text: KIND_TITLES[kind] }), h('div', { cls: 'trophies' }, ...items.map((x) => x.e)));
  }
  el.append(section('\u{1F3C6} Trophies', collars, ...trophyGroups));

  // ---- stats
  const statsList = h('div', { cls: 'stats' });
  const statKeys = ['Pups adopted', 'Whistle taps', 'Squirrels caught', 'Mail opened', 'Time played', 'Run earnings', 'Lifetime earnings', 'Parks opened', 'Legend Collars', 'Collar multiplier'];
  const statVals = statKeys.map((k) => {
    const v = h('b');
    statsList.append(h('div', { cls: 'stat-line' }, h('span', { text: k }), v));
    return v;
  });
  el.append(section('\u{1F4CA} Stats', statsList));

  // ---- settings
  const box = h('textarea', { cls: 'save-box', attrs: { rows: '3', placeholder: 'Export appears here; paste a save here to import', spellcheck: 'false' } });
  const exportBtn = h('button', {
    cls: 'btn',
    text: 'Export save',
    on: {
      click: () => {
        c.save();
        box.value = exportSave(c.state);
        box.select();
        const nav = navigator.clipboard;
        if (nav?.writeText) nav.writeText(box.value).then(() => toast('Save copied to clipboard', 'good'), () => toast('Save exported below. Copy it manually.', 'info'));
        else toast('Save exported below. Copy it manually.', 'info');
      },
    },
  });
  const importBtn = h('button', {
    cls: 'btn',
    text: 'Import save',
    on: {
      click: () => {
        const text = box.value.trim();
        const s = text ? importSave(text) : null;
        if (!s) {
          toast('That save could not be read.', 'warn');
          return;
        }
        showModal('Import save?', [h('p', { text: 'This replaces your current game.' })], [
          { label: 'Cancel' },
          {
            label: 'Import',
            primary: true,
            onClick: () => {
              c.setState(s);
              toast('Save imported!', 'good');
            },
          },
        ]);
      },
    },
  });
  const resetBtn = h('button', {
    cls: 'btn danger',
    text: 'Hard reset',
    on: {
      click: () =>
        showModal('Erase everything?', [h('p', { text: 'This deletes your save permanently, including Golden Bones, Spirit Paws and trophies.' })], [
          { label: 'Keep playing' },
          {
            label: 'Erase all',
            danger: true,
            onClick: () => {
              c.suppressSave = true;
              clearSave(localStorage);
              location.reload();
            },
          },
        ]),
    },
  });
  el.append(section('⚙️ Settings', box, h('div', { cls: 'btn-row' }, exportBtn, importBtn, resetBtn)));

  function update(): void {
    const s = c.state;
    const d = computeStats(s);

    // next find
    const nf = nextFind(s);
    setHidden(nfCard, false);
    if (nf) {
      const ready = d.parkValue >= nf.unlockParkValue;
      setText(nfTitle, `Next: ${nf.icon} ${nf.name} (${formatMoney(nf.value)} each)`);
      setText(nfDesc, nf.flavor);
      setMeter(nfMeter, nf.unlockParkValue > 0 ? d.parkValue / nf.unlockParkValue : 1);
      setText(nfLabel, `Park value ${formatMoney(d.parkValue)} / ${formatMoney(nf.unlockParkValue)}` + (s.highestFindIndex < s.findIndex + 1 ? ` • first time: +${nf.unlockReward} \u{1F9B4}` : ''));
      setDisabled(nfBtn, !ready);
      setHidden(nfBtn, false);
    } else {
      setText(nfTitle, 'Every find unlocked!');
      setText(nfDesc, 'You are digging up the cosmos itself.');
      setMeter(nfMeter, 1);
      setText(nfLabel, '');
      setHidden(nfBtn, true);
    }
    for (const l of ladder) {
      const cur = l.i === s.findIndex;
      const seen = l.i <= s.highestFindIndex;
      setClass(l.row, 'current', cur);
      setClass(l.row, 'unseen', !seen && !cur);
      setText(l.meta, cur ? 'current' : seen ? `${formatMoney(l.f.value)}` : `Park ${formatMoney(l.f.unlockParkValue)}`);
    }

    shareCard.update();

    // prestige
    const gain = d.prestigeGain;
    const after = 1 + (s.spiritPaws + gain) * d.pawBonus * d.collarMult;
    setText(prInfo, gain >= 1 ? `Start fresh and earn +${formatNumber(gain)} Spirit Paws \u{1F43E}.` : 'Earn more this run to gain Spirit Paws.');
    setText(prBonus, `Earnings bonus: ×${formatNumber(d.earningsBonus)} → ×${formatNumber(after)}  •  run earnings ${formatMoney(s.runEarnings)}`);
    setText(prBtn, gain >= 1 ? `Open a New Park (+${formatNumber(gain)} \u{1F43E})` : 'Not enough yet');
    setDisabled(prBtn, gain < 1);

    // trophies
    setText(collars, `Legend Collars: ${s.legendCollars} (×${d.collarMult.toFixed(3)} paw bonus)`);
    for (const { t, e } of trophyEls) setClass(e, 'owned', s.trophies.includes(t.id));

    // stats
    const vals = [
      formatNumber(s.stats.totalAdopted),
      formatNumber(s.stats.totalTaps),
      formatNumber(s.stats.squirrelsCaught),
      formatNumber(s.stats.mailOpened),
      formatDuration(s.stats.totalPlaySec),
      formatMoney(s.runEarnings),
      formatMoney(s.lifetimeEarnings),
      formatNumber(s.prestigeCount),
      formatNumber(s.legendCollars),
      '×' + d.collarMult.toFixed(3),
    ];
    vals.forEach((v, i) => setText(statVals[i], v));
  }
  return { el, update };
}
