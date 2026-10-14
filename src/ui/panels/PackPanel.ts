import {
  ACADEMY,
  AUTO_PRESTIGE_THRESHOLDS,
  academyCost,
  computeStats,
  formatNumber,
  setAutoPrestigeThreshold,
  setAutomation,
} from '../../core';
import type { AutomationKey } from '../../core';
import type { GameController } from '../GameController';
import { h, setClass, setHidden, setText } from '../dom';
import { section, setBtn, type Panel } from './common';

interface PackDef {
  key: AutomationKey;
  icon: string;
  name: string;
  desc: string;
  /** Academy stat that unlocks it (undefined = free) */
  stat?: 'autoBuild' | 'autoTraining' | 'autoWhistle' | 'autoPrestige';
}

const PACK: PackDef[] = [
  { key: 'find', icon: '\u{1F50D}', name: 'Find Scout', desc: 'Upgrades your find as soon as the park can afford it.' },
  { key: 'build', icon: '\u{1F528}', name: 'Foreman Pup', desc: 'Buys kennel and vehicle upgrades.', stat: 'autoBuild' },
  { key: 'training', icon: '\u{1F393}', name: 'Head Trainer', desc: 'Buys Training levels.', stat: 'autoTraining' },
  { key: 'whistle', icon: '\u{1F4EF}', name: 'Volunteer Walkers', desc: 'Adopt pups from your stock automatically.', stat: 'autoWhistle' },
  { key: 'prestige', icon: '\u{1F3DE}️', name: 'Retirement Planner', desc: 'Opens a new park when the Spirit Paw gain is big enough.', stat: 'autoPrestige' },
];

export function createPackPanel(c: GameController, gotoAcademy: () => void): Panel {
  const el = h('div', { cls: 'panel' });
  const status = h('div', { cls: 'row-meta' });
  el.append(section('\u{1F415}‍\u{1F9BA} The Pack', h('div', { cls: 'row-desc', text: 'Your pups run the park while you are away. Unlock helpers in the Academy, then switch them on or off here.' }), status));

  const rows = PACK.map((def) => {
    const stateEl = h('div', { cls: 'pack-state' });
    const hint = h('div', { cls: 'row-meta' });
    const btn = h('button', { cls: 'btn buy', attrs: { type: 'button' } });
    btn.addEventListener('click', () => {
      const s = c.state;
      if (computeStats(s).automationUnlocked[def.key]) c.check(setAutomation(s, def.key, !s.automation[def.key]));
      else gotoAcademy();
      update();
    });
    const row = h(
      'div',
      { cls: 'row' },
      h('div', { cls: 'row-icon', text: def.icon }),
      h('div', { cls: 'row-main' }, h('div', { cls: 'row-title', text: def.name }), h('div', { cls: 'row-desc', text: def.desc }), stateEl, hint),
      btn,
    );
    el.append(row);
    return { def, row, stateEl, hint, btn };
  });

  // auto-prestige threshold picker
  const segBtns = AUTO_PRESTIGE_THRESHOLDS.map((t) => {
    const b = h('button', {
      cls: 'seg small',
      text: `+${Math.round(t * 100)}%`,
      attrs: { type: 'button' },
      on: {
        click: () => {
          c.check(setAutoPrestigeThreshold(c.state, t));
          update();
        },
      },
    });
    return { t, b };
  });
  const thrCard = h(
    'div',
    { cls: 'card' },
    h('div', { cls: 'row-title', text: 'Auto-prestige threshold' }),
    h('div', { cls: 'row-desc', text: 'Open a new park once it would add at least this many paws (relative to your Spirit Paws).' }),
    h('div', { cls: 'segs' }, ...segBtns.map((x) => x.b)),
    h('div', { cls: 'row-meta', text: 'Shown as +% paws.' }),
  );
  el.append(thrCard);

  function update(): void {
    const s = c.state;
    const d = computeStats(s);
    for (const r of rows) {
      const unlocked = d.automationUnlocked[r.def.key];
      const on = unlocked && s.automation[r.def.key];
      setClass(r.row, 'locked', !unlocked);
      setText(r.stateEl, !unlocked ? '\u{1F512} Locked' : on ? 'On' : 'Off');
      setClass(r.stateEl, 'on', on);
      setClass(r.stateEl, 'off', !on);
      if (unlocked) {
        setText(r.hint, '');
        setHidden(r.hint, true);
        setBtn(r.btn, on ? 'Turn off' : 'Turn on', true);
      } else {
        const item = ACADEMY.find((a) => a.stat === r.def.stat);
        const cost = item ? academyCost(s, item.id) : null;
        setHidden(r.hint, false);
        setText(r.hint, item ? `Unlock: ${item.icon} ${item.name}` + (cost !== null ? ` • \u{1F9B4} ${formatNumber(cost)}` : '') : 'Locked');
        setBtn(r.btn, 'Academy', true);
      }
    }
    const prestigeUnlocked = d.automationUnlocked.prestige;
    for (const x of segBtns) setClass(x.b, 'on', Math.abs(x.t - s.automation.prestigeThreshold) < 1e-9);
    thrCard.style.opacity = prestigeUnlocked ? '' : '0.6';
    const ss = c.session;
    setText(status, `This session: ${ss.autoFinds} auto find upgrade${ss.autoFinds === 1 ? '' : 's'} • ${ss.autoPrestiges} auto prestige${ss.autoPrestiges === 1 ? '' : 's'} • ${ss.houndCatches} hound catch${ss.houndCatches === 1 ? '' : 'es'}`);
  }
  return { el, update };
}
