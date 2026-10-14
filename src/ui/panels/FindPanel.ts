import { FINDS, TROPHIES, computeStats, formatMoney, formatNumber, nextFind } from '../../core';
import type { TrophyDef, TrophyKind } from '../../core';
import type { GameController } from '../GameController';
import { h, meter, setClass, setDisabled, setHidden, setMeter, setText } from '../dom';
import { confirmEraUpgrade } from '../eraUpgrade';
import { reducedMotion, restart } from '../motion';
import type { Panel } from './common';

type View = 'park' | 'trophies';
type CardState = 'current' | 'completed' | 'next' | 'discovered' | 'unknown';

export interface FindPanel extends Panel {
  showTab(t: View): void;
}

const TAGS: Record<CardState, string> = {
  current: 'CURRENT',
  completed: '✓ COMPLETED',
  next: 'NEXT ERA',
  discovered: 'DISCOVERED',
  unknown: '',
};

const KIND_TITLES: Record<TrophyKind, string> = {
  pups: '\u{1F415} Pups',
  lifetimeEarnings: '\u{1F4B0} Lifetime earnings',
  prestiges: '\u{1F3DE}️ Parks opened',
  find: '\u{1F9B4} Finds',
};

function thresholdLabel(t: TrophyDef): string {
  switch (t.kind) {
    case 'pups':
      return `${formatNumber(t.threshold)} pups`;
    case 'lifetimeEarnings':
      return `${formatMoney(t.threshold)} earned`;
    case 'prestiges':
      return `${formatNumber(t.threshold)} park${t.threshold === 1 ? '' : 's'}`;
    case 'find': {
      const f = FINDS[t.threshold];
      return f ? `${f.icon} ${f.name}` : `Find #${t.threshold + 1}`;
    }
  }
}

function rewardLabel(t: TrophyDef): string {
  const parts: string[] = [];
  if (t.collars > 0) parts.push(`+${t.collars}\u{1F3F7}️`);
  if (t.goldenBones > 0) parts.push(`+${formatNumber(t.goldenBones)}\u{1F9B4}`);
  return parts.join(' ');
}

/** Egg Inc "Farm" panel: Find carousel + Park Value + next-era action, plus the Trophies tab. */
export function createFindPanel(c: GameController, opts: { onPrestigeInfo: () => void }): FindPanel {
  let tab: View = 'park';
  let view = c.state.findIndex;

  // ---- big tabs
  const tabPark = h('button', { cls: 'bigtab blue on', text: 'PARK', attrs: { type: 'button' }, on: { click: () => showTab('park') } });
  const tabTro = h('button', { cls: 'bigtab green', text: 'TROPHIES', attrs: { type: 'button' }, on: { click: () => showTab('trophies') } });
  const tabs = h('div', { cls: 'big-tabs', attrs: { role: 'tablist' } }, tabPark, tabTro);

  // ---- hero: glossy art + name/value/flavor
  const discIcon = h('span', { cls: 'find-disc-ico' });
  const disc = h('div', { cls: 'find-disc' }, discIcon);
  const tag = h('span', { cls: 'find-tag' });
  const nameEl = h('div', { cls: 'find-name' });
  const valueEl = h('div', { cls: 'find-value' });
  const flavorEl = h('div', { cls: 'find-flavor' });
  const hero = h('div', { cls: 'find-hero' }, disc, h('div', { cls: 'find-info' }, tag, nameEl, valueEl, flavorEl));

  // ---- carousel nav
  const prevBtn = h('button', { cls: 'round-btn', text: '‹', attrs: { type: 'button', 'aria-label': 'Previous find' }, on: { click: () => go(view - 1) } });
  const nextBtn = h('button', { cls: 'round-btn', text: '›', attrs: { type: 'button', 'aria-label': 'Next find' }, on: { click: () => go(view + 1) } });
  const dots = FINDS.map((f, i) => h('button', { cls: 'dot', attrs: { type: 'button', 'aria-label': `Find ${i + 1}: ${f.name}` }, on: { click: () => go(i) } }, h('i')));
  const dotsEl = h('div', { cls: 'find-dots' }, ...dots);
  const nav = h('div', { cls: 'find-nav' }, prevBtn, dotsEl, nextBtn);

  // ---- park value + info popover
  const pvVal = h('b');
  const infoBtn = h('button', { cls: 'info-btn', text: 'i', attrs: { type: 'button', 'aria-label': 'About Park Value', 'aria-expanded': 'false' } });
  const pop = h('div', {
    cls: 'find-pop',
    text: "Park Value is roughly an hour of your earnings. Reach the next Find's value to start its era.",
    attrs: { role: 'note' },
  });
  pop.hidden = true;
  const pv = h('div', { cls: 'find-pv' }, h('span', { text: 'PARK VALUE:' }), pvVal, infoBtn);
  infoBtn.addEventListener('click', () => {
    pop.hidden = !pop.hidden;
    infoBtn.setAttribute('aria-expanded', String(!pop.hidden));
  });

  // ---- action area: start button or locked progress
  const startBtn = h('button', {
    cls: 'btn primary find-go',
    text: 'START NEXT ERA →',
    attrs: { type: 'button' },
    on: { click: () => confirmEraUpgrade(c, refreshAfterEra) },
  });
  const lockMeter = meter('find-lock-meter');
  const lockText = h('span', { cls: 'find-lock-text' });
  const lockBar = h('div', { cls: 'find-lock' }, lockMeter.el, lockText);
  const hint = h('div', { cls: 'find-hint' });
  const action = h('div', { cls: 'find-action' }, startBtn, lockBar, hint);

  const prestigeBar = h('button', { cls: 'btn purple find-prestige', text: 'PRESTIGE INFO →', attrs: { type: 'button' }, on: { click: () => opts.onPrestigeInfo() } });

  const parkCard = h('div', { cls: 'find-card' }, hero, nav, pv, pop, action, prestigeBar);

  // ---- swipe on the hero (horizontal only; vertical scrolls the sheet)
  let sx = 0;
  let sy = 0;
  let sid = -1;
  hero.addEventListener('pointerdown', (e) => {
    sid = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
  });
  const endSwipe = (e: PointerEvent): void => {
    if (e.pointerId !== sid) return;
    sid = -1;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (e.type === 'pointerup' && Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.4) go(view + (dx < 0 ? 1 : -1));
  };
  hero.addEventListener('pointerup', endSwipe);
  hero.addEventListener('pointercancel', endSwipe);
  hero.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(view - 1);
    if (e.key === 'ArrowRight') go(view + 1);
  });

  // ---- trophies tab
  const trophyEls = TROPHIES.map((t) => {
    const e = h(
      'div',
      { cls: 'trophy' },
      h('div', { cls: 'trophy-icon', text: t.icon }),
      h('div', { cls: 'trophy-name', text: t.name }),
      h('div', { cls: 'row-meta', text: thresholdLabel(t) }),
      h('div', { cls: 'row-meta', text: rewardLabel(t) }),
    );
    return { t, e };
  });
  const collars = h('div', { cls: 'find-collars' });
  const trophyGroups: Node[] = [];
  for (const kind of ['pups', 'lifetimeEarnings', 'prestiges', 'find'] as TrophyKind[]) {
    const items = trophyEls.filter((x) => x.t.kind === kind).sort((x, y) => x.t.threshold - y.t.threshold);
    if (!items.length) continue;
    trophyGroups.push(h('div', { cls: 'trophy-group', text: KIND_TITLES[kind] }), h('div', { cls: 'trophies' }, ...items.map((x) => x.e)));
  }
  const trophyView = h('div', { cls: 'find-trophies' }, collars, ...trophyGroups);
  trophyView.hidden = true;

  const el = h('div', { cls: 'panel find-panel' }, tabs, parkCard, trophyView);

  function showTab(t: View): void {
    tab = t;
    setClass(tabPark, 'on', t === 'park');
    setClass(tabTro, 'on', t === 'trophies');
    parkCard.hidden = t !== 'park';
    trophyView.hidden = t !== 'trophies';
    update();
  }

  function go(i: number): void {
    const n = Math.max(0, Math.min(FINDS.length - 1, i));
    if (n === view) return;
    const dir = n > view ? 'slide-next' : 'slide-prev';
    view = n;
    if (!reducedMotion()) restart(hero, dir, 500);
    update();
  }

  function refreshAfterEra(): void {
    view = c.state.findIndex;
    update();
  }

  function stateOf(i: number): CardState {
    const s = c.state;
    if (i === s.findIndex) return 'current';
    if (i < s.findIndex) return 'completed';
    if (i === s.findIndex + 1) return 'next';
    return i <= s.highestFindIndex ? 'discovered' : 'unknown';
  }

  function update(): void {
    const s = c.state;
    if (tab === 'trophies') {
      setText(collars, `\u{1F3F7}️ Legend Collars: ${s.legendCollars} (×${computeStats(s).collarMult.toFixed(3)} paw bonus)`);
      for (const { t, e } of trophyEls) setClass(e, 'owned', s.trophies.includes(t.id));
      return;
    }
    const d = computeStats(s);
    view = Math.max(0, Math.min(FINDS.length - 1, view));
    const f = FINDS[view];
    const st = stateOf(view);
    const unknown = st === 'unknown';

    setText(discIcon, f.icon);
    setClass(disc, 'silhouette', unknown);
    setClass(disc, 'dim', st === 'discovered');
    for (const k of Object.keys(TAGS) as CardState[]) setClass(tag, k, k === st);
    setText(tag, TAGS[st]);
    setHidden(tag, unknown);
    setText(nameEl, unknown ? '???' : f.name);
    setText(valueEl, `VALUE: ${unknown ? '???' : formatMoney(f.value)}`);
    setText(flavorEl, unknown ? 'Keep climbing the eras to discover what is buried here.' : f.flavor);
    setClass(hero, 'unknown', unknown);

    // dots
    dots.forEach((dot, i) => {
      const k = stateOf(i);
      setClass(dot, 'cur', k === 'current');
      setClass(dot, 'done', k === 'completed');
      setClass(dot, 'unk', k === 'unknown');
      setClass(dot, 'view', i === view);
      dot.setAttribute('aria-current', i === view ? 'true' : 'false');
    });
    setDisabled(prevBtn, view <= 0);
    setDisabled(nextBtn, view >= FINDS.length - 1);

    const nf = nextFind(s);
    const ready = !!nf && d.parkValue >= nf.unlockParkValue;
    setClass(nextBtn, 'ready', ready && view === s.findIndex);

    setText(pvVal, formatMoney(d.parkValue));

    // action for the viewed find
    const showStart = st === 'next' && ready;
    const showLock = st === 'next' && !ready;
    setHidden(startBtn, !showStart);
    setHidden(lockBar, !showLock);
    if (showLock && nf) {
      // log-scale progress from the current gate to the next, as in the HUD
      const cur = Math.max(1, FINDS[s.findIndex]?.unlockParkValue ?? 1);
      const next = Math.max(cur * 1.0001, nf.unlockParkValue);
      const frac = (Math.log(Math.max(1, d.parkValue)) - Math.log(cur)) / (Math.log(next) - Math.log(cur));
      setMeter(lockMeter, frac);
      setText(lockText, `Unlocks at Park Value ${formatMoney(nf.unlockParkValue)}`);
    }
    let hintText = '';
    if (st === 'next' && f.unlockReward > 0 && s.highestFindIndex < view) hintText = `First time: +${formatNumber(f.unlockReward)} \u{1F9B4} Golden Bones`;
    else if (st === 'discovered' || st === 'unknown') hintText = `Reach the ${FINDS[view - 1].icon} ${st === 'unknown' ? 'previous' : FINDS[view - 1].name} Era first.`;
    else if (st === 'current' && !nf) hintText = 'Every find discovered!';
    setText(hint, hintText);
    setHidden(hint, hintText === '');
  }

  return {
    el,
    update,
    showTab,
    onShow() {
      view = c.state.findIndex;
      pop.hidden = true;
      infoBtn.setAttribute('aria-expanded', 'false');
      showTab('park');
    },
  };
}
