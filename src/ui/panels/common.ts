import { h, setClass, setDisabled, setText } from '../dom';

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

export function makeRow(icon: string, title: string, onBuy: () => void, desc = ''): Row {
  const iconEl = h('div', { cls: 'row-icon', text: icon });
  const titleEl = h('div', { cls: 'row-title', text: title });
  const descEl = h('div', { cls: 'row-desc', text: desc });
  const meta = h('div', { cls: 'row-meta' });
  const btn = h('button', { cls: 'btn buy', attrs: { type: 'button' }, on: { click: onBuy } });
  const el = h('div', { cls: 'row' }, iconEl, h('div', { cls: 'row-main' }, titleEl, descEl, meta), btn);
  return { el, icon: iconEl, title: titleEl, desc: descEl, meta, btn };
}

export function setBtn(btn: HTMLButtonElement, label: string, enabled: boolean): void {
  setText(btn, label);
  setDisabled(btn, !enabled);
}

export function section(title: string, ...kids: (Node | string)[]): HTMLElement {
  return h('div', { cls: 'section' }, h('h3', { text: title }), ...kids);
}

export { setClass };
