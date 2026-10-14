// Pup actors: behaviour state machine (docs §5), Egg-Inc style adoption runners, pooled.
import { BREEDS } from './breeds';
import {
  DOG_AX,
  DOG_K,
  DOG_AY,
  DOG_H,
  DOG_W,
  POSE_FRAMES,
  type Pose,
  TAIL_AX,
  TAIL_AY,
  TAIL_W,
  dogKey,
  drawDogFrame,
  drawTail,
  tailAnchor,
  tailKey,
} from './dogSprite';
import type { Particles } from './particles';
import { type Sprite, type SpriteCache, blit } from './SpriteCache';
import { clamp } from './shade';
import { type Layout, depthScale } from './world';

export const enum St {
  Wander,
  Sniff,
  Dig,
  Sit,
  Nap,
  Play,
  Run,
  Leave,
  Enter,
}

const POSE_INDEX: Record<Pose, number> = { walk: 0, run: 1, sit: 2, dig: 3, nap: 4, sniff: 5 };

export interface SimEnv {
  L: Layout;
  zoom: number;
  particles: Particles;
  doors: { x: number; y: number }[];
  centerDoor: { x: number; y: number };
  target: number;
  findPop(x: number, y: number): void;
  mound(x: number, y: number): void;
  doorKick(): void;
}

const TAU = Math.PI * 2;
const SHADOW_W = 64;
const SHADOW_H = 22;

// tail anchor lookup (computed lazily, no per-frame allocation)
const TA_X = new Float32Array(10 * 6 * 8 * 2);
const TA_Y = new Float32Array(10 * 6 * 8 * 2);
const TA_R = new Float32Array(10 * 6 * 8 * 2);
const TA_OK = new Uint8Array(10 * 6 * 8 * 2);
const TA_H = new Uint8Array(10 * 6 * 8 * 2);

export class PupActor {
  active = false;
  breed = 0;
  puppy = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  tx = 0;
  ty = 0;
  speedMul = 1;
  state: St = St.Wander;
  t = 0;
  dur = 0;
  phase = 0;
  wag = 0;
  wagAmp = 0.3;
  alpha = 1;
  /** extra size multiplier (portal leaps shrink the dog into the swirl) */
  scale = 1;
  fadeRate = 0;
  face = 1;
  faceS = 1;
  squash = 0;
  jump = 0;
  z = 0;
  pose: Pose = 'walk';
  frame = 0;
  partner: PupActor | null = null;
  leader = false;
  digT = 0;
  sfx = 0;
  // runner
  x0 = 0;
  y0 = 0;
  cx = 0;
  cy = 0;
  x1 = 0;
  y1 = 0;
  rt = 0;
  rdur = 1;
  hopPhase = 0;
  idleBlink = 0;

  reset(breed: number, puppy: boolean): void {
    this.active = true;
    this.breed = breed;
    this.puppy = puppy;
    this.vx = this.vy = 0;
    this.state = St.Wander;
    this.t = 0;
    this.dur = 0;
    this.phase = Math.random();
    this.wag = Math.random() * TAU;
    this.wagAmp = 0.3;
    this.alpha = 1;
    this.scale = 1;
    this.fadeRate = 0;
    this.faceS = this.face = Math.random() < 0.5 ? 1 : -1;
    this.squash = 0;
    this.jump = 0;
    this.z = 0;
    this.partner = null;
    this.speedMul = 0.8 + Math.random() * 0.45;
    this.pose = 'walk';
    this.frame = 0;
    this.digT = 0;
    this.sfx = 0;
  }
}

function tailAnch(breed: number, pose: Pose, frame: number, pup: boolean): number {
  const i = ((breed * 6 + POSE_INDEX[pose]) * 8 + frame) * 2 + (pup ? 1 : 0);
  if (!TA_OK[i]) {
    const a = tailAnchor(BREEDS[breed], pose, frame, pup);
    TA_X[i] = a.x - DOG_AX;
    TA_Y[i] = a.y - DOG_AY;
    TA_R[i] = a.rest;
    TA_H[i] = a.hide ? 1 : 0;
    TA_OK[i] = 1;
  }
  return i;
}

export class Flock {
  readonly actors: PupActor[] = [];
  readonly draw: PupActor[] = [];
  private pool: PupActor[] = [];
  wanderers = 0;
  runners = 0;
  private breedCounter = 0;
  private doorCursor = 0;
  constructor(cap = 170) {
    for (let i = 0; i < cap; i++) this.pool.push(new PupActor());
  }

  private take(): PupActor | null {
    for (const a of this.pool) if (!a.active) return a;
    return null;
  }

  private pickBreed(): number {
    // spread breeds evenly with some randomness
    this.breedCounter++;
    return Math.random() < 0.65 ? this.breedCounter % BREEDS.length : Math.floor(Math.random() * BREEDS.length);
  }

  spawnWanderer(env: SimEnv, scatter: boolean): PupActor | null {
    const a = this.take();
    if (!a) return null;
    const bi = this.pickBreed();
    a.reset(bi, Math.random() < 0.1);
    const L = env.L;
    if (scatter) {
      this.bestSpot(a, env, 18, L.w - 18, L.kennelBase + 20, L.lawnBottom, 8);
      a.x = a.tx;
      a.y = a.ty;
      a.alpha = 0;
      a.fadeRate = 2.2;
      this.pickTarget(a, env);
      this.add(a);
      this.choose(a, env);
      return a;
    } else {
      const d = env.doors.length ? env.doors[Math.floor(Math.random() * env.doors.length)] : env.centerDoor;
      a.x = d.x;
      a.y = d.y + 2;
      a.alpha = 0;
      a.fadeRate = 3.5;
      a.state = St.Wander;
      this.pickTarget(a, env, true);
    }
    this.add(a);
    return a;
  }

  private add(a: PupActor): void {
    this.actors.push(a);
    this.wanderers++;
  }

  spawnRunner(env: SimEnv): boolean {
    if (this.runners >= 40) return false;
    const a = this.take();
    if (!a) return false;
    const L = env.L;
    a.reset(this.pickBreed(), Math.random() < 0.1);
    a.state = St.Run;
    a.x0 = a.x = env.centerDoor.x + (Math.random() - 0.5) * 4;
    a.y0 = a.y = env.centerDoor.y;
    let door = env.centerDoor;
    if (env.doors.length) {
      door = env.doors[this.doorCursor % env.doors.length];
      if (Math.random() < 0.4) door = env.doors[Math.floor(Math.random() * env.doors.length)];
      this.doorCursor++;
    } else {
      door = { x: L.w * 0.6, y: L.kennelBase + 40 };
    }
    a.x1 = door.x;
    a.y1 = door.y;
    const mx = (a.x0 + a.x1) / 2;
    const my = (a.y0 + a.y1) / 2;
    const bulge = 26 + Math.random() * 46;
    a.cx = mx + (Math.random() - 0.5) * 30;
    a.cy = Math.min(L.lawnBottom - 6, my + bulge * (Math.random() < 0.78 ? 1 : -0.35));
    a.rt = 0;
    const len = Math.hypot(a.x1 - a.x0, a.y1 - a.y0) + bulge * 0.7;
    a.rdur = 0.95 + len / 230 + Math.random() * 0.25;
    a.alpha = 0;
    a.fadeRate = 9;
    a.wagAmp = 0.2;
    this.actors.push(a);
    this.runners++;
    env.doorKick();
    env.particles.dust(a.x0, a.y0 + 1, 2, 12);
    return true;
  }

  bounce(n: number): void {
    for (let i = 0; i < n && this.actors.length; i++) {
      const a = this.actors[Math.floor(Math.random() * this.actors.length)];
      if (a.state !== St.Run && a.jump <= 0) a.jump = 0.0001;
    }
  }

  /**
   * Best-candidate sampling: draw a handful of random spots on the lawn and keep the one that is
   * farthest (in screen-ellipse metric) from every other pup and every other pup's destination, with a
   * slight push away from the crowd centroid. This is a cheap Poisson-disc-like distribution, so the whole
   * lawn gets used instead of everyone converging on the middle.
   */
  private bestSpot(a: PupActor, env: SimEnv, x0: number, x1: number, y0: number, y1: number, tries: number): void {
    const list = this.actors;
    let cx = 0;
    let cy = 0;
    let n = 0;
    for (const o of list) {
      if (o === a || o.state === St.Run || o.state === St.Enter) continue;
      cx += o.x;
      cy += o.y;
      n++;
    }
    if (n) {
      cx /= n;
      cy /= n;
    }
    let bx = x0 + Math.random() * (x1 - x0);
    let by = y0 + Math.random() * (y1 - y0);
    let bs = -1;
    for (let t = 0; t < tries; t++) {
      const x = x0 + Math.random() * (x1 - x0);
      const y = y0 + Math.random() * (y1 - y0);
      let d2 = 1e9;
      for (const o of list) {
        if (o === a || o.state === St.Run || o.state === St.Enter) continue;
        const dx = x - o.x;
        const dy = (y - o.y) * 2.2;
        const dd = dx * dx + dy * dy;
        if (dd < d2) d2 = dd;
        // others' pending destinations count too (wanderers only)
        if (o.state === St.Wander) {
          const tx = x - o.tx;
          const ty = (y - o.ty) * 2.2;
          const td = tx * tx + ty * ty;
          if (td < d2) d2 = td;
        }
      }
      // mild preference for spots away from the crowd centroid
      const cd = n ? Math.hypot(x - cx, (y - cy) * 2.2) : 0;
      const score = Math.sqrt(d2) + cd * 0.22;
      if (score > bs) {
        bs = score;
        bx = x;
        by = y;
      }
    }
    a.tx = bx;
    a.ty = by;
    void env;
  }

  private pickTarget(a: PupActor, env: SimEnv, fromDoor = false): void {
    const L = env.L;
    const y0 = L.kennelBase + 16 * L.bs;
    const y1 = L.lawnBottom;
    if (fromDoor) {
      // leave the door in the general outward direction, but still avoid the crowd
      this.bestSpot(a, env, clamp(a.x - 60, 16, L.w - 16), clamp(a.x + 60, 16, L.w - 16), clamp(a.y + 18, y0, y1), clamp(a.y + 90, y0, y1), 5);
    } else {
      this.bestSpot(a, env, 16, L.w - 16, y0, y1, 7);
    }
  }

  private choose(a: PupActor, env: SimEnv): void {
    const r = Math.random() * 100;
    a.t = 0;
    if (r < 50) {
      a.state = St.Wander;
      this.pickTarget(a, env);
    } else if (r < 60) {
      a.state = St.Sniff;
      a.dur = 1.1 + Math.random() * 1.2;
    } else if (r < 75) {
      a.state = St.Dig;
      a.dur = 1.7 + Math.random() * 1.2;
      a.digT = 0;
    } else if (r < 90) {
      a.state = St.Sit;
      a.dur = 2 + Math.random() * 3;
      a.squash = 0.4;
    } else if (r < 95) {
      a.state = St.Nap;
      a.dur = 4 + Math.random() * 5;
      // at most one small z per nap, and only about one nap in four
      a.sfx = Math.random() < 0.25 ? 1.5 + Math.random() * 2 : 1e9;
    } else {
      // play: chase another idle pup
      let b: PupActor | null = null;
      for (let i = 0; i < 6; i++) {
        const c = this.actors[Math.floor(Math.random() * this.actors.length)];
        if (c !== a && (c.state === St.Wander || c.state === St.Sit) && c.alpha > 0.9 && !c.partner) {
          b = c;
          break;
        }
      }
      if (!b) {
        a.state = St.Wander;
        this.pickTarget(a, env);
        return;
      }
      a.state = b.state = St.Play;
      a.partner = b;
      b.partner = a;
      a.leader = true;
      b.leader = false;
      a.dur = b.dur = 3.2 + Math.random() * 2;
      a.t = b.t = 0;
      a.sfx = b.sfx = 0;
      this.pickTarget(a, env);
    }
  }

  update(dt: number, env: SimEnv): void {
    const L = env.L;
    const zoom = env.zoom;
    const list = this.actors;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      a.t += dt;
      // fades
      if (a.fadeRate > 0) {
        a.alpha = Math.min(1, a.alpha + a.fadeRate * dt);
        if (a.alpha >= 1) a.fadeRate = 0;
      } else if (a.fadeRate < 0) {
        a.alpha += a.fadeRate * dt;
        if (a.alpha <= 0) {
          this.release(a, i);
          continue;
        }
      }
      a.squash = Math.max(0, a.squash - dt * 5);
      if (a.jump > 0) {
        a.jump += dt * 2.2;
        if (a.jump >= 1) {
          a.jump = 0;
          a.squash = 0.8;
          a.z = 0;
        } else a.z = Math.sin(a.jump * Math.PI) * 13;
      }

      let desVX = 0;
      let desVY = 0;
      let moving = false;
      let wagT = 0.3;
      let wagF = 13;
      let acc = 7;
      const ds = depthScale(L, a.y);

      switch (a.state) {
        case St.Run: {
          a.rt += dt / a.rdur;
          const t = Math.min(1, a.rt);
          const e = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
          const u = 1 - e;
          const nx = u * u * a.x0 + 2 * u * e * a.cx + e * e * a.x1;
          const ny = u * u * a.y0 + 2 * u * e * a.cy + e * e * a.y1;
          a.vx = (nx - a.x) / Math.max(dt, 1e-4);
          a.vy = (ny - a.y) / Math.max(dt, 1e-4);
          a.x = nx;
          a.y = ny;
          a.hopPhase += dt * 17;
          a.z = Math.abs(Math.sin(a.hopPhase)) * 2.8;
          a.alpha = Math.min(1, a.alpha);
          if (a.vx > 6) a.face = 1;
          else if (a.vx < -6) a.face = -1;
          a.faceS += (a.face - a.faceS) * Math.min(1, dt * 16);
          if (a.rt >= 1) {
            a.z = 0;
            a.squash = 1;
            env.particles.dust(a.x, a.y + 1, 2, 8);
            if (this.wanderers < env.target) {
              this.runners--;
              this.wanderers++;
              a.state = St.Wander;
              a.t = 0;
              a.vx *= 0.3;
              a.vy *= 0.3;
              this.pickTarget(a, env, true);
            } else {
              this.runners--;
              a.state = St.Enter;
              a.fadeRate = -4.2;
              a.t = 0;
            }
          }
          this.animate(a, dt, 'run', 24, 0.2, 19);
          continue;
        }
        case St.Enter: {
          a.y -= dt * 4;
          a.x += a.vx * dt * 0.1;
          this.animate(a, dt, 'run', 24, 0.1, 19);
          continue;
        }
        case St.Leave: {
          moving = false;
          break;
        }
        case St.Wander: {
          const dx = a.tx - a.x;
          const dy = a.ty - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 3) {
            this.choose(a, env);
            break;
          }
          const sp = 27 * a.speedMul * ds * (1 + 3.4 * zoom) * clamp(dist / 28, 0.35, 1);
          desVX = (dx / dist) * sp;
          desVY = (dy / dist) * sp * 0.7;
          moving = true;
          wagF = 11;
          wagT = zoom > 0.02 ? 0.2 : 0.3;
          break;
        }
        case St.Sniff: {
          desVX = a.face * 5;
          wagT = 0.5;
          wagF = 26;
          if (a.t > a.dur) this.choose(a, env);
          break;
        }
        case St.Dig: {
          wagT = 0.42;
          wagF = 18;
          a.digT -= dt;
          if (a.digT <= 0) {
            a.digT = 0.1;
            env.particles.dirt(a.x + a.face * 14 * ds, a.y - 1, a.face);
          }
          if (a.t > a.dur) {
            env.findPop(a.x + a.face * 15 * ds, a.y - 14 * ds);
            env.mound(a.x + a.face * 14 * ds, a.y + 1);
            this.choose(a, env);
          }
          break;
        }
        case St.Sit: {
          wagT = 0.45;
          wagF = 9;
          if (a.t > a.dur) this.choose(a, env);
          break;
        }
        case St.Nap: {
          wagT = 0.05;
          wagF = 3;
          a.sfx -= dt;
          if (a.sfx <= 0) {
            a.sfx = 1e9;
            env.particles.z(a.x + a.face * 9 * ds, a.y - 17 * ds, a.face);
          }
          if (a.t > a.dur) this.choose(a, env);
          break;
        }
        case St.Play: {
          const b = a.partner;
          if (!b || b.state !== St.Play || b.partner !== a || a.t > a.dur) {
            a.partner = null;
            this.choose(a, env);
            break;
          }
          if (a.leader) {
            const dx = a.tx - a.x;
            const dy = a.ty - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 8) {
              a.tx = clamp(a.x + (Math.random() - 0.5) * 150, 18, L.w - 18);
              a.ty = clamp(a.y + (Math.random() - 0.5) * 80, L.kennelBase + 16, L.lawnBottom);
            } else {
              const sp = 78 * ds * (1 + 1.6 * zoom);
              desVX = (dx / dist) * sp;
              desVY = (dy / dist) * sp * 0.75;
              moving = true;
            }
          } else {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 14) {
              const sp = 84 * ds * (1 + 1.6 * zoom) * clamp(dist / 40, 0.3, 1);
              desVX = (dx / dist) * sp;
              desVY = (dy / dist) * sp * 0.75;
              moving = true;
            }
            a.sfx = 0;
          }
          wagT = 0.5;
          wagF = 20;
          acc = 9;
          break;
        }
      }

      // velocity easing (never snaps)
      const k = 1 - Math.exp(-dt * (moving ? acc : 9));
      a.vx += (desVX - a.vx) * k;
      a.vy += (desVY - a.vy) * k;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.x = clamp(a.x, 8, L.w - 8);
      a.y = clamp(a.y, L.kennelBase + 4, L.lawnBottom + 6);
      const sp2 = Math.hypot(a.vx, a.vy);
      if (a.state === St.Wander || a.state === St.Play || a.state === St.Sniff) {
        if (a.vx > 2.5) a.face = 1;
        else if (a.vx < -2.5) a.face = -1;
      }
      a.faceS += (a.face - a.faceS) * Math.min(1, dt * 15);

      let pose: Pose = 'walk';
      let stride = 17;
      switch (a.state) {
        case St.Sniff:
          pose = 'sniff';
          break;
        case St.Dig:
          pose = 'dig';
          break;
        case St.Sit:
          pose = 'sit';
          break;
        case St.Nap:
          pose = 'nap';
          break;
        default:
          if ((zoom > 0.02 || a.state === St.Play) && sp2 > 22) {
            pose = 'run';
            stride = 26;
          }
      }
      this.animate(a, dt, pose, stride, wagT, wagF, sp2);
    }
    this.separate(dt);
  }

  /** soft separation so wanderers do not stack on top of each other */
  private separate(dt: number): void {
    const list = this.actors;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (a.state === St.Run || a.state === St.Enter) continue;
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        if (b.state === St.Run || b.state === St.Enter) continue;
        const dx = a.x - b.x;
        if (dx > 26 || dx < -26) continue;
        const dy = (a.y - b.y) * 2.2;
        const d2 = dx * dx + dy * dy;
        if (d2 > 676 || d2 < 0.01) continue;
        const d = Math.sqrt(d2);
        const push = ((26 - d) / 26) * 60 * dt;
        const nx = dx / d;
        const ny = dy / d;
        const am = a.state === St.Wander || a.state === St.Play || a.state === St.Sniff;
        const bm = b.state === St.Wander || b.state === St.Play || b.state === St.Sniff;
        const wa = am ? (bm ? 0.5 : 1) : 0;
        const wb = bm ? (am ? 0.5 : 1) : 0;
        a.vx += nx * push * wa;
        a.vy += (ny * push * wa) / 2.2;
        b.vx -= nx * push * wb;
        b.vy -= (ny * push * wb) / 2.2;
      }
    }
  }

  private animate(a: PupActor, dt: number, pose: Pose, stride: number, wagT: number, wagF: number, sp = Math.hypot(a.vx, a.vy)): void {
    a.pose = pose;
    const n = POSE_FRAMES[pose];
    if (pose === 'walk' || pose === 'run') {
      if (sp > 3) a.phase += (sp * dt) / stride;
      if (sp <= 3) {
        // ease back to the neutral standing frame (phase 0)
        const f = a.phase % 1;
        const target = f > 0.5 ? 1 : 0;
        a.phase += (target - f) * Math.min(1, dt * 10);
      }
      a.frame = Math.floor((a.phase % 1) * n) % n;
      if (a.frame < 0) a.frame += n;
    } else if (pose === 'dig') {
      a.frame = Math.floor(a.t * 6) % 2;
    } else a.frame = 0;
    a.wagAmp += (wagT - a.wagAmp) * Math.min(1, dt * 6);
    a.wag += wagF * dt;
  }

  private release(a: PupActor, idx: number): void {
    if (a.partner) {
      a.partner.partner = null;
      a.partner = null;
    }
    if (a.state === St.Run || a.state === St.Enter) {
      if (a.state === St.Run) this.runners--;
    } else this.wanderers--;
    a.active = false;
    this.actors[idx] = this.actors[this.actors.length - 1];
    this.actors.pop();
  }

  /** gently retire excess wanderers */
  trim(env: SimEnv): void {
    if (this.wanderers <= env.target) return;
    for (const a of this.actors) {
      if (this.wanderers <= env.target) break;
      if (a.state !== St.Run && a.state !== St.Leave && a.state !== St.Enter) {
        if (a.partner) {
          a.partner.partner = null;
          a.partner = null;
        }
        a.state = St.Leave;
        a.fadeRate = -2.2;
        this.wanderers--;
      }
    }
  }

  clear(): void {
    for (const a of this.actors) a.active = false;
    this.actors.length = 0;
    this.wanderers = 0;
    this.runners = 0;
  }

  // ------------------------------------------------------------------ rendering

  sortForDraw(): PupActor[] {
    const d = this.draw;
    d.length = 0;
    for (const a of this.actors) d.push(a);
    d.sort(byY);
    return d;
  }
}

function byY(a: PupActor, b: PupActor): number {
  return a.y - b.y;
}

export function getDogSprite(cache: SpriteCache, breed: number, pose: Pose, frame: number, pup: boolean): Sprite | null {
  const got = cache.getOrNull(dogKey(breed, pose, frame, pup), DOG_W, DOG_H, (ctx) => drawDogFrame(ctx, BREEDS[breed], pose, frame, pup), 2.5);
  if (got) return got;
  // over this frame's bake budget: show the standing frame (baked first by the warm-up) meanwhile
  const fb = cache.peek(dogKey(breed, 'walk', 0, pup));
  if (fb) cache.touch(fb);
  return fb ?? null;
}

export function getTailSprite(cache: SpriteCache, breed: number, pup: boolean): Sprite | null {
  return cache.getOrNull(tailKey(breed, pup), TAIL_W, TAIL_W, (ctx) => drawTail(ctx, BREEDS[breed], pup), 4);
}

export function getShadowSprite(cache: SpriteCache): Sprite {
  // crisp contact shadow: a flat ellipse with a 1px soft edge
  return cache.get('shadow:dog', SHADOW_W, SHADOW_H, (ctx) => {
    ctx.save();
    ctx.translate(SHADOW_W / 2, SHADOW_H / 2);
    ctx.scale(1, (SHADOW_H / 2 - 1) / (SHADOW_W / 2 - 1));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, SHADOW_W / 2 - 1);
    g.addColorStop(0, 'rgba(28,20,52,0.30)');
    g.addColorStop(0.86, 'rgba(28,20,52,0.26)');
    g.addColorStop(1, 'rgba(28,20,52,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, SHADOW_W / 2 - 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
}

/** contact shadow pass (drawn for every actor before any actor body, so bodies never get shadowed by neighbours) */
export function drawPupShadow(ctx: CanvasRenderingContext2D, dpr: number, cache: SpriteCache, L: Layout, a: PupActor): void {
  const sh = getShadowSprite(cache);
  const ds = depthScale(L, a.y);
  const b = BREEDS[a.breed];
  const sz = b.size * (a.puppy ? 0.74 : 1);
  const len = (b.bodyL + b.bodyH + b.headR + b.snoutL * 0.6 + 1) * DOG_K * sz;
  const lift = clamp(1 - a.z / 40, 0.55, 1);
  const w = len * ds * lift * a.scale;
  const h = w * (SHADOW_H / SHADOW_W) * (a.state === St.Nap ? 1.2 : 1) * 0.9;
  const al = a.alpha * (a.state === St.Nap ? 1 : 1);
  if (al < 0.99) ctx.globalAlpha = al;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(sh.c, a.x - w / 2 + 2.5 * ds, a.y - h * 0.5 + 0.5, w, h);
  if (al < 0.99) ctx.globalAlpha = 1;
}

export function drawPup(ctx: CanvasRenderingContext2D, dpr: number, cache: SpriteCache, L: Layout, a: PupActor, wobble: number): void {
  void wobble;
  const ds = depthScale(L, a.y);
  const sprite = getDogSprite(cache, a.breed, a.pose, a.frame, a.puppy);
  if (!sprite) return;
  const s = ds * a.scale;
  const sq = a.squash;
  // sleepers breathe: a slow, tiny squash/stretch
  const br = a.state === St.Nap ? Math.sin(a.t * 2.4 + a.phase * 6) * 0.022 : 0;
  const sx = s * (1 + 0.07 * sq - br) * Math.max(0.05, Math.abs(a.faceS));
  const sy = s * (1 - 0.1 * sq + br * 1.4);
  const flip = a.faceS >= 0 ? 1 : -1;
  const al = a.alpha;
  if (al < 0.99) ctx.globalAlpha = al < 0 ? 0 : al;
  const bx = a.x;
  const by = a.y - a.z * s;
  // live tail wag (separate cached sprite)
  const ti = tailAnch(a.breed, a.pose, a.frame, a.puppy);
  const tail = getTailSprite(cache, a.breed, a.puppy);
  if (tail && !TA_H[ti]) {
    const ang = TA_R[ti] + Math.sin(a.wag) * a.wagAmp;
    const tx = bx + TA_X[ti] * sx * flip;
    const ty = by + TA_Y[ti] * sy;
    ctx.setTransform(dpr * sx * flip, 0, 0, dpr * sy, dpr * tx, dpr * ty);
    ctx.rotate(ang);
    ctx.drawImage(tail.c, -TAIL_AX, -TAIL_AY, tail.w, tail.h);
  }
  // body frame
  blit(ctx, dpr, sprite, bx, by, DOG_AX, DOG_AY, sx, sy, flip);
  if (al < 0.99) ctx.globalAlpha = 1;
}
