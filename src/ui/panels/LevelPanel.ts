import { PARK_LEVEL_THRESHOLDS, PUP_RANK_TITLES, computeStats, formatMoney, formatNumber, parkTitle } from '../../core';
import type { GameController } from '../GameController';
import { h, meter, setClass, setMeter, setText } from '../dom';
import { createShareCard } from '../share';
import { section, type Panel } from './common';

export function createLevelPanel(c: GameController): Panel {
  const el = h('div', { cls: 'panel' });
  const big = h('div', { cls: 'level-big' });
  const title = h('div', { cls: 'row-title' });
  const m = meter('goal');
  const meta = h('div', { cls: 'row-meta' });
  el.append(section('Your level', h('div', { cls: 'card' }, big, title, m.el, meta, h('div', { cls: 'row-desc', text: 'Based on lifetime earnings. It never goes down, even when you open a new park.' }))));

  // titles list: derived through parkTitle so the data shape does not matter
  const maxLevel = PARK_LEVEL_THRESHOLDS.length;
  const entries: { level: number; title: string; el: HTMLElement }[] = [];
  let prev = '';
  for (let l = 1; l <= maxLevel; l++) {
    const t = parkTitle(l);
    if (t === prev) continue;
    prev = t;
    const e = h('div', { cls: 'ladder-row' }, h('span', { cls: 'ladder-name', text: t }), h('span', { cls: 'row-meta', text: `Lv ${l}+` }));
    entries.push({ level: l, title: t, el: e });
  }
  const titlesSection = section('Titles', h('div', { cls: 'ladder' }, ...entries.map((e) => e.el)));
  el.append(titlesSection);
  // ---- Pup Rank: grows with the earnings bonus from Spirit Paws and Legend Collars
  const rankTitle = h('div', { cls: 'row-title' });
  const rankBig = h('div', { cls: 'level-big rank' });
  const rankMeta = h('div', { cls: 'row-meta' });
  const rankM = meter('goal');
  const rankRows = PUP_RANK_TITLES.map((t, r) => ({
    r,
    el: h('div', { cls: 'ladder-row' }, h('span', { cls: 'ladder-name', text: t }), h('span', { cls: 'row-meta', text: r === 0 ? 'any bonus' : `+${formatNumber(10 ** r)}% earnings` })),
  }));
  const rankLadder = h('div', { cls: 'ladder rank-ladder' }, ...rankRows.map((x) => x.el));
  el.insertBefore(
    section(
      'Pup rank',
      h(
        'div',
        { cls: 'card' },
        rankBig,
        rankTitle,
        rankM.el,
        rankMeta,
        h('div', { cls: 'row-desc', text: 'Rank grows with your earnings bonus from Spirit Paws and Legend Collars. Each rank needs ten times the bonus of the one before.' }),
      ),
      rankLadder,
    ),
    titlesSection,
  );
  const share = createShareCard(c);
  el.append(section('{share} Share', share.el));

  function update(): void {
    const s = c.home;
    const d = computeStats(s);
    const lvl = d.parkLevel;
    setText(big, `Lv ${lvl}`);
    setText(title, d.parkTitle);
    const lo = lvl >= 1 ? Math.max(1, PARK_LEVEL_THRESHOLDS[lvl - 1] ?? 1) : 1;
    const hi = PARK_LEVEL_THRESHOLDS[lvl];
    if (hi === undefined) {
      setMeter(m, 1);
      setText(meta, 'Max level reached!');
    } else {
      const e = Math.max(1, s.lifetimeEarnings);
      const frac = (Math.log(e) - Math.log(lo)) / Math.max(1e-9, Math.log(hi) - Math.log(lo));
      setMeter(m, frac);
      setText(meta, `${formatMoney(s.lifetimeEarnings)} / ${formatMoney(hi)} for Lv ${lvl + 1}`);
    }
    for (const e of entries) setClass(e.el, 'current', parkTitle(lvl) === e.title);
    // rank (home save only)
    setText(rankBig, d.pupRankTitle.toUpperCase());
    setText(rankTitle, `Rank ${d.pupRank + 1} of ${PUP_RANK_TITLES.length}`);
    const nextR = d.pupRank + 1;
    const pct = Math.max(0, (d.earningsBonus - 1) * 100);
    if (nextR >= PUP_RANK_TITLES.length) {
      setMeter(rankM, 1);
      setText(rankMeta, 'Top rank reached!');
    } else {
      const lo = 10 ** d.pupRank;
      const hi = 10 ** nextR;
      setMeter(rankM, (Math.log10(Math.max(1, pct)) - Math.log10(lo)) / Math.log10(hi / lo));
      setText(rankMeta, `+${formatNumber(Math.floor(pct))}% earnings bonus. ${PUP_RANK_TITLES[nextR]} at +${formatNumber(hi)}%`);
    }
    for (const x of rankRows) {
      setClass(x.el, 'current', x.r === d.pupRank);
      x.el.hidden = x.r < d.pupRank - 1 || x.r > d.pupRank + 4; // a short window of the ladder around you
    }
    share.update();
  }
  return { el, update };
}
