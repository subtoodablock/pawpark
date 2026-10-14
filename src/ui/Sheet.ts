import { h, setClass } from './dom';
import { icon, type IconName } from './icons';
import { reducedMotion } from './motion';
import type { Panel } from './panels/common';

export type Tone = 'blue' | 'green' | 'purple' | 'red';

export interface TabDef {
  id: string;
  icon: IconName;
  label: string;
  panel: Panel;
  /** colour of the solid header block */
  tone: Tone;
  /** the panel draws its own big coloured tabs (Find, Research): the sheet header is hidden */
  ownHeader?: boolean;
  /** short menu-style sheet that sizes to its content */
  compact?: boolean;
}

/** Egg, Inc. style panel host: white rounded card, solid coloured header, red close circle. */
export class Sheet {
  /** layer element to mount in the game root (holds backdrop + panel) */
  readonly sheet: HTMLElement;
  private panelEl = h('div', { cls: 'sheet', attrs: { role: 'dialog', 'aria-label': 'Panel' } });
  private card = h('div', { cls: 'sheet-card' });
  private backdrop = h('div', { cls: 'sheet-backdrop' });
  private body = h('div', { cls: 'sheet-body' });
  private titleText = h('span');
  private title = h('div', { cls: 'sheet-title' });
  private head = h('div', { cls: 'sheet-head' });
  private active: TabDef | null = null;
  private closeTimer = 0;

  constructor(private tabs: TabDef[]) {
    const close = h('button', { cls: 'sheet-close', attrs: { 'aria-label': 'Close panel', type: 'button' }, on: { click: () => this.open(null) } }, icon('x-bold', { size: 18, color: '#fff' }));
    close.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.title.append(this.titleText);
    this.head.append(this.title);
    this.card.append(this.head, this.body);
    this.panelEl.append(this.card, close);
    this.sheet = h('div', { cls: 'sheet-layer' }, this.backdrop, this.panelEl);
    this.sheet.hidden = true;
    this.backdrop.addEventListener('click', () => this.open(null));
    this.setupDrag(this.head);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.active) this.open(null);
    });
  }

  get activeId(): string | null {
    return this.active?.id ?? null;
  }

  open(t: TabDef | null): void {
    this.active = t;
    if (!t) {
      this.close();
      return;
    }
    window.clearTimeout(this.closeTimer);
    this.titleText.textContent = t.label;
    this.title.replaceChildren(icon(t.icon, { size: 22 }), this.titleText);
    for (const tone of ['blue', 'green', 'purple', 'red']) this.panelEl.classList.remove(`tone-${tone}`);
    this.panelEl.classList.add(`tone-${t.tone}`);
    setClass(this.panelEl, 'own-header', !!t.ownHeader);
    setClass(this.panelEl, 'compact', !!t.compact);
    this.head.hidden = !!t.ownHeader;
    this.body.replaceChildren(t.panel.el);
    t.panel.onShow?.();
    t.panel.update();

    const wasOpen = !this.sheet.hidden && this.sheet.classList.contains('open');
    if (!wasOpen) this.sheet.hidden = false; // scrollTop is a no-op while display:none
    this.body.scrollTop = 0;
    this.sheet.classList.remove('closing');
    this.panelEl.style.transform = '';
    this.panelEl.classList.remove('dragging');
    if (!wasOpen) {
      void this.sheet.offsetWidth; // commit the closed transform first
      requestAnimationFrame(() => this.sheet.classList.add('open'));
    }
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
      reducedMotion() ? 0 : 220,
    );
  }

  /** Drag the header down to dismiss; fast flicks close regardless of distance. */
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
      this.panelEl.classList.add('dragging');
    });
    grab.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== id) return;
      const dy = e.clientY - startY;
      const dt = Math.max(1, e.timeStamp - lastT);
      vel = vel * 0.6 + ((e.clientY - lastY) / dt) * 0.4;
      lastY = e.clientY;
      lastT = e.timeStamp;
      const y = Math.max(0, dy);
      this.panelEl.style.transform = `translateY(${y}px)`;
      this.backdrop.style.opacity = String(Math.max(0, 1 - y / 400));
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
        this.panelEl.style.transform = '';
      }
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
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
