import {
  FINDS,
  clearSave,
  computeStats,
  exportSave,
  formatDuration,
  formatMoney,
  formatNumber,
  importSave,
  nextFind,
} from '../../core';
import type { GameController } from '../GameController';
import { h, meter, setClass, setDisabled, setHidden, setMeter, setText } from '../dom';
import { showModal } from '../Modal';
import { toast } from '../Toasts';
import { confirmPrestige, prestigeSummary } from '../prestige';
import { createShareCard } from '../share';
import { getDayNight, setDayNight } from '../prefs';
import { section, type Panel } from './common';

export function createParkPanel(c: GameController, openFind: () => void): Panel {
  const el = h('div', { cls: 'panel' });

  // ---- current find / next era: the full carousel lives in the Find panel
  const nfDisc = h('div', { cls: 'find-disc mini' }, h('span', { cls: 'find-disc-ico' }));
  const nfIcon = nfDisc.firstElementChild as HTMLElement;
  const nfTitle = h('div', { cls: 'row-title' });
  const nfDesc = h('div', { cls: 'row-desc' });
  const nfMeter = meter('find-progress');
  const nfBtn = h('button', { cls: 'btn', text: 'Open Finds \u2192', attrs: { type: 'button' }, on: { click: () => openFind() } });
  const nfCard = h('div', { cls: 'card find-mini' }, h('div', { cls: 'find-mini-row' }, nfDisc, h('div', { cls: 'row-main' }, nfTitle, nfDesc)), nfMeter.el, nfBtn);
  el.append(section('\u{1F9B4} Finds', nfCard));

  const shareCard = createShareCard(c);
  el.append(section('\u{1F4E4} Share', shareCard.el));

  // ---- prestige
  const prInfo = h('div', { cls: 'row-desc' });
  const prBonus = h('div', { cls: 'row-meta' });
  const prBtn = h('button', { cls: 'btn primary', on: { click: () => confirmPrestige(c) } });
  el.append(section('\u{1F3DE}\uFE0F Open a New Park', h('div', { cls: 'card' }, prInfo, prBonus, prBtn)));

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
  const dnInput = h('input', { attrs: { type: 'checkbox' } });
  dnInput.checked = getDayNight();
  dnInput.addEventListener('change', () => setDayNight(dnInput.checked));
  const dnRow = h('label', { cls: 'pref-row' }, h('span', { text: 'Day/night follows your clock' }), dnInput);
  el.append(section('⚙️ Settings', dnRow, box, h('div', { cls: 'btn-row' }, exportBtn, importBtn, resetBtn)));

  function update(): void {
    const s = c.state;
    const d = computeStats(s);

    // current find + progress to the next era
    const cf = FINDS[s.findIndex];
    const nf = nextFind(s);
    setText(nfIcon, cf?.icon ?? '');
    setText(nfTitle, `${cf?.name ?? '?'} Era`);
    if (nf) {
      const ready = d.parkValue >= nf.unlockParkValue;
      setText(nfDesc, ready ? `${nf.icon} ${nf.name} is ready to dig!` : `Next: ${nf.icon} ${nf.name} at Park Value ${formatMoney(nf.unlockParkValue)}`);
      setMeter(nfMeter, nf.unlockParkValue > 0 ? d.parkValue / nf.unlockParkValue : 1);
      setHidden(nfMeter.el, false);
    } else {
      setText(nfDesc, 'Every find discovered!');
      setHidden(nfMeter.el, true);
    }

    shareCard.update();

    // prestige
    const pr = prestigeSummary(c);
    setText(prInfo, pr.line);
    setText(prBonus, `Earnings bonus: ×${formatNumber(pr.now)} → ×${formatNumber(pr.after)}  •  run earnings ${formatMoney(s.runEarnings)}`);
    setText(prBtn, pr.gain >= 1 ? `Open a New Park (+${formatNumber(pr.gain)} \u{1F43E})` : 'Not enough yet');
    setDisabled(prBtn, pr.gain < 1);

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
