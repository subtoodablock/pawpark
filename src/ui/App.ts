import { TROPHIES, computeStats, formatDuration, formatMoney, formatNumber } from '../core';
import type { OfflineReport } from '../core';
import { GameController, type OfflineExtra } from './GameController';
import { HUD } from './HUD';
import { ParkScene } from './ParkScene';
import { Sheet } from './Sheet';
import { h } from './dom';
import { installCaseSafeAmounts } from './caseSafe';
import { artImg } from './gameArt';
import { rich } from './icons';
import { createMenuPanel } from './panels/MenuPanel';
import { initModal, showModal } from './Modal';
import { initToasts } from './Toasts';
import { createFleetPanel } from './panels/FleetPanel';
import { createKennelsPanel } from './panels/KennelsPanel';
import { createLevelPanel } from './panels/LevelPanel';
import { createStorePanel } from './panels/StorePanel';
import { createTodayPanel, treatReady } from './panels/TodayPanel';
import { MockProvider } from './payments/MockProvider';
import { createParkPanel } from './panels/ParkPanel';
import { createFindPanel } from './panels/FindPanel';
import { createResearchPanel } from './panels/ResearchPanel';
import { createPortalPanel } from './panels/PortalPanel';
import { showPrestigeInfo } from './prestige';

export function startApp(root: HTMLElement): GameController {
  const controller = new GameController();
  const hud = new HUD(controller);
  const scene = new ParkScene(controller);
  hud.onAdopt = () => scene.bounce();

  const research = createResearchPanel(controller);
  const park = createParkPanel(controller, () => sheet.openById('find'));
  const go = (id: string): void => sheet.openById(id);
  const portal = createPortalPanel(controller);

  const sheet: Sheet = new Sheet([
    { id: 'menu', icon: 'squares-four', label: 'Menu', tone: 'blue', compact: true, panel: createMenuPanel(controller, go, () => {
      go('park');
      park.scrollToSettings();
    }) },
    { id: 'today', icon: 'calendar-check', label: 'Today', tone: 'blue', panel: createTodayPanel(controller) },
    { id: 'kennels', icon: 'house', label: 'Kennels', tone: 'blue', panel: createKennelsPanel(controller) },
    { id: 'fleet', icon: 'truck', label: 'Fleet', tone: 'blue', panel: createFleetPanel(controller) },
    { id: 'research', icon: 'flask', label: 'Research', tone: 'blue', ownHeader: true, panel: research },
    { id: 'park', icon: 'tree', label: 'Park', tone: 'green', panel: park },
    { id: 'find', icon: 'magnifying-glass', label: 'Finds', tone: 'blue', ownHeader: true, panel: createFindPanel(controller, { onPrestigeInfo: () => showPrestigeInfo(controller), onClose: () => sheet.open(null) }) },
    { id: 'level', icon: 'medal', label: 'Park Level', tone: 'green', panel: createLevelPanel(controller) },
    { id: 'store', icon: 'storefront', label: 'Kennel Club', tone: 'purple', panel: createStorePanel(controller, new MockProvider()) },
    { id: 'portal', icon: 'spiral-bold', label: 'Paw Portal', tone: 'purple', panel: portal },
  ]);
  scene.onPortalTap = () => sheet.openById('portal');
  hud.onOpenFind = () => sheet.openById('find');
  hud.onOpenLevel = () => sheet.openById('level');
  hud.onOpenStore = () => sheet.openById('store');
  hud.onNav = (id) => {
    if (id === 'store') sheet.openById('store');
    else if (id === 'portal') sheet.openById('portal');
    else if (id === 'menu') {
      if (sheet.activeId === 'menu') sheet.open(null);
      else sheet.openById('menu');
    }
    else if (id === 'research') sheet.openById('research');
    else {
      sheet.openById('research');
      research.showTab('epic');
      research.scrollToTreats();
    }
  };

  const app = h('div', { cls: 'game' }, hud.top, scene.el, hud.controls, sheet.sheet);
  root.replaceChildren(app);
  initToasts(app);
  initModal(app);
  installCaseSafeAmounts(app);

  controller.subscribe((e) => {
    if (e.type === 'mailArrived') scene.floater('MAIL', scene.el.clientWidth - 32, 100);
    if (e.type === 'endgame') showEndgame(controller);
  });
  controller.onOffline((r, extra) => {
    showWelcomeBack(r, extra);
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
      hud.setDot('menu', treatReady(controller) || portalReady(controller));
    }
  });
  hud.update();
  controller.start();
  hud.setDot('menu', treatReady(controller) || portalReady(controller));
  return controller;
}

function portalReady(c: GameController): boolean {
  const p = c.home.portal;
  return !!p && p.slots.some((e) => !!e && Date.now() >= e.returnsAt);
}

function showWelcomeBack(r: OfflineReport, extra: OfflineExtra): void {
  const rows: [string, string][] = [];
  const add = (label: string, value: string, show: boolean): void => {
    if (show) rows.push([label, value]);
  };
  add('{coins} Cash earned', `+${formatMoney(r.earned)}`, r.earned > 0);
  const pups = Math.round(r.pupsGained);
  add('{dog} Pups', `${pups > 0 ? '+' : ''}${formatNumber(pups)}`, pups !== 0);
  add('{hammer} Automation purchases', formatNumber(r.purchases), r.purchases > 0);
  add('{tree} New parks opened', `${r.prestiges} (+${formatNumber(r.spiritPawsGained)} {paw})`, r.prestiges > 0);
  add('{bone} Golden Bones', `+${formatNumber(r.goldenBonesGained)}`, r.goldenBonesGained > 0);
  add('{dog} Squirrels caught by hound', formatNumber(r.squirrelsCaught), r.squirrelsCaught > 0);
  add('{mail} Letters waiting', formatNumber(r.mailWaiting), r.mailWaiting > 0);
  const best = extra.bestRarity >= 2 ? ` (${extra.bestRarity === 3 ? 'a Legendary' : 'an Epic'}!)` : '';
  add('{spiral} Expeditions returned', `${extra.expeditions}${best}`, extra.expeditions > 0);
  add('{flag} Dog Show finds', `+${formatNumber(extra.showFinds)}`, extra.showFinds > 0);
  add('{trophy} Dog Show medals', `+${extra.showMedalsGained}`, extra.showMedalsGained > 0 && !extra.showEnded);
  add('{trophy} Dog Show ended', `${extra.showEnded?.medals ?? 0} medal${extra.showEnded?.medals === 1 ? '' : 's'}`, !!extra.showEnded);

  const finds = r.findsUnlocked.map((i) => artImg('find', i, 30));
  const row = (label: string, ...value: (Node | string)[]): HTMLElement => h('li', null, h('span', null, ...rich(label, 16)), h('b', null, ...value));

  showModal(
    'Welcome back!',
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
        ...rows.map(([k, v]) => row(k, ...rich(v, 14))),
        r.findsUnlocked.length ? h('li', null, h('span', { text: 'New eras reached' }), h('b', { cls: 'finds' }, ...finds)) : null,
        r.trophies.length ? row('{trophy} Trophies earned', String(r.trophies.length)) : null,
      ),
    ],
    [{ label: 'Collect', primary: true }],
    { tone: 'blue' },
  );
}

function showEndgame(controller: GameController): void {
  const s = controller.state;
  const d = computeStats(s);
  showModal(
    'Paw Park Legend!',
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
    { celebrate: true, tone: 'purple' },
  );
}
