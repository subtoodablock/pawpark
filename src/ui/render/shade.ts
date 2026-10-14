// Colour + path helpers shared by every procedural drawing routine.
// Everything here is used while *baking* sprites; none of it runs in the per-frame hot loop.

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

/** Mix toward white. */
export function lighten(c: string, t: number): string {
  return mix(c, '#ffffff', t);
}
/** Mix toward a deep warm-violet (nicer than pure black for shaded sides). */
export function darken(c: string, t: number): string {
  return mix(c, '#2a1c3a', t);
}
/** Lightness jitter: v in -1..1 (about +-8% at |v|=1). */
export function shift(c: string, v: number): string {
  return v >= 0 ? lighten(c, v * 0.1) : darken(c, -v * 0.1);
}
/** Outline colour: a saturated, much darker shade of the fill (never black). */
export function outline(c: string): string {
  return mix(darken(c, 0.5), c, 0.12);
}
export function rgba(c: string, a: number): string {
  const [r, g, b] = hexToRgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}
export function easeOutBack(t: number, c1 = 1.70158): number {
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export type Pt = { x: number; y: number };

/** Outline of a tapered capsule (circle r1 at p1, circle r2 at p2), as a polygon. */
export function capsulePts(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number, seg = 14): Pt[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const th = Math.atan2(dy, dx);
  const phi = Math.acos(clamp((r1 - r2) / L, -1, 1));
  const pts: Pt[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = th - phi + (2 * phi * i) / seg;
    pts.push({ x: x2 + r2 * Math.cos(a), y: y2 + r2 * Math.sin(a) });
  }
  const span = 2 * Math.PI - 2 * phi;
  for (let i = 0; i <= seg; i++) {
    const a = th + phi + (span * i) / seg;
    pts.push({ x: x1 + r1 * Math.cos(a), y: y1 + r1 * Math.sin(a) });
  }
  return pts;
}

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot = 0, seg = 24): Pt[] {
  const pts: Pt[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    pts.push({ x: cx + ex * c - ey * s, y: cy + ex * s + ey * c });
  }
  return pts;
}

/** Smooth closed path through polygon points (midpoint quadratic smoothing). */
export function smoothPath(p: Path2D | Ctx, pts: Pt[]): void {
  const n = pts.length;
  const mx = (pts[n - 1].x + pts[0].x) / 2;
  const my = (pts[n - 1].y + pts[0].y) / 2;
  p.moveTo(mx, my);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    p.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  p.closePath();
}

/** Scalloped (fluffy) closed path: each sample is joined by an outward-bulging arc. */
export function scallopPath(p: Path2D | Ctx, pts: Pt[], bulge: number, every = 2): void {
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  for (const q of pts) {
    cx += q.x;
    cy += q.y;
  }
  cx /= n;
  cy /= n;
  const sel: Pt[] = [];
  for (let i = 0; i < n; i += every) sel.push(pts[i]);
  const m = sel.length;
  p.moveTo(sel[0].x, sel[0].y);
  for (let i = 0; i < m; i++) {
    const a = sel[i];
    const b = sel[(i + 1) % m];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let nx = my - cy;
    let ny = -(mx - cx);
    // outward normal of the chord: perpendicular, oriented away from the centroid
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    nx = ey;
    ny = -ex;
    if (nx * (mx - cx) + ny * (my - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const l = Math.hypot(nx, ny) || 1;
    p.quadraticCurveTo(mx + (nx / l) * bulge * 2, my + (ny / l) * bulge * 2, b.x, b.y);
  }
  p.closePath();
}

export function pathFromPts(pts: Pt[], fluff = 0, every = 2): Path2D {
  const p = new Path2D();
  if (fluff > 0) scallopPath(p, pts, fluff, every);
  else smoothPath(p, pts);
  return p;
}

let tmp: { cv: OffscreenCanvas | HTMLCanvasElement; cx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } | null = null;
function tmpCanvas(w: number, h: number) {
  if (!tmp) {
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    tmp = { cv, cx: cv.getContext('2d') as CanvasRenderingContext2D };
  }
  if (tmp.cv.width < w) tmp.cv.width = w;
  if (tmp.cv.height < h) tmp.cv.height = h;
  return tmp;
}

/**
 * Crescent rim light (top-left) and inner shade (bottom-right) confined to a shape.
 * Works on arbitrary unions (computed from the filled alpha mask, not path winding).
 * This single trick is what makes flat fills read as soft 3D toys. Bake-time only.
 */
export function rimLight(ctx: Ctx, path: Path2D, light: string, dark: string, la = 0.55, da = 0.28, off = 1.2): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const t = tmpCanvas(W, H);
  const tc = t.cx;
  const m = ctx.getTransform();
  const passes: [string, number, number, number][] = [
    [light, la, off, off * 1.15],
    [dark, da, -off * 1.3, -off * 1.4],
  ];
  for (const [col, a, dx, dy] of passes) {
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, W, H);
    tc.setTransform(m);
    tc.fillStyle = '#000';
    tc.fill(path);
    tc.globalCompositeOperation = 'destination-out';
    tc.translate(dx, dy);
    tc.fill(path);
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = rgba(col, a);
    tc.fillRect(0, 0, W, H);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(t.cv as CanvasImageSource, 0, 0, W, H, 0, 0, W, H);
    ctx.restore();
  }
  tc.globalCompositeOperation = 'source-over';
}

/** Soft blurred polygon shadow. Only for baking into sprites (uses shadowBlur once). */
export function softPoly(ctx: Ctx, pts: Pt[], alpha: number, blur: number, dpr: number): void {
  const OFF = 4000;
  ctx.save();
  ctx.shadowColor = `rgba(20,10,40,${alpha})`;
  ctx.shadowBlur = blur * dpr;
  ctx.shadowOffsetX = OFF * dpr;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(pts[0].x - OFF, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - OFF, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Soft elliptical contact shadow with a radial gradient (spec: 0.22 alpha -> 0). */
export function contactShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.22): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(30,18,50,${a})`);
  g.addColorStop(0.55, `rgba(30,18,50,${a * 0.6})`);
  g.addColorStop(1, 'rgba(30,18,50,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Short curved fur strokes inside the current clip; direction follows `flow`. */
export function furStrokes(
  ctx: Ctx,
  rnd: () => number,
  n: number,
  region: { x: number; y: number; w: number; h: number },
  base: string,
  flow: number,
  len = 4,
  alpha = 0.5,
): void {
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < n; i++) {
    const x = region.x + rnd() * region.w;
    const y = region.y + rnd() * region.h;
    const a = flow + (rnd() - 0.5) * 0.9;
    const l = len * (0.6 + rnd() * 0.7);
    const v = rnd() * 2 - 1;
    ctx.strokeStyle = rgba(shift(base, v), alpha);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.6, y + Math.sin(a + 0.5) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

export function star4(ctx: Ctx, x: number, y: number, r: number): void {
  const k = r * 0.28;
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.closePath();
}
