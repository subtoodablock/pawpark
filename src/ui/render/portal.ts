// The Paw Portal on the lawn (docs/11-paw-portal.md section 6): a stone ring around a swirl of green, violet and
// teal light, a build site before it exists, and the dogs that leap in on launch and tumble out on return.
// Static parts are baked once into the sprite cache; per frame only a rotated swirl, a few motes and the dogs draw.
import { PupActor } from './PupActor';
import { drawPup, drawPupShadow } from './PupActor';
import { POSE_FRAMES } from './dogSprite';
import { BREEDS } from './breeds';
import type { Particles } from './particles';
import type { Sprite, SpriteCache } from './SpriteCache';
import { clamp, darken, lighten, rgba } from './shade';
import { FONT } from './palette';
import type { Layout } from './world';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const TAU = Math.PI * 2;

export const PORTAL_W = 140;
export const PORTAL_H = 150;
export const PORTAL_AX = 70;
export const PORTAL_AY = 136;
/** ring centre and inner radii inside the sprite */
const CX = 70;
const CY = 70;
const ORX = 40;
const ORY = 52;
const IRX = 29;
const IRY = 41;

const GREEN = '#5be37a';
const VIOLET = '#9a6bff';
const TEAL = '#35d0c0';
const RARITY_GLOW = ['#cfd6de', '#5b95ff', '#b46cff', '#ffcf33'];

function ell(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
}

/** the stone ring, plinth and keystone (unlit); runes are glowed live */
export function drawPortalFrame(ctx: Ctx): void {
  // contact shadow + plinth
  ctx.fillStyle = 'rgba(24,18,50,0.28)';
  ell(ctx, CX + 3, PORTAL_AY - 1, 54, 11);
  ctx.fill();
  const plinth = ctx.createLinearGradient(0, 118, 0, 142);
  plinth.addColorStop(0, '#cfc8e6');
  plinth.addColorStop(1, '#6d6490');
  ctx.fillStyle = plinth;
  ell(ctx, CX, 129, 50, 11);
  ctx.fill();
  ctx.fillStyle = '#e4dff3';
  ell(ctx, CX, 126, 46, 9);
  ctx.fill();
  ctx.fillStyle = '#4b3f78';
  ell(ctx, CX, 126, 36, 6);
  ctx.fill();
  // ring (evenodd hole)
  const ring = new Path2D();
  ring.ellipse(CX, CY, ORX, ORY, 0, 0, TAU);
  ring.ellipse(CX, CY, IRX, IRY, 0, 0, TAU);
  const g = ctx.createLinearGradient(CX - ORX, CY - ORY, CX + ORX, CY + ORY);
  g.addColorStop(0, '#ece8fa');
  g.addColorStop(0.45, '#aaa2cc');
  g.addColorStop(1, '#5d5282');
  ctx.fillStyle = g;
  ctx.fill(ring, 'evenodd');
  // inner lip: light top-left, dark bottom-right
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(CX, CY, IRX + 1, IRY + 1, 0, Math.PI * 0.95, Math.PI * 1.55);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,18,70,0.45)';
  ctx.beginPath();
  ctx.ellipse(CX, CY, IRX + 1, IRY + 1, 0, -0.05 * Math.PI, Math.PI * 0.55);
  ctx.stroke();
  // outer rim shade
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(40,26,86,0.5)';
  ell(ctx, CX, CY, ORX, ORY);
  ctx.stroke();
  // carved notches between the runes
  ctx.strokeStyle = 'rgba(60,42,110,0.4)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.2;
    const mx = (ORX + IRX) / 2;
    const my = (ORY + IRY) / 2;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * (mx - 3), CY + Math.sin(a) * (my - 4));
    ctx.lineTo(CX + Math.cos(a) * (mx + 3), CY + Math.sin(a) * (my + 4));
    ctx.stroke();
  }
  // keystone gem
  const gem = ctx.createRadialGradient(CX - 2, CY - ORY + 2, 0, CX, CY - ORY + 5, 9);
  gem.addColorStop(0, '#ffffff');
  gem.addColorStop(0.4, TEAL);
  gem.addColorStop(1, '#2a8f88');
  ctx.fillStyle = gem;
  ctx.beginPath();
  ctx.moveTo(CX, CY - ORY - 8);
  ctx.lineTo(CX + 8, CY - ORY + 3);
  ctx.lineTo(CX, CY - ORY + 13);
  ctx.lineTo(CX - 8, CY - ORY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,70,70,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** spiral arms texture (square, rotated live) */
export function drawPortalSwirl(ctx: Ctx): void {
  const R = 50;
  const bg = ctx.createRadialGradient(R, R, 0, R, R, R);
  bg.addColorStop(0, '#f4fff2');
  bg.addColorStop(0.18, '#8ff0b0');
  bg.addColorStop(0.55, '#5b3fc8');
  bg.addColorStop(1, '#21124f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 2 * R, 2 * R);
  ctx.lineCap = 'round';
  const cols = [GREEN, VIOLET, TEAL, '#c9a8ff'];
  for (let arm = 0; arm < 4; arm++) {
    const col = cols[arm];
    for (let a = 0; a < 5.4; a += 0.07) {
      const r = 3 + a * 8.2;
      const ang = a + (arm / 4) * TAU;
      const x = R + Math.cos(ang) * r;
      const y = R + Math.sin(ang) * r;
      const x2 = R + Math.cos(ang + 0.1) * (r + 0.6);
      const y2 = R + Math.sin(ang + 0.1) * (r + 0.6);
      ctx.strokeStyle = rgba(col, 0.2 + 0.5 * (1 - a / 5.4));
      ctx.lineWidth = 2 + a * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  // sprinkle of stars
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399;
    const r = 8 + ((i * 37) % 38);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(R + Math.cos(a) * r, R + Math.sin(a) * r, 0.9 + (i % 3) * 0.4, 0, TAU);
    ctx.fill();
  }
}

/** The empty lot before the gate is built: dirt ring, stakes with rope, a few stones and a "BUILD PORTAL" sign. */
export function drawBuildSite(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(24,18,50,0.2)';
  ell(ctx, CX + 2, PORTAL_AY, 54, 12);
  ctx.fill();
  const dirt = ctx.createRadialGradient(CX, 128, 4, CX, 128, 54);
  dirt.addColorStop(0, '#e9cfa4');
  dirt.addColorStop(1, '#c79c68');
  ctx.fillStyle = dirt;
  ell(ctx, CX, 128, 50, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,31,209,0.55)';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([5, 5]);
  ell(ctx, CX, 128, 40, 9);
  ctx.stroke();
  ctx.setLineDash([]);
  // stakes + rope
  const stakes: [number, number][] = [
    [26, 124],
    [114, 124],
    [40, 138],
    [100, 138],
  ];
  ctx.strokeStyle = '#d8c7a5';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(26, 114);
  ctx.quadraticCurveTo(70, 124, 114, 114);
  ctx.stroke();
  for (const [x, y] of stakes) {
    ctx.fillStyle = '#8a5428';
    ctx.fillRect(x - 2, y - 14, 4, 16);
    ctx.fillStyle = '#b8743d';
    ctx.fillRect(x - 2, y - 14, 2, 16);
  }
  // loose stone blocks
  const block = (x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = '#9d95bd';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#d6d0ee';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = '#6d6490';
    ctx.fillRect(x + w - 3, y + 3, 3, h - 3);
  };
  block(48, 120, 16, 10);
  block(78, 124, 18, 9);
  block(62, 130, 14, 8);
  // sign
  ctx.fillStyle = '#8a5428';
  ctx.fillRect(66, 66, 8, 58);
  const board = new Path2D();
  board.roundRect(18, 48, 104, 30, 10);
  ctx.fillStyle = '#7a1fd1';
  ctx.fill(board);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke(board);
  ctx.fillStyle = '#fff';
  ctx.font = `500 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BUILD PORTAL', 70, 64);
}

/** soft round light, tinted */
export function drawMote(ctx: Ctx, col: string): void {
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, rgba(lighten(col, 0.6), 1));
  g.addColorStop(0.35, rgba(col, 0.7));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
}

interface Jumper {
  a: PupActor;
  mode: 'in' | 'out';
  t: number;
  delay: number;
  dur: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  rarity: number;
  poofed: boolean;
}

interface Peek {
  kind: number;
  t: number;
  next: number;
}

export interface PortalDrawArgs {
  /** anchor (ground contact point) on the lawn, in css px */
  x: number;
  y: number;
  /** size multiplier */
  s: number;
  built: boolean;
  /** crews waiting to be collected */
  ready: number;
  night: boolean;
}

/** Live portal state + draw. One instance per scene. */
export class PortalFx {
  private jumpers: Jumper[] = [];
  private pool: PupActor[] = [];
  private peek: Peek = { kind: 0, t: -1, next: 4 };
  /** 0..1 flash when a dog dives in or tumbles out */
  flash = 0;
  private t = 0;

  /** crews run in from the lawn and leap into the swirl */
  launch(x: number, y: number, s: number, L: Layout, n: number): void {
    const count = clamp(n, 1, 3);
    const side = x > L.w * 0.5 ? -1 : 1;
    for (let i = 0; i < count; i++) {
      const j = this.take();
      j.mode = 'in';
      j.t = 0;
      j.delay = i * 0.28;
      j.dur = 1.25;
      j.sx = clamp(x + side * (110 + i * 30) * s, 18, L.w - 18);
      j.sy = clamp(y + (i - 1) * 12 * s, L.lawnTop + 20, L.lawnBottom);
      j.tx = x;
      j.ty = y;
      j.a.reset((Math.random() * BREEDS.length) | 0, false);
      j.a.pose = 'run';
      j.a.alpha = 0;
      j.a.face = j.a.faceS = j.tx > j.sx ? 1 : -1;
      j.poofed = false;
      j.rarity = 0;
    }
  }

  /** crews tumble out of the swirl with a glowing loot bubble coloured by their best rarity */
  land(x: number, y: number, s: number, L: Layout, n: number, rarity: number): void {
    const count = clamp(n, 1, 3);
    for (let i = 0; i < count; i++) {
      const j = this.take();
      j.mode = 'out';
      j.t = 0;
      j.delay = i * 0.3;
      j.dur = 0.8;
      j.sx = x;
      j.sy = y;
      const dir = i % 2 ? 1 : -1;
      j.tx = clamp(x + dir * (34 + i * 16) * s, 18, L.w - 18);
      j.ty = clamp(y + (14 + i * 6) * s, L.lawnTop + 20, L.lawnBottom);
      j.a.reset((Math.random() * BREEDS.length) | 0, false);
      j.a.pose = 'run';
      j.a.alpha = 0;
      j.a.scale = 0.15;
      j.a.face = j.a.faceS = dir;
      j.poofed = false;
      j.rarity = rarity;
    }
  }

  private take(): Jumper {
    if (this.jumpers.length >= 8) this.jumpers.shift();
    const a = this.pool.pop() ?? new PupActor();
    const j: Jumper = { a, mode: 'in', t: 0, delay: 0, dur: 1, sx: 0, sy: 0, tx: 0, ty: 0, rarity: 0, poofed: false };
    this.jumpers.push(j);
    return j;
  }

  get busy(): boolean {
    return this.jumpers.length > 0;
  }

  update(dt: number, s: number, particles: Particles): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    for (let i = this.jumpers.length - 1; i >= 0; i--) {
      const j = this.jumpers[i];
      const a = j.a;
      if (j.delay > 0) {
        j.delay -= dt;
        a.alpha = 0;
        continue;
      }
      j.t += dt;
      const u = clamp(j.t / j.dur, 0, 1);
      const frames = POSE_FRAMES.run;
      if (j.mode === 'in') {
        // run along the ground for 70%, then leap and shrink into the swirl
        const run = clamp(u / 0.7, 0, 1);
        const leap = clamp((u - 0.7) / 0.3, 0, 1);
        a.pose = 'run';
        a.frame = Math.floor(j.t * 14) % frames;
        a.x = j.sx + (j.tx - j.sx) * run;
        a.y = j.sy + (j.ty - j.sy) * run;
        a.z = Math.sin(leap * Math.PI * 0.5) * 46 * s;
        a.scale = 1 - leap * 0.82;
        a.alpha = u < 0.06 ? u / 0.06 : 1 - leap * leap;
        a.wag += dt * 22;
        if (leap > 0.85 && !j.poofed) {
          j.poofed = true;
          this.flash = 1;
          particles.sparkle(j.tx, j.ty - 46 * s, 5, 12 * s, 4);
        }
        if (u >= 1) this.drop(i);
      } else {
        // tumble out: arc from the swirl to the lawn, squash on landing, bubble overhead, fade
        const air = clamp(u, 0, 1);
        a.x = j.sx + (j.tx - j.sx) * air;
        a.y = j.sy + (j.ty - j.sy) * air;
        const h0 = 46 * s;
        a.z = h0 * (1 - air) + Math.sin(air * Math.PI) * 30 * s;
        a.scale = 0.15 + 0.85 * clamp(air * 1.6, 0, 1);
        a.pose = air < 0.95 ? 'run' : 'sit';
        a.frame = air < 0.95 ? Math.floor(j.t * 12) % frames : 0;
        a.alpha = clamp(air * 5, 0, 1);
        a.squash = air > 0.9 ? Math.sin((air - 0.9) * 10 * Math.PI) * 0.8 : 0;
        if (!j.poofed) {
          j.poofed = true;
          this.flash = 1;
          particles.sparkle(j.sx, j.sy - 46 * s, 5, 12 * s, 4);
        }
        if (j.t > j.dur) {
          // stay seated with the bubble for 2.2 s, then fade
          const rest = j.t - j.dur;
          a.pose = 'sit';
          a.frame = 0;
          a.z = 0;
          a.squash = 0;
          a.scale = 1;
          a.alpha = rest > 1.8 ? clamp(1 - (rest - 1.8) / 0.5, 0, 1) : 1;
          if (rest > 2.4) this.drop(i);
        }
      }
    }
    // idle: a peek of another universe now and then
    const p = this.peek;
    if (p.t >= 0) {
      p.t += dt;
      if (p.t > 2.6) {
        p.t = -1;
        p.next = 7 + Math.random() * 7;
      }
    } else {
      p.next -= dt;
      if (p.next <= 0) {
        p.t = 0;
        p.kind = (p.kind + 1) % 2;
      }
    }
  }

  private drop(i: number): void {
    const [j] = this.jumpers.splice(i, 1);
    this.pool.push(j.a);
  }

  /** the portal itself (ring, swirl, motes); call from the y-sorted pass */
  draw(ctx: CanvasRenderingContext2D, dpr: number, cache: SpriteCache, a: PortalDrawArgs): void {
    const { x, y, s } = a;
    if (!a.built) {
      const site = cache.getOrNull('portal:site', PORTAL_W, PORTAL_H, (c) => drawBuildSite(c), 3);
      if (!site) return;
      const bob = Math.sin(this.t * 2) * 1.2;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * x, dpr * (y + bob * 0.3));
      ctx.drawImage(site.c as CanvasImageSource, -PORTAL_AX, -PORTAL_AY, site.w, site.h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    const frame = cache.getOrNull('portal:frame', PORTAL_W, PORTAL_H, (c) => drawPortalFrame(c), 3);
    const swirl = cache.getOrNull('portal:swirl', 100, 100, (c) => drawPortalSwirl(c), 3);
    if (!frame || !swirl) return;
    const t = this.t;
    const cx = x + (CX - PORTAL_AX) * s;
    const cy = y + (CY - PORTAL_AY) * s;
    const glow = cache.get('portal:glow', 32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35, 'rgba(150,255,210,0.5)');
      g.addColorStop(1, 'rgba(120,90,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // soft halo on the grass
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.32 + 0.14 * Math.sin(t * 2) + this.flash * 0.3) * (a.night ? 1.3 : 1);
    const hs = 150 * s;
    ctx.drawImage(glow.c as CanvasImageSource, cx - hs / 2, cy - hs * 0.45, hs, hs * 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // swirl, clipped to the opening
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, (IRX + 1) * s, (IRY + 1) * s, 0, 0, TAU);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.scale(1, IRY / IRX);
    ctx.rotate(t * (0.9 + this.flash * 1.4));
    const R = (IRX + 3) * s;
    ctx.drawImage(swirl.c as CanvasImageSource, -R, -R, R * 2, R * 2);
    ctx.restore();
    // peek silhouettes inside the swirl
    const p = this.peek;
    if (p.t >= 0) {
      const k = Math.sin(clamp(p.t / 2.6, 0, 1) * Math.PI);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, (IRX - 2) * s, (IRY - 2) * s, 0, 0, TAU);
      ctx.clip();
      ctx.globalAlpha = 0.85 * k;
      if (p.kind === 0) this.drawCatPeek(ctx, cx, cy + 6 * s, s);
      else this.drawBaconPeek(ctx, cx, cy, s);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // bright core
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + this.flash * 0.5 + (a.ready > 0 ? 0.12 * Math.sin(t * 5) : 0);
    const cs = 64 * s;
    ctx.drawImage(glow.c as CanvasImageSource, cx - cs / 2, cy - cs * 0.62, cs, cs * 1.24);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // stone frame over it
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * x, dpr * y);
    ctx.drawImage(frame.c as CanvasImageSource, -PORTAL_AX, -PORTAL_AY, frame.w, frame.h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // pulsing runes around the ring
    const tealMote = cache.get('portal:mote:t', 16, 16, (c) => drawMote(c, TEAL));
    const greenMote = cache.get('portal:mote:g', 16, 16, (c) => drawMote(c, GREEN));
    const violetMote = cache.get('portal:mote:v', 16, 16, (c) => drawMote(c, VIOLET));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU + 0.2;
      const rx = ((ORX + IRX) / 2) * s;
      const ry = ((ORY + IRY) / 2) * s;
      const al = 0.35 + 0.35 * Math.sin(t * 2.2 + i * 0.9) + this.flash * 0.3;
      ctx.globalAlpha = clamp(al, 0, 1);
      const m = i % 2 ? greenMote : tealMote;
      const sz = 11 * s;
      ctx.drawImage(m.c as CanvasImageSource, cx + Math.cos(ang) * rx - sz / 2, cy + Math.sin(ang) * ry - sz / 2, sz, sz);
    }
    // motes drifting up and around
    for (let i = 0; i < 12; i++) {
      const ph = (t * 0.22 + i / 12) % 1;
      const ang = i * 2.1 + t * 0.5;
      const rr = 1 + 0.35 * ph;
      const mx = cx + Math.cos(ang) * ORX * s * rr;
      const my = cy + Math.sin(ang) * ORY * s * rr * 0.9 - ph * 18 * s;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
      const m = i % 3 === 0 ? violetMote : i % 3 === 1 ? greenMote : tealMote;
      const sz = (6 + (i % 3) * 2) * s;
      ctx.drawImage(m.c as CanvasImageSource, mx - sz / 2, my - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // ready beacon above the gate
    if (a.ready > 0) this.drawReady(ctx, cache, cx, y - (PORTAL_AY - 2) * s - 8 * s, s, a.ready);
  }

  private drawCatPeek(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = '#10082a';
    ctx.beginPath();
    ctx.ellipse(x, y, 17 * s, 14 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 16 * s, y - 6 * s);
    ctx.lineTo(x - 13 * s, y - 24 * s);
    ctx.lineTo(x - 4 * s, y - 12 * s);
    ctx.moveTo(x + 16 * s, y - 6 * s);
    ctx.lineTo(x + 13 * s, y - 24 * s);
    ctx.lineTo(x + 4 * s, y - 12 * s);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    for (const dx of [-7, 7]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y - 2 * s, 3 * s, 4.2 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#10082a';
      ctx.fillRect(x + dx * s - 0.8 * s, y - 6 * s, 1.6 * s, 8 * s);
      ctx.fillStyle = '#ffe14d';
    }
  }

  private drawBaconPeek(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    for (let i = 0; i < 3; i++) {
      const yy = y - 16 * s + i * 14 * s;
      ctx.lineWidth = 6 * s;
      ctx.lineCap = 'round';
      ctx.strokeStyle = i % 2 ? '#f6d3b0' : '#d6483a';
      ctx.beginPath();
      ctx.moveTo(x - 22 * s, yy);
      for (let k = 1; k <= 4; k++) ctx.quadraticCurveTo(x - 22 * s + k * 11 * s - 5 * s, yy + (k % 2 ? -6 : 6) * s, x - 22 * s + k * 11 * s, yy);
      ctx.stroke();
    }
  }

  private drawReady(ctx: CanvasRenderingContext2D, cache: SpriteCache, x: number, y: number, s: number, n: number): void {
    const bob = Math.sin(this.t * 3) * 2.5 * s;
    const lab = String(n);
    const badge: Sprite = cache.get(`portal:ready:${lab}`, 40, 40, (c) => {
      c.fillStyle = '#20a63a';
      c.beginPath();
      c.arc(20, 20, 15, 0, TAU);
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = '#fff';
      c.font = `600 20px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(lab, 20, 21);
    });
    const sz = 30 * Math.max(0.9, s * 1.2);
    ctx.drawImage(badge.c as CanvasImageSource, x - sz / 2, y - sz / 2 + bob, sz, sz);
  }

  /** shadows + dogs + loot bubbles, drawn after the y-sorted pass (they sit right next to the gate) */
  drawJumpers(ctx: CanvasRenderingContext2D, dpr: number, cache: SpriteCache, L: Layout): void {
    if (!this.jumpers.length) return;
    const bubble = cache.get('portal:bubble', 32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    });
    for (const j of this.jumpers) {
      const a = j.a;
      if (j.delay > 0 || a.alpha <= 0.01) continue;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPupShadow(ctx, dpr, cache, L, a);
      drawPup(ctx, dpr, cache, L, a, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (j.mode === 'out' && j.t > j.dur * 0.8) {
        const col = RARITY_GLOW[j.rarity] ?? RARITY_GLOW[0];
        const k = clamp((j.t - j.dur * 0.8) / 0.4, 0, 1) * a.alpha;
        const bx = a.x;
        const by = a.y - 36 - Math.sin(this.t * 4 + j.sx) * 2.5;
        ctx.globalAlpha = k * 0.95;
        const tint = cache.get(`portal:bub:${j.rarity}`, 32, 32, (c) => {
          const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
          g.addColorStop(0, rgba(lighten(col, 0.7), 1));
          g.addColorStop(0.45, rgba(col, 0.75));
          g.addColorStop(1, rgba(darken(col, 0.2), 0));
          c.fillStyle = g;
          c.fillRect(0, 0, 32, 32);
        });
        ctx.drawImage(tint.c as CanvasImageSource, bx - 15, by - 15, 30, 30);
        ctx.globalAlpha = k * 0.7;
        ctx.drawImage(bubble.c as CanvasImageSource, bx - 7, by - 9, 12, 12);
        ctx.globalAlpha = 1;
      }
    }
  }
}
