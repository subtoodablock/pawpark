// World: layout, sky, clouds, hills, lawn (mow stripes + baked noise), fence, path, flowers, trees,
// road, depot, butterflies, time-of-day tint. Static pieces are baked once per resize (docs §8).
import { type Ctx, clamp, darken, hash01, lighten, mix, outline, rgba, rimLight, rng, roundRect, softPoly } from './shade';
import { P } from './palette';

export interface TreeSpot {
  x: number;
  y: number;
  s: number;
  v: number;
}
export interface Layout {
  w: number;
  h: number;
  bs: number;
  horizon: number;
  lawnTop: number;
  lawnBottom: number;
  roadTop: number;
  roadH: number;
  kennelBase: number;
  kennelX: number[];
  centerX: number;
  centerY: number;
  mailX: number;
  mailY: number;
  lanes: [number, number];
  trees: TreeSpot[];
}

export function computeLayout(w: number, h: number, slots: number): Layout {
  const bs = clamp(w / 390, 0.78, 1.18);
  const roadH = clamp(h * 0.165, 62, 90);
  const roadTop = h - roadH;
  const horizon = clamp(h * 0.19, 66, 124);
  const lawnTop = horizon + 8;
  const lawnBottom = roadTop - 12;
  const base = Math.max(lawnTop + (lawnBottom - lawnTop) * 0.2, 126 * bs);
  const kennelBase = Math.min(base, lawnBottom - 90);
  const pad = 6;
  const slotW = (w - pad * 2) / slots;
  const kennelX: number[] = [];
  for (let i = 0; i < slots; i++) kennelX.push(pad + slotW * (i + 0.5));
  const midY = kennelBase + (lawnBottom - kennelBase) * 0.46;
  const trees: TreeSpot[] = [
    { x: -4, y: lawnTop + 8, s: 0.78, v: 0 },
    { x: w + 2, y: lawnTop + 6, s: 0.72, v: 1 },
    { x: w - 12 * bs, y: lawnBottom - 4, s: 1.0 * bs, v: 2 },
  ];
  return {
    w,
    h,
    bs,
    horizon,
    lawnTop,
    lawnBottom,
    roadTop,
    roadH,
    kennelBase,
    kennelX,
    centerX: 52 * bs,
    centerY: midY + 6,
    mailX: w - 30 * bs,
    mailY: midY - 4,
    lanes: [roadTop + roadH * 0.36, roadTop + roadH * 0.76],
    trees,
  };
}

/** perspective scale for actors: 0.85 at the back of the lawn up to 1.15 at the front (spec §2) */
export function depthScale(L: Layout, y: number): number {
  const t = (y - L.lawnTop) / Math.max(1, L.lawnBottom - L.lawnTop);
  return 0.85 + 0.3 * clamp(t, 0, 1);
}

// ------------------------------------------------------------------ time of day

export interface Tint {
  r: number;
  g: number;
  b: number;
  night: boolean;
  lit: number;
}
const KEYS: [number, number, number, number][] = [
  [0, 168, 182, 236],
  [5, 168, 182, 236],
  [6.6, 255, 232, 206],
  [8.6, 255, 255, 255],
  [16.4, 255, 255, 255],
  [18.4, 255, 222, 176],
  [20.4, 176, 190, 240],
  [24, 168, 182, 236],
];
export function tintAt(hour: number): Tint {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1][0]) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
  const night = hour < 5.8 || hour >= 20.2;
  const lit = hour < 6 || hour >= 18.6 ? 1 : 0;
  return { r: a[1] + (b[1] - a[1]) * t, g: a[2] + (b[2] - a[2]) * t, b: a[3] + (b[3] - a[3]) * t, night, lit };
}

// ------------------------------------------------------------------ sky

export function drawSky(ctx: Ctx, L: Layout, night: boolean): void {
  const hgt = L.horizon + 30;
  const g = ctx.createLinearGradient(0, 0, 0, hgt);
  if (night) {
    g.addColorStop(0, '#34519e');
    g.addColorStop(1, '#a6bdf0');
  } else {
    g.addColorStop(0, P.skyTop);
    g.addColorStop(1, P.skyBottom);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, hgt);
  const sx = L.w * 0.17;
  const sy = Math.min(38 * L.bs + 6, L.horizon * 0.5);
  if (night) {
    const r = rng(9);
    for (let i = 0; i < 38; i++) {
      const x = r() * L.w;
      const y = r() * (L.horizon - 8);
      ctx.fillStyle = `rgba(255,255,235,${0.35 + r() * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.5 + r() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    const gl = ctx.createRadialGradient(sx, sy, 4, sx, sy, 46);
    gl.addColorStop(0, 'rgba(255,250,215,0.55)');
    gl.addColorStop(1, 'rgba(255,250,215,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(sx - 50, sy - 50, 100, 100);
    // crescent: big disc minus an offset disc (clip to the disc, fill everything outside the bite)
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.clip();
    const moon = ctx.createLinearGradient(sx - 14, sy - 14, sx + 10, sy + 14);
    moon.addColorStop(0, '#fffdf0');
    moon.addColorStop(1, '#f1e2a8');
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.rect(sx - 20, sy - 20, 40, 40);
    ctx.arc(sx + 7, sy - 4, 12, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();
  } else {
    const gl = ctx.createRadialGradient(sx, sy, 6, sx, sy, 56);
    gl.addColorStop(0, 'rgba(255,248,200,0.8)');
    gl.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(sx - 60, sy - 60, 120, 120);
    ctx.strokeStyle = 'rgba(255,248,190,0.5)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * 20, sy + Math.sin(a) * 20);
      ctx.lineTo(sx + Math.cos(a) * (i % 2 ? 26 : 30), sy + Math.sin(a) * (i % 2 ? 26 : 30));
      ctx.stroke();
    }
    const sg = ctx.createRadialGradient(sx - 4, sy - 4, 2, sx, sy, 16);
    sg.addColorStop(0, '#fffbe0');
    sg.addColorStop(0.6, '#ffe27a');
    sg.addColorStop(1, '#ffc93a');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0a81e';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

export function drawCloud(ctx: Ctx, w: number, h: number, seed: number): void {
  const r = rng(seed);
  const n = 5 + Math.floor(r() * 2);
  const base = h - 5;
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const rad = Math.min(h * 0.44, (h * 0.26 + Math.sin(t * Math.PI) * h * 0.2) * (0.85 + r() * 0.3));
    const x = rad + 1 + t * Math.max(0, w - 2 * rad - 2);
    blobs.push([x, base - rad + 2, rad]);
  }
  // soft blue underside first, then lit blobs
  ctx.fillStyle = '#c9e2f7';
  for (const [x, y, rad] of blobs) {
    ctx.beginPath();
    ctx.arc(x, Math.min(y + 2, h - rad - 0.5), rad, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y, rad] of blobs) {
    const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, '#fbfeff');
    g.addColorStop(1, '#e6f3fd');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ ground

function hills(ctx: Ctx, L: Layout): void {
  const y = L.horizon;
  const layers: [number, number, number, string, number][] = [
    [34, 0.012, 1.2, '#b1e49c', 5],
    [22, 0.018, 3.4, '#92d97a', 11],
  ];
  for (const [amp, fq, ph, col, seed] of layers) {
    ctx.beginPath();
    ctx.moveTo(0, y + 4);
    for (let x = 0; x <= L.w + 8; x += 8) {
      ctx.lineTo(x, y - amp * 0.45 - amp * 0.5 * (0.5 + 0.5 * Math.sin(x * fq * 6.28 + ph)) - amp * 0.15 * Math.sin(x * 0.045 + seed));
    }
    ctx.lineTo(L.w + 8, y + 4);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y - amp, 0, y);
    g.addColorStop(0, lighten(col, 0.15));
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(darken(col, 0.3), 0.35);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // tiny far trees on the hill
  const r = rng(31);
  for (let i = 0; i < Math.floor(L.w / 36); i++) {
    const x = r() * L.w;
    const yy = y - 8 - r() * 12;
    const rad = 4 + r() * 3;
    ctx.fillStyle = '#7ccb68';
    ctx.beginPath();
    ctx.arc(x, yy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(x - rad * 0.3, yy - rad * 0.3, rad * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lawn(ctx: Ctx, L: Layout): void {
  const top = L.horizon;
  const bot = L.roadTop + 10;
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#93dc72');
  g.addColorStop(0.18, P.grass1);
  g.addColorStop(1, '#6cc04a');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, L.w, bot - top);
  // mow stripes: horizontal bands that grow with depth (perspective)
  let y = top;
  let k = 0;
  let bh = 12 * L.bs;
  while (y < L.roadTop) {
    if (k % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.075)';
      ctx.fillRect(0, y, L.w, Math.min(bh, L.roadTop - y));
    } else {
      ctx.fillStyle = 'rgba(30,110,40,0.06)';
      ctx.fillRect(0, y, L.w, Math.min(bh, L.roadTop - y));
    }
    y += bh;
    bh *= 1.1;
    k++;
  }
  // baked noise: tiny blades and specks, denser/larger toward the viewer
  const r = rng(1234);
  const n = Math.floor((L.w * (L.roadTop - top)) / 38);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r() * L.w;
    const t = r();
    const yy = top + t * t * 0.0 + r() * (L.roadTop - top);
    const depth = 0.6 + 0.9 * ((yy - top) / (L.roadTop - top));
    const dark = r() < 0.5;
    ctx.strokeStyle = dark ? 'rgba(40,120,45,0.28)' : 'rgba(210,255,170,0.3)';
    ctx.lineWidth = 0.8 * depth;
    ctx.beginPath();
    const lean = (r() - 0.5) * 2.4;
    ctx.moveTo(x, yy);
    ctx.lineTo(x + lean, yy - (2.2 + r() * 2.6) * depth);
    ctx.stroke();
  }
  // haze toward the horizon (6% toward sky)
  const hz = ctx.createLinearGradient(0, top, 0, top + 46);
  hz.addColorStop(0, 'rgba(212,240,255,0.16)');
  hz.addColorStop(1, 'rgba(212,240,255,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, top, L.w, 46);
  // soft vignette on the sides
  const vg = ctx.createLinearGradient(0, 0, L.w, 0);
  vg.addColorStop(0, 'rgba(20,80,30,0.14)');
  vg.addColorStop(0.12, 'rgba(20,80,30,0)');
  vg.addColorStop(0.88, 'rgba(20,80,30,0)');
  vg.addColorStop(1, 'rgba(20,80,30,0.14)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, top, L.w, bot - top);
}

function path(ctx: Ctx, L: Layout): void {
  const bs = L.bs;
  const by = L.kennelBase + 10 * bs;
  const stroke = (w: number, col: string): void => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(L.centerX + 4 * bs, L.centerY + 8 * bs);
    ctx.bezierCurveTo(L.centerX + 40 * bs, L.centerY + 14 * bs, L.kennelX[0] - 40 * bs, by + 26 * bs, L.kennelX[0] - 6, by);
    ctx.lineTo(L.kennelX[L.kennelX.length - 1] + 30 * bs, by);
    ctx.stroke();
  };
  stroke(22 * bs, rgba('#8a6238', 0.55));
  stroke(19 * bs, '#d9b684');
  stroke(15 * bs, P.path);
  stroke(5 * bs, 'rgba(255,255,255,0.18)');
  // pebbles
  const r = rng(808);
  for (let i = 0; i < 46; i++) {
    const x = L.centerX + r() * (L.w - L.centerX - 30);
    const y = by + (r() - 0.5) * 12 * bs;
    ctx.fillStyle = r() < 0.5 ? 'rgba(160,120,70,0.45)' : 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + r() * 1.2, 0.7 + r() * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // dirt pads under each kennel slot
  for (const x of L.kennelX) {
    const rx = 40 * bs;
    const ry = 12 * bs;
    const cy = L.kennelBase + 2;
    const pg = ctx.createRadialGradient(x, cy, 4, x, cy, rx);
    pg.addColorStop(0, '#f2d9ae');
    pg.addColorStop(0.75, P.dirt);
    pg.addColorStop(1, '#d4ad7c');
    ctx.save();
    ctx.translate(0, cy);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(x, 0, rx, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.lineWidth = 1.6 * (rx / ry);
    ctx.strokeStyle = 'rgba(138,98,56,0.55)';
    ctx.stroke();
    ctx.restore();
  }
}

function fence(ctx: Ctx, L: Layout): void {
  const y = L.horizon + 5;
  // shadow on lawn below the fence
  const sg = ctx.createLinearGradient(0, y, 0, y + 8);
  sg.addColorStop(0, 'rgba(20,60,30,0.25)');
  sg.addColorStop(1, 'rgba(20,60,30,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, y, L.w, 8);
  const wood = '#c98e52';
  // rails
  for (const ry of [y - 11, y - 5]) {
    const g = ctx.createLinearGradient(0, ry, 0, ry + 3.6);
    g.addColorStop(0, lighten(wood, 0.25));
    g.addColorStop(1, darken(wood, 0.2));
    ctx.fillStyle = g;
    ctx.fillRect(0, ry, L.w, 3.6);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, ry + 3.6, L.w, 1);
  }
  for (let x = -2; x < L.w + 16; x += 15) {
    const pw = 6.4;
    const g = ctx.createLinearGradient(x, 0, x + pw, 0);
    g.addColorStop(0, lighten(wood, 0.32));
    g.addColorStop(0.55, wood);
    g.addColorStop(1, darken(wood, 0.25));
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x, y - 14);
    ctx.lineTo(x + pw / 2, y - 18);
    ctx.lineTo(x + pw, y - 14);
    ctx.lineTo(x + pw, y + 1);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = outline(wood);
    ctx.stroke();
  }
}

function bush(ctx: Ctx, x: number, y: number, s: number, seed: number): void {
  const r = rng(seed);
  const n = 3;
  ctx.fillStyle = 'rgba(20,70,30,0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 5 * s, y + 1, 17 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) puffs.push([x + (i - 1) * 9 * s + (r() - 0.5) * 3, y - 7 * s - (i === 1 ? 4 * s : 0), (8 + r() * 2) * s]);
  const base = '#4fb04a';
  ctx.fillStyle = outline(base);
  for (const [px, py, pr] of puffs) {
    ctx.beginPath();
    ctx.arc(px, py, pr + 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [px, py, pr] of puffs) {
    const g = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.45, pr * 0.1, px, py, pr);
    g.addColorStop(0, lighten(base, 0.4));
    g.addColorStop(0.6, base);
    g.addColorStop(1, darken(base, 0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  // berries
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#ff6f91';
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * 22 * s, y - 6 * s - r() * 8 * s, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function flower(ctx: Ctx, x: number, y: number, col: string, s = 1): void {
  ctx.strokeStyle = 'rgba(40,120,50,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 4 * s);
  ctx.stroke();
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 1.7 * s, y - 4.6 * s + Math.sin(a) * 1.7 * s, 1.35 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath();
  ctx.arc(x, y - 4.6 * s, 1.1 * s, 0, Math.PI * 2);
  ctx.fill();
}

function road(ctx: Ctx, L: Layout): void {
  const y = L.roadTop;
  const g = ctx.createLinearGradient(0, y, 0, L.h);
  g.addColorStop(0, '#69707e');
  g.addColorStop(1, '#565d6b');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, L.w, L.roadH);
  // grass-edge shadow + curb
  ctx.fillStyle = 'rgba(20,50,25,0.22)';
  ctx.fillRect(0, y - 3, L.w, 3);
  const cg = ctx.createLinearGradient(0, y, 0, y + 6);
  cg.addColorStop(0, '#eceff5');
  cg.addColorStop(1, '#b9c0cd');
  ctx.fillStyle = cg;
  ctx.fillRect(0, y, L.w, 5.5);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, y + 5.5, L.w, 2);
  for (let x = 0; x < L.w; x += 26) {
    ctx.fillStyle = 'rgba(90,100,120,0.25)';
    ctx.fillRect(x, y, 1, 5.5);
  }
  // lane dashes + edge line
  const mid = (L.lanes[0] + L.lanes[1]) / 2 + 1;
  ctx.fillStyle = P.roadLine;
  for (let x = 6; x < L.w; x += 34) {
    roundRect(ctx, x, mid - 1.4, 18, 2.8, 1.4);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, L.h - 5, L.w, 1.6);
  // asphalt speckle
  const r = rng(555);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)';
    ctx.fillRect(r() * L.w, y + 8 + r() * (L.roadH - 10), 1.4, 1.2);
  }
}

export function drawDepot(ctx: Ctx, dpr: number): void {
  // small garage: 76 x 54, anchor bottom-centre (38, 46)
  ctx.save();
  ctx.translate(38, 46);
  softPoly(ctx, [{ x: -30, y: 1 }, { x: 30, y: 1 }, { x: 52, y: 7 }, { x: -8, y: 7 }], 0.18, 3, dpr);
  const w = 56;
  const h = 26;
  const x = -w / 2;
  const wall = '#e7dcc4';
  ctx.beginPath();
  ctx.moveTo(x + w, 0);
  ctx.lineTo(x + w + 9, -5);
  ctx.lineTo(x + w + 9, -h - 5);
  ctx.lineTo(x + w, -h);
  ctx.closePath();
  ctx.fillStyle = darken(wall, 0.25);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = outline(wall);
  ctx.stroke();
  const fg = ctx.createLinearGradient(0, -h, 0, 0);
  fg.addColorStop(0, lighten(wall, 0.15));
  fg.addColorStop(1, darken(wall, 0.1));
  ctx.fillStyle = fg;
  ctx.fillRect(x, -h, w, h);
  ctx.strokeRect(x, -h, w, h);
  // roof
  ctx.beginPath();
  ctx.moveTo(x - 3, -h + 1);
  ctx.lineTo(x + w + 3, -h + 1);
  ctx.lineTo(x + w + 12, -h - 8);
  ctx.lineTo(x + 8, -h - 8);
  ctx.closePath();
  ctx.fillStyle = '#4a8fe7';
  ctx.fill();
  ctx.strokeStyle = outline('#4a8fe7');
  ctx.stroke();
  ctx.fillStyle = '#3a79cc';
  ctx.fillRect(x - 3, -h + 1, w + 6, 3.6);
  // roll-up door
  const dg = ctx.createLinearGradient(0, -20, 0, 0);
  dg.addColorStop(0, '#2a1d24');
  dg.addColorStop(1, '#5a4636');
  ctx.fillStyle = dg;
  ctx.fillRect(-16, -20, 32, 20);
  ctx.fillStyle = '#c3cad6';
  ctx.fillRect(-18, -22, 36, 4.4);
  ctx.strokeStyle = '#8e99b0';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-18, -22 + i * 1.1);
    ctx.lineTo(18, -22 + i * 1.1);
    ctx.stroke();
  }
  // sign
  ctx.fillStyle = '#fff4dc';
  ctx.fillRect(-9, -h - 4, 18, 6);
  ctx.strokeStyle = outline('#fff4dc');
  ctx.strokeRect(-9, -h - 4, 18, 6);
  ctx.fillStyle = '#ef5a47';
  ctx.beginPath();
  ctx.arc(0, -h - 1, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
export const DEPOT_W = 76;
export const DEPOT_H = 60;
export const DEPOT_AX = 38;
export const DEPOT_AY = 46;

/** all static ground pieces for the layer canvas */
export function drawGround(ctx: Ctx, L: Layout, dpr: number): void {
  void dpr;
  hills(ctx, L);
  lawn(ctx, L);
  path(ctx, L);
  fence(ctx, L);
  const r = rng(4242);
  // bushes along the back and sides
  const bushSpots: [number, number, number][] = [
    [L.w * 0.5 + (r() - 0.5) * 30, L.horizon + 18, 0.8],
    [18 * L.bs, L.kennelBase + 24 * L.bs, 0.9],
    [L.w - 20 * L.bs, L.kennelBase + 34 * L.bs, 0.95],
    [L.w * 0.62, L.horizon + 14, 0.7],
    [L.w * 0.18, L.horizon + 15, 0.65],
  ];
  bushSpots.forEach(([x, y, s], i) => bush(ctx, x, y, s, 10 + i));
  // flowers: little clusters near edges and the boardwalk
  const cols = ['#ffffff', '#ff8fc0', '#ffd24d', '#c9a8ff', '#ff9a7a'];
  const patches = Math.floor(L.w / 22);
  for (let i = 0; i < patches; i++) {
    const side = r();
    const px = side < 0.4 ? r() * 40 * L.bs + 4 : side < 0.8 ? L.w - r() * 44 * L.bs - 4 : r() * L.w;
    const py = L.kennelBase + 20 * L.bs + r() * (L.lawnBottom - L.kennelBase - 24);
    const c = cols[Math.floor(r() * cols.length)];
    for (let k = 0; k < 3; k++) flower(ctx, px + (k - 1) * 4.5 + (r() - 0.5) * 3, py + (r() - 0.5) * 4, c, 0.9 + r() * 0.3);
  }
  road(ctx, L);
  // tree shadows (trees themselves are drawn per frame so they can sway)
  for (const t of L.trees) {
    softPoly(
      ctx,
      [
        { x: t.x - 14 * t.s, y: t.y - 1 },
        { x: t.x + 14 * t.s, y: t.y - 1 },
        { x: t.x + 44 * t.s, y: t.y + 7 * t.s },
        { x: t.x + 8 * t.s, y: t.y + 10 * t.s },
      ],
      0.2,
      4,
      dpr,
    );
  }
}

// ------------------------------------------------------------------ trees

export const TREE_W = 96;
export const TREE_H = 118;
export const TREE_AX = 48;
export const TREE_AY = 110;

export function drawTree(ctx: Ctx, variant: number): void {
  const cols = ['#58b94a', '#4aa66b', '#79c451'];
  const col = cols[variant % cols.length];
  ctx.save();
  ctx.translate(TREE_AX, TREE_AY);
  // trunk
  const tg = ctx.createLinearGradient(-6, 0, 6, 0);
  tg.addColorStop(0, '#c98e52');
  tg.addColorStop(0.6, '#a86f3a');
  tg.addColorStop(1, '#7a4c26');
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(-5, -4, -5, -12);
  ctx.lineTo(-4.5, -34);
  ctx.lineTo(4.5, -34);
  ctx.lineTo(5, -12);
  ctx.quadraticCurveTo(5, -4, 9, 0);
  ctx.closePath();
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = outline('#a86f3a');
  ctx.lineJoin = 'round';
  ctx.stroke();
  // canopy puffs
  const puffs: [number, number, number][] =
    variant % 3 === 1
      ? [[-14, -56, 17], [14, -56, 17], [0, -74, 20], [0, -50, 20], [-22, -44, 12], [22, -44, 12]]
      : [[0, -62, 23], [-19, -50, 17], [19, -52, 18], [3, -82, 15], [-12, -72, 14], [16, -72, 14]];
  for (const [x, y, r] of puffs) {
    ctx.fillStyle = outline(col);
    ctx.beginPath();
    ctx.arc(x, y, r + 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // darker back puffs first (those lower) then lighter on top
  const order = puffs.slice().sort((a, b) => b[1] - a[1]);
  for (const [x, y, r] of order) {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0, lighten(col, 0.42));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darken(col, 0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // leaf clumps / highlights
  const rg = rng(variant * 7 + 3);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const p = puffs[Math.floor(rg() * puffs.length)];
    const a = rg() * Math.PI * 2;
    const d = rg() * p[2] * 0.8;
    const x = p[0] + Math.cos(a) * d;
    const y = p[1] + Math.sin(a) * d;
    const light = rg() < 0.55;
    ctx.strokeStyle = light ? 'rgba(220,255,170,0.5)' : 'rgba(20,80,40,0.35)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x, y, 2.4 + rg() * 1.6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  // fruit/blossoms
  if (variant % 3 === 2) {
    for (let i = 0; i < 7; i++) {
      const p = puffs[Math.floor(rg() * puffs.length)];
      ctx.fillStyle = '#ff6f6f';
      ctx.beginPath();
      ctx.arc(p[0] + (rg() - 0.5) * p[2] * 1.2, p[1] + (rg() - 0.5) * p[2] * 1.2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawSunDisc(): void {}

export function drawGlow(ctx: Ctx, col: string): void {
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, rgba(col, 0.9));
  g.addColorStop(0.4, rgba(col, 0.35));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
}

export function drawButterfly(ctx: Ctx, col: string): void {
  // wing pair, 16 x 12 logical, body at centre (flap = scaleX live)
  ctx.save();
  ctx.translate(8, 6);
  for (const s of [-1, 1]) {
    ctx.fillStyle = col;
    ctx.strokeStyle = darken(col, 0.4);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(s * 3.6, -2, 3.8, 3.2, s * -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(s * 3, 2.4, 2.8, 2.4, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(s * 4, -2.4, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3a2a30';
  roundRect(ctx, -0.8, -3.4, 1.6, 7, 0.8);
  ctx.fill();
  ctx.restore();
}

export { mix, hash01, rimLight };
