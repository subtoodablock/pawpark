// Kennel families, adoption centre, mailbox. Everything is drawn once into sprites (docs §6).
// Local drawing space: ground contact at y = 0, building centred at x = 0; light from the top-left.
import {
  type Ctx,
  type Pt,
  darken,
  lighten,
  mix,
  outline,
  rgba,
  rimLight,
  roundRect,
  softPoly,
  star4,
} from './shade';
import { P } from './palette';

export const BLD_W = 172;
export const BLD_H = 148;
export const BLD_AX = 62;
export const BLD_AY = 126;

export interface KennelFx {
  /** door position, relative to the ground anchor (x right, y down) */
  door: Pt;
  smoke?: Pt;
  flags?: Pt[];
  blink?: Pt[];
  dish?: Pt;
  floating?: boolean;
  sparkles?: boolean;
  /** footprint half-width for shadows / layout, and visual height */
  hw: number;
  height: number;
}

const OW = 1.6;

function poly(ctx: Ctx, pts: Pt[], fill: string | CanvasGradient, oc: string, ow = OW): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.fillStyle = fill;
  ctx.fill();
  if (ow > 0) {
    ctx.lineWidth = ow;
    ctx.strokeStyle = oc;
    ctx.stroke();
  }
}

function vg(ctx: Ctx, y0: number, y1: number, top: string, bot: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  return g;
}

function pathOf(pts: Pt[]): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
  p.closePath();
  return p;
}

interface BoxCols {
  front: string;
  top?: string;
  side?: string;
}
type Tex = 'none' | 'planks' | 'brick' | 'logs' | 'corrugated' | 'glass';

/** oblique box: front face (x..x+w, y-h..y), right side (depth dx,dy), top. Returns the face polygons. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, dx: number, dy: number, col: BoxCols, tex: Tex = 'none', noTop = false): { front: Pt[]; side: Pt[]; top: Pt[] } {
  const front: Pt[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y - h },
    { x, y: y - h },
  ];
  const side: Pt[] = [
    { x: x + w, y },
    { x: x + w + dx, y: y - dy },
    { x: x + w + dx, y: y - h - dy },
    { x: x + w, y: y - h },
  ];
  const top: Pt[] = [
    { x, y: y - h },
    { x: x + w, y: y - h },
    { x: x + w + dx, y: y - h - dy },
    { x: x + dx, y: y - h - dy },
  ];
  const oc = outline(col.front);
  poly(ctx, side, vg(ctx, y - h, y, darken(col.side ?? col.front, 0.16), darken(col.side ?? col.front, 0.34)), oc);
  poly(ctx, front, vg(ctx, y - h, y, lighten(col.front, 0.1), darken(col.front, 0.12)), oc);
  if (!noTop) poly(ctx, top, lighten(col.top ?? col.front, 0.22), oc);
  texture(ctx, front, tex, col.front, x, y - h, w, h, false);
  texture(ctx, side, tex, col.front, x + w, y - h - dy, dx, h + dy, true);
  const fp = pathOf(front);
  rimLight(ctx, fp, lighten(col.front, 0.8), darken(col.front, 0.5), 0.5, 0.22, 1.1);
  return { front, side, top };
}

function texture(ctx: Ctx, face: Pt[], tex: Tex, base: string, x: number, y: number, w: number, h: number, dark: boolean): void {
  if (tex === 'none') return;
  ctx.save();
  ctx.clip(pathOf(face));
  const dk = rgba(darken(base, 0.55), dark ? 0.22 : 0.2);
  const lt = rgba(lighten(base, 0.7), dark ? 0.08 : 0.26);
  ctx.lineWidth = 0.9;
  if (tex === 'planks') {
    for (let px = x + 5; px < x + w; px += 5) {
      ctx.strokeStyle = dk;
      ctx.beginPath();
      ctx.moveTo(px, y - 4);
      ctx.lineTo(px, y + h + 4);
      ctx.stroke();
      ctx.strokeStyle = lt;
      ctx.beginPath();
      ctx.moveTo(px + 1, y - 4);
      ctx.lineTo(px + 1, y + h + 4);
      ctx.stroke();
    }
  } else if (tex === 'logs') {
    for (let py = y + 4.5; py < y + h + 4; py += 5) {
      ctx.strokeStyle = dk;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x - 2, py);
      ctx.lineTo(x + w + 4, py);
      ctx.stroke();
      ctx.strokeStyle = lt;
      ctx.beginPath();
      ctx.moveTo(x - 2, py - 1.3);
      ctx.lineTo(x + w + 4, py - 1.3);
      ctx.stroke();
    }
  } else if (tex === 'brick') {
    let row = 0;
    for (let py = y + 4; py < y + h + 4; py += 4.5) {
      ctx.strokeStyle = dk;
      ctx.beginPath();
      ctx.moveTo(x - 2, py);
      ctx.lineTo(x + w + 2, py);
      ctx.stroke();
      for (let px = x + (row % 2 ? 4 : 0); px < x + w + 4; px += 8) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 4.5);
        ctx.stroke();
      }
      row++;
    }
  } else if (tex === 'corrugated') {
    for (let px = x + 3; px < x + w; px += 3.2) {
      ctx.strokeStyle = dk;
      ctx.beginPath();
      ctx.moveTo(px, y - 2);
      ctx.lineTo(px, y + h + 2);
      ctx.stroke();
      ctx.strokeStyle = lt;
      ctx.beginPath();
      ctx.moveTo(px + 1.1, y - 2);
      ctx.lineTo(px + 1.1, y + h + 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function shingles(ctx: Ctx, face: Pt[], base: string, step = 4): void {
  ctx.save();
  ctx.clip(pathOf(face));
  let minY = 1e9;
  let maxY = -1e9;
  let minX = 1e9;
  let maxX = -1e9;
  for (const p of face) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  ctx.strokeStyle = rgba(darken(base, 0.55), 0.3);
  ctx.lineWidth = 0.9;
  let row = 0;
  for (let y = minY + step; y < maxY + step; y += step) {
    ctx.beginPath();
    ctx.moveTo(minX - 4, y);
    ctx.lineTo(maxX + 4, y);
    ctx.stroke();
    for (let x = minX + (row % 2 ? 3 : 0); x < maxX + 6; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - step);
      ctx.stroke();
    }
    row++;
  }
  ctx.restore();
}

function win(ctx: Ctx, x: number, y: number, w: number, h: number, lit: boolean, opts: { round?: boolean; shutters?: string; frame?: string } = {}): void {
  const frame = opts.frame ?? '#f6efe2';
  if (lit) {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 1, x + w / 2, y + h / 2, Math.max(w, h) * 1.3);
    g.addColorStop(0, 'rgba(255,216,110,0.5)');
    g.addColorStop(1, 'rgba(255,216,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y - h, w * 3, h * 3);
  }
  ctx.beginPath();
  if (opts.round) ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 1, h / 2 + 1, 0, 0, Math.PI * 2);
  else roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 1.6);
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = outline(frame);
  ctx.stroke();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (lit) {
    g.addColorStop(0, '#fff0b0');
    g.addColorStop(1, '#ffc454');
  } else {
    g.addColorStop(0, '#bfe6ff');
    g.addColorStop(1, '#6fb2ea');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  if (opts.round) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else roundRect(ctx, x, y, w, h, 1);
  ctx.fill();
  // glint + cross bars
  ctx.strokeStyle = rgba(frame, 0.9);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  if (h > 7) {
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(x + 1, y + h * 0.5);
  ctx.lineTo(x + w * 0.45, y + 1);
  ctx.lineTo(x + w * 0.7, y + 1);
  ctx.lineTo(x + 1, y + h * 0.85);
  ctx.closePath();
  ctx.fill();
  if (opts.shutters) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = opts.shutters;
      const sx = s < 0 ? x - 3.6 : x + w + 0.6;
      ctx.fillRect(sx, y - 0.5, 3, h + 1);
      ctx.strokeStyle = outline(opts.shutters);
      ctx.lineWidth = 0.7;
      ctx.strokeRect(sx, y - 0.5, 3, h + 1);
    }
  }
}

function archDoor(ctx: Ctx, cx: number, y: number, w: number, h: number, inner = '#2a1d24', trim: string = P.woodDark): void {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 1.5, y);
  ctx.lineTo(cx - w / 2 - 1.5, y - h + w / 2);
  ctx.arc(cx, y - h + w / 2, w / 2 + 1.5, Math.PI, 0);
  ctx.lineTo(cx + w / 2 + 1.5, y);
  ctx.closePath();
  ctx.fillStyle = trim;
  ctx.fill();
  ctx.strokeStyle = outline(trim);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.lineTo(cx - w / 2, y - h + w / 2);
  ctx.arc(cx, y - h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(cx + w / 2, y);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, '#1b1018');
  g.addColorStop(1, inner);
  ctx.fillStyle = g;
  ctx.fill();
  // warm glow on the floor inside
  const gg = ctx.createRadialGradient(cx, y, 0, cx, y, w * 0.7);
  gg.addColorStop(0, 'rgba(255,200,120,0.45)');
  gg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = gg;
  ctx.fill();
}

function paw(ctx: Ctx, x: number, y: number, s: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.35, s * 0.55, s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [
    [-0.7, -0.25],
    [-0.25, -0.7],
    [0.25, -0.7],
    [0.7, -0.25],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s * 0.8, y + dy * s * 0.8, s * 0.2, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bone(ctx: Ctx, x: number, y: number, w: number, col = '#fff4dc'): void {
  const r = w * 0.17;
  ctx.fillStyle = col;
  ctx.strokeStyle = outline(col);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.roundRect(x - w * 0.4, y - r * 0.8, w * 0.8, r * 1.6, r * 0.8);
  for (const sx of [-1, 1]) {
    ctx.moveTo(x + sx * w * 0.4 + r, y - r * 0.9);
    ctx.arc(x + sx * w * 0.42, y - r * 0.95, r, 0, Math.PI * 2);
    ctx.moveTo(x + sx * w * 0.4 + r, y + r * 0.9);
    ctx.arc(x + sx * w * 0.42, y + r * 0.95, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
}

function plaque(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 2.5);
  const g = vg(ctx, y - h / 2, y + h / 2, '#fff7e0', '#ecd9a8');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = outline('#c89b52');
  ctx.lineWidth = 1;
  ctx.stroke();
  paw(ctx, x, y - h * 0.08, Math.min(w, h) * 0.34, '#b8743d');
}

/** gable-front house; wall is the front face, roof plane recedes to the right. */
function gableHouse(ctx: Ctx, cx: number, y: number, w: number, h: number, rise: number, dx: number, dy: number, wall: string, roof: string, tex: Tex): void {
  const x = cx - w / 2;
  const ov = 3.2;
  const A = { x: cx, y: y - h - rise - 1.5 };
  const B = { x: x + w + ov, y: y - h + 2.5 };
  // right wall side
  poly(
    ctx,
    [
      { x: x + w, y },
      { x: x + w + dx, y: y - dy },
      { x: x + w + dx, y: y - h - dy },
      { x: x + w, y: y - h },
    ],
    vg(ctx, y - h, y, darken(wall, 0.2), darken(wall, 0.38)),
    outline(wall),
  );
  texture(ctx, [{ x: x + w, y }, { x: x + w + dx, y: y - dy }, { x: x + w + dx, y: y - h - dy }, { x: x + w, y: y - h }], tex, wall, x + w, y - h, dx, h, true);
  // roof plane (right slope, faces away from the light, so a bit darker)
  const rp: Pt[] = [A, B, { x: B.x + dx + 1, y: B.y - dy }, { x: A.x + dx + 1, y: A.y - dy }];
  poly(ctx, rp, vg(ctx, A.y - dy, B.y, darken(roof, 0.12), darken(roof, 0.3)), outline(roof));
  shingles(ctx, rp, roof, 3.6);
  // front face with gable
  const front: Pt[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y - h },
    { x: cx, y: y - h - rise },
    { x, y: y - h },
  ];
  poly(ctx, front, vg(ctx, y - h - rise, y, lighten(wall, 0.12), darken(wall, 0.1)), outline(wall));
  texture(ctx, front, tex, wall, x, y - h - rise, w, h + rise, false);
  rimLight(ctx, pathOf(front), lighten(wall, 0.8), darken(wall, 0.5), 0.5, 0.2, 1.1);
  // barge boards (the lit left slope edge + right edge)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [col, wd] of [
    [outline(roof), 4.6],
    [lighten(roof, 0.12), 3.2],
  ] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = wd;
    ctx.beginPath();
    ctx.moveTo(x - ov, y - h + 2.5);
    ctx.lineTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba('#fff', 0.45);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - ov, y - h + 1.2);
  ctx.lineTo(A.x - 0.3, A.y - 1.2);
  ctx.stroke();
}

function blobShadow(ctx: Ctx, pts: Pt[], dpr: number): void {
  softPoly(ctx, pts, 0.27, 3.5, dpr);
}

function hull(pts: Pt[]): Pt[] {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

/** cast shadow (skewed toward the bottom-right) + ambient-occlusion line, spec §2 */
export function drawKennelShadow(ctx: Ctx, tier: number, dpr: number): void {
  const fx = KENNEL_FX[tier];
  ctx.save();
  ctx.translate(BLD_AX, BLD_AY);
  const hw = fx.hw;
  const dy = Math.min(8, fx.height * 0.12);
  const dx = Math.min(14, fx.height * 0.14);
  if (fx.floating) {
    // small soft ellipse on the ground, building hovers above it
    const g = ctx.createRadialGradient(0, 4, 0, 0, 4, hw * 1.15);
    g.addColorStop(0, 'rgba(30,18,50,0.2)');
    g.addColorStop(1, 'rgba(30,18,50,0)');
    ctx.save();
    ctx.scale(1, 0.34);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 4 / 0.34, hw * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  const foot: Pt[] = [
    { x: -hw, y: 1 },
    { x: hw, y: 1 },
    { x: hw + dx, y: 1 - dy },
    { x: -hw + dx, y: 1 - dy },
  ];
  const len = Math.min(fx.height * 0.7 + 8, 58);
  const v = { x: len * 0.9, y: len * 0.26 };
  const pts = foot.concat(foot.map((p) => ({ x: p.x + v.x, y: p.y + v.y })));
  blobShadow(ctx, hull(pts), dpr);
  // AO line where the building meets the ground
  ctx.strokeStyle = 'rgba(25,12,40,0.34)';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-hw - 1, 1.2);
  ctx.lineTo(hw + 1, 1.2);
  ctx.lineTo(hw + dx + 1, 1.2 - dy);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ families

function doghouse(ctx: Ctx, cx: number, y: number, w: number, small = false): void {
  const h = w * 0.55;
  gableHouse(ctx, cx, y, w, h, w * 0.4, w * 0.22, w * 0.13, '#e3ab6e', '#e9574a', 'planks');
  const dw = w * 0.36;
  archDoor(ctx, cx, y, dw, h * 0.78);
  if (!small) plaque(ctx, cx, y - h - w * 0.13, w * 0.24, w * 0.17);
  else bone(ctx, cx, y - h - w * 0.1, w * 0.3, '#fff4dc');
}

function woodFamily(ctx: Ctx, tier: number, lit: boolean): void {
  void lit;
  if (tier === 0) {
    doghouse(ctx, -3, 0, 44);
  } else if (tier === 1) {
    doghouse(ctx, 22, -5, 34, true);
    doghouse(ctx, -15, 0, 38);
    // little fence between
  } else {
    // kennel shed: wide planked box with a mono-pitch red roof and three arched doors
    const w = 76;
    const h = 28;
    const dx = 12;
    const dy = 7;
    const x = -w / 2 - 4;
    box(ctx, x, 0, w, h, dx, dy, { front: '#e3ab6e', side: '#e3ab6e', top: '#e9574a' }, 'planks', true);
    // roof slab
    const roof: Pt[] = [
      { x: x - 4, y: -h + 3 },
      { x: x + w + 4, y: -h + 3 },
      { x: x + w + dx + 4, y: -h - dy - 6 },
      { x: x + dx - 4 + 2, y: -h - dy - 6 },
    ];
    poly(ctx, roof, vg(ctx, -h - dy - 6, -h + 3, lighten('#e9574a', 0.2), '#e9574a'), outline('#e9574a'));
    shingles(ctx, roof, '#e9574a', 3.8);
    // eave edge
    poly(
      ctx,
      [
        { x: x - 4, y: -h + 3 },
        { x: x + w + 4, y: -h + 3 },
        { x: x + w + 4, y: -h + 6.4 },
        { x: x - 4, y: -h + 6.4 },
      ],
      '#c8402f',
      outline('#c8402f'),
    );
    for (let i = 0; i < 3; i++) archDoor(ctx, x + 14 + i * 24, 0, 13, 17);
    plaque(ctx, x + w / 2, -h - 1, 18, 11);
    // pennant string
    bone(ctx, x + w + 2, -4, 9);
  }
}

function barnFamily(ctx: Ctx, tier: number, lit: boolean): void {
  if (tier === 3) {
    // red barn, white trim, big X door, hay loft
    const w = 62;
    const h = 30;
    const x = -w / 2 - 3;
    const dx = 16;
    const dy = 9;
    // side + roof first
    const wall = '#d9483a';
    const roof = '#7c5a52';
    poly(
      ctx,
      [{ x: x + w, y: 0 }, { x: x + w + dx, y: -dy }, { x: x + w + dx, y: -h - dy }, { x: x + w, y: -h }],
      vg(ctx, -h, 0, darken(wall, 0.18), darken(wall, 0.38)),
      outline(wall),
    );
    const apex = { x: x + w / 2, y: -h - 26 };
    const g1 = { x: x - 1, y: -h - 10 };
    const g2 = { x: x + w + 1, y: -h - 10 };
    const sh1 = { x: x + 8, y: -h - 20 };
    const sh2 = { x: x + w - 8, y: -h - 20 };
    const rp: Pt[] = [sh2, g2, { x: g2.x + dx + 1, y: g2.y - dy }, { x: sh2.x + dx + 1, y: sh2.y - dy }];
    const rp2: Pt[] = [apex, sh2, { x: sh2.x + dx + 1, y: sh2.y - dy }, { x: apex.x + dx + 1, y: apex.y - dy }];
    poly(ctx, rp, vg(ctx, -h - 30, -h, darken(roof, 0.05), darken(roof, 0.28)), outline(roof));
    poly(ctx, rp2, vg(ctx, -h - 40, -h - 10, darken(roof, 0.05), darken(roof, 0.28)), outline(roof));
    shingles(ctx, rp, roof, 3.6);
    shingles(ctx, rp2, roof, 3.6);
    const front: Pt[] = [{ x, y: 0 }, { x: x + w, y: 0 }, { x: x + w, y: -h }, g2, sh2, apex, sh1, g1, { x, y: -h }];
    poly(ctx, front, vg(ctx, -h - 26, 0, lighten(wall, 0.1), darken(wall, 0.12)), outline(wall));
    texture(ctx, front, 'planks', wall, x, -h - 26, w, h + 26, false);
    rimLight(ctx, pathOf(front), lighten(wall, 0.8), darken(wall, 0.5), 0.5, 0.22, 1.1);
    ctx.strokeStyle = '#fff6ea';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(g1.x, g1.y);
    ctx.lineTo(sh1.x, sh1.y);
    ctx.lineTo(apex.x, apex.y);
    ctx.lineTo(sh2.x, sh2.y);
    ctx.lineTo(g2.x, g2.y);
    ctx.stroke();
    // big door with white X
    const dw = 26;
    const dh = 21;
    ctx.fillStyle = '#b73326';
    ctx.fillRect(-dw / 2, -dh, dw, dh);
    ctx.strokeStyle = '#fff6ea';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(-dw / 2, -dh, dw, dh);
    ctx.beginPath();
    ctx.moveTo(-dw / 2, -dh);
    ctx.lineTo(dw / 2, 0);
    ctx.moveTo(dw / 2, -dh);
    ctx.lineTo(-dw / 2, 0);
    ctx.moveTo(0, -dh);
    ctx.lineTo(0, 0);
    ctx.stroke();
    // hay loft
    ctx.fillStyle = '#2a1d24';
    ctx.fillRect(-7, -h - 15, 14, 11);
    ctx.fillStyle = '#f0cf6a';
    ctx.fillRect(-7, -h - 9, 14, 5);
    ctx.strokeStyle = '#fff6ea';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-7, -h - 15, 14, 11);
    // hay bale by the door
    box(ctx, dw / 2 + 3, 0, 9, 7, 3, 2, { front: '#f0cf6a' }, 'none');
  } else if (tier === 4) {
    // log lodge with stone chimney + porch
    const w = 66;
    const h = 28;
    const x = -w / 2 - 4;
    // chimney (behind)
    box(ctx, 14, -h - 14, 9, 22, 4, 3, { front: '#9aa0ab' }, 'brick');
    box(ctx, x, 0, w, h, 14, 8, { front: '#c98e52', side: '#c98e52' }, 'logs', true);
    const roof = P.roofGreen;
    const A = { x: x + w / 2, y: -h - 22 };
    const B = { x: x + w + 4, y: -h + 3 };
    const rp: Pt[] = [A, B, { x: B.x + 15, y: B.y - 8 }, { x: A.x + 15, y: A.y - 8 }];
    poly(ctx, rp, vg(ctx, A.y - 8, B.y, darken(roof, 0.05), darken(roof, 0.32)), outline(roof));
    shingles(ctx, rp, roof, 3.6);
    const front: Pt[] = [{ x, y: 0 }, { x: x + w, y: 0 }, { x: x + w, y: -h }, A, { x, y: -h }];
    poly(ctx, front, vg(ctx, -h - 22, 0, lighten('#c98e52', 0.1), darken('#c98e52', 0.12)), outline('#c98e52'));
    texture(ctx, front, 'logs', '#c98e52', x, -h - 22, w, h + 22, false);
    rimLight(ctx, pathOf(front), lighten('#c98e52', 0.8), darken('#c98e52', 0.5), 0.5, 0.22, 1.1);
    ctx.lineCap = 'round';
    for (const [c, wd] of [[outline(roof), 5], [lighten(roof, 0.1), 3.4]] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(x - 4, -h + 3);
      ctx.lineTo(A.x, A.y - 1);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }
    win(ctx, x + 8, -22, 11, 11, lit, { shutters: '#2f7a4a' });
    win(ctx, x + w - 19, -22, 11, 11, lit, { shutters: '#2f7a4a' });
    archDoor(ctx, 0, 0, 14, 20, '#2a1d24', '#7a4a22');
    win(ctx, -4, -h - 8, 8, 8, lit, { round: true });
    // stone base
    ctx.fillStyle = '#9aa0ab';
    ctx.fillRect(x - 1, -4, w + 2, 4);
    ctx.strokeStyle = outline('#9aa0ab');
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1, -4, w + 2, 4);
  } else {
    // doggy daycare: bright schoolhouse with a bell tower and playful colours
    const w = 70;
    const h = 30;
    const x = -w / 2 - 4;
    box(ctx, x, 0, w, h, 14, 8, { front: '#ffd35c', side: '#ffd35c', top: P.roofBlue }, 'none', true);
    const roof: Pt[] = [
      { x: x - 4, y: -h + 2 },
      { x: x + w + 4, y: -h + 2 },
      { x: x + w + 18, y: -h - 6 },
      { x: x + 10, y: -h - 6 },
    ];
    poly(ctx, roof, vg(ctx, -h - 6, -h + 2, lighten(P.roofBlue, 0.25), P.roofBlue), outline(P.roofBlue));
    ctx.fillStyle = '#3a79cc';
    ctx.fillRect(x - 4, -h + 2, w + 8, 4);
    // tower
    box(ctx, -9, -h + 2, 18, 20, 5, 3, { front: '#ffd35c' }, 'none');
    const tr: Pt[] = [{ x: -12, y: -h - 18 }, { x: 0, y: -h - 42 }, { x: 12, y: -h - 18 }];
    poly(ctx, tr, vg(ctx, -h - 42, -h - 18, lighten(P.roofBlue, 0.15), P.roofBlue), outline(P.roofBlue));
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -h - 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline('#ffd35c');
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = '#3a4560';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -h - 9);
    ctx.lineTo(0, -h - 13);
    ctx.moveTo(0, -h - 9);
    ctx.lineTo(2.4, -h - 8);
    ctx.stroke();
    for (let i = 0; i < 3; i++) win(ctx, x + 6 + i * 14, -h + 10, 9, 10, lit, { round: false, frame: '#ffffff' });
    win(ctx, x + w - 17, -h + 10, 9, 10, lit, { frame: '#ffffff' });
    archDoor(ctx, 5, 0, 14, 18, '#2a1d24', '#ef5a47');
    // colourful blocks sign
    const cols = [P.roofRed, P.roofBlue, P.roofGreen, P.roofPurple];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i];
      roundRect(ctx, x + 12 + i * 8, -h - 3 - (i % 2) * 0, 7, 7, 1.5);
      ctx.fill();
    }
  }
}

function hallFamily(ctx: Ctx, tier: number, lit: boolean): void {
  const stone = '#ddd3c0';
  if (tier === 6) {
    // plaza: flat roof, cornice, four columns + flags
    const w = 74;
    const h = 34;
    const x = -w / 2 - 4;
    box(ctx, x, 0, w, h, 14, 8, { front: stone, side: stone, top: '#c9bfae' }, 'brick');
    poly(ctx, [{ x: x - 3, y: -h }, { x: x + w + 3, y: -h }, { x: x + w + 17, y: -h - 8 }, { x: x + 11, y: -h - 8 }], lighten('#c9bfae', 0.1), outline('#c9bfae'));
    poly(ctx, [{ x: x - 3, y: -h }, { x: x + w + 3, y: -h }, { x: x + w + 3, y: -h + 4 }, { x: x - 3, y: -h + 4 }], '#b9ad98', outline('#b9ad98'));
    // columns
    for (let i = 0; i < 4; i++) {
      const cx = x + 10 + i * 17.3;
      const g = ctx.createLinearGradient(cx - 3, 0, cx + 3, 0);
      g.addColorStop(0, '#fffaf0');
      g.addColorStop(1, '#bfb4a1');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 3, -h + 4, 6, h - 7);
      ctx.strokeStyle = outline(stone);
      ctx.lineWidth = 0.9;
      ctx.strokeRect(cx - 3, -h + 4, 6, h - 7);
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(cx - 4.4, -h + 3, 8.8, 3);
      ctx.fillRect(cx - 4.4, -4, 8.8, 3);
    }
    archDoor(ctx, 0, 0, 16, 20, '#2a1d24', '#8a7a62');
    win(ctx, x + 14, -22, 9, 11, lit);
    win(ctx, x + w - 23, -22, 9, 11, lit);
    // flag poles
    for (const fx of [x + 4, x + w - 4]) {
      ctx.strokeStyle = '#8a8f99';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(fx, -h - 1);
      ctx.lineTo(fx, -h - 22);
      ctx.stroke();
    }
  } else if (tier === 7) {
    // hound hall: pediment, dome, steps
    const w = 70;
    const h = 36;
    const x = -w / 2 - 4;
    // dome
    const dg = ctx.createRadialGradient(-5, -h - 22, 2, 0, -h - 12, 22);
    dg.addColorStop(0, '#9fe6cf');
    dg.addColorStop(0.6, '#4fb89a');
    dg.addColorStop(1, '#2f8470');
    box(ctx, -14, -h, 28, 10, 5, 3, { front: stone }, 'none');
    ctx.beginPath();
    ctx.ellipse(0, -h - 10, 17, 16, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = outline('#4fb89a');
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = '#2a1d24';
    ctx.beginPath();
    ctx.moveTo(0, -h - 26);
    ctx.lineTo(0, -h - 32);
    ctx.stroke();
    box(ctx, x, 0, w, h, 14, 8, { front: stone, side: stone, top: '#c9bfae' }, 'brick');
    // pediment
    const ped: Pt[] = [{ x: x - 3, y: -h }, { x: 0, y: -h - 13 }, { x: x + w + 3, y: -h }];
    poly(ctx, ped, vg(ctx, -h - 13, -h, '#f6efe0', '#cfc4b0'), outline(stone));
    paw(ctx, 0, -h - 6, 6, '#b8743d');
    for (let i = 0; i < 5; i++) {
      const cx = x + 9 + i * 13.5;
      ctx.fillStyle = '#f8f2e4';
      ctx.fillRect(cx - 2.6, -h + 3, 5.2, h - 8);
      ctx.strokeStyle = outline(stone);
      ctx.lineWidth = 0.9;
      ctx.strokeRect(cx - 2.6, -h + 3, 5.2, h - 8);
    }
    archDoor(ctx, 0, -4, 14, 19, '#2a1d24', '#8a7a62');
    // steps
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = i ? '#cfc4b0' : '#e8dfcc';
      ctx.fillRect(x + 6 - i * 3, -4 + i * 2, w - 12 + i * 6, 2.4);
      ctx.strokeStyle = outline(stone);
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + 6 - i * 3, -4 + i * 2, w - 12 + i * 6, 2.4);
    }
    for (const fx of [x - 2, x + w + 2]) {
      ctx.strokeStyle = '#8a8f99';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(fx, -h - 1);
      ctx.lineTo(fx, -h - 20);
      ctx.stroke();
    }
  } else {
    // canine complex: modern stepped glass blocks with rooftop units
    const w = 76;
    const h = 30;
    const x = -w / 2 - 4;
    const wall = '#7e9bc4';
    box(ctx, x + 14, -h, w - 28, 26, 10, 6, { front: '#6d88b0', side: '#6d88b0', top: '#9ab4d6' }, 'glass');
    box(ctx, x, 0, w, h, 14, 8, { front: wall, side: wall, top: '#a9c2e2' }, 'none');
    const rows = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = lit ? (c + r) % 3 ? '#ffd986' : '#6a86b0' : (c + r) % 4 ? '#d4ecff' : '#9fc9ee';
        ctx.fillRect(x + 5 + c * 11.4, -h + 5 + r * 11, 8.4, 7.5);
      }
    }
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = lit ? '#ffd986' : '#cfe8ff';
      ctx.fillRect(x + 20 + c * 8.6, -h - 22, 6, 5);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + 2, -h + 2, w * 0.18, 3);
    archDoor(ctx, 0, 0, 12, 12, '#1d2a3a', '#d9e6f6');
    // rooftop units
    box(ctx, x + 6, -h - 7, 9, 7, 3, 2, { front: '#c3cad6' }, 'corrugated');
    box(ctx, x + w - 14, -h - 6, 8, 6, 3, 2, { front: '#c3cad6' }, 'corrugated');
    bone(ctx, 0, -h - 30, 14);
  }
}

function industrialFamily(ctx: Ctx, tier: number, lit: boolean): void {
  if (tier === 9) {
    // warehouse: corrugated, orange roller doors, sawtooth roof, smokestack
    const w = 80;
    const h = 30;
    const x = -w / 2 - 6;
    const wall = '#8fa0b4';
    box(ctx, x + w - 14, -h - 14, 7, 20, 3, 2, { front: '#b46a50' }, 'brick');
    box(ctx, x, 0, w, h, 14, 8, { front: wall, side: wall, top: '#6f7f93' }, 'corrugated', true);
    // sawtooth roof
    for (let i = 0; i < 3; i++) {
      const sx = x + 4 + i * 24;
      poly(ctx, [{ x: sx, y: -h }, { x: sx + 22, y: -h }, { x: sx + 22, y: -h - 10 }], darken('#6f7f93', 0.1), outline('#6f7f93'));
      poly(ctx, [{ x: sx, y: -h }, { x: sx + 22, y: -h - 10 }, { x: sx + 22 + 14, y: -h - 18 }, { x: sx + 14, y: -h - 8 }], lighten('#6f7f93', 0.12), outline('#6f7f93'));
    }
    poly(ctx, [{ x: x + w, y: -h }, { x: x + w + 14, y: -h - 8 }, { x: x + w + 14, y: -h - 18 }, { x: x + w, y: -h - 10 }], darken('#6f7f93', 0.15), outline('#6f7f93'));
    for (let i = 0; i < 2; i++) {
      const dx = x + 10 + i * 36;
      const g = ctx.createLinearGradient(0, -20, 0, 0);
      g.addColorStop(0, '#ffa63d');
      g.addColorStop(1, '#e07a12');
      ctx.fillStyle = g;
      ctx.fillRect(dx, -20, 26, 20);
      ctx.strokeStyle = outline('#e07a12');
      ctx.lineWidth = 1;
      ctx.strokeRect(dx, -20, 26, 20);
      ctx.strokeStyle = 'rgba(120,50,0,0.35)';
      for (let k = 1; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(dx, -20 + k * 4);
        ctx.lineTo(dx + 26, -20 + k * 4);
        ctx.stroke();
      }
    }
    win(ctx, x + w / 2 - 4, -h + 4, 8, 6, lit);
    // hazard stripe
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#2a2a30' : '#ffcf33';
      ctx.fillRect(x + 4 + i * 7.4, -3, 3.7, 3);
    }
  } else if (tier === 10) {
    // mutt mansion: cream walls, purple mansard roof, two turrets, many windows
    const w = 78;
    const h = 32;
    const x = -w / 2 - 4;
    const wall = '#f3e7cf';
    const roof = P.roofPurple;
    for (const tx of [x + 4, x + w - 8]) {
      box(ctx, tx - 7, 0, 14, h + 12, 5, 3, { front: wall }, 'none', true);
      poly(ctx, [{ x: tx - 10, y: -h - 12 }, { x: tx, y: -h - 34 }, { x: tx + 10, y: -h - 12 }], vg(ctx, -h - 34, -h - 12, lighten(roof, 0.25), roof), outline(roof));
      win(ctx, tx - 3, -h - 6, 6, 8, lit, { round: false });
      win(ctx, tx - 3, -14, 6, 8, lit);
    }
    box(ctx, x + 12, 0, w - 24, h, 12, 7, { front: wall, side: wall, top: roof }, 'none', true);
    const mr: Pt[] = [
      { x: x + 8, y: -h },
      { x: x + w - 8, y: -h },
      { x: x + w - 16, y: -h - 14 },
      { x: x + 16, y: -h - 14 },
    ];
    poly(ctx, [{ x: x + w - 8, y: -h }, { x: x + w - 8 + 12, y: -h - 7 }, { x: x + w - 16 + 12, y: -h - 21 }, { x: x + w - 16, y: -h - 14 }], darken(roof, 0.28), outline(roof));
    poly(ctx, mr, vg(ctx, -h - 14, -h, lighten(roof, 0.12), roof), outline(roof));
    shingles(ctx, mr, roof, 3.4);
    for (let i = 0; i < 3; i++) win(ctx, x + 18 + i * 14, -h - 12 + 0, 7, 8, lit, { round: true });
    for (let i = 0; i < 3; i++) win(ctx, x + 19 + i * 14, -h + 9, 7, 10, lit, { shutters: '#9a7bd8' });
    archDoor(ctx, 0, 0, 12, 16, '#2a1d24', '#c9a64a');
    ctx.fillStyle = '#e9d8a6';
    ctx.fillRect(-9, -22, 18, 3);
    ctx.strokeStyle = outline('#e9d8a6');
    ctx.strokeRect(-9, -22, 18, 3);
  } else {
    // tail tower: slim tower with observation deck + antenna
    const w = 26;
    const h = 66;
    const x = -w / 2;
    box(ctx, x - 14, 0, w + 28, 10, 12, 7, { front: '#e8e2d4' }, 'brick');
    const wall = '#d9dde6';
    box(ctx, x, -10, w, h, 9, 5, { front: wall, side: wall, top: '#aab2c0' }, 'none');
    for (let r = 0; r < 5; r++) {
      win(ctx, x + 5, -h - 4 + r * 11, 6, 7, lit);
      win(ctx, x + w - 11, -h - 4 + r * 11, 6, 7, lit);
    }
    // observation deck
    box(ctx, x - 8, -h - 10, w + 16, 9, 12, 6, { front: '#f2ece0', side: '#f2ece0', top: '#ef5a47' }, 'none');
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = lit ? '#ffd986' : '#bfe6ff';
      ctx.fillRect(x - 5 + i * 7.6, -h - 8, 5.4, 5);
    }
    ctx.strokeStyle = '#8a8f99';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, -h - 22);
    ctx.lineTo(4, -h - 40);
    ctx.stroke();
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(4, -h - 41, 2.4, 0, Math.PI * 2);
    ctx.fill();
    archDoor(ctx, -1, 0, 10, 12, '#1d2a3a', '#8a7a62');
  }
}

function skyscraperFamily(ctx: Ctx, tier: number, lit: boolean): void {
  if (tier === 12) {
    // pupscraper: tall glass tower with setbacks and lit windows
    const w = 40;
    const x = -w / 2;
    const glass = '#5d86b8';
    box(ctx, x - 6, 0, w + 12, 14, 12, 7, { front: '#8fa6c2', side: '#8fa6c2', top: '#b6c8de' }, 'none');
    box(ctx, x, -14, w, 56, 11, 6, { front: glass, side: glass, top: '#9ab8dc' }, 'none');
    box(ctx, x + 6, -70, w - 12, 34, 8, 4, { front: '#4f77a8', side: '#4f77a8', top: '#8fb0d8' }, 'none');
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 4; c++) {
        const on = (r * 5 + c * 3) % 4 !== 0;
        ctx.fillStyle = lit ? (on ? '#ffe08a' : '#52729c') : on ? '#d6efff' : '#9ec8ee';
        ctx.fillRect(x + 4 + c * 8.6, -66 + r * 7.4 - (r > 4 ? -5 : 0), 6, 5);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(x + 1, -14);
    ctx.lineTo(x + 8, -14);
    ctx.lineTo(x + 8 + 4, -58);
    ctx.lineTo(x + 1, -58);
    ctx.fill();
    ctx.strokeStyle = '#c6ccd8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -102);
    ctx.lineTo(0, -122);
    ctx.stroke();
    archDoor(ctx, 0, 0, 12, 11, '#1d2a3a', '#d9e6f6');
  } else if (tier === 13) {
    // bark bunker: rocky hill + concrete door + radar dish
    const rock = '#8d8a95';
    ctx.beginPath();
    ctx.moveTo(-46, 0);
    ctx.quadraticCurveTo(-40, -34, -14, -42);
    ctx.quadraticCurveTo(4, -52, 24, -38);
    ctx.quadraticCurveTo(46, -28, 48, 0);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, -50, 0, 0);
    rg.addColorStop(0, lighten(rock, 0.28));
    rg.addColorStop(1, darken(rock, 0.18));
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = outline(rock);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(40,30,50,0.2)';
    ctx.lineWidth = 1.1;
    for (const [a, b, c, d] of [[-30, -22, -22, -14], [10, -34, 16, -26], [28, -20, 36, -12], [-10, -30, -2, -24], [-36, -8, -28, -2]] as const) {
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(-14, -40, 22, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // concrete bunker front
    box(ctx, -26, 0, 52, 24, 10, 5, { front: '#a9acb6', side: '#a9acb6', top: '#c4c7d0' }, 'none');
    ctx.fillStyle = '#3a3d48';
    ctx.fillRect(-20, -17, 12, 3.4);
    ctx.fillRect(8, -17, 12, 3.4);
    if (lit) {
      ctx.fillStyle = '#ffd986';
      ctx.fillRect(-19, -16.5, 10, 2.4);
      ctx.fillRect(9, -16.5, 10, 2.4);
    }
    // heavy door
    ctx.fillStyle = '#585c68';
    roundRect(ctx, -8, -16, 16, 16, 2);
    ctx.fill();
    ctx.strokeStyle = outline('#585c68');
    ctx.lineWidth = 1.2;
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#2a2a30' : '#ffcf33';
      ctx.fillRect(-8 + i * 4, -3, 4, 3);
    }
    paw(ctx, 0, -10, 6, '#ffcf33');
    // dish on top
    ctx.strokeStyle = '#6e7280';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, -44);
    ctx.lineTo(10, -52);
    ctx.stroke();
  } else {
    // sky kennel: cloud platform with a cosy house on top (floats)
    ctx.translate(0, -14);
    cloud(ctx, 0, 8, 1.05);
    gableHouse(ctx, 0, 2, 34, 20, 14, 8, 5, '#fdf3dc', P.roofBlue, 'none');
    archDoor(ctx, 0, 2, 11, 15);
    plaque(ctx, 0, -26, 9, 7);
    ctx.translate(0, 14);
  }
}

function cloud(ctx: Ctx, cx: number, cy: number, s: number): void {
  const blobs: [number, number, number][] = [
    [-26, 4, 11],
    [-12, -1, 14],
    [6, -3, 15],
    [22, 2, 12],
    [34, 6, 8],
    [-34, 8, 7],
  ];
  const g = ctx.createLinearGradient(0, cy - 16 * s, 0, cy + 12 * s);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#cfe6fb');
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = '#a9c8ea';
  ctx.lineJoin = 'round';
  for (const [bx, by, r] of blobs) {
    ctx.beginPath();
    ctx.arc(cx + bx * s, cy + by * s, r * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = g;
  for (const [bx, by, r] of blobs) {
    ctx.beginPath();
    ctx.arc(cx + bx * s, cy + by * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function spaceFamily(ctx: Ctx, tier: number, lit: boolean): void {
  ctx.translate(0, -14);
  if (tier === 15) {
    // orbital kennel: metal disc platform, glow ring, dish + solar panels
    const ring = ctx.createRadialGradient(0, 4, 18, 0, 4, 44);
    ring.addColorStop(0, 'rgba(120,200,255,0)');
    ring.addColorStop(0.7, 'rgba(120,200,255,0.35)');
    ring.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.save();
    ctx.scale(1, 0.4);
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(0, 10, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // disc
    const dg = ctx.createLinearGradient(0, -6, 0, 12);
    dg.addColorStop(0, '#e6ebf5');
    dg.addColorStop(1, '#8e99b0');
    ctx.beginPath();
    ctx.ellipse(0, 8, 38, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = darken('#8e99b0', 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 4, 38, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = outline('#8e99b0');
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 3, 27, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c3cbe0';
    ctx.fill();
    // dome module
    box(ctx, -14, 2, 28, 16, 8, 4, { front: '#dfe5f2', side: '#dfe5f2', top: '#f4f7fc' }, 'none');
    ctx.beginPath();
    ctx.ellipse(0, -14, 12, 9, 0, Math.PI, 0);
    ctx.fillStyle = 'rgba(160,220,255,0.75)';
    ctx.fill();
    ctx.strokeStyle = outline('#6fb2ea');
    ctx.stroke();
    win(ctx, -4, -9, 8, 7, lit, { round: true });
    // solar panels
    for (const s of [-1, 1]) {
      poly(ctx, [{ x: s * 14, y: -8 }, { x: s * 38, y: -12 }, { x: s * 38, y: -24 }, { x: s * 14, y: -20 }], vg(ctx, -24, -8, '#4a8fe7', '#2f5fb0'), outline('#2f5fb0'));
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.8;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(s * (14 + k * 6), -8 - k * 1);
        ctx.lineTo(s * (14 + k * 6), -20 - k * 1);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#c6ccd8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(0, -34);
    ctx.stroke();
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(0, -35, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (tier === 16) {
    // moon pound: cratered moon rock, glass dome, flag, stars
    const rock = '#c9ccd8';
    ctx.beginPath();
    ctx.moveTo(-40, 6);
    ctx.quadraticCurveTo(-38, -14, -14, -18);
    ctx.quadraticCurveTo(10, -24, 32, -14);
    ctx.quadraticCurveTo(46, -6, 40, 8);
    ctx.quadraticCurveTo(10, 24, -40, 6);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, -22, 0, 22);
    rg.addColorStop(0, lighten(rock, 0.4));
    rg.addColorStop(0.55, rock);
    rg.addColorStop(1, darken(rock, 0.3));
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = outline(rock);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    for (const [cx, cy, rx, ry] of [[-24, 0, 7, 3], [26, -2, 6, 2.6], [8, 11, 9, 3.2], [-8, 13, 5, 2]] as const) {
      ctx.fillStyle = 'rgba(70,70,95,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(cx - 0.5, cy - 0.8, rx, ry, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    // dome habitat
    box(ctx, -12, -8, 24, 8, 6, 3, { front: '#eef0f7', side: '#eef0f7', top: '#ffffff' }, 'none');
    const dg = ctx.createRadialGradient(-5, -26, 2, 0, -14, 17);
    dg.addColorStop(0, 'rgba(235,250,255,0.95)');
    dg.addColorStop(1, 'rgba(130,200,240,0.7)');
    ctx.beginPath();
    ctx.ellipse(0, -8, 15, 18, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = outline('#7fbfe8');
    ctx.lineWidth = 1.4;
    ctx.stroke();
    archDoor(ctx, 0, -8, 9, 10, '#2a1d24', '#8a8f99');
    win(ctx, -10, -18, 5, 5, lit, { round: true });
    ctx.strokeStyle = '#d9dde6';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(26, -6);
    ctx.lineTo(26, -24);
    ctx.stroke();
  } else {
    // planet paw: ringed planet with a kennel dome
    const pg = ctx.createRadialGradient(-10, -12, 3, 0, 0, 30);
    pg.addColorStop(0, '#ffd4a1');
    pg.addColorStop(0.5, '#ef8f5c');
    pg.addColorStop(1, '#a9486a');
    // back ring
    ctx.strokeStyle = 'rgba(255,230,170,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 2, 44, 10, -0.18, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -6, 26, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = outline('#c5603e');
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -6, 26, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (const [cx, cy, rx, ry] of [[-6, -16, 14, 3], [4, -2, 20, 3.4], [-4, 10, 18, 3]] as const) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // dome kennel on top
    ctx.beginPath();
    ctx.ellipse(0, -28, 11, 10, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(190,235,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = outline('#7fbfe8');
    ctx.lineWidth = 1.4;
    ctx.stroke();
    gableHouse(ctx, 0, -28, 11, 6, 5, 3, 2, '#fdf3dc', P.roofRed, 'none');
    // front ring
    ctx.strokeStyle = 'rgba(255,238,190,0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 2, 44, 10, -0.18, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,120,60,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 4.5, 44, 10, -0.18, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  ctx.translate(0, 14);
}

function starsDeco(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(255,248,200,0.95)';
  ctx.beginPath();
  star4(ctx, -46, -60, 4);
  star4(ctx, 44, -48, 3.4);
  star4(ctx, 30, -78, 2.6);
  star4(ctx, -34, -30, 2.4);
  ctx.fill();
}

export const KENNEL_FX: KennelFx[] = [
  { door: { x: -3, y: -3 }, hw: 24, height: 38 },
  { door: { x: -15, y: -3 }, hw: 38, height: 40 },
  { door: { x: -4, y: -3 }, hw: 42, height: 38 },
  { door: { x: 0, y: -3 }, hw: 34, height: 58 },
  { door: { x: 0, y: -3 }, smoke: { x: 18, y: -66 }, hw: 38, height: 62 },
  { door: { x: 5, y: -3 }, flags: [], hw: 40, height: 66 },
  { door: { x: 0, y: -3 }, flags: [{ x: -41, y: -56 }, { x: 33, y: -56 }], hw: 42, height: 46 },
  { door: { x: 0, y: -4 }, flags: [{ x: -39, y: -56 }, { x: 35, y: -56 }], hw: 40, height: 76 },
  { door: { x: 0, y: -3 }, blink: [{ x: 0, y: -66 }], hw: 42, height: 56 },
  { door: { x: -10, y: -3 }, smoke: { x: 31, y: -56 }, hw: 46, height: 52 },
  { door: { x: 0, y: -3 }, hw: 44, height: 80 },
  { door: { x: -1, y: -3 }, blink: [{ x: 4, y: -118 }], hw: 28, height: 118 },
  { door: { x: 0, y: -3 }, blink: [{ x: 0, y: -122 }], hw: 30, height: 124 },
  { door: { x: 0, y: -3 }, dish: { x: 10, y: -52 }, hw: 34, height: 54 },
  { door: { x: 0, y: -17 }, floating: true, hw: 36, height: 70 },
  { door: { x: 0, y: -10 }, floating: true, blink: [{ x: 0, y: -49 }], sparkles: true, hw: 40, height: 60 },
  { door: { x: 0, y: -22 }, floating: true, flags: [{ x: 26, y: -38 }], sparkles: true, hw: 40, height: 56 },
  { door: { x: 0, y: -30 }, floating: true, sparkles: true, hw: 40, height: 66 },
];

export const KENNEL_COUNT = KENNEL_FX.length;

/** Draw a kennel body (no shadow) in local space. */
export function drawKennelBody(ctx: Ctx, tier: number, lit: boolean): void {
  ctx.save();
  ctx.translate(BLD_AX, BLD_AY);
  if (tier >= 15) starsDeco(ctx);
  if (tier <= 2) woodFamily(ctx, tier, lit);
  else if (tier <= 5) barnFamily(ctx, tier, lit);
  else if (tier <= 8) hallFamily(ctx, tier, lit);
  else if (tier <= 11) industrialFamily(ctx, tier, lit);
  else if (tier <= 14) skyscraperFamily(ctx, tier, lit);
  else spaceFamily(ctx, tier, lit);
  ctx.restore();
}

// ------------------------------------------------------------------ adoption centre

export const ADOPT_W = 130;
export const ADOPT_H = 112;
export const ADOPT_AX = 52;
export const ADOPT_AY = 92;

export function drawAdoptionShadow(ctx: Ctx, dpr: number): void {
  ctx.save();
  ctx.translate(ADOPT_AX, ADOPT_AY);
  const w = 66;
  const x = -w / 2;
  const dx = 14;
  const dy = 8;
  softPoly(
    ctx,
    hull([
      { x: x, y: 1 }, { x: x + w, y: 1 }, { x: x + w + dx, y: 1 - dy }, { x: x + dx, y: 1 - dy },
      { x: x + 30, y: 8 }, { x: x + w + 30, y: 8 }, { x: x + w + dx + 30, y: 8 - dy }, { x: x + dx + 30, y: 8 - dy },
    ]),
    0.18,
    3.5,
    dpr,
  );
  ctx.strokeStyle = 'rgba(25,12,40,0.28)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 1, 1.2);
  ctx.lineTo(x + w + 1, 1.2);
  ctx.lineTo(x + w + dx + 1, 1.2 - dy);
  ctx.stroke();
  ctx.restore();
}

export function drawAdoptionCenter(ctx: Ctx, lit: boolean): void {
  ctx.save();
  ctx.translate(ADOPT_AX, ADOPT_AY);
  const w = 66;
  const h = 34;
  const x = -w / 2;
  const dx = 14;
  const dy = 8;
  const wall = '#fff1d6';
  const roofC = '#2fb7a6';
  box(ctx, x, 0, w, h, dx, dy, { front: wall, side: wall, top: roofC }, 'none', true);
  // flat roof with a raised sign
  poly(ctx, [{ x: x - 4, y: -h + 1 }, { x: x + w + 4, y: -h + 1 }, { x: x + w + dx + 4, y: -h - dy }, { x: x + dx - 2, y: -h - dy }], vg(ctx, -h - dy, -h, lighten(roofC, 0.25), roofC), outline(roofC));
  poly(ctx, [{ x: x - 4, y: -h + 1 }, { x: x + w + 4, y: -h + 1 }, { x: x + w + 4, y: -h + 5 }, { x: x - 4, y: -h + 5 }], darken(roofC, 0.12), outline(roofC));
  // sign board on the roof
  poly(ctx, [{ x: -22, y: -h - 2 }, { x: 22, y: -h - 2 }, { x: 22, y: -h - 22 }, { x: -22, y: -h - 22 }], vg(ctx, -h - 22, -h - 2, '#fffdf6', '#f2e6c8'), outline('#d9b36a'), 2);
  paw(ctx, -9, -h - 12, 7.5, '#ef5a47');
  bone(ctx, 10, -h - 12, 18, '#ffcb3d');
  ctx.strokeStyle = '#8a5428';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, -h - 1);
  ctx.lineTo(-16, -h + 2);
  ctx.moveTo(16, -h - 1);
  ctx.lineTo(16, -h + 2);
  ctx.stroke();
  // windows
  win(ctx, x + 6, -24, 11, 12, lit, { shutters: '#2fb7a6' });
  win(ctx, x + w - 17, -24, 11, 12, lit, { shutters: '#2fb7a6' });
  // doorway (leaf is drawn live)
  ctx.fillStyle = '#c9a15a';
  roundRect(ctx, -12.5, -25, 25, 25, 3);
  ctx.fill();
  ctx.strokeStyle = outline('#c9a15a');
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const dg = ctx.createLinearGradient(0, -23, 0, 0);
  dg.addColorStop(0, '#2a1a22');
  dg.addColorStop(1, '#5a3a2a');
  ctx.fillStyle = dg;
  roundRect(ctx, -10.5, -23, 21, 23, 2);
  ctx.fill();
  const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
  gg.addColorStop(0, 'rgba(255,210,120,0.65)');
  gg.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(-12, -23, 24, 23);
  // awning
  const aw: Pt[] = [{ x: -17, y: -25 }, { x: 17, y: -25 }, { x: 20, y: -18 }, { x: -20, y: -18 }];
  poly(ctx, aw, '#fff', outline('#ef5a47'));
  ctx.save();
  ctx.clip(pathOf(aw));
  ctx.fillStyle = '#ef5a47';
  for (let i = -3; i < 4; i += 2) ctx.fillRect(i * 5.8 - 2.9, -26, 5.8, 9);
  ctx.restore();
  ctx.lineWidth = OW;
  ctx.strokeStyle = outline('#ef5a47');
  ctx.stroke(pathOf(aw));
  // path mat
  ctx.fillStyle = '#ef5a47';
  roundRect(ctx, -9, 1, 18, 4, 2);
  ctx.fill();
  // balloon bunch on the right
  for (const [bx, by, col] of [[x + w + 5, -34, '#ffcb3d'], [x + w + 11, -40, '#4aa8ff'], [x + w + 1, -42, '#ef5a47']] as const) {
    ctx.strokeStyle = 'rgba(80,60,60,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + w + 5, -6);
    ctx.lineTo(bx, by + 6);
    ctx.stroke();
    const bg = ctx.createRadialGradient(bx - 2, by - 3, 1, bx, by, 7);
    bg.addColorStop(0, lighten(col, 0.5));
    bg.addColorStop(1, col);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(bx, by, 5.6, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline(col);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

/** door leaf drawn live; hinge at left edge. logical size 14 x 26 */
export function drawDoorLeaf(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, 14, 0);
  g.addColorStop(0, '#e5b068');
  g.addColorStop(1, '#b8743d');
  ctx.fillStyle = g;
  roundRect(ctx, 0.5, 0.5, 12, 22, 2);
  ctx.fill();
  ctx.strokeStyle = outline('#b8743d');
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(10, 12, 1.1, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------ mailbox

export const MAIL_W = 44;
export const MAIL_H = 64;
export const MAIL_AX = 20;
export const MAIL_AY = 56;

export function drawMailShadow(ctx: Ctx, dpr: number): void {
  ctx.save();
  ctx.translate(MAIL_AX, MAIL_AY);
  softPoly(ctx, [{ x: -4, y: 1 }, { x: 5, y: 1 }, { x: 25, y: 7 }, { x: 14, y: 9 }], 0.2, 2.5, dpr);
  ctx.restore();
}

export function drawMailbox(ctx: Ctx): void {
  ctx.save();
  ctx.translate(MAIL_AX, MAIL_AY);
  // post
  box(ctx, -2.5, 0, 5, 30, 2.5, 1.5, { front: '#c98e52', side: '#c98e52' }, 'planks');
  // base mound
  ctx.fillStyle = '#7fd35b';
  ctx.beginPath();
  ctx.ellipse(0, 0.5, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // box body: front lit, side darker, rounded top
  const w = 22;
  const h = 14;
  const bx = -w / 2 - 1;
  const by = -30;
  const red = '#e4453a';
  poly(ctx, [{ x: bx + w, y: by }, { x: bx + w + 6, y: by - 3 }, { x: bx + w + 6, y: by - h - 3 }, { x: bx + w, y: by - h }], vg(ctx, by - h, by, darken(red, 0.2), darken(red, 0.4)), outline(red));
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, by - h + 6);
  ctx.quadraticCurveTo(bx, by - h - 1, bx + 8, by - h - 1);
  ctx.lineTo(bx + w - 8, by - h - 1);
  ctx.quadraticCurveTo(bx + w, by - h - 1, bx + w, by - h + 6);
  ctx.lineTo(bx + w, by);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, by - h, 0, by);
  g.addColorStop(0, lighten(red, 0.3));
  g.addColorStop(0.5, red);
  g.addColorStop(1, darken(red, 0.2));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = outline(red);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const fp = new Path2D();
  fp.moveTo(bx, by);
  fp.lineTo(bx, by - h + 6);
  fp.quadraticCurveTo(bx, by - h - 1, bx + 8, by - h - 1);
  fp.lineTo(bx + w - 8, by - h - 1);
  fp.quadraticCurveTo(bx + w, by - h - 1, bx + w, by - h + 6);
  fp.lineTo(bx + w, by);
  fp.closePath();
  rimLight(ctx, fp, '#fff', darken(red, 0.5), 0.5, 0.2, 1.1);
  // door line + slot + handle
  ctx.fillStyle = 'rgba(60,10,10,0.35)';
  roundRect(ctx, bx + 4, by - h + 3.5, 14, 2.4, 1);
  ctx.fill();
  ctx.fillStyle = '#ffd86b';
  ctx.beginPath();
  ctx.arc(bx + w - 5, by - 5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** flag sprite, pivot at (4, 22) (bottom-left), drawn rotated live; logical 20 x 26 */
export function drawMailFlag(ctx: Ctx): void {
  ctx.fillStyle = '#d9d3c8';
  ctx.strokeStyle = outline('#d9d3c8');
  ctx.lineWidth = 1;
  roundRect(ctx, 2.5, 3, 3, 20, 1.2);
  ctx.fill();
  ctx.stroke();
  const g = ctx.createLinearGradient(0, 3, 0, 12);
  g.addColorStop(0, '#ffe27a');
  g.addColorStop(1, '#ffb52e');
  ctx.fillStyle = g;
  ctx.beginPath();
  roundRect(ctx, 5, 2.5, 12, 8.5, 1.8);
  ctx.fill();
  ctx.strokeStyle = outline('#ffb52e');
  ctx.stroke();
}

export function mixCol(a: string, b: string, t: number): string {
  return mix(a, b, t);
}
