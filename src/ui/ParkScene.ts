import {
  FINDS,
  KENNELS,
  KENNEL_SLOTS,
  VEHICLES,
  SQUIRREL_LIFETIME_SEC,
  catchSquirrel,
  computeStats,
} from '../core';
import type { RewardResult, Squirrel } from '../core';
import type { GameController } from './GameController';
import { formatReward } from './labels';
import { toast } from './Toasts';
import { h } from './dom';

const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
const DOGS = ['\u{1F415}', '\u{1F436}', '\u{1F9AE}', '\u{1F429}', '\u{1F415}‍\u{1F9BA}'];

interface Pup {
  x: number;
  y: number;
  tx: number;
  ty: number;
  emoji: string;
  speed: number;
  wait: number;
  bounce: number;
  face: number;
}
interface Veh {
  x: number;
  lane: number;
  speed: number;
}
interface Floater {
  text: string;
  x: number;
  y: number;
  age: number;
  color: string;
}
interface Puff {
  x: number;
  y: number;
  age: number;
  icon: string;
}

const KENNEL_Y = 38;
const GRASS_TOP = 78;
const ROAD_H = 54;

function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export class ParkScene {
  readonly el: HTMLElement;
  private canvas = h('canvas', { cls: 'park-canvas', attrs: { 'aria-label': 'Park scene' } });
  private ctx: CanvasRenderingContext2D;
  private w = 300;
  private hgt = 260;
  private dpr = 1;
  private dark = false;
  private t = 0;
  private pups: Pup[] = [];
  private vehs: (Veh | null)[] = [];
  private floaters: Floater[] = [];
  private puffs: Puff[] = [];
  private digTimer = 0;

  constructor(private c: GameController) {
    this.el = h('section', { cls: 'scene' }, this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(this.el);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    this.dark = mq.matches;
    mq.addEventListener?.('change', (e) => (this.dark = e.matches));
    this.canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resize();
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    this.w = Math.max(100, r.width);
    this.hgt = Math.max(120, r.height);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.hgt * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.hgt + 'px';
    for (const p of this.pups) {
      p.x = Math.min(p.x, this.w - 10);
      p.y = Math.min(p.y, this.lawnBottom());
      p.ty = Math.min(p.ty, this.lawnBottom());
    }
  }

  private roadY(): number {
    return this.hgt - ROAD_H;
  }

  /** Called by the whistle: little bounce on a few pups. */
  bounce(): void {
    for (let i = 0; i < 6 && this.pups.length; i++) {
      this.pups[Math.floor(Math.random() * this.pups.length)].bounce = 1;
    }
  }

  floater(text: string, x: number, y: number, color = '#fff6c2'): void {
    this.floaters.push({ text, x, y, age: 0, color });
    if (this.floaters.length > 20) this.floaters.shift();
  }

  // ---------------------------------------------------------------- positions

  private squirrelPos(s: Squirrel): { x: number; y: number } {
    const frac = Math.min(1, s.age / (s.lifetime || SQUIRREL_LIFETIME_SEC));
    const span = this.w + 60;
    const rtl = s.id % 2 === 0;
    const x = rtl ? this.w + 30 - frac * span : -30 + frac * span;
    const lo = GRASS_TOP + 14;
    const hi = this.roadY() - 34;
    return { x, y: lo + hash01(s.id) * Math.max(10, hi - lo) };
  }

  private mailPos(): { x: number; y: number } {
    return { x: this.w - 32, y: GRASS_TOP + 22 + Math.sin(this.t * 3) * 3 };
  }

  private onPointer(e: PointerEvent): void {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const s = this.c.state;
    let best: Squirrel | null = null;
    let bestD = 40 * 40;
    for (const sq of s.squirrels) {
      const p = this.squirrelPos(sq);
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = sq;
      }
    }
    if (best) {
      const p = this.squirrelPos(best);
      const rew = catchSquirrel(s, best.id);
      if (rew) this.celebrate(rew, p.x, p.y, '\u{1F43F}️ Caught! ');
      return;
    }
    if (s.mailCount > 0) {
      const m = this.mailPos();
      if ((m.x - px) ** 2 + (m.y - py) ** 2 < 40 * 40) {
        const rewards = this.c.collectMail();
        if (rewards.length) this.floater(`\u{1F4EC} ×${rewards.length}`, m.x - 20, m.y, '#fff6c2');
      }
    }
  }

  private celebrate(rew: RewardResult, x: number, y: number, prefix: string): void {
    const txt = formatReward(rew);
    this.floater(txt, Math.min(this.w - 40, Math.max(40, x)), y, rew.kind === 'goldenBones' ? '#ffe27a' : '#d6ffc9');
    toast(prefix + txt, 'good');
  }

  // ---------------------------------------------------------------- update

  private targetCount(): number {
    const p = this.c.state.pups;
    if (p < 1) return 0;
    return Math.min(Math.ceil(p), Math.ceil(Math.min(60, Math.sqrt(p) * 2)));
  }

  private lawnTop(): number {
    return GRASS_TOP + 8;
  }
  private lawnBottom(): number {
    return Math.max(this.lawnTop() + 10, this.roadY() - 14);
  }
  /** perspective scale: smaller near the fence, larger near the road */
  private scaleAt(y: number): number {
    const t = (y - this.lawnTop()) / Math.max(1, this.lawnBottom() - this.lawnTop());
    return 0.8 + 0.4 * Math.max(0, Math.min(1, t));
  }

  private newPup(scatter = false): Pup {
    const slot = Math.floor(Math.random() * KENNEL_SLOTS);
    const x = (this.w * (slot + 0.5)) / KENNEL_SLOTS;
    const sx = scatter ? 20 + Math.random() * Math.max(10, this.w - 40) : x;
    const sy = scatter ? this.lawnTop() + Math.random() * (this.lawnBottom() - this.lawnTop()) : KENNEL_Y + 24;
    return {
      x: sx,
      y: sy,
      tx: sx,
      ty: scatter ? sy : GRASS_TOP + 10,
      emoji: DOGS[Math.floor(Math.random() * DOGS.length)],
      speed: 22 + Math.random() * 22,
      wait: scatter ? Math.random() * 3 : Math.random(),
      bounce: 0,
      face: 1,
    };
  }

  private pickTarget(p: Pup): void {
    p.tx = 20 + Math.random() * (this.w - 40);
    p.ty = this.lawnTop() + Math.random() * (this.lawnBottom() - this.lawnTop());
  }

  frame(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const s = this.c.state;
    const d = computeStats(s);

    const want = this.targetCount();
    const scatter = want - this.pups.length > 3;
    while (this.pups.length < want) this.pups.push(this.newPup(scatter));
    if (this.pups.length > want) this.pups.length = want;

    const zoom = 1 + Math.min(3, s.zoomies / 6);
    for (const p of this.pups) {
      p.bounce = Math.max(0, p.bounce - dt * 3);
      if (p.wait > 0) {
        p.wait -= dt;
        if (p.wait <= 0) this.pickTarget(p);
        continue;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * zoom * dt;
      if (dist <= step) {
        p.x = p.tx;
        p.y = p.ty;
        p.wait = 0.4 + Math.random() * 2.5;
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        if (Math.abs(dx) > 1) p.face = dx > 0 ? -1 : 1;
      }
    }

    // dig puffs
    this.digTimer -= dt;
    if (this.digTimer <= 0 && this.pups.length) {
      const idle = this.pups.filter((p) => p.wait > 0);
      const src = idle.length ? idle : this.pups;
      const p = src[Math.floor(Math.random() * src.length)];
      if (this.puffs.length < 14) {
        this.puffs.push({ x: p.x, y: p.y, age: 0, icon: FINDS[s.findIndex]?.icon ?? '\u{1FAB5}' });
      }
      const rate = Math.min(8, 0.8 + Math.sqrt(d.digPerSec) * 0.25);
      this.digTimer = (0.5 + Math.random()) / rate;
    }
    for (const q of this.puffs) q.age += dt;
    this.puffs = this.puffs.filter((q) => q.age < 1.1);

    // vehicles
    for (let i = 0; i < s.vehicles.length; i++) {
      const tier = s.vehicles[i];
      if (tier === null) {
        this.vehs[i] = null;
        continue;
      }
      let v = this.vehs[i];
      if (!v) {
        v = { x: Math.random() * this.w, lane: i % 2, speed: 40 + ((i * 17) % 40) };
        this.vehs[i] = v;
      }
      const dir = v.lane === 0 ? 1 : -1;
      v.x += dir * v.speed * dt * (1 + tier * 0.05);
      if (v.x > this.w + 30) v.x = -30;
      if (v.x < -30) v.x = this.w + 30;
    }

    for (const f of this.floaters) {
      f.age += dt;
      f.y -= 28 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.age < 1.8);

    this.draw();
  }

  // ---------------------------------------------------------------- draw

  private emoji(ch: string, x: number, y: number, size: number, flip = 1, alpha = 1): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (flip < 0) ctx.scale(-1, 1);
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  private draw(): void {
    const ctx = this.ctx;
    const { w, hgt: H } = this;
    const s = this.c.state;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, GRASS_TOP);
    sky.addColorStop(0, this.dark ? '#1d2c4a' : '#8fd3ff');
    sky.addColorStop(1, this.dark ? '#2e4a66' : '#d6f1ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, GRASS_TOP + 6);
    // grass
    const roadY = this.roadY();
    const grass = ctx.createLinearGradient(0, GRASS_TOP, 0, roadY);
    grass.addColorStop(0, this.dark ? '#2f6a35' : '#79c868');
    grass.addColorStop(1, this.dark ? '#245a2c' : '#5eb350');
    ctx.fillStyle = grass;
    ctx.fillRect(0, GRASS_TOP, w, roadY - GRASS_TOP);
    // fence
    ctx.fillStyle = this.dark ? '#6b4a2b' : '#b98550';
    ctx.fillRect(0, GRASS_TOP - 4, w, 5);
    // road
    ctx.fillStyle = this.dark ? '#3a3d44' : '#5b5f69';
    ctx.fillRect(0, roadY, w, ROAD_H);
    ctx.fillStyle = '#f3e7a1';
    for (let x = -((this.t * 20) % 36); x < w; x += 36) ctx.fillRect(x, roadY + ROAD_H / 2 - 1.5, 18, 3);

    // sun
    this.emoji('☀️', 28, 18, 22, 1, this.dark ? 0.25 : 1);

    // kennels
    for (let i = 0; i < KENNEL_SLOTS; i++) {
      const x = (w * (i + 0.5)) / KENNEL_SLOTS;
      const tier = s.kennels[i];
      if (tier === null || tier === undefined) {
        this.emoji('➕', x, KENNEL_Y + 6, 18, 1, 0.35);
      } else {
        this.emoji(KENNELS[tier]?.icon ?? '\u{1F3E0}', x, KENNEL_Y + 4, 40);
      }
    }

    // dig puffs (under pups)
    for (const q of this.puffs) {
      const a = 1 - q.age / 1.1;
      this.emoji('\u{1F4A8}', q.x, q.y + 8, 14, 1, Math.max(0, a * 0.8));
      this.emoji(q.icon, q.x, q.y - 6 - q.age * 22, 16, 1, Math.min(1, a * 1.6));
    }

    // pups sorted by y
    const sorted = [...this.pups].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const bob = p.wait > 0 ? 0 : Math.abs(Math.sin(this.t * 10 + p.x)) * 2;
      const hop = p.bounce > 0 ? Math.sin(p.bounce * Math.PI) * 14 : 0;
      // faces left by default; flip when moving right
      this.emoji(p.emoji, p.x, p.y - bob - hop, 22 * this.scaleAt(p.y), p.face);
    }

    // vehicles
    for (let i = 0; i < this.vehs.length; i++) {
      const v = this.vehs[i];
      const tier = s.vehicles[i];
      if (!v || tier === null || tier === undefined) continue;
      const y = roadY + 15 + v.lane * 24;
      this.emoji(VEHICLES[tier]?.icon ?? '\u{1F69A}', v.x, y, 24, v.lane === 0 ? -1 : 1);
    }

    // squirrels
    for (const sq of s.squirrels) {
      const p = this.squirrelPos(sq);
      const hop = Math.abs(Math.sin(sq.age * 9)) * 8;
      const rtl = sq.id % 2 === 0;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 8);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y - hop, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.emoji('\u{1F43F}️', p.x, p.y - hop, 28, rtl ? 1 : -1);
    }

    // mail
    if (s.mailCount > 0) {
      const m = this.mailPos();
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(this.t * 5);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.emoji('\u{1F4EC}', m.x, m.y, 30);
      const label = String(s.mailCount);
      ctx.save();
      ctx.fillStyle = '#e0452d';
      ctx.beginPath();
      ctx.arc(m.x + 14, m.y - 12, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, m.x + 14, m.y - 12);
      ctx.restore();
    }

    // floaters
    ctx.save();
    ctx.font = `bold 17px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(30,50,20,.75)';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, (1.8 - f.age) * 1.5));
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
}
