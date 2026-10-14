// Pooled particle system: dirt, dust, sparkles, confetti, z's, paw prints, smoke, rings, fireflies.
// Fixed-size pool, no allocation after construction. Drawn with plain fills (no filters / blur).
import { star4 } from './shade';

export const enum K {
  Dirt,
  Dust,
  Sparkle,
  Confetti,
  Z,
  Paw,
  Smoke,
  Ring,
  Firefly,
  Heart,
}

const CONFETTI = ['#ef5a47', '#ffcb3d', '#4aa8ff', '#45c766', '#8e6be8', '#ff8fc0'];
const DIRT = ['#9c6a3c', '#b8844c', '#7a4f2a', '#c9985e'];

interface Pt {
  on: boolean;
  k: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  g: number;
  c: number;
}

export class Particles {
  private p: Pt[] = [];
  private cursor = 0;
  active = 0;
  constructor(private cap = 520) {
    for (let i = 0; i < cap; i++) this.p.push({ on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1, rot: 0, vr: 0, g: 0, c: 0 });
  }

  private spawn(k: number, x: number, y: number, vx: number, vy: number, life: number, size: number, g = 0, c = 0): Pt {
    // find a free slot starting at the cursor; otherwise overwrite the cursor slot
    let q: Pt | null = null;
    for (let i = 0; i < 24; i++) {
      const t = this.p[(this.cursor + i) % this.cap];
      if (!t.on) {
        q = t;
        this.cursor = (this.cursor + i + 1) % this.cap;
        break;
      }
    }
    if (!q) {
      q = this.p[this.cursor];
      this.cursor = (this.cursor + 1) % this.cap;
    } else this.active++;
    q.on = true;
    q.k = k;
    q.x = x;
    q.y = y;
    q.vx = vx;
    q.vy = vy;
    q.age = 0;
    q.life = life;
    q.size = size;
    q.rot = 0;
    q.vr = 0;
    q.g = g;
    q.c = c;
    return q;
  }

  dirt(x: number, y: number, dir: number): void {
    for (let i = 0; i < 2; i++) {
      this.spawn(K.Dirt, x, y, -dir * (24 + Math.random() * 40), -(40 + Math.random() * 44), 0.5 + Math.random() * 0.25, 1.3 + Math.random() * 1.4, 220, (Math.random() * DIRT.length) | 0);
    }
  }
  dust(x: number, y: number, n = 1, spread = 10): void {
    for (let i = 0; i < n; i++) {
      this.spawn(K.Dust, x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 22, -6 - Math.random() * 10, 0.45 + Math.random() * 0.3, 3 + Math.random() * 2.4);
    }
  }
  ring(x: number, y: number, size = 20): void {
    this.spawn(K.Ring, x, y, 0, 0, 0.5, size);
  }
  sparkle(x: number, y: number, n = 1, spread = 8, size = 4): void {
    for (let i = 0; i < n; i++) {
      const q = this.spawn(K.Sparkle, x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * 14, -10 - Math.random() * 14, 0.5 + Math.random() * 0.4, size * (0.7 + Math.random() * 0.6));
      q.vr = (Math.random() - 0.5) * 5;
    }
  }
  confetti(x: number, y: number, n = 16): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 70 + Math.random() * 110;
      const q = this.spawn(K.Confetti, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 1.0 + Math.random() * 0.6, 2.4 + Math.random() * 2, 260, (Math.random() * CONFETTI.length) | 0);
      q.rot = Math.random() * 6;
      q.vr = (Math.random() - 0.5) * 16;
    }
  }
  /** a small sleepy z that drifts up (away from the dog's facing side) and fades */
  z(x: number, y: number, dir = 1): void {
    this.spawn(K.Z, x, y, dir * (2.5 + Math.random() * 1.5), -7.5 - Math.random() * 2, 2.4, 2.5 + Math.random() * 0.4);
  }
  paw(x: number, y: number): void {
    const a = Math.random() * Math.PI * 2;
    const q = this.spawn(K.Paw, x, y, Math.cos(a) * 34, Math.sin(a) * 18 - 22, 0.75, 3.2);
    q.rot = a;
  }
  smoke(x: number, y: number): void {
    this.spawn(K.Smoke, x, y, 4 + Math.random() * 3, -11 - Math.random() * 5, 2.0 + Math.random() * 0.5, 3 + Math.random() * 1.5);
  }
  firefly(x: number, y: number): void {
    const q = this.spawn(K.Firefly, x, y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, 4 + Math.random() * 3, 1.5 + Math.random());
    q.rot = Math.random() * 6;
  }
  heart(x: number, y: number): void {
    this.spawn(K.Heart, x, y, (Math.random() - 0.5) * 8, -20, 1.1, 3.4);
  }

  update(dt: number): void {
    for (let i = 0; i < this.cap; i++) {
      const q = this.p[i];
      if (!q.on) continue;
      q.age += dt;
      if (q.age >= q.life) {
        q.on = false;
        this.active--;
        continue;
      }
      if (q.k === K.Firefly) {
        q.rot += dt * 2;
        q.vx += Math.cos(q.rot * 1.7 + i) * 18 * dt;
        q.vy += Math.sin(q.rot * 1.3 + i * 2) * 14 * dt;
        q.vx *= 0.97;
        q.vy *= 0.97;
      } else if (q.k === K.Dust || q.k === K.Smoke) {
        q.vx *= 1 - 1.6 * dt;
        q.vy *= 1 - 1.2 * dt;
      } else q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, dpr: number): void {
    if (this.active <= 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < this.cap; i++) {
      const q = this.p[i];
      if (!q.on) continue;
      const u = q.age / q.life;
      switch (q.k) {
        case K.Dirt:
          ctx.globalAlpha = 1 - u * u;
          ctx.fillStyle = DIRT[q.c];
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size, 0, 6.2832);
          ctx.fill();
          break;
        case K.Dust: {
          ctx.globalAlpha = (1 - u) * 0.55;
          ctx.fillStyle = '#f6ead2';
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size * (0.6 + u * 1.6), 0, 6.2832);
          ctx.fill();
          break;
        }
        case K.Smoke: {
          ctx.globalAlpha = (1 - u) * 0.5 * Math.min(1, u * 8);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size * (0.7 + u * 2.4), 0, 6.2832);
          ctx.fill();
          break;
        }
        case K.Ring: {
          const e = 1 - (1 - u) * (1 - u);
          ctx.globalAlpha = (1 - u) * 0.8;
          ctx.strokeStyle = '#fff6e0';
          ctx.lineWidth = 2.4 * (1 - u) + 0.6;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, q.size * (0.3 + e * 1.4), q.size * (0.3 + e * 1.4) * 0.38, 0, 0, 6.2832);
          ctx.stroke();
          break;
        }
        case K.Sparkle: {
          ctx.globalAlpha = Math.min(1, (1 - u) * 1.6);
          const s = q.size * (0.5 + 0.5 * Math.sin(Math.min(1, u * 1.4) * Math.PI));
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.fillStyle = '#fff3a8';
          ctx.beginPath();
          star4(ctx, 0, 0, s);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          star4(ctx, 0, 0, s * 0.5);
          ctx.fill();
          ctx.restore();
          break;
        }
        case K.Confetti: {
          ctx.globalAlpha = Math.min(1, (1 - u) * 2.2);
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.fillStyle = CONFETTI[q.c];
          const sq = Math.abs(Math.cos(q.rot * 1.6)) * 0.8 + 0.2;
          ctx.fillRect(-q.size, -q.size * 0.5 * sq, q.size * 2, q.size * sq);
          ctx.restore();
          break;
        }
        case K.Z: {
          // fade in quickly, then fade away while rising; grows a touch
          ctx.globalAlpha = Math.min(1, u * 7) * (1 - u) * (1 - u) * 1.15;
          const s = q.size * (0.75 + u * 0.55);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(q.x - s, q.y - s);
          ctx.lineTo(q.x + s, q.y - s);
          ctx.lineTo(q.x - s, q.y + s);
          ctx.lineTo(q.x + s, q.y + s);
          ctx.strokeStyle = 'rgba(60,80,150,0.85)';
          ctx.lineWidth = 2.4;
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.1;
          ctx.stroke();
          break;
        }
        case K.Paw: {
          ctx.globalAlpha = (1 - u) * 0.9;
          ctx.fillStyle = '#fff6e0';
          const s = q.size * (0.7 + u * 0.5);
          ctx.beginPath();
          ctx.ellipse(q.x, q.y + s * 0.3, s * 0.55, s * 0.45, 0, 0, 6.2832);
          ctx.fill();
          for (let t = 0; t < 4; t++) {
            const a = -2.5 + t * 0.55;
            ctx.beginPath();
            ctx.ellipse(q.x + Math.cos(a) * s * 0.8, q.y + Math.sin(a) * s * 0.8, s * 0.22, s * 0.28, 0, 0, 6.2832);
            ctx.fill();
          }
          break;
        }
        case K.Firefly: {
          const tw = 0.5 + 0.5 * Math.sin(q.age * 5 + i);
          ctx.globalAlpha = Math.min(1, u * 4, (1 - u) * 4) * (0.35 + 0.65 * tw);
          ctx.fillStyle = '#fff3a0';
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size * 2.6, 0, 6.2832);
          ctx.globalAlpha *= 0.28;
          ctx.fill();
          ctx.globalAlpha = Math.min(1, u * 4, (1 - u) * 4) * (0.5 + 0.5 * tw);
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size * 0.8, 0, 6.2832);
          ctx.fillStyle = '#ffffe0';
          ctx.fill();
          break;
        }
        case K.Heart: {
          ctx.globalAlpha = (1 - u) * Math.min(1, u * 6);
          ctx.fillStyle = '#ff6f91';
          const s = q.size;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y + s * 0.9);
          ctx.bezierCurveTo(q.x - s * 1.6, q.y - s * 0.2, q.x - s * 0.6, q.y - s * 1.2, q.x, q.y - s * 0.3);
          ctx.bezierCurveTo(q.x + s * 0.6, q.y - s * 1.2, q.x + s * 1.6, q.y - s * 0.2, q.x, q.y + s * 0.9);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
