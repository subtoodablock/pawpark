import type { GameController } from '../GameController';
import { h, setClass } from '../dom';
import { icon, type IconName } from '../icons';
import type { Panel } from './common';
import { treatReady } from './TodayPanel';

interface Item {
  id: string;
  glyph: IconName;
  label: string;
  hint: string;
  tone: string;
}

const ITEMS: Item[] = [
  { id: 'today', glyph: 'calendar-check', label: 'Today', hint: 'Daily treat, digs, park of the day', tone: 'blue' },
  { id: 'kennels', glyph: 'house', label: 'Kennels', hint: 'House more pups', tone: 'blue' },
  { id: 'fleet', glyph: 'truck', label: 'Fleet', hint: 'Ship finds to market', tone: 'blue' },
  { id: 'park', glyph: 'tree', label: 'Park', hint: 'Prestige, stats and sharing', tone: 'green' },
  { id: 'settings', glyph: 'gear-six', label: 'Settings', hint: 'Save, import, reset', tone: 'purple' },
];

/** The small menu sheet behind the grid button (Egg, Inc. style list). */
export function createMenuPanel(c: GameController, open: (id: string) => void, openSettings: () => void): Panel {
  const dots = new Map<string, HTMLElement>();
  const rows = ITEMS.map((it) => {
    const dot = h('i', { cls: 'dot' });
    dots.set(it.id, dot);
    return h(
      'button',
      { cls: 'menu-row', attrs: { type: 'button' }, on: { click: () => (it.id === 'settings' ? openSettings() : open(it.id)) } },
      h('span', { cls: `menu-ico tone-${it.tone}` }, icon(it.glyph, { size: 26, color: '#fff' }), dot),
      h('span', { cls: 'menu-text' }, h('b', { text: it.label }), h('small', { text: it.hint })),
      icon('caret-right-bold', { size: 18, color: 'var(--ui-muted)' }),
    );
  });
  const el = h('div', { cls: 'panel menu-panel' }, ...rows);
  return {
    el,
    update() {
      const d = dots.get('today');
      if (d) setClass(d, 'on', treatReady(c));
    },
  };
}
