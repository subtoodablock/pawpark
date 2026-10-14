// Dog Show tab (the Find panel's "Contracts" slot): join, progress with three medals, claims, history.
// Engine: src/core/show.ts. Spec: docs/10-egg-inc-model.md section 3.
import {
  FINDS,
  SHOW_REWARDS,
  TREATS,
  claimShowGoal,
  formatNumber,
  joinShow,
  showForWeek,
  showProgress,
  showWindow,
  weekKeyOf,
} from '../../core';
import type { GameController } from '../GameController';
import { h, setClass, setDisabled, setHidden, setMeter, setText, meter } from '../dom';
import { artImg, setArt } from '../gameArt';
import { icon, rich, setRich } from '../icons';
import { countdown } from '../portalUi';
import { toast } from '../Toasts';
import { confetti } from '../fx/confetti';
import { setBtn, type Panel } from './common';

const MEDALS = [
  { name: 'BRONZE', cls: 'bronze' },
  { name: 'SILVER', cls: 'silver' },
  { name: 'GOLD', cls: 'gold' },
] as const;

function rewardText(i: number): string {
  const r = SHOW_REWARDS[i];
  if (!r) return '';
  const parts: string[] = [];
  if (r.treatId) parts.push(TREATS.find((t) => t.id === r.treatId)?.name ?? 'Treat');
  if (r.goldenBones) parts.push(`+${r.goldenBones} {bone}`);
  if (r.collars) parts.push(`+${r.collars} Legend Collar`);
  return parts.join('  ');
}

function medalDisc(i: number, size = 30): HTMLElement {
  return h('span', { cls: `medal-disc ${MEDALS[i].cls}`, style: `width:${size}px;height:${size}px` }, icon('medal', { size: Math.round(size * 0.64), color: '#fff' }));
}

/** weekKey -> "WEEK 41" */
const weekLabel = (k: string): string => `WEEK ${Number(k.split('-W')[1] ?? 0)}`;

export function createShowView(c: GameController, opts: { onSwitch: () => void }): Panel {
  // ---------------------------------------------------------------- hero (shared)
  const heroArt = artImg('find', 0, 110, 'show-hero-ico');
  const tag = h('span', { cls: 'find-tag current', text: "THIS WEEK'S SHOW" });
  const nameEl = h('div', { cls: 'show-name' });
  const featured = h('div', { cls: 'find-value' });
  const timeLeft = h('div', { cls: 'show-time' });
  const hero = h('div', { cls: 'find-hero show-hero' }, h('div', { cls: 'show-art' }, heroArt), h('div', { cls: 'find-info' }, tag, nameEl, featured, timeLeft));

  // ---------------------------------------------------------------- goals (reward rows)
  const goalEls = MEDALS.map((m, i) => {
    const title = h('div', { cls: 'row-title' });
    const reward = h('div', { cls: 'row-desc' }, ...rich(rewardText(i), 16));
    const btn = h('button', { cls: 'btn buy', attrs: { type: 'button' } });
    btn.addEventListener('click', () => {
      const r = claimShowGoal(c.home, i);
      if (!c.check(r)) return;
      c.save();
      toast(`${m.name[0]}${m.name.slice(1).toLowerCase()} medal claimed: ${rewardText(i)}`, 'gold', 4200);
      if (i === 2) confetti({ y: window.innerHeight * 0.35, count: 70, power: 0.8 });
      update();
    });
    const el = h('div', { cls: 'row show-goal' }, medalDisc(i, 40), h('div', { cls: 'row-main' }, title, reward), btn);
    return { el, title, btn };
  });
  const goalList = h('div', { cls: 'show-goals' }, ...goalEls.map((g) => g.el));

  // ---------------------------------------------------------------- progress (joined)
  const prog = meter('show-meter');
  const markers = MEDALS.map((_, i) => {
    const lab = h('span', { cls: 'show-mark-n' });
    const el = h('div', { cls: 'show-mark' }, medalDisc(i, 30), lab);
    return { el, lab };
  });
  const track = h('div', { cls: 'show-prog' }, ...markers.map((m) => m.el), prog.el);
  const deliveredEl = h('div', { cls: 'show-delivered' });
  const progBox = h('div', { cls: 'show-progbox' }, h('div', { cls: 'show-prog-head' }, h('span', { text: 'FINDS DELIVERED' }), deliveredEl), track);

  // ---------------------------------------------------------------- actions
  const joinBtn = h('button', { cls: 'btn primary show-join', attrs: { type: 'button' } });
  let joining = false;
  const setJoinLabel = (loading: boolean): void => {
    joinBtn.replaceChildren(...(loading ? [h('span', { cls: 'spinner' }), 'JOINING...'] : rich('JOIN THE SHOW', 22)));
    setClass(joinBtn, 'loading', loading);
  };
  setJoinLabel(false);
  joinBtn.addEventListener('click', () => {
    if (joining) return;
    joining = true;
    setJoinLabel(true);
    setDisabled(joinBtn, true);
    // joinShow calibrates with a headless sim (~0.1-0.3 s): paint the loading state first
    window.setTimeout(() => {
      const r = joinShow(c.home, Date.now());
      joining = false;
      setJoinLabel(false);
      setDisabled(joinBtn, false);
      for (const e of r.events ?? []) void e;
      if (c.check(r)) {
        c.save();
        toast('You joined the Dog Show! Good luck', 'good');
      }
      update();
    }, 60);
  });
  const note = h('div', { cls: 'show-note' });
  const switchBtn = h('button', { cls: 'btn gold show-switch', attrs: { type: 'button' } });
  switchBtn.addEventListener('click', () => {
    c.setViewShow(!c.viewingShow);
    update();
    opts.onSwitch();
  });

  // ---------------------------------------------------------------- history
  const histList = h('div', { cls: 'show-history' });
  const histHead = h('div', { cls: 'show-sub', text: 'PAST SHOWS' });
  let histKey = '';

  const el = h('div', { cls: 'show-card' }, hero, joinBtn, switchBtn, progBox, goalList, note, histHead, histList);

  function update(): void {
    const s = c.home;
    const now = Date.now();
    const sp = showProgress(s);
    const show = s.show;
    const weekKey = show ? show.weekKey : weekKeyOf(now);
    const info = show ? { name: show.name, findIndex: show.findIndex } : showForWeek(s, weekKey);
    const end = showWindow(weekKey).end;
    const entered = !show && s.showHistory.some((r) => r.weekKey === weekKey);

    setArt(heroArt, 'find', info.findIndex, 110);
    setText(nameEl, info.name);
    setText(featured, `FEATURED FIND: ${FINDS[info.findIndex]?.name ?? '?'}`);
    setText(timeLeft, `ENDS IN ${countdown(end - now)}`);
    setText(tag, show ? 'YOU ARE ENTERED' : entered ? 'SHOW COMPLETE' : "THIS WEEK'S SHOW");
    setClass(tag, 'next', !show && !entered);

    setHidden(progBox, !sp);
    if (sp && show) {
      const top = Math.max(1, sp.goals[2]?.target ?? 1);
      setMeter(prog, sp.delivered / top);
      setText(deliveredEl, `${formatNumber(Math.floor(sp.delivered))} / ${formatNumber(top)}`);
      markers.forEach((m, i) => {
        const t = sp.goals[i].target;
        m.el.style.left = `${Math.min(100, (t / top) * 100).toFixed(2)}%`;
        setClass(m.el, 'got', sp.goals[i].reached);
        setText(m.lab, formatNumber(t));
      });
    }

    goalEls.forEach((g, i) => {
      const goal = sp?.goals[i];
      if (!goal) {
        setText(g.title, `${MEDALS[i].name} MEDAL`);
        setHidden(g.btn, true);
        setClass(g.el, 'got', false);
        return;
      }
      setHidden(g.btn, false);
      setText(g.title, `${MEDALS[i].name} · ${formatNumber(goal.target)} FINDS`);
      setClass(g.el, 'got', goal.reached);
      if (goal.claimed) {
        setBtn(g.btn, '{tick}', false);
        setClass(g.btn, 'claimed', true);
      } else if (goal.reached) {
        setClass(g.btn, 'claimed', false);
        setBtn(g.btn, 'CLAIM', true);
      } else {
        setClass(g.btn, 'claimed', false);
        setBtn(g.btn, `${formatNumber(Math.max(0, Math.ceil(goal.target - sp.delivered)))} TO GO`, false);
      }
    });

    setHidden(joinBtn, !!show || entered);
    if (!show && !entered && !joining) setDisabled(joinBtn, false);
    setHidden(switchBtn, !show);
    if (show) {
      switchBtn.replaceChildren(icon('swap-bold', { size: 22, color: c.viewingShow ? '#fff' : '#111' }), c.viewingShow ? 'BACK TO HOME PARK' : 'SWITCH TO SHOW PARK');
      setClass(switchBtn, 'gold', !c.viewingShow);
      setClass(switchBtn, 'blue', c.viewingShow);
    }
    setHidden(note, false);
    setRich(
      note,
      show
        ? 'The show park starts from scratch on the featured Find. Your Spirit Paws, Collars and Academy help it. Claim medals any time before the week ends.'
        : entered
          ? 'You already ran this week\'s show. A new one opens Monday.'
          : 'A fresh park on the featured Find. Deliver as many as you can before the week ends. Same show for everyone.',
      15,
    );

    // history (rebuilt only when it changes)
    const hk = s.showHistory.map((r) => `${r.weekKey}:${r.medals}`).join('|');
    setHidden(histHead, !s.showHistory.length);
    setHidden(histList, !s.showHistory.length);
    if (hk !== histKey) {
      histKey = hk;
      histList.replaceChildren(
        ...[...s.showHistory].reverse().map((r) =>
          h(
            'div',
            { cls: 'show-hist-row' },
            artImg('find', r.findIndex, 34),
            h('div', { cls: 'row-main' }, h('div', { cls: 'row-title', text: weekLabel(r.weekKey) }), h('div', { cls: 'row-meta', text: FINDS[r.findIndex]?.name ?? '' })),
            h('div', { cls: 'show-hist-medals' }, ...MEDALS.map((_, i) => h('span', { cls: i < r.medals ? '' : 'off' }, medalDisc(i, 26)))),
          ),
        ),
      );
    }
  }

  return { el, update };
}
