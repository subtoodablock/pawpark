// Procedural dog drawing: one breed x pose x frame is baked into the SpriteCache.
// "Egg Inc clean" (docs/12 section 6): natural proportions, 2-3 flat tones per part (light top, base, shadow
// underside) with a crisp 1px darker edge on the shadow side. No outline, no fur strokes, no eye highlights,
// no blush, no default smile. The tail is a separate sprite so the wag is applied live as a rotation
// (hidden for the curled-up nap, where the tail is wrapped around the body inside the body sprite).
import type { Breed, Mark } from './breeds';
import { type Ctx, type Pt, capsulePts, mix, rng, smoothPath } from './shade';

export type Pose = 'walk' | 'run' | 'sit' | 'dig' | 'nap' | 'sniff';
export const POSE_FRAMES: Record<Pose, number> = { walk: 8, run: 4, sit: 1, dig: 2, nap: 1, sniff: 1 };

/** logical sprite box + ground anchor (feet centre) */
export const DOG_W = 62;
export const DOG_H = 44;
export const DOG_AX = 27;
export const DOG_AY = 37;
export const TAIL_W = 38;
export const TAIL_AX = 19;
export const TAIL_AY = 19;
/** dog unit -> css px (a bit smaller than v1 so a populated park reads as a busy toy world) */
export const DOG_K = 0.92;
const PUP = 0.8;
const TAU = Math.PI * 2;
const EYE = '#17120f';

// ------------------------------------------------------------------ tones

interface Tones {
  lt: string;
  base: string;
  sh: string;
  ed: string;
}
const toneCache = new Map<string, Tones>();
function tones(c: string): Tones {
  let t = toneCache.get(c);
  if (!t) {
    t = { lt: mix(c, '#ffffff', 0.17), base: c, sh: mix(c, '#34285a', 0.2), ed: mix(c, '#1e1234', 0.44) };
    toneCache.set(c, t);
  }
  return t;
}
function far(c: string): string {
  return mix(c, '#34285a', 0.2);
}

type M2 = { a: number; b: number; c: number; d: number; e: number; f: number };
const IDENT: M2 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

interface Piece {
  path: Path2D;
  col: string;
}

function ell(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  return p;
}

function markPieces(marks: Mark[], m: M2, farSide = false): Piece[] {
  const out: Piece[] = [];
  for (const mk of marks) {
    const p = new Path2D();
    const local = new Path2D();
    if (mk.k === 'e') local.ellipse(mk.x, mk.y, mk.rx, mk.ry, mk.rot ?? 0, 0, TAU);
    else {
      const r = rng(mk.seed);
      for (let i = 0; i < mk.n; i++) {
        const a = r() * TAU;
        const d = Math.sqrt(r());
        const x = (mk.ox ?? 0) + Math.cos(a) * d * mk.rx;
        const y = (mk.oy ?? 0) + Math.sin(a) * d * mk.ry;
        const rad = mk.rMin + r() * (mk.rMax - mk.rMin);
        local.moveTo(x + rad * 1.1, y);
        local.ellipse(x, y, rad * 1.1, rad, r() * 3, 0, TAU);
      }
    }
    p.addPath(local, m);
    out.push({ path: p, col: farSide ? far(mk.col) : mk.col });
  }
  return out;
}

/** 3-tone flat shading of one shape: shadow underside + 1px edge, base, light top-left. Marks are re-shaded in their own colour. */
function shadeOne(ctx: Ctx, P: Path2D, t: Tones, d: number, dx: number): void {
  ctx.fillStyle = t.ed;
  ctx.fill(P);
  ctx.save();
  ctx.translate(-0.45, -0.6);
  ctx.fillStyle = t.sh;
  ctx.fill(P);
  ctx.restore();
  ctx.save();
  ctx.translate(-dx, -d);
  ctx.clip(P);
  ctx.fillStyle = t.lt;
  ctx.fill(P);
  ctx.translate(dx * 0.55, d * 0.86);
  ctx.fillStyle = t.base;
  ctx.fill(P);
  ctx.restore();
}

function shadePart(ctx: Ctx, P: Path2D, col: string, marks: Piece[], d = 1.8, dx = 0.9): void {
  ctx.save();
  ctx.clip(P);
  shadeOne(ctx, P, tones(col), d, dx);
  for (const m of marks) {
    ctx.save();
    ctx.clip(m.path);
    shadeOne(ctx, P, tones(m.col), d, dx);
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ skeleton

interface Chain {
  x: number;
  y: number;
  r: number;
}
interface Leg {
  chain: Chain[];
  far: boolean;
  /** drawn over the body (sitting forelegs) */
  over: boolean;
  foot: Pt;
  pawRx: number;
  pawRy: number;
}
interface Skel {
  S: Pt;
  H: Pt;
  rc: number;
  rh: number;
  tuck: number;
  neck: boolean;
  head: Pt;
  headRot: number;
  legs: Leg[];
  tail: Pt;
  tailRest: number;
  tailHide: boolean;
  closedEyes: boolean;
  tongue: boolean;
  pose: Pose;
  /** whole-body rocking: rotation / squash-stretch about the pivot */
  tilt: number;
  sx: number;
  sy: number;
  pivot: Pt;
  /** sit: thigh + folded hind leg */
  thigh: Path2D | null;
  /** nap: curled body ellipse */
  ball: { cx: number; cy: number; rx: number; ry: number } | null;
  paws: { x: number; y: number; rx: number; ry: number }[];
  /** 0..1 ears blown back */
  earBack: number;
  /** extra ruff / rump bumps in the torso-local frame */
  ruff: { x: number; y: number; rx: number; ry: number }[];
}

export function dogKey(breed: number, pose: Pose, frame: number, pup: boolean): string {
  return `dog:${breed}:${pose}:${frame}:${pup ? 1 : 0}`;
}
export function tailKey(breed: number, pup: boolean): string {
  return `tail:${breed}:${pup ? 1 : 0}`;
}

function dims(b: Breed, pup: boolean) {
  return {
    r: (b.bodyH / 2) * (pup ? 0.92 : 1),
    legH: b.legH * (pup ? 0.84 : 1),
    hr: b.headR * (pup ? 1.2 : 1),
    sl: b.snoutL * (pup ? 0.86 : 1),
    bodyL: b.bodyL * (pup ? 0.86 : 1),
    legW: b.legW * (pup ? 1.05 : 1),
  };
}

/** two-bone IK: the joint position for a limb from a to f. bend > 0 bends toward -x for a downward leg. */
function ik(ax: number, ay: number, fx: number, fy: number, l1: number, l2: number, bend: number): Pt {
  const dx = fx - ax;
  const dy = fy - ay;
  const d = Math.hypot(dx, dy) || 1;
  const dm = Math.min(d, l1 + l2 - 0.02);
  const a = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  return { x: ax + ux * a - uy * bend * h, y: ay + uy * a + ux * bend * h };
}

function skeleton(b: Breed, pose: Pose, f: number, pup: boolean): Skel {
  const { r, legH, hr, bodyL: bl0, legW } = dims(b, pup);
  const n = POSE_FRAMES[pose];
  const th = (f / n) * TAU;
  const rc = r * 1.13;
  const rh = r * 0.95;
  const sy0 = -(legH + r);
  const pawRy = 0.95 * legW;
  const pawRx = 1.5 * legW;
  const gy = -pawRy;
  let bodyL = bl0;
  const sk: Skel = {
    S: { x: bodyL / 2, y: sy0 + 0.3 },
    H: { x: -bodyL / 2, y: sy0 },
    rc,
    rh,
    tuck: r * (b.id === 'dachshund' ? 0.1 : 0.26),
    neck: true,
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
    thigh: null,
    ball: null,
    paws: [],
    earBack: 0,
    ruff: [],
  };
  const lw = (k: number): number => k * legW;
  // front leg: elbow bends slightly back; hind leg: hock bends back
  const front = (top: Pt, foot: Pt, isFar: boolean, over = false): void => {
    const len = Math.max(2, Math.hypot(foot.x - top.x, foot.y - top.y));
    const l = len * 0.515;
    const k = ik(top.x, top.y, foot.x, foot.y, l, l, 1);
    sk.legs.push({ chain: [{ x: top.x, y: top.y, r: lw(2.2) }, { x: k.x, y: k.y, r: lw(1.6) }, { x: foot.x, y: foot.y, r: lw(1.3) }], far: isFar, over, foot, pawRx, pawRy });
  };
  const hind = (top: Pt, foot: Pt, isFar: boolean): void => {
    const len = Math.max(2, Math.hypot(foot.x - top.x, foot.y - top.y));
    const l = len * 0.565;
    const k = ik(top.x, top.y, foot.x, foot.y, l, l, 1);
    sk.legs.push({ chain: [{ x: top.x, y: top.y, r: lw(2.6) }, { x: k.x, y: k.y, r: lw(1.6) }, { x: foot.x, y: foot.y, r: lw(1.25) }], far: isFar, over: false, foot, pawRx, pawRy });
  };
  const fTop = (dx = 0): Pt => ({ x: sk.S.x - 0.8 + dx, y: sk.S.y + rc * 0.45 });
  const hTop = (dx = 0): Pt => ({ x: sk.H.x + 0.8 + dx, y: sk.H.y + rh * 0.35 });
  const farOff = 1.6;
  let headDy = 0;
  switch (pose) {
    case 'walk': {
      const bob = Math.abs(Math.sin(th));
      const dy = -0.4 * bob;
      sk.S.y += dy;
      sk.H.y += dy;
      sk.tilt = Math.sin(th) * 0.012;
      sk.sy = 1 + (bob - 0.5) * 0.02;
      const sw = 1.9 + legH * 0.12;
      const lf = 1.2 + legH * 0.06;
      const foot = (x: number, p: number): Pt => ({ x: x + Math.sin(p) * sw, y: gy - Math.max(0, Math.cos(p)) * lf });
      const fx = sk.S.x - 0.4;
      const hx = sk.H.x - 0.6;
      hind(hTop(farOff * 0.6), foot(hx + farOff * 0.6, th), true);
      front(fTop(farOff), foot(fx + farOff, th + Math.PI), true);
      hind(hTop(), foot(hx, th + Math.PI), false);
      front(fTop(), foot(fx, th), false);
      headDy = -Math.sin(th * 2) * 0.12;
      break;
    }
    case 'run': {
      bodyL *= 1.1;
      sk.S.x = bodyL / 2;
      sk.H.x = -bodyL / 2;
      const air = Math.max(0, Math.sin(th)) * 1.5;
      const by = sy0 - air - 0.4;
      sk.S.y = by - Math.sin(th) * 0.8;
      sk.H.y = by + Math.sin(th) * 0.8;
      sk.tilt = -Math.sin(th) * 0.04;
      const reach = 3.4 + legH * 0.12;
      const lf = 2.2 + legH * 0.1;
      const foot = (x: number, p: number): Pt => ({ x: x + Math.cos(p) * reach, y: gy - Math.max(0, Math.sin(p)) * lf });
      const fx = sk.S.x - 0.4;
      const hx = sk.H.x - 0.6;
      hind(hTop(0.8), foot(hx + 0.8, th + Math.PI * 0.95 + 0.35), true);
      front(fTop(farOff), foot(fx + farOff, th + 0.3), true);
      hind(hTop(), foot(hx, th + Math.PI * 0.95), false);
      front(fTop(), foot(fx, th), false);
      headDy = -Math.sin(th) * 0.25 - 0.1;
      sk.headRot = -0.05;
      sk.tongue = true;
      sk.tailRest = -0.35;
      sk.earBack = 1;
      break;
    }
    case 'sniff': {
      sk.S.y += 1.1;
      sk.tilt = 0.025;
      hind(hTop(farOff * 0.6), { x: sk.H.x - 0.6 + farOff * 0.6 + 0.4, y: gy }, true);
      front(fTop(farOff), { x: sk.S.x - 0.2 + farOff + 1.6, y: gy }, true);
      hind(hTop(), { x: sk.H.x - 0.6, y: gy }, false);
      front(fTop(), { x: sk.S.x - 0.2 + 0.6, y: gy }, false);
      sk.headRot = 0.5;
      break;
    }
    case 'dig': {
      sk.S.y += 2.2;
      sk.H.y -= 0.5;
      const a0 = f === 0;
      hind(hTop(farOff * 0.6), { x: sk.H.x - 0.6 + farOff * 0.6, y: gy }, true);
      hind(hTop(), { x: sk.H.x - 0.6, y: gy }, false);
      // forelegs scratch forward / back alternately
      front(fTop(farOff), { x: sk.S.x + farOff + (a0 ? 3.6 : 0.2), y: gy - (a0 ? 0 : 2.2) }, true);
      front(fTop(), { x: sk.S.x + (a0 ? 0.2 : 3.8), y: gy - (a0 ? 2.0 : 0) }, false);
      sk.headRot = 0.8;
      sk.tailRest = 0.3;
      break;
    }
    case 'sit': {
      const hipY = -rh * 0.98;
      sk.H = { x: -bl0 * 0.5 - 1.2, y: hipY };
      const ang = -1.12;
      const L = Math.max(bl0 * 0.85, legH + r * 0.9);
      sk.S = { x: sk.H.x + Math.cos(ang) * L, y: sk.H.y + Math.sin(ang) * L };
      sk.tuck *= 0.4;
      const ft = { x: sk.S.x + rc * 0.28, y: sk.S.y + rc * 0.5 };
      front({ x: ft.x + farOff * 0.8, y: ft.y }, { x: ft.x + farOff * 0.8 + 0.3, y: gy }, true, true);
      front(ft, { x: ft.x + 0.3, y: gy }, false, true);
      // thigh + folded hind leg lying forward
      const t = new Path2D();
      t.addPath(ell(sk.H.x + 0.4, sk.H.y + 0.3, rh * 1.12, rh * 1.08));
      const pf = { x: sk.H.x + rh * 1.35, y: -0.95 };
      t.addPath(ell(pf.x, pf.y, 3.0 * legW, 1.0 * legW + 0.2));
      const lg = capsulePts(sk.H.x + rh * 0.5, sk.H.y + rh * 0.55, rh * 0.62, pf.x - 1.2, pf.y, 1.2 * legW, 10);
      const lp = new Path2D();
      smoothPath(lp, lg);
      t.addPath(lp);
      sk.thigh = t;
      sk.tailRest = -0.85;
      sk.headRot = -0.1;
      break;
    }
    case 'nap': {
      sk.neck = false;
      sk.closedEyes = true;
      sk.tailHide = true;
      const rx = bl0 * 0.36 + rc * 1.18;
      const ry = r * 1.2;
      const cx = -2.8;
      const cy = -ry + 0.5;
      sk.ball = { cx, cy, rx, ry };
      sk.S = { x: cx + 1, y: cy };
      sk.H = { x: cx - 1, y: cy };
      sk.head = { x: cx + rx * 0.72 + hr * 0.3, y: -hr * 0.84 };
      sk.headRot = 0.2;
      sk.paws.push({ x: sk.head.x + hr * 0.3, y: -1.0, rx: 2.5 * legW, ry: 1.05 * legW });
      sk.paws.push({ x: sk.head.x + hr * 0.75, y: -0.9, rx: 2.3 * legW, ry: 1.0 * legW });
      sk.tail = { x: cx - rx, y: cy };
      return sk;
    }
  }
  // head
  if (pose === 'sit') {
    sk.head = { x: sk.S.x + 1.4 + hr * 0.3, y: sk.S.y - rc * 0.5 - hr * 0.56 };
  } else if (pose === 'sniff') {
    sk.head = { x: sk.S.x + rc * 0.5 + hr * 0.8, y: Math.min(sk.S.y + 0.5, -hr * 0.88) };
  } else if (pose === 'dig') {
    sk.head = { x: sk.S.x + rc * 0.5 + hr * 0.72, y: Math.min(sk.S.y + 0.5, -hr * 0.9) };
  } else {
    sk.head = { x: sk.S.x + rc * 0.5 + hr * 0.6, y: sk.S.y - rc * 0.68 - hr * 0.5 + headDy };
  }
  sk.tail = pose === 'sit' ? { x: sk.H.x - rh * 0.5, y: sk.H.y + rh * 0.78 } : { x: sk.H.x - rh * 0.86, y: sk.H.y - rh * 0.32 };
  if (b.fluff === 'chest' || b.fluff === 'all') sk.ruff.push({ x: bl0 * 0.5 + rc * 0.3, y: rc * 0.55, rx: rc * 0.7, ry: rc * 0.55 });
  if (b.fluff === 'rear' || b.fluff === 'all') sk.ruff.push({ x: -bl0 * 0.5 - rh * 0.2, y: rh * 0.38, rx: rh * 0.8, ry: rh * 0.62 });
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

// ------------------------------------------------------------------ parts

function legPath(l: Leg, curly: boolean): Path2D {
  const p = new Path2D();
  for (let i = 0; i < l.chain.length - 1; i++) {
    const a = l.chain[i];
    const c = l.chain[i + 1];
    const q = new Path2D();
    smoothPath(q, capsulePts(a.x, a.y, a.r, c.x, c.y, c.r, 8));
    p.addPath(q);
  }
  p.addPath(ell(l.foot.x + 0.55, l.foot.y + 0.15, l.pawRx, l.pawRy));
  if (curly) p.addPath(ell(l.foot.x + 0.1, l.foot.y - 1.6, l.pawRy * 2.0, l.pawRy * 1.9));
  return p;
}

function drawLeg(ctx: Ctx, b: Breed, l: Leg): void {
  const curly = b.fur === 'curly';
  const col = l.far ? far(b.base) : b.base;
  const marks: Piece[] = [];
  if (b.sockCol && !curly) {
    const sc = l.far ? far(b.sockCol) : b.sockCol;
    marks.push({ path: ell(l.foot.x + 0.4, l.foot.y - 0.3, l.pawRx + 1.0, l.pawRy + 1.5), col: sc });
  }
  shadePart(ctx, legPath(l, curly), col, marks, 0.8, 0.55);
}

function torsoPath(b: Breed, sk: Skel): Path2D {
  const p = new Path2D();
  const bl = sk.ball;
  if (bl) {
    const q = new Path2D();
    const pts: Pt[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      const fl = Math.sin(a) > 0.6 ? 1 - (Math.sin(a) - 0.6) * 0.18 : 1;
      pts.push({ x: bl.cx + Math.cos(a) * bl.rx * fl, y: bl.cy + Math.sin(a) * bl.ry });
    }
    smoothPath(q, pts);
    p.addPath(q);
    return p;
  }
  const dx = sk.S.x - sk.H.x;
  const dy = sk.S.y - sk.H.y;
  const L = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const mx = (sk.S.x + sk.H.x) / 2;
  const my = (sk.S.y + sk.H.y) / 2;
  const m: M2 = { a: Math.cos(ang), b: Math.sin(ang), c: -Math.sin(ang), d: Math.cos(ang), e: mx, f: my };
  const curly = b.fur === 'curly';
  if (curly) {
    const circ = (x: number, y: number, r: number): void => {
      p.addPath(ell(x, y, r, r), m);
    };
    circ(-L / 2, 0, sk.rh * 1.02);
    circ(L / 2, 0, sk.rc * 1.0);
    circ(-L * 0.22, -sk.rh * 0.45, sk.rh * 0.78);
    circ(L * 0.2, -sk.rc * 0.45, sk.rc * 0.78);
    circ(-L * 0.12, sk.rh * 0.4, sk.rh * 0.72);
    circ(L * 0.12, sk.rc * 0.4, sk.rc * 0.72);
  } else {
    const pts = capsulePts(-L / 2, 0, sk.rh, L / 2, 0, sk.rc, 14);
    for (const q of pts) {
      if (q.y > 0 && q.x > -L / 2 && q.x < L / 2) {
        const u = (q.x + L / 2) / L;
        q.y -= sk.tuck * Math.sin(u * Math.PI);
      }
    }
    const t = new Path2D();
    smoothPath(t, pts);
    p.addPath(t, m);
    for (const e of sk.ruff) p.addPath(ell(e.x, e.y, e.rx, e.ry), m);
  }
  if (sk.neck) {
    const nk = new Path2D();
    smoothPath(nk, capsulePts(sk.S.x + sk.rc * 0.05, sk.S.y - sk.rc * 0.2, sk.rc * 0.84, sk.head.x - 0.6, sk.head.y + 0.6, sk.rc * 0.7, 12));
    p.addPath(nk);
  }
  return p;
}

// ------------------------------------------------------------------ head

function headPath(R: number, sl: number, flat: boolean): Path2D {
  const p = new Path2D();
  const t = flat ? 0.18 : 0.2;
  p.moveTo(-0.92 * R, 0.3 * R);
  p.bezierCurveTo(-1.1 * R, -0.55 * R, -0.55 * R, -1.03 * R, 0.1 * R, -1.0 * R);
  p.bezierCurveTo(0.62 * R, -0.98 * R, 0.94 * R, -0.62 * R, 1.0 * R, -0.28 * R);
  p.bezierCurveTo(1.0 * R + sl * 0.3, -t * R, 1.0 * R + sl * 0.78, -t * R, 1.0 * R + sl, -0.16 * R);
  p.bezierCurveTo(1.0 * R + sl + 0.45, -0.1 * R, 1.0 * R + sl + 0.45, 0.34 * R, 1.0 * R + sl - 0.1, 0.46 * R);
  p.bezierCurveTo(1.0 * R + sl * 0.6, 0.55 * R, 0.72 * R, 0.62 * R, 0.5 * R, 0.72 * R);
  p.bezierCurveTo(0.2 * R, 0.98 * R, -0.45 * R, 1.0 * R, -0.72 * R, 0.76 * R);
  p.closePath();
  return p;
}

function earShape(kind: string, R: number, far: boolean): { path: Path2D; root: Pt; rot: number; inner: Path2D | null } {
  const p = new Path2D();
  let inner: Path2D | null = null;
  switch (kind) {
    case 'floppy':
    case 'long': {
      const long = kind === 'long';
      const L = R * (long ? 1.9 : 1.5) * (far ? 0.78 : 1);
      const W = R * (long ? 0.95 : 0.86) * (far ? 0.85 : 1);
      p.moveTo(-W * 0.5, 0);
      p.bezierCurveTo(-W * 0.8, L * 0.45, -W * 0.4, L * 1.0, W * 0.1, L);
      p.bezierCurveTo(W * 0.95, L * 0.95, W * 0.95, L * 0.3, W * 0.5, 0);
      p.closePath();
      return { path: p, root: far ? { x: 0.46 * R, y: -0.82 * R } : { x: -0.36 * R, y: -0.7 * R }, rot: far ? -0.35 : 0.1, inner };
    }
    case 'pointy':
    case 'big':
    case 'small': {
      const H = R * (kind === 'big' ? 1.3 : kind === 'small' ? 0.78 : 1.05);
      const W = R * (kind === 'big' ? 0.95 : kind === 'small' ? 0.7 : 0.78);
      const mk = (w: number, h: number): Path2D => {
        const q = new Path2D();
        q.moveTo(-w / 2, 0);
        q.quadraticCurveTo(-w * 0.5, -h * 0.62, w * 0.08, -h);
        q.quadraticCurveTo(w * 0.62, -h * 0.5, w / 2, 0);
        q.closePath();
        return q;
      };
      if (!far) inner = mk(W * 0.5, H * 0.66);
      return { path: mk(W, H), root: far ? { x: 0.38 * R, y: -0.8 * R } : { x: -0.2 * R, y: -0.74 * R }, rot: far ? 0.12 : -0.04, inner };
    }
    default: {
      // rose (pug): small folded triangle
      const W = R * 0.5;
      p.moveTo(-W, 0.15 * R);
      p.quadraticCurveTo(-W * 0.9, -0.75 * R, W * 0.3, -0.62 * R);
      p.quadraticCurveTo(W * 1.3, -0.1 * R, W * 0.9, 0.5 * R);
      p.quadraticCurveTo(0, 0.2 * R, -W, 0.15 * R);
      p.closePath();
      return { path: p, root: far ? { x: 0.5 * R, y: -0.62 * R } : { x: -0.3 * R, y: -0.42 * R }, rot: far ? 0.2 : 0, inner };
    }
  }
}

function drawEar(ctx: Ctx, b: Breed, R: number, back: number, isFar: boolean): void {
  if (b.ear === 'puff') {
    const col = isFar ? far(b.earCol) : b.earCol;
    const px = isFar ? 0.55 * R : -0.55 * R;
    const pp = new Path2D();
    pp.addPath(ell(px, 0.1 * R, 0.52 * R, 0.56 * R));
    pp.addPath(ell(px - 0.05 * R, 0.62 * R, 0.46 * R, 0.5 * R));
    shadePart(ctx, pp, col, [], 1.2, 0.7);
    return;
  }
  const es = earShape(b.ear, R, isFar);
  const col = isFar ? far(b.earCol) : b.earCol;
  const floppy = b.ear === 'floppy' || b.ear === 'long';
  const rot = es.rot + (floppy ? back * (isFar ? 0.4 : 0.75) : -back * 0.5);
  ctx.save();
  ctx.translate(es.root.x, es.root.y);
  ctx.rotate(rot);
  shadePart(ctx, es.path, col, [], 1.2, 0.7);
  if (es.inner) {
    const ic = b.id === 'husky' ? '#e4e8ef' : mix(b.earCol, '#f4d8c6', 0.55);
    shadePart(ctx, es.inner, ic, [], 0.5, 0.3);
  }
  ctx.restore();
}

function drawHead(ctx: Ctx, b: Breed, sk: Skel, R: number, sl: number, pup: boolean): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headRot);
  const curly = b.fur === 'curly';
  const pug = b.id === 'pug';

  drawEar(ctx, b, R, sk.earBack, true);

  const skull = headPath(R, sl, pug);
  const marks = markPieces(b.head, IDENT);
  // muzzle (distinct colour from the coat)
  if (b.snoutCol !== b.base) {
    const mxc = pug ? 0.78 * R + sl * 0.4 : 0.55 * R + (sl + 0.5 * R) * 0.5;
    const mrx = pug ? 0.75 * R + sl * 0.5 : (sl + 0.55 * R) * 0.5 + 0.8;
    marks.unshift({ path: ell(mxc, pug ? 0.12 * R : 0.2 * R, mrx, pug ? 0.62 * R : 0.46 * R), col: b.snoutCol });
  }
  shadePart(ctx, skull, b.base, marks, 1.5, 0.8);

  if (curly) {
    const tk = new Path2D();
    tk.addPath(ell(-0.05 * R, -1.0 * R, 0.62 * R, 0.52 * R));
    tk.addPath(ell(0.46 * R, -0.9 * R, 0.46 * R, 0.42 * R));
    shadePart(ctx, tk, b.base, [], 1.2, 0.7);
  }

  // eye: small dark almond, no highlight
  const er = (pug ? 1.1 : 0.95) * (pup ? 1.1 : 1);
  if (sk.closedEyes) {
    ctx.strokeStyle = EYE;
    ctx.lineWidth = 0.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0.5 * R, -0.18 * R, er * 0.9, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else {
    ctx.fillStyle = EYE;
    ctx.beginPath();
    ctx.ellipse(0.5 * R, -0.22 * R, er, er * 0.8, -0.2, 0, TAU);
    ctx.fill();
  }
  // nose
  const nx = 1.0 * R + sl - (pug ? 0.2 : 0.55);
  const ny = pug ? -0.02 * R : -0.12 * R + 0.55;
  ctx.fillStyle = b.nose;
  ctx.beginPath();
  ctx.ellipse(nx, ny, pug ? 1.3 : 1.35, pug ? 1.05 : 1.1, -0.1, 0, TAU);
  ctx.fill();
  if (pug) {
    // two short brow wrinkles on the pug
    ctx.strokeStyle = mix(b.base, '#4a2e1c', 0.4);
    ctx.lineWidth = 0.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.1 * R, -0.66 * R);
    ctx.quadraticCurveTo(0.2 * R, -0.78 * R, 0.5 * R, -0.62 * R);
    ctx.stroke();
  }
  if (sk.tongue) {
    ctx.fillStyle = '#e46f82';
    ctx.beginPath();
    ctx.ellipse(1.0 * R + sl * 0.62, 0.52 * R + 1.1, 1.05, 1.6, 0.1, 0, TAU);
    ctx.fill();
  }
  drawEar(ctx, b, R, sk.earBack, false);
  ctx.restore();
}

// ------------------------------------------------------------------ the frame

export function drawDogFrame(ctx: Ctx, b: Breed, pose: Pose, f: number, pup: boolean): void {
  const sk = skeleton(b, pose, f, pup);
  const { hr, sl } = dims(b, pup);
  const s = DOG_K * b.size * (pup ? PUP : 1);
  ctx.save();
  ctx.translate(DOG_AX, DOG_AY);
  ctx.scale(s, s);

  // legs first (the torso overlaps their tops)
  for (const l of sk.legs) if (l.far && !l.over) drawLeg(ctx, b, l);
  for (const l of sk.legs) if (!l.far && !l.over) drawLeg(ctx, b, l);

  ctx.save();
  ctx.translate(sk.pivot.x, sk.pivot.y);
  ctx.rotate(sk.tilt);
  ctx.scale(sk.sx, sk.sy);
  ctx.translate(-sk.pivot.x, -sk.pivot.y);

  // torso (+ neck) with its marks
  const tp = torsoPath(b, sk);
  let m: M2;
  if (sk.ball) m = { ...IDENT, e: sk.ball.cx, f: sk.ball.cy };
  else {
    const ang = Math.atan2(sk.S.y - sk.H.y, sk.S.x - sk.H.x);
    m = { a: Math.cos(ang), b: Math.sin(ang), c: -Math.sin(ang), d: Math.cos(ang), e: (sk.S.x + sk.H.x) / 2, f: (sk.S.y + sk.H.y) / 2 };
  }
  shadePart(ctx, tp, b.base, markPieces(b.body, m), 1.6, 0.9);
  for (const l of sk.legs) if (l.over) drawLeg(ctx, b, l);
  if (sk.thigh) shadePart(ctx, sk.thigh, b.base, [], 1.4, 0.8);
  if (sk.ball) for (const p of sk.paws) shadePart(ctx, ell(p.x, p.y, p.rx, p.ry), b.sockCol ?? b.base, [], 0.7, 0.5);
  if (sk.ball) drawWrappedTail(ctx, b, sk);
  drawHead(ctx, b, sk, hr, sl, pup);
  ctx.restore();
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

function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
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
}

function tailTipMark(b: Breed, tip: Pt): Piece[] {
  if (b.id === 'dalmatian') return [{ path: ell(tip.x, tip.y, 2.4, 2.4), col: '#2e2b33' }];
  if (b.id === 'beagle') return [{ path: ell(tip.x, tip.y, 2.6, 2.6), col: '#fbf6ea' }];
  return [];
}

/** curled-up nap: the tail hugs the front-bottom of the ball, tip tucked toward the paws */
function drawWrappedTail(ctx: Ctx, b: Breed, sk: Skel): void {
  const bl = sk.ball!;
  const pts: Pt[] = [];
  const widths: number[] = [];
  const n = 14;
  const a0 = Math.PI * 0.97;
  const a1 = Math.PI * 0.3;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    pts.push({ x: bl.cx + Math.cos(a) * (bl.rx * 0.97 - 0.5), y: bl.cy + Math.sin(a) * (bl.ry * 0.98 - 0.3) });
    widths.push(2.3 - t * 0.7);
  }
  const p = new Path2D();
  smoothPath(p, strip(pts, widths));
  const tip = pts[n];
  let marks: Piece[] = tailTipMark(b, tip);
  if (b.tail === 'pom') {
    p.addPath(ell(tip.x, tip.y, 3.0, 3.0));
    marks = [];
  }
  shadePart(ctx, p, b.tailCol, marks, 1.2, 0.7);
}

export function drawTail(ctx: Ctx, b: Breed, pup: boolean): void {
  const s = DOG_K * b.size * (pup ? PUP : 1);
  ctx.save();
  ctx.translate(TAIL_AX, TAIL_AY);
  const ts = { plume: 0.9, whip: 0.95, otter: 0.9, curl: 0.82, fluffcurl: 0.82, stub: 1.0, pom: 0.9, pug: 0.95 }[b.tail];
  ctx.scale(s * ts, s * ts);
  const col = b.tailCol;
  const poly = (pts: Pt[]): Path2D => {
    const p = new Path2D();
    smoothPath(p, pts);
    return p;
  };
  switch (b.tail) {
    case 'plume': {
      const c = bez({ x: 0, y: 1 }, { x: -6, y: 2 }, { x: -9, y: -3 }, { x: -9.5, y: -9 }, 12);
      shadePart(ctx, poly(strip(c, c.map((_, i) => 2.5 + Math.sin((i / 12) * Math.PI) * 1.8 - (i / 12) * 1.0))), col, [], 1.3, 0.7);
      break;
    }
    case 'whip': {
      const c = bez({ x: 0, y: 0 }, { x: -4, y: -1 }, { x: -7, y: -3 }, { x: -9.5, y: -7 }, 10);
      shadePart(ctx, poly(strip(c, c.map((_, i) => 2.0 - (i / 10) * 0.95))), col, tailTipMark(b, c[c.length - 1]), 1.0, 0.6);
      break;
    }
    case 'otter': {
      const c = bez({ x: 0, y: 0 }, { x: -4, y: 1 }, { x: -7, y: -0.5 }, { x: -9.5, y: -3.6 }, 10);
      shadePart(ctx, poly(strip(c, c.map((_, i) => 3.0 - (i / 10) * 1.5))), col, [], 1.2, 0.7);
      break;
    }
    case 'curl':
    case 'fluffcurl': {
      const c = bez({ x: 0, y: 0 }, { x: -6, y: -2 }, { x: -7, y: -10.5 }, { x: -1.2, y: -9.8 }, 14);
      const marks: Piece[] = [];
      if (b.id === 'shiba') marks.push({ path: ell(-3.2, -6.4, 1.5, 2.6), col: '#fbeed6' });
      else if (b.id === 'husky') marks.push({ path: ell(-3.2, -6.4, 1.4, 2.6), col: '#f1f3f7' });
      shadePart(ctx, poly(strip(c, c.map((_, i) => 2.6 + (i / 14) * 1.2))), col, marks, 1.3, 0.7);
      break;
    }
    case 'stub': {
      shadePart(ctx, ell(-2.4, -1.4, 3.6, 3.2), col, [], 1.2, 0.7);
      break;
    }
    case 'pom': {
      const p = new Path2D();
      const c = bez({ x: 0, y: 0 }, { x: -2, y: -1.5 }, { x: -3, y: -4.5 }, { x: -3.6, y: -7 }, 6);
      p.addPath(poly(strip(c, c.map(() => 1.2))));
      p.addPath(ell(-3.9, -9.2, 3.5, 3.4));
      shadePart(ctx, p, col, [], 1.2, 0.7);
      break;
    }
    case 'pug': {
      const c1 = bez({ x: 0.5, y: 0.5 }, { x: -2.6, y: 0.8 }, { x: -5.8, y: -0.8 }, { x: -5.4, y: -4.2 }, 8);
      const c2 = bez({ x: -5.4, y: -4.2 }, { x: -5, y: -7 }, { x: -1.4, y: -7 }, { x: -1.5, y: -4.4 }, 8);
      const all = c1.concat(c2.slice(1));
      shadePart(ctx, poly(strip(all, all.map(() => 1.7))), col, [], 1.0, 0.6);
      break;
    }
  }
  ctx.restore();
}
