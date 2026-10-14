import {
  DAILY_DIG_POOL,
  DAILY_TREATS,
  MAX_STREAK_FREEZES,
  TREATS,
  claimDailyDig,
  claimDailyDigBonus,
  claimDailyTreat,
  computeStats,
  dailyDigProgress,
  dayDiff,
  DIG_BONUS_BONES,
  DIG_BONUS_STARS,
  formatDuration,
  formatNumber,
} from '../../core';
import type { DailyTreatReward } from '../../core';
import type { GameController } from '../GameController';
import { h, meter, setClass, setHidden, setMeter, setText } from '../dom';
import { createShareCard } from '../share';
import { toast } from '../Toasts';
import { section, setBtn, type Panel } from './common';

export function rewardShort(r: DailyTreatReward): string {
  switch (r.kind) {
    case 'goldenBones':
      return `${formatNumber(r.amount)}\u{1F9B4}`;
    case 'treat':
      return TREATS.find((t) => t.id === r.treatId)?.icon ?? '\u{1F356}';
    case 'bundle':
      return `${formatNumber(r.goldenBones)}\u{1F9B4}+${formatNumber(r.stars)}⭐`;
  }
}

function rewardLong(r: DailyTreatReward): string {
  switch (r.kind) {
    case 'goldenBones':
      return `+${formatNumber(r.amount)} \u{1F9B4}`;
    case 'treat': {
      const t = TREATS.find((x) => x.id === r.treatId);
      return `${t?.icon ?? ''} ${t?.name ?? 'Treat'}`;
    }
    case 'bundle':
      return `+${formatNumber(r.goldenBones)} \u{1F9B4} +${formatNumber(r.stars)} ⭐`;
  }
}

/** Streak the next claim would produce (mirrors the engine rules, display only). */
function projectedStreak(c: GameController): number {
  const d = c.state.daily;
  if (!d.lastClaimDay) return 1;
  const gap = dayDiff(d.lastClaimDay, c.today());
  if (gap === 1) return d.streak + 1;
  if (gap >= 2 && d.streakFreezes >= gap - 1) return d.streak + 1;
  return 1;
}

function msToMidnight(): number {
  const n = new Date();
  const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  return Math.max(0, (m.getTime() - n.getTime()) / 1000);
}

export function createTodayPanel(c: GameController): Panel {
  const el = h('div', { cls: 'panel' });

  // ---- daily treat
  const streakLine = h('div', { cls: 'row-title' });
  const bestLine = h('div', { cls: 'row-meta' });
  const cells = DAILY_TREATS.map((r, i) =>
    h('div', { cls: 'day-cell' }, h('div', { cls: 'day-n', text: `Day ${i + 1}` }), h('div', { cls: 'day-r', text: rewardShort(r) })),
  );
  const claimBtn = h('button', {
    cls: 'btn primary',
    attrs: { type: 'button' },
    on: {
      click: () => {
        const r = claimDailyTreat(c.state, c.today());
        if (c.check(r)) {
          if (r.reward) toast(`\u{1F381} Daily Treat: ${rewardLong(r.reward)}  \u{1F525} ${r.streak ?? ''}`, 'gold', 4500);
          c.save();
        }
        update();
      },
    },
  });
  const freezeLine = h('div', { cls: 'row-meta' });
  el.append(section('\u{1F4C5} Daily Treat', h('div', { cls: 'card' }, streakLine, bestLine, h('div', { cls: 'day-strip' }, ...cells), freezeLine, claimBtn)));

  // ---- park of the day
  const modIcon = h('div', { cls: 'row-icon' });
  const modName = h('div', { cls: 'row-title' });
  const modDesc = h('div', { cls: 'row-desc' });
  el.append(section('\u{1F31E} Park of the Day', h('div', { cls: 'row' }, modIcon, h('div', { cls: 'row-main' }, modName, modDesc))));

  // ---- digs
  const countdown = h('div', { cls: 'row-meta' });
  const digRows = [0, 1, 2].map((i) => {
    const icon = h('div', { cls: 'row-icon' });
    const title = h('div', { cls: 'row-title' });
    const m = meter('dig-progress');
    const meta = h('div', { cls: 'row-meta' });
    const btn = h('button', {
      cls: 'btn buy',
      attrs: { type: 'button' },
      on: {
        click: () => {
          if (c.check(claimDailyDig(c.state, i))) c.save();
          update();
        },
      },
    });
    const row = h('div', { cls: 'row' }, icon, h('div', { cls: 'row-main' }, title, m.el, meta), btn);
    return { row, icon, title, m, meta, btn };
  });
  const bonusBtn = h('button', {
    cls: 'btn primary',
    attrs: { type: 'button' },
    on: {
      click: () => {
        if (c.check(claimDailyDigBonus(c.state))) {
          toast(`\u{1F389} All Digs done! +${DIG_BONUS_BONES} \u{1F9B4} +${DIG_BONUS_STARS} ⭐`, 'gold', 4500);
          c.save();
        }
        update();
      },
    },
  });
  el.append(section('⛏️ Daily Digs', countdown, ...digRows.map((r) => r.row), bonusBtn));

  // ---- share
  const share = createShareCard(c);
  el.append(section('\u{1F4E4} Share', share.el));

  function update(): void {
    const s = c.state;
    const d = s.daily;
    const today = c.today();
    const claimed = d.lastClaimDay === today;
    const next = claimed ? d.streak : projectedStreak(c);
    const pos = (Math.max(1, next) - 1) % 7;

    setText(streakLine, `\u{1F525} ${d.streak}-day streak`);
    setText(bestLine, `Best: ${d.bestStreak}${claimed ? ' • Come back tomorrow!' : ''}`);
    cells.forEach((cell, i) => {
      setClass(cell, 'done', claimed ? i <= pos : i < pos);
      setClass(cell, 'today', !claimed && i === pos);
    });
    setText(freezeLine, `❄️ Streak Freezes: ${d.streakFreezes}/${MAX_STREAK_FREEZES} (save your streak if you miss a day; buy in the ⭐ shop)`);
    setBtn(claimBtn, claimed ? 'Claimed today ✓' : `Claim Daily Treat (day ${pos + 1})`, !claimed);
    setClass(claimBtn, 'pulse', !claimed);

    const mod = computeStats(s).modifier;
    setText(modIcon, mod?.icon ?? '\u{1F31E}');
    setText(modName, mod?.name ?? 'Quiet day');
    setText(modDesc, mod?.description ?? 'No modifier today.');

    setText(countdown, `New Digs and Park of the Day in ${formatDuration(msToMidnight())}`);
    let allClaimed = d.digs.length === 3;
    digRows.forEach((r, i) => {
      const dig = d.digs[i];
      setHidden(r.row, !dig);
      if (!dig) {
        allClaimed = false;
        return;
      }
      const def = DAILY_DIG_POOL.find((x) => x.kind === dig.kind);
      const p = dailyDigProgress(s, i);
      setText(r.icon, def?.icon ?? '⛏️');
      setText(r.title, (def?.text ?? dig.kind).replace('{n}', formatNumber(dig.target)));
      setMeter(r.m, p.target > 0 ? p.value / p.target : 0);
      setText(r.meta, `${formatNumber(Math.min(p.value, p.target))} / ${formatNumber(p.target)}`);
      setClass(r.row, 'locked', dig.claimed);
      if (dig.claimed) setBtn(r.btn, 'Claimed ✓', false);
      else setBtn(r.btn, p.done ? `Claim +${def?.rewardBones ?? 5} \u{1F9B4}` : 'In progress', p.done);
      if (!dig.claimed) allClaimed = false;
    });
    setHidden(bonusBtn, false);
    if (d.digBonusClaimed) setBtn(bonusBtn, 'All-3 bonus claimed ✓', false);
    else setBtn(bonusBtn, `Bonus for all 3: +${DIG_BONUS_BONES} \u{1F9B4} +${DIG_BONUS_STARS} ⭐`, allClaimed);

    share.update();
  }
  return { el, update };
}

/** True when today's Daily Treat can still be claimed (drives the tab badge). */
export function treatReady(c: GameController): boolean {
  const d = c.state.daily;
  return d.lastClaimDay !== c.today();
}
