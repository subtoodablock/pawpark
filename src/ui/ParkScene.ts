// The canvas park scene. Orchestrates procedural layers/sprites in src/ui/render/** (docs/07-art-direction.md).
// Public surface used by App.ts / GameController: constructor, el, bounce(), floater(), frame(dt).
import { getDayNight } from './prefs';
import { FINDS, KENNEL_SLOTS, TOP_VEHICLE_TIER, bestRarity, catchSquirrel, computeStats, kennelUpgradeCost } from '../core';
import type { RewardResult, Squirrel } from '../core';
import type { GameController } from './GameController';
import { formatReward } from './labels';
import { toast } from './Toasts';
import { h } from './dom';
import { SpriteCache, blit, makeCanvas } from './render/SpriteCache';
import type { SpriteCanvas, Sprite } from './render/SpriteCache';
import { Particles } from './render/particles';
import { findArt, treatArt } from './render/art';
import { FONT } from './render/palette';
import { clamp, contactShadow, easeOutBack, hash01, rng } from './render/shade';
import { Flock, type SimEnv, drawPup, drawPupShadow } from './render/PupActor';
import { PortalFx } from './render/portal';
import type { PupActor } from './render/PupActor';
import {
  ADOPT_AX,
  ADOPT_AY,
  ADOPT_H,
  ADOPT_W,
  BLD_AX,
  BLD_AY,
  BLD_H,
  BLD_W,
  KENNEL_COUNT,
  KENNEL_FX,
  MAIL_AX,
  MAIL_AY,
  MAIL_H,
  MAIL_W,
  drawAdoptionCenter,
  drawAdoptionShadow,
  drawDoorLeaf,
  drawKennelBody,
  drawKennelShadow,
  drawMailFlag,
  drawMailShadow,
  drawMailbox,
} from './render/buildings';
import { VEHICLE_SPECS, VEH_AX, VEH_AY, VEH_H, VEH_W, drawSwirl, drawVehicle, drawWheel } from './render/vehicles';
import {
  DEPOT_AX,
  DEPOT_AY,
  DEPOT_H,
  DEPOT_W,
  type Layout,
  TREE_AX,
  TREE_AY,
  TREE_H,
  TREE_W,
  type Tint,
  computeLayout,
  depthScale,
  drawButterfly,
  drawCloud,
  drawDepot,
  drawGlow,
  drawGround,
  drawSky,
  drawTree,
  tintAt,
} from './render/world';
import { SQ_AX, SQ_AY, SQ_H, SQ_W, SQUIRREL_POSES as SQ_POSES, drawSquirrel } from './render/squirrel';
import type { SquirrelPose } from './render/squirrel';
import { BREEDS } from './render/breeds';
import { DogSheet, parseSheet } from './render/dogSheet';
import { artSheetRequested, mountArtSheet } from './render/artSheet';
import { POSE_FRAMES, DOG_H, DOG_W, dogKey, drawDogFrame, drawTail, tailKey, TAIL_W } from './render/dogSprite';
import type { Pose } from './render/dogSprite';

const EMOJI_RE = /[\p{Extended_Pictographic}\u200d\ufe0f]/gu;
/** no emoji anywhere on the canvas or in toasts raised from it (docs/12 section 4) */
function noEmoji(t: string): string {
  return t.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}
const MAX_VISIBLE = 56;
/** sled cars drawn behind the leader (the rest still count for capacity) */
const MAX_DRAWN_CARS = 6;
const CAR_SCALE = 0.74;
const DASH: number[] = [5, 4];
const NO_DASH: number[] = [];

interface Floater {
  /** small drawn icon before the text: 'bone', 'mail' or a treat id */
  icon: string;
  text: string;
  x: number;
  y: number;
  age: number;
  color: string;
}
interface FindPop {
  on: boolean;
  x: number;
  y: number;
  age: number;
  /** index into FINDS */
  idx: number;
}
interface Mound {
  on: boolean;
  x: number;
  y: number;
  age: number;
}
interface Caught {
  on: boolean;
  x: number;
  y: number;
  age: number;
  flip: number;
}
interface Slot {
  tier: number | null;
  old: number | null;
  anim: number;
  fxDone: boolean;
}
interface Veh {
  tier: number | null;
  /** false while parked inside the depot (hidden), waiting to pull out */
  out: boolean;
  /** seconds until the vehicle may pull out again (after a lap) */
  wait: number;
  x: number;
  wheel: number;
  pop: number;
  bob: number;
  /** extra sled cars trailing the leader (top tier only) */
  cars: number;
}
interface Cloud {
  x: number;
  y: number;
  speed: number;
  w: number;
  hh: number;
  seed: number;
}
interface Item {
  y: number;
  kind: number;
  i: number;
  a: PupActor | null;
}

const enum Kind {
  Kennel,
  Center,
  Mail,
  Tree,
  Squirrel,
  Pup,
  Portal,
}

function byItemY(a: Item, b: Item): number {
  return a.y - b.y;
}

export class ParkScene {
  readonly el: HTMLElement;
  private canvas = h('canvas', { cls: 'park-canvas', attrs: { 'aria-label': 'Park scene' } });
  private ctx: CanvasRenderingContext2D;
  private w = 300;
  private hgt = 260;
  private dpr = 1;
  private t = 0;
  private L: Layout;
  private cache = new SpriteCache();
  private particles = new Particles();
  private flock = new Flock();
  private sky: SpriteCanvas | null = null;
  private ground: SpriteCanvas | null = null;
  private skyNight = false;
  private tint: Tint = tintAt(12);
  private hourOverride: number | null = null;
  private clouds: Cloud[] = [];
  private floaters: Floater[] = [];
  private finds: FindPop[] = [];
  private mounds: Mound[] = [];
  private caught: Caught[] = [];
  private slots: Slot[] = [];
  private vehs: Veh[] = [];
  private lastVehTier: (number | null)[] = [];
  private itemPool: Item[] = [];
  private list: Item[] = [];
  private env: SimEnv;
  private doors: { x: number; y: number }[] = [];
  private centerDoor = { x: 0, y: 0 };
  private lastAdopted = -1;
  private pending = 0;
  private spawnAcc = 0;
  private doorT = 0;
  private doorOpen = 0;
  private mailFlag = 0;
  private zoom = 0;
  private statT = 0;
  private maxZoomies = 20;
  private lastPups = -1;
  private fireflyT = 0;
  private smokeT = 0;
  private sparkT = 0;
  private warm: (() => void)[] = [];
  private frames = 0;
  private msWin: number[] = [];
  private lastHidden = false;
  private dogSheet: DogSheet | null = null;
  private seenSquirrels = new Set<number>();
  private portalFx = new PortalFx();
  /** launchedAt of each slot's expedition as last seen (0 = empty) */
  private portalSig: number[] = [];
  private portalReady: boolean[] = [];
  private portalSeen = false;
  /** the Portal Gate was tapped (opens the Portal panel) */
  onPortalTap: () => void = () => {};

  constructor(private c: GameController) {
    this.el = h('section', { cls: 'scene' }, this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.L = computeLayout(this.w, this.hgt, KENNEL_SLOTS);
    this.env = {
      L: this.L,
      zoom: 0,
      particles: this.particles,
      doors: this.doors,
      centerDoor: this.centerDoor,
      target: 0,
      findPop: (x, y) => this.addFind(x, y),
      mound: (x, y) => this.addMound(x, y),
      doorKick: () => {
        this.doorT = 0.45;
      },
    };
    for (let i = 0; i < 16; i++) this.finds.push({ on: false, x: 0, y: 0, age: 0, idx: 0 });
    for (let i = 0; i < 28; i++) this.mounds.push({ on: false, x: 0, y: 0, age: 0 });
    for (let i = 0; i < 6; i++) this.caught.push({ on: false, x: 0, y: 0, age: 0, flip: 1 });
    for (let i = 0; i < KENNEL_SLOTS; i++) this.slots.push({ tier: null, old: null, anim: 1, fxDone: true });
    try {
      if (artSheetRequested(location.search)) mountArtSheet(location.search);
    } catch {
      /* ignore */
    }
    try {
      const sheet = parseSheet(location.search);
      if (sheet) this.dogSheet = new DogSheet(sheet);
    } catch {
      /* ignore */
    }
    try {
      const q = new URLSearchParams(location.search).get('hour');
      if (q !== null && q !== '' && !Number.isNaN(Number(q))) this.hourOverride = Number(q);
    } catch {
      /* ignore */
    }
    this.queueWarm();
    this.c.onView(() => {
      this.snapView = true;
      this.lastAdopted = -1;
      this.pending = 0;
      this.portalSeen = false;
      for (const v of this.vehs) if (v) v.tier = null;
    });
    new ResizeObserver(() => this.resize()).observe(this.el);
    this.canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resize();
  }

  // ---------------------------------------------------------------- sizing + static layers

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(100, Math.round(r.width));
    const hh = Math.max(120, Math.round(r.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && hh === this.hgt && dpr === this.dpr && this.ground) return;
    this.w = w;
    this.hgt = hh;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hh * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = hh + 'px';
    this.cache.setDpr(dpr);
    this.L = computeLayout(w, hh, KENNEL_SLOTS);
    this.env.L = this.L;
    this.computeAnchors();
    this.buildGround();
    this.buildSky();
    this.buildClouds();
    this.queueWarm();
    // keep pups on the (new) lawn
    for (const a of this.flock.actors) {
      a.x = clamp(a.x, 8, w - 8);
      a.y = clamp(a.y, this.L.kennelBase + 4, this.L.lawnBottom);
      a.tx = clamp(a.tx, 16, w - 16);
      a.ty = clamp(a.ty, this.L.kennelBase + 16, this.L.lawnBottom);
    }
    // Resizing clears the canvas, and the ResizeObserver fires after this frame's draw: repaint now so the scene never flashes blank.
    if (this.frames > 0 && !this.dogSheet) {
      try {
        this.draw();
      } catch {
        /* next frame repaints */
      }
    }
  }

  private computeAnchors(): void {
    const L = this.L;
    this.centerDoor.x = L.centerX;
    this.centerDoor.y = L.centerY + 5 * L.bs;
    this.doors.length = 0;
  }

  private layer(hh: number, fn: (ctx: CanvasRenderingContext2D) => void): SpriteCanvas {
    const c = makeCanvas(Math.round(this.w * this.dpr), Math.round(hh * this.dpr));
    const x = c.getContext('2d') as CanvasRenderingContext2D;
    x.scale(this.dpr, this.dpr);
    fn(x);
    return c;
  }

  private buildGround(): void {
    this.ground = this.layer(this.hgt, (x) => drawGround(x, this.L, this.dpr));
  }

  private buildSky(): void {
    this.skyNight = this.tint.night;
    this.sky = this.layer(this.L.horizon + 30, (x) => drawSky(x, this.L, this.skyNight));
  }

  private buildClouds(): void {
    const L = this.L;
    const r = rng(77);
    this.clouds.length = 0;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const sc = 0.55 + r() * 0.65;
      const w = 70 * sc + 30;
      this.clouds.push({
        x: (L.w + 160) * (i / n) - 60 + r() * 30,
        y: 6 + r() * Math.max(10, L.horizon * 0.5 - 6) + (i % 2) * 8,
        speed: 3 + sc * 7,
        w,
        hh: w * 0.45,
        seed: i + 3,
      });
    }
  }

  private queueWarm(): void {
    this.warm.length = 0;
    const cache = this.cache;
    // stand frame first so there is always a fallback, then the rest of each breed (round robin)
    const frames: [Pose, number][] = [['walk', 0]];
    for (const p of ['walk', 'run', 'sit', 'dig', 'nap', 'sniff'] as Pose[]) for (let f = 0; f < POSE_FRAMES[p]; f++) if (!(p === 'walk' && f === 0)) frames.push([p, f]);
    for (let b = 0; b < BREEDS.length; b++) {
      this.warm.push(() => {
        cache.get(dogKey(b, 'walk', 0, false), DOG_W, DOG_H, (ctx) => drawDogFrame(ctx, BREEDS[b], 'walk', 0, false));
        cache.get(tailKey(b, false), TAIL_W, TAIL_W, (ctx) => drawTail(ctx, BREEDS[b], false));
      });
    }
    for (let fi = 1; fi < frames.length; fi++) {
      for (let b = 0; b < BREEDS.length; b++) {
        const [p, f] = frames[fi];
        this.warm.push(() => {
          cache.get(dogKey(b, p, f, false), DOG_W, DOG_H, (ctx) => drawDogFrame(ctx, BREEDS[b], p, f, false));
        });
      }
    }
    // static scene sprites + whatever the current state needs, spread over the first frames
    const extra: (() => void)[] = [];
    const lit = this.tint.lit ? 1 : 0;
    extra.push(() => cache.get(`adopt:${lit}`, ADOPT_W, ADOPT_H, (cx) => drawAdoptionCenter(cx, lit === 1)));
    extra.push(() => cache.get('mailbox', MAIL_W, MAIL_H, (cx) => drawMailbox(cx)));
    extra.push(() => cache.get('mailflag', 20, 26, (cx) => drawMailFlag(cx)));
    extra.push(() => cache.get('depot', DEPOT_W, DEPOT_H, (cx, _w, _h, d) => drawDepot(cx, d)));
    for (const v of [0, 1, 2]) extra.push(() => cache.get(`tree:${v}`, TREE_W, TREE_H, (cx) => drawTree(cx, v)));
    for (const p of SQ_POSES) extra.push(() => cache.get(`sq:${p}`, SQ_W, SQ_H, (cx) => drawSquirrel(cx, p)));
    try {
      const st = this.c.state;
      for (const t of st.kennels) {
        if (t === null || t === undefined) continue;
        extra.push(() => cache.get(`kennel:${t}:${lit}`, BLD_W, BLD_H, (cx) => drawKennelBody(cx, t, lit === 1)));
        extra.push(() => cache.get(`kshadow:${t}`, BLD_W, BLD_H, (cx, _w, _h, d) => drawKennelShadow(cx, t, d)));
      }
      for (const t of st.vehicles) {
        if (t === null || t === undefined) continue;
        extra.push(() => cache.get(`veh:${t}`, VEH_W, VEH_H, (cx) => drawVehicle(cx, t)));
      }
    } catch {
      /* state not ready */
    }
    // run order: stand frames first (fallbacks), then the static scene, then the remaining dog frames
    const nBreeds = BREEDS.length;
    const head = this.warm.slice(0, nBreeds);
    const tail = this.warm.slice(nBreeds);
    this.warm = [...head, ...extra, ...tail];
    this.warm.reverse();
  }

  // ---------------------------------------------------------------- public API

  /** Called by the whistle: the Adoption Center squishes and a few pups hop. */
  bounce(): void {
    this.flock.bounce(5);
    this.doorT = 0.5;
    this.centerSquash = 1;
  }
  private centerSquash = 0;

  floater(text: string, x: number, y: number, color = '#fff6c2', icon = ''): void {
    this.floaters.push({ text: noEmoji(text), x, y, age: 0, color, icon });
    if (this.floaters.length > 20) this.floaters.shift();
  }

  // ---------------------------------------------------------------- squirrels + mail

  private squirrelState(s: Squirrel): { x: number; y: number; hop: number; pose: SquirrelPose; rtl: boolean; look: boolean } {
    const L = this.L;
    const age = s.age;
    const span = L.w + 60;
    const hopDist = 0.095 * span;
    const hopDur = 0.42;
    const cycle = 0.97;
    const dartAt = 4.3;
    let d: number;
    let hop = 0;
    let pose: SquirrelPose = 'sit';
    let look = false;
    if (age < dartAt) {
      const n = Math.floor(age / cycle);
      const f = age - n * cycle;
      if (f < hopDur) {
        const u = f / hopDur;
        d = n * hopDist + hopDist * u;
        hop = Math.sin(u * Math.PI) * 14;
        pose = u < 0.5 ? 'stretch' : u < 0.88 ? 'stretch' : 'crouch';
      } else {
        d = (n + 1) * hopDist;
        pose = 'sit';
        look = f > hopDur + 0.32 && f < hopDur + 0.5;
      }
    } else {
      const n = Math.floor(dartAt / cycle);
      const d0 = (n + 1) * hopDist;
      const v = span * 0.42;
      d = d0 + (age - dartAt) * v;
      const ph = (age * 11) % 1;
      hop = Math.abs(Math.sin(ph * Math.PI)) * 5;
      pose = ph < 0.7 ? 'stretch' : 'crouch';
    }
    const rtl = s.id % 2 === 0;
    const x = rtl ? L.w + 30 - d : -30 + d;
    const lo = L.kennelBase + 36 * L.bs;
    const hi = L.lawnBottom - 6;
    return { x, y: lo + hash01(s.id + 3) * Math.max(10, hi - lo), hop, pose, rtl, look };
  }

  private mailPos(): { x: number; y: number } {
    return { x: this.L.mailX, y: this.L.mailY - 24 * this.L.bs * 1.2 };
  }

  private onPointer(e: PointerEvent): void {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const s = this.c.state;
    let best: Squirrel | null = null;
    let bestD = 44 * 44;
    for (const sq of s.squirrels) {
      const p = this.squirrelState(sq);
      const d = (p.x - px) ** 2 + (p.y - 14 - p.hop - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = sq;
      }
    }
    if (best) {
      const p = this.squirrelState(best);
      const rew = catchSquirrel(s, best.id);
      if (rew) {
        this.startCatch(p.x, p.y, p.rtl);
        this.celebrate(rew, p.x, p.y - 20, 'Caught! ');
      }
      return;
    }
    if (this.portalOn()) {
      const pp = this.portalPos();
      const cx = pp.x;
      const cy = pp.y - 58 * pp.s;
      const rx = 50 * pp.s + 8;
      const ry = 70 * pp.s + 8;
      if (((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1) {
        this.onPortalTap();
        return;
      }
    }
    if (s.mailCount > 0) {
      const m = this.mailPos();
      if ((m.x - px) ** 2 + (m.y - py) ** 2 < 46 * 46) {
        const rewards = this.c.collectMail();
        if (rewards.length) {
          this.floater(`×${rewards.length}`, m.x - 6, m.y, '#fff6c2', 'mail');
          this.particles.confetti(m.x, m.y, 14);
          this.particles.sparkle(m.x, m.y, 5, 10);
        }
      }
    }
  }

  private startCatch(x: number, y: number, rtl: boolean): void {
    for (const q of this.caught) {
      if (!q.on) {
        q.on = true;
        q.x = x;
        q.y = y;
        q.age = 0;
        q.flip = rtl ? 1 : -1;
        break;
      }
    }
    this.particles.confetti(x, y - 18, 18);
    this.particles.sparkle(x, y - 18, 6, 14, 5);
    this.particles.ring(x, y, 22);
  }

  private celebrate(rew: RewardResult, x: number, y: number, prefix: string): void {
    const txt = noEmoji(formatReward(rew));
    const icon = rew.kind === 'goldenBones' ? 'bone' : rew.kind === 'treat' ? rew.treatId : '';
    this.floater(txt, Math.min(this.w - 40, Math.max(40, x)), y, rew.kind === 'goldenBones' ? '#ffe27a' : '#d6ffc9', icon);
    toast(prefix + txt, 'good');
  }

  // ---------------------------------------------------------------- pools

  private addFind(x: number, y: number): void {
    const idx = Math.max(0, Math.min(FINDS.length - 1, this.c.state.findIndex | 0));
    for (const f of this.finds) {
      if (!f.on) {
        f.on = true;
        f.x = x;
        f.y = y;
        f.age = 0;
        f.idx = idx;
        this.particles.sparkle(x, y - 6, 4, 9, 4);
        return;
      }
    }
  }

  private addMound(x: number, y: number): void {
    let m: Mound | null = null;
    for (const q of this.mounds) {
      if (!q.on) {
        m = q;
        break;
      }
    }
    if (!m) {
      m = this.mounds[0];
      for (const q of this.mounds) if (q.age > m.age) m = q;
    }
    m.on = true;
    m.x = x;
    m.y = y;
    m.age = 0;
  }

  // ---------------------------------------------------------------- state diffing

  private targetCount(pups: number): number {
    if (pups < 1) return 0;
    if (pups <= 36) return Math.floor(pups);
    return Math.min(MAX_VISIBLE, Math.round(36 + Math.sqrt(pups - 36) * 2.6));
  }

  private kennelDoorPos(i: number): { x: number; y: number } {
    const L = this.L;
    const tier = this.slots[i].tier ?? 0;
    const fx = KENNEL_FX[Math.min(KENNEL_COUNT - 1, tier)];
    return { x: L.kennelX[i] + fx.door.x * L.ks, y: L.kennelBase + 5 * L.ks };
  }

  private syncState(dt: number): void {
    const s = this.c.state;
    const L = this.L;
    // kennels: detect tier changes
    this.doors.length = 0;
    for (let i = 0; i < KENNEL_SLOTS; i++) {
      const now = s.kennels[i] ?? null;
      const sl = this.slots[i];
      if (now !== sl.tier) {
        const first = sl.tier === null && sl.anim >= 1 && this.frames < 3;
        const reset = now !== null && sl.tier !== null && now < sl.tier; // era reset: snap, no pop
        if (this.frames >= 3 && !this.snapView && now !== null && !first && !reset) {
          sl.old = sl.tier;
          sl.anim = 0;
          sl.fxDone = false;
        } else {
          sl.old = null;
          sl.anim = 1;
          sl.fxDone = true;
        }
        sl.tier = now;
      }
      if (sl.anim < 1) {
        sl.anim += dt / (sl.old === null ? 0.7 : 0.85);
        const popAt = sl.old === null ? 0 : 0.17;
        if (!sl.fxDone && sl.anim >= popAt) {
          sl.fxDone = true;
          const x = L.kennelX[i];
          const y = L.kennelBase;
          this.particles.ring(x, y + 2, 46 * L.bs);
          this.particles.dust(x, y, 12, 70 * L.bs);
          this.particles.confetti(x, y - 34 * L.bs, 26);
          this.particles.sparkle(x, y - 34 * L.bs, 9, 34 * L.bs, 6);
        }
      }
      if (now !== null) this.doors.push(this.kennelDoorPos(i));
    }

    // vehicles
    for (let i = 0; i < s.vehicles.length; i++) {
      const now = s.vehicles[i] ?? null;
      let v = this.vehs[i];
      if (!v) {
        v = this.vehs[i] = { tier: null, out: false, wait: 0, x: -200, wheel: 0, pop: 1, bob: i * 1.7, cars: 0 };
        this.lastVehTier[i] = null;
      }
      v.cars = now === TOP_VEHICLE_TIER ? Math.min(MAX_DRAWN_CARS, Math.max(0, (s.vehicleCars[i] ?? 1) - 1)) : 0;
      if (now !== v.tier) {
        const wasNull = v.tier === null;
        const reset = now !== null && v.tier !== null && now < v.tier; // era reset: no pop
        v.tier = now;
        if (now !== null) {
          if (wasNull) this.placeVehicle(i, this.frames < 3 || this.snapView);
          if (this.frames >= 3 && !this.snapView && v.out && !reset) {
            v.pop = 0;
            const sp = VEHICLE_SPECS[Math.min(now, VEHICLE_SPECS.length - 1)];
            const y = this.laneY();
            this.particles.dust(v.x, y - 4, 10, sp.w * 0.8);
            this.particles.ring(v.x, y, sp.w * 0.5);
            this.particles.sparkle(v.x, y - 18, 5, sp.w * 0.4, 4);
          }
        }
      }
    }
  }

  private laneY(): number {
    return this.L.lanes[1];
  }

  private vehScale(): number {
    return 0.84 * this.L.bs;
  }

  /** on-screen width of a vehicle */
  private vehWidth(v: Veh): number {
    const lead = VEHICLE_SPECS[Math.min(VEHICLE_SPECS.length - 1, v.tier ?? 0)].w * this.vehScale();
    return lead + v.cars * (lead * CAR_SCALE + 8 * this.L.bs);
  }

  /** on-screen width of just the leading vehicle */
  private leadWidth(v: Veh): number {
    return VEHICLE_SPECS[Math.min(VEHICLE_SPECS.length - 1, v.tier ?? 0)].w * this.vehScale();
  }

  /** distance from the train's centre to the leader's centre (0 without sled cars) */
  private leadOffset(v: Veh): number {
    return (this.vehWidth(v) - this.leadWidth(v)) / 2;
  }

  private vehGap(): number {
    return 30 * this.L.bs;
  }

  /** x of the depot door, where vehicles pull out */
  private depotX(): number {
    return 34 * this.L.bs;
  }

  private placeVehicle(i: number, initial: boolean): void {
    const v = this.vehs[i];
    v.wait = 0;
    v.out = false;
    if (!initial) return; // a new vehicle simply pulls out of the depot when the road is clear
    // first load: fill the road evenly from the depot onwards, the rest wait inside
    let front = this.depotX() + this.vehWidth(v) / 2 + 10;
    for (let k = 0; k < i; k++) {
      const o = this.vehs[k];
      if (o && o.out) front = Math.max(front, o.x + this.vehWidth(o) / 2 + this.vehGap() + this.vehWidth(v) / 2);
    }
    // vehicles are placed in slot order; the earliest-placed ones are furthest right
    if (front < this.L.w - this.vehWidth(v) * 0.3) {
      v.out = true;
      v.x = front;
    }
  }

  // ---------------------------------------------------------------- update

  // ---------------------------------------------------------------- Paw Portal

  /** The gate exists on the home lawn (hidden while the Dog Show park is on screen). */
  private portalOn(): boolean {
    return !!this.c.home.portal && !this.c.viewingShow;
  }

  /** ground anchor of the gate and its size multiplier */
  private portalPos(): { x: number; y: number; s: number } {
    const L = this.L;
    const span = L.lawnBottom - L.kennelBase;
    return { x: L.w * 0.6, y: L.kennelBase + span * 0.74, s: clamp(L.bs * 0.74, 0.58, 0.9) };
  }

  /** watch the slots: dogs leap in when a crew launches and tumble out when one returns */
  private syncPortal(dt: number): void {
    const p = this.c.home.portal;
    const pos = this.portalPos();
    if (p && p.built && !this.c.viewingShow) {
      const now = Date.now();
      let launched = 0;
      let returned = 0;
      let best = 0;
      let ready = 0;
      p.slots.forEach((e, i) => {
        const sig = e ? e.launchedAt : 0;
        const isReady = !!e && now >= e.returnsAt;
        if (isReady) ready++;
        if (this.portalSeen) {
          if (sig !== (this.portalSig[i] ?? 0) && e && now - e.launchedAt < 8000) launched++;
          else if (isReady && !this.portalReady[i] && sig === (this.portalSig[i] ?? 0)) {
            returned++;
            best = Math.max(best, bestRarity(e.loot));
          }
        }
        this.portalSig[i] = sig;
        this.portalReady[i] = isReady;
      });
      this.portalSeen = true;
      this.portalReadyCount = ready;
      if (launched > 0) this.portalFx.launch(pos.x, pos.y, pos.s, this.L, launched);
      if (returned > 0) this.portalFx.land(pos.x, pos.y, pos.s, this.L, returned, best);
    } else {
      this.portalReadyCount = 0;
      this.portalSeen = false;
    }
    if (this.portalOn()) this.portalFx.update(dt, pos.s, this.particles);
  }
  private portalReadyCount = 0;
  /** the screen switched between the home park and the show park: snap, do not animate the differences */
  private snapView = false;

  frame(dt: number): void {
    if (document.hidden) {
      this.lastHidden = true;
      return;
    }
    const t0 = performance.now();
    dt = Math.min(dt, 0.05);
    if (this.lastHidden) {
      this.lastHidden = false;
      dt = Math.min(dt, 0.016);
    }
    this.t += dt;
    this.frames++;
    this.cache.nextFrame();
    if (this.dogSheet) {
      this.dogSheet.draw(this.ctx, this.dpr, this.w, this.hgt);
      return;
    }
    this.update(dt);
    this.draw();
    this.recordStats(performance.now() - t0);
  }

  private recordStats(ms: number): void {
    this.msWin.push(ms);
    if (this.msWin.length > 240) this.msWin.shift();
    if (this.frames % 20 !== 0) return;
    let sum = 0;
    let max = 0;
    for (const v of this.msWin) {
      sum += v;
      if (v > max) max = v;
    }
    const win = window as unknown as { pawpark?: Record<string, unknown> };
    const pp = win.pawpark;
    if (pp) {
      const rs = (pp.renderStats ?? (pp.renderStats = { avgMs: 0, maxMs: 0, sprites: 0 })) as { avgMs: number; maxMs: number; sprites: number };
      rs.avgMs = sum / this.msWin.length;
      rs.maxMs = max;
      rs.sprites = this.cache.size;
      // debug handle for QA scripts (not used by the game)
      if (!pp.scene) pp.scene = this;
    }
  }

  private update(dt: number): void {
    const s = this.c.state;
    const L = this.L;

    // slow-changing derived values
    this.statT -= dt;
    if (this.statT <= 0) {
      this.statT = 0.25;
      try {
        this.maxZoomies = Math.max(1, computeStats(s).maxZoomies);
      } catch {
        this.maxZoomies = 20;
      }
      const d = new Date();
      const hr = this.hourOverride ?? (getDayNight() ? d.getHours() + d.getMinutes() / 60 : 12);
      this.tint = tintAt(hr);
      if (this.tint.night !== this.skyNight) this.buildSky();
    }
    this.zoom = clamp(s.zoomies / this.maxZoomies, 0, 1);

    // pre-warm sprites: ~2 ms budget per frame
    const tw = performance.now();
    while (this.warm.length && performance.now() - tw < 1.6) this.warm.pop()!();

    this.syncState(dt);
    this.snapView = false;
    this.syncPortal(dt);
    for (const sl of this.slots) void sl;

    // adoption detection -> runners from the Adoption Center
    const ta = s.stats.totalAdopted;
    if (this.lastAdopted < 0 || ta < this.lastAdopted) this.lastAdopted = ta;
    if (ta > this.lastAdopted) {
      const delta = ta - this.lastAdopted;
      this.lastAdopted = ta;
      if (delta <= 400) this.pending = Math.min(60, this.pending + delta);
    }
    this.spawnAcc += dt * (this.pending > 12 ? 30 : 16);
    while (this.pending > 0 && this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      this.pending--;
      if (!this.flock.spawnRunner(this.env)) {
        this.pending = Math.max(0, this.pending - 1);
        break;
      }
    }
    if (this.pending === 0) this.spawnAcc = Math.min(this.spawnAcc, 1);

    // population
    const target = this.targetCount(s.pups);
    this.env.target = target;
    this.env.zoom = this.zoom;
    const have = this.flock.wanderers + this.flock.runners;
    if (have < target) {
      const first = this.lastPups < 0 || target - have > 6;
      const n = Math.min(first ? 10 : 2, target - have);
      for (let i = 0; i < n; i++) this.flock.spawnWanderer(this.env, first);
    }
    this.lastPups = s.pups;
    this.flock.trim(this.env);
    this.flock.update(dt, this.env);

    // adoption centre door
    this.doorT = Math.max(0, this.doorT - dt);
    this.doorOpen += ((this.doorT > 0 ? 1 : 0) - this.doorOpen) * Math.min(1, dt * 12);
    this.centerSquash = Math.max(0, this.centerSquash - dt * 5);

    // mail flag
    const mailUp = s.mailCount > 0 ? 1 : 0;
    this.mailFlag += (mailUp - this.mailFlag) * Math.min(1, dt * 9);

    // squirrels: sparkle trail
    for (const sq of s.squirrels) {
      if (!this.seenSquirrels.has(sq.id)) this.seenSquirrels.add(sq.id);
    }
    if (s.squirrels.length) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.28;
        for (const sq of s.squirrels) {
          const p = this.squirrelState(sq);
          this.particles.sparkle(p.x, p.y - 14, 1, 14, 3.4);
        }
      }
    }

    // ambient particles: chimney smoke, tier sparkles, fireflies, mail glints
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.36;
      for (let i = 0; i < KENNEL_SLOTS; i++) {
        const tier = this.slots[i].tier;
        if (tier === null) continue;
        const fx = KENNEL_FX[tier];
        if (fx.smoke) this.particles.smoke(L.kennelX[i] + fx.smoke.x * L.ks, L.kennelBase + fx.smoke.y * L.ks);
        if (fx.sparkles && Math.random() < 0.5) this.particles.sparkle(L.kennelX[i] + (Math.random() - 0.5) * 70 * L.ks, L.kennelBase - 60 * L.ks - Math.random() * 20, 1, 4, 3);
      }
      for (const v of this.vehs) {
        if (v && v.tier === 11) this.particles.smoke(v.x - 44, this.laneY() - 14);
        if (v && v.tier === 10 && Math.random() < 0.5) this.particles.sparkle(v.x, this.laneY() - 8, 1, 14, 3);
      }
      if (s.mailCount > 0) this.particles.sparkle(L.mailX, L.mailY - 30 * L.bs, 1, 12, 3.4);
    }
    if (this.tint.night) {
      this.fireflyT -= dt;
      if (this.fireflyT <= 0) {
        this.fireflyT = 0.35;
        this.particles.firefly(Math.random() * L.w, L.kennelBase + 20 + Math.random() * (L.lawnBottom - L.kennelBase - 20));
      }
    }

    // vehicles: leave the depot, drive left -> right in one lane, keep a minimum gap, then go back to the depot
    {
      const road: Veh[] = [];
      let rearmost = Infinity;
      for (const v of this.vehs) {
        if (!v || v.tier === null) continue;
        if (v.out) road.push(v);
      }
      road.sort((a, b) => b.x - a.x);
      const speed = 52 * L.bs;
      const gap = this.vehGap();
      let lead: Veh | null = null;
      for (const v of road) {
        const sp = VEHICLE_SPECS[Math.min(VEHICLE_SPECS.length - 1, v.tier as number)];
        let dx = speed * dt;
        if (lead) dx = Math.min(dx, Math.max(0, lead.x - this.vehWidth(lead) / 2 - gap - this.vehWidth(v) / 2 - v.x));
        v.x += dx;
        v.wheel += dx / this.vehScale();
        v.bob += dt * (6 + speed * 0.05);
        v.pop = Math.min(1, v.pop + dt * 2.2);
        rearmost = Math.min(rearmost, v.x - this.vehWidth(v) / 2);
        lead = v;
        void sp;
        if (v.x - this.vehWidth(v) / 2 > L.w + 20) {
          v.out = false;
          v.wait = 1.5 + (v.bob % 1);
        }
      }
      // pull the next waiting vehicle out of the depot once the road in front of the door is clear
      const dx0 = this.depotX();
      let next: Veh | null = null;
      for (const v of this.vehs) {
        if (!v || v.tier === null || v.out) continue;
        v.wait = Math.max(0, v.wait - dt);
        if (v.wait <= 0 && (!next || this.vehs.indexOf(v) < this.vehs.indexOf(next))) next = v;
      }
      if (next && rearmost - gap >= dx0 + this.leadWidth(next) / 2 + 2) {
        next.out = true;
        next.x = dx0 + this.leadOffset(next);
        next.pop = 1;
      }
    }

    // pools
    this.particles.update(dt);
    for (const f of this.floaters) {
      f.age += dt;
      f.y -= 30 * dt * (1 - Math.min(1, f.age / 1.8) * 0.5);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) if (this.floaters[i].age >= 1.8) this.floaters.splice(i, 1);
    for (const f of this.finds) {
      if (!f.on) continue;
      f.age += dt;
      if (f.age > 1.35) f.on = false;
    }
    for (const m of this.mounds) {
      if (!m.on) continue;
      m.age += dt;
      if (m.age > 6) m.on = false;
    }
    for (const q of this.caught) {
      if (!q.on) continue;
      q.age += dt;
      if (q.age > 0.8) q.on = false;
    }
  }

  // ---------------------------------------------------------------- sprites

  private kennelSprite(tier: number): Sprite | null {
    const lit = this.tint.lit ? 1 : 0;
    return this.cache.getOrNull(`kennel:${tier}:${lit}`, BLD_W, BLD_H, (ctx) => drawKennelBody(ctx, tier, lit === 1), 3) ?? this.cache.peek(`kennel:${tier}:${1 - lit}`) ?? null;
  }
  private kennelShadow(tier: number): Sprite | null {
    return this.cache.getOrNull(`kshadow:${tier}`, BLD_W, BLD_H, (ctx, _w, _h, d) => drawKennelShadow(ctx, tier, d), 3);
  }
  /** rendered Find art (art.ts PNG) as a drawable image; null until it has decoded */
  private artImg(key: string, src: () => string): HTMLImageElement | null {
    let im = this.imgs.get(key);
    if (!im) {
      im = new Image();
      im.src = src();
      this.imgs.set(key, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }
  private imgs = new Map<string, HTMLImageElement>();
  private glow(col: string): Sprite {
    return this.cache.get(`glow:${col}`, 32, 32, (ctx) => drawGlow(ctx, col));
  }

  // ---------------------------------------------------------------- draw

  private draw(): void {
    const ctx = this.ctx;
    const { w, hgt: H, dpr, L } = this;
    const s = this.c.state;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.sky) ctx.drawImage(this.sky as CanvasImageSource, 0, 0);
    // parallax clouds
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const cl of this.clouds) {
      cl.x += cl.speed * 0.016;
      if (cl.x > w + 20) cl.x = -cl.w - 10;
      const sp = this.cache.get(`cloud:${cl.seed}:${Math.round(cl.w)}`, cl.w, cl.hh, (cx, ww, hh) => drawCloud(cx, ww, hh, cl.seed));
      ctx.globalAlpha = this.tint.night ? 0.55 : 0.95;
      ctx.drawImage(sp.c as CanvasImageSource, cl.x, cl.y, sp.w, sp.h);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.ground) ctx.drawImage(this.ground as CanvasImageSource, 0, 0);
    void H;

    // --- ground-level decals + shadows (all before any body, so nothing is shadowed by a neighbour)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawMounds();
    for (let i = 0; i < KENNEL_SLOTS; i++) {
      const sl = this.slots[i];
      const tier = sl.anim < 1 && sl.old !== null && sl.anim < 0.17 ? sl.old : sl.tier;
      if (tier !== null && !(sl.anim < 0.17 && sl.old === null && sl.anim < 0)) {
        const sh = this.kennelShadow(Math.min(KENNEL_COUNT - 1, tier));
        const sc = this.popScale(sl);
        if (sh) blit(ctx, dpr, sh, L.kennelX[i], L.kennelBase, BLD_AX, BLD_AY, L.ks * sc.x, L.ks * sc.y);
      }
    }
    {
      const sh = this.cache.get('shadow:adopt', ADOPT_W, ADOPT_H, (cx, _w, _h, d) => drawAdoptionShadow(cx, d));
      blit(ctx, dpr, sh, L.centerX, L.centerY, ADOPT_AX, ADOPT_AY, L.bs * 1.08);
      const ms = this.cache.get('shadow:mail', MAIL_W, MAIL_H, (cx, _w, _h, d) => drawMailShadow(cx, d));
      blit(ctx, dpr, ms, L.mailX, L.mailY, MAIL_AX, MAIL_AY, L.bs * 1.2);
      const dep = this.cache.get('depot', DEPOT_W, DEPOT_H, (cx, _w, _h, d) => drawDepot(cx, d));
      blit(ctx, dpr, dep, 34 * L.bs, L.roadTop + 8, DEPOT_AX, DEPOT_AY, L.bs * 1.1);
    }
    const sorted = this.flock.sortForDraw();
    for (const a of sorted) drawPupShadow(ctx, dpr, this.cache, L, a);

    // --- y-sorted actors
    const list = this.list;
    list.length = 0;
    let n = 0;
    const add = (y: number, kind: number, i: number, a: PupActor | null): void => {
      let it = this.itemPool[n];
      if (!it) it = this.itemPool[n] = { y: 0, kind: 0, i: 0, a: null };
      it.y = y;
      it.kind = kind;
      it.i = i;
      it.a = a;
      n++;
      list.push(it);
    };
    for (let i = 0; i < KENNEL_SLOTS; i++) add(L.kennelBase, Kind.Kennel, i, null);
    add(L.centerY, Kind.Center, 0, null);
    add(L.mailY, Kind.Mail, 0, null);
    for (let i = 0; i < L.trees.length; i++) add(L.trees[i].y, Kind.Tree, i, null);
    if (this.portalOn()) add(this.portalPos().y, Kind.Portal, 0, null);
    for (let i = 0; i < s.squirrels.length; i++) add(this.squirrelState(s.squirrels[i]).y, Kind.Squirrel, i, null);
    for (const a of sorted) add(a.y, Kind.Pup, 0, a);
    list.sort(byItemY);
    for (let k = 0; k < list.length; k++) {
      const it = list[k];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      switch (it.kind) {
        case Kind.Kennel:
          this.drawKennel(it.i);
          break;
        case Kind.Center:
          this.drawCenter();
          break;
        case Kind.Mail:
          this.drawMail();
          break;
        case Kind.Tree:
          this.drawTreeAt(it.i);
          break;
        case Kind.Squirrel:
          this.drawSquirrelAt(s.squirrels[it.i]);
          break;
        case Kind.Portal: {
          const pp = this.portalPos();
          this.portalFx.draw(ctx, dpr, this.cache, { x: pp.x, y: pp.y, s: pp.s, built: !!this.c.home.portal?.built, ready: this.portalReadyCount, night: this.tint.night });
          break;
        }
        default:
          drawPup(ctx, dpr, this.cache, L, it.a!, 0);
      }
    }

    if (this.portalOn()) this.portalFx.drawJumpers(ctx, dpr, this.cache, L);
    this.drawVehicles();
    this.drawButterflies();
    this.drawCaught();
    this.particles.draw(ctx, dpr);
    this.drawFinds();

    // --- time-of-day tint (single multiply fill), then additive glows for lit windows at night
    const tn = this.tint;
    if (tn.r < 252 || tn.g < 252 || tn.b < 252) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${tn.r | 0},${tn.g | 0},${tn.b | 0})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (tn.lit) this.drawNightGlow();

    this.drawFloaters();
    ctx.globalAlpha = 1;
  }

  private popScale(sl: Slot): { x: number; y: number } {
    if (sl.anim >= 1) return { x: 1, y: 1 };
    return this.scaleTmp(sl);
  }
  private tmp = { x: 1, y: 1 };
  private scaleTmp(sl: Slot): { x: number; y: number } {
    const a = sl.anim;
    let sy = 1;
    if (sl.old !== null) {
      if (a < 0.17) {
        const u = a / 0.17;
        sy = 1 - 0.1 * u * u;
      } else {
        const u = clamp((a - 0.17) / 0.83, 0, 1);
        sy = 0.9 + 0.1 * easeOutBack(u, 5.4) * 1.0 + 0.0;
        sy = u < 0.3 ? 0.9 + ((1.15 - 0.9) * u) / 0.3 : 1.15 - 0.15 * easeOutBack((u - 0.3) / 0.7, 1.4);
      }
    } else {
      const u = clamp(a / 0.7, 0, 1);
      sy = u < 0.35 ? (1.15 * u) / 0.35 : 1.15 - 0.15 * easeOutBack((u - 0.35) / 0.65, 1.4);
    }
    this.tmp.y = Math.max(0.02, sy);
    this.tmp.x = 1 + (1 - sy) * 0.55;
    return this.tmp;
  }

  private drawKennel(i: number): void {
    const { ctx, dpr, L } = this;
    const sl = this.slots[i];
    const x = L.kennelX[i];
    const base = L.kennelBase;
    const tier = sl.anim < 0.17 && sl.old !== null ? sl.old : sl.tier;
    if (tier === null) {
      this.drawEmptySlot(i);
      return;
    }
    const t = Math.min(KENNEL_COUNT - 1, tier);
    const fx = KENNEL_FX[t];
    const sp = this.kennelSprite(t);
    if (!sp) return;
    const sc = this.popScale(sl);
    const bob = fx.floating ? Math.sin(this.t * 1.5 + i * 1.3) * 3 * L.ks : 0;
    blit(ctx, dpr, sp, x, base - bob, BLD_AX, BLD_AY, L.ks * sc.x, L.ks * sc.y);
    // live details
    if (fx.flags) {
      for (const f of fx.flags) this.flag(x + f.x * L.ks, base + f.y * L.ks - bob, i);
    }
    if (fx.blink) {
      for (const b of fx.blink) {
        const on = Math.sin(this.t * 4 + i) > 0.1 ? 1 : 0.25;
        const g = this.glow('#ff4d4d');
        ctx.globalAlpha = on;
        ctx.drawImage(g.c as CanvasImageSource, x + b.x * L.ks - 8, base + b.y * L.ks - bob - 8, 16, 16);
        ctx.globalAlpha = 1;
      }
    }
    if (fx.dish) {
      const dx = x + fx.dish.x * L.ks;
      const dy = base + fx.dish.y * L.ks;
      const sx = Math.cos(this.t * 1.4);
      ctx.fillStyle = '#e6ebf5';
      ctx.strokeStyle = '#6e7280';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(dx, dy - 4, 7 * Math.abs(sx) + 1, 5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private flag(x: number, y: number, seed: number): void {
    const ctx = this.ctx;
    const t = this.t * 5 + seed;
    const col = seed % 2 ? '#4a8fe7' : '#ef5a47';
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(40,20,40,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 5, y - 1.5 + Math.sin(t) * 1.6, x + 10, y + Math.sin(t + 1.4) * 1.8);
    ctx.lineTo(x + 10, y + 6 + Math.sin(t + 1.4) * 1.8);
    ctx.quadraticCurveTo(x + 5, y + 5 + Math.sin(t) * 1.6, x, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawEmptySlot(i: number): void {
    const { ctx, L } = this;
    const x = L.kennelX[i];
    const y = L.kennelBase;
    const s = this.c.state;
    let afford = false;
    try {
      const cost = kennelUpgradeCost(s, i);
      afford = cost !== null && s.cash >= cost;
    } catch {
      afford = false;
    }
    const bs = L.bs;
    ctx.save();
    ctx.setLineDash(DASH);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = afford ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(x - 24 * bs, y);
    ctx.lineTo(x - 24 * bs, y - 20 * bs);
    ctx.lineTo(x, y - 36 * bs);
    ctx.lineTo(x + 24 * bs, y - 20 * bs);
    ctx.lineTo(x + 24 * bs, y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
    const pulse = afford ? 1 + Math.sin(this.t * 4) * 0.12 : 1;
    const cy = y - 15 * bs;
    ctx.globalAlpha = afford ? 1 : 0.65;
    ctx.fillStyle = afford ? '#ffcb3d' : 'rgba(255,255,255,0.85)';
    ctx.strokeStyle = afford ? '#e29a00' : 'rgba(150,150,150,0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, cy, 9.5 * bs * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = afford ? '#7a4a00' : 'rgba(120,120,120,0.9)';
    ctx.lineWidth = 2.4;
    const a = 4.4 * bs * pulse;
    ctx.beginPath();
    ctx.moveTo(x - a, cy);
    ctx.lineTo(x + a, cy);
    ctx.moveTo(x, cy - a);
    ctx.lineTo(x, cy + a);
    ctx.stroke();
    ctx.restore();
  }

  private drawCenter(): void {
    const { ctx, dpr, L } = this;
    const lit = this.tint.lit ? 1 : 0;
    const sp = this.cache.getOrNull(`adopt:${lit}`, ADOPT_W, ADOPT_H, (cx) => drawAdoptionCenter(cx, lit === 1), 3) ?? this.cache.peek(`adopt:${1 - lit}`);
    if (!sp) return;
    const k = L.bs * 1.08;
    const sq = this.centerSquash;
    const sy = 1 - 0.06 * Math.sin(sq * Math.PI);
    blit(ctx, dpr, sp, L.centerX, L.centerY, ADOPT_AX, ADOPT_AY, k * (1 + 0.03 * Math.sin(sq * Math.PI)), k * sy);
    // door leaf swings open while pups stream out
    const leaf = this.cache.get('leaf', 14, 26, (cx) => drawDoorLeaf(cx));
    const open = this.doorOpen;
    const lw = 21 * (1 - open * 0.88);
    ctx.setTransform(dpr * k * (lw / 13), 0, 0, dpr * k * sy, dpr * (L.centerX - 10.5 * k), dpr * (L.centerY - 23.5 * k * sy));
    ctx.drawImage(leaf.c as CanvasImageSource, 0, 0, leaf.w, leaf.h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private drawMail(): void {
    const { ctx, dpr, L } = this;
    const s = this.c.state;
    const k = L.bs * 1.2;
    const bob = s.mailCount > 0 ? Math.sin(this.t * 3.2) * 1.2 : 0;
    const body = this.cache.getOrNull('mailbox', MAIL_W, MAIL_H, (cx) => drawMailbox(cx), 3);
    if (!body) return;
    blit(ctx, dpr, body, L.mailX, L.mailY + bob * 0.3, MAIL_AX, MAIL_AY, k);
    const flag = this.cache.get('mailflag', 20, 26, (cx) => drawMailFlag(cx));
    // flag pivots at the box's right side; rotates up when letters are waiting
    const ang = -this.mailFlag * 1.35;
    const px = L.mailX + 11 * k;
    const py = L.mailY - 30 * k + bob * 0.3;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * px, dpr * py);
    ctx.rotate(ang);
    ctx.drawImage(flag.c as CanvasImageSource, -4, -23, flag.w, flag.h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s.mailCount > 0) {
      const m = this.mailPos();
      // pulsing glow + count badge
      const g = this.glow('#ffe27a');
      const gs = 44 + Math.sin(this.t * 4) * 5;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(g.c as CanvasImageSource, m.x - gs / 2, m.y - gs / 2, gs, gs);
      ctx.globalAlpha = 1;
      const label = String(s.mailCount);
      const badge = this.cache.get(`badge:${label}`, 26, 22, (cx) => {
        cx.fillStyle = '#e0452d';
        cx.strokeStyle = '#ffffff';
        cx.lineWidth = 2;
        cx.beginPath();
        cx.ellipse(13, 11, label.length > 1 ? 11 : 9, 9, 0, 0, Math.PI * 2);
        cx.fill();
        cx.stroke();
        cx.fillStyle = '#fff';
        cx.font = `700 12px ${FONT}`;
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.fillText(label, 13, 11.5);
      });
      const pop = 1 + Math.sin(this.t * 6) * 0.05;
      ctx.drawImage(badge.c as CanvasImageSource, m.x + 8 - 13 * pop, m.y - 22 - 11 * pop, 26 * pop, 22 * pop);
    }
  }

  private drawTreeAt(i: number): void {
    const { ctx, dpr, L } = this;
    const tr = L.trees[i];
    const sp = this.cache.get(`tree:${tr.v}`, TREE_W, TREE_H, (cx) => drawTree(cx, tr.v));
    const sway = Math.sin(this.t * 0.9 + i * 2.1) * 0.0175 + Math.sin(this.t * 2.3 + i) * 0.004;
    ctx.setTransform(dpr * tr.s, 0, 0, dpr * tr.s, dpr * tr.x, dpr * tr.y);
    ctx.rotate(sway);
    ctx.drawImage(sp.c as CanvasImageSource, -TREE_AX, -TREE_AY, sp.w, sp.h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private squirrelSprite(pose: SquirrelPose): Sprite | null {
    return this.cache.getOrNull(`sq:${pose}`, SQ_W, SQ_H, (cx) => drawSquirrel(cx, pose), 4);
  }

  private drawSquirrelAt(sq: Squirrel): void {
    const { ctx, dpr } = this;
    const p = this.squirrelState(sq);
    const flip = (p.rtl ? -1 : 1) * (p.look ? -1 : 1);
    // contact shadow
    const sh = this.cache.get('shadow:sq', 40, 16, (cx) => contactShadow(cx, 20, 8, 19, 7, 0.24));
    const sa = 1 - Math.min(0.5, p.hop / 24);
    ctx.globalAlpha = sa;
    ctx.drawImage(sh.c as CanvasImageSource, p.x - 17, p.y - 5, 34 * (0.9 + 0.1 * sa), 13);
    ctx.globalAlpha = 1;
    const sprite = this.squirrelSprite(p.pose) ?? this.cache.peek('sq:sit');
    const s = depthScale(this.L, p.y) * 1.05;
    if (sprite) blit(ctx, dpr, sprite, p.x, p.y - p.hop, SQ_AX, SQ_AY, s, s, flip);
    // gentle attention ring so it reads as tappable
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = `rgba(255,246,190,${0.25 + pulse * 0.3})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 2, 20 + pulse * 3, 7 + pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawCaught(): void {
    const { ctx, dpr } = this;
    for (const q of this.caught) {
      if (!q.on) continue;
      const u = q.age / 0.8;
      const sprite = this.squirrelSprite('stretch');
      if (!sprite) continue;
      const e = 1 - (1 - u) * (1 - u);
      const sc = 1.15 * (1 - u * 0.85);
      ctx.globalAlpha = Math.min(1, (1 - u) * 2);
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * q.x, dpr * (q.y - 14 - e * 34));
      ctx.rotate(u * Math.PI * 4 * q.flip);
      ctx.drawImage(sprite.c as CanvasImageSource, -SQ_AX + 0, -SQ_AY + 24, sprite.w, sprite.h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  private drawMounds(): void {
    const { ctx } = this;
    const sp = this.cache.get('mound', 30, 16, (cx) => {
      const g = cx.createRadialGradient(13, 5, 1, 15, 9, 14);
      g.addColorStop(0, '#d9a96e');
      g.addColorStop(0.6, '#b8844c');
      g.addColorStop(1, '#8a5e32');
      cx.beginPath();
      cx.ellipse(15, 10, 13, 5.2, 0, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(60,35,15,0.55)';
      cx.fill();
      cx.beginPath();
      cx.moveTo(3, 10);
      cx.quadraticCurveTo(7, 0.5, 15, 1.5);
      cx.quadraticCurveTo(24, 1, 27, 10);
      cx.quadraticCurveTo(15, 14, 3, 10);
      cx.fillStyle = g;
      cx.fill();
      cx.strokeStyle = '#7a4f2a';
      cx.lineWidth = 1.1;
      cx.stroke();
    });
    for (const m of this.mounds) {
      if (!m.on) continue;
      const appear = Math.min(1, m.age / 0.18);
      const fade = m.age > 4.5 ? 1 - (m.age - 4.5) / 1.5 : 1;
      ctx.globalAlpha = Math.max(0, fade);
      const k = 0.5 + 0.5 * easeOutBack(appear, 2.2);
      ctx.drawImage(sp.c as CanvasImageSource, m.x - 15 * k, m.y - 8 * k, 30 * k, 16 * k);
    }
    ctx.globalAlpha = 1;
  }

  private drawFinds(): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const f of this.finds) {
      if (!f.on) continue;
      const u = f.age / 1.35;
      const rise = 1 - Math.pow(1 - Math.min(1, f.age / 0.4), 3);
      const y = f.y - 6 - rise * 22 - Math.max(0, f.age - 0.4) * 10;
      const pop = f.age < 0.28 ? 0.3 + 0.95 * easeOutBack(f.age / 0.28, 2.6) : 1.1 - Math.min(0.1, (f.age - 0.28) * 0.5);
      const alpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      const g = this.glow('#ffe27a');
      ctx.globalAlpha = alpha * 0.8;
      const gs = 38 * pop;
      ctx.drawImage(g.c as CanvasImageSource, f.x - gs / 2, y - gs / 2, gs, gs);
      ctx.globalAlpha = alpha;
      const im = this.artImg(`find:${f.idx}`, () => findArt(f.idx, 40));
      const sz = 27 * pop;
      if (im) ctx.drawImage(im, f.x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  private drawVehicles(): void {
    const { ctx, L } = this;
    const order: Veh[] = this.vehOrder;
    order.length = 0;
    for (const v of this.vehs) if (v && v.tier !== null && v.out) order.push(v);
    order.sort((a, b) => a.x - b.x);
    for (const v of order) {
      const tier = Math.min(VEHICLE_SPECS.length - 1, v.tier as number);
      const sp = VEHICLE_SPECS[tier];
      const lead = this.leadWidth(v);
      const lx = v.x + this.leadOffset(v);
      // pull-out: scale/fade up from the garage door onto the road
      const u = clamp((lx - this.depotX()) / (60 * L.bs), 0, 1);
      const eu = u * u * (3 - 2 * u);
      const sc = this.vehScale() * (0.7 + 0.3 * eu);
      const ground = this.laneY() - (1 - eu) * 14 * L.bs;
      const pop = v.pop;
      const ps = pop < 1 ? easeOutBack(pop, 2.4) : 1;
      const slide = (1 - pop) * -34;
      const fade = eu;
      if (fade <= 0.01) continue;
      ctx.globalAlpha = fade * Math.min(1, pop * 3 + 0.2);
      // sled cars first (behind the leader), each a little smaller, hitched with a spark of light
      const carW = lead * CAR_SCALE;
      const gap = 8 * L.bs;
      for (let k = v.cars; k >= 1; k--) {
        const cx = lx + slide - lead / 2 - gap * k - carW * (k - 0.5) - (k - 1) * 0;
        this.paintVehicle(v, tier, cx, ground, sc * CAR_SCALE, ps, k * 0.9);
        const hx = cx + carW / 2;
        ctx.fillStyle = 'rgba(160,240,230,0.85)';
        ctx.fillRect(hx, ground - 10 * L.bs, gap + 1, 2.2);
      }
      this.paintVehicle(v, tier, lx + slide, ground, sc, ps, 0);
      void sp;
    }
    ctx.globalAlpha = 1;
  }

  /** one vehicle body (leader or sled car): shadow, optional swirl, body, wheels */
  private paintVehicle(v: Veh, tier: number, x: number, ground: number, sc: number, ps: number, phase: number): void {
    const { ctx, dpr } = this;
    const sp = VEHICLE_SPECS[tier];
    const bobT = v.bob + phase;
    const bob = (Math.sin(bobT) * 0.5 + 0.5) * sp.bob + (sp.hover ? Math.sin(bobT * 0.7) * 1.2 : 0);
    const hov = sp.hover + (sp.hover ? Math.sin(bobT * 0.6) * 1.6 : 0);
    const body = this.cache.getOrNull(`veh:${tier}`, VEH_W, VEH_H, (cx) => drawVehicle(cx, tier), 3.5);
    if (!body) return;
    // contact shadow
    const sh = this.cache.get('shadow:veh', 64, 24, (cx) => contactShadow(cx, 32, 12, 31, 11, 0.26));
    const sw = sp.sw * 2 * sc * (1 - hov * 0.012);
    ctx.drawImage(sh.c as CanvasImageSource, x - sw / 2 + 4, ground - sw * 0.17 + 2, sw, sw * 0.3);
    const y = ground - hov - bob;
    if (sp.swirl) {
      const sw2 = this.cache.get('swirl', 40, 40, (cx) => drawSwirl(cx));
      ctx.setTransform(dpr * sc * 1.5, 0, 0, dpr * sc * 1.5, dpr * x, dpr * (y - 26 * sc));
      ctx.rotate(this.t * 3 + phase);
      ctx.drawImage(sw2.c as CanvasImageSource, -20, -20, 40, 40);
    }
    blit(ctx, dpr, body, x, y, VEH_AX, VEH_AY, sc * ps, sc * ps);
    for (const wh of sp.wheels) {
      const bike = tier === 0;
      const ws = this.cache.get(`wheel:${wh.r}:${bike ? 1 : 0}`, wh.r * 2 + 4, wh.r * 2 + 4, (cx) => drawWheel(cx, wh.r, bike));
      const wx = x + wh.x * sc * ps;
      const wy = y - wh.r * sc * ps;
      ctx.setTransform(dpr * sc * ps, 0, 0, dpr * sc * ps, dpr * wx, dpr * wy);
      ctx.rotate(v.wheel / wh.r);
      ctx.drawImage(ws.c as CanvasImageSource, -wh.r - 2, -wh.r - 2, ws.w, ws.h);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  private vehOrder: Veh[] = [];

  private drawButterflies(): void {
    if (this.tint.night) return;
    const { ctx, L } = this;
    const cols = ['#ffd24d', '#ff8fc0', '#7fc4ff'];
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (let i = 0; i < 3; i++) {
      const t = this.t * (0.22 + i * 0.05) + i * 2.3;
      const cx = L.w * (0.3 + i * 0.22);
      const cy = L.kennelBase + (L.lawnBottom - L.kennelBase) * (0.3 + 0.22 * i);
      const x = cx + Math.sin(t * 1.3) * L.w * 0.2 + Math.sin(t * 3.1) * 6;
      const y = cy + Math.sin(t * 1.9 + 1) * 28 + Math.sin(t * 4.3) * 4 - 18;
      const sp = this.cache.get(`bf:${i}`, 16, 12, (cx2) => drawButterfly(cx2, cols[i]));
      const flap = 0.3 + 0.7 * Math.abs(Math.sin(this.t * 13 + i * 2));
      ctx.drawImage(sp.c as CanvasImageSource, x - 8 * flap * 1.2, y - 6, 16 * flap * 1.2, 12);
    }
  }

  private drawNightGlow(): void {
    const { ctx, dpr, L } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const g = this.glow('#ffb347');
    ctx.globalAlpha = this.tint.night ? 0.55 : 0.35;
    for (let i = 0; i < KENNEL_SLOTS; i++) {
      const tier = this.slots[i].tier;
      if (tier === null) continue;
      const fx = KENNEL_FX[Math.min(KENNEL_COUNT - 1, tier)];
      const s = (50 + fx.hw * 0.6) * L.ks;
      ctx.drawImage(g.c as CanvasImageSource, L.kennelX[i] + fx.door.x * L.ks - s / 2, L.kennelBase + (fx.door.y - 10) * L.ks - s / 2, s, s);
    }
    const s2 = 56 * L.bs;
    ctx.drawImage(g.c as CanvasImageSource, L.centerX - s2 / 2, L.centerY - 18 * L.bs - s2 / 2, s2, s2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFloaters(): void {
    if (!this.floaters.length) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of this.floaters) {
      const pop = f.age < 0.18 ? 0.7 + 0.3 * easeOutBack(f.age / 0.18, 1.2) : 1.0;
      ctx.globalAlpha = Math.max(0, Math.min(1, (1.8 - f.age) * 1.5));
      const size = Math.round(20 * pop);
      ctx.font = `600 ${size}px ${FONT}`;
      const tw = ctx.measureText(f.text).width;
      const isz = f.icon ? size * 1.15 : 0;
      const gap = f.icon && f.text ? 3 : 0;
      const x0 = f.x - (tw + isz + gap) / 2;
      if (f.icon) this.drawFloaterIcon(f.icon, x0 + isz / 2, f.y, isz);
      ctx.font = `600 ${size}px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(24,36,54,.72)';
      ctx.strokeText(f.text, x0 + isz + gap, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x0 + isz + gap, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /** small drawn icons for floaters (no emoji): a gold bone, a letter, or a treat's art */
  private drawFloaterIcon(icon: string, cx: number, cy: number, sz: number): void {
    const ctx = this.ctx;
    if (icon === 'bone') {
      const r = sz * 0.2;
      ctx.fillStyle = '#ffd34d';
      ctx.strokeStyle = 'rgba(24,36,54,.72)';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.6);
      const w = sz * 0.5;
      ctx.beginPath();
      ctx.rect(-w, -r * 0.62, w * 2, r * 1.24);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        ctx.moveTo(sx * w + r, sy * r * 0.7);
        ctx.arc(sx * w, sy * r * 0.7, r, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    } else if (icon === 'mail') {
      const w = sz * 0.9;
      const h = sz * 0.62;
      ctx.fillStyle = '#fff6e0';
      ctx.strokeStyle = 'rgba(24,36,54,.72)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.rect(cx - w / 2, cy - h / 2, w, h);
      ctx.stroke();
      ctx.fill();
      ctx.strokeStyle = '#d9483b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, cy - h / 2);
      ctx.lineTo(cx, cy + h * 0.12);
      ctx.lineTo(cx + w / 2, cy - h / 2);
      ctx.stroke();
    } else {
      const im = this.artImg(`treat:${icon}`, () => treatArt(icon, 32));
      if (im) ctx.drawImage(im, cx - sz / 2, cy - sz / 2, sz, sz);
    }
  }
}
