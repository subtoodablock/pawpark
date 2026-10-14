import { h, setClass, setDisabled } from '../dom';
import { rich, setRich } from '../icons';

export interface Panel {
  el: HTMLElement;
  update(): void;
  /** called by the Sheet each time the panel is opened */
  onShow?(): void;
}

export interface Row {
  el: HTMLElement;
  icon: HTMLElement;
  title: HTMLElement;
  desc: HTMLElement;
  meta: HTMLElement;
  btn: HTMLButtonElement;
}

/** `onBuy` may return false when the purchase failed (nothing else happens on success: calm feedback only). */
export function makeRow(icon: Node | null, title: string, onBuy: () => boolean | void, desc = ''): Row {
  const iconEl = h('div', { cls: 'row-icon' }, icon);
  const titleEl = h('div', { cls: 'row-title', text: title });
  const descEl = h('div', { cls: 'row-desc', text: desc });
  const meta = h('div', { cls: 'row-meta' });
  const btn = h('button', { cls: 'btn buy', attrs: { type: 'button' } });
  btn.addEventListener('click', () => {
    onBuy();
  });
  const el = h('div', { cls: 'row' }, iconEl, h('div', { cls: 'row-main' }, titleEl, descEl, meta), btn);
  return { el, icon: iconEl, title: titleEl, desc: descEl, meta, btn };
}

/** Swap a slot's content only when `key` changed (safe to call from update()). */
export function setSlot(slot: HTMLElement, key: string, build: () => Node): void {
  if (slot.dataset.k === key) return;
  slot.dataset.k = key;
  slot.replaceChildren(build());
}

/** Sets label (glyph tokens allowed) + enabled state. */
export function setBtn(btn: HTMLButtonElement, label: string, enabled: boolean): void {
  setRich(btn, label, 16);
  setDisabled(btn, !enabled);
}

/** White rounded card section with a thin condensed caps heading. */
export function section(title: string, ...kids: (Node | string)[]): HTMLElement {
  const head = h('h3', null, ...rich(title, 20));
  return h('div', { cls: 'section' }, head, ...kids);
}

export { setClass };
