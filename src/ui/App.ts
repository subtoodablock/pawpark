import { formatDuration, formatMoney, formatNumber } from '../core';
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
import { createParkPanel } from './panels/ParkPanel';
import { createTrainingPanel } from './panels/TrainingPanel';

export function startApp(root: HTMLElement): GameController {
  const controller = new GameController();
  const hud = new HUD(controller);
  const scene = new ParkScene(controller);
  hud.onAdopt = () => scene.bounce();
  hud.onFindUpgraded = (icon) => toast(`${icon} New find unlocked!`, 'gold');

  const sheet = new Sheet([
    { id: 'training', icon: '\u{1F393}', label: 'Training', panel: createTrainingPanel(controller) },
    { id: 'kennels', icon: '\u{1F3E0}', label: 'Kennels', panel: createKennelsPanel(controller) },
    { id: 'fleet', icon: '\u{1F69A}', label: 'Fleet', panel: createFleetPanel(controller) },
    { id: 'academy', icon: '\u{1F9B4}', label: 'Academy', panel: createAcademyPanel(controller) },
    { id: 'park', icon: '\u{1F3DE}️', label: 'Park', panel: createParkPanel(controller) },
  ]);

  const app = h('div', { cls: 'game' }, hud.top, scene.el, hud.controls, sheet.sheet, sheet.tabbar);
  root.replaceChildren(app);
  initToasts(app);
  initModal(app);

  controller.subscribe((e) => {
    if (e.type === 'mailArrived') scene.floater('\u{1F4EC}', 300, 100);
  });
  controller.onOffline((r) => {
    showModal(
      'Welcome back! \u{1F415}',
      [
        h('p', { text: `You were away for ${formatDuration(r.elapsedSec)}.` }),
        r.simulatedSec < r.elapsedSec - 1 ? h('p', { cls: 'muted', text: `Your Treat Jar held ${formatDuration(r.simulatedSec)} of progress.` }) : null,
        h('p', { cls: 'big', text: `+${formatMoney(r.earned)}` }),
        r.pupsGained >= 1 ? h('p', { text: `\u{1F43E} ${formatNumber(Math.floor(r.pupsGained))} pups were rescued.` }) : null,
      ],
      [{ label: 'Yay!', primary: true }],
    );
  });

  let acc = 0;
  controller.onFrame((dt) => {
    hud.update();
    scene.frame(dt);
    acc += dt;
    if (acc >= 0.25) {
      acc = 0;
      sheet.update();
    }
  });
  hud.update();
  controller.start();
  return controller;
}
