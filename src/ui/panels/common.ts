import { h, setClass, setDisabled, setText } from '../dom';
import { formatRatio } from '../eraUpgrade';
import { celebrateBuy, readyBounce } from '../motion';

export interface Panel {
  el: HTMLElement;
  update(): void;
}

export interface Row {
  el: HTMLElement;
  icon: HTMLElement;
  title: HTMLElement;
  desc: HTMLElement;
  meta: HTMLElement;
  btn: HTMLButtonElement;
}

/** `onBuy` may return false when the purchase failed; true/undefined plays the success burst. */
export function makeRow(icon: string, title: string, onBuy: () => boolean | void, desc = ''): Row {
  const iconEl = h('div', { cls: 'row-icon', text: icon });
  const titleEl = h('div', { cls: 'row-title', text: title });
  const descEl = h('div', { cls: 'row-desc', text: desc });
  const meta = h('div', { cls: 'row-meta' });
  const btn = h('button', { cls: 'btn buy', attrs: { type: 'button' } });
  btn.addEventListener('click', () => {
    const ok = onBuy();
    if (ok !== false) celebrateBuy(btn, [meta, iconEl]);
  });
  const el = h('div', { cls: 'row' }, iconEl, h('div', { cls: 'row-main' }, titleEl, descEl, meta), btn);
  return { el, icon: iconEl, title: titleEl, desc: descEl, meta, btn };
}

// last time setBtn ran per button, used to ignore stale state after a panel was closed
const lastSet = new WeakMap<HTMLButtonElement, number>();

/**
 * Sets label + enabled state. When the button flips from unaffordable to affordable
 * while the panel is live, plays the one-shot "ready" bounce + shine.
 */
export function setBtn(btn: HTMLButtonElement, label: string, enabled: boolean): void {
  const wasDisabled = btn.disabled;
  const now = performance.now();
  const prev = lastSet.get(btn);
  lastSet.set(btn, now);
  setText(btn, label);
  setDisabled(btn, !enabled);
  if (enabled && wasDisabled && prev !== undefined && now - prev < 1000 && btn.isConnected && !btn.hidden && btn.offsetParent !== null) {
    readyBounce(btn);
  }
}

/** Small "Era prices ×N" note; hidden in the first era (costScale 1). */
export function eraNote(): { el: HTMLElement; set(costScale: number): void } {
  const el = h('div', { cls: 'era-note', attrs: { title: 'Every cash price here is multiplied by the current era scale' } });
  el.hidden = true;
  let last = NaN;
  return {
    el,
    set(costScale: number): void {
      if (costScale === last) return;
      last = costScale;
      el.hidden = !(costScale > 1.0001);
      setText(el, `Era prices ×${formatRatio(costScale)}`);
    },
  };
}

export function section(title: string, ...kids: (Node | string)[]): HTMLElement {
  return h('div', { cls: 'section' }, h('h3', { text: title }), ...kids);
}

export { setClass };
