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
  saveGame,
  tick,
} from '../core';
import type { ActionResult, GameEvent, GameState, OfflineReport, RewardResult } from '../core';
import { formatReward } from './labels';
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
  /** Automation activity since this page was loaded (shown in the Pack panel). */
  readonly session = { autoFinds: 0, autoPrestiges: 0, houndCatches: 0 };

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
    toast(`\u{1F4EC} ${rewards.length} letter${rewards.length === 1 ? '' : 's'}: ${parts.join(', ')}`, 'good', 4500);
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

  /** Apply offline progress; fires offline callbacks when something noteworthy happened. */
  catchUpOffline(): void {
    const report = applyOfflineProgress(this._state, Date.now());
    if (!report || report.elapsedSec < 60) return;
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
      report.endgame;
    if (happened) for (const cb of this.offlineCbs) cb(report);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.catchUpOffline();
    this.refreshDaily();
    window.setInterval(() => this.refreshDaily(), 60_000);
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.save();
      } else {
        this.acc = 0;
        this.last = performance.now();
        this.catchUpOffline();
        this.refreshDaily();
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
        if (e.goldenBones > 0) rewards.push(`+${formatNumber(e.goldenBones)} \u{1F9B4}`);
        toast(`${tr?.icon ?? '\u{1F3C6}'} Trophy: ${tr?.name ?? e.trophyId}! ${rewards.join(' ')}`, 'gold', 5000);
        break;
      }
      case 'findUnlocked': {
        const f = FINDS[e.findIndex];
        if (e.auto) {
          this.session.autoFinds++;
          if (f) toast(`Find Scout started the ${f.icon} ${f.name} Era`, 'good', 4500);
        }
        break;
      }
      case 'autoPrestige':
        this.session.autoPrestiges++;
        toast(`Opened a new park: +${formatNumber(e.gained)} \u{1F43E}`, 'gold', 5000);
        break;
      case 'squirrelHound':
        this.session.houndCatches++;
        toast(`\u{1F415} Hound caught a squirrel: ${formatReward(e.reward)}`, 'good');
        break;
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
      case 'dailyDigComplete':
        toast('Daily Dig done! Claim it \u{1F9B4}', 'good', 4500);
        break;
      case 'streakMilestone':
        toast(`\u{1F525} ${e.streak}-day streak! +${e.stars} \u2B50`, 'gold', 5000);
        break;
      default:
        break;
    }
    for (const l of this.listeners) l(e);
  }
}
