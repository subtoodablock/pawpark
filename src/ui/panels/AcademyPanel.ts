import { ACADEMY, TREATS, academyCost, buyAcademy, buyTreat, formatDuration, formatNumber } from '../../core';
import type { GameController } from '../GameController';
import { h, setText } from '../dom';
import { statLabel } from '../labels';
import { makeRow, setBtn, type Panel } from './common';

export function createAcademyPanel(c: GameController): Panel {
  const el = h('div', { cls: 'panel' });
  el.append(h('h3', { text: '\u{1F393} Academy (permanent, paid in \u{1F9B4})' }));
  const acRows = ACADEMY.map((def) => {
    const row = makeRow(def.icon, def.name, () => {
      c.check(buyAcademy(c.state, def.id));
      update();
    });
    el.append(row.el);
    return { def, row };
  });
  el.append(h('h3', { text: '\u{1F356} Treats (timed boosts)' }));
  const trRows = TREATS.map((def) => {
    const row = makeRow(def.icon, def.name, () => {
      c.check(buyTreat(c.state, def.id));
      update();
    });
    el.append(row.el);
    return { def, row };
  });

  function update(): void {
    const s = c.state;
    for (const { def, row } of acRows) {
      const lvl = s.academy[def.id] ?? 0;
      setText(row.desc, `${statLabel(def.stat, def.perLevel)} per level • ${def.description}`);
      setText(row.meta, `Lv ${lvl}/${def.maxLevel}`);
      const cost = academyCost(s, def.id);
      if (cost === null) setBtn(row.btn, 'MAX', false);
      else setBtn(row.btn, `\u{1F9B4} ${formatNumber(cost)}`, s.goldenBones >= cost);
    }
    for (const { def, row } of trRows) {
      const active = s.treats.find((t) => t.id === def.id);
      setText(row.desc, `${def.description} (×${def.multiplier} for ${formatDuration(def.durationSec)})`);
      setText(row.meta, active ? `⏱ Active: ${formatDuration(active.remaining)} left` : 'Not active');
      setBtn(row.btn, `\u{1F9B4} ${formatNumber(def.cost)}`, s.goldenBones >= def.cost);
    }
  }
  return { el, update };
}
