import '@fontsource/barlow-condensed/300.css';
import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import './style.css';
import { startApp } from './ui/App';
import type { GameController } from './ui/GameController';

declare global {
  interface Window {
    pawpark: { readonly state: GameController['state']; controller: GameController };
  }
}

const root = document.getElementById('app')!;
const controller = startApp(root);
window.pawpark = {
  get state() {
    return controller.state;
  },
  controller,
};

// block double-tap zoom / pinch on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
