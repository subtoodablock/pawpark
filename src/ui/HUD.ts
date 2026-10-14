import {
  HOLD_ADOPT_PER_SEC,
  TREATS,
  adopt,
  computeStats,
  formatDuration,
  formatMoney,
  formatNumber,
  nextFind,
  showWindow,
  FINDS,
} from '../core';
import { suffixName } from '../core/format';
import type { GameController } from './GameController';
import { h, meter, setClass, setHidden, setMeter, setText } from './dom';
import { confirmEraUpgrade } from './eraUpgrade';
import { artImg, setArt } from './gameArt';
import { icon, type IconName } from './icons';
import { DampedValue, bump, floatText, reducedMotion } from './motion';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BADGE_R = 27;
const BADGE_C = 2 * Math.PI * BADGE_R;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

/** "$1.25M" -> { num: "$1.25", unit: "Million" } for the Egg, Inc. style counter. */
export function moneyParts(n: number): { num: string; unit: string } {
  const s = formatMoney(n);
  const m = /^(-?\$[\d.]+)([A-Za-z]{0,2})$/.exec(s);
  if (!m) return { num: s, unit: '' };
  return { num: m[1], unit: suffixName(m[2]) };
}

export type NavId = 'research' | 'treats' | 'portal' | 'store' | 'menu';

interface Chip {
  el: HTMLElement;
  val: HTMLElement;
  last: number;
}

function makeChip(tag: 'span' | 'button', cls: string, glyph: IconName | null, title: string): Chip {
  const val = h('b');
  const el = h(
    tag,
    { cls: `chip ${cls}${tag === 'button' ? ' chip-btn' : ''}`, attrs: tag === 'button' ? { type: 'button', title } : { title } },
    glyph ? icon(glyph, { size: 15 }) : null,
    val,
  );
  return { el, val, last: NaN };
}

const NAV: { id: NavId; glyph: IconName; label: string }[] = [
  { id: 'research', glyph: 'flask', label: 'Research' },
  { id: 'treats', glyph: 'lightning', label: 'Treats and boosts' },
  { id: 'portal', glyph: 'spiral-bold', label: 'Paw Portal' },
  { id: 'store', glyph: 'storefront', label: 'Kennel Club shop' },
  { id: 'menu', glyph: 'squares-four', label: 'Menu' },
];

export class HUD {
  readonly top: HTMLElement;
  readonly controls: HTMLElement;
  onAdopt: (n: number) => void = () => {};
  onNav: (id: NavId) => void = () => {};

  private cash = h('span', { cls: 'cash' });
  private cashUnit = h('span', { cls: 'cash-unit' });
  private income = h('span', { cls: 'income' });
  private pups = h('span', { cls: 'pups-val' });
  private pupsChip = h('span', { cls: 'pups-chip', attrs: { title: 'Pups / kennel capacity' } }, icon('dog', { size: 15 }), this.pups);
  private subLine = h('div', { cls: 'sub-line' }, this.income, this.pupsChip);
  private subKey = '';
  private subStacked = false;
  private level = makeChip('button', 'lv', null, 'Park Level');
  private rank = makeChip('button', 'rank', null, 'Pup Rank');
  private showBand = h('div', { cls: 'show-band' }, icon('flag-banner', { size: 18, color: '#111' }));
  private showBandText = h('span');
  private strip = h('div', { cls: 'hud-strip' });
  private stars = makeChip('button', 'stars', 'star', 'Kennel Club: Pup Stars');
  private bones = makeChip('span', 'bones', 'bone', 'Golden Bones');
  private paws = makeChip('span', 'paws', 'paw-print', 'Spirit Paws');
  private findLine = h('div', { cls: 'find-text' });
  private badgeImg = artImg('find', 0, 40);
  private badgeFill = svg('circle', { class: 'badge-fill', cx: '32', cy: '32', r: String(BADGE_R) });
  private badge = h('button', { cls: 'find-badge', attrs: { type: 'button', 'aria-label': 'Open Finds', title: 'Finds' } });
  private upgradePill = h('button', { cls: 'btn primary sm pill', text: 'UPGRADE', attrs: { type: 'button' } });
  private shopBtn = h('button', { cls: 'shop-btn', attrs: { type: 'button', 'aria-label': 'Kennel Club shop', title: 'Kennel Club' } }, icon('storefront', { size: 24, color: '#fff' }));

  private whistle = h('button', {
    cls: 'whistle',
    attrs: { type: 'button', 'aria-label': 'Whistle: hold to adopt pups' },
  });
  private whistleSub = h('span', { cls: 'whistle-sub' });
  private stockValue = h('span', { cls: 'whistle-stock' });
  private stockMeter = meter('stock');
  private dig = h('span', { cls: 'pipe' });
  private ship = h('span', { cls: 'pipe' });
  private zoomLabel = h('span', { cls: 'zoom-label' });
  private zoomCount = h('span');
  private zoomMeter = meter('zoom');
  private treatRow = h('div', { cls: 'treat-row' });
  private treatChips = new Map<string, { el: HTMLElement; t: HTMLElement }>();
  private navBtns = new Map<NavId, HTMLButtonElement>();

  private holdTimer: number | null = null;
  private cashLine = h('div', { cls: 'cash-line' });
  private cashFitKey = '';
  private cashAnim = new DampedValue(0, 0.05);
  private lastCash = NaN;
  private lastFrame = performance.now();
  private born = performance.now();

  constructor(private c: GameController) {
    this.buildBadge();
    this.badge.addEventListener('click', () => this.onOpenFind());
    this.level.el.addEventListener('click', () => this.onOpenLevel());
    this.rank.el.addEventListener('click', () => this.onOpenLevel());
    this.showBand.append(this.showBandText);
    this.showBand.addEventListener('click', () => this.onOpenFind());
    this.stars.el.addEventListener('click', () => this.onOpenStore());
    this.shopBtn.addEventListener('click', () => this.onOpenStore());
    this.upgradePill.addEventListener('click', () => {
      confirmEraUpgrade(c);
    });
    this.cashLine.append(this.cash, this.cashUnit);
    this.top = h(
      'header',
      { cls: 'hud-top' },
      this.strip,
    );
    this.strip.append(
        this.showBand,
        h(
          'div',
          { cls: 'hud-row' },
          this.badge,
          h(
            'div',
            { cls: 'cash-col' },
            this.cashLine,
            this.subLine,
          ),
          h('div', { cls: 'chips' }, this.bones.el, this.paws.el),
          this.shopBtn,
        ),
        h('div', { cls: 'find-row' }, this.findLine, this.upgradePill, h('div', { cls: 'find-chips' }, this.stars.el, this.level.el, this.rank.el)),
    );
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => document.documentElement.style.setProperty('--hud-h', `${this.top.offsetHeight}px`)).observe(this.top);
    }

    this.buildWhistle();
    this.setupWhistle();

    const nav = h('div', { cls: 'quick-row' });
    for (const n of NAV) {
      const b = h('button', { cls: 'round-icon', attrs: { type: 'button', 'aria-label': n.label, title: n.label }, on: { click: () => this.onNav(n.id) } }, icon(n.glyph, { size: 28, color: '#111' }), h('i', { cls: 'dot' }));
      this.navBtns.set(n.id, b);
      nav.append(b);
    }

    this.controls = h(
      'section',
      { cls: 'controls' },
      h('div', { cls: 'zoom' }, h('div', { cls: 'zoom-head' }, this.zoomLabel, this.zoomCount), this.zoomMeter.el),
      this.treatRow,
      h('div', { cls: 'pipes' }, this.dig, this.ship),
      nav,
      this.whistle,
    );
  }

  onOpenFind: () => void = () => {};
  onOpenLevel: () => void = () => {};
  onOpenStore: () => void = () => {};

  /** red notification dot on a round button */
  setDot(id: NavId, on: boolean): void {
    const b = this.navBtns.get(id);
    if (b) setClass(b, 'has-dot', on);
  }

  /** Egg Inc style badge: white disc with the current Find, ringed in gold by progress to the next era. */
  private buildBadge(): void {
    const ring = svg('svg', { class: 'badge-ring', viewBox: '0 0 64 64', 'aria-hidden': 'true' });
    ring.append(svg('circle', { class: 'badge-track', cx: '32', cy: '32', r: String(BADGE_R) }), this.badgeFill);
    this.badgeFill.style.strokeDasharray = BADGE_C.toFixed(1);
    this.badgeFill.style.strokeDashoffset = BADGE_C.toFixed(1);
    this.badge.append(ring, h('span', { cls: 'badge-disc' }, this.badgeImg));
  }

  /** The red whistle bar (Egg, Inc.'s hatch bar): dog glyph, caption, stock count and a slim stock bar. */
  private buildWhistle(): void {
    this.whistle.append(
      h(
        'span',
        { cls: 'whistle-main' },
        icon('dog', { size: 34, color: '#fff' }),
        h('span', { cls: 'whistle-text' }, h('b', { text: 'WHISTLE' }), this.whistleSub),
        this.stockValue,
      ),
      h('span', { cls: 'whistle-meter' }, this.stockMeter.el),
    );
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

  /** Shrink the cash figure until number + unit word fit the centre column (re-measured only when the text shape changes). */
  private fitCash(num: string, unit: string): void {
    // measure with the widest text for this many integer digits ("$14.2" and "$14.21" must not size differently,
    // or the figure and the whole HUD would jitter while the number counts up)
    const m = /^(-?\$)(\d+)(?:\.\d+)?$/.exec(num);
    const key = m ? `${m[2].length}:${unit}` : `${num.length}:${unit}`;
    if (key === this.cashFitKey) return;
    this.cashFitKey = key;
    const real = this.cash.textContent;
    if (m) this.cash.textContent = `${m[1]}${'8'.repeat(m[2].length)}.88`;
    const line = this.cashLine;
    line.style.removeProperty('--cash-fs');
    line.style.removeProperty('--unit-fs');
    let fs = parseFloat(getComputedStyle(this.cash).fontSize) || 42;
    while (line.scrollWidth > line.clientWidth + 1 && fs > 22) {
      fs -= 2;
      line.style.setProperty('--cash-fs', `${fs}px`);
      line.style.setProperty('--unit-fs', `${Math.max(12, Math.round(fs * 0.4))}px`);
    }
    this.cash.textContent = real;
  }

  /** Update a chip; flash it when the value went up. */
  private setChip(ch: Chip, n: number, text: string): void {
    setText(ch.val, text);
    if (Number.isFinite(ch.last) && n > ch.last) bump(ch.el);
    ch.last = n;
  }

  update(): void {
    const s = this.c.state;
    const home = this.c.home;
    const inShow = this.c.viewingShow;
    const d = computeStats(s);
    const hd = inShow ? computeStats(home) : d;
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
    const cp = moneyParts(this.cashAnim.step(dt));
    setText(this.cash, cp.num);
    setText(this.cashUnit, cp.unit);
    this.fitCash(cp.num, cp.unit);
    setText(this.income, `+${formatMoney(d.incomePerSec)}/s` + (d.zoomieMult > 1.001 ? `  ×${d.zoomieMult.toFixed(2)}` : ''));
    // meta currencies, Park Level and Pup Rank always belong to the home save
    this.setChip(this.bones, Math.floor(home.goldenBones), formatNumber(Math.floor(home.goldenBones)));
    this.setChip(this.level, hd.parkLevel, `LV ${hd.parkLevel}`);
    this.setChip(this.stars, Math.floor(home.premium.stars), formatNumber(Math.floor(home.premium.stars)));
    this.setChip(this.paws, home.spiritPaws, formatNumber(home.spiritPaws));
    setText(this.rank.val, hd.pupRankTitle.toUpperCase());
    this.rank.el.title = `Pup Rank ${hd.pupRank + 1}: ${hd.pupRankTitle}`;

    // Dog Show band: gold tint + caption while the show park is on screen
    setClass(this.strip, 'show-mode', inShow);
    setHidden(this.showBand, !inShow);
    if (inShow && home.show) {
      const end = showWindow(home.show.weekKey).end;
      setText(this.showBandText, `DOG SHOW  ·  ${formatDuration(Math.max(0, (end - Date.now()) / 1000)).toUpperCase()} LEFT`);
    }

    // the Portal button appears once the gate exists; a red dot says a crew is back
    const pb = this.navBtns.get('portal');
    if (pb) {
      setHidden(pb, !home.portal);
      const ready = !!home.portal && home.portal.slots.some((e) => !!e && Date.now() >= e.returnsAt);
      setClass(pb, 'has-dot', ready);
    }

    const f = FINDS[s.findIndex];
    setArt(this.badgeImg, 'find', s.findIndex, 40);
    const nf = nextFind(s);
    const ready = !!nf && d.parkValue >= nf.unlockParkValue && !inShow;
    setHidden(this.upgradePill, !ready || inShow);
    setClass(this.badge, 'ready', ready);

    // next-goal: log-scale progress from the current find's gate to the next one, shown as the badge ring
    let frac = 1;
    if (nf) {
      const cur = Math.max(1, FINDS[s.findIndex]?.unlockParkValue ?? 1);
      const next = Math.max(cur * 1.0001, nf.unlockParkValue);
      const pv = Math.max(1, d.parkValue);
      frac = (Math.log(pv) - Math.log(cur)) / (Math.log(next) - Math.log(cur));
      const off = (BADGE_C * (1 - Math.max(0, Math.min(1, ready ? 1 : frac)))).toFixed(1);
      if (this.badgeFill.style.strokeDashoffset !== off) this.badgeFill.style.strokeDashoffset = off;
    } else if (this.badgeFill.style.strokeDashoffset !== '0.0') this.badgeFill.style.strokeDashoffset = '0.0';
    const pct = Math.floor(Math.max(0, Math.min(1, frac)) * 100);
    setText(this.findLine, inShow ? `${f?.name ?? '?'}  ·  show park` : nf ? (ready ? `${f?.name ?? '?'}` : `${f?.name ?? '?'}  ·  ${pct}%`) : `${f?.name ?? '?'}  ·  all finds`);
    this.findLine.title = nf ? `${f?.name ?? '?'} Era: ${ready ? 'next find ready' : `${pct}% to ${nf.name}`}` : `${f?.name ?? '?'} Era: all finds discovered`;

    const pups = Math.floor(s.pups);
    const full = d.kennelCapacity - s.pups < 1;
    setText(this.pups, `${formatNumber(pups)} / ${formatNumber(Math.floor(d.kennelCapacity))}` + (full ? ' FULL' : ''));
    setClass(this.pupsChip, 'full', full);

    // income and pups share a line; stack them when they would collide (with hysteresis, so the HUD never flaps between heights)
    const subKey = `${this.income.textContent}|${this.pups.textContent}`;
    if (subKey !== this.subKey) {
      this.subKey = subKey;
      const need = this.income.scrollWidth + this.pupsChip.offsetWidth + 12;
      const avail = this.subLine.clientWidth;
      if (!this.subStacked && need > avail) this.subStacked = true;
      else if (this.subStacked && need < avail - 30) this.subStacked = false;
      setClass(this.subLine, 'stack', this.subStacked);
    }

    const digBott = d.bottleneck === 'dig';
    setText(this.dig, `DIG ${formatNumber(d.digPerSec)}/s${digBott ? '  limit' : ''}`);
    setText(this.ship, `SHIP ${formatNumber(d.shipPerSec)}/s${digBott ? '' : '  limit'}`);
    setClass(this.dig, 'limit', digBott);
    setClass(this.ship, 'limit', !digBott);

    const stockFrac = d.adoptionCap > 0 ? Math.max(0, Math.min(1, s.adoptionStock / d.adoptionCap)) : 0;
    setText(this.stockValue, `${Math.floor(s.adoptionStock)} / ${Math.floor(d.adoptionCap)}`);
    setMeter(this.stockMeter, stockFrac);
    setText(this.whistleSub, s.adoptionStock < 1 ? 'no stock' : full ? 'park full' : 'hold to adopt');
    setClass(this.whistle, 'empty', s.adoptionStock < 1 || full);

    setText(this.zoomLabel, `ZOOMIES ×${d.zoomieMult.toFixed(2)}`);
    setText(this.zoomCount, `${Math.floor(s.zoomies)} / ${Math.floor(d.maxZoomies)}`);
    setMeter(this.zoomMeter, d.maxZoomies > 0 ? s.zoomies / d.maxZoomies : 0);
    setClass(this.zoomMeter.el, 'hot', s.zoomies >= 1 && !reducedMotion());

    // active treats: one chip per treat, built once, only the time text updates
    const seen = new Set<string>();
    for (const t of s.treats) {
      seen.add(t.id);
      let chip = this.treatChips.get(t.id);
      if (!chip) {
        const def = TREATS.find((x) => x.id === t.id);
        const tx = h('span');
        chip = { el: h('span', { cls: 'treat-chip' }, artImg('treat', t.id, 22), h('b', { text: `×${def?.multiplier ?? ''}` }), tx), t: tx };
        this.treatChips.set(t.id, chip);
        this.treatRow.append(chip.el);
      }
      setText(chip.t, formatDuration(t.remaining));
    }
    for (const [id, chip] of this.treatChips) {
      if (!seen.has(id)) {
        chip.el.remove();
        this.treatChips.delete(id);
      }
    }
  }
}
