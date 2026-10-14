// Motion helpers: reduced-motion flag, damped count-up, replayable class animations and
// floating numbers. Calm by design (docs/12 section 3): no particle bursts, no overshoot.

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
      { transform: `translate(${x}px, ${y}px) translate(-50%, 0) scale(1)`, opacity: 0 },
      { transform: `translate(${x}px, ${y - rise * 0.35}px) translate(-50%, 0) scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${x}px, ${y - rise}px) translate(-50%, 0) scale(1)`, opacity: 0 },
    ],
    { duration: opts.ms ?? 1100, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
  );
  a.onfinish = a.oncancel = () => el.remove();
}
