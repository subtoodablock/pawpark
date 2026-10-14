import {
  KENNELS,
  KENNEL_SLOTS,
  buyKennel,
  formatMoney,
  formatNumber,
  kennelUpgradeCost,
  statValue,
} from '../../core';
import type { GameController } from '../GameController';
import { h, setText } from '../dom';
import { artImg } from '../gameArt';
import { icon } from '../icons';
import { makeRow, setBtn, setSlot, type Panel, type Row } from './common';

export function createKennelsPanel(c: GameController): Panel {
  const el = h('div', { cls: 'panel' }, h('div', { cls: 'toolbar', text: 'Kennels house your pups. Upgrade each slot to a bigger tier.' }));
  const rows: Row[] = [];
  for (let i = 0; i < KENNEL_SLOTS; i++) {
    const row = makeRow(null, '', () => {
      const ok = c.check(buyKennel(c.state, i));
      update();
      return ok;
    });
    rows.push(row);
    el.append(row.el);
  }
  function update(): void {
    const s = c.state;
    const mult = statValue(s, 'kennelCapacity');
    rows.forEach((row, i) => {
      const tier = s.kennels[i];
      const cur = tier === null || tier === undefined ? null : KENNELS[tier];
      const next = KENNELS[tier === null || tier === undefined ? 0 : tier + 1];
      setSlot(row.icon, cur ? `k${tier}` : 'empty', () => (cur ? artImg('kennel', tier as number, 48) : icon('plus', { size: 26, color: 'var(--ui-muted)' })));
      setText(row.title, `Slot ${i + 1}: ${cur ? cur.name : 'Empty'}`);
      setText(row.desc, cur ? `Holds ${formatNumber(Math.floor(cur.capacity * mult))} pups` : 'Build a kennel to house more pups');
      setText(row.meta, next ? `Next: ${next.name} (${formatNumber(Math.floor(next.capacity * mult))} pups)` : 'Fully upgraded');
      const cost = kennelUpgradeCost(s, i);
      if (cost === null) setBtn(row.btn, 'MAX', false);
      else setBtn(row.btn, `${cur ? 'Upgrade' : 'Build'} ${formatMoney(cost)}`, s.cash >= cost);
    });
  }
  return { el, update };
}
