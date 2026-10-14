import {
  ACADEMY,
  AUTO_PRESTIGE_THRESHOLDS,
  TRAINING,
  TRAINING_TIERS,
  TREATS,
  academyCost,
  buyAcademy,
  buyTraining,
  buyTreat,
  computeStats,
  formatDuration,
  formatMoney,
  formatNumber,
  isTrainingTierUnlocked,
  setAutoPrestigeThreshold,
  setAutomation,
  statValue,
  trainingCost,
  trainingMaxBuy,
} from '../../core';
import type { AcademyDef, AutomationKey, TrainingDef, UpgradeDef } from '../../core';
import type { GameController } from '../GameController';
import { h, meter, setClass, setHidden, setMeter, setText, type Meter } from '../dom';
import { burst, textPop, type BurstKind } from '../motion';
import { describeStat, formatTreatDuration, statTotal } from '../labels';
import { setBtn, type Panel } from './common';

export type ResearchTab = 'common' | 'epic';

export interface ResearchPanel extends Panel {
  showTab(t: ResearchTab): void;
}

function burstKind(label: string): BurstKind {
  return label.includes('\u{1F9B4}') ? 'bones' : label.includes('⭐') ? 'stars' : 'coins';
}

/** Click handler for a buy button: burst + pop only when the buy worked (the button may vanish when maxed). */
function onBuyClick(btn: HTMLButtonElement, buy: () => boolean | void, pops: HTMLElement[]): void {
  btn.addEventListener('click', () => {
    const r = btn.getBoundingClientRect();
    const kind = burstKind(btn.textContent ?? '');
    const ok = buy();
    if (ok === false) return;
    burst({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, kind, 8);
    for (const p of pops) textPop(p);
  });
}

interface LevelCard {
  el: HTMLElement;
  bar: Meter;
  total: HTMLElement;
  btn: HTMLButtonElement;
  check: HTMLElement;
}

/** An Egg Inc style research card: icon + max pill, caps name, effect text, progress + total, buy / check. */
function levelCard(def: UpgradeDef, buy: () => boolean): LevelCard {
  const d = describeStat(def.stat, def.perLevel);
  const pill = h('div', { cls: 'rcard-max', text: `×${def.maxLevel}`, attrs: { title: 'Max level' } });
  const bar = meter('rbar');
  const total = h('span', { cls: 'rcard-total' });
  const btn = h('button', { cls: 'btn buy', attrs: { type: 'button' } });
  const check = h('div', { cls: 'rcard-check', text: '✓', attrs: { role: 'img', 'aria-label': 'Maxed' } });
  check.hidden = true;
  onBuyClick(btn, buy, [total, pill]);
  const el = h(
    'div',
    { cls: 'rcard', attrs: { title: def.description } },
    h('div', { cls: 'rcard-ico' }, h('div', { cls: 'rcard-icon', text: def.icon }), pill),
    h(
      'div',
      { cls: 'rcard-main' },
      h('div', { cls: 'rcard-name', text: def.name }),
      h('div', { cls: 'rcard-desc' }, d.pre, d.hi ? h('b', { cls: 'hi', text: d.hi }) : null, d.post),
      h('div', { cls: 'rcard-foot' }, h('div', { cls: 'rcard-prog' }, bar.el, total), btn, check),
    ),
  );
  return { el, bar, total, btn, check };
}

function setMaxed(card: LevelCard, maxed: boolean): void {
  setHidden(card.btn, maxed);
  setHidden(card.check, !maxed);
  setClass(card.el, 'maxed', maxed);
}

/** Section header in white display caps. */
function sectionHead(title: string, sub = ''): { el: HTMLElement; lock: HTMLElement } {
  const lock = h('span', { cls: 'tier-lock' });
  const el = h('div', { cls: 'tier-head' }, h('b', { text: title }), sub ? h('span', { text: sub }) : null, lock);
  return { el, lock };
}

interface PackDef {
  key: AutomationKey;
  icon: string;
  name: string;
  desc: string;
  /** Academy stat that unlocks it (undefined = free) */
  stat?: 'autoBuild' | 'autoTraining' | 'autoWhistle' | 'autoPrestige';
}

const PACK: PackDef[] = [
  { key: 'find', icon: '\u{1F50D}', name: 'Find Scout', desc: 'Upgrades your find as soon as the park can afford it.' },
  { key: 'build', icon: '\u{1F528}', name: 'Foreman Pup', desc: 'Buys kennel and vehicle upgrades.', stat: 'autoBuild' },
  { key: 'training', icon: '\u{1F393}', name: 'Head Trainer', desc: 'Buys Training levels.', stat: 'autoTraining' },
  { key: 'whistle', icon: '\u{1F4EF}', name: 'Volunteer Walkers', desc: 'Adopt pups from your stock automatically.', stat: 'autoWhistle' },
  { key: 'prestige', icon: '\u{1F3DE}️', name: 'Retirement Planner', desc: 'Opens a new park when the Spirit Paw gain is big enough.', stat: 'autoPrestige' },
];

const ACADEMY_GROUPS: { title: string; sub: string; test: (d: AcademyDef) => boolean }[] = [
  { title: 'TIER 1', sub: 'Helpers', test: (d) => d.stat.startsWith('auto') },
  {
    title: 'TIER 2',
    sub: 'Being away',
    test: (d) => d.stat === 'offlineHours' || d.stat === 'mailCapacity' || d.stat === 'squirrelHound' || d.stat === 'squirrelRate',
  },
  { title: 'TIER 3', sub: 'Power', test: () => true },
];

export function createResearchPanel(c: GameController): ResearchPanel {
  let tab: ResearchTab = 'common';
  let maxMode = false;

  // ---------------------------------------------------------------- big tabs
  const tabCommon = h('button', { cls: 'bigtab blue on', text: 'COMMON', attrs: { type: 'button' }, on: { click: () => showTab('common') } });
  const tabEpic = h('button', { cls: 'bigtab purple', text: 'EPIC', attrs: { type: 'button' }, on: { click: () => showTab('epic') } });
  const tabs = h('div', { cls: 'big-tabs', attrs: { role: 'tablist' } }, tabCommon, tabEpic);

  // ---------------------------------------------------------------- COMMON (Training)
  const x1 = h('button', { cls: 'seg on', text: '×1', attrs: { type: 'button' }, on: { click: () => setMode(false) } });
  const xm = h('button', { cls: 'seg', text: '×MAX', attrs: { type: 'button' }, on: { click: () => setMode(true) } });
  function setMode(m: boolean): void {
    maxMode = m;
    setClass(x1, 'on', !m);
    setClass(xm, 'on', m);
    update();
  }
  const common = h(
    'div',
    { cls: 'research-body tone-blue' },
    h('div', { cls: 'r-toolbar' }, h('span', { text: 'Training resets when you open a new park.' }), h('div', { cls: 'segs' }, x1, xm)),
  );

  interface TierView {
    tier: number;
    unlockAt: number;
    head: ReturnType<typeof sectionHead>;
    rows: { def: TrainingDef; card: LevelCard }[];
  }
  const tiers: TierView[] = [];
  const tipDig = h('b');
  const tipValue = h('b');
  const tip = h(
    'div',
    { cls: 'tip-card' },
    h('div', { cls: 'tip-ico', text: '\u{1F4A1}' }),
    h(
      'div',
      { cls: 'tip-text' },
      h('div', { text: 'The effects of separate research items are compounding.' }),
      h('div', { cls: 'tip-eg' }, 'For example: (+100% & +100% = +300%)'),
      h('div', { cls: 'tip-now' }, 'Right now: dig ', tipDig, ' • find value ', tipValue),
    ),
    h('div', { cls: 'tip-ico', text: '\u{1F4A1}' }),
  );
  TRAINING_TIERS.forEach((t, ti) => {
    const head = sectionHead(`TIER ${t.tier}`, t.name);
    const rows = TRAINING.filter((d) => d.tier === t.tier).map((def) => {
      const card = levelCard(def, () => {
        const ok = c.check(buyTraining(c.state, def.id, maxMode ? Infinity : 1));
        update();
        return ok;
      });
      return { def, card };
    });
    common.append(head.el, ...rows.map((r) => r.card.el));
    if (ti === 0) common.append(tip);
    tiers.push({ tier: t.tier, unlockAt: t.unlockAt, head, rows });
  });

  // ---------------------------------------------------------------- EPIC (Pack, Academy, Treats)
  const epic = h('div', { cls: 'research-body tone-purple' });
  const bonesLine = h('div', { cls: 'r-balance' });
  epic.append(h('div', { cls: 'r-toolbar' }, h('span', { text: 'Epic research is permanent and paid in \u{1F9B4} Golden Bones.' }), bonesLine));

  // -- the Pack
  const packStatus = h('div', { cls: 'r-note' });
  epic.append(sectionHead('THE PACK', 'Automation').el, h('div', { cls: 'r-note', text: 'Your pups run the park while you are away. Unlock helpers in the Academy below, then switch them on or off here.' }), packStatus);

  const academyHead = sectionHead('ACADEMY', 'Permanent upgrades');
  const packRows = PACK.map((def) => {
    const stateEl = h('div', { cls: 'pack-state' });
    const hintEl = h('div', { cls: 'rcard-hint' });
    const btn = h('button', { cls: 'btn buy', attrs: { type: 'button' } });
    btn.addEventListener('click', () => {
      const s = c.state;
      if (computeStats(s).automationUnlocked[def.key]) c.check(setAutomation(s, def.key, !s.automation[def.key]));
      else academyHead.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      update();
    });
    const el = h(
      'div',
      { cls: 'rcard pack' },
      h('div', { cls: 'rcard-ico' }, h('div', { cls: 'rcard-icon', text: def.icon })),
      h(
        'div',
        { cls: 'rcard-main' },
        h('div', { cls: 'rcard-name', text: def.name }),
        h('div', { cls: 'rcard-desc', text: def.desc }),
        hintEl,
        h('div', { cls: 'rcard-foot' }, h('div', { cls: 'rcard-prog stack' }, stateEl), btn),
      ),
    );
    epic.append(el);
    return { def, el, stateEl, hintEl, btn };
  });
  const segBtns = AUTO_PRESTIGE_THRESHOLDS.map((t) => {
    const b = h('button', {
      cls: 'seg small',
      text: `+${Math.round(t * 100)}%`,
      attrs: { type: 'button' },
      on: {
        click: () => {
          c.check(setAutoPrestigeThreshold(c.state, t));
          update();
        },
      },
    });
    return { t, b };
  });
  const thrCard = h(
    'div',
    { cls: 'rcard thr' },
    h(
      'div',
      { cls: 'rcard-main' },
      h('div', { cls: 'rcard-name', text: 'Auto-prestige threshold' }),
      h('div', { cls: 'rcard-desc', text: 'Open a new park once it would add at least this many paws (relative to your Spirit Paws).' }),
      h('div', { cls: 'segs wide' }, ...segBtns.map((x) => x.b)),
    ),
  );
  epic.append(thrCard);

  // -- Academy, grouped into tiers
  epic.append(academyHead.el);
  const placed = new Set<string>();
  const acRows: { def: AcademyDef; card: LevelCard }[] = [];
  ACADEMY_GROUPS.forEach((g) => {
    const defs = ACADEMY.filter((d) => !placed.has(d.id) && g.test(d));
    if (!defs.length) return;
    const head = sectionHead(g.title, g.sub);
    head.el.classList.add('sub');
    epic.append(head.el);
    for (const def of defs) {
      placed.add(def.id);
      const card = levelCard(def, () => {
        const ok = c.check(buyAcademy(c.state, def.id));
        update();
        return ok;
      });
      acRows.push({ def, card });
      epic.append(card.el);
    }
  });

  // -- Treats
  epic.append(sectionHead('TREATS', 'Timed boosts').el);
  const trRows = TREATS.map((def) => {
    const stat = h('div', { cls: 'rcard-prog stack' });
    const btn = h('button', { cls: 'btn buy', attrs: { type: 'button' } });
    const star = h('button', { cls: 'btn buy star-buy', attrs: { type: 'button', title: 'Buy with Pup Stars' } });
    const pops: HTMLElement[] = [stat];
    onBuyClick(
      btn,
      () => {
        const ok = c.check(buyTreat(c.state, def.id, 'bones'));
        update();
        return ok;
      },
      pops,
    );
    onBuyClick(
      star,
      () => {
        const ok = c.check(buyTreat(c.state, def.id, 'stars'));
        if (ok) c.save();
        update();
        return ok;
      },
      pops,
    );
    const el = h(
      'div',
      { cls: 'rcard treat' },
      h('div', { cls: 'rcard-ico' }, h('div', { cls: 'rcard-icon', text: def.icon })),
      h(
        'div',
        { cls: 'rcard-main' },
        h('div', { cls: 'rcard-name', text: def.name }),
        h('div', { cls: 'rcard-desc', text: def.description }),
        h('div', { cls: 'rcard-foot' }, stat, h('div', { cls: 'rcard-btns' }, btn, star)),
      ),
    );
    epic.append(el);
    return { def, stat, btn, star };
  });

  const el = h('div', { cls: 'panel research' }, tabs, common, epic);
  epic.hidden = true;

  function showTab(t: ResearchTab): void {
    tab = t;
    setClass(tabCommon, 'on', t === 'common');
    setClass(tabEpic, 'on', t === 'epic');
    common.hidden = t !== 'common';
    epic.hidden = t !== 'epic';
    update();
  }

  // ---------------------------------------------------------------- refresh (≤4 Hz, active tab only)
  function updateCommon(): void {
    const s = c.state;
    const total = computeStats(s).totalTrainingLevels;
    setText(tipDig, `×${formatNumber(statValue(s, 'layRate'))}`);
    setText(tipValue, `×${formatNumber(statValue(s, 'findValue'))}`);
    for (const t of tiers) {
      const unlocked = isTrainingTierUnlocked(s, t.tier);
      const need = Math.max(0, t.unlockAt - total);
      setText(t.head.lock, unlocked ? '' : `\u{1F512} Buy ${formatNumber(need)} more upgrade${need === 1 ? '' : 's'} to unlock`);
      setClass(t.head.el, 'locked', !unlocked);
      for (const { def, card } of t.rows) {
        const lvl = s.training[def.id] ?? 0;
        setClass(card.el, 'locked', !unlocked);
        setMeter(card.bar, lvl / def.maxLevel);
        setText(card.total, statTotal(def.stat, def.perLevel, lvl));
        if (lvl >= def.maxLevel) {
          setMaxed(card, true);
          continue;
        }
        setMaxed(card, false);
        const cost = trainingCost(s, def.id);
        if (cost === null) {
          setBtn(card.btn, '—', false);
          continue;
        }
        if (maxMode && unlocked) {
          const m = trainingMaxBuy(s, def.id);
          if (m.levels > 0) {
            setBtn(card.btn, `+${m.levels === Infinity ? '?' : formatNumber(m.levels)} • ${formatMoney(m.cost)}`, true);
            continue;
          }
        }
        setBtn(card.btn, formatMoney(cost), unlocked && s.cash >= cost);
      }
    }
  }

  function updateEpic(): void {
    const s = c.state;
    const d = computeStats(s);
    setText(bonesLine, `\u{1F9B4} ${formatNumber(Math.floor(s.goldenBones))}`);
    for (const r of packRows) {
      const unlocked = d.automationUnlocked[r.def.key];
      const on = unlocked && s.automation[r.def.key];
      setClass(r.el, 'locked', !unlocked);
      setText(r.stateEl, !unlocked ? '\u{1F512} LOCKED' : on ? 'ON' : 'OFF');
      setClass(r.stateEl, 'on', on);
      setClass(r.stateEl, 'off', !on);
      if (unlocked) {
        setText(r.hintEl, '');
        setHidden(r.hintEl, true);
        setBtn(r.btn, on ? 'Turn off' : 'Turn on', true);
      } else {
        const item = ACADEMY.find((a) => a.stat === r.def.stat);
        const cost = item ? academyCost(s, item.id) : null;
        setHidden(r.hintEl, false);
        setText(r.hintEl, item ? `Unlock: ${item.icon} ${item.name}` + (cost !== null ? ` • \u{1F9B4} ${formatNumber(cost)}` : '') : 'Locked');
        setBtn(r.btn, 'Academy', true);
      }
    }
    for (const x of segBtns) setClass(x.b, 'on', Math.abs(x.t - s.automation.prestigeThreshold) < 1e-9);
    setClass(thrCard, 'locked', !d.automationUnlocked.prestige);
    const ss = c.session;
    setText(packStatus, `This session: ${ss.autoFinds} auto find upgrade${ss.autoFinds === 1 ? '' : 's'} • ${ss.autoPrestiges} auto prestige${ss.autoPrestiges === 1 ? '' : 's'} • ${ss.houndCatches} hound catch${ss.houndCatches === 1 ? '' : 'es'}`);

    for (const { def, card } of acRows) {
      const lvl = s.academy[def.id] ?? 0;
      setMeter(card.bar, lvl / def.maxLevel);
      setText(card.total, statTotal(def.stat, def.perLevel, lvl));
      const cost = academyCost(s, def.id);
      if (cost === null) {
        setMaxed(card, true);
        continue;
      }
      setMaxed(card, false);
      setBtn(card.btn, `\u{1F9B4} ${formatNumber(cost)}`, s.goldenBones >= cost);
    }
    for (const { def, stat, btn, star } of trRows) {
      const active = s.treats.find((t) => t.id === def.id);
      setText(stat, active ? `⏱ Active: ${formatDuration(active.remaining)} left` : `×${def.multiplier} for ${formatTreatDuration(def.durationSec)}`);
      setClass(stat, 'on', !!active);
      setBtn(btn, `\u{1F9B4} ${formatNumber(def.cost)}`, s.goldenBones >= def.cost);
      setBtn(star, `⭐ ${formatNumber(def.starCost)}`, s.premium.stars >= def.starCost);
    }
  }

  function update(): void {
    if (tab === 'common') updateCommon();
    else updateEpic();
  }

  return { el, update, showTab };
}
