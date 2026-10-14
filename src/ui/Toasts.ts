import { h } from './dom';
import { rich } from './icons';
import { reducedMotion } from './motion';

export type ToastKind = 'info' | 'good' | 'warn' | 'gold';

let host: HTMLElement | null = null;
const MAX = 3;

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
  window.setTimeout(() => t.remove(), reducedMotion() ? 0 : 240);
}

/** `msg` may contain glyph tokens such as "{bone}" (see icons.ts). */
export function toast(msg: string, kind: ToastKind = 'info', ms = 3200): void {
  if (!host) return;
  const live = Array.from(host.children).filter((c) => !c.classList.contains('out'));
  const dup = live.find((c) => (c as HTMLElement).dataset.msg === msg);
  if (dup) {
    // the same message already showing: pulse it instead of stacking another copy
    dup.classList.remove('bump');
    void (dup as HTMLElement).offsetWidth;
    dup.classList.add('bump');
    return;
  }
  while (live.length >= MAX) dismiss(live.shift() as HTMLElement);
  const t = h('div', { cls: `toast ${kind}` }, ...rich(msg, 16));
  t.dataset.msg = msg;
  t.addEventListener('click', () => dismiss(t));
  host.appendChild(t);
  window.setTimeout(() => dismiss(t), ms);
}
