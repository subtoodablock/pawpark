import { FINDS, TROPHIES, computeStats, formatDuration, formatMoney, formatNumber } from '../core';
import type { OfflineReport } from '../core';
import { GameController } from './GameController';
import { HUD } from './HUD';
import { ParkScene } from './ParkScene';
import { Sheet } from './Sheet';
import { h } from './dom';
import { initModal, showModal } from './Modal';
import { initToasts, toast } from './Toasts';
import { createAcademyPanel } from './panels/AcademyPanel';
import { createFleetPanel } from './panels/FleetPanel';
import { createKennelsPanel } from './panels/KennelsPanel';
import { createPackPanel } from './panels/PackPanel';
import type { Panel } from './panels/common';
import { createLevelPanel } from './panels/LevelPanel';
import { createStorePanel } from './panels/StorePanel';
import { createTodayPanel, treatReady } from './panels/TodayPanel';
import { MockProvider } from './payments/MockProvider';
import { createParkPanel } from './panels/ParkPanel';
import { createTrainingPanel } from './panels/TrainingPanel';

export function startApp(root: HTMLElement): GameController {
  const controller = new GameController();
  const hud = new HUD(controller);
  const scene = new ParkScene(controller);
  hud.onAdopt = () => scene.bounce();
  hud.onFindUpgraded = (icon) => toast(`${icon} New find unlocked!`, 'gold');

  const pack = createPackPanel(controller, () => academyEl.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const academy = createAcademyPanel(controller);
  const academyEl = academy.el;
  // Pack lives inside the Academy tab (7 tabs do not fit 360px)
  const packAcademy: Panel = {
    el: h('div', { cls: 'panel-stack' }, pack.el, academy.el),
    update: () => {
      pack.update();
      academy.update();
    },
  };

  const sheet: Sheet = new Sheet([
    { id: 'today', icon: '\u{1F4C5}', label: 'Today', panel: createTodayPanel(controller) },
    { id: 'training', icon: '\u{1F393}', label: 'Training', panel: createTrainingPanel(controller) },
    { id: 'kennels', icon: '\u{1F3E0}', label: 'Kennels', panel: createKennelsPanel(controller) },
    { id: 'fleet', icon: '\u{1F69A}', label: 'Fleet', panel: createFleetPanel(controller) },
    { id: 'academy', icon: '\u{1F9B4}', label: 'Pack', panel: packAcademy },
    { id: 'park', icon: '\u{1F3DE}\uFE0F', label: 'Park', panel: createParkPanel(controller) },
    { id: 'level', icon: '\u{1F3C5}', label: 'Park Level', panel: createLevelPanel(controller), hidden: true },
    { id: 'store', icon: '\u2B50', label: 'Kennel Club', panel: createStorePanel(controller, new MockProvider()), hidden: true },
  ]);
  hud.onOpenLevel = () => sheet.openById('level');
  hud.onOpenStore = () => sheet.openById('store');

  const app = h('div', { cls: 'game' }, hud.top, scene.el, hud.controls, sheet.sheet, sheet.tabbar);
  root.replaceChildren(app);
  initToasts(app);
  initModal(app);

  controller.subscribe((e) => {
    if (e.type === 'mailArrived') scene.floater('\u{1F4EC}', scene.el.clientWidth - 32, 100);
    if (e.type === 'endgame') showEndgame(controller);
  });
  controller.onOffline((r) => {
    showWelcomeBack(r);
    if (r.endgame) showEndgame(controller);
  });

  let acc = 0;
  controller.onFrame((dt) => {
    hud.update();
    scene.frame(dt);
    acc += dt;
    if (acc >= 0.25) {
      acc = 0;
      sheet.update();
      sheet.setBadge('today', treatReady(controller));
    }
  });
  hud.update();
  controller.start();
  sheet.setBadge('today', treatReady(controller));
  return controller;
}

function showWelcomeBack(r: OfflineReport): void {
  const rows: [string, string][] = [];
  const add = (label: string, value: string, show: boolean): void => {
    if (show) rows.push([label, value]);
  };
  add('\u{1F4B0} Cash earned', `+${formatMoney(r.earned)}`, r.earned > 0);
  const pups = Math.round(r.pupsGained);
  add('\u{1F415} Pups', `${pups > 0 ? '+' : ''}${formatNumber(pups)}`, pups !== 0);
  add('\u{1F528} Automation purchases', formatNumber(r.purchases), r.purchases > 0);
  add('\u{1F3DE}️ New parks opened', `${r.prestiges} (+${formatNumber(r.spiritPawsGained)} \u{1F43E})`, r.prestiges > 0);
  add('\u{1F9B4} Golden Bones', `+${formatNumber(r.goldenBonesGained)}`, r.goldenBonesGained > 0);
  add('\u{1F43F}️ Squirrels caught by hound', formatNumber(r.squirrelsCaught), r.squirrelsCaught > 0);
  add('\u{1F4EC} Letters waiting', formatNumber(r.mailWaiting), r.mailWaiting > 0);

  const finds = r.findsUnlocked.map((i) => FINDS[i]?.icon ?? '?').join(' ');
  const trophies = r.trophies.map((id) => TROPHIES.find((t) => t.id === id)).map((t) => t?.icon ?? '\u{1F3C6}').join(' ');

  showModal(
    'Welcome back! \u{1F415}',
    [
      h('p', { text: `You were away for ${formatDuration(r.elapsedSec)}.` }),
      r.lostSec > 0
        ? h('div', {
            cls: 'report-warn',
            text: `Treat Jar full — lost ${formatDuration(r.lostSec)}. Upgrade Bigger Treat Jar in the Academy.`,
          })
        : null,
      h(
        'ul',
        { cls: 'report-list' },
        ...rows.map(([k, v]) => h('li', null, h('span', { text: k }), h('b', { text: v }))),
        r.findsUnlocked.length ? h('li', null, h('span', { text: '\u{1F50D} Finds unlocked' }), h('b', { text: finds })) : null,
        r.trophies.length ? h('li', null, h('span', { text: '\u{1F3C6} Trophies earned' }), h('b', { text: trophies })) : null,
      ),
    ],
    [{ label: 'Yay!', primary: true }],
  );
}

function showEndgame(controller: GameController): void {
  const s = controller.state;
  const d = computeStats(s);
  showModal(
    '\u{1F30C} Paw Park Legend!',
    [
      h('p', { text: 'Congratulations! You dug up the Cosmic Bone and became a Paw Park Legend.' }),
      h(
        'ul',
        { cls: 'report-list' },
        h('li', null, h('span', { text: 'Lifetime earnings' }), h('b', { text: formatMoney(s.lifetimeEarnings) })),
        h('li', null, h('span', { text: 'Parks opened' }), h('b', { text: formatNumber(s.prestigeCount) })),
        h('li', null, h('span', { text: 'Pups adopted' }), h('b', { text: formatNumber(s.stats.totalAdopted) })),
        h('li', null, h('span', { text: 'Squirrels caught' }), h('b', { text: formatNumber(s.stats.squirrelsCaught) })),
        h('li', null, h('span', { text: 'Legend Collars' }), h('b', { text: formatNumber(s.legendCollars) })),
        h('li', null, h('span', { text: 'Trophies' }), h('b', { text: `${s.trophies.length} / ${TROPHIES.length}` })),
        h('li', null, h('span', { text: 'Time played' }), h('b', { text: formatDuration(s.stats.totalPlaySec) })),
        h('li', null, h('span', { text: 'Income' }), h('b', { text: `${formatMoney(d.incomePerSec)}/s` })),
      ),
      h('p', { cls: 'muted', text: 'The game keeps going. Keep opening parks and collecting everything!' }),
    ],
    [{ label: 'Keep playing', primary: true }],
  );
}
