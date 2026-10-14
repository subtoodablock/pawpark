import { h, setClass } from './dom';
import type { Panel } from './panels/common';

export interface TabDef {
  id: string;
  icon: string;
  label: string;
  panel: Panel;
}

/** Bottom tab bar + slide-up sheet. */
export class Sheet {
  readonly sheet: HTMLElement;
  readonly tabbar: HTMLElement;
  private body = h('div', { cls: 'sheet-body' });
  private title = h('div', { cls: 'sheet-title' });
  private active: TabDef | null = null;
  private buttons = new Map<string, HTMLButtonElement>();

  constructor(private tabs: TabDef[]) {
    const close = h('button', { cls: 'sheet-close', text: '✕', attrs: { 'aria-label': 'Close panel' }, on: { click: () => this.open(null) } });
    this.sheet = h('div', { cls: 'sheet' }, h('div', { cls: 'sheet-head' }, this.title, close), this.body);
    this.sheet.hidden = true;
    this.tabbar = h('nav', { cls: 'tabbar' });
    for (const t of tabs) {
      const b = h(
        'button',
        { cls: 'tab', attrs: { type: 'button' }, on: { click: () => this.open(this.active === t ? null : t) } },
        h('span', { cls: 'tab-icon', text: t.icon }),
        h('span', { cls: 'tab-label', text: t.label }),
      );
      this.buttons.set(t.id, b);
      this.tabbar.append(b);
    }
  }

  open(t: TabDef | null): void {
    this.active = t;
    for (const tab of this.tabs) setClass(this.buttons.get(tab.id)!, 'on', tab === t);
    if (!t) {
      this.sheet.hidden = true;
      return;
    }
    this.title.textContent = `${t.icon} ${t.label}`;
    this.body.replaceChildren(t.panel.el);
    this.sheet.hidden = false;
    this.body.scrollTop = 0;
    t.panel.update();
  }

  /** Refresh only the visible panel. */
  update(): void {
    if (this.active) this.active.panel.update();
  }
}
