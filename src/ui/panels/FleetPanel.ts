import {
  MAX_FLEET_SLOTS,
  VEHICLES,
  buyVehicle,
  computeStats,
  formatMoney,
  formatNumber,
  statValue,
  vehicleUpgradeCost,
} from '../../core';
import type { GameController } from '../GameController';
import { h, setClass, setText } from '../dom';
import { makeRow, setBtn, type Panel, type Row } from './common';

export function createFleetPanel(c: GameController): Panel {
  const el = h('div', { cls: 'panel' }, h('div', { cls: 'toolbar', text: 'Vehicles ship your finds to market. More capacity = more sold.' }));
  const rows: Row[] = [];
  for (let i = 0; i < MAX_FLEET_SLOTS; i++) {
    const row = makeRow('', '', () => {
      const ok = c.check(buyVehicle(c.state, i));
      update();
      return ok;
    });
    rows.push(row);
    el.append(row.el);
  }
  function update(): void {
    const s = c.state;
    const d = computeStats(s);
    const mult = statValue(s, 'shippingCapacity');
    rows.forEach((row, i) => {
      const locked = i >= d.fleetSlots;
      setClass(row.el, 'locked', locked);
      if (locked) {
        setText(row.icon, '\u{1F512}');
        setText(row.title, `Slot ${i + 1}: Locked`);
        setText(row.desc, 'Unlock with Fleet Expansion');
        setText(row.meta, '');
        setBtn(row.btn, '\u{1F512}', false);
        return;
      }
      const tier = s.vehicles[i];
      const cur = tier === null || tier === undefined ? null : VEHICLES[tier];
      const next = VEHICLES[tier === null || tier === undefined ? 0 : tier + 1];
      setText(row.icon, cur ? cur.icon : '➕');
      setText(row.title, `Slot ${i + 1}: ${cur ? cur.name : 'Empty'}`);
      setText(row.desc, cur ? `Ships ${formatNumber(cur.capacityPerMin * mult)}/min` : 'Buy a vehicle to ship more finds');
      setText(row.meta, next ? `Next: ${next.icon} ${next.name} (${formatNumber(next.capacityPerMin * mult)}/min)` : 'Fully upgraded');
      const cost = vehicleUpgradeCost(s, i);
      if (cost === null) setBtn(row.btn, 'MAX', false);
      else setBtn(row.btn, `${cur ? 'Upgrade' : 'Buy'} ${formatMoney(cost)}`, s.cash >= cost);
    });
  }
  return { el, update };
}
