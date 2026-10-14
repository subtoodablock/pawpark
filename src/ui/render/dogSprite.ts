// Procedural dog drawing: one breed x pose x frame is baked into the SpriteCache.
// Chibi style (Egg-Inc-like): oversized round head, bean body, stubby capsule legs with lighter paw tips.
// Tail is a separate sprite so the wag can be applied live as a rotation (hidden for the curled-up nap,
// where the tail is wrapped around the body inside the body sprite).
import type { Breed, Mark } from './breeds';
import {
  type Ctx,
  type Pt,
  capsulePts,
  darken,
  ellipsePts,
  lighten,
  outline,
  pathFromPts,
  rgba,
  rimLight,
  rng,
  scallopPath,
  shift,
  smoothPath,
} from './shade';

export type Pose = 'walk' | 'run' | 'sit' | 'dig' | 'nap' | 'sniff';
export const POSE_FRAMES: Record<Pose, number> = { walk: 8, run: 4, sit: 1, dig: 2, nap: 1, sniff: 1 };

/** logical sprite box + ground anchor (feet centre) */
export const DOG_W = 76;
export const DOG_H = 52;
export const DOG_AX = 36;
export const DOG_AY = 44;
export const TAIL_W = 44;
export const TAIL_AX = 22;
export const TAIL_AY = 22;
/** dog unit -> css px */
export const DOG_K = 0.9;
const PUP = 0.8;
const OW = 1.6;
const TAU = Math.PI * 2;

interface Leg {
  /** top (hidden inside the body) */
  x: number;
  y: number;
  /** paw end */
  ex: number;
  ey: number;
  near: boolean;
  /** drawn over the body (sitting forelegs) */
  over: boolean;
}
interface Paw {
  x: number;
  y: number;
  rx: number;
  ry: number;
}
interface Skel {
  hip: Pt;
  sh: Pt;
  rh: number;
  rs: number;
  head: Pt;
  headRot: number;
  legs: Leg[];
  tail: Pt;
  tailRest: number;
  tailHide: boolean;
  closedEyes: boolean;
  tongue: boolean;
  pose: Pose;
  /** whole-body waddle: rotation / squash-stretch about the body base */
  tilt: number;
  sx: number;
  sy: number;
  pivot: Pt;
  /** extra haunch circle (sit) */
  haunch: { p: Pt; r: number } | null;
  paws: Paw[];
  /** 0..1 ears blown back */
  earBack: number;
  /** curled-up ball (nap) */
  ball: boolean;
}

export function dogKey(breed: number, pose: Pose, frame: number, pup: boolean): string {
  return `dog:${breed}:${pose}:${frame}:${pup ? 1 : 0}`;
}
export function tailKey(breed: number, pup: boolean): string {
  return `tail:${breed}:${pup ? 1 : 0}`;
}

function dims(b: Breed, pup: boolean) {
  const bodyH = b.bodyH * (pup ? 0.9 : 1);
  return {
    r: bodyH / 2,
    legH: b.legH * (pup ? 0.85 : 1),
    hr: b.headR * (pup ? 1.24 : 1),
    bodyL: b.bodyL * (pup ? 0.82 : 1),
    legR: 3.05 * b.legW * (pup ? 1.05 : 1),
  };
}

function skeleton(b: Breed, pose: Pose, f: number, pup: boolean): Skel {
  const { r, legH, hr, bodyL: bl0, legR } = dims(b, pup);
  const n = POSE_FRAMES[pose];
  const th = (f / n) * TAU;
  const by0 = -(legH + r) + 0.6;
  let bodyL = bl0;
  const rh = r * 1.03;
  const rs = r * 0.97;
  const sk: Skel = {
    hip: { x: -bodyL / 2, y: by0 },
    sh: { x: bodyL / 2, y: by0 },
    rh,
    rs,
    head: { x: 0, y: 0 },
    headRot: 0,
    legs: [],
    tail: { x: 0, y: 0 },
    tailRest: 0,
    tailHide: false,
    closedEyes: false,
    tongue: false,
    pose,
    tilt: 0,
    sx: 1,
    sy: 1,
    pivot: { x: 0, y: -legH },
    haunch: null,
    paws: [],
    earBack: 0,
    ball: false,
  };
  const far = 2.4;
  const hx = (): number => sk.hip.x - rh * 0.1;
  const fx = (): number => sk.sh.x + rs * 0.1;
  const topY = (): number => by0 + r * 0.35;
  const leg = (x: number, near: boolean, ox: number, lift: number, over = false): void => {
    sk.legs.push({ x, y: topY(), ex: x + ox, ey: -legR - lift, near, over });
  };
  let headDy = 0;
  switch (pose) {
    case 'walk': {
      // waddle: body bobs twice per stride, rocks side to side, squashes on contact
      const ph = th + Math.PI / 2;
      const bob = Math.abs(Math.cos(ph));
      const by = by0 - bob * 1.6;
      sk.hip.y = sk.sh.y = by;
      sk.tilt = Math.cos(ph) * 0.07;
      sk.sy = 1 + (bob - 0.5) * 0.07;
      sk.sx = 1 - (bob - 0.5) * 0.05;
      const sw = 2.5;
      const lf = 2.4;
      const mk = (x: number, near: boolean, p: number): void => leg(x, near, Math.sin(p) * sw, Math.max(0, Math.cos(p)) * lf);
      mk(hx() + far, false, ph);
      mk(fx() + far, false, ph + Math.PI);
      mk(hx(), true, ph + Math.PI);
      mk(fx(), true, ph);
      headDy = -Math.sin(2 * ph) * 0.4;
      break;
    }
    case 'run': {
      bodyL *= 1.15;
      sk.hip.x = -bodyL / 2;
      sk.sh.x = bodyL / 2;
      const air = Math.max(0, Math.sin(th)) * 2.0;
      const by = by0 - air - 0.5;
      sk.hip.y = by + Math.sin(th) * 1.0;
      sk.sh.y = by - Math.sin(th) * 1.0;
      sk.tilt = -Math.sin(th) * 0.035;
      sk.sy = 1 + Math.sin(th) * 0.04;
      sk.sx = 1 - Math.sin(th) * 0.03 + 0.03;
      const reach = 4.2;
      const mk = (x: number, near: boolean, p: number): void => leg(x, near, Math.cos(p) * reach, Math.max(0, Math.sin(p)) * 3.2);
      mk(hx() + far, false, th + Math.PI * 0.95);
      mk(fx() + far, false, th + 0.4);
      mk(hx(), true, th + Math.PI);
      mk(fx(), true, th);
      headDy = -Math.sin(th) * 0.4 - 0.2;
      sk.headRot = -0.08;
      sk.tongue = true;
      sk.tailRest = 0.3;
      sk.earBack = 1;
      break;
    }
    case 'sniff': {
      sk.sh.y = by0 + 1.2;
      sk.tilt = 0.03;
      leg(hx() + far, false, 0.4, 0);
      leg(fx() + far, false, 1.4, 0);
      leg(hx(), true, -0.5, 0);
      leg(fx(), true, 0.5, 0);
      sk.headRot = 0.5;
      break;
    }
    case 'dig': {
      sk.sh.y = by0 + 3.2;
      sk.hip.y = by0 - 0.8;
      const a0 = f === 0;
      leg(hx() + far, false, 0.3, 0);
      leg(hx(), true, -0.4, 0);
      // forelegs scratch forward / back alternately
      sk.legs.push({ x: fx() + far, y: sk.sh.y + r * 0.35, ex: fx() + far + (a0 ? 4.8 : 0.4), ey: -legR - (a0 ? 0 : 2.8), near: false, over: false });
      sk.legs.push({ x: fx(), y: sk.sh.y + r * 0.35, ex: fx() + (a0 ? 0.2 : 5), ey: -legR - (a0 ? 2.6 : 0), near: true, over: false });
      sk.headRot = 0.75;
      sk.tailRest = 0.5;
      break;
    }
    case 'sit': {
      const hipY = -r * 0.98;
      sk.hip = { x: -bl0 * 0.5 - 2.5, y: hipY };
      const ang = -1.2;
      const L = bl0 * 0.5 + r * 0.42;
      sk.sh = { x: sk.hip.x + Math.cos(ang) * L, y: sk.hip.y + Math.sin(ang) * L };
      sk.rh = r * 1.06;
      sk.rs = r * 0.95;
      sk.haunch = { p: { x: sk.hip.x + 0.8, y: -r * 0.92 }, r: r * 0.98 };
      const fy = sk.sh.y + r * 0.45;
      sk.legs.push({ x: sk.sh.x + 4 + far * 0.7, y: fy, ex: sk.sh.x + 4.6 + far * 0.7, ey: -legR, near: false, over: true });
      sk.legs.push({ x: sk.sh.x + 3.6, y: fy, ex: sk.sh.x + 3.8, ey: -legR, near: true, over: true });
      sk.paws.push({ x: sk.hip.x + r * 1.45, y: -1.9, rx: 4.3, ry: 2.2 });
      sk.tailRest = -1.0;
      sk.headRot = -0.1;
      break;
    }
    case 'nap': {
      // curled-up ball, head resting on the front paws
      bodyL = Math.min(bodyL, 4);
      const R = r * 1.16;
      const cx = -2.5;
      const cy = -R + 0.7;
      sk.hip = { x: cx - bodyL / 2, y: cy };
      sk.sh = { x: cx + bodyL / 2, y: cy };
      sk.rh = R * 1.02;
      sk.rs = R;
      sk.ball = true;
      sk.tailHide = true;
      sk.closedEyes = true;
      sk.tailRest = 0;
      sk.headRot = 0.14;
      const hxp = cx + R * 0.58 + hr * 0.52;
      sk.head = { x: hxp, y: -hr * 0.9 };
      sk.paws.push({ x: hxp + hr * 0.3, y: -2.1, rx: 3.5, ry: 2.3 });
      sk.paws.push({ x: hxp + hr * 0.78, y: -1.8, rx: 3.3, ry: 2.1 });
      sk.tail = { x: sk.hip.x, y: sk.hip.y };
      return sk;
    }
  }
  // head
  if (pose === 'sit') {
    sk.head = { x: sk.sh.x + 2.6 + hr * 0.2, y: sk.sh.y - sk.rs * 0.5 - hr * 0.58 };
  } else if (pose === 'sniff') {
    sk.head = { x: sk.sh.x + sk.rs * 0.55 + hr * 0.42, y: Math.min(sk.sh.y - 0.4, -hr * 0.82) };
  } else if (pose === 'dig') {
    sk.head = { x: sk.sh.x + sk.rs * 0.55 + hr * 0.42, y: Math.min(sk.sh.y + 0.4, -hr * 0.8) };
  } else {
    sk.head = { x: sk.sh.x + 2.7 + hr * 0.26, y: sk.sh.y - sk.rs * 0.5 - hr * 0.56 + headDy };
  }
  sk.tail = { x: sk.hip.x - sk.rh * 0.78, y: sk.hip.y - sk.rh * 0.28 };
  return sk;
}

export function tailAnchor(b: Breed, pose: Pose, f: number, pup: boolean): { x: number; y: number; rest: number; hide: boolean } {
  const sk = skeleton(b, pose, f, pup);
  const s = DOG_K * b.size * (pup ? PUP : 1);
  // the tail sprite hangs off the body group, which is rotated by `tilt` about the pivot: apply it to the anchor
  const c = Math.cos(sk.tilt);
  const sn = Math.sin(sk.tilt);
  const dx = sk.tail.x - sk.pivot.x;
  const dy = sk.tail.y - sk.pivot.y;
  const tx = sk.pivot.x + (dx * c - dy * sn) * sk.sx;
  const ty = sk.pivot.y + (dx * sn + dy * c) * sk.sy;
  return { x: DOG_AX + tx * s, y: DOG_AY + ty * s, rest: sk.tailRest + sk.tilt, hide: sk.tailHide };
}

// ------------------------------------------------------------------ drawing helpers

function fillOutlined(ctx: Ctx, paths: Path2D[], fill: string | CanvasGradient, oc: string, ow = OW): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = ow * 2;
  ctx.strokeStyle = oc;
  for (const p of paths) ctx.stroke(p);
  ctx.fillStyle = fill;
  for (const p of paths) ctx.fill(p);
}

function vgrad(ctx: Ctx, y0: number, y1: number, top: string, mid: string, bot: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(0.42, mid);
  g.addColorStop(1, bot);
  return g;
}

function drawMarks(ctx: Ctx, marks: Mark[]): void {
  for (const m of marks) {
    if (m.k === 'e') {
      ctx.fillStyle = m.col;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.rx, m.ry, m.rot ?? 0, 0, TAU);
      ctx.fill();
    } else {
      const r = rng(m.seed);
      ctx.fillStyle = m.col;
      for (let i = 0; i < m.n; i++) {
        const a = r() * TAU;
        const d = Math.sqrt(r());
        const x = (m.ox ?? 0) + Math.cos(a) * d * m.rx;
        const y = (m.oy ?? 0) + Math.sin(a) * d * m.ry;
        const rad = m.rMin + r() * (m.rMax - m.rMin);
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * (0.85 + r() * 0.25), r() * 3, 0, TAU);
        ctx.fill();
      }
    }
  }
}

/**
 * Soft, short, low-contrast fur strokes that follow the body curvature (concentric arcs around the centre).
 * `amp` is the lightness swing (about +-6%).
 */
function softFur(ctx: Ctx, rnd: () => number, cx: number, cy: number, rx: number, ry: number, n: number, base: string, amp = 0.07): void {
  if (n <= 0) return;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.0;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const f = 0.38 + rnd() * 0.6;
    const px = cx + Math.cos(a) * rx * f;
    const py = cy + Math.sin(a) * ry * f;
    // tangent of the ellipse at this angle
    let tx = -Math.sin(a) * rx;
    let ty = Math.cos(a) * ry;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const l = 1.7 + rnd() * 1.6;
    // bow toward the centre so the stroke hugs the form
    const bx = -Math.cos(a) * 0.5;
    const by = -Math.sin(a) * 0.5;
    ctx.strokeStyle = rgba(shift(base, rnd() < 0.5 ? amp * 10 : -amp * 10), 0.42);
    ctx.beginPath();
    ctx.moveTo(px - tx * l, py - ty * l);
    ctx.quadraticCurveTo(px + bx, py + by, px + tx * l, py + ty * l);
    ctx.stroke();
  }
}

function limb(ctx: Ctx, b: Breed, l: Leg, far: boolean, legR: number): void {
  const r1 = legR * 1.12;
  const r2 = legR * 0.98;
  const p = pathFromPts(capsulePts(l.x, l.y, r1, l.ex, l.ey, r2, 8));
  const col = far ? darken(b.base, 0.26) : b.base;
  ctx.lineJoin = 'round';
  ctx.lineWidth = OW * 2;
  ctx.strokeStyle = outline(col);
  ctx.stroke(p);
  const g = ctx.createLinearGradient(l.ex - r2, 0, l.ex + r2, 0);
  g.addColorStop(0, far ? col : lighten(col, 0.12));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darken(col, far ? 0.12 : 0.2));
  ctx.fillStyle = g;
  ctx.fill(p);
  // lighter paw tip
  const sock = b.sockCol;
  let tip = sock ?? lighten(b.base, 0.2);
  if (far) tip = darken(tip, 0.24);
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = tip;
  ctx.beginPath();
  ctx.ellipse(l.ex, l.ey + r2 * 0.22, r2 * 1.5, sock ? r2 * 1.15 : r2 * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // toe line
  ctx.strokeStyle = rgba(darken(sock ?? col, 0.5), far ? 0.2 : 0.35);
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(l.ex + 0.7, l.ey + r2 * 0.25);
  ctx.lineTo(l.ex + 0.7, l.ey + r2 * 0.9);
  ctx.stroke();
}

function flatPaw(ctx: Ctx, b: Breed, fl: Paw): void {
  const p = new Path2D();
  p.ellipse(fl.x, fl.y, fl.rx, fl.ry, 0, 0, TAU);
  const col = b.sockCol ?? lighten(b.base, 0.16);
  const g = ctx.createLinearGradient(0, fl.y - fl.ry, 0, fl.y + fl.ry);
  g.addColorStop(0, lighten(col, 0.14));
  g.addColorStop(1, darken(col, 0.14));
  fillOutlined(ctx, [p], g, outline(b.base), 1.4);
  ctx.strokeStyle = rgba(darken(col, 0.5), 0.3);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(fl.x + fl.rx * 0.45, fl.y - fl.ry * 0.4);
  ctx.lineTo(fl.x + fl.rx * 0.45, fl.y + fl.ry * 0.5);
  ctx.stroke();
}

// ------------------------------------------------------------------ the frame

export function drawDogFrame(ctx: Ctx, b: Breed, pose: Pose, f: number, pup: boolean): void {
  const sk = skeleton(b, pose, f, pup);
  const { r, hr, legR } = dims(b, pup);
  const s = DOG_K * b.size * (pup ? PUP : 1);
  ctx.save();
  ctx.translate(DOG_AX, DOG_AY);
  ctx.scale(s, s);
  const curly = b.fur === 'curly';

  // 1. legs (under the body, so the body outline caps the thick stubs)
  for (const l of sk.legs) if (!l.near && !l.over) limb(ctx, b, l, true, legR);
  if (curly) for (const l of sk.legs) if (!l.near && !l.over) anklePuff(ctx, b, l, true);
  for (const l of sk.legs) if (l.near && !l.over) limb(ctx, b, l, false, legR);
  if (curly) for (const l of sk.legs) if (l.near && !l.over) anklePuff(ctx, b, l, false);

  // 2. waddle group: body, head, ...
  ctx.save();
  ctx.translate(sk.pivot.x, sk.pivot.y);
  ctx.rotate(sk.tilt);
  ctx.scale(sk.sx, sk.sy);
  ctx.translate(-sk.pivot.x, -sk.pivot.y);

  if (curly) drawCurlyBody(ctx, b, sk, r);
  else drawBody(ctx, b, sk, r);
  for (const l of sk.legs) if (l.over) limb(ctx, b, l, !l.near, legR);
  if (pose === 'sit') for (const p of sk.paws) flatPaw(ctx, b, p);
  if (sk.ball) drawWrappedTail(ctx, b, sk, r);
  drawHead(ctx, b, sk, hr, pup);
  if (pose === 'nap') for (const p of sk.paws) flatPaw(ctx, b, p);
  ctx.restore();
  ctx.restore();
}

function bodyFrame(sk: Skel): { mx: number; my: number; ang: number; hl: number } {
  return {
    mx: (sk.hip.x + sk.sh.x) / 2,
    my: (sk.hip.y + sk.sh.y) / 2,
    ang: Math.atan2(sk.sh.y - sk.hip.y, sk.sh.x - sk.hip.x),
    hl: Math.hypot(sk.sh.x - sk.hip.x, sk.sh.y - sk.hip.y) / 2,
  };
}

function bodyPath(b: Breed, sk: Skel): Path2D {
  const pts = capsulePts(sk.hip.x, sk.hip.y, sk.rh, sk.sh.x, sk.sh.y, sk.rs, 16);
  const p = new Path2D();
  const mx = (sk.hip.x + sk.sh.x) / 2;
  const by = (sk.hip.y + sk.sh.y) / 2;
  if (b.fluff !== 'none' && !sk.ball && sk.pose !== 'sit') {
    const chest = (q: Pt): boolean => q.x > mx + sk.rs * 0.35 && q.y > by - sk.rs * 0.1;
    const rear = (q: Pt): boolean => q.x < mx - sk.rh * 0.35 && q.y > by - sk.rh * 0.5;
    const pred = b.fluff === 'chest' ? chest : b.fluff === 'rear' ? rear : (q: Pt): boolean => chest(q) || rear(q);
    scallopPartial(p, pts, b.fluffSize * 0.62, 3, pred);
  } else smoothPath(p, pts);
  if (sk.haunch) {
    const hp = new Path2D();
    hp.arc(sk.haunch.p.x, sk.haunch.p.y, sk.haunch.r, 0, TAU);
    p.addPath(hp);
  }
  return p;
}

/** scallop only where pred(p) is true; elsewhere straight (dense) segments */
function scallopPartial(p: Path2D, pts: Pt[], bulge: number, every: number, pred: (q: Pt) => boolean): void {
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  for (const q of pts) {
    cx += q.x;
    cy += q.y;
  }
  cx /= n;
  cy /= n;
  p.moveTo(pts[0].x, pts[0].y);
  let i = 0;
  while (i < n) {
    const a = pts[i];
    if (pred(a)) {
      const j = Math.min(i + every, n);
      const b = pts[j % n];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      let nx = b.y - a.y;
      let ny = -(b.x - a.x);
      if (nx * (mx - cx) + ny * (my - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const l = Math.hypot(nx, ny) || 1;
      p.quadraticCurveTo(mx + (nx / l) * bulge * 2, my + (ny / l) * bulge * 2, b.x, b.y);
      i = j;
    } else {
      const b = pts[(i + 1) % n];
      p.lineTo(b.x, b.y);
      i++;
    }
  }
  p.closePath();
}

function drawBody(ctx: Ctx, b: Breed, sk: Skel, r: number): void {
  const path = bodyPath(b, sk);
  const oc = outline(b.base);
  const yTop = Math.min(sk.hip.y, sk.sh.y) - r * 1.05;
  const yBot = Math.max(sk.hip.y, sk.sh.y) + r * 1.05;
  const glossy = b.fur === 'glossy';
  const fill = vgrad(ctx, yTop, yBot, lighten(b.base, glossy ? 0.2 : 0.15), b.base, darken(b.base, 0.24));
  fillOutlined(ctx, [path], fill, oc);
  ctx.save();
  ctx.clip(path);
  const bf = bodyFrame(sk);
  // soft top-left light blob
  const g = ctx.createRadialGradient(bf.mx - bf.hl * 0.5 - 2, yTop + r * 0.9, 1, bf.mx - bf.hl * 0.3, yTop + r * 1.2, bf.hl + r * 1.4);
  g.addColorStop(0, 'rgba(255,255,255,0.26)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(bf.mx - 40, yTop - 6, 80, 60);
  // marks + fur in the body-local frame
  ctx.save();
  ctx.translate(bf.mx, bf.my);
  ctx.rotate(bf.ang);
  drawMarks(ctx, b.body);
  const rnd = rng(b.seed * 131 + (sk.ball ? 7 : 1));
  const n = b.fur === 'fluffy' ? 14 : 0;
  softFur(ctx, rnd, 0, 0, bf.hl + r, r, n, b.base);
  ctx.restore();
  ctx.restore();
  rimLight(ctx, path, lighten(b.base, 0.75), darken(b.base, 0.55), glossy ? 0.7 : 0.45, 0.28, 1.2);
}

// ------------------------------------------------------------------ poodle (curls)

function curl(ctx: Ctx, x: number, y: number, rad: number, base: string, pass: 0 | 1): void {
  if (pass === 0) {
    ctx.fillStyle = outline(base);
    ctx.beginPath();
    ctx.arc(x, y, rad + OW, 0, TAU);
    ctx.fill();
    return;
  }
  const g = ctx.createRadialGradient(x - rad * 0.4, y - rad * 0.45, rad * 0.1, x, y, rad);
  g.addColorStop(0, lighten(base, 0.45));
  g.addColorStop(0.55, base);
  g.addColorStop(1, darken(base, 0.2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x - rad * 0.12, y - rad * 0.1, rad * 0.55, Math.PI * 1.05, Math.PI * 1.65);
  ctx.stroke();
  ctx.strokeStyle = rgba(darken(base, 0.5), 0.3);
  ctx.beginPath();
  ctx.arc(x + rad * 0.15, y + rad * 0.1, rad * 0.5, Math.PI * 0.1, Math.PI * 0.6);
  ctx.stroke();
}

function drawCurlyBody(ctx: Ctx, b: Breed, sk: Skel, r: number): void {
  const bf = bodyFrame(sk);
  const c = Math.cos(bf.ang);
  const sn = Math.sin(bf.ang);
  const cs: [number, number, number][] = [];
  const put = (lx: number, ly: number, rad: number): void => {
    cs.push([bf.mx + lx * c - ly * sn, bf.my + lx * sn + ly * c, rad]);
  };
  put(-bf.hl, 0, r * 1.0);
  put(bf.hl - 0.8, r * 0.1, r * 0.9);
  for (let i = 0; i < 3; i++) {
    const lx = -bf.hl * 0.5 + (i / 2) * bf.hl;
    put(lx, -r * 0.5, r * 0.66);
    put(lx + 0.5, r * 0.42, r * 0.62);
  }
  if (sk.haunch) cs.push([sk.haunch.p.x, sk.haunch.p.y, sk.haunch.r]);
  for (const q of cs) curl(ctx, q[0], q[1], q[2], b.base, 0);
  const order = cs.slice().sort((p, q) => q[1] - p[1]);
  for (const q of order) curl(ctx, q[0], q[1], q[2], b.base, 1);
}

function anklePuff(ctx: Ctx, b: Breed, l: Leg, far: boolean): void {
  const col = far ? darken(b.base, 0.2) : b.base;
  curl(ctx, l.ex, l.ey - 0.2, 3.5, col, 0);
  curl(ctx, l.ex, l.ey - 0.2, 3.5, col, 1);
}

// ------------------------------------------------------------------ head

function pointyEar(cx: number, cy: number, w: number, h: number, lean: number): Path2D {
  const p = new Path2D();
  p.moveTo(cx - w / 2, cy);
  p.quadraticCurveTo(cx - w * 0.6 + lean * 0.3, cy - h * 0.55, cx + lean, cy - h);
  p.quadraticCurveTo(cx + w * 0.6 + lean * 0.3, cy - h * 0.5, cx + w / 2, cy);
  p.closePath();
  return p;
}

function earRoot(ctx: Ctx, x: number, y: number, rot: number, fn: () => void): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

function drawEar(ctx: Ctx, b: Breed, sk: Skel, hr: number, far: boolean): void {
  const col = far ? darken(b.earCol, 0.24) : b.earCol;
  const ow = far ? 1.3 : 1.5;
  const back = sk.earBack;
  const ef = (): CanvasGradient => {
    const g = ctx.createLinearGradient(0, -hr * 1.5, 0, hr * 1.0);
    g.addColorStop(0, lighten(col, far ? 0.04 : 0.16));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darken(col, 0.2));
    return g;
  };
  const finish = (p: Path2D, inner: Path2D | null): void => {
    fillOutlined(ctx, [p], ef(), outline(col), ow);
    if (inner) {
      ctx.fillStyle = b.id === 'husky' ? 'rgba(236,241,248,0.9)' : 'rgba(255,176,170,0.8)';
      ctx.fill(inner);
    }
    if (!far) rimLight(ctx, p, lighten(col, 0.7), darken(col, 0.55), 0.4, 0.22, 0.9);
  };
  switch (b.ear) {
    case 'floppy':
    case 'long': {
      const long = b.ear === 'long';
      const len = hr * (long ? 1.75 : b.id === 'dalmatian' ? 1.3 : 1.5) * (far ? 0.62 : 1);
      const wid = hr * (long ? 0.38 : 0.36) * (far ? 0.8 : 1);
      const root = far ? { x: hr * 0.56, y: -hr * 0.74 } : { x: -hr * 0.8, y: -hr * 0.62 };
      earRoot(ctx, root.x, root.y, (far ? -0.55 : 0.16) + back * (far ? 0.5 : 0.85), () => {
        const cx = root.x;
        const cy = root.y + len * 0.5 - wid * 0.4;
        const p = new Path2D();
        if (b.feather && !far) scallopPath(p, ellipsePts(cx, cy, wid, len * 0.5, 0, 22), 0.55, 2);
        else p.ellipse(cx, cy, wid, len * 0.5, 0, 0, TAU);
        finish(p, null);
      });
      break;
    }
    case 'pointy':
    case 'big':
    case 'small': {
      const h = (b.ear === 'big' ? 1.2 : b.ear === 'small' ? 0.7 : 0.9) * hr;
      const w = (b.ear === 'big' ? 0.98 : b.ear === 'small' ? 0.62 : 0.72) * hr;
      const root = far ? { x: hr * 0.5, y: -hr * 0.62 } : { x: -hr * 0.42, y: -hr * 0.66 };
      const lean = far ? hr * 0.12 : -hr * 0.05;
      earRoot(ctx, root.x, root.y + hr * 0.1, -back * 0.55 * (far ? 0.7 : 1), () => {
        const p = pointyEar(root.x, root.y + hr * 0.1, w, h, lean);
        const inner = pointyEar(root.x + lean * 0.1, root.y + hr * 0.1 - 0.4, w * 0.55, h * 0.62, lean * 0.6);
        finish(p, far ? null : inner);
      });
      break;
    }
    case 'rose': {
      const root = far ? { x: hr * 0.55, y: -hr * 0.66 } : { x: -hr * 0.78, y: -hr * 0.46 };
      earRoot(ctx, root.x, root.y, -back * 0.6, () => {
        const p = new Path2D();
        const w = hr * (far ? 0.34 : 0.4);
        p.moveTo(root.x - w, root.y + hr * 0.05);
        p.quadraticCurveTo(root.x - w * 0.9, root.y - hr * 0.5, root.x + w * 0.2, root.y - hr * 0.42);
        p.quadraticCurveTo(root.x + w * 1.1, root.y - hr * 0.1, root.x + w * 0.8, root.y + hr * 0.38);
        p.quadraticCurveTo(root.x, root.y + hr * 0.2, root.x - w, root.y + hr * 0.05);
        p.closePath();
        finish(p, null);
      });
      break;
    }
    case 'puff':
      break;
  }
}

interface Face {
  sx: number;
  sy: number;
  srx: number;
  sry: number;
}

function faceGeom(b: Breed, hr: number): Face {
  return {
    sx: hr * 0.56,
    sy: hr * 0.33,
    srx: hr * 0.33 + b.snoutL * 0.5,
    sry: hr * 0.26 + b.snoutL * 0.1,
  };
}

function drawEye(ctx: Ctx, b: Breed, x: number, y: number, rx: number, closed: boolean): void {
  if (closed) {
    ctx.strokeStyle = '#2a1d22';
    ctx.lineWidth = 1.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y - rx * 0.35, rx * 1.05, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
    return;
  }
  const ry = rx * 1.22;
  ctx.fillStyle = '#1d141b';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  // iris (wide, so coloured eyes read), then pupil
  if (b.iris !== '#2a1b25') {
    ctx.fillStyle = b.iris;
    ctx.beginPath();
    ctx.ellipse(x, y + ry * 0.05, rx * 0.88, ry * 0.88, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d141b';
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.5, ry * 0.52, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(150,100,130,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.1, y + ry * 0.45, rx * 0.62, ry * 0.36, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - rx * 0.3, y - ry * 0.38, Math.max(0.7, rx * 0.42), 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x + rx * 0.38, y + ry * 0.45, Math.max(0.4, rx * 0.2), 0, TAU);
  ctx.fill();
}

function drawHead(ctx: Ctx, b: Breed, sk: Skel, hr: number, pup: boolean): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headRot);
  const curly = b.fur === 'curly';
  const oc = outline(b.base);
  const fg = faceGeom(b, hr);

  // far ear / far puff
  if (b.ear === 'puff') {
    curl(ctx, hr * 0.5, -hr * 0.42, hr * 0.42, darken(b.earCol, 0.2), 0);
    curl(ctx, hr * 0.5, -hr * 0.42, hr * 0.42, darken(b.earCol, 0.2), 1);
  } else drawEar(ctx, b, sk, hr, true);

  // skull + snout (outlines first so there is no seam)
  const skull = new Path2D();
  skull.ellipse(0, 0, hr * 1.04, hr * 0.97, 0, 0, TAU);
  const snout = new Path2D();
  snout.ellipse(fg.sx, fg.sy, fg.srx, fg.sry, 0, 0, TAU);
  const headFill = ctx.createRadialGradient(-hr * 0.35, -hr * 0.5, hr * 0.1, -hr * 0.05, -hr * 0.05, hr * 1.3);
  headFill.addColorStop(0, lighten(b.base, 0.22));
  headFill.addColorStop(0.5, b.base);
  headFill.addColorStop(1, darken(b.base, 0.24));
  const snFill = ctx.createLinearGradient(0, fg.sy - fg.sry, 0, fg.sy + fg.sry);
  snFill.addColorStop(0, lighten(b.snoutCol, 0.14));
  snFill.addColorStop(1, darken(b.snoutCol, 0.16));
  ctx.lineJoin = 'round';
  ctx.lineWidth = OW * 2;
  ctx.strokeStyle = oc;
  ctx.stroke(skull);
  ctx.strokeStyle = outline(b.snoutCol);
  ctx.stroke(snout);
  ctx.fillStyle = headFill;
  ctx.fill(skull);
  ctx.fillStyle = snFill;
  ctx.fill(snout);

  // head marks + a few soft fur strokes, clipped to skull
  ctx.save();
  ctx.clip(skull);
  drawMarks(ctx, b.head);
  softFur(ctx, rng(b.seed * 17 + 3), 0, 0, hr, hr * 0.95, curly ? 0 : b.fur === 'fluffy' ? 6 : 0, b.base);
  // rosy cheek
  if (b.blush > 0) {
    ctx.fillStyle = `rgba(255,105,130,${0.4 * b.blush})`;
    ctx.beginPath();
    ctx.ellipse(-hr * 0.05, hr * 0.44, hr * 0.24, hr * 0.15, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  rimLight(ctx, skull, lighten(b.base, 0.75), darken(b.base, 0.55), 0.5, 0.26, 1.1);

  // poodle top knot
  if (curly) {
    curl(ctx, -hr * 0.08, -hr * 0.98, hr * 0.5, b.base, 0);
    curl(ctx, hr * 0.38, -hr * 0.86, hr * 0.42, b.base, 0);
    curl(ctx, -hr * 0.08, -hr * 0.98, hr * 0.5, b.base, 1);
    curl(ctx, hr * 0.38, -hr * 0.86, hr * 0.42, b.base, 1);
  }

  // pug wrinkles
  if (b.id === 'pug') {
    ctx.strokeStyle = 'rgba(95,60,38,0.55)';
    ctx.lineWidth = 0.85;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-hr * 0.2, -hr * 0.66);
    ctx.quadraticCurveTo(hr * 0.2, -hr * 0.8, hr * 0.55, -hr * 0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-hr * 0.05, -hr * 0.5);
    ctx.quadraticCurveTo(hr * 0.25, -hr * 0.6, hr * 0.48, -hr * 0.47);
    ctx.stroke();
    // nose bridge wrinkle
    ctx.beginPath();
    ctx.moveTo(hr * 0.5, hr * 0.06);
    ctx.quadraticCurveTo(hr * 0.62, hr * 0.12, hr * 0.78, hr * 0.06);
    ctx.stroke();
  }

  // eyes (3/4 view: near eye bigger)
  const er = hr * 0.235 * b.eye * (pup ? 1.08 : 1);
  drawEye(ctx, b, hr * 0.12, -hr * 0.04, er, sk.closedEyes);
  drawEye(ctx, b, hr * 0.7, -hr * 0.05, er * 0.88, sk.closedEyes);

  // nose + mouth
  const nx = fg.sx + fg.srx * 0.62;
  const ny = fg.sy - fg.sry * 0.5;
  const nw = Math.max(1.7, hr * 0.2);
  ctx.fillStyle = b.nose;
  ctx.beginPath();
  ctx.ellipse(nx, ny + 0.3, nw, nw * 0.76, -0.15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(nx - nw * 0.3, ny - nw * 0.1, nw * 0.35, nw * 0.2, -0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(darken(b.snoutCol, 0.7), 0.8);
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(nx - 0.1, ny + nw * 0.8);
  ctx.lineTo(nx - 0.2, fg.sy + fg.sry * 0.3);
  ctx.quadraticCurveTo(nx - fg.srx * 0.25, fg.sy + fg.sry * 0.85, nx - fg.srx * 0.75, fg.sy + fg.sry * 0.45);
  ctx.stroke();
  if (sk.tongue) {
    ctx.fillStyle = '#ff7f95';
    ctx.strokeStyle = '#c24a64';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(nx - fg.srx * 0.5, fg.sy + fg.sry + 1.4, 1.7, 2.4, 0.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // near ear (on top)
  if (b.ear === 'puff') {
    const cx = -hr * 0.8;
    const cy = -hr * 0.02;
    curl(ctx, cx, cy, hr * 0.4, b.earCol, 0);
    curl(ctx, cx - 0.3, cy + hr * 0.5, hr * 0.36, b.earCol, 0);
    curl(ctx, cx, cy, hr * 0.4, b.earCol, 1);
    curl(ctx, cx - 0.3, cy + hr * 0.5, hr * 0.36, b.earCol, 1);
  } else drawEar(ctx, b, sk, hr, false);
  ctx.restore();
}

// ------------------------------------------------------------------ tail

function strip(pts: Pt[], widths: number[]): Pt[] {
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const c = pts[Math.min(pts.length - 1, i + 1)];
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    L.push({ x: pts[i].x + nx * widths[i], y: pts[i].y + ny * widths[i] });
    R.push({ x: pts[i].x - nx * widths[i], y: pts[i].y - ny * widths[i] });
  }
  return L.concat(R.reverse());
}

/** curled-up nap: the tail hugs the front-bottom of the ball, tip tucked toward the paws */
function drawWrappedTail(ctx: Ctx, b: Breed, sk: Skel, r: number): void {
  const R = sk.rs;
  const cx = (sk.hip.x + sk.sh.x) / 2;
  const cy = sk.hip.y;
  void r;
  const pts: Pt[] = [];
  const widths: number[] = [];
  const n = 14;
  const a0 = 3.05;
  const a1 = 0.95;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    const rad = R * (0.9 + 0.06 * Math.sin(t * Math.PI));
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    widths.push(3.0 - t * 1.0);
  }
  const col = b.tailCol;
  const poly = strip(pts, widths);
  const p = new Path2D();
  if (b.feather || b.tail === 'fluffcurl') scallopPath(p, poly, 0.5, 2);
  else smoothPath(p, poly);
  const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
  g.addColorStop(0, lighten(col, 0.1));
  g.addColorStop(1, darken(col, 0.2));
  fillOutlined(ctx, [p], g, outline(col), 1.4);
  const tip = pts[n];
  if (b.tail === 'pom') {
    curl(ctx, tip.x, tip.y, 3.6, col, 0);
    curl(ctx, tip.x, tip.y, 3.6, col, 1);
  } else if (b.id === 'beagle' || b.id === 'dalmatian') {
    ctx.fillStyle = b.id === 'beagle' ? '#fffaf0' : '#34303a';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 1.8, 0, TAU);
    ctx.fill();
  }
  rimLight(ctx, p, lighten(col, 0.7), darken(col, 0.5), 0.35, 0.2, 0.9);
}

export function drawTail(ctx: Ctx, b: Breed, pup: boolean): void {
  const s = DOG_K * b.size * (pup ? PUP : 1);
  ctx.save();
  ctx.translate(TAIL_AX, TAIL_AY);
  const ts = { plume: 0.74, whip: 0.86, otter: 0.86, curl: 0.78, fluffcurl: 0.76, stub: 0.92, pom: 0.85, pug: 0.95 }[b.tail];
  ctx.scale(s * ts, s * ts);
  const col = b.tailCol;
  const oc = outline(col);
  const fluffy = b.tail === 'plume' || b.tail === 'fluffcurl' || b.tail === 'stub';

  const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      out.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
    return out;
  };
  const make = (poly: Pt[], fluff: number): Path2D => {
    const p = new Path2D();
    if (fluff > 0) scallopPath(p, poly, fluff, 2);
    else smoothPath(p, poly);
    return p;
  };
  const paint = (p: Path2D, c: string, gy0: number, gy1: number): void => {
    const g = ctx.createLinearGradient(0, gy0, 0, gy1);
    g.addColorStop(0, lighten(c, 0.2));
    g.addColorStop(0.5, c);
    g.addColorStop(1, darken(c, 0.2));
    fillOutlined(ctx, [p], g, outline(c), 1.5);
    ctx.save();
    ctx.clip(p);
    softFur(ctx, rng(b.seed * 5 + 2), -7, -6, 11, 9, fluffy ? 9 : 3, c);
    ctx.restore();
    rimLight(ctx, p, lighten(c, 0.75), darken(c, 0.55), 0.5, 0.28, 1.1);
  };

  switch (b.tail) {
    case 'plume': {
      const c = bez({ x: 0, y: 1 }, { x: -8, y: 3 }, { x: -12, y: -4 }, { x: -13, y: -12 }, 12);
      const poly = strip(c, c.map((_, i) => 3.4 + Math.sin((i / 12) * Math.PI) * 2.3 - (i / 12) * 1.2));
      paint(make(poly, 0.9), col, -14, 6);
      break;
    }
    case 'whip': {
      const c = bez({ x: 0, y: 0 }, { x: -5, y: -1 }, { x: -9, y: -4 }, { x: -12, y: -9 }, 10);
      const poly = strip(c, c.map((_, i) => 3.0 - (i / 10) * 1.3));
      paint(make(poly, 0), col, -11, 3);
      const tip = c[c.length - 1];
      if (b.id === 'dalmatian') {
        ctx.fillStyle = '#34303a';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 1.9, 0, TAU);
        ctx.fill();
      } else if (b.id === 'beagle') {
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath();
        ctx.arc(tip.x + 0.1, tip.y + 0.1, 2.3, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = oc;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      break;
    }
    case 'otter': {
      const c = bez({ x: 0, y: 0 }, { x: -5, y: 1 }, { x: -9, y: -1 }, { x: -12.5, y: -5 }, 10);
      const poly = strip(c, c.map((_, i) => 4.0 - (i / 10) * 1.9));
      paint(make(poly, 0), col, -9, 4);
      break;
    }
    case 'curl':
    case 'fluffcurl': {
      const c = bez({ x: 0, y: 0 }, { x: -8, y: -3 }, { x: -9, y: -14 }, { x: -1.5, y: -13 }, 14);
      const poly = strip(c, c.map((_, i) => 3.6 + (i / 14) * 1.5));
      paint(make(poly, b.tail === 'fluffcurl' ? 1.1 : 0.6), col, -16, 3);
      if (b.id === 'shiba') {
        ctx.fillStyle = 'rgba(255,240,214,0.92)';
        ctx.beginPath();
        ctx.ellipse(-4, -8.5, 1.9, 3, 0, 0, TAU);
        ctx.fill();
      } else if (b.id === 'husky') {
        ctx.fillStyle = 'rgba(245,247,250,0.9)';
        ctx.beginPath();
        ctx.ellipse(-4, -8.5, 1.8, 3, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'stub': {
      const poly: Pt[] = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        poly.push({ x: -3 + Math.cos(a) * 4.6, y: -1.5 + Math.sin(a) * 4.1 });
      }
      const p = new Path2D();
      scallopPath(p, poly, 0.8, 2);
      paint(p, col, -6, 3);
      break;
    }
    case 'pom': {
      ctx.lineCap = 'round';
      ctx.strokeStyle = oc;
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-3, -2, -4.5, -7);
      ctx.stroke();
      ctx.strokeStyle = darken(col, 0.1);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      curl(ctx, -4.8, -11.6, 5.2, col, 0);
      curl(ctx, -4.8, -11.6, 5.2, col, 1);
      break;
    }
    case 'pug': {
      // tight curl sitting on the rump: thick stroked loop
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const loop = (): void => {
        ctx.beginPath();
        ctx.moveTo(0.5, 0.5);
        ctx.bezierCurveTo(-3, 1, -7, -1, -6.5, -5);
        ctx.bezierCurveTo(-6, -8.5, -1.5, -8.5, -1.6, -5.2);
        ctx.bezierCurveTo(-1.6, -3.4, -3.8, -3.2, -4, -4.6);
      };
      ctx.strokeStyle = oc;
      ctx.lineWidth = 5.4;
      loop();
      ctx.stroke();
      ctx.strokeStyle = lighten(col, 0.04);
      ctx.lineWidth = 3.0;
      loop();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-1, -0.2);
      ctx.bezierCurveTo(-3.6, 0.2, -6.4, -1.6, -6.2, -4.6);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
