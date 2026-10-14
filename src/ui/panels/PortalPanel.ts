// Paw Portal panel (docs/11-paw-portal.md section 6): Expeditions, Collar, Collection, Craft, Crews.
// All data lives in state.home.portal. Views rebuild only when their signature changes, so taps never
// land on a freshly replaced button; countdown rings and numbers update in place.
import {
  CREWS,
  DIMENSIONS,
  EXPEDITION_LENGTHS,
  PORTAL_BUILD_COST,
  RARITY_NAMES,
  RELIC_EQUIP_SLOTS,
  RELIC_FAMILIES,
  RELIC_TIERS,
  SOCKETS_BY_RARITY,
  STONES,
  STONE_CRAFT_COUNT,
  STONE_TIERS,
  CRAFT_COUNT,
  buildPortal,
  collectAll,
  collectExpedition,
  craftCost,
  craftRelic,
  craftStone,
  craftXpBoost,
  craftableRelics,
  crewProgress,
  crewUnlocked,
  equipRelic,
  expeditionReady,
  familyDef,
  formatMoney,
  formatNumber,
  fuelBones,
  fuelCost,
  launchExpedition,
  parseStoneKey,
  recycleRelic,
  recycleValue,
  socketCapacity,
  socketStone,
  stoneKey,
  unequipRelic,
  unsocketStone,
} from '../../core';
import type { ExpeditionLength, GameState, Relic } from '../../core';
import type { GameController } from '../GameController';
import { h, setText } from '../dom';
import { icon, rich, type IconName } from '../icons';
import { showLootReveal } from '../lootReveal';
import { showModal } from '../Modal';
import {
  RARITY_CLASS,
  countdown,
  rarityName,
  relicEffectText,
  relicImg,
  relicTitle,
  roman,
  stoneEffectText,
  stoneImg,
  stoneName,
  tierLabel,
} from '../portalUi';
import { toast } from '../Toasts';
import type { Panel } from './common';

type Tab = 'exp' | 'collar' | 'coll' | 'craft' | 'crews';

const TABS: { id: Tab; label: string; glyph: IconName }[] = [
  { id: 'exp', label: 'EXPEDITIONS', glyph: 'rocket' },
  { id: 'collar', label: 'COLLAR', glyph: 'crown' },
  { id: 'coll', label: 'COLLECTION', glyph: 'cube' },
  { id: 'craft', label: 'CRAFT', glyph: 'hammer' },
  { id: 'crews', label: 'CREWS', glyph: 'dog' },
];

const CREW_COLORS = ['#20a63a', '#2f6fdc', '#7a1fd1', '#e8241c', '#f0801a', '#1d2333'];
const LEN_LABEL: Record<ExpeditionLength, string> = { short: 'SHORT', standard: 'STANDARD', long: 'LONG' };

/** 1800 -> "30M", 10800 -> "3H", 129600 -> "36H" */
function lenText(sec: number): string {
  if (sec < 3600) return `${Math.round(sec / 60)}M`;
  const hrs = sec / 3600;
  return `${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)}H`;
}

const crewIdx = (id: string): number => CREWS.findIndex((c) => c.id === id);
const dimName = (id: string): string => DIMENSIONS.find((d) => d.id === id)?.name ?? id;

function crewTile(i: number, size = 52): HTMLElement {
  return h('div', { cls: 'p-crew-tile', style: `width:${size}px;height:${size}px;background:${CREW_COLORS[i % CREW_COLORS.length]}` }, icon('dog', { size: Math.round(size * 0.58), color: '#fff' }));
}

function starRow(n: number, max: number, size = 16): HTMLElement {
  const row = h('span', { cls: 'p-stars' });
  for (let i = 0; i < max; i++) row.append(icon('star', { size, color: i < n ? 'var(--gold)' : '#d6dae0' }));
  return row;
}

export interface PortalPanel extends Panel {
  showTab(t: Tab): void;
}

export function createPortalPanel(c: GameController): PortalPanel {
  let tab: Tab = 'exp';
  const home = (): GameState => c.home;

  // exp state
  let picker: { slot: number; crew: string; dim: string; len: ExpeditionLength } | null = null;
  // collar state
  let collarSlot: number | null = null;
  // collection state
  let detail: { family: string; tier: number; id: number } | null = null;

  // ---------------------------------------------------------------- tab row
  const tabBtns = TABS.map((t) =>
    h('button', { cls: 'p-tab', attrs: { type: 'button', role: 'tab' }, on: { click: () => showTab(t.id) } }, icon(t.glyph, { size: 20, color: 'currentColor' }), h('span', { text: t.label }), h('i', { cls: 'dot' })),
  );
  const tabRow = h('div', { cls: 'p-tabs', attrs: { role: 'tablist' } }, ...tabBtns);
  const body = h('div', { cls: 'p-body' });
  const setBody = (...nodes: (Node | null)[]): void => body.replaceChildren(...(nodes.filter(Boolean) as Node[]));
  const el = h('div', { cls: 'panel portal-panel' }, tabRow, body);

  let lastSig = '';
  let ticker: (() => void) | null = null;

  function showTab(t: Tab): void {
    tab = t;
    picker = null;
    collarSlot = null;
    detail = null;
    lastSig = '';
    update();
    if (el.parentElement) el.parentElement.scrollTop = 0;
  }

  // ---------------------------------------------------------------- shared small builders
  const backBtn = (label: string, fn: () => void): HTMLElement =>
    h('button', { cls: 'p-back', attrs: { type: 'button' }, on: { click: fn } }, icon('caret-left-bold', { size: 16 }), h('span', { text: label }));

  const note = (text: string): HTMLElement => h('div', { cls: 'p-note' }, ...rich(text, 16));

  function relicCard(r: Relic, extra?: Node | null): HTMLElement {
    return h(
      'div',
      { cls: `p-relic ${RARITY_CLASS[r.rarity]}` },
      h('div', { cls: 'p-relic-art' }, relicImg(r, 48)),
      h('div', { cls: 'row-main' }, h('div', { cls: 'p-relic-name', text: relicTitle(r) }), h('div', { cls: 'p-relic-eff', text: relicEffectText(r) }), h('div', { cls: 'row-meta', text: `${tierLabel(r.tier)}${r.stones.length ? `  ·  ${r.stones.length} stone${r.stones.length === 1 ? '' : 's'}` : ''}` })),
      extra ?? null,
    );
  }

  const save = (): void => c.save();

  // ================================================================ EXPEDITIONS
  function expSig(): string {
    const s = home();
    const p = s.portal;
    if (!p) return 'none';
    const now = Date.now();
    const slots = p.slots.map((e, i) => (e ? `${i}:${e.crewId}:${e.dimensionId}:${e.length}:${expeditionReady(e, now) ? 'r' : 'a'}` : `${i}:-`)).join('|');
    let pk = '';
    if (picker) {
      pk = `${picker.slot}/${picker.crew}/${picker.dim}/${picker.len}/${s.cash >= fuelCost(s, picker.len) ? 1 : 0}${s.goldenBones >= fuelBones(picker.len) ? 1 : 0}`;
    }
    return `${p.built ? 'b' : 'u'}|${slots}|${pk}|${s.cash >= PORTAL_BUILD_COST ? 1 : 0}|${CREWS.map((cr) => (crewUnlocked(s, cr.id) ? 1 : 0)).join('')}`;
  }

  function buildExp(): void {
    ticker = null;
    const s = home();
    const p = s.portal;
    if (!p) {
      setBody(
        h('div', { cls: 'p-hero' }, icon('spiral-bold', { size: 54, color: 'var(--purple)' }), h('div', { cls: 'p-hero-title', text: 'THE PAW PORTAL' }), note('A gate to other universes unlocks once you reach the Rawhide Era after opening at least one new park.')),
      );
      return;
    }
    if (!p.built) {
      const btn = h('button', { cls: 'btn primary p-big', attrs: { type: 'button' } }, ...rich(`BUILD PORTAL  ${formatMoney(PORTAL_BUILD_COST)}`, 20));
      btn.disabled = s.cash < PORTAL_BUILD_COST;
      btn.addEventListener('click', () => {
        if (c.check(buildPortal(c.home))) {
          save();
          toast('{spiral} The Portal Gate is built!', 'gold', 4200);
          lastSig = '';
          update();
        }
      });
      setBody(
        h(
          'div',
          { cls: 'p-hero' },
          icon('spiral-bold', { size: 60, color: 'var(--purple)' }),
          h('div', { cls: 'p-hero-title', text: 'BUILD THE PORTAL GATE' }),
          note('Send dog crews through a swirling gate to other universes. They come back with relics: permanent boosts you wear on your collar. Building it is a one-time cost and it survives opening new parks.'),
          btn,
        ),
      );
      return;
    }
    if (picker) {
      buildPicker();
      return;
    }
    const now = Date.now();
    const items: Node[] = [];
    const rings: { ring: SVGCircleElement; text: HTMLElement; sub: HTMLElement; start: number; end: number }[] = [];
    const nReady = p.slots.filter((e) => expeditionReady(e, now)).length;
    p.slots.forEach((e, i) => {
      if (!e) {
        items.push(
          h(
            'div',
            { cls: 'p-slot empty' },
            h('div', { cls: 'p-slot-plus' }, icon('plus-bold', { size: 24, color: 'var(--ui-muted)' })),
            h('div', { cls: 'row-main' }, h('div', { cls: 'row-title', text: `SLOT ${i + 1}` }), h('div', { cls: 'row-meta', text: 'Ready for a crew' })),
            h('button', { cls: 'btn purple sm', attrs: { type: 'button' }, on: { click: () => openPicker(i) } }, 'SEND CREW'),
          ),
        );
        return;
      }
      const ci = Math.max(0, crewIdx(e.crewId));
      const ready = expeditionReady(e, now);
      const svgNS = 'http://www.w3.org/2000/svg';
      const R = 26;
      const C = 2 * Math.PI * R;
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 64 64');
      svg.setAttribute('class', 'p-ring');
      const track = document.createElementNS(svgNS, 'circle');
      for (const [k, v] of Object.entries({ cx: '32', cy: '32', r: String(R), class: 'p-ring-track' })) track.setAttribute(k, v);
      const ring = document.createElementNS(svgNS, 'circle');
      for (const [k, v] of Object.entries({ cx: '32', cy: '32', r: String(R), class: 'p-ring-fill' })) ring.setAttribute(k, v);
      ring.style.strokeDasharray = C.toFixed(1);
      svg.append(track, ring);
      const time = h('div', { cls: 'p-time' });
      const sub = h('div', { cls: 'row-meta' });
      const ringWrap = h('div', { cls: 'p-ring-wrap' }, svg, h('div', { cls: 'p-ring-center' }, ready ? icon('check-bold', { size: 26, color: 'var(--green)' }) : icon('dog', { size: 24, color: CREW_COLORS[ci % CREW_COLORS.length] })));
      const action = ready
        ? h('button', { cls: 'btn buy', attrs: { type: 'button' }, on: { click: () => doCollect(i) } }, 'COLLECT')
        : time;
      items.push(
        h(
          'div',
          { cls: `p-slot ${ready ? 'ready' : 'away'}` },
          ringWrap,
          h('div', { cls: 'row-main' }, h('div', { cls: 'row-title', text: CREWS[ci].name }), h('div', { cls: 'row-desc', text: dimName(e.dimensionId) }), sub),
          action,
        ),
      );
      rings.push({ ring, text: ready ? sub : time, sub, start: e.launchedAt, end: e.returnsAt });
      ring.style.strokeDashoffset = '0';
      void C;
      (ring as unknown as { _c: number })._c = C;
    });
    const head = h('div', { cls: 'p-head-row' }, h('b', { text: 'CREWS OUT' }), h('span', { text: `${p.slots.filter((e) => e).length} / ${p.slots.length}` }));
    const all = nReady > 1 ? h('button', { cls: 'btn primary p-big', attrs: { type: 'button' }, on: { click: () => doCollectAll() } }, `COLLECT ALL (${nReady})`) : null;
    setBody(head, ...items, all, note('Crews keep exploring while you are away. Fuel is paid in cash from your current park, or Golden Bones for a quick launch.'));
    ticker = () => {
      const t = Date.now();
      for (const r of rings) {
        const C = (r.ring as unknown as { _c: number })._c;
        const f = Math.max(0, Math.min(1, (t - r.start) / Math.max(1, r.end - r.start)));
        r.ring.style.strokeDashoffset = (C * (1 - f)).toFixed(1);
        if (t >= r.end) setText(r.sub, 'Back home!');
        else {
          setText(r.text, countdown(r.end - t));
          setText(r.sub, `${Math.floor(f * 100)}% of the way`);
        }
      }
    };
    ticker();
  }

  function doCollect(i: number): void {
    const r = collectExpedition(c.home, i, Date.now());
    if (!c.check(r)) return;
    save();
    showLootReveal({ relics: r.relics ?? [], stones: r.stones, goldenBones: r.goldenBones });
    lastSig = '';
    update();
  }
  function doCollectAll(): void {
    const r = collectAll(c.home, Date.now());
    if (!c.check(r)) return;
    save();
    showLootReveal({ relics: r.relics ?? [], stones: r.stones, goldenBones: r.goldenBones }, `${r.collected} crews back`);
    lastSig = '';
    update();
  }

  function openPicker(slot: number): void {
    const s = home();
    let crew = CREWS[0].id;
    CREWS.forEach((cr) => {
      if (crewUnlocked(s, cr.id)) crew = cr.id;
    });
    const dim = DIMENSIONS.find((d) => d.minCrew <= crewIdx(crew))?.id ?? DIMENSIONS[0].id;
    picker = { slot, crew, dim, len: 'standard' };
    lastSig = '';
    update();
    if (el.parentElement) el.parentElement.scrollTop = 0;
  }

  function buildPicker(): void {
    if (!picker) return;
    const pk = picker;
    const s = home();
    const ci = crewIdx(pk.crew);
    const crewRows = CREWS.map((cr, i) => {
      const prog = crewProgress(s, cr.id);
      const unlocked = prog?.unlocked ?? false;
      const prev = i > 0 ? CREWS[i - 1].name : '';
      return h(
        'button',
        {
          cls: `p-opt${pk.crew === cr.id ? ' on' : ''}${unlocked ? '' : ' locked'}`,
          attrs: { type: 'button', ...(unlocked ? {} : { 'aria-disabled': 'true' }) },
          on: {
            click: () => {
              if (!unlocked) return;
              pk.crew = cr.id;
              if ((DIMENSIONS.find((d) => d.id === pk.dim)?.minCrew ?? 0) > i) pk.dim = DIMENSIONS.find((d) => d.minCrew <= i)?.id ?? pk.dim;
              lastSig = '';
              update();
            },
          },
        },
        crewTile(i, 40),
        h('span', { cls: 'row-main' }, h('span', { cls: 'p-opt-title', text: cr.name }), h('span', { cls: 'p-opt-sub' }, unlocked ? starRow(prog?.stars ?? 0, prog?.maxStars ?? 5, 13) : h('span', null, ...rich(`{lock} ${prog?.runsToUnlock ?? cr.unlockRuns} more run${(prog?.runsToUnlock ?? 0) === 1 ? '' : 's'} with ${prev}`, 14)))),
      );
    });
    const dimRows = DIMENSIONS.map((d) => {
      const locked = d.minCrew > ci;
      const hint = Object.entries(d.familyWeights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([f]) => familyDef(f)?.name ?? f)
        .join(', ');
      return h(
        'button',
        {
          cls: `p-opt dim${pk.dim === d.id ? ' on' : ''}${locked ? ' locked' : ''}`,
          attrs: { type: 'button', ...(locked ? { 'aria-disabled': 'true' } : {}) },
          on: {
            click: () => {
              if (locked) return;
              pk.dim = d.id;
              lastSig = '';
              update();
            },
          },
        },
        h('span', { cls: 'row-main' }, h('span', { cls: 'p-opt-title', text: d.name }), h('span', { cls: 'p-opt-sub', text: locked ? '' : d.description }), locked ? h('span', { cls: 'p-opt-sub' }, ...rich(`{lock} Needs ${CREWS[d.minCrew].name}`, 14)) : h('span', { cls: 'p-opt-sub hint', text: `Drops ${hint}` })),
      );
    });
    const crewDef = CREWS[ci];
    const lenBtns = EXPEDITION_LENGTHS.map((len) =>
      h(
        'button',
        {
          cls: `p-len${pk.len === len ? ' on' : ''}`,
          attrs: { type: 'button' },
          on: {
            click: () => {
              pk.len = len;
              lastSig = '';
              update();
            },
          },
        },
        h('b', { text: LEN_LABEL[len] }),
        h('span', { cls: 'p-len-d', text: lenText(crewDef.durationsSec[len]) }),
        h('span', { cls: 'p-len-c', text: `~${crewDef.capacity[len]} loot` }),
      ),
    );
    const cash = fuelCost(s, pk.len);
    const bones = fuelBones(pk.len);
    const go = (pay: 'cash' | 'bones'): void => {
      const r = launchExpedition(c.home, pk.slot, pk.crew, pk.dim, pk.len, Date.now(), pay);
      if (!c.check(r)) return;
      save();
      toast(`{spiral} ${crewDef.name} launched! Back in ${lenText(crewDef.durationsSec[pk.len]).toLowerCase()}`, 'good', 3600);
      picker = null;
      lastSig = '';
      update();
    };
    const cashBtn = h('button', { cls: 'btn primary', attrs: { type: 'button' }, on: { click: () => go('cash') } }, ...rich(`LAUNCH  ${formatMoney(cash)}`, 18));
    cashBtn.disabled = s.cash < cash;
    const boneBtn = h('button', { cls: 'btn gold', attrs: { type: 'button' }, on: { click: () => go('bones') } }, ...rich(`LAUNCH  ${bones} {bone}`, 18));
    boneBtn.disabled = s.goldenBones < bones;
    ticker = null;
    setBody(
      backBtn(`SLOT ${pk.slot + 1}`, () => {
        picker = null;
        lastSig = '';
        update();
      }),
      h('div', { cls: 'p-sec', text: '1. CHOOSE A CREW' }),
      h('div', { cls: 'p-opts' }, ...crewRows),
      h('div', { cls: 'p-sec', text: '2. CHOOSE A UNIVERSE' }),
      h('div', { cls: 'p-opts' }, ...dimRows),
      h('div', { cls: 'p-sec', text: '3. HOW LONG?' }),
      h('div', { cls: 'p-lens' }, ...lenBtns),
      h('div', { cls: 'p-sec', text: 'TREAT FUEL' }),
      h('div', { cls: 'p-fuel' }, cashBtn, boneBtn),
      note('Longer trips and better crews bring more relics. Fuel cost scales with your income.'),
    );
  }

  // ================================================================ COLLAR
  function collarSig(): string {
    const p = home().portal;
    if (!p) return 'none';
    return `${p.equipped.join(',')}|${p.relics.length}|${collarSlot}|${p.relics.map((r) => `${r.id}${r.stones.length}`).join('')}`;
  }
  function buildCollar(): void {
    ticker = null;
    const s = home();
    const p = s.portal;
    if (!p || !p.built) {
      setBody(note(p ? 'Build the Portal Gate first.' : 'The Paw Portal is not open yet.'));
      return;
    }
    if (collarSlot !== null) {
      buildCollarPicker(collarSlot);
      return;
    }
    const slots = p.equipped.map((id, i) => {
      const r = id !== null ? p.relics.find((x) => x.id === id) : undefined;
      const inner = r
        ? [
            h('div', { cls: 'p-charm-art' }, relicImg(r, 64)),
            h('div', { cls: 'p-charm-name', text: familyDef(r.family)?.name ?? r.family }),
            h('div', { cls: 'p-charm-eff', text: relicEffectText(r) }),
            h('div', { cls: 'p-charm-meta', text: `${rarityName(r.rarity)} · ${tierLabel(r.tier)}` }),
          ]
        : [h('div', { cls: 'p-charm-empty' }, icon('plus-bold', { size: 26, color: 'var(--ui-muted)' })), h('div', { cls: 'p-charm-name', text: 'EMPTY' }), h('div', { cls: 'p-charm-meta', text: 'Tap to add a charm' })];
      return h('button', { cls: `p-charm ${r ? RARITY_CLASS[r.rarity] : 'none'}`, attrs: { type: 'button' }, on: { click: () => { collarSlot = i; lastSig = ''; update(); } } }, h('span', { cls: 'p-charm-n', text: String(i + 1) }), ...inner);
    });
    setBody(
      h('div', { cls: 'p-head-row' }, h('b', { text: 'RELIC COLLAR' }), h('span', { text: `${p.equipped.filter((x) => x !== null).length} / ${RELIC_EQUIP_SLOTS}` })),
      h('div', { cls: 'p-charms' }, ...slots),
      note('Equipped relics add permanent boosts, even in the Dog Show park. One relic per family. Tap a slot to swap.'),
    );
  }
  function buildCollarPicker(slot: number): void {
    const s = home();
    const p = s.portal!;
    const curId = p.equipped[slot];
    const cur = curId !== null ? p.relics.find((r) => r.id === curId) : undefined;
    const used = new Set<string>();
    p.equipped.forEach((id, i) => {
      if (i === slot || id === null) return;
      const r = p.relics.find((x) => x.id === id);
      if (r) used.add(r.family);
    });
    const cands = p.relics
      .filter((r) => !p.equipped.includes(r.id) && !used.has(r.family))
      .sort((a, b) => b.rarity - a.rarity || b.tier - a.tier || a.id - b.id);
    const rows = cands.map((r) =>
      relicCard(r, h('button', { cls: 'btn buy sm', attrs: { type: 'button' }, on: { click: () => { if (c.check(equipRelic(c.home, r.id, slot))) { save(); collarSlot = null; lastSig = ''; update(); } } } }, 'EQUIP')),
    );
    setBody(
      backBtn('COLLAR', () => {
        collarSlot = null;
        lastSig = '';
        update();
      }),
      h('div', { cls: 'p-sec', text: `CHARM SLOT ${slot + 1}` }),
      cur ? relicCard(cur, h('button', { cls: 'btn danger sm', attrs: { type: 'button' }, on: { click: () => { if (c.check(unequipRelic(c.home, slot))) { save(); collarSlot = null; lastSig = ''; update(); } } } }, 'REMOVE')) : note('Nothing equipped here.'),
      h('div', { cls: 'p-sec', text: 'AVAILABLE RELICS' }),
      ...(rows.length ? rows : [note('No spare relics. Send crews through the Portal to find some.')]),
    );
  }

  // ================================================================ COLLECTION
  function collSig(): string {
    const p = home().portal;
    if (!p) return 'none';
    return `${p.relics.map((r) => `${r.id}:${r.tier}:${r.rarity}:${r.stones.join('+')}`).join(',')}|${p.equipped.join(',')}|${JSON.stringify(p.stones)}|${detail ? `${detail.family}/${detail.tier}/${detail.id}` : ''}|${p.craftXp}`;
  }
  function buildColl(): void {
    ticker = null;
    const s = home();
    const p = s.portal;
    if (!p) {
      setBody(note('The Paw Portal is not open yet.'));
      return;
    }
    if (detail) {
      buildDetail();
      return;
    }
    const blocks = RELIC_FAMILIES.map((f) => {
      const cells = [];
      for (let t = 0; t < RELIC_TIERS; t++) {
        const owned = p.relics.filter((r) => r.family === f.id && r.tier === t).sort((a, b) => b.rarity - a.rarity);
        if (!owned.length) {
          cells.push(h('div', { cls: 'p-cell none' }, h('div', { cls: 'p-cell-art' }, relicImg({ family: f.id, tier: t, rarity: 0 }, 44, 'silhouette')), h('span', { cls: 'p-cell-t', text: tierLabel(t) })));
          continue;
        }
        const best = owned[0];
        const eq = owned.some((r) => p.equipped.includes(r.id));
        cells.push(
          h(
            'button',
            { cls: `p-cell ${RARITY_CLASS[best.rarity]}${eq ? ' eq' : ''}`, attrs: { type: 'button', 'aria-label': `${relicTitle(best)} x${owned.length}` }, on: { click: () => { detail = { family: f.id, tier: t, id: best.id }; lastSig = ''; update(); if (el.parentElement) el.parentElement.scrollTop = 0; } } },
            h('div', { cls: 'p-cell-art' }, relicImg(best, 44)),
            owned.length > 1 ? h('span', { cls: 'p-cell-n', text: `×${owned.length}` }) : null,
            eq ? h('span', { cls: 'p-cell-eq' }, icon('check-bold', { size: 11, color: '#fff' })) : null,
            h('span', { cls: 'p-cell-t', text: tierLabel(t) }),
          ),
        );
      }
      return h('div', { cls: 'p-fam' }, h('div', { cls: 'p-fam-head' }, h('b', { text: f.name }), h('span', { text: f.description })), h('div', { cls: 'p-cells' }, ...cells));
    });
    const total = p.relics.length;
    const stoneEls = Object.entries(p.stones)
      .filter(([k, n]) => n > 0 && parseStoneKey(k))
      .map(([k, n]) => h('div', { cls: 'p-stone-chip' }, stoneImg(k, 30), h('span', { text: stoneName(k) }), h('b', { text: `×${n}` })));
    setBody(
      h('div', { cls: 'p-head-row' }, h('b', { text: 'RELICS' }), h('span', { text: `${total} owned` })),
      h('div', { cls: 'p-legend' }, ...RARITY_NAMES.map((n, i) => h('span', { cls: `p-leg ${RARITY_CLASS[i]}`, text: n.toUpperCase() }))),
      ...blocks,
      h('div', { cls: 'p-head-row' }, h('b', { text: 'STONES' }), h('span', { text: stoneEls.length ? 'tap a relic to socket' : 'none yet' })),
      stoneEls.length ? h('div', { cls: 'p-stones' }, ...stoneEls) : note('Stones drop on expeditions. Rare relics hold 1, Epic 2 and Legendary 3.'),
    );
  }

  function buildDetail(): void {
    const s = home();
    const p = s.portal!;
    const d = detail!;
    const group = p.relics.filter((r) => r.family === d.family && r.tier === d.tier).sort((a, b) => b.rarity - a.rarity || a.id - b.id);
    const r = group.find((x) => x.id === d.id) ?? group[0];
    if (!r) {
      detail = null;
      buildColl();
      return;
    }
    d.id = r.id;
    const fam = familyDef(r.family);
    const equippedAt = p.equipped.indexOf(r.id);
    const cap = socketCapacity(r);
    const refresh = (): void => {
      save();
      lastSig = '';
      update();
    };
    const picks =
      group.length > 1
        ? h('div', { cls: 'p-picks' }, ...group.map((g) => h('button', { cls: `p-pick ${RARITY_CLASS[g.rarity]}${g.id === r.id ? ' on' : ''}`, attrs: { type: 'button', 'aria-label': relicTitle(g) }, on: { click: () => { d.id = g.id; lastSig = ''; update(); } } }, relicImg(g, 36), p.equipped.includes(g.id) ? h('span', { cls: 'p-cell-eq' }, icon('check-bold', { size: 10, color: '#fff' })) : null)))
        : null;
    // sockets
    const sockets: HTMLElement[] = [];
    for (let i = 0; i < Math.max(cap, 0); i++) {
      const key = r.stones[i];
      if (key) {
        sockets.push(h('button', { cls: 'p-socket full', attrs: { type: 'button', title: `Remove ${stoneName(key)}` }, on: { click: () => { if (c.check(unsocketStone(c.home, r.id, i))) refresh(); } } }, stoneImg(key, 34), h('span', { cls: 'p-socket-t', text: stoneEffectText(key) })));
      } else sockets.push(h('div', { cls: 'p-socket' }, icon('diamond', { size: 18, color: '#c7ccd4' }), h('span', { cls: 'p-socket-t', text: 'EMPTY' })));
    }
    const bag = Object.entries(p.stones)
      .filter(([k, n]) => n > 0 && parseStoneKey(k))
      .map(([k, n]) => {
        const free = r.stones.length < cap;
        const b = h('button', { cls: 'p-stone-chip btn-like', attrs: { type: 'button' }, on: { click: () => { if (c.check(socketStone(c.home, r.id, k))) refresh(); } } }, stoneImg(k, 30), h('span', { text: `${stoneName(k)}  ${stoneEffectText(k)}` }), h('b', { text: `×${n}` }));
        b.disabled = !free;
        return b;
      });
    // equip row
    const slotBtns: HTMLElement[] = [];
    for (let i = 0; i < RELIC_EQUIP_SLOTS; i++) {
      const occ = p.equipped[i];
      const occRelic = occ !== null ? p.relics.find((x) => x.id === occ) : undefined;
      slotBtns.push(
        h('button', { cls: `p-slotbtn${i === equippedAt ? ' on' : ''}${occRelic && i !== equippedAt ? ' used' : ''}`, attrs: { type: 'button', title: occRelic ? `Replaces ${relicTitle(occRelic)}` : 'Empty slot' }, on: { click: () => { if (i === equippedAt) return; if (c.check(equipRelic(c.home, r.id, i))) refresh(); } } }, String(i + 1)),
      );
    }
    const bones = recycleValue(r);
    const recycleBtn = h('button', { cls: 'btn ghost', attrs: { type: 'button' }, on: { click: () => confirmRecycle(r, bones, () => { detail = null; refresh(); }) } }, ...rich(`RECYCLE  +${bones} {bone}`, 18));
    recycleBtn.disabled = equippedAt >= 0;
    ticker = null;
    setBody(
      backBtn('COLLECTION', () => {
        detail = null;
        lastSig = '';
        update();
      }),
      picks,
      h(
        'div',
        { cls: `p-detail ${RARITY_CLASS[r.rarity]}` },
        h('div', { cls: 'p-detail-art' }, relicImg(r, 112)),
        h('div', { cls: 'p-detail-info' }, h('div', { cls: 'p-detail-rar', text: `${rarityName(r.rarity).toUpperCase()}  ·  ${tierLabel(r.tier)}` }), h('div', { cls: 'p-detail-name', text: fam?.name ?? r.family }), h('div', { cls: 'p-detail-eff', text: relicEffectText(r) }), h('div', { cls: 'row-meta', text: fam?.description ?? '' })),
      ),
      h('div', { cls: 'p-sec', text: cap > 0 ? `SOCKETS  ${r.stones.length} / ${cap}` : 'SOCKETS' }),
      cap > 0 ? h('div', { cls: 'p-sockets' }, ...sockets) : note('Common relics have no sockets. Rare relics hold 1, Epic 2, Legendary 3.'),
      cap > 0 && bag.length ? h('div', { cls: 'p-bag' }, ...bag) : cap > 0 ? note('No stones in your bag yet.') : null,
      h('div', { cls: 'p-sec', text: equippedAt >= 0 ? `EQUIPPED IN SLOT ${equippedAt + 1}` : 'EQUIP TO SLOT' }),
      h('div', { cls: 'p-slotbtns' }, ...slotBtns, equippedAt >= 0 ? h('button', { cls: 'btn danger sm', attrs: { type: 'button' }, on: { click: () => { if (c.check(unequipRelic(c.home, equippedAt))) refresh(); } } }, 'REMOVE') : null),
      recycleBtn,
      equippedAt >= 0 ? note('Remove it from the collar before recycling.') : null,
    );
    void SOCKETS_BY_RARITY;
  }

  function confirmRecycle(r: Relic, bones: number, done: () => void): void {
    showModal(
      'Recycle relic?',
      [h('p', null, ...rich(`${relicTitle(r)} (${tierLabel(r.tier)}) will be broken down for ${bones} {bone} Golden Bones. Its stones go back to your bag.`, 18))],
      [
        { label: 'Keep it' },
        {
          label: 'Recycle',
          danger: true,
          onClick: () => {
            const res = recycleRelic(c.home, r.id);
            if (c.check(res)) {
              toast(`Recycled for +${res.goldenBones ?? bones} {bone}`, 'good');
              done();
            }
          },
        },
      ],
    );
  }

  // ================================================================ CRAFT
  function craftSig(): string {
    const s = home();
    const p = s.portal;
    if (!p) return 'none';
    return `${p.relics.map((r) => `${r.id}:${r.rarity}`).join(',')}|${p.equipped.join(',')}|${JSON.stringify(p.stones)}|${[0, 1, 2].map((t) => (s.cash >= craftCost(s, t) ? 1 : 0)).join('')}`;
  }
  function buildCraft(): void {
    ticker = null;
    const s = home();
    const p = s.portal;
    if (!p) {
      setBody(note('The Paw Portal is not open yet.'));
      return;
    }
    const rows: { ready: boolean; el: HTMLElement }[] = [];
    for (const f of RELIC_FAMILIES) {
      for (let t = 0; t < RELIC_TIERS - 1; t++) {
        const pool = craftableRelics(s, f.id, t);
        if (!pool.length) continue;
        const ready = pool.length >= CRAFT_COUNT;
        const cost = craftCost(s, t);
        const btn = h('button', { cls: 'btn primary p-craft-btn', attrs: { type: 'button' }, on: { click: () => doCraft(f.id, t) } }, ...rich(`CRAFT  ${formatMoney(cost)}`, 18));
        btn.disabled = !ready || s.cash < cost;
        rows.push({
          ready,
          el: h(
            'div',
            { cls: `p-craft${ready ? ' ready' : ''}` },
            h('div', { cls: 'p-craft-art' }, relicImg(pool[0], 44), icon('arrow-right-bold', { size: 14, color: 'var(--ui-muted)' }), relicImg({ family: f.id, tier: t + 1, rarity: 0 }, 44)),
            h('div', { cls: 'row-main' }, h('div', { cls: 'row-title', text: f.name }), h('div', { cls: 'row-desc', text: `${CRAFT_COUNT} × ${tierLabel(t)}  →  1 × ${tierLabel(t + 1)}` }), h('div', { cls: 'row-meta', text: `You have ${pool.length} / ${CRAFT_COUNT}${ready ? '  ·  uses your 3 lowest rarity' : ''}` })),
            btn,
          ),
        });
      }
    }
    const stoneRows: HTMLElement[] = [];
    for (const st of STONES) {
      for (let t = 0; t < STONE_TIERS - 1; t++) {
        const n = p.stones[stoneKey(st.id, t)] ?? 0;
        if (!n) continue;
        const ready = n >= STONE_CRAFT_COUNT;
        const btn = h('button', { cls: 'btn primary p-craft-btn', attrs: { type: 'button' }, on: { click: () => doCraftStone(st.id, t) } }, 'CRAFT');
        btn.disabled = !ready;
        stoneRows.push(
          h(
            'div',
            { cls: `p-craft${ready ? ' ready' : ''}` },
            h('div', { cls: 'p-craft-art' }, stoneImg(stoneKey(st.id, t), 40), icon('arrow-right-bold', { size: 14, color: 'var(--ui-muted)' }), stoneImg(stoneKey(st.id, t + 1), 40)),
            h('div', { cls: 'row-main' }, h('div', { cls: 'row-title', text: st.name }), h('div', { cls: 'row-desc', text: `${STONE_CRAFT_COUNT} × ${roman(t)}  →  1 × ${roman(t + 1)}` }), h('div', { cls: 'row-meta', text: `You have ${n} / ${STONE_CRAFT_COUNT}` })),
            btn,
          ),
        );
      }
    }
    rows.sort((a, b) => Number(b.ready) - Number(a.ready));
    const luck = Math.round(craftXpBoost(s) * 100);
    setBody(
      h('div', { cls: 'p-head-row' }, h('b', { text: 'CRAFT RELICS' }), h('span', { text: `Craft XP ${formatNumber(p.craftXp)}  ·  +${luck}% luck` })),
      ...(rows.length ? rows.map((r) => r.el) : [note('Nothing to craft yet. Combine 3 relics of the same family and tier into one of the next tier. Bring more home from expeditions.')]),
      h('div', { cls: 'p-head-row' }, h('b', { text: 'CRAFT STONES' })),
      ...(stoneRows.length ? stoneRows : [note('Collect 3 stones of one type to upgrade them.')]),
    );
  }
  function doCraft(family: string, tier: number): void {
    const r = craftRelic(c.home, family, tier);
    if (!c.check(r) || !r.relic) return;
    save();
    showLootReveal({ relics: [r.relic] }, 'Crafted!');
    lastSig = '';
    update();
  }
  function doCraftStone(id: string, tier: number): void {
    const r = craftStone(c.home, id, tier);
    if (!c.check(r)) return;
    save();
    toast(`Crafted ${r.stone ? stoneName(r.stone) : 'a stone'}`, 'good');
    lastSig = '';
    update();
  }

  // ================================================================ CREWS
  function crewsSig(): string {
    const s = home();
    return CREWS.map((cr) => {
      const pr = crewProgress(s, cr.id);
      return `${pr?.runs}:${pr?.unlocked ? 1 : 0}`;
    }).join('|');
  }
  function buildCrews(): void {
    ticker = null;
    const s = home();
    if (!s.portal) {
      setBody(note('The Paw Portal is not open yet.'));
      return;
    }
    const rows = CREWS.map((cr, i) => {
      const pr = crewProgress(s, cr.id);
      if (!pr) return h('div');
      const frac = pr.nextStarRuns ? Math.min(1, pr.runs / pr.nextStarRuns) : 1;
      const prev = i > 0 ? CREWS[i - 1].name : '';
      const bar = h('div', { cls: 'meter' }, h('div', { cls: 'meter-fill', style: `width:${(frac * 100).toFixed(1)}%` }));
      return h(
        'div',
        { cls: `p-crew${pr.unlocked ? '' : ' locked'}` },
        crewTile(i, 52),
        h(
          'div',
          { cls: 'row-main' },
          h('div', { cls: 'row-title', text: cr.name }),
          pr.unlocked
            ? h('div', null, starRow(pr.stars, pr.maxStars, 17))
            : h('div', { cls: 'row-desc' }, ...rich(`{lock} ${pr.runsToUnlock} more run${pr.runsToUnlock === 1 ? '' : 's'} with ${prev}`, 16)),
          pr.unlocked ? h('div', { cls: 'p-crew-prog' }, bar, h('span', { text: pr.nextStarRuns ? `${pr.runs} / ${pr.nextStarRuns}` : 'MAX STARS' })) : h('div', { cls: 'row-meta', text: `${cr.unlockRuns} runs of ${prev} needed` }),
          h('div', { cls: 'row-meta', text: `${lenText(cr.durationsSec.short)} · ${lenText(cr.durationsSec.standard)} · ${lenText(cr.durationsSec.long)}  ·  ${pr.runs} run${pr.runs === 1 ? '' : 's'}` }),
        ),
      );
    });
    setBody(h('div', { cls: 'p-head-row' }, h('b', { text: 'DOG CREWS' }), h('span', { text: 'stars: more loot, better odds' })), ...rows);
  }

  // ================================================================ update
  function sigOf(): string {
    switch (tab) {
      case 'exp':
        return expSig();
      case 'collar':
        return collarSig();
      case 'coll':
        return collSig();
      case 'craft':
        return craftSig();
      case 'crews':
        return crewsSig();
    }
  }

  function update(): void {
    const s = home();
    const now = Date.now();
    tabBtns.forEach((b, i) => {
      b.classList.toggle('on', TABS[i].id === tab);
      b.setAttribute('aria-selected', String(TABS[i].id === tab));
    });
    tabBtns[0].classList.toggle('has-dot', !!s.portal && s.portal.slots.some((e) => expeditionReady(e, now)));
    const sig = `${tab}#${sigOf()}`;
    if (sig !== lastSig) {
      lastSig = sig;
      switch (tab) {
        case 'exp':
          buildExp();
          break;
        case 'collar':
          buildCollar();
          break;
        case 'coll':
          buildColl();
          break;
        case 'craft':
          buildCraft();
          break;
        case 'crews':
          buildCrews();
          break;
      }
    }
    ticker?.();
  }

  return {
    el,
    update,
    showTab,
    onShow() {
      picker = null;
      collarSlot = null;
      detail = null;
      lastSig = '';
      const s = home();
      tab = s.portal?.slots.some((e) => expeditionReady(e, Date.now())) ? 'exp' : tab;
    },
  };
}
