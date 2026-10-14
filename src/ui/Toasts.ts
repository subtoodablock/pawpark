import { h } from './dom';
import { reducedMotion } from './motion';

export type ToastKind = 'info' | 'good' | 'warn' | 'gold';

let host: HTMLElement | null = null;
const MAX = 4;

export function initToasts(parent: HTMLElement): void {
  host = h('div', { cls: 'toasts', attrs: { 'aria-live': 'polite' } });
  parent.appendChild(host);
}

function dismiss(t: HTMLElement): void {
  if (t.classList.contains('out')) return;
  // freeze the height so the stack can collapse smoothly
  t.style.maxHeight = t.offsetHeight + 'px';
  void t.offsetHeight;
  t.classList.add('out');
  window.setTimeout(() => t.remove(), reducedMotion() ? 0 : 320);
}

export function toast(msg: string, kind: ToastKind = 'info', ms = 3200): void {
  if (!host) return;
  const live = Array.from(host.children).filter((c) => !c.classList.contains('out'));
  while (live.length >= MAX) dismiss(live.shift() as HTMLElement);
  const t = h('div', { cls: `toast ${kind}`, text: msg });
  t.addEventListener('click', () => dismiss(t));
  host.appendChild(t);
  window.setTimeout(() => dismiss(t), ms);
}
