import { h, setClass } from './dom';
import { reducedMotion } from './motion';
import type { Panel } from './panels/common';

export interface TabDef {
  id: string;
  icon: string;
  label: string;
  panel: Panel;
  /** no tab-bar button; opened via openById (e.g. from a HUD chip) */
  hidden?: boolean;
}

/** Bottom tab bar (sliding pill) + spring bottom sheet with drag-to-dismiss. */
export class Sheet {
  /** layer element to mount in the game root (holds backdrop + sheet) */
  readonly sheet: HTMLElement;
  readonly tabbar: HTMLElement;
  private panelEl = h('div', { cls: 'sheet', attrs: { role: 'dialog', 'aria-label': 'Panel' } });
  private backdrop = h('div', { cls: 'sheet-backdrop' });
  private body = h('div', { cls: 'sheet-body' });
  private title = h('div', { cls: 'sheet-title' });
  private pill = h('div', { cls: 'tab-pill' });
  private active: TabDef | null = null;
  private buttons = new Map<string, HTMLButtonElement>();
  private closeTimer = 0;

  constructor(private tabs: TabDef[]) {
    const close = h('button', { cls: 'sheet-close', text: '✕', attrs: { 'aria-label': 'Close panel', type: 'button' }, on: { click: () => this.open(null) } });
    const grab = h('div', { cls: 'sheet-grab' }, h('div', { cls: 'sheet-handle' }), h('div', { cls: 'sheet-head' }, this.title, close));
    // keep the close button from starting a drag
    close.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.panelEl.append(grab, this.body);
    this.sheet = h('div', { cls: 'sheet-layer' }, this.backdrop, this.panelEl);
    this.sheet.hidden = true;
    this.backdrop.addEventListener('click', () => this.open(null));
    this.setupDrag(grab);

    this.tabbar = h('nav', { cls: 'tabbar' }, this.pill);
    for (const t of tabs) {
      if (t.hidden) continue;
      const b = h(
        'button',
        { cls: 'tab', attrs: { type: 'button' }, on: { click: () => this.open(this.active === t ? null : t) } },
        h('span', { cls: 'tab-icon', text: t.icon }),
        h('span', { cls: 'tab-label', text: t.label }),
      );
      this.buttons.set(t.id, b);
      this.tabbar.append(b);
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.placePill(true)).observe(this.tabbar);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.active) this.open(null);
    });
  }

  private placePill(snap = false): void {
    const t = this.active;
    const b = t ? this.buttons.get(t.id) : undefined;
    if (!b || b.offsetWidth === 0) {
      setClass(this.pill, 'on', false);
      return;
    }
    const first = !this.pill.classList.contains('on');
    if (snap || first || reducedMotion()) {
      this.pill.classList.add('snap');
      void this.pill.offsetWidth;
    }
    this.pill.style.width = `${b.offsetWidth}px`;
    this.pill.style.transform = `translateX(${b.offsetLeft}px) scale(1)`;
    setClass(this.pill, 'on', true);
    if (this.pill.classList.contains('snap')) {
      requestAnimationFrame(() => requestAnimationFrame(() => this.pill.classList.remove('snap')));
    }
  }

  open(t: TabDef | null): void {
    const prev = this.active;
    this.active = t;
    for (const tab of this.tabs) {
      const b = this.buttons.get(tab.id);
      if (b) setClass(b, 'on', tab === t);
    }
    this.placePill();
    if (t) {
      const b = this.buttons.get(t.id);
      const ico = b?.querySelector('.tab-icon');
      if (ico && t !== prev && !reducedMotion()) {
        ico.classList.remove('hop');
        void (ico as HTMLElement).offsetWidth;
        ico.classList.add('hop');
      }
    }
    if (!t) {
      this.close();
      return;
    }
    window.clearTimeout(this.closeTimer);
    this.title.textContent = `${t.icon} ${t.label}`;
    this.body.replaceChildren(t.panel.el);
    this.body.scrollTop = 0;
    t.panel.update();
    this.stagger();

    const wasOpen = !this.sheet.hidden && this.sheet.classList.contains('open');
    this.sheet.classList.remove('closing');
    this.panelEl.style.transform = '';
    this.panelEl.classList.remove('dragging', 'settle');
    if (!wasOpen) {
      this.sheet.hidden = false;
      void this.sheet.offsetWidth; // commit the closed transform first
      requestAnimationFrame(() => this.sheet.classList.add('open'));
    }
  }

  /** Re-trigger the rise-in on a panel's top-level children. */
  private stagger(): void {
    if (reducedMotion()) return;
    const root = this.body.firstElementChild as HTMLElement | null;
    if (!root) return;
    const kids = root.classList.contains('panel-stack') ? Array.from(root.children).flatMap((c) => Array.from(c.children)) : Array.from(root.children);
    kids.slice(0, 14).forEach((k, i) => (k as HTMLElement).style.setProperty('--i', String(i)));
    this.body.classList.remove('enter');
    void this.body.offsetWidth;
    this.body.classList.add('enter');
    window.setTimeout(() => this.body.classList.remove('enter'), 900);
  }

  private close(): void {
    if (this.sheet.hidden) return;
    this.sheet.classList.add('closing');
    this.sheet.classList.remove('open');
    this.panelEl.classList.remove('dragging');
    this.panelEl.style.transform = '';
    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(
      () => {
        if (!this.active) {
          this.sheet.hidden = true;
          this.sheet.classList.remove('closing');
        }
      },
      reducedMotion() ? 0 : 280,
    );
  }

  /** Drag the handle/header down to dismiss; fast flicks close regardless of distance. */
  private setupDrag(grab: HTMLElement): void {
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let dragging = false;
    let id = -1;
    grab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      dragging = true;
      id = e.pointerId;
      startY = lastY = e.clientY;
      lastT = e.timeStamp;
      vel = 0;
      try {
        grab.setPointerCapture(id);
      } catch {
        /* ignore */
      }
      this.panelEl.classList.remove('settle');
      this.panelEl.classList.add('dragging');
    });
    grab.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== id) return;
      const dy = e.clientY - startY;
      const dt = Math.max(1, e.timeStamp - lastT);
      vel = vel * 0.6 + ((e.clientY - lastY) / dt) * 0.4;
      lastY = e.clientY;
      lastT = e.timeStamp;
      // rubber-band upward drags
      const y = dy < 0 ? dy * 0.18 : dy;
      this.panelEl.style.transform = `translateY(${y}px)`;
      this.backdrop.style.opacity = String(Math.max(0, 1 - Math.max(0, y) / 400));
    });
    const end = (e: PointerEvent): void => {
      if (!dragging || e.pointerId !== id) return;
      dragging = false;
      try {
        grab.releasePointerCapture(id);
      } catch {
        /* ignore */
      }
      const dy = e.clientY - startY;
      this.panelEl.classList.remove('dragging');
      this.backdrop.style.opacity = '';
      const fresh = e.timeStamp - lastT < 90; // a pause before release cancels the flick
      if (e.type !== 'pointercancel' && ((fresh && vel > 0.45 && dy > 24) || dy > this.panelEl.offsetHeight * 0.3)) {
        this.open(null);
      } else {
        this.panelEl.classList.add('settle');
        this.panelEl.style.transform = '';
        window.setTimeout(() => this.panelEl.classList.remove('settle'), 450);
      }
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  }

  setBadge(id: string, on: boolean): void {
    const b = this.buttons.get(id);
    if (b) setClass(b, 'badge', on);
  }

  openById(id: string): void {
    const t = this.tabs.find((x) => x.id === id);
    if (t) this.open(t);
  }

  /** Refresh only the visible panel. */
  update(): void {
    if (this.active) this.active.panel.update();
  }
}
