import { h, type Child } from './dom';

export interface ModalAction {
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

let host: HTMLElement | null = null;

export function initModal(parent: HTMLElement): void {
  host = parent;
}

export function showModal(title: string, body: Child[], actions: ModalAction[]): () => void {
  if (!host) return () => {};
  const close = (): void => overlay.remove();
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
