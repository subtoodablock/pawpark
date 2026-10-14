import {
  HOLD_ADOPT_PER_SEC,
  TREATS,
  adopt,
  computeStats,
  formatDuration,
  formatMoney,
  formatNumber,
  nextFind,
  FINDS,
} from '../core';
import type { GameController } from './GameController';
import { h, meter, setClass, setHidden, setMeter, setText } from './dom';
import { confirmEraUpgrade } from './eraUpgrade';
import { DampedValue, bump, floatText, reducedMotion } from './motion';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
const BADGE_R = 27;
const BADGE_C = 2 * Math.PI * BADGE_R;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

interface Chip {
  el: HTMLElement;
  val: HTMLElement;
  last: number;
}

function makeChip(tag: 'span' | 'button', cls: string, icon: string, title: string): Chip {
  const val = h('b');
  const el = h(tag, { cls: `chip ${cls}${tag === 'button' ? ' chip-btn' : ''}`, attrs: tag === 'button' ? { type: 'button', title } : { title } }, icon ? h('i', { text: icon }) : null, val);
  return { el, val, last: NaN };
}

export class HUD {
  readonly top: HTMLElement;
  readonly controls: HTMLElement;
  onAdopt: (n: number) => void = () => {};

  private cash = h('div', { cls: 'cash' });
  private income = h('div', { cls: 'income' });
  private level = makeChip('button', 'lv', '', 'Park Level');
  private stars = makeChip('button', 'stars', '⭐', 'Kennel Club: Pup Stars');
  private bones = makeChip('span', 'bones', '\u{1F9B4}', 'Golden Bones');
  private paws = makeChip('span', 'paws', '\u{1F43E}', 'Spirit Paws');
  private findLine = h('div', { cls: 'find-text' });
  private badgeIcon = h('span', { cls: 'badge-ico' });
  private badgeFill = svg('circle', { class: 'badge-fill', cx: '32', cy: '32', r: String(BADGE_R) });
  private badge = h('button', { cls: 'find-badge', attrs: { type: 'button', 'aria-label': 'Open Finds', title: 'Finds' } });
  private prestigeChip = h('span', { cls: 'prestige-chip', attrs: { title: 'Spirit Paws you would earn by prestiging now' } });
  private goalIcon = h('span', { cls: 'goal-icon' });
  private goalText = h('span', { cls: 'goal-text' });
  private goalMeter = meter('goal');
  private goalRow = h('div', { cls: 'goal-row' });
  private upgradePill = h('button', { cls: 'btn primary sm pill', text: 'Upgrade!', attrs: { type: 'button' } });

  private popValue = h('div', { cls: 'side-value' });
  private popMeter = meter('pop');
  private dig = h('span', { cls: 'pipe' });
  private ship = h('span', { cls: 'pipe' });
  private whistleWrap = h('div', { cls: 'whistle-wrap' });
  private whistle = h('button', {
    cls: 'whistle',
    attrs: { type: 'button', 'aria-label': 'Whistle: hold to adopt pups' },
  });
  private whistleSub = h('span', { cls: 'whistle-sub' });
  private ringFill = svg('circle', { class: 'ring-fill', cx: '60', cy: '60', r: String(RING_R) });
  private stockValue = h('div', { cls: 'side-value' });
  private zoomLabel = h('span', { cls: 'zoom-label' });
  private zoomCount = h('span');
  private zoomMeter = meter('zoom');
  private treatRow = h('div', { cls: 'treat-row' });
  private treatKey = '';

  private holdTimer: number | null = null;
  private cashAnim = new DampedValue(0, 0.05);
  private lastCash = NaN;
  private lastFrame = performance.now();
  private born = performance.now();

  constructor(private c: GameController) {
    this.buildBadge();
    this.badge.addEventListener('click', () => this.onOpenFind());
    this.level.el.addEventListener('click', () => this.onOpenLevel());
    this.stars.el.addEventListener('click', () => this.onOpenStore());
    this.upgradePill.addEventListener('click', () => {
      confirmEraUpgrade(c);
    });
    this.top = h(
      'header',
      { cls: 'hud-top' },
      h(
        'div',
        { cls: 'hud-row' },
        this.badge,
        h('div', { cls: 'cash-col' }, this.cash, this.income),
        h('div', { cls: 'chips' }, this.level.el, this.bones.el, this.paws.el, this.stars.el),
      ),
      h('div', { cls: 'find-row' }, this.findLine, this.prestigeChip, this.upgradePill),
      this.goalRow,
    );
    this.goalRow.append(this.goalIcon, this.goalMeter.el, this.goalText);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => document.documentElement.style.setProperty('--hud-h', `${this.top.offsetHeight}px`)).observe(this.top);
    }

    this.buildWhistle();
    this.setupWhistle();

    this.controls = h(
      'section',
      { cls: 'controls' },
      h('div', { cls: 'zoom' }, h('div', { cls: 'zoom-head' }, this.zoomLabel, this.zoomCount), this.zoomMeter.el),
      h(
        'div',
        { cls: 'whistle-row' },
        h('div', { cls: 'side' }, h('div', { cls: 'side-label', text: '\u{1F415} Pups' }), this.popValue, this.popMeter.el),
        this.whistleWrap,
        h('div', { cls: 'side right' }, h('div', { cls: 'side-label', text: 'Adoption stock' }), this.stockValue),
      ),
      h('div', { cls: 'pipes' }, this.dig, this.ship),
      this.treatRow,
    );
  }

  onOpenFind: () => void = () => {};
  onOpenLevel: () => void = () => {};
  onOpenStore: () => void = () => {};
  /** hook set by App to celebrate */
  onFindUpgraded: (icon: string) => void = () => {};

  /** Egg Inc style badge: glossy disc with the current Find, ringed by progress to the next era. */
  private buildBadge(): void {
    const ring = svg('svg', { class: 'badge-ring', viewBox: '0 0 64 64', 'aria-hidden': 'true' });
    ring.append(svg('circle', { class: 'badge-track', cx: '32', cy: '32', r: String(BADGE_R) }), this.badgeFill);
    this.badgeFill.style.strokeDasharray = BADGE_C.toFixed(1);
    this.badgeFill.style.strokeDashoffset = BADGE_C.toFixed(1);
    this.badge.append(ring, h('span', { cls: 'badge-disc' }, this.badgeIcon));
  }

  private buildWhistle(): void {
    const ring = svg('svg', { class: 'whistle-ring', viewBox: '0 0 120 120', 'aria-hidden': 'true' });
    const defs = svg('defs');
    const grad = svg('linearGradient', { id: 'ring-grad', x1: '0', y1: '0', x2: '1', y2: '1' });
    grad.append(svg('stop', { offset: '0', 'stop-color': '#7cc8ff' }), svg('stop', { offset: '1', 'stop-color': '#3b8fe0' }));
    defs.append(grad);
    ring.append(defs, svg('circle', { class: 'ring-track', cx: '60', cy: '60', r: String(RING_R) }), this.ringFill);
    this.ringFill.style.strokeDasharray = RING_C.toFixed(1);
    this.ringFill.style.strokeDashoffset = RING_C.toFixed(1);

    const pawRing = h('div', { cls: 'paw-ring', attrs: { 'aria-hidden': 'true' } });
    for (let i = 0; i < 8; i++) {
      const p = h('div', { cls: 'paw', style: `--a:${i * 45 + (i % 2 ? 12 : 0)}deg;--i:${i}` }, h('span', { text: '\u{1F43E}' }));
      pawRing.append(p);
    }
    this.whistle.append(h('span', { cls: 'whistle-icon', text: '\u{1F4EF}' }), h('span', { cls: 'whistle-text', text: 'WHISTLE' }), this.whistleSub);
    this.whistleWrap.append(h('div', { cls: 'whistle-glow' }), ring, pawRing, this.whistle);
  }

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
      this.whistleWrap.classList.remove('held');
    };
    w.addEventListener('animationend', () => w.classList.remove('shake'));
    w.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        w.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      stop();
      w.classList.add('held');
      this.whistleWrap.classList.add('held');
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
        w.classList.add('held');
        window.setTimeout(() => w.classList.remove('held'), 140);
      }
    });
  }

  /** Update a chip; bounce it when the value went up. */
  private setChip(ch: Chip, n: number, text: string): void {
    setText(ch.val, text);
    if (Number.isFinite(ch.last) && n > ch.last) bump(ch.el);
    ch.last = n;
  }

  update(): void {
    const s = this.c.state;
    const d = computeStats(s);
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    // cash: damped count-up (~150ms), plus a floating "+$X" for big instant gains
    const first = !Number.isFinite(this.lastCash);
    if (!first) {
      const gain = s.cash - this.lastCash;
      const big = Math.max(d.incomePerSec * 1.5, 25);
      if (gain > big && now - this.born > 2000 && !document.hidden) {
        const r = this.cash.getBoundingClientRect();
        floatText({ x: r.left + Math.min(r.width, 120) / 2 + 6, y: r.bottom - 6 }, `+${formatMoney(gain)}`);
      }
    }
    this.lastCash = s.cash;
    this.cashAnim.set(s.cash, first);
    setText(this.cash, formatMoney(this.cashAnim.step(dt)));
    setText(this.income, `+${formatMoney(d.incomePerSec)}/s` + (d.zoomieMult > 1.001 ? ` • ⚡×${d.zoomieMult.toFixed(2)}` : ''));
    this.setChip(this.bones, Math.floor(s.goldenBones), formatNumber(Math.floor(s.goldenBones)));
    this.setChip(this.level, d.parkLevel, `Lv ${d.parkLevel}`);
    this.setChip(this.stars, Math.floor(s.premium.stars), formatNumber(Math.floor(s.premium.stars)));
    this.setChip(this.paws, s.spiritPaws, formatNumber(s.spiritPaws));

    const f = FINDS[s.findIndex];
    setText(this.badgeIcon, f?.icon ?? '');
    setText(this.findLine, `${f?.icon ?? ''} ${f?.name ?? '?'} Era · Park ${formatMoney(d.parkValue)}`);
    setText(this.prestigeChip, `+${formatNumber(d.prestigeGain)} \u{1F43E} on prestige`);
    setHidden(this.prestigeChip, !(d.prestigeGain >= 1));
    const nf = nextFind(s);
    const ready = !!nf && d.parkValue >= nf.unlockParkValue;
    setHidden(this.upgradePill, !ready);
    setClass(this.badge, 'ready', ready);

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
      const off = (BADGE_C * (1 - Math.max(0, Math.min(1, ready ? 1 : frac)))).toFixed(1);
      if (this.badgeFill.style.strokeDashoffset !== off) this.badgeFill.style.strokeDashoffset = off;
    } else {
      if (this.badgeFill.style.strokeDashoffset !== '0.0') this.badgeFill.style.strokeDashoffset = '0.0';
      setText(this.goalIcon, '\u{1F30C} Endgame reached');
      setText(this.goalText, '');
      setHidden(this.goalMeter.el, true);
    }

    const pups = Math.floor(s.pups);
    const full = d.kennelCapacity - s.pups < 1;
    setText(this.popValue, `${formatNumber(pups)} / ${formatNumber(Math.floor(d.kennelCapacity))}` + (full ? ' FULL' : ''));
    setClass(this.popValue, 'full-tag', full);
    setMeter(this.popMeter, d.kennelCapacity > 0 ? s.pups / d.kennelCapacity : 0);
    setClass(this.popMeter.el, 'full', full);

    const digBott = d.bottleneck === 'dig';
    setText(this.dig, `⛏️ dig ${formatNumber(d.digPerSec)}/s${digBott ? ' ▲ limit' : ''}`);
    setText(this.ship, `\u{1F69A} ship ${formatNumber(d.shipPerSec)}/s${digBott ? '' : ' ▲ limit'}`);
    setClass(this.dig, 'limit', digBott);
    setClass(this.ship, 'limit', !digBott);

    const stockFrac = d.adoptionCap > 0 ? Math.max(0, Math.min(1, s.adoptionStock / d.adoptionCap)) : 0;
    setText(this.stockValue, `${Math.floor(s.adoptionStock)}/${Math.floor(d.adoptionCap)}`);
    const off = (RING_C * (1 - stockFrac)).toFixed(1);
    if (this.ringFill.style.strokeDashoffset !== off) this.ringFill.style.strokeDashoffset = off;
    this.ringFill.style.opacity = stockFrac < 0.005 ? '0' : '1';
    setText(this.whistleSub, s.adoptionStock < 1 ? 'no stock' : full ? 'park full' : 'hold!');
    setClass(this.whistle, 'empty', s.adoptionStock < 1 || full);

    setText(this.zoomLabel, `\u{1F525} Zoomies ×${d.zoomieMult.toFixed(2)}`);
    setText(this.zoomCount, `${Math.floor(s.zoomies)}/${Math.floor(d.maxZoomies)}`);
    setMeter(this.zoomMeter, d.maxZoomies > 0 ? s.zoomies / d.maxZoomies : 0);
    setClass(this.zoomMeter.el, 'hot', s.zoomies >= 1 && !reducedMotion());

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
