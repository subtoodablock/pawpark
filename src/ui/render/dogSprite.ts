// Procedural dog drawing: one breed x pose x frame is baked into the SpriteCache.
// Tail is a separate sprite so the wag can be applied live as a rotation.
import type { Breed, Mark } from './breeds';
import {
  type Ctx,
  type Pt,
  capsulePts,
  darken,
  lighten,
  outline,
  pathFromPts,
  rgba,
  rimLight,
  rng,
  roundRect,
  scallopPath,
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
/** unit -> css px */
const K = 0.86;
const PUP = 0.74;
const OW = 1.7;

interface Leg {
  x: number;
  y: number;
  a: number;
  len: number;
  near: boolean;
  front: boolean;
  lift: number;
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
  closedEyes: boolean;
  tongue: boolean;
  pose: Pose;
  /** extra haunch circle (sit/nap) */
  haunch: { p: Pt; r: number } | null;
  /** foot pads lying flat (sit/nap) */
  flat: { x: number; y: number; rx: number; ry: number; col: boolean }[];
}

export function dogKey(breed: number, pose: Pose, frame: number, pup: boolean): string {
  return `dog:${breed}:${pose}:${frame}:${pup ? 1 : 0}`;
}
export function tailKey(breed: number, pup: boolean): string {
  return `tail:${breed}:${pup ? 1 : 0}`;
}

function dims(b: Breed, pup: boolean) {
  const bodyH = b.bodyH * (pup ? 0.95 : 1);
  return {
    bodyH,
    r: bodyH / 2,
    legH: (b.legH + 2.4) * (pup ? 0.85 : 1),
    hr: b.headR * (pup ? 1.3 : 1),
    bodyL: b.bodyL * (pup ? 0.8 : 1),
  };
}

function skeleton(b: Breed, pose: Pose, f: number, pup: boolean): Skel {
  const { r, legH, hr, bodyL: bl0 } = dims(b, pup);
  const n = POSE_FRAMES[pose];
  const ph = (f / n) * Math.PI * 2;
  let bodyL = bl0;
  const by0 = -(legH + r - 1.5);
  let by = by0;
  const sk: Skel = {
    hip: { x: -bodyL / 2, y: by },
    sh: { x: bodyL / 2, y: by },
    rh: r * 1.02,
    rs: r * 0.98,
    head: { x: 0, y: 0 },
    headRot: 0,
    legs: [],
    tail: { x: 0, y: 0 },
    tailRest: 0,
    closedEyes: false,
    tongue: false,
    pose,
    haunch: null,
    flat: [],
  };
  const legTopY = (y: number): number => y + r * 0.72;
  const mkLegs = (a: number[], amp: number, liftAmp: number, shy = 0): void => {
    // order: far hind, far front, near hind, near front
    const hx = sk.hip.x + 0.4;
    const fx = sk.sh.x - 1.2;
    const defs: [number, number, boolean, boolean][] = [
      [hx + 1.6, a[0], false, false],
      [fx + 1.6, a[1], false, true],
      [hx, a[2], true, false],
      [fx, a[3], true, true],
    ];
    for (const [x, ph2, near, front] of defs) {
      const topY = legTopY(front ? sk.sh.y + shy : sk.hip.y);
      sk.legs.push({
        x,
        y: topY,
        a: Math.sin(ph2) * amp,
        len: -topY,
        near,
        front,
        lift: Math.max(0, Math.cos(ph2)) * liftAmp,
      });
    }
  };
  let headDy = 0;
  switch (pose) {
    case 'walk': {
      by = by0 - Math.cos(2 * ph) * 1.1;
      sk.hip.y = by;
      sk.sh.y = by;
      mkLegs([ph, ph + Math.PI, ph + Math.PI, ph], 0.52, 2.2);
      headDy = Math.sin(2 * ph) * 0.8;
      break;
    }
    case 'run': {
      bodyL *= 1.14;
      sk.hip.x = -bodyL / 2;
      sk.sh.x = bodyL / 2;
      const air = Math.max(0, Math.sin(ph)) * 2.4;
      by = by0 - air - 0.6;
      sk.hip.y = by + Math.sin(ph) * 1.4;
      sk.sh.y = by - Math.sin(ph) * 1.4;
      // gallop: fore pair and hind pair, slightly offset
      mkLegs([ph + Math.PI * 0.95, ph + 0.35, ph + Math.PI, ph], 0.95, 3.4);
      sk.legs[0].a += 0.15;
      sk.legs[2].a += 0.15;
      headDy = -Math.sin(ph) * 0.8 - 0.5;
      sk.headRot = -0.1;
      sk.tongue = true;
      sk.tailRest = 0.35;
      break;
    }
    case 'sniff': {
      sk.sh.y = by + 1.4;
      mkLegs([0.4, -0.4, -0.3, 0.3], 0.18, 0);
      sk.headRot = 0.75;
      break;
    }
    case 'dig': {
      sk.sh.y = by + 3.2;
      sk.hip.y = by - 0.8;
      const a0 = f === 0 ? 1 : 0;
      const hx = sk.hip.x + 0.4;
      const fx = sk.sh.x - 1.2;
      const hind: [number, boolean][] = [
        [hx + 2.4, false],
        [hx - 0.4, true],
      ];
      for (const [x, near] of hind) sk.legs.push({ x, y: legTopY(sk.hip.y), a: near ? -0.12 : 0.14, len: -legTopY(sk.hip.y), near, front: false, lift: 0 });
      const fy = legTopY(sk.sh.y);
      sk.legs.splice(1, 0, { x: fx + 1.6, y: fy, a: a0 ? -0.25 : -1.1, len: -fy * 0.95, near: false, front: true, lift: 0 });
      sk.legs.push({ x: fx, y: fy, a: a0 ? -1.1 : -0.25, len: -fy * 0.95, near: true, front: true, lift: 0 });
      sk.headRot = 0.95;
      sk.tailRest = 0.5;
      break;
    }
    case 'sit': {
      const hipY = -r * 0.95;
      sk.hip = { x: -bodyL * 0.5 - 2.5, y: hipY };
      const ang = -1.12;
      const L = bodyL * 0.95 + 1;
      sk.sh = { x: sk.hip.x + Math.cos(ang) * L, y: sk.hip.y + Math.sin(ang) * L };
      sk.rh = r * 1.05;
      sk.haunch = { p: { x: sk.hip.x + 0.5, y: -r * 0.85 }, r: r * 0.95 };
      const fy = sk.sh.y + r * 0.2;
      sk.legs.push({ x: sk.sh.x + 2.4, y: fy, a: 0, len: -fy, near: false, front: true, lift: 0 });
      sk.legs.push({ x: sk.sh.x + 0.4, y: fy, a: 0, len: -fy, near: true, front: true, lift: 0 });
      sk.flat.push({ x: sk.hip.x + r * 1.5, y: -1.7, rx: 4.2, ry: 2.1, col: true });
      sk.tailRest = -1.0;
      sk.headRot = -0.18;
      break;
    }
    case 'nap': {
      sk.hip = { x: -bodyL / 2 - 1, y: -r * 0.86 };
      sk.sh = { x: bodyL / 2, y: -r * 0.9 };
      sk.haunch = { p: { x: sk.hip.x + 1.5, y: -r * 0.7 }, r: r * 0.85 };
      sk.flat.push({ x: sk.sh.x + r * 0.9, y: -1.9, rx: 5.2, ry: 2.2, col: true });
      sk.closedEyes = true;
      sk.tailRest = -1.25;
      sk.headRot = 0.2;
      break;
    }
  }
  // head
  if (pose === 'nap') {
    sk.head = { x: sk.sh.x + r * 0.95 + hr * 0.6, y: -hr * 0.92 };
  } else if (pose === 'sit') {
    sk.head = { x: sk.sh.x + hr * 0.28, y: sk.sh.y - hr * 0.95 - r * 0.25 };
  } else if (pose === 'sniff') {
    sk.head = { x: sk.sh.x + r * 0.75 + hr * 0.5, y: sk.sh.y + r * 0.1 };
  } else if (pose === 'dig') {
    sk.head = { x: sk.sh.x + r * 0.7 + hr * 0.55, y: sk.sh.y + r * 0.35 };
  } else {
    sk.head = { x: sk.sh.x + r * 0.7 + hr * 0.55, y: sk.sh.y - r * 0.9 - hr * 0.45 + headDy };
  }
  sk.tail = { x: sk.hip.x - sk.rh * 0.8, y: sk.hip.y - sk.rh * 0.3 };
  return sk;
}

export function tailAnchor(b: Breed, pose: Pose, f: number, pup: boolean): { x: number; y: number; rest: number } {
  const sk = skeleton(b, pose, f, pup);
  const s = K * b.size * (pup ? PUP : 1);
  return { x: DOG_AX + sk.tail.x * s, y: DOG_AY + sk.tail.y * s, rest: sk.tailRest };
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
      ctx.ellipse(m.x, m.y, m.rx, m.ry, m.rot ?? 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const r = rng(m.seed);
      ctx.fillStyle = m.col;
      for (let i = 0; i < m.n; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r());
        const x = Math.cos(a) * d * m.rx;
        const y = Math.sin(a) * d * m.ry;
        const rad = m.rMin + r() * (m.rMax - m.rMin);
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * (0.8 + r() * 0.3), r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function limb(ctx: Ctx, b: Breed, l: Leg, base: string, sock: string | null, far: boolean): void {
  const w = b.legW;
  const r1 = 2.9 * w;
  const r2 = 2.1 * w;
  const ex = l.x + Math.sin(l.a) * l.len;
  const ey = l.y + Math.cos(l.a) * l.len - l.lift;
  const pts = capsulePts(l.x, l.y, r1, ex, ey, r2, 8);
  const p = pathFromPts(pts);
  const col = far ? darken(base, 0.28) : base;
  const oc = outline(col);
  ctx.lineJoin = 'round';
  ctx.lineWidth = OW * 2;
  ctx.strokeStyle = oc;
  ctx.stroke(p);
  const g = ctx.createLinearGradient(l.x - r1, 0, l.x + r1, 0);
  g.addColorStop(0, far ? col : lighten(col, 0.14));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darken(col, 0.2));
  ctx.fillStyle = g;
  ctx.fill(p);
  if (sock) {
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = far ? darken(sock, 0.22) : sock;
    ctx.beginPath();
    ctx.ellipse(ex, ey - 0.2, r2 + 1.2, 3.4 * w + 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (!far) rimLight(ctx, p, lighten(col, 0.7), darken(col, 0.5), 0.4, 0.2, 0.9);
  // paw toe line
  ctx.strokeStyle = rgba(darken(sock ?? col, 0.5), 0.35);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(ex + 0.9, ey + r2 * 0.2);
  ctx.lineTo(ex + 0.9, ey + r2 * 0.95);
  ctx.stroke();
}

function flatPaw(ctx: Ctx, b: Breed, fl: { x: number; y: number; rx: number; ry: number }, base: string, sock: string | null): void {
  const p = new Path2D();
  p.ellipse(fl.x, fl.y, fl.rx, fl.ry, 0, 0, Math.PI * 2);
  const col = sock ?? base;
  fillOutlined(ctx, [p], col, outline(col), 1.4);
  rimLight(ctx, p, lighten(col, 0.7), darken(col, 0.5), 0.4, 0.2, 0.8);
  void b;
}

// ------------------------------------------------------------------ the frame

export function drawDogFrame(ctx: Ctx, b: Breed, pose: Pose, f: number, pup: boolean): void {
  const sk = skeleton(b, pose, f, pup);
  const { r, hr } = dims(b, pup);
  const s = K * b.size * (pup ? PUP : 1);
  ctx.save();
  ctx.translate(DOG_AX, DOG_AY);
  ctx.scale(s, s);
  const oc = outline(b.base);

  // 1. far legs
  const curly = b.fur === 'curly';
  const sockC = b.sockCol;
  if (pose === 'nap' || pose === 'sit') {
    // far front leg peeks behind
  }
  for (const l of sk.legs) if (!l.near) limb(ctx, b, l, b.base, sockC, true);
  if (curly) for (const l of sk.legs) if (!l.near) anklePuff(ctx, b, l, true);

  // 2. body
  if (curly) drawCurlyBody(ctx, b, sk, r, hr);
  else drawBody(ctx, b, sk, r, hr, oc);

  // 3. flat paws (sit / nap) and near legs
  for (const fl of sk.flat) flatPaw(ctx, b, fl, b.base, sockC);
  for (const l of sk.legs) {
    if (l.near) {
      limb(ctx, b, l, b.base, sockC, false);
      if (curly) anklePuff(ctx, b, l, false);
    }
  }

  // 4. head
  drawHead(ctx, b, sk, hr, pup);
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

function bodyPath(b: Breed, sk: Skel, r: number): Path2D {
  const pts = capsulePts(sk.hip.x, sk.hip.y, sk.rh, sk.sh.x, sk.sh.y, sk.rs, 16);
  const p = new Path2D();
  if (b.fluff === 'all' || b.fluff === 'rear' || b.fluff === 'chest') {
    const mx = (sk.hip.x + sk.sh.x) / 2;
    scallopPartial(p, pts, b.fluffSize * 1.15, 2, (q) => (b.fluff === 'all' ? true : b.fluff === 'rear' ? q.x < mx : q.y > sk.hip.y - 1 && q.x > mx - 3));
  } else smoothPath(p, pts);
  // neck: a fat capsule from shoulder toward the head
  const neck = pathFromPts(capsulePts(sk.sh.x, sk.sh.y, r * 0.85, sk.head.x - 1, sk.head.y + 1, r * 0.62, 8));
  p.addPath(neck);
  if (sk.haunch) {
    const hp = new Path2D();
    hp.arc(sk.haunch.p.x, sk.haunch.p.y, sk.haunch.r, 0, Math.PI * 2);
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

function drawBody(ctx: Ctx, b: Breed, sk: Skel, r: number, hr: number, oc: string): void {
  void hr;
  const path = bodyPath(b, sk, r);
  const yTop = Math.min(sk.hip.y, sk.sh.y, sk.head.y) - r * 1.1;
  const yBot = Math.max(sk.hip.y, sk.sh.y) + r * 1.05;
  const glossy = b.fur === 'glossy';
  const fill = vgrad(ctx, yTop, yBot, lighten(b.base, glossy ? 0.2 : 0.17), b.base, darken(b.base, 0.26));
  fillOutlined(ctx, [path], fill, oc);
  ctx.save();
  ctx.clip(path);
  // soft top-left light blob
  const bf = bodyFrame(sk);
  const g = ctx.createRadialGradient(bf.mx - bf.hl * 0.5, yTop + r * 0.9, 1, bf.mx - bf.hl * 0.3, yTop + r * 1.2, bf.hl * 1.5);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(bf.mx - 40, yTop - 6, 80, 60);
  // marks in body-local frame
  ctx.save();
  ctx.translate(bf.mx, bf.my);
  ctx.rotate(bf.ang);
  ctx.save();
  drawMarks(ctx, b.body);
  ctx.restore();
  ctx.restore();
  // fur strokes (60-150 short curved strokes, seeded)
  const rnd = rng(b.seed * 131 + (sk.pose === 'nap' ? 7 : 1));
  ctx.save();
  ctx.translate(bf.mx, bf.my);
  ctx.rotate(bf.ang);
  furTexture(ctx, rnd, bf.hl + r, r, b.fur === 'smooth' ? 60 : b.fur === 'glossy' ? 70 : 120, b.fur === 'smooth' ? 0.14 : 0.2);
  ctx.restore();
  ctx.restore();
  rimLight(ctx, path, lighten(b.base, 0.75), darken(b.base, 0.55), glossy ? 0.75 : 0.55, 0.3, 1.25);
}

/** light/dark curved strokes in a local (spine-aligned) frame */
function furTexture(ctx: Ctx, rnd: () => number, hl: number, r: number, n: number, a: number): void {
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.85;
  for (let i = 0; i < n; i++) {
    const x = (rnd() * 2 - 1) * hl;
    const y = (rnd() * 2 - 1) * r * 1.05;
    // strokes lean back along the spine and curve down the side (along the surface normal near edges)
    const edge = Math.abs(y) / r;
    const ang = Math.PI * (0.88 + (rnd() - 0.5) * 0.3) + Math.sign(y) * edge * 0.5;
    const l = 3 + rnd() * 3;
    const light = rnd() < 0.5;
    ctx.strokeStyle = light ? `rgba(255,255,255,${a * (0.6 + rnd() * 0.7)})` : `rgba(40,20,10,${a * (0.5 + rnd() * 0.7)})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang + 0.55) * l * 0.55, y + Math.sin(ang + 0.55) * l * 0.55, x + Math.cos(ang) * l, y + Math.sin(ang) * l);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ poodle (curls)

function curl(ctx: Ctx, x: number, y: number, rad: number, base: string, pass: 0 | 1): void {
  if (pass === 0) {
    ctx.fillStyle = outline(base);
    ctx.beginPath();
    ctx.arc(x, y, rad + OW, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const g = ctx.createRadialGradient(x - rad * 0.4, y - rad * 0.45, rad * 0.1, x, y, rad);
  g.addColorStop(0, lighten(base, 0.45));
  g.addColorStop(0.55, base);
  g.addColorStop(1, darken(base, 0.2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
  // tiny curl highlight arc
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x - rad * 0.12, y - rad * 0.1, rad * 0.55, Math.PI * 1.05, Math.PI * 1.65);
  ctx.stroke();
  ctx.strokeStyle = rgba(darken(base, 0.5), 0.35);
  ctx.beginPath();
  ctx.arc(x + rad * 0.15, y + rad * 0.1, rad * 0.5, Math.PI * 0.1, Math.PI * 0.6);
  ctx.stroke();
}

function curlyCircles(sk: Skel, r: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const bf = bodyFrame(sk);
  const c = Math.cos(bf.ang);
  const sn = Math.sin(bf.ang);
  const put = (lx: number, ly: number, rad: number): void => {
    out.push([bf.mx + lx * c - ly * sn, bf.my + lx * sn + ly * c, rad]);
  };
  // rear pom, chest pom, and two rows of curls between
  put(-bf.hl + r * 0.25, 0, r * 0.98);
  put(bf.hl - r * 0.15, -r * 0.05, r * 1.0);
  const m = 4;
  for (let i = 0; i < m; i++) {
    const t = (i + 0.5) / m;
    const lx = -bf.hl * 0.55 + t * bf.hl * 1.1;
    put(lx, -r * 0.42, r * 0.66);
    put(lx + 1, r * 0.4, r * 0.62);
  }
  return out;
}

function drawCurlyBody(ctx: Ctx, b: Breed, sk: Skel, r: number, hr: number): void {
  void hr;
  const cs = curlyCircles(sk, r);
  // neck curls
  cs.push([sk.sh.x + r * 0.5, sk.sh.y - r * 0.5, r * 0.62]);
  cs.push([sk.sh.x + r * 0.9, sk.sh.y - r * 0.9, r * 0.6]);
  if (sk.haunch) cs.push([sk.haunch.p.x, sk.haunch.p.y, sk.haunch.r]);
  for (const c of cs) curl(ctx, c[0], c[1], c[2], b.base, 0);
  // underside shade first, then lit curls in painter order (back -> front, top last)
  const order = cs.slice().sort((p, q) => p[1] - q[1]);
  for (const c of order.reverse()) curl(ctx, c[0], c[1], c[2], b.base, 1);
}

function anklePuff(ctx: Ctx, b: Breed, l: Leg, far: boolean): void {
  const ex = l.x + Math.sin(l.a) * l.len;
  const ey = l.y + Math.cos(l.a) * l.len - l.lift - 2.4;
  const col = far ? darken(b.base, 0.2) : b.base;
  curl(ctx, ex, ey, 3.4, col, 0);
  curl(ctx, ex, ey, 3.4, col, 1);
}

// ------------------------------------------------------------------ head

function earPath(b: Breed, hr: number, far: boolean): { path: Path2D; inner: Path2D | null } {
  const p = new Path2D();
  let inner: Path2D | null = null;
  const ox = far ? 2.2 : 0;
  const oy = far ? -0.8 : 0;
  switch (b.ear) {
    case 'floppy':
    case 'long': {
      const L = b.ear === 'long' ? 1.45 : 1;
      p.ellipse(-hr * 0.3 + ox, hr * 0.28 * L + oy - 1, 3.7 * (b.ear === 'long' ? 1.1 : 1), 6.2 * L, 0.22, 0, Math.PI * 2);
      break;
    }
    case 'rose': {
      p.moveTo(-hr * 0.7 + ox, -hr * 0.5 + oy);
      p.quadraticCurveTo(-hr * 0.1 + ox, -hr * 1.05 + oy, hr * 0.28 + ox, -hr * 0.4 + oy);
      p.quadraticCurveTo(hr * 0.1 + ox, hr * 0.1 + oy, -hr * 0.45 + ox, -hr * 0.05 + oy);
      p.closePath();
      break;
    }
    case 'pointy':
    case 'big':
    case 'small': {
      const h = b.ear === 'big' ? 1.75 : b.ear === 'small' ? 1.05 : 1.5;
      const w = b.ear === 'big' ? 1.25 : 1;
      const ax = -hr * 0.35 + ox;
      const ay = -hr * h + oy;
      p.moveTo(-hr * 0.82 * w + ox, -hr * 0.32 + oy);
      p.quadraticCurveTo(-hr * 0.85 + ox, ay + hr * 0.35, ax, ay);
      p.quadraticCurveTo(hr * 0.1 * w + ox, -hr * 0.9 + oy, hr * 0.28 * w + ox, -hr * 0.55 + oy);
      p.closePath();
      inner = new Path2D();
      inner.moveTo(-hr * 0.55 + ox, -hr * 0.48 + oy);
      inner.quadraticCurveTo(-hr * 0.58 + ox, ay + hr * 0.6, ax, ay + hr * 0.38);
      inner.quadraticCurveTo(-hr * 0.12 + ox, -hr * 0.85 + oy, -hr * 0.05 + ox, -hr * 0.55 + oy);
      inner.closePath();
      break;
    }
    case 'puff':
      break;
  }
  return { path: p, inner };
}

function drawHead(ctx: Ctx, b: Breed, sk: Skel, hr: number, pup: boolean): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headRot);
  const curly = b.fur === 'curly';
  const oc = outline(b.base);
  const earOc = outline(b.earCol);

  // far ear
  if (b.ear === 'puff') {
    curl(ctx, 3.5, -hr * 0.5, hr * 0.5, darken(b.earCol, 0.18), 0);
    curl(ctx, 3.5, -hr * 0.5, hr * 0.5, darken(b.earCol, 0.18), 1);
  } else {
    const fe = earPath(b, hr, true);
    fillOutlined(ctx, [fe.path], darken(b.earCol, 0.22), outline(darken(b.earCol, 0.22)), 1.4);
  }

  // skull + snout
  const skull = new Path2D();
  skull.arc(0, 0, hr, 0, Math.PI * 2);
  const sy = hr * 0.18;
  const snH = Math.max(hr * 0.62, 4.6);
  const snout = new Path2D();
  roundRect(snout as unknown as Ctx, hr * 0.28, sy - snH * 0.42, b.snoutL + hr * 0.4, snH, Math.min(snH * 0.48, 3));
  const headFill = ctx.createRadialGradient(-hr * 0.35, -hr * 0.45, hr * 0.1, -hr * 0.05, -hr * 0.05, hr * 1.25);
  headFill.addColorStop(0, lighten(b.base, 0.24));
  headFill.addColorStop(0.5, b.base);
  headFill.addColorStop(1, darken(b.base, 0.25));
  const snFill = ctx.createLinearGradient(0, sy - snH * 0.5, 0, sy + snH * 0.6);
  snFill.addColorStop(0, lighten(b.snoutCol, 0.14));
  snFill.addColorStop(1, darken(b.snoutCol, 0.2));
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
  // hide the seam between skull and snout
  ctx.fillStyle = headFill;
  ctx.save();
  ctx.clip(skull);
  ctx.restore();

  // head marks + fur strokes, clipped to skull
  ctx.save();
  ctx.clip(skull);
  drawMarks(ctx, b.head);
  const rnd = rng(b.seed * 17 + 3);
  furTexture(ctx, rnd, hr, hr * 0.95, curly ? 20 : 34, 0.18);
  ctx.restore();
  ctx.save();
  ctx.clip(snout);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(hr * 0.3, sy - snH * 0.45, b.snoutL + hr * 0.4, snH * 0.32);
  ctx.restore();
  rimLight(ctx, skull, lighten(b.base, 0.75), darken(b.base, 0.55), 0.55, 0.28, 1.1);

  // poodle top knot
  if (curly) {
    curl(ctx, -hr * 0.1, -hr * 0.95, hr * 0.55, b.base, 0);
    curl(ctx, hr * 0.38, -hr * 0.82, hr * 0.46, b.base, 0);
    curl(ctx, -hr * 0.1, -hr * 0.95, hr * 0.55, b.base, 1);
    curl(ctx, hr * 0.38, -hr * 0.82, hr * 0.46, b.base, 1);
  }

  // eye
  const ex = hr * 0.42;
  const ey = -hr * 0.12;
  const er = 1.65 * b.eye * (pup ? 1.15 : 1);
  if (sk.closedEyes) {
    ctx.strokeStyle = '#2a1d22';
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ex, ey - 0.2, 1.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1f1620';
    ctx.beginPath();
    ctx.ellipse(ex, ey, er, er * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - er * 0.35, ey - er * 0.5, Math.max(0.6, er * 0.38), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(ex + er * 0.35, ey + er * 0.55, er * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // nose + mouth
  const nx = hr * 0.28 + b.snoutL + hr * 0.4 - 1.2;
  const ny = sy - snH * 0.42 + 1.6;
  ctx.fillStyle = b.nose;
  ctx.beginPath();
  ctx.ellipse(nx, ny + 0.3, 2.3, 1.85, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(nx - 0.6, ny - 0.3, 0.8, 0.45, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(darken(b.snoutCol, 0.65), 0.8);
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(nx - 0.2, ny + 1.8);
  ctx.quadraticCurveTo(nx - 1.4, sy + snH * 0.5, nx - 4.2, sy + snH * 0.42);
  ctx.stroke();
  if (sk.tongue) {
    ctx.fillStyle = '#ff7f95';
    ctx.strokeStyle = '#c24a64';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(nx - 3.6, sy + snH * 0.55 + 1.6, 1.7, 2.4, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (b.id === 'pug') {
    ctx.strokeStyle = 'rgba(70,45,30,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-hr * 0.1, -hr * 0.62);
    ctx.quadraticCurveTo(hr * 0.15, -hr * 0.42, hr * 0.42, -hr * 0.62);
    ctx.stroke();
  }

  // near ear (on top)
  if (b.ear === 'puff') {
    const cx = -hr * 0.42;
    const cy = hr * 0.5;
    curl(ctx, cx, cy - hr * 0.15, hr * 0.55, b.earCol, 0);
    curl(ctx, cx - 0.5, cy + hr * 0.4, hr * 0.5, b.earCol, 0);
    curl(ctx, cx, cy - hr * 0.15, hr * 0.55, b.earCol, 1);
    curl(ctx, cx - 0.5, cy + hr * 0.4, hr * 0.5, b.earCol, 1);
  } else {
    const ne = earPath(b, hr, false);
    const ef = ctx.createLinearGradient(0, -hr * 1.6, 0, hr * 0.9);
    ef.addColorStop(0, lighten(b.earCol, 0.18));
    ef.addColorStop(0.55, b.earCol);
    ef.addColorStop(1, darken(b.earCol, 0.2));
    fillOutlined(ctx, [ne.path], ef, earOc, 1.5);
    if (ne.inner) {
      ctx.fillStyle = b.id === 'husky' ? 'rgba(235,240,248,0.85)' : 'rgba(255,170,160,0.75)';
      ctx.fill(ne.inner);
    }
    ctx.save();
    ctx.clip(ne.path);
    furTexture(ctx, rng(b.seed + 91), hr, hr, 14, 0.2);
    ctx.restore();
    rimLight(ctx, ne.path, lighten(b.earCol, 0.7), darken(b.earCol, 0.55), 0.45, 0.25, 0.9);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ tail sprite

export function drawTail(ctx: Ctx, b: Breed, pup: boolean): void {
  const s = K * b.size * (pup ? PUP : 1);
  ctx.save();
  ctx.translate(TAIL_AX, TAIL_AY);
  ctx.scale(s, s);
  const col = b.tailCol;
  const oc = outline(col);
  const fluffy = b.tail === 'plume' || b.tail === 'fluffcurl' || b.tail === 'stub';

  const strip = (pts: Pt[], widths: number[]): Pt[] => {
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
  };
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
    g.addColorStop(0, lighten(c, 0.22));
    g.addColorStop(0.5, c);
    g.addColorStop(1, darken(c, 0.22));
    fillOutlined(ctx, [p], g, outline(c), 1.5);
    ctx.save();
    ctx.clip(p);
    furTexture(ctx, rng(b.seed * 5 + 2), 18, 12, fluffy ? 36 : 14, 0.22);
    ctx.restore();
    rimLight(ctx, p, lighten(c, 0.75), darken(c, 0.55), 0.55, 0.3, 1.1);
  };

  switch (b.tail) {
    case 'plume': {
      const c = bez({ x: 0, y: 1 }, { x: -9, y: 3 }, { x: -13, y: -4 }, { x: -15, y: -13 }, 12);
      const poly = strip(c, c.map((_, i) => 3.2 + Math.sin((i / 12) * Math.PI) * 2.6 - (i / 12) * 1.4));
      paint(make(poly, 1.2), col, -16, 6);
      break;
    }
    case 'whip': {
      const c = bez({ x: 0, y: 0 }, { x: -6, y: -1 }, { x: -11, y: -4 }, { x: -15, y: -10 }, 10);
      const poly = strip(c, c.map((_, i) => 2.4 - (i / 10) * 1.5));
      paint(make(poly, 0), col, -12, 3);
      if (b.id === 'dalmatian') {
        ctx.save();
        ctx.fillStyle = '#34303a';
        ctx.beginPath();
        ctx.arc(-14.8, -9.6, 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (b.id === 'beagle') {
        ctx.save();
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath();
        ctx.arc(-14.7, -9.5, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = oc;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'otter': {
      const c = bez({ x: 0, y: 0 }, { x: -6, y: 1 }, { x: -11, y: -1 }, { x: -15, y: -5 }, 10);
      const poly = strip(c, c.map((_, i) => 3.6 - (i / 10) * 1.9));
      paint(make(poly, 0), col, -9, 4);
      break;
    }
    case 'curl':
    case 'fluffcurl': {
      const c = bez({ x: 0, y: 0 }, { x: -9, y: -3 }, { x: -9, y: -15 }, { x: -1, y: -14 }, 14);
      const poly = strip(c, c.map((_, i) => 3.3 + (i / 14) * 1.3));
      paint(make(poly, b.tail === 'fluffcurl' ? 1.3 : 0.7), col, -16, 3);
      if (b.id === 'shiba') {
        ctx.save();
        ctx.fillStyle = 'rgba(255,240,214,0.9)';
        ctx.beginPath();
        ctx.ellipse(-3.8, -9, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'stub': {
      const p = new Path2D();
      const poly: Pt[] = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        poly.push({ x: -3 + Math.cos(a) * 4.2, y: -1.5 + Math.sin(a) * 3.8 });
      }
      scallopPath(p, poly, 1, 2);
      paint(p, col, -6, 3);
      break;
    }
    case 'pom': {
      ctx.lineCap = 'round';
      ctx.strokeStyle = oc;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-3, -2, -4.5, -7);
      ctx.stroke();
      ctx.strokeStyle = darken(col, 0.1);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      curl(ctx, -4.8, -11.6, 5.1, col, 0);
      curl(ctx, -4.8, -11.6, 5.1, col, 1);
      break;
    }
    case 'pug': {
      const p = new Path2D();
      p.arc(-3.4, -3.2, 3.3, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-4.2, -4.4, 0.5, -3.4, -3.2, 3.6);
      g.addColorStop(0, lighten(col, 0.3));
      g.addColorStop(1, darken(col, 0.18));
      fillOutlined(ctx, [p], g, oc, 1.5);
      ctx.strokeStyle = rgba(darken(col, 0.5), 0.55);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(-3.4, -3.2, 1.5, 0.3, 4.6);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
