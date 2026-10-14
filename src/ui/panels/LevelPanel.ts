import { PARK_LEVEL_THRESHOLDS, computeStats, formatMoney, parkTitle } from '../../core';
import type { GameController } from '../GameController';
import { h, meter, setClass, setMeter, setText } from '../dom';
import { createShareCard } from '../share';
import { section, type Panel } from './common';

export function createLevelPanel(c: GameController): Panel {
  const el = h('div', { cls: 'panel' });
  const big = h('div', { cls: 'level-big' });
  const title = h('div', { cls: 'row-title' });
  const m = meter('goal');
  const meta = h('div', { cls: 'row-meta' });
  el.append(section('Your level', h('div', { cls: 'card' }, big, title, m.el, meta, h('div', { cls: 'row-desc', text: 'Based on lifetime earnings. It never goes down, even when you open a new park.' }))));

  // titles list: derived through parkTitle so the data shape does not matter
  const maxLevel = PARK_LEVEL_THRESHOLDS.length;
  const entries: { level: number; title: string; el: HTMLElement }[] = [];
  let prev = '';
  for (let l = 1; l <= maxLevel; l++) {
    const t = parkTitle(l);
    if (t === prev) continue;
    prev = t;
    const e = h('div', { cls: 'ladder-row' }, h('span', { cls: 'ladder-name', text: t }), h('span', { cls: 'row-meta', text: `Lv ${l}+` }));
    entries.push({ level: l, title: t, el: e });
  }
  el.append(section('Titles', h('div', { cls: 'ladder' }, ...entries.map((e) => e.el))));
  const share = createShareCard(c);
  el.append(section('\u{1F4E4} Share', share.el));

  function update(): void {
    const s = c.state;
    const d = computeStats(s);
    const lvl = d.parkLevel;
    setText(big, `Lv ${lvl}`);
    setText(title, d.parkTitle);
    const lo = lvl >= 1 ? Math.max(1, PARK_LEVEL_THRESHOLDS[lvl - 1] ?? 1) : 1;
    const hi = PARK_LEVEL_THRESHOLDS[lvl];
    if (hi === undefined) {
      setMeter(m, 1);
      setText(meta, 'Max level reached!');
    } else {
      const e = Math.max(1, s.lifetimeEarnings);
      const frac = (Math.log(e) - Math.log(lo)) / Math.max(1e-9, Math.log(hi) - Math.log(lo));
      setMeter(m, frac);
      setText(meta, `${formatMoney(s.lifetimeEarnings)} / ${formatMoney(hi)} for Lv ${lvl + 1}`);
    }
    for (const e of entries) setClass(e.el, 'current', parkTitle(lvl) === e.title);
    share.update();
  }
  return { el, update };
}
