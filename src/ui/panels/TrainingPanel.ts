import {
  TRAINING,
  TRAINING_TIERS,
  buyTraining,
  computeStats,
  formatMoney,
  formatNumber,
  isTrainingTierUnlocked,
  trainingCost,
  trainingMaxBuy,
} from '../../core';
import type { TrainingDef } from '../../core';
import type { GameController } from '../GameController';
import { h, setClass, setHidden, setText } from '../dom';
import { statLabel } from '../labels';
import { makeRow, setBtn, type Panel, type Row } from './common';

export function createTrainingPanel(c: GameController): Panel {
  let maxMode = false;
  const x1 = h('button', { cls: 'seg on', text: '×1', on: { click: () => set(false) } });
  const xm = h('button', { cls: 'seg', text: '×MAX', on: { click: () => set(true) } });
  function set(m: boolean): void {
    maxMode = m;
    setClass(x1, 'on', !m);
    setClass(xm, 'on', m);
    update();
  }
  const el = h('div', { cls: 'panel' }, h('div', { cls: 'toolbar' }, h('span', { text: 'Training resets when you open a new park.' }), h('div', { cls: 'segs' }, x1, xm)));

  interface TierView {
    tier: number;
    unlockAt: number;
    head: HTMLElement;
    lock: HTMLElement;
    rows: { def: TrainingDef; row: Row }[];
  }
  const tiers: TierView[] = [];
  for (const t of TRAINING_TIERS) {
    const lock = h('span', { cls: 'lock' });
    const head = h('h3', { cls: 'tier-head' }, `Tier ${t.tier}: ${t.name}`, lock);
    const rows = TRAINING.filter((d) => d.tier === t.tier).map((def) => {
      const row = makeRow(def.icon, def.name, () => {
        c.check(buyTraining(c.state, def.id, maxMode ? Infinity : 1));
        update();
      });
      return { def, row };
    });
    el.append(head, ...rows.map((r) => r.row.el));
    tiers.push({ tier: t.tier, unlockAt: t.unlockAt, head, lock, rows });
  }

  function update(): void {
    const s = c.state;
    const total = computeStats(s).totalTrainingLevels;
    for (const t of tiers) {
      const unlocked = isTrainingTierUnlocked(s, t.tier);
      setText(t.lock, unlocked ? '' : `\u{1F512} Buy ${formatNumber(Math.max(0, t.unlockAt - total))} more levels to unlock`);
      for (const { def, row } of t.rows) {
        const lvl = s.training[def.id] ?? 0;
        setText(row.desc, `${statLabel(def.stat, def.perLevel)}${def.maxLevel === 1 ? '' : ' per level'} • ${def.description}`);
        setText(row.meta, `Lv ${lvl}/${def.maxLevel}`);
        setClass(row.el, 'locked', !unlocked);
        setHidden(row.btn, false);
        if (lvl >= def.maxLevel) {
          setBtn(row.btn, 'MAX', false);
          continue;
        }
        const cost = trainingCost(s, def.id);
        if (cost === null) {
          setBtn(row.btn, '—', false);
          continue;
        }
        if (maxMode && unlocked) {
          const m = trainingMaxBuy(s, def.id);
          if (m.levels > 0) {
            setBtn(row.btn, `+${m.levels === Infinity ? '?' : formatNumber(m.levels)} • ${formatMoney(m.cost)}`, true);
            continue;
          }
        }
        setBtn(row.btn, formatMoney(cost), unlocked && s.cash >= cost);
      }
    }
  }
  return { el, update };
}
