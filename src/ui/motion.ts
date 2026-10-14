// Motion helpers: reduced-motion flag, damped count-up, replayable class animations,
// and small pooled DOM particle effects (bursts, floating numbers).

let mq: MediaQueryList | null = null;
let reduced = false;
try {
  mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced = mq.matches;
  mq.addEventListener('change', (e) => {
    reduced = e.matches;
  });
} catch {
  /* no matchMedia */
}

/** Live reduced-motion flag. */
export function reducedMotion(): boolean {
  return reduced;
}

/** Replay a CSS animation class on an element; it removes itself when done. */
export function restart(el: HTMLElement, cls: string, fallbackMs = 900): void {
  if (reduced) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const done = (e?: Event): void => {
    if (e && e.target !== el) return;
    el.classList.remove(cls);
    el.removeEventListener('animationend', done);
  };
  el.addEventListener('animationend', done);
  window.setTimeout(() => done(), fallbackMs);
}

export const bump = (el: HTMLElement): void => restart(el, 'bump', 700);
export const textPop = (el: HTMLElement): void => restart(el, 't-pop', 700);

/** One-shot "ready" bounce + shine sweep (never loops). */
export function readyBounce(el: HTMLElement): void {
  restart(el, 'ready', 1100);
}

/**
 * Damped interpolation toward a target. `step(dt)` returns the new value.
 * `tau` ~ 0.05s settles in roughly 150ms.
 */
export class DampedValue {
  value: number;
  target: number;
  constructor(
    initial = 0,
    private tau = 0.05,
  ) {
    this.value = initial;
    this.target = initial;
  }
  set(target: number, snap = false): void {
    this.target = target;
    if (snap || reduced) this.value = target;
  }
  step(dt: number): number {
    const diff = this.target - this.value;
    if (diff === 0) return this.value;
    if (Math.abs(diff) <= Math.max(0.5, Math.abs(this.target) * 1e-5)) {
      this.value = this.target;
    } else {
      this.value += diff * (1 - Math.exp(-Math.max(0, dt) / this.tau));
    }
    return this.value;
  }
}

// ---------------------------------------------------------------- fx layer

let layer: HTMLElement | null = null;
export function fxLayer(): HTMLElement {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'fx-layer';
  document.body.appendChild(layer);
  return layer;
}

type Origin = Element | { x: number; y: number };
function originOf(o: Origin): { x: number; y: number } {
  if ('getBoundingClientRect' in o) {
    const r = o.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return o;
}

export type BurstKind = 'coins' | 'bones' | 'stars' | 'paws';

const pool: HTMLElement[] = [];
const MAX_POOL = 24;
function takeParticle(): HTMLElement {
  const el = pool.pop() ?? document.createElement('span');
  el.className = 'fx-p';
  el.textContent = '';
  return el;
}
function giveParticle(el: HTMLElement): void {
  el.remove();
  if (pool.length < MAX_POOL) pool.push(el);
}

/** 6-10 small particles popping from an element or point (Web Animations API). */
export function burst(from: Origin, kind: BurstKind = 'coins', n = 8): void {
  if (reduced) return;
  const { x, y } = originOf(from);
  const host = fxLayer();
  for (let i = 0; i < n; i++) {
    const el = takeParticle();
    const mix = kind === 'coins' ? i % 3 !== 0 : false;
    if (kind === 'coins') {
      if (mix) el.classList.add('fx-coin');
      else el.textContent = '\u{1F9B4}';
    } else if (kind === 'bones') el.textContent = i % 2 ? '\u{1F9B4}' : '\u{2728}';
    else if (kind === 'stars') el.textContent = i % 2 ? '\u{2B50}' : '\u{2728}';
    else el.textContent = '\u{1F43E}';
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
    const sp = 70 + Math.random() * 70;
    const vx = Math.cos(ang) * sp;
    const vy = Math.sin(ang) * sp;
    const g = 260;
    const life = 620 + Math.random() * 260;
    const spin = (Math.random() - 0.5) * 360;
    const frames: Keyframe[] = [];
    const steps = 8;
    for (let k = 0; k <= steps; k++) {
      const t = (k / steps) * (life / 1000);
      const s = k === 0 ? 0.4 : k < 3 ? 1.1 : 1 - (k / steps) * 0.4;
      frames.push({
        transform: `translate(${(x + vx * t).toFixed(1)}px, ${(y + vy * t + 0.5 * g * t * t).toFixed(1)}px) translate(-50%, -50%) rotate(${(spin * k) / steps}deg) scale(${s.toFixed(2)})`,
        opacity: k > steps - 3 ? 1 - (k - (steps - 3)) / 3 : 1,
      });
    }
    host.appendChild(el);
    const a = el.animate(frames, { duration: life, easing: 'linear', fill: 'forwards' });
    a.onfinish = a.oncancel = () => giveParticle(el);
  }
}

/** Rising, fading number ("+$1.2K"). */
export function floatText(from: Origin, text: string, opts: { rise?: number; ms?: number; color?: string } = {}): void {
  if (reduced) return;
  const { x, y } = originOf(from);
  const el = document.createElement('div');
  el.className = 'fx-float';
  el.textContent = text;
  if (opts.color) el.style.color = opts.color;
  const rise = opts.rise ?? 46;
  const host = fxLayer();
  while (host.querySelectorAll('.fx-float').length > 6) host.querySelector('.fx-float')?.remove();
  host.appendChild(el);
  const a = el.animate(
    [
      { transform: `translate(${x}px, ${y}px) translate(-50%, 0) scale(0.6)`, opacity: 0 },
      { transform: `translate(${x}px, ${y - rise * 0.35}px) translate(-50%, 0) scale(1.15)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${x}px, ${y - rise}px) translate(-50%, 0) scale(1)`, opacity: 0 },
    ],
    { duration: opts.ms ?? 1100, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
  );
  a.onfinish = a.oncancel = () => el.remove();
}

/** Success feedback for a buy button: particles + the given text pops. */
export function celebrateBuy(btn: HTMLElement, popTargets: HTMLElement[] = []): void {
  const label = btn.textContent ?? '';
  const kind: BurstKind = label.includes('\u{1F9B4}') ? 'bones' : label.includes('⭐') ? 'stars' : 'coins';
  burst(btn, kind, 8);
  for (const t of popTargets) textPop(t);
}
