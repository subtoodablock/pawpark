import { h } from './dom';

export type ToastKind = 'info' | 'good' | 'warn' | 'gold';

let host: HTMLElement | null = null;

export function initToasts(parent: HTMLElement): void {
  host = h('div', { cls: 'toasts', attrs: { 'aria-live': 'polite' } });
  parent.appendChild(host);
}

export function toast(msg: string, kind: ToastKind = 'info', ms = 3200): void {
  if (!host) return;
  while (host.children.length >= 4) host.firstElementChild?.remove();
  const t = h('div', { cls: `toast ${kind}`, text: msg });
  t.addEventListener('click', () => t.remove());
  host.appendChild(t);
  window.setTimeout(() => {
    t.classList.add('out');
    window.setTimeout(() => t.remove(), 300);
  }, ms);
}
