import {
  AUTOSAVE_INTERVAL_SEC,
  FINDS,
  TREATS,
  TROPHIES,
  applyOfflineProgress,
  createInitialState,
  dayKeyOf,
  formatNumber,
  loadGame,
  openAllMail,
  refreshDaily,
  refreshShow,
  showMedals,
  bestRarity,
  saveGame,
  tick,
} from '../core';
import type { ActionResult, GameEvent, GameState, OfflineReport, RewardResult } from '../core';
import { formatReward } from './labels';
import { toast } from './Toasts';

const STEP = 0.1;
const MAX_CATCHUP = 5;

type EventListenerFn = (e: GameEvent) => void;

/** Extra Welcome Back facts the engine's OfflineReport does not carry (Dog Show + Paw Portal). */
export interface OfflineExtra {
  showFinds: number;
  showMedalsGained: number;
  showEnded: { medals: number } | null;
  expeditions: number;
  bestRarity: number;
}

export class GameController {
  private _state: GameState;
  /** true while the HUD, scene and shops act on the Dog Show park */
  private _viewShow = false;
  private viewListeners: (() => void)[] = [];
  private listeners: EventListenerFn[] = [];
  private frameCbs: ((dtReal: number) => void)[] = [];
  private offlineCbs: ((r: OfflineReport, extra: OfflineExtra) => void)[] = [];
  private acc = 0;
  private last = 0;
  private sinceSave = 0;
  private running = false;
  /** set during hard reset so unload handlers don't re-save */
  suppressSave = false;
  /** Automation activity since this page was loaded (shown in the Pack panel). */
  readonly session = { autoFinds: 0, autoPrestiges: 0, houndCatches: 0 };

  constructor() {
    this._state = loadGame(localStorage) ?? createInitialState(Date.now());
  }

  /** The park the HUD, scene and shops act on: the Dog Show park while viewing it, otherwise home. */
  get state(): GameState {
    return this._viewShow && this._state.show ? this._state.show.park : this._state;
  }

  /** The real (home) save. Meta systems (Academy, Portal, Trophies, Daily, Store) always use this. */
  get home(): GameState {
    return this._state;
  }

  get viewingShow(): boolean {
    return this._viewShow && !!this._state.show;
  }

  setViewShow(on: boolean): void {
    const v = on && !!this._state.show;
    if (v === this._viewShow) return;
    this._viewShow = v;
    for (const l of this.viewListeners) l();
  }

  onView(fn: () => void): void {
    this.viewListeners.push(fn);
  }

  /** Replace the whole state (import). */
  setState(s: GameState): void {
    this._state = s;
    this._viewShow = false;
    this.save();
  }

  subscribe(fn: EventListenerFn): void {
    this.listeners.push(fn);
  }
  onFrame(fn: (dtReal: number) => void): void {
    this.frameCbs.push(fn);
  }
  onOffline(fn: (r: OfflineReport, extra: OfflineExtra) => void): void {
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

  /** Open every letter and show one summarizing toast. Returns the rewards. */
  collectMail(): RewardResult[] {
    const rewards = openAllMail(this._state);
    if (!rewards.length) return rewards;
    let cash = 0;
    let bones = 0;
    const treats: RewardResult[] = [];
    for (const r of rewards) {
      if (r.kind === 'cash') cash += r.amount;
      else if (r.kind === 'goldenBones') bones += r.amount;
      else treats.push(r);
    }
    const parts: string[] = [];
    if (cash > 0) parts.push(formatReward({ kind: 'cash', amount: cash }));
    if (bones > 0) parts.push(formatReward({ kind: 'goldenBones', amount: bones }));
    for (const t of treats) parts.push(formatReward(t));
    toast(`{mail} ${rewards.length} letter${rewards.length === 1 ? '' : 's'}: ${parts.join(', ')}`, 'good', 4500);
    return rewards;
  }

  /** Local calendar day key. */
  today(): string {
    return dayKeyOf(new Date());
  }

  /** Roll the daily state over to today (digs, modifier) and route any events. */
  refreshDaily(): void {
    for (const e of refreshDaily(this._state, this.today())) this.dispatch(e);
  }

  /** Close a finished Dog Show (auto-claims its goals) and route the events. */
  refreshShow(): void {
    for (const e of refreshShow(this._state, Date.now())) this.dispatch(e);
    if (this._viewShow && !this._state.show) this.setViewShow(false);
  }

  /** Apply offline progress; fires offline callbacks when something noteworthy happened. */
  catchUpOffline(): void {
    const home = this._state;
    const showBefore = home.show ? home.show.park.stats.findsDelivered ?? 0 : 0;
    const medalsBefore = showMedals(home) ?? 0;
    const showWeek = home.show?.weekKey;
    const now = Date.now();
    const report = applyOfflineProgress(home, now);
    if (!report || report.elapsedSec < 60) return;
    const ended = showWeek && !home.show ? home.showHistory[home.showHistory.length - 1] : null;
    const extra: OfflineExtra = {
      showFinds: home.show ? (home.show.park.stats.findsDelivered ?? 0) - showBefore : 0,
      showMedalsGained: Math.max(0, (showMedals(home) ?? 0) - medalsBefore),
      showEnded: ended && ended.weekKey === showWeek ? { medals: ended.medals } : null,
      expeditions: 0,
      bestRarity: 0,
    };
    for (const e of home.portal?.slots ?? []) {
      if (e && now >= e.returnsAt) {
        extra.expeditions++;
        extra.bestRarity = Math.max(extra.bestRarity, bestRarity(e.loot));
      }
    }
    const happened =
      report.earned > 0 ||
      report.lostSec > 0 ||
      report.purchases > 0 ||
      report.findsUnlocked.length > 0 ||
      report.prestiges > 0 ||
      report.goldenBonesGained > 0 ||
      report.squirrelsCaught > 0 ||
      report.trophies.length > 0 ||
      report.mailWaiting > 0 ||
      extra.expeditions > 0 ||
      extra.showFinds > 0 ||
      !!extra.showEnded ||
      report.endgame;
    if (happened) for (const cb of this.offlineCbs) cb(report, extra);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.catchUpOffline();
    this.refreshDaily();
    this.refreshShow();
    window.setInterval(() => {
      this.refreshDaily();
      this.refreshShow();
    }, 60_000);
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.save();
      } else {
        this.acc = 0;
        this.last = performance.now();
        this.catchUpOffline();
        this.refreshDaily();
        this.refreshShow();
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
        const rewards: string[] = [];
        if (e.collars > 0) rewards.push(`+${e.collars} Legend Collar${e.collars === 1 ? '' : 's'}`);
        if (e.goldenBones > 0) rewards.push(`+${formatNumber(e.goldenBones)} {bone}`);
        toast(`{trophy} Trophy: ${tr?.name ?? e.trophyId}! ${rewards.join(' ')}`, 'gold', 5000);
        break;
      }
      case 'findUnlocked': {
        const f = FINDS[e.findIndex];
        if (e.auto) {
          this.session.autoFinds++;
          if (f) toast(`Find Scout started the ${f.name} Era`, 'good', 4500);
        }
        break;
      }
      case 'autoPrestige':
        this.session.autoPrestiges++;
        toast(`Opened a new park: +${formatNumber(e.gained)} {paw}`, 'gold', 5000);
        break;
      case 'squirrelHound':
        this.session.houndCatches++;
        toast(`{dog} Hound caught a squirrel: ${formatReward(e.reward)}`, 'good');
        break;
      case 'findUpgradeAvailable': {
        const f = FINDS[e.findIndex];
        if (f) toast(`${f.name} is ready to dig! Tap Upgrade.`, 'good', 5000);
        break;
      }
      case 'showGoalReached':
        toast(`{trophy} Dog Show: ${['Bronze', 'Silver', 'Gold'][e.goalIndex] ?? ''} medal reached! Claim it in Finds`, 'gold', 5000);
        break;
      case 'showEnded':
        toast(`{trophy} The Dog Show has ended: ${e.medals} medal${e.medals === 1 ? '' : 's'}`, 'gold', 5000);
        break;
      case 'portalUnlocked':
        toast('{spiral} The Paw Portal is open! Build the gate on your lawn', 'gold', 6000);
        break;
      case 'expeditionReturned':
        toast(`{spiral} A crew is back${e.bestRarity >= 2 ? ` with ${e.bestRarity === 3 ? 'a LEGENDARY' : 'an Epic'} find` : ''}! Open the Portal`, e.bestRarity >= 2 ? 'gold' : 'good', 5000);
        break;
      case 'mailArrived':
        toast('{mail} You’ve got mail!', 'info');
        break;
      case 'treatExpired': {
        const t = TREATS.find((x) => x.id === e.treatId);
        toast(`${t?.name ?? 'Treat'} wore off.`, 'info');
        break;
      }
      case 'dailyDigComplete':
        toast('Daily Dig done! Claim it {bone}', 'good', 4500);
        break;
      case 'streakMilestone':
        toast(`{fire} ${e.streak}-day streak! +${e.stars} {star}`, 'gold', 5000);
        break;
      default:
        break;
    }
    for (const l of this.listeners) l(e);
  }
}
