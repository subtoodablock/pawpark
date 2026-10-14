import { h, type Child } from './dom';
import { confetti } from './fx/confetti';
import { reducedMotion } from './motion';

export interface ModalAction {
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

export interface ModalOpts {
  /** celebration modal: fires a confetti burst when it opens */
  celebrate?: boolean;
}

let host: HTMLElement | null = null;
/** Modals wait their turn so a Welcome Back and an Endgame never stack. */
let openCount = 0;
const queue: (() => void)[] = [];

export function initModal(parent: HTMLElement): void {
  host = parent;
}

export function showModal(title: string, body: Child[], actions: ModalAction[], opts: ModalOpts = {}): () => void {
  if (!host) return () => {};
  if (openCount > 0) {
    let closer: (() => void) | null = null;
    let cancelled = false;
    queue.push(() => {
      if (!cancelled) closer = showModal(title, body, actions, opts);
    });
    return () => {
      cancelled = true;
      closer?.();
    };
  }
  openCount++;
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    overlay.classList.add('closing');
    overlay.style.pointerEvents = 'none';
    window.setTimeout(() => overlay.remove(), reducedMotion() ? 0 : 190);
    openCount--;
    // let the leaving modal fade before the next one enters
    window.setTimeout(() => queue.shift()?.(), reducedMotion() ? 0 : 200);
  };
  const buttons = actions.map((a) =>
    h('button', {
      cls: 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'),
      text: a.label,
      attrs: { type: 'button' },
      on: {
        click: () => {
          close();
          a.onClick?.();
        },
      },
    }),
  );
  const overlay = h(
    'div',
    { cls: 'modal-overlay' },
    h(
      'div',
      { cls: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true' } },
      h('h2', { text: title }),
      h('div', { cls: 'modal-body' }, ...body),
      h('div', { cls: 'modal-actions' }, ...buttons),
    ),
  );
  host.appendChild(overlay);
  if (opts.celebrate) {
    window.setTimeout(() => {
      if (closed) return;
      const r = overlay.querySelector('.modal')?.getBoundingClientRect();
      confetti({ x: r ? r.left + r.width / 2 : undefined, y: r ? r.top + 30 : undefined });
    }, 220);
  }
  return close;
}
