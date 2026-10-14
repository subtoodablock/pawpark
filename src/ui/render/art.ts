// Rendered game-object art for the DOM UI and the canvas scene (docs/12-art-direction-v2.md section 5).
// Every export returns a cached PNG data URL drawn procedurally on a canvas, DPR-aware (px * min(2, dpr)),
// safe to call before the scene exists and in headless contexts ('' when no canvas is available).
// Lighting follows docs/07 section 2: the light comes from the top-left.
import { ACADEMY, PREMIUM_SHOP, TRAINING } from '../../core';
import { BLD_H, BLD_W, KENNEL_COUNT, drawKennelBody } from './buildings';
import { rng, lighten, darken, star4 } from './shade';
import { VEHICLE_SPECS, VEH_AX, VEH_AY, VEH_H, VEH_W, drawSwirl, drawVehicle, drawWheel } from './vehicles';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const cache = new Map<string, string>();

function dprScale(): number {
  try {
    return Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  } catch {
    return 1;
  }
}

function newCanvas(w: number, h: number): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w));
    cv.height = Math.max(1, Math.round(h));
    return cv;
  } catch {
    return null;
  }
}

/** Render a 100 x 100 logical drawing to a square PNG data URL (cached). */
function render(key: string, px: number, draw: (ctx: C) => void): string {
  const sc = dprScale();
  const n = Math.max(8, Math.round((Number.isFinite(px) && px > 0 ? px : 48) * sc));
  const k = `${key}|${n}`;
  const hit = cache.get(k);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const cv = newCanvas(n, n);
    const ctx = cv ? (cv.getContext('2d') as C | null) : null;
    if (cv && ctx) {
      ctx.scale(n / 100, n / 100);
      draw(ctx);
      url = cv.toDataURL('image/png');
    }
  } catch {
    url = '';
  }
  if (url) cache.set(k, url);
  return url;
}

// ------------------------------------------------------------------ shared helpers

type Mx = { a: number; b: number; c: number; d: number; e: number; f: number };
const T = (e: number, f: number, rot = 0, s = 1): Mx => ({ a: Math.cos(rot) * s, b: Math.sin(rot) * s, c: -Math.sin(rot) * s, d: Math.cos(rot) * s, e, f });

function ellP(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  return p;
}

function rrP(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y);
  p.arcTo(x + w, y, x + w, y + h, rr);
  p.arcTo(x + w, y + h, x, y + h, rr);
  p.arcTo(x, y + h, x, y, rr);
  p.arcTo(x, y, x + w, y, rr);
  p.closePath();
  return p;
}

/** smooth closed blob through points */
function blobP(pts: [number, number][]): Path2D {
  const p = new Path2D();
  const n = pts.length;
  p.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  p.closePath();
  return p;
}

function rockPts(cx: number, cy: number, r: number, n: number, seed: number, wob = 0.14, sx = 1, sy = 1): [number, number][] {
  const rnd = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 - wob + rnd() * wob * 2);
    pts.push([cx + Math.cos(a) * rr * sx, cy + Math.sin(a) * rr * sy]);
  }
  return pts;
}

/** soft ground shadow */
function groundShadow(ctx: C, cx: number, cy: number, rx: number, ry: number, a = 0.24): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(30,18,50,${a})`);
  g.addColorStop(0.6, `rgba(30,18,50,${a * 0.6})`);
  g.addColorStop(1, 'rgba(30,18,50,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

let tmpCv: HTMLCanvasElement | null = null;

/** paints `color` over the part of `path` that is NOT covered by `path` shifted by (dx, dy), clipped to `path` (works for self-overlapping paths) */
function band(ctx: C, path: Path2D, dx: number, dy: number, color: string): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  if (!tmpCv) tmpCv = newCanvas(W, H);
  const cv = tmpCv;
  const tc = cv ? (cv.getContext('2d') as C | null) : null;
  if (!cv || !tc) return;
  if (cv.width < W) cv.width = W;
  if (cv.height < H) cv.height = H;
  const m = ctx.getTransform();
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.globalCompositeOperation = 'source-over';
  tc.clearRect(0, 0, cv.width, cv.height);
  tc.fillStyle = color;
  tc.fillRect(0, 0, W, H);
  tc.globalCompositeOperation = 'destination-out';
  tc.setTransform(m);
  tc.translate(dx, dy);
  tc.fillStyle = '#000';
  tc.fill(path);
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.clip(path);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(cv, 0, 0, W, H, 0, 0, W, H);
  ctx.restore();
}

/** inner bevel: light band top-left, dark band bottom-right, clipped to the path */
function bevel(ctx: C, path: Path2D, d = 4, light = 0.5, dark = 0.32): void {
  for (let i = 1; i <= 3; i++) {
    const k = (i / 3) * d;
    const fall = 1 - (i - 1) / 3;
    band(ctx, path, -k, -k, `rgba(36,18,60,${(dark * fall) / 1.8})`);
    band(ctx, path, k, k, `rgba(255,255,255,${(light * fall) / 1.8})`);
  }
}

function spec(ctx: C, x: number, y: number, rx: number, ry: number, rot = -0.6, a = 0.85): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.55, `rgba(255,255,255,${a * 0.4})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function sparkle(ctx: C, x: number, y: number, r: number, col = '#ffffff', a = 0.95): void {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.beginPath();
  star4(ctx, x, y, r);
  ctx.fill();
  ctx.restore();
}

function lin(ctx: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function rad(ctx: C, x: number, y: number, r0: number, x1: number, y1: number, r1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** sphere-ish fill: light from the top-left */
function sphereFill(ctx: C, cx: number, cy: number, r: number, hi: string, mid: string, lo: string): CanvasGradient {
  return rad(ctx, cx - r * 0.38, cy - r * 0.42, r * 0.08, cx, cy, r * 1.08, [
    [0, hi],
    [0.5, mid],
    [1, lo],
  ]);
}

/** bone silhouette: shaft + four knobs, local space centred on the origin, pointing along +x */
function boneLocal(len: number, th: number): Path2D {
  const p = new Path2D();
  const sh = th * 0.58;
  const kr = th * 0.35;
  p.addPath(rrP(-len / 2 + kr, -sh / 2, len - kr * 2, sh, sh / 2));
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      p.addPath(ellP(sx * (len / 2 - kr * 0.95), sy * kr * 0.74, kr, kr));
    }
  }
  return p;
}
function boneP(cx: number, cy: number, len: number, th: number, rot: number): Path2D {
  const p = new Path2D();
  p.addPath(boneLocal(len, th), T(cx, cy, rot));
  return p;
}

function capsuleP(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): Path2D {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const th = Math.atan2(dy, dx);
  const phi = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / L)));
  const p = new Path2D();
  p.arc(x2, y2, r2, th - phi, th + phi, false);
  p.arc(x1, y1, r1, th + phi, th - phi + TAU, false);
  p.closePath();
  return p;
}

// ------------------------------------------------------------------ Finds (13 glossy 3D objects)

function drawStick(ctx: C): void {
  groundShadow(ctx, 50, 86, 34, 6, 0.22);
  const bark = (p: Path2D, x0: number, y0: number, x1: number, y1: number): void => {
    ctx.fillStyle = lin(ctx, x0, y0, x1, y1, [
      [0, '#c58a52'],
      [0.35, '#8e5a2f'],
      [1, '#4d2d15'],
    ]);
    ctx.fill(p);
  };
  // twigs behind
  const tw1 = capsuleP(44, 56, 2.2, 60, 72, 1.4);
  bark(tw1, 40, 52, 60, 72);
  const tw2 = capsuleP(58, 38, 2.2, 74, 30, 1.2);
  bark(tw2, 56, 34, 76, 30);
  const main = capsuleP(20, 80, 5.2, 80, 22, 4.2);
  bark(main, 14, 70, 86, 30);
  // bark rings + knots
  ctx.save();
  ctx.clip(main);
  ctx.strokeStyle = 'rgba(52,28,12,0.5)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const t = 0.1 + i * 0.1;
    const x = 20 + 60 * t;
    const y = 80 - 58 * t;
    ctx.beginPath();
    ctx.moveTo(x - 4.6, y - 4.8 + (i % 2));
    ctx.quadraticCurveTo(x + 0.5, y + 1.4, x + 4.4, y + 4.5 - (i % 3) * 0.6);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(52,28,12,0.55)';
  ctx.beginPath();
  ctx.ellipse(44, 57, 2.2, 1.5, -0.8, 0, TAU);
  ctx.ellipse(62, 40, 1.9, 1.3, -0.8, 0, TAU);
  ctx.fill();
  ctx.restore();
  bevel(ctx, main, 2.6, 0.4, 0.3);
  // light stripe along the lit edge
  ctx.save();
  ctx.clip(main);
  ctx.strokeStyle = 'rgba(255,226,180,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(25, 73);
  ctx.lineTo(76, 24.5);
  ctx.stroke();
  ctx.restore();
  // cut end with rings
  ctx.fillStyle = '#e9c590';
  ctx.beginPath();
  ctx.ellipse(20, 80, 5.4, 4.0, -0.78, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#b8884e';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(20, 80, 3.2, 2.3, -0.78, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(20, 80, 1.1, 0.8, -0.78, 0, TAU);
  ctx.stroke();
  // tiny leaf
  ctx.fillStyle = '#6bbb4a';
  ctx.beginPath();
  ctx.moveTo(72, 31);
  ctx.quadraticCurveTo(80, 18, 90, 20);
  ctx.quadraticCurveTo(86, 30, 72, 31);
  ctx.fill();
  ctx.strokeStyle = '#3f8a2c';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(73, 30);
  ctx.lineTo(86, 22);
  ctx.stroke();
}

function drawTennis(ctx: C): void {
  groundShadow(ctx, 52, 87, 30, 6, 0.24);
  const cx = 50;
  const cy = 49;
  const r = 35;
  const body = ellP(cx, cy, r, r);
  ctx.fillStyle = sphereFill(ctx, cx, cy, r, '#f6fb78', '#cfe41c', '#7c960c');
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // felt texture
  const rnd = rng(9);
  for (let i = 0; i < 420; i++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * r;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,230,0.20)' : 'rgba(70,90,0,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + rnd() * 0.5, 0, TAU);
    ctx.fill();
  }
  // seam
  const seam = (dx: number, dy: number, col: string, w: number): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18 + dx, 24 + dy);
    ctx.bezierCurveTo(46 + dx, 36 + dy, 47 + dx, 64 + dy, 15 + dx, 78 + dy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(86 + dx, 22 + dy);
    ctx.bezierCurveTo(58 + dx, 36 + dy, 57 + dx, 62 + dy, 88 + dx, 76 + dy);
    ctx.stroke();
  };
  seam(0.9, 1.6, 'rgba(70,90,0,0.35)', 5);
  seam(0, 0, '#fbfdf0', 4.2);
  seam(-0.5, -0.6, 'rgba(255,255,255,0.55)', 1.2);
  ctx.restore();
  bevel(ctx, body, 6, 0.28, 0.38);
  spec(ctx, 35, 30, 14, 8, -0.7, 0.8);
}

function drawSqueaky(ctx: C): void {
  groundShadow(ctx, 50, 87, 33, 6, 0.24);
  // tail + body
  const tail = new Path2D();
  tail.moveTo(18, 60);
  tail.quadraticCurveTo(10, 50, 8, 46);
  tail.quadraticCurveTo(20, 48, 26, 54);
  tail.closePath();
  const body = new Path2D();
  body.addPath(ellP(48, 64, 31, 22));
  body.addPath(tail);
  const head = ellP(66, 36, 15.5, 15.5);
  const beak = new Path2D();
  beak.moveTo(76, 36);
  beak.quadraticCurveTo(92, 34, 91, 42);
  beak.quadraticCurveTo(88, 48, 76, 45);
  beak.closePath();
  const yel = (p: Path2D, x0: number, y0: number, x1: number, y1: number): void => {
    ctx.fillStyle = lin(ctx, x0, y0, x1, y1, [
      [0, '#ffe45e'],
      [0.5, '#ffc928'],
      [1, '#d78d06'],
    ]);
    ctx.fill(p);
  };
  yel(body, 20, 40, 76, 88);
  ctx.fillStyle = lin(ctx, 80, 28, 92, 48, [
    [0, '#ffa63a'],
    [1, '#d9620f'],
  ]);
  ctx.fill(beak);
  bevel(ctx, beak, 2, 0.4, 0.3);
  yel(head, 52, 20, 82, 52);
  bevel(ctx, body, 5, 0.5, 0.34);
  bevel(ctx, head, 4, 0.5, 0.34);
  // wing
  const wing = new Path2D();
  wing.moveTo(30, 62);
  wing.quadraticCurveTo(42, 50, 58, 64);
  wing.quadraticCurveTo(46, 78, 30, 62);
  ctx.fillStyle = lin(ctx, 30, 52, 56, 76, [
    [0, '#f5b61c'],
    [1, '#c98305'],
  ]);
  ctx.fill(wing);
  // eye + cheek
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(69, 31, 2.4, 0, TAU);
  ctx.fill();
  spec(ctx, 36, 52, 15, 7, -0.5, 0.85);
  spec(ctx, 60, 27, 7, 4, -0.7, 0.8);
  sparkle(ctx, 24, 44, 3.2);
}

function drawRawhide(ctx: C): void {
  groundShadow(ctx, 50, 86, 34, 6.5, 0.22);
  const bone = boneP(50, 52, 76, 38, -0.6);
  ctx.fillStyle = lin(ctx, 22, 28, 78, 76, [
    [0, '#f7e6c2'],
    [0.5, '#dcbb86'],
    [1, '#a98253'],
  ]);
  ctx.fill(bone);
  ctx.save();
  ctx.clip(bone);
  // rawhide wrinkles
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(122,82,38,0.35)';
  ctx.lineWidth = 1.2;
  const rnd = rng(4);
  for (let i = 0; i < 16; i++) {
    const x = 18 + rnd() * 64;
    const y = 22 + rnd() * 58;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3, y - 2 + rnd() * 3, x + 6 + rnd() * 4, y + rnd() * 3);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,248,226,0.5)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 7; i++) {
    const x = 26 + rnd() * 48;
    const y = 28 + rnd() * 46;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 2, y - 3, x + 5, y - 2);
    ctx.stroke();
  }
  ctx.restore();
  bevel(ctx, bone, 4, 0.5, 0.34);
  spec(ctx, 30, 36, 11, 5, -0.8, 0.75);
  spec(ctx, 70, 66, 7, 3.5, -0.8, 0.5);
}

function drawWallet(ctx: C): void {
  groundShadow(ctx, 50, 83, 36, 6, 0.22);
  // bills peeking
  ctx.save();
  ctx.translate(50, 34);
  ctx.rotate(-0.1);
  const bill = rrP(-26, -12, 52, 22, 2);
  ctx.fillStyle = lin(ctx, -26, -12, 26, 10, [
    [0, '#a9dd9e'],
    [1, '#5fae60'],
  ]);
  ctx.fill(bill);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(0, -1, 6, 0, TAU);
  ctx.fill();
  ctx.restore();
  const body = rrP(14, 32, 72, 48, 9);
  ctx.fillStyle = lin(ctx, 14, 32, 86, 80, [
    [0, '#b0673a'],
    [0.5, '#86481f'],
    [1, '#55290f'],
  ]);
  ctx.fill(body);
  // grain
  ctx.save();
  ctx.clip(body);
  const rnd = rng(6);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,214,170,0.10)' : 'rgba(40,16,4,0.12)';
    ctx.beginPath();
    ctx.arc(14 + rnd() * 72, 32 + rnd() * 48, 0.6 + rnd() * 0.9, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  bevel(ctx, body, 4, 0.5, 0.34);
  // flap
  const flap = new Path2D();
  flap.moveTo(14, 41);
  flap.arcTo(14, 32, 23, 32, 9);
  flap.lineTo(77, 32);
  flap.arcTo(86, 32, 86, 41, 9);
  flap.lineTo(86, 48);
  flap.quadraticCurveTo(50, 62, 14, 48);
  flap.closePath();
  ctx.fillStyle = lin(ctx, 14, 32, 70, 62, [
    [0, '#c27a46'],
    [1, '#8f4f24'],
  ]);
  ctx.fill(flap);
  bevel(ctx, flap, 3, 0.45, 0.3);
  // stitching
  ctx.strokeStyle = 'rgba(244,214,150,0.9)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2.6, 2.2]);
  ctx.beginPath();
  ctx.moveTo(19, 76);
  ctx.lineTo(81, 76);
  ctx.moveTo(18, 70);
  ctx.lineTo(18, 40);
  ctx.moveTo(82, 70);
  ctx.lineTo(82, 40);
  ctx.stroke();
  ctx.setLineDash([]);
  // clasp
  ctx.fillStyle = sphereFill(ctx, 50, 55, 6, '#fff1a6', '#f1c232', '#a3730a');
  ctx.beginPath();
  ctx.arc(50, 55, 5.6, 0, TAU);
  ctx.fill();
  spec(ctx, 48, 53, 2.6, 1.6, -0.6, 0.9);
  spec(ctx, 32, 38, 14, 4.5, -0.15, 0.4);
}

function drawCoin(ctx: C): void {
  groundShadow(ctx, 52, 88, 30, 5.5, 0.22);
  ctx.save();
  ctx.translate(50, 49);
  ctx.rotate(-0.28);
  ctx.scale(0.94, 1);
  // edge thickness
  ctx.fillStyle = lin(ctx, 0, -30, 0, 38, [
    [0, '#c58c12'],
    [1, '#7a5006'],
  ]);
  ctx.beginPath();
  ctx.arc(3.4, 4.2, 36, 0, TAU);
  ctx.fill();
  const face = ellP(0, 0, 36, 36);
  ctx.fillStyle = rad(ctx, -12, -14, 3, 0, 0, 40, [
    [0, '#fff7b8'],
    [0.45, '#f6c93a'],
    [1, '#b9830a'],
  ]);
  ctx.fill(face);
  // rim ring
  ctx.strokeStyle = '#a97409';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 29.5, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,244,170,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(-0.7, -0.8, 31.5, 0, TAU);
  ctx.stroke();
  // notches
  ctx.strokeStyle = 'rgba(150,100,8,0.55)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 33.4, Math.sin(a) * 33.4);
    ctx.lineTo(Math.cos(a) * 35.2, Math.sin(a) * 35.2);
    ctx.stroke();
  }
  // embossed skull and bones
  const skull = (dx: number, dy: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-15 + dx, 12 + dy);
    ctx.lineTo(15 + dx, -4 + dy);
    ctx.moveTo(15 + dx, 12 + dy);
    ctx.lineTo(-15 + dx, -4 + dy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dx, -5 + dy, 9, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-5.5 + dx, 0 + dy, 11, 8.5, 2);
    ctx.fill();
  };
  skull(0.9, 1, '#fff0a0');
  skull(0, 0, '#a46f07');
  ctx.fillStyle = '#f5c43a';
  ctx.beginPath();
  ctx.ellipse(-3.6, -5.6, 2.2, 2.7, 0, 0, TAU);
  ctx.ellipse(3.6, -5.6, 2.2, 2.7, 0, 0, TAU);
  ctx.moveTo(0, -1.2);
  ctx.lineTo(1.5, 1.4);
  ctx.lineTo(-1.5, 1.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a46f07';
  for (const x of [-3, 0, 3]) ctx.fillRect(x - 0.4, 3.6, 0.8, 4);
  // glossy sweep
  ctx.save();
  ctx.clip(face);
  ctx.fillStyle = lin(ctx, -30, -30, 10, 10, [
    [0, 'rgba(255,255,255,0.55)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-40, -8);
  ctx.lineTo(-8, -40);
  ctx.lineTo(8, -40);
  ctx.lineTo(-40, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  sparkle(ctx, 72, 24, 4.4);
}

function drawAmber(ctx: C): void {
  groundShadow(ctx, 50, 87, 33, 6, 0.24);
  const rock = blobP(rockPts(50, 50, 36, 11, 21, 0.07, 1.0, 0.86));
  ctx.fillStyle = rad(ctx, 38, 36, 3, 50, 50, 46, [
    [0, '#ffe58f'],
    [0.45, '#f7b32a'],
    [1, '#b8610a'],
  ]);
  ctx.fill(rock);
  ctx.save();
  ctx.clip(rock);
  // inner glow
  const gl = rad(ctx, 56, 58, 2, 56, 58, 34, [
    [0, 'rgba(255,214,110,0.75)'],
    [1, 'rgba(255,214,110,0)'],
  ]);
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, 100, 100);
  // fossil: a tiny dino skeleton
  ctx.save();
  ctx.translate(50, 54);
  ctx.rotate(-0.12);
  ctx.strokeStyle = 'rgba(86,40,6,0.9)';
  ctx.fillStyle = 'rgba(86,40,6,0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-24, 6);
  ctx.quadraticCurveTo(-8, 10, 6, 0);
  ctx.quadraticCurveTo(16, -6, 22, -14);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const x = -14 + i * 6;
    const y = 8 - i * 1.8 - (i > 3 ? 1 : 0);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 2, y + 8, x - 5, y + 11);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(27, -17, 6, 4, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f9c55c';
  ctx.beginPath();
  ctx.arc(28.5, -18, 1.1, 0, TAU);
  ctx.fill();
  ctx.restore();
  // bubbles
  for (const [x, y, r] of [[32, 66, 2.6], [70, 36, 1.8], [64, 70, 1.4], [36, 38, 1.3]] as [number, number, number][]) {
    ctx.strokeStyle = 'rgba(255,240,190,0.9)';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  bevel(ctx, rock, 5, 0.45, 0.36);
  spec(ctx, 33, 30, 15, 7, -0.75, 0.85);
  spec(ctx, 72, 66, 9, 4, -0.75, 0.35);
}

function drawCrystal(ctx: C): void {
  groundShadow(ctx, 50, 87, 33, 6, 0.2);
  // glow
  ctx.fillStyle = rad(ctx, 50, 50, 8, 50, 50, 48, [
    [0, 'rgba(120,230,255,0.38)'],
    [1, 'rgba(120,230,255,0)'],
  ]);
  ctx.fillRect(0, 0, 100, 100);
  const bone = boneP(50, 50, 78, 40, -0.6);
  ctx.fillStyle = lin(ctx, 20, 24, 80, 78, [
    [0, '#d9fbff'],
    [0.45, '#69cdec'],
    [1, '#2b73c4'],
  ]);
  ctx.fill(bone);
  ctx.save();
  ctx.clip(bone);
  ctx.translate(50, 50);
  ctx.rotate(-0.6);
  // facets
  const xs = [-42, -31, -19, -7, 6, 18, 30, 42];
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.26)' : 'rgba(20,60,150,0.2)';
    ctx.beginPath();
    ctx.moveTo(x0, -22);
    ctx.lineTo(x1 + 4, -22);
    ctx.lineTo(x1 - 3, 22);
    ctx.lineTo(x0 - 4, 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = i % 2 ? 'rgba(20,60,150,0.15)' : 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(x0 + 2, -22);
    ctx.lineTo(x1 + 4, -22);
    ctx.lineTo(x0 + (x1 - x0) / 2, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < xs.length; i++) {
    ctx.beginPath();
    ctx.moveTo(xs[i] + 4, -22);
    ctx.lineTo(xs[i] - 4, 22);
    ctx.stroke();
  }
  ctx.restore();
  bevel(ctx, bone, 4, 0.55, 0.4);
  band(ctx, bone, 1.3, 1.3, 'rgba(255,255,255,0.8)');
  spec(ctx, 31, 36, 10, 4.2, -0.8, 0.85);
  sparkle(ctx, 24, 32, 4.4);
  sparkle(ctx, 76, 64, 3.6);
  sparkle(ctx, 62, 40, 2.4);
}

function drawMeteorite(ctx: C): void {
  groundShadow(ctx, 50, 87, 32, 6, 0.26);
  // ember aura
  ctx.fillStyle = rad(ctx, 50, 52, 10, 50, 52, 46, [
    [0, 'rgba(255,120,30,0.38)'],
    [1, 'rgba(255,120,30,0)'],
  ]);
  ctx.fillRect(0, 0, 100, 100);
  const rock = blobP(rockPts(50, 50, 35, 12, 33, 0.16, 1.05, 0.9));
  ctx.fillStyle = rad(ctx, 38, 34, 3, 50, 50, 48, [
    [0, '#9a8c85'],
    [0.5, '#4f433e'],
    [1, '#1f1715'],
  ]);
  ctx.fill(rock);
  ctx.save();
  ctx.clip(rock);
  // craters
  const rnd = rng(12);
  for (let i = 0; i < 7; i++) {
    const x = 24 + rnd() * 52;
    const y = 24 + rnd() * 50;
    const r = 3 + rnd() * 4.5;
    ctx.fillStyle = 'rgba(14,8,6,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, 0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,170,160,0.35)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(x + 0.4, y + 0.6, r, r * 0.8, 0.4, 0.2, Math.PI * 0.9);
    ctx.stroke();
  }
  // glowing cracks
  const cracks: [number, number][][] = [
    [[50, 52], [44, 42], [48, 32], [42, 22]],
    [[50, 52], [60, 58], [72, 54], [80, 62]],
    [[50, 52], [40, 62], [34, 74], [26, 78]],
    [[60, 58], [62, 70], [70, 78]],
  ];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, col] of [[6.5, 'rgba(255,80,0,0.32)'], [3, '#ff7a1a'], [1.3, '#ffd98a']] as [number, string][]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    for (const c of cracks) {
      ctx.beginPath();
      ctx.moveTo(c[0][0], c[0][1]);
      for (let i = 1; i < c.length; i++) ctx.lineTo(c[i][0], c[i][1]);
      ctx.stroke();
    }
  }
  ctx.restore();
  bevel(ctx, rock, 5, 0.3, 0.4);
  spec(ctx, 32, 28, 10, 4.5, -0.7, 0.45);
}

function drawRelic(ctx: C): void {
  groundShadow(ctx, 50, 90, 26, 5, 0.26);
  const prof: [number, number][] = [
    [11, 12],
    [11, 17],
    [8, 22],
    [8.5, 30],
    [18, 38],
    [27, 50],
    [27, 62],
    [20, 76],
    [13, 85],
    [16, 90],
  ];
  const urn = new Path2D();
  urn.moveTo(50 - prof[0][0], prof[0][1]);
  urn.lineTo(50 + prof[0][0], prof[0][1]);
  for (let i = 1; i < prof.length; i++) urn.lineTo(50 + prof[i][0], prof[i][1]);
  urn.lineTo(50 - prof[prof.length - 1][0], prof[prof.length - 1][1]);
  for (let i = prof.length - 2; i >= 1; i--) urn.lineTo(50 - prof[i][0], prof[i][1]);
  urn.closePath();
  // smooth version using curves
  const sm = new Path2D();
  const side = (sgn: number): [number, number][] => prof.map(([x, y]) => [50 + sgn * x, y]);
  const R = side(1);
  const Lf = side(-1).reverse();
  sm.moveTo(Lf[Lf.length - 1][0], Lf[Lf.length - 1][1]);
  sm.lineTo(R[0][0], R[0][1]);
  for (let i = 1; i < R.length - 1; i++) sm.quadraticCurveTo(R[i][0], R[i][1], (R[i][0] + R[i + 1][0]) / 2, (R[i][1] + R[i + 1][1]) / 2);
  sm.lineTo(R[R.length - 1][0], R[R.length - 1][1]);
  sm.lineTo(Lf[0][0], Lf[0][1]);
  for (let i = 1; i < Lf.length - 1; i++) sm.quadraticCurveTo(Lf[i][0], Lf[i][1], (Lf[i][0] + Lf[i + 1][0]) / 2, (Lf[i][1] + Lf[i + 1][1]) / 2);
  sm.closePath();
  // handles
  ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    ctx.strokeStyle = '#9a4a22';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(50 + sgn * 8, 26);
    ctx.bezierCurveTo(50 + sgn * 28, 20, 50 + sgn * 34, 40, 50 + sgn * 24, 48);
    ctx.stroke();
    ctx.strokeStyle = sgn < 0 ? '#d08558' : '#8a3f1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50 + sgn * 8, 26);
    ctx.bezierCurveTo(50 + sgn * 28, 20, 50 + sgn * 34, 40, 50 + sgn * 24, 48);
    ctx.stroke();
  }
  ctx.fillStyle = lin(ctx, 20, 0, 80, 0, [
    [0, '#e79a62'],
    [0.35, '#c4602f'],
    [1, '#6f2f12'],
  ]);
  ctx.fill(sm);
  ctx.save();
  ctx.clip(sm);
  // decorative bands
  ctx.fillStyle = '#3d1b0c';
  ctx.fillRect(15, 50, 70, 7);
  ctx.strokeStyle = '#f0cf8a';
  ctx.lineWidth = 1.3;
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const x = 22 + i * 5.2;
    ctx.lineTo(x, i % 2 ? 51.5 : 55.5);
  }
  ctx.stroke();
  ctx.fillStyle = '#e6c06a';
  ctx.fillRect(15, 46.5, 70, 1.8);
  ctx.fillRect(15, 58.5, 70, 1.8);
  ctx.fillRect(15, 24, 70, 2.2);
  // triangles on belly
  ctx.fillStyle = 'rgba(61,27,12,0.55)';
  for (let i = 0; i < 7; i++) {
    const x = 26 + i * 8;
    ctx.beginPath();
    ctx.moveTo(x, 63);
    ctx.lineTo(x + 4, 71);
    ctx.lineTo(x - 4, 71);
    ctx.closePath();
    ctx.fill();
  }
  // crack
  ctx.strokeStyle = 'rgba(40,16,6,0.7)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(64, 33);
  ctx.lineTo(60, 40);
  ctx.lineTo(63, 46);
  ctx.lineTo(60, 52);
  ctx.stroke();
  ctx.restore();
  bevel(ctx, sm, 4, 0.4, 0.34);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(33, 66, 2.6, 13, 0.12, 0, TAU);
  ctx.fill();
  spec(ctx, 36, 44, 4, 9, 0.2, 0.7);
}

function drawMoonRock(ctx: C): void {
  groundShadow(ctx, 50, 86, 33, 6, 0.24);
  const rock = blobP(rockPts(50, 49, 35, 13, 57, 0.1, 1.0, 0.94));
  ctx.fillStyle = rad(ctx, 36, 32, 4, 50, 50, 48, [
    [0, '#f4f6fb'],
    [0.5, '#b7bdcb'],
    [1, '#6a7185'],
  ]);
  ctx.fill(rock);
  ctx.save();
  ctx.clip(rock);
  const craters: [number, number, number][] = [
    [34, 36, 8.5],
    [62, 30, 6],
    [64, 58, 10],
    [38, 66, 6.5],
    [50, 50, 3.6],
    [78, 44, 3.4],
    [24, 54, 3.6],
  ];
  for (const [x, y, r] of craters) {
    ctx.fillStyle = 'rgba(70,78,98,0.34)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rad(ctx, x - r * 0.3, y - r * 0.3, 0.5, x, y, r, [
      [0, 'rgba(255,255,255,0)'],
      [1, 'rgba(60,66,86,0.35)'],
    ]);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.86, 0, 0.2, Math.PI * 0.85);
    ctx.stroke();
  }
  const rnd = rng(3);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(60,66,86,0.16)';
    ctx.beginPath();
    ctx.arc(14 + rnd() * 72, 14 + rnd() * 72, 0.5 + rnd() * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  bevel(ctx, rock, 5, 0.4, 0.4);
  spec(ctx, 30, 26, 11, 5, -0.7, 0.55);
}

function hourglass(ctx: C, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = '#9ff3ff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, -9);
  ctx.lineTo(7, -9);
  ctx.quadraticCurveTo(7, -2, 1, 0);
  ctx.quadraticCurveTo(7, 2, 7, 9);
  ctx.lineTo(-7, 9);
  ctx.quadraticCurveTo(-7, 2, -1, 0);
  ctx.quadraticCurveTo(-7, -2, -7, -9);
  ctx.closePath();
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.fillStyle = '#e8ffff';
  ctx.beginPath();
  ctx.moveTo(-5, 7.5);
  ctx.lineTo(5, 7.5);
  ctx.lineTo(0, 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-0.5, -1, 1, 5);
  ctx.fillStyle = '#ffe9a6';
  ctx.fillRect(-9, -11, 18, 2.4);
  ctx.fillRect(-9, 8.6, 18, 2.4);
  ctx.restore();
}

function drawTimeBone(ctx: C): void {
  groundShadow(ctx, 50, 87, 33, 6, 0.22);
  ctx.fillStyle = rad(ctx, 50, 50, 6, 50, 50, 48, [
    [0, 'rgba(110,230,255,0.45)'],
    [1, 'rgba(110,230,255,0)'],
  ]);
  ctx.fillRect(0, 0, 100, 100);
  const bone = boneP(50, 50, 78, 38, -0.6);
  ctx.fillStyle = lin(ctx, 20, 24, 80, 78, [
    [0, '#fff6d2'],
    [0.5, '#e9c868'],
    [1, '#a67a1c'],
  ]);
  ctx.fill(bone);
  bevel(ctx, bone, 4, 0.55, 0.34);
  // medallion
  ctx.fillStyle = rad(ctx, 50, 50, 2, 50, 50, 20, [
    [0, 'rgba(120,240,255,0.9)'],
    [1, 'rgba(120,240,255,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(50, 50, 20, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rad(ctx, 46, 45, 1, 50, 50, 14, [
    [0, '#3d5fb8'],
    [1, '#0f1b4a'],
  ]);
  ctx.beginPath();
  ctx.arc(50, 50, 14, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#f5cf55';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(49.4, 49.4, 15.2, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  hourglass(ctx, 50, 50, 0.95);
  spec(ctx, 30, 34, 10, 4, -0.8, 0.8);
  sparkle(ctx, 76, 28, 4);
  sparkle(ctx, 22, 70, 3);
}

function drawCosmic(ctx: C): void {
  groundShadow(ctx, 50, 87, 33, 6, 0.24);
  ctx.fillStyle = rad(ctx, 50, 50, 8, 50, 50, 50, [
    [0, 'rgba(190,110,255,0.4)'],
    [1, 'rgba(190,110,255,0)'],
  ]);
  ctx.fillRect(0, 0, 100, 100);
  const bone = boneP(50, 50, 78, 40, -0.6);
  ctx.fillStyle = lin(ctx, 22, 24, 78, 78, [
    [0, '#4a2c9c'],
    [1, '#12083a'],
  ]);
  ctx.fill(bone);
  ctx.save();
  ctx.clip(bone);
  const blob = (x: number, y: number, r: number, c: string): void => {
    ctx.fillStyle = rad(ctx, x, y, 1, x, y, r, [
      [0, c],
      [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.fillRect(0, 0, 100, 100);
  };
  blob(34, 62, 28, 'rgba(255,80,200,0.85)');
  blob(66, 38, 28, 'rgba(60,220,255,0.8)');
  blob(50, 50, 20, 'rgba(160,110,255,0.75)');
  blob(24, 34, 16, 'rgba(255,170,90,0.5)');
  // swirl
  ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    ctx.strokeStyle = k ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = k ? 1.1 : 3;
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.03) {
      const a = t * 9 + k * 0.4;
      const rr = 2 + t * 26;
      const x = 50 + Math.cos(a) * rr * 1.2;
      const y = 50 + Math.sin(a) * rr * 0.7;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const rnd = rng(77);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.arc(14 + rnd() * 72, 14 + rnd() * 72, 0.4 + rnd() * 0.9, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  bevel(ctx, bone, 4, 0.5, 0.4);
  band(ctx, bone, 1.3, 1.3, 'rgba(230,210,255,0.7)');
  spec(ctx, 30, 36, 9, 3.6, -0.8, 0.6);
  sparkle(ctx, 76, 30, 4.5);
  sparkle(ctx, 24, 66, 3.4);
  sparkle(ctx, 58, 62, 2.4);
}

const FIND_DRAW: ((ctx: C) => void)[] = [
  drawStick,
  drawTennis,
  drawSqueaky,
  drawRawhide,
  drawWallet,
  drawCoin,
  drawAmber,
  drawCrystal,
  drawMeteorite,
  drawRelic,
  drawMoonRock,
  drawTimeBone,
  drawCosmic,
];

/** One of the 13 Finds as a glossy 3D-looking object on a transparent background. */
export function findArt(index: number, px: number): string {
  const i = Math.max(0, Math.min(FIND_DRAW.length - 1, Math.floor(Number.isFinite(index) ? index : 0)));
  return render(`find:${i}`, px, FIND_DRAW[i]);
}

// ------------------------------------------------------------------ kennels + vehicles (reuse the scene renderers)

/** Crop a drawn sprite to its content and fit it into the square 100 x 100 icon with a ground shadow. */
function iconFrom(ctx: C, w: number, h: number, ss: number, drawFn: (c: C) => void, pad = 9): void {
  const cv = newCanvas(w * ss, h * ss);
  const sc = cv ? (cv.getContext('2d', { willReadFrequently: true }) as C | null) : null;
  if (!cv || !sc) return;
  sc.scale(ss, ss);
  drawFn(sc);
  let x0 = cv.width;
  let y0 = cv.height;
  let x1 = 0;
  let y1 = 0;
  try {
    const d = sc.getImageData(0, 0, cv.width, cv.height).data;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        if (d[(y * cv.width + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  } catch {
    x0 = 0;
    y0 = 0;
    x1 = cv.width - 1;
    y1 = cv.height - 1;
  }
  if (x1 <= x0 || y1 <= y0) return;
  const sw = x1 - x0 + 1;
  const sh = y1 - y0 + 1;
  const box = 100 - pad * 2;
  const k = Math.min(box / sw, box / sh);
  const dw = sw * k;
  const dh = sh * k;
  const dx = (100 - dw) / 2;
  const dy = Math.min(100 - pad - dh, (100 - dh) / 2 + 2);
  groundShadow(ctx, 50, dy + dh - 1, Math.max(18, dw * 0.46), Math.max(3.2, dh * 0.06), 0.22);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cv, x0, y0, sw, sh, dx, dy, dw, dh);
}

export function kennelArt(tier: number, px: number): string {
  const t = Math.max(0, Math.min(KENNEL_COUNT - 1, Math.floor(Number.isFinite(tier) ? tier : 0)));
  return render(`kennel:${t}`, px, (ctx) => iconFrom(ctx, BLD_W, BLD_H, 2.5, (c) => drawKennelBody(c as unknown as Parameters<typeof drawKennelBody>[0], t, false)));
}

export function vehicleArt(tier: number, px: number): string {
  const t = Math.max(0, Math.min(VEHICLE_SPECS.length - 1, Math.floor(Number.isFinite(tier) ? tier : 0)));
  const sp = VEHICLE_SPECS[t];
  return render(`vehicle:${t}`, px, (ctx) =>
    iconFrom(ctx, VEH_W, VEH_H + 12, 3, (c) => {
      const cc = c as unknown as Parameters<typeof drawVehicle>[0];
      c.save();
      c.translate(0, 4);
      if (sp.swirl) {
        c.save();
        c.translate(VEH_AX, VEH_AY - 26);
        c.scale(1.5, 1.5);
        c.translate(-20, -20);
        drawSwirl(cc);
        c.restore();
      }
      c.save();
      c.translate(0, -sp.hover);
      drawVehicle(cc, t);
      for (const wh of sp.wheels) {
        c.save();
        c.translate(VEH_AX + wh.x - (wh.r + 2), VEH_AY - wh.r * 2 - 2);
        drawWheel(cc, wh.r, t === 0);
        c.restore();
      }
      c.restore();
      c.restore();
    }, 8),
  );
}

// ------------------------------------------------------------------ training art (flat, 2-3 tones, no outline)

type Fam =
  | 'shovel'
  | 'bowl'
  | 'whistle'
  | 'stopwatch'
  | 'siren'
  | 'lifebuoy'
  | 'crate'
  | 'wheel'
  | 'van'
  | 'sled'
  | 'bed'
  | 'acorn'
  | 'paw'
  | 'envelope'
  | 'tag'
  | 'gear'
  | 'bone';

const FAMILY: Record<string, Fam> = {
  layRate: 'shovel',
  findValue: 'bowl',
  adoptionCap: 'whistle',
  adoptionRefill: 'stopwatch',
  rescueRate: 'siren',
  rescueMult: 'lifebuoy',
  kennelCapacity: 'crate',
  shippingCapacity: 'wheel',
  fleetSlots: 'van',
  sledCars: 'sled',
  offlineHours: 'bed',
  squirrelRate: 'acorn',
  squirrelHound: 'acorn',
  zoomieBonus: 'paw',
  maxZoomies: 'paw',
  spiritPawBonus: 'paw',
  mailCapacity: 'envelope',
  collarBonus: 'tag',
  autoBuild: 'gear',
  autoTraining: 'gear',
  autoPrestige: 'gear',
  autoWhistle: 'whistle',
};

interface Pal {
  c: string;
  l: string;
  d: string;
}
const TIER_COL = ['#3fae5a', '#3b82e0', '#f08a24', '#e0483b', '#8450d8', '#1fb5b0', '#d6479f'];
function pal(tier: number): Pal {
  const c = TIER_COL[Math.max(0, Math.min(TIER_COL.length - 1, Math.floor(tier) - 1))] ?? TIER_COL[0];
  return { c, l: lighten(c, 0.3), d: darken(c, 0.28) };
}
const CREAM = '#f6ecd6';
const CREAM_D = '#dccba6';
const GRAY = '#cdd2dc';
const GRAY_D = '#98a0b2';
const INK = '#39404f';
const WOOD = '#c28246';
const WOOD_D = '#94592a';

function flatShadow(ctx: C, cx = 50, cy = 86, rx = 30): void {
  ctx.fillStyle = 'rgba(40,30,70,0.14)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx * 0.17, 0, 0, TAU);
  ctx.fill();
}

/** fills a path with a base tone plus a lighter top-left and a darker bottom-right band */
function flat(ctx: C, p: Path2D, base: string, light?: string, dark?: string, k = 3): void {
  ctx.fillStyle = base;
  ctx.fill(p);
  if (dark) band(ctx, p, -k, -k, dark);
  if (light) band(ctx, p, k * 0.8, k * 0.8, light);
}

function drawFamily(ctx: C, fam: Fam, P: Pal): void {
  flatShadow(ctx);
  switch (fam) {
    case 'shovel': {
      // dirt mound
      flat(ctx, blobP([[18, 86], [30, 74], [50, 70], [70, 74], [84, 86]]), '#9a6a3d', '#b8854f', '#7d5230');
      // handle
      flat(ctx, capsuleP(36, 74, 3.2, 66, 30, 3.2), WOOD, '#dba06a', WOOD_D, 1.6);
      // D grip
      ctx.strokeStyle = WOOD_D;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(62, 28);
      ctx.bezierCurveTo(66, 8, 90, 14, 78, 34);
      ctx.stroke();
      ctx.strokeStyle = WOOD;
      ctx.lineWidth = 2;
      ctx.stroke();
      // blade
      const blade = new Path2D();
      blade.moveTo(22, 66);
      blade.quadraticCurveTo(24, 92, 44, 88);
      blade.quadraticCurveTo(58, 82, 50, 64);
      blade.quadraticCurveTo(36, 54, 22, 66);
      blade.closePath();
      flat(ctx, blade, P.c, P.l, P.d);
      ctx.fillStyle = P.d;
      ctx.beginPath();
      ctx.roundRect(28, 56, 28, 9, 3);
      ctx.fill();
      break;
    }
    case 'bowl': {
      // kibble heap
      const rnd = rng(5);
      for (let i = 0; i < 16; i++) {
        const x = 26 + rnd() * 48;
        const y = 40 + rnd() * 16 - Math.abs(x - 50) * 0.35;
        flat(ctx, ellP(x, y, 5.4, 4.6, rnd() * 3), i % 3 === 0 ? '#b5733a' : i % 3 === 1 ? '#9a5d2b' : '#c58845', 'rgba(255,230,180,0.5)', 'rgba(60,30,10,0.35)', 1.4);
      }
      const bowl = new Path2D();
      bowl.moveTo(14, 52);
      bowl.lineTo(86, 52);
      bowl.quadraticCurveTo(84, 82, 50, 84);
      bowl.quadraticCurveTo(16, 82, 14, 52);
      bowl.closePath();
      flat(ctx, bowl, P.c, P.l, P.d, 4);
      ctx.fillStyle = P.d;
      ctx.beginPath();
      ctx.ellipse(50, 52, 36, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = CREAM;
      // paw print
      ctx.beginPath();
      ctx.ellipse(50, 70, 6, 5, 0, 0, TAU);
      ctx.fill();
      for (const [x, y] of [[40, 62], [46, 58], [54, 58], [60, 62]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, 2.4, 3, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'whistle': {
      // lanyard
      ctx.strokeStyle = P.d;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(30, 30);
      ctx.bezierCurveTo(14, 8, 56, 4, 54, 28);
      ctx.stroke();
      flat(ctx, rrP(12, 38, 56, 22, 8), P.c, P.l, P.d);
      flat(ctx, ellP(62, 54, 20, 20), P.c, P.l, P.d, 4);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(40, 38, 16, 5, 2);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.arc(62, 54, 7, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = P.c;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (const [x0, y0, x1, y1] of [[80, 30, 92, 24], [84, 42, 96, 40], [82, 54, 94, 58]]) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      break;
    }
    case 'stopwatch': {
      flat(ctx, rrP(44, 10, 12, 10, 2), GRAY_D, GRAY, '#6b7388', 1.4);
      flat(ctx, rrP(40, 6, 20, 6, 3), GRAY, undefined, GRAY_D, 1);
      flat(ctx, ellP(50, 56, 34, 34), P.c, P.l, P.d, 4);
      flat(ctx, ellP(50, 56, 26, 26), CREAM, '#fffaf0', CREAM_D, 2.4);
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(50, 56);
      ctx.lineTo(50, 38);
      ctx.moveTo(50, 56);
      ctx.lineTo(62, 62);
      ctx.stroke();
      ctx.fillStyle = INK;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.beginPath();
        ctx.arc(50 + Math.cos(a) * 22, 56 + Math.sin(a) * 22, 1.2, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'siren': {
      flat(ctx, rrP(18, 70, 64, 16, 4), INK, '#59627a', '#262b37', 2);
      flat(ctx, rrP(24, 62, 52, 10, 3), GRAY, '#eef0f5', GRAY_D, 1.6);
      const dome = new Path2D();
      dome.moveTo(28, 62);
      dome.quadraticCurveTo(26, 28, 50, 26);
      dome.quadraticCurveTo(74, 28, 72, 62);
      dome.closePath();
      flat(ctx, dome, P.c, P.l, P.d, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(40, 44, 4, 10, 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = P.c;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const [x0, y0, x1, y1] of [[50, 16, 50, 6], [24, 26, 16, 18], [76, 26, 84, 18], [14, 46, 4, 44], [86, 46, 96, 44]]) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      break;
    }
    case 'lifebuoy': {
      ctx.save();
      ctx.translate(50, 52);
      const ring = new Path2D();
      ring.arc(0, 0, 36, 0, TAU);
      ring.arc(0, 0, 15, 0, TAU, true);
      ctx.fillStyle = CREAM;
      ctx.fill(ring);
      ctx.save();
      ctx.clip(ring);
      ctx.fillStyle = P.c;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2 + Math.PI / 4 - 0.4);
        ctx.fillRect(-8, -40, 16, 20);
        ctx.restore();
      }
      ctx.fillStyle = P.d;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0.2, Math.PI * 0.9);
      ctx.arc(0, 0, 15, Math.PI * 0.9, 0.2, true);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.strokeStyle = 'rgba(40,30,70,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'crate': {
      flat(ctx, rrP(14, 30, 72, 54, 8), P.c, P.l, P.d, 4);
      flat(ctx, rrP(24, 40, 52, 38, 4), '#2a2f3d', undefined, undefined);
      ctx.fillStyle = P.l;
      for (let i = 0; i < 5; i++) ctx.fillRect(30 + i * 10, 40, 3.2, 38);
      ctx.fillRect(24, 56, 52, 3);
      // handle
      ctx.strokeStyle = P.d;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(36, 30);
      ctx.quadraticCurveTo(50, 12, 64, 30);
      ctx.stroke();
      break;
    }
    case 'wheel': {
      const c = ellP(50, 52, 36, 36);
      flat(ctx, c, INK, '#59627a', '#20242e', 4);
      flat(ctx, ellP(50, 52, 24, 24), GRAY, '#f1f3f8', GRAY_D, 3);
      ctx.fillStyle = P.c;
      ctx.beginPath();
      ctx.arc(50, 52, 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.d;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - 0.4;
        ctx.beginPath();
        ctx.arc(50 + Math.cos(a) * 16, 52 + Math.sin(a) * 16, 2.4, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = '#59627a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        ctx.beginPath();
        ctx.moveTo(50 + Math.cos(a) * 31, 52 + Math.sin(a) * 31);
        ctx.lineTo(50 + Math.cos(a) * 35, 52 + Math.sin(a) * 35);
        ctx.stroke();
      }
      break;
    }
    case 'van': {
      flat(ctx, rrP(8, 34, 58, 40, 5), CREAM, '#ffffff', CREAM_D, 3);
      const cab = new Path2D();
      cab.moveTo(66, 44);
      cab.lineTo(82, 44);
      cab.quadraticCurveTo(92, 50, 92, 62);
      cab.lineTo(92, 74);
      cab.lineTo(66, 74);
      cab.closePath();
      flat(ctx, cab, P.c, P.l, P.d, 3);
      ctx.fillStyle = '#bfe6ff';
      ctx.beginPath();
      ctx.moveTo(70, 49);
      ctx.lineTo(81, 49);
      ctx.quadraticCurveTo(87, 53, 87, 60);
      ctx.lineTo(70, 60);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.c;
      ctx.fillRect(8, 56, 58, 6);
      for (const x of [26, 76]) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(x, 76, 9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = GRAY;
        ctx.beginPath();
        ctx.arc(x, 76, 4, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'sled': {
      ctx.strokeStyle = GRAY_D;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(14, 82);
      ctx.lineTo(78, 82);
      ctx.quadraticCurveTo(92, 82, 90, 68);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = GRAY;
      ctx.beginPath();
      ctx.moveTo(16, 80.5);
      ctx.lineTo(76, 80.5);
      ctx.stroke();
      ctx.fillStyle = GRAY_D;
      ctx.fillRect(26, 62, 4, 20);
      ctx.fillRect(66, 62, 4, 20);
      flat(ctx, rrP(14, 44, 76, 22, 7), P.c, P.l, P.d, 3);
      ctx.fillStyle = CREAM;
      ctx.fillRect(22, 52, 60, 3);
      // rope
      ctx.strokeStyle = WOOD_D;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(90, 54);
      ctx.quadraticCurveTo(96, 40, 90, 30);
      ctx.stroke();
      break;
    }
    case 'bed': {
      flat(ctx, ellP(50, 64, 40, 22), P.c, P.l, P.d, 4);
      flat(ctx, ellP(50, 61, 29, 14), CREAM, '#ffffff', CREAM_D, 2.6);
      // little pillow with Z
      flat(ctx, rrP(34, 44, 22, 16, 6), P.l, '#ffffff', P.c, 2);
      ctx.strokeStyle = P.d;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(40, 49);
      ctx.lineTo(48, 49);
      ctx.lineTo(40, 56);
      ctx.lineTo(48, 56);
      ctx.stroke();
      break;
    }
    case 'acorn': {
      flat(ctx, ellP(50, 62, 24, 24), '#c88a4a', '#e5ad6a', '#9a6330', 4);
      const cap = new Path2D();
      cap.moveTo(24, 52);
      cap.quadraticCurveTo(26, 28, 50, 28);
      cap.quadraticCurveTo(74, 28, 76, 52);
      cap.quadraticCurveTo(50, 60, 24, 52);
      cap.closePath();
      flat(ctx, cap, P.c, P.l, P.d, 3.4);
      ctx.fillStyle = P.d;
      ctx.fillRect(48, 16, 4, 12);
      ctx.strokeStyle = P.l;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(32 + i * 12, 38 + (i % 2) * 4);
        ctx.lineTo(36 + i * 12, 46 + (i % 2) * 3);
        ctx.stroke();
      }
      break;
    }
    case 'paw': {
      flat(ctx, blobP([[26, 76], [24, 60], [34, 46], [50, 42], [66, 46], [76, 60], [74, 76], [62, 80], [50, 74], [38, 80]]), P.c, P.l, P.d, 4);
      for (const [x, y, r] of [[22, 40, 8], [38, 24, 8.5], [62, 24, 8.5], [78, 40, 8]] as [number, number, number][]) {
        flat(ctx, ellP(x, y, r, r * 1.2, (x - 50) * 0.01), P.c, P.l, P.d, 2.6);
      }
      ctx.strokeStyle = P.c;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (const [x0, y0, x1, y1] of [[8, 56, 0, 54], [8, 68, 0, 70]]) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      break;
    }
    case 'envelope': {
      flat(ctx, rrP(12, 28, 76, 52, 6), CREAM, '#ffffff', CREAM_D, 3);
      const fl = new Path2D();
      fl.moveTo(12, 34);
      fl.quadraticCurveTo(12, 28, 18, 28);
      fl.lineTo(82, 28);
      fl.quadraticCurveTo(88, 28, 88, 34);
      fl.lineTo(50, 62);
      fl.closePath();
      flat(ctx, fl, P.c, P.l, P.d, 3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(50, 58, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.d;
      ctx.beginPath();
      ctx.arc(50, 58, 3, 0, TAU);
      ctx.fill();
      break;
    }
    case 'tag': {
      ctx.strokeStyle = GRAY_D;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(50, 24, 12, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = GRAY;
      ctx.lineWidth = 2;
      ctx.stroke();
      const bone = boneP(50, 62, 48, 28, 0);
      flat(ctx, bone, P.c, P.l, P.d, 3.4);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(50, 62, 5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'gear': {
      const g = new Path2D();
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU;
        const a1 = ((i + 0.5) / n) * TAU;
        const a2 = ((i + 0.62) / n) * TAU;
        const a3 = ((i + 0.88) / n) * TAU;
        const pt = (a: number, r: number): [number, number] => [50 + Math.cos(a) * r, 52 + Math.sin(a) * r];
        const p0 = pt(a0, 28);
        const p1 = pt(a1, 28);
        const p2 = pt(a2, 38);
        const p3 = pt(a3, 38);
        if (i === 0) g.moveTo(p0[0], p0[1]);
        else g.lineTo(p0[0], p0[1]);
        g.lineTo(p1[0], p1[1]);
        g.lineTo(p2[0], p2[1]);
        g.lineTo(p3[0], p3[1]);
      }
      g.closePath();
      g.arc(50, 52, 12, 0, TAU, true);
      flat(ctx, g, P.c, P.l, P.d, 3.6);
      break;
    }
    default: {
      flat(ctx, boneP(50, 56, 62, 34, -0.5), CREAM, '#ffffff', CREAM_D, 3.4);
      break;
    }
  }
}

function statOf(id: string): { stat: string; tier: number } {
  const t = TRAINING.find((d) => d.id === id);
  if (t) return { stat: t.stat, tier: t.tier };
  const a = ACADEMY.find((d) => d.id === id);
  if (a) return { stat: a.stat, tier: 1 + ((ACADEMY.indexOf(a) * 7) % 7) };
  const s = PREMIUM_SHOP.find((d) => d.id === id);
  if (s) return { stat: s.stat, tier: 5 };
  return { stat: '', tier: 1 };
}

/** Family-level flat object illustration for a training / research id, tinted per tier. */
export function trainingArt(id: string, px: number): string {
  const { stat, tier } = statOf(String(id));
  const fam = FAMILY[stat] ?? 'bone';
  return render(`train:${fam}:${tier}`, px, (ctx) => drawFamily(ctx, fam, pal(tier)));
}

// ------------------------------------------------------------------ treats

function drawBacon(ctx: C): void {
  groundShadow(ctx, 50, 84, 38, 6, 0.2);
  const strip = (cx: number, cy: number, rot: number, s: number): void => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    const p = new Path2D();
    p.moveTo(-42, -7);
    p.bezierCurveTo(-34, -15, -26, -1, -16, -9);
    p.bezierCurveTo(-6, -17, 2, -1, 12, -9);
    p.bezierCurveTo(22, -17, 30, -3, 42, -10);
    p.lineTo(42, 7);
    p.bezierCurveTo(32, 14, 24, 0, 14, 8);
    p.bezierCurveTo(4, 16, -4, 2, -14, 10);
    p.bezierCurveTo(-24, 18, -32, 2, -42, 9);
    p.closePath();
    ctx.fillStyle = lin(ctx, 0, -16, 0, 18, [
      [0, '#f08a7e'],
      [1, '#b53c32'],
    ]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = 'rgba(255,238,224,0.9)';
    for (const [x, w] of [[-34, 14], [-8, 18], [22, 16]]) {
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x + w, -20);
      ctx.lineTo(x + w - 6, 20);
      ctx.lineTo(x - 6, 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(120,20,16,0.28)';
    ctx.fillRect(-50, 4, 100, 14);
    ctx.restore();
    bevel(ctx, p, 2.4, 0.45, 0.3);
    spec(ctx, -22, -6, 9, 2.4, -0.1, 0.6);
    ctx.restore();
  };
  strip(48, 38, -0.14, 0.92);
  strip(52, 66, 0.1, 0.96);
}

function drawPeanutKong(ctx: C): void {
  groundShadow(ctx, 50, 87, 28, 5.5, 0.24);
  const body = new Path2D();
  body.moveTo(34, 20);
  body.quadraticCurveTo(50, 14, 66, 20);
  body.quadraticCurveTo(70, 36, 78, 56);
  body.quadraticCurveTo(84, 80, 72, 86);
  body.lineTo(28, 86);
  body.quadraticCurveTo(16, 80, 22, 56);
  body.quadraticCurveTo(30, 36, 34, 20);
  body.closePath();
  ctx.fillStyle = lin(ctx, 20, 20, 80, 88, [
    [0, '#ff6a52'],
    [0.5, '#d92f24'],
    [1, '#8f1710'],
  ]);
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = 'rgba(80,10,6,0.35)';
  for (const y of [46, 62]) {
    ctx.beginPath();
    ctx.ellipse(50, y, 30, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,150,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(50, y - 3, 29, 3.2, 0, Math.PI * 1.05, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.restore();
  bevel(ctx, body, 4, 0.5, 0.34);
  // top ring
  ctx.fillStyle = lin(ctx, 0, 14, 0, 28, [
    [0, '#ff8f78'],
    [1, '#c92a20'],
  ]);
  ctx.beginPath();
  ctx.ellipse(50, 22, 18, 6.5, 0, 0, TAU);
  ctx.fill();
  // peanut butter swirl
  const pb = new Path2D();
  pb.moveTo(34, 20);
  pb.bezierCurveTo(30, 4, 44, 0, 50, 8);
  pb.bezierCurveTo(58, -2, 72, 6, 66, 20);
  pb.bezierCurveTo(60, 26, 40, 26, 34, 20);
  pb.closePath();
  ctx.fillStyle = lin(ctx, 30, 2, 70, 28, [
    [0, '#f4c27a'],
    [0.5, '#d4903f'],
    [1, '#a35f1c'],
  ]);
  ctx.fill(pb);
  bevel(ctx, pb, 2.6, 0.5, 0.34);
  ctx.strokeStyle = 'rgba(255,230,170,0.7)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(39, 14);
  ctx.quadraticCurveTo(46, 8, 54, 14);
  ctx.stroke();
  spec(ctx, 34, 44, 4, 14, 0.18, 0.55);
  spec(ctx, 40, 10, 6, 2.6, -0.3, 0.8);
}

function drawSteak(ctx: C): void {
  groundShadow(ctx, 50, 85, 38, 6.5, 0.22);
  const meat = blobP([[12, 56], [18, 34], [38, 22], [62, 22], [84, 34], [90, 58], [74, 80], [44, 84], [22, 76]]);
  // fat rim
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = lin(ctx, 10, 20, 90, 86, [
    [0, '#fff6e6'],
    [1, '#e6cfae'],
  ]);
  ctx.stroke(meat);
  ctx.restore();
  ctx.fillStyle = lin(ctx, 20, 24, 84, 80, [
    [0, '#e9705d'],
    [0.5, '#c23d31'],
    [1, '#7b1e1a'],
  ]);
  ctx.fill(meat);
  ctx.save();
  ctx.clip(meat);
  // grill marks
  ctx.strokeStyle = 'rgba(66,22,12,0.62)';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(24 + i * 16, 20);
    ctx.lineTo(4 + i * 16 + 34, 88);
    ctx.stroke();
  }
  // marbling
  ctx.strokeStyle = 'rgba(255,225,210,0.5)';
  ctx.lineWidth = 1.2;
  for (const [x, y] of [[40, 34], [62, 56], [28, 62]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 5, y - 4, x + 11, y - 1);
    ctx.stroke();
  }
  ctx.restore();
  bevel(ctx, meat, 5, 0.4, 0.38);
  // T-bone
  const tb = new Path2D();
  tb.addPath(rrP(52, 40, 28, 8, 4));
  tb.addPath(rrP(62, 40, 8, 26, 4));
  ctx.fillStyle = lin(ctx, 52, 40, 80, 66, [
    [0, '#ffffff'],
    [1, '#d6c6a4'],
  ]);
  ctx.fill(tb);
  bevel(ctx, tb, 1.6, 0.4, 0.3);
  spec(ctx, 34, 36, 14, 5, -0.5, 0.55);
}

export function treatArt(id: string, px: number): string {
  const key = String(id);
  const draw = /bacon/.test(key) ? drawBacon : /peanut|kong/.test(key) ? drawPeanutKong : /steak/.test(key) ? drawSteak : null;
  if (!draw) {
    // unknown treat: a plain glossy biscuit-bone
    return render('treat:other', px, (ctx) => {
      groundShadow(ctx, 50, 86, 32, 6, 0.22);
      const b = boneP(50, 52, 62, 32, -0.5);
      ctx.fillStyle = lin(ctx, 20, 26, 80, 78, [
        [0, '#f9e7c0'],
        [1, '#c79a5c'],
      ]);
      ctx.fill(b);
      bevel(ctx, b, 4, 0.5, 0.34);
      spec(ctx, 34, 38, 10, 4, -0.7, 0.7);
    });
  }
  return render(`treat:${draw === drawBacon ? 'bacon' : draw === drawSteak ? 'steak' : 'kong'}`, px, draw);
}

