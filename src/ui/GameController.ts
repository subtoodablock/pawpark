import {
  AUTOSAVE_INTERVAL_SEC,
  FINDS,
  TREATS,
  TROPHIES,
  applyOfflineProgress,
  createInitialState,
  loadGame,
  saveGame,
  tick,
} from '../core';
import type { ActionResult, GameEvent, GameState, OfflineReport } from '../core';
import { toast } from './Toasts';

const STEP = 0.1;
const MAX_CATCHUP = 5;

type EventListenerFn = (e: GameEvent) => void;

export class GameController {
  private _state: GameState;
  private listeners: EventListenerFn[] = [];
  private frameCbs: ((dtReal: number) => void)[] = [];
  private offlineCbs: ((r: OfflineReport) => void)[] = [];
  private acc = 0;
  private last = 0;
  private sinceSave = 0;
  private running = false;
  /** set during hard reset so unload handlers don't re-save */
  suppressSave = false;

  constructor() {
    this._state = loadGame(localStorage) ?? createInitialState(Date.now());
  }

  get state(): GameState {
    return this._state;
  }

  /** Replace the whole state (import). */
  setState(s: GameState): void {
    this._state = s;
    this.save();
  }

  subscribe(fn: EventListenerFn): void {
    this.listeners.push(fn);
  }
  onFrame(fn: (dtReal: number) => void): void {
    this.frameCbs.push(fn);
  }
  onOffline(fn: (r: OfflineReport) => void): void {
    this.offlineCbs.push(fn);
  }

  /** Show a toast for a failed action; returns ok. */
  check(res: ActionResult): boolean {
    if (!res.ok) toast(res.reason ?? 'Not possible right now.', 'warn');
    return res.ok;
  }

  save(): void {
    if (this.suppressSave) return;
    try {
      saveGame(this._state, localStorage, Date.now());
    } catch {
      /* storage unavailable */
    }
    this.sinceSave = 0;
  }

  /** Apply offline progress; fires offline callbacks if earnings > 0. */
  catchUpOffline(): void {
    const report = applyOfflineProgress(this._state, Date.now());
    if (report && report.earned > 0) for (const cb of this.offlineCbs) cb(report);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.catchUpOffline();
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.save();
      } else {
        this.acc = 0;
        this.last = performance.now();
        this.catchUpOffline();
      }
    });
    window.addEventListener('beforeunload', () => this.save());
    window.addEventListener('pagehide', () => this.save());
    requestAnimationFrame(this.frame);
  }

  private frame = (t: number): void => {
    const dtReal = Math.min(MAX_CATCHUP, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    this.acc += dtReal;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      const events = tick(this._state, STEP);
      for (const e of events) this.dispatch(e);
    }
    this.sinceSave += dtReal;
    if (this.sinceSave >= AUTOSAVE_INTERVAL_SEC) this.save();
    for (const cb of this.frameCbs) cb(dtReal);
    requestAnimationFrame(this.frame);
  };

  private dispatch(e: GameEvent): void {
    switch (e.type) {
      case 'trophy': {
        const tr = TROPHIES.find((x) => x.id === e.trophyId);
        toast(
          `${tr?.icon ?? '\u{1F3C6}'} Trophy: ${tr?.name ?? e.trophyId}! +${e.collars} Legend Collar${e.collars === 1 ? '' : 's'}`,
          'gold',
          5000,
        );
        break;
      }
      case 'findUpgradeAvailable': {
        const f = FINDS[e.findIndex];
        if (f) toast(`${f.icon} ${f.name} is ready to dig! Tap Upgrade.`, 'good', 5000);
        break;
      }
      case 'mailArrived':
        toast('\u{1F4EC} You’ve got mail!', 'info');
        break;
      case 'treatExpired': {
        const t = TREATS.find((x) => x.id === e.treatId);
        toast(`${t?.icon ?? ''} ${t?.name ?? 'Treat'} wore off.`, 'info');
        break;
      }
      default:
        break;
    }
    for (const l of this.listeners) l(e);
  }
}
