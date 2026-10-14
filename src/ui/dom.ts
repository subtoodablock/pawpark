// Tiny DOM helpers.

export type Child = Node | string | number | null | undefined | false;

export interface Props {
  cls?: string;
  text?: string;
  attrs?: Record<string, string>;
  style?: string;
  on?: { [E in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[E]) => void };
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.cls) el.className = props.cls;
    if (props.text !== undefined) el.textContent = props.text;
    if (props.style) el.setAttribute('style', props.style);
    if (props.attrs) for (const k in props.attrs) el.setAttribute(k, props.attrs[k]);
    if (props.on) {
      for (const k in props.on) {
        const fn = (props.on as Record<string, EventListener>)[k];
        el.addEventListener(k, fn);
      }
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

/** Set text only when changed (cheap to call every frame). */
export function setText(el: HTMLElement, s: string): void {
  if (el.textContent !== s) el.textContent = s;
}

export function setDisabled(el: HTMLButtonElement, disabled: boolean): void {
  if (el.disabled !== disabled) el.disabled = disabled;
}

export function setClass(el: HTMLElement, cls: string, on: boolean): void {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}

export function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

export interface Meter {
  el: HTMLElement;
  fill: HTMLElement;
}

export function meter(cls = ''): Meter {
  const fill = h('div', { cls: 'meter-fill' });
  const el = h('div', { cls: 'meter ' + cls }, fill);
  return { el, fill };
}

export function setMeter(m: Meter, frac: number): void {
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  const w = (f * 100).toFixed(1) + '%';
  if (m.fill.style.width !== w) m.fill.style.width = w;
}
