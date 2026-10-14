import {
  MAX_FLEET_SLOTS,
  TOP_VEHICLE_TIER,
  VEHICLES,
  buySledCar,
  buyVehicle,
  computeStats,
  formatMoney,
  formatNumber,
  sledCarCost,
  statValue,
  vehicleUpgradeCost,
} from '../../core';
import type { GameController } from '../GameController';
import { h, setClass, setText } from '../dom';
import { artImg } from '../gameArt';
import { icon } from '../icons';
import { makeRow, setBtn, setSlot, type Panel, type Row } from './common';

export function createFleetPanel(c: GameController): Panel {
  const el = h('div', { cls: 'panel' }, h('div', { cls: 'toolbar', text: 'Vehicles ship your finds to market. More capacity = more sold.' }));
  const rows: Row[] = [];
  const pips: HTMLElement[] = [];
  for (let i = 0; i < MAX_FLEET_SLOTS; i++) {
    const row = makeRow(null, '', () => {
      const s = c.state;
      const top = s.vehicles[i] === TOP_VEHICLE_TIER;
      const ok = c.check(top ? buySledCar(s, i) : buyVehicle(s, i));
      update();
      return ok;
    });
    const pip = h('div', { cls: 'car-pips' });
    pip.hidden = true;
    row.meta.after(pip);
    pips.push(pip);
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
        setSlot(row.icon, 'lock', () => icon('lock-simple', { size: 26, color: 'var(--ui-muted)' }));
        setText(row.title, `Slot ${i + 1}: Locked`);
        setText(row.desc, 'Unlock with Fleet Expansion');
        setText(row.meta, '');
        setBtn(row.btn, '{lock}', false);
        return;
      }
      const tier = s.vehicles[i];
      const cur = tier === null || tier === undefined ? null : VEHICLES[tier];
      const next = VEHICLES[tier === null || tier === undefined ? 0 : tier + 1];
      const isTop = tier === TOP_VEHICLE_TIER;
      const cars = isTop ? Math.max(1, s.vehicleCars[i] ?? 0) : 1;
      const maxCars = d.maxCars;
      setSlot(row.icon, cur ? `v${tier}` : 'empty', () => (cur ? artImg('vehicle', tier as number, 48) : icon('plus', { size: 26, color: 'var(--ui-muted)' })));
      setText(row.title, `Slot ${i + 1}: ${cur ? cur.name : 'Empty'}`);
      setText(row.desc, cur ? `Ships ${formatNumber(cur.capacityPerMin * mult * cars)}/min` : 'Buy a vehicle to ship more finds');
      setText(row.meta, isTop ? `Sled cars: ${cars} / ${maxCars}. Each car carries ${formatNumber((cur?.capacityPerMin ?? 0) * mult)}/min` : next ? `Next: ${next.name} (${formatNumber(next.capacityPerMin * mult)}/min)` : 'Fully upgraded');
      setClass(row.el, 'sled', isTop);
      const pip = pips[i];
      pip.hidden = !isTop;
      if (isTop) {
        const key = `${cars}/${maxCars}`;
        if (pip.dataset.k !== key) {
          pip.dataset.k = key;
          pip.replaceChildren(...Array.from({ length: maxCars }, (_, k) => h('i', { cls: k < cars ? 'on' : '' })));
        }
        const carCost = sledCarCost(s, i);
        if (carCost === null) setBtn(row.btn, 'MAX', false);
        else setBtn(row.btn, `ADD CAR ${formatMoney(carCost)}`, s.cash >= carCost);
        return;
      }
      const cost = vehicleUpgradeCost(s, i);
      if (cost === null) setBtn(row.btn, 'MAX', false);
      else setBtn(row.btn, `${cur ? 'Upgrade' : 'Buy'} ${formatMoney(cost)}`, s.cash >= cost);
    });
  }
  return { el, update };
}
