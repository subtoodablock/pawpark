import { h, type Child } from './dom';

export interface ModalAction {
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

let host: HTMLElement | null = null;
/** Modals wait their turn so a Welcome Back and an Endgame never stack. */
let openCount = 0;
const queue: (() => void)[] = [];

export function initModal(parent: HTMLElement): void {
  host = parent;
}

export function showModal(title: string, body: Child[], actions: ModalAction[]): () => void {
  if (!host) return () => {};
  if (openCount > 0) {
    let closer: (() => void) | null = null;
    let cancelled = false;
    queue.push(() => {
      if (!cancelled) closer = showModal(title, body, actions);
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
    overlay.remove();
    openCount--;
    queue.shift()?.();
  };
  const buttons = actions.map((a) =>
    h('button', {
      cls: 'btn ' + (a.primary ? 'primary ' : '') + (a.danger ? 'danger' : ''),
      text: a.label,
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
  return close;
}
