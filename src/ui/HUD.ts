import {
  HOLD_ADOPT_PER_SEC,
  TREATS,
  adopt,
  computeStats,
  formatDuration,
  formatMoney,
  formatNumber,
  nextFind,
  upgradeFind,
  FINDS,
} from '../core';
import type { GameController } from './GameController';
import { h, meter, setClass, setHidden, setMeter, setText } from './dom';

export class HUD {
  readonly top: HTMLElement;
  readonly controls: HTMLElement;
  onAdopt: (n: number) => void = () => {};

  private cash = h('div', { cls: 'cash' });
  private income = h('div', { cls: 'income' });
  private level = h('button', { cls: 'chip chip-btn', attrs: { type: 'button', title: 'Park Level' } });
  private stars = h('button', { cls: 'chip chip-btn', attrs: { type: 'button', title: 'Kennel Club: Pup Stars' } });
  private bones = h('span', { cls: 'chip', attrs: { title: 'Golden Bones' } });
  private paws = h('span', { cls: 'chip', attrs: { title: 'Spirit Paws' } });
  private findLine = h('div', { cls: 'find-text' });
  private goalIcon = h('span', { cls: 'goal-icon' });
  private goalText = h('span', { cls: 'goal-text' });
  private goalMeter = meter('goal');
  private goalRow = h('div', { cls: 'goal-row' });
  private upgradePill = h('button', { cls: 'pill', text: 'Upgrade!' });

  private popLabel = h('div', { cls: 'pop-label' });
  private popMeter = meter('pop');
  private dig = h('span', { cls: 'pipe' });
  private ship = h('span', { cls: 'pipe' });
  private whistle = h('button', {
    cls: 'whistle',
    attrs: { type: 'button', 'aria-label': 'Whistle: hold to adopt pups' },
  });
  private whistleSub = h('span', { cls: 'whistle-sub' });
  private stockLabel = h('div', { cls: 'stock-label' });
  private stockMeter = meter('stock');
  private zoomLabel = h('div', { cls: 'zoom-label' });
  private zoomMeter = meter('zoom');
  private treatRow = h('div', { cls: 'treat-row' });
  private treatKey = '';

  private holdTimer: number | null = null;

  constructor(private c: GameController) {
    this.level.addEventListener('click', () => this.onOpenLevel());
    this.stars.addEventListener('click', () => this.onOpenStore());
    this.upgradePill.addEventListener('click', () => {
      const f = nextFind(c.state);
      if (c.check(upgradeFind(c.state)) && f) this.onFindUpgraded(f.icon);
    });
    this.top = h(
      'header',
      { cls: 'hud-top' },
      h('div', { cls: 'hud-row' }, h('div', { cls: 'cash-col' }, this.cash, this.income), h('div', { cls: 'chips' }, this.level, this.bones, this.paws, this.stars)),
      h('div', { cls: 'find-row' }, this.findLine, this.upgradePill),
      this.goalRow,
    );
    this.goalRow.append(this.goalIcon, this.goalMeter.el, this.goalText);

    this.whistle.append(h('span', { cls: 'whistle-icon', text: '\u{1F4EF}' }), h('span', { cls: 'whistle-text', text: 'WHISTLE' }), this.whistleSub);
    this.setupWhistle();

    this.controls = h(
      'section',
      { cls: 'controls' },
      h('div', { cls: 'pop' }, this.popLabel, this.popMeter.el),
      h('div', { cls: 'pipes' }, this.dig, this.ship),
      h('div', { cls: 'whistle-row' }, this.whistle, h('div', { cls: 'stock' }, this.stockLabel, this.stockMeter.el)),
      h('div', { cls: 'zoom' }, this.zoomLabel, this.zoomMeter.el),
      this.treatRow,
    );
  }

  onOpenLevel: () => void = () => {};
  onOpenStore: () => void = () => {};
  /** hook set by App to celebrate */
  onFindUpgraded: (icon: string) => void = () => {};

  private setupWhistle(): void {
    const w = this.whistle;
    const doAdopt = (): void => {
      const n = adopt(this.c.state, 1, true);
      if (n > 0) this.onAdopt(n);
      else {
        w.classList.remove('shake');
        void w.offsetWidth;
        w.classList.add('shake');
      }
    };
    const stop = (): void => {
      if (this.holdTimer !== null) {
        window.clearInterval(this.holdTimer);
        this.holdTimer = null;
      }
      w.classList.remove('held');
    };
    w.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        w.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      stop();
      w.classList.add('held');
      doAdopt();
      this.holdTimer = window.setInterval(doAdopt, 1000 / HOLD_ADOPT_PER_SEC);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'] as const) {
      w.addEventListener(ev, stop);
    }
    w.addEventListener('contextmenu', (e) => e.preventDefault());
    w.addEventListener('dblclick', (e) => e.preventDefault());
    w.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        doAdopt();
      }
    });
  }

  update(): void {
    const s = this.c.state;
    const d = computeStats(s);
    setText(this.cash, formatMoney(s.cash));
    setText(this.income, `+${formatMoney(d.incomePerSec)}/s` + (d.zoomieMult > 1.001 ? ` • ⚡×${d.zoomieMult.toFixed(2)}` : ''));
    setText(this.bones, `\u{1F9B4} ${formatNumber(Math.floor(s.goldenBones))}`);
    setText(this.level, `Lv ${d.parkLevel}`);
    setText(this.stars, `\u2B50 ${formatNumber(Math.floor(s.premium.stars))}`);
    setText(this.paws, `\u{1F43E} ${formatNumber(s.spiritPaws)}`);

    const f = FINDS[s.findIndex];
    setText(this.findLine, `${f?.icon ?? ''} ${f?.name ?? '?'} • Park ${formatMoney(d.parkValue)}`);
    const nf = nextFind(s);
    setHidden(this.upgradePill, !(nf && d.parkValue >= nf.unlockParkValue));

    // next-goal line: log-scale progress from the current find's gate to the next one
    if (nf) {
      const cur = Math.max(1, FINDS[s.findIndex]?.unlockParkValue ?? 1);
      const next = Math.max(cur * 1.0001, nf.unlockParkValue);
      const pv = Math.max(1, d.parkValue);
      const frac = (Math.log(pv) - Math.log(cur)) / (Math.log(next) - Math.log(cur));
      setText(this.goalIcon, `Next ${nf.icon}`);
      setMeter(this.goalMeter, frac);
      setText(this.goalText, `${Math.floor(Math.max(0, Math.min(1, frac)) * 100)}%`);
      setHidden(this.goalMeter.el, false);
    } else {
      setText(this.goalIcon, '\u{1F30C} Endgame reached');
      setText(this.goalText, '');
      setHidden(this.goalMeter.el, true);
    }

    const pups = Math.floor(s.pups);
    const full = d.kennelCapacity - s.pups < 1;
    setText(this.popLabel, `\u{1F415} ${formatNumber(pups)} / ${formatNumber(Math.floor(d.kennelCapacity))} pups` + (full ? ' • FULL' : ''));
    setMeter(this.popMeter, d.kennelCapacity > 0 ? s.pups / d.kennelCapacity : 0);
    setClass(this.popMeter.el, 'full', full);

    const digBott = d.bottleneck === 'dig';
    setText(this.dig, `⛏️ dig ${formatNumber(d.digPerSec)}/s${digBott ? ' ▲ limit' : ''}`);
    setText(this.ship, `\u{1F69A} ship ${formatNumber(d.shipPerSec)}/s${digBott ? '' : ' ▲ limit'}`);
    setClass(this.dig, 'limit', digBott);
    setClass(this.ship, 'limit', !digBott);

    setText(this.stockLabel, `Stock ${Math.floor(s.adoptionStock)}/${Math.floor(d.adoptionCap)}`);
    setMeter(this.stockMeter, d.adoptionCap > 0 ? s.adoptionStock / d.adoptionCap : 0);
    setText(this.whistleSub, s.adoptionStock < 1 ? 'no stock' : full ? 'park full' : 'hold!');
    setClass(this.whistle, 'empty', s.adoptionStock < 1 || full);

    setText(this.zoomLabel, `⚡ ZOOMIES ×${d.zoomieMult.toFixed(2)}  (${Math.floor(s.zoomies)}/${Math.floor(d.maxZoomies)})`);
    setMeter(this.zoomMeter, d.maxZoomies > 0 ? s.zoomies / d.maxZoomies : 0);

    const key = s.treats.map((t) => t.id + ':' + Math.ceil(t.remaining)).join('|');
    if (key !== this.treatKey) {
      this.treatKey = key;
      this.treatRow.replaceChildren(
        ...s.treats.map((t) => {
          const def = TREATS.find((x) => x.id === t.id);
          return h('span', { cls: 'treat-chip', text: `${def?.icon ?? '\u{1F356}'} ×${def?.multiplier ?? ''} ${formatDuration(t.remaining)}` });
        }),
      );
    }
  }
}
