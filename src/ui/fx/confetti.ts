// Canvas confetti overlay. ~120 pooled particles, gravity + spin, ~1.5s. No allocation in the hot loop.
import { confettiColors } from '../theme';
import { reducedMotion } from '../motion';

const N = 120;
const LIFE = 1.6;

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  age: number;
  life: number;
  color: number;
  shape: number;
  active: boolean;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let pool: P[] = [];
let raf = 0;
let last = 0;
let dpr = 1;
let w = 0;
let h = 0;

function ensure(): boolean {
  if (!canvas || !canvas.isConnected) {
    canvas = document.createElement('canvas');
    canvas.className = 'fx-confetti';
    const layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.style.zIndex = '300';
    layer.appendChild(canvas);
    document.body.appendChild(layer);
    ctx = canvas.getContext('2d');
  }
  if (!ctx) return false;
  if (!pool.length) {
    pool = Array.from({ length: N }, () => ({ x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, w: 0, h: 0, age: 0, life: 0, color: 0, shape: 0, active: false }));
  }
  const nd = Math.min(2, window.devicePixelRatio || 1);
  const nw = window.innerWidth;
  const nh = window.innerHeight;
  if (nd !== dpr || nw !== w || nh !== h || canvas.width !== Math.round(nw * nd)) {
    dpr = nd;
    w = nw;
    h = nh;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  return true;
}

export interface ConfettiOpts {
  /** origin in CSS px; defaults to upper-middle of the viewport */
  x?: number;
  y?: number;
  count?: number;
  /** launch speed multiplier */
  power?: number;
}

/** Fire a confetti burst. Safe to call repeatedly; reuses a fixed particle pool. */
export function confetti(opts: ConfettiOpts = {}): void {
  if (reducedMotion() || !ensure()) return;
  const x = opts.x ?? w / 2;
  const y = opts.y ?? h * 0.35;
  const count = Math.min(N, opts.count ?? N);
  const power = opts.power ?? 1;
  let spawned = 0;
  for (const p of pool) {
    if (spawned >= count) break;
    if (p.active) continue;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
    const sp = (260 + Math.random() * 420) * power;
    p.x = x + (Math.random() - 0.5) * 30;
    p.y = y;
    p.vx = Math.cos(ang) * sp;
    p.vy = Math.sin(ang) * sp;
    p.rot = Math.random() * Math.PI * 2;
    p.vr = (Math.random() - 0.5) * 18;
    p.w = 6 + Math.random() * 6;
    p.h = 4 + Math.random() * 5;
    p.age = 0;
    p.life = LIFE * (0.75 + Math.random() * 0.35);
    p.color = (Math.random() * confettiColors.length) | 0;
    p.shape = (Math.random() * 3) | 0;
    p.active = true;
    spawned++;
  }
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

function loop(t: number): void {
  raf = 0;
  if (!ctx || !canvas) return;
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let alive = 0;
  for (const p of pool) {
    if (!p.active) continue;
    p.age += dt;
    if (p.age >= p.life || p.y > h + 30) {
      p.active = false;
      continue;
    }
    alive++;
    p.vy += 900 * dt;
    p.vx *= 1 - 1.6 * dt;
    p.vy *= 1 - 0.6 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const k = p.age / p.life;
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    ctx.fillStyle = confettiColors[p.color];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // flutter: squash on one axis with the rotation
    const flip = Math.cos(p.rot * 2);
    ctx.scale(1, 0.35 + Math.abs(flip) * 0.65);
    if (p.shape === 0) ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    else if (p.shape === 1) {
      ctx.beginPath();
      ctx.arc(0, 0, p.w / 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -p.h);
      ctx.lineTo(p.w / 2, p.h / 2);
      ctx.lineTo(-p.w / 2, p.h / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (alive > 0) raf = requestAnimationFrame(loop);
  else ctx.clearRect(0, 0, w, h);
}
