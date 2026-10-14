// Procedural squirrel: grey-brown, big fluffy striped tail, holds an acorn. Faces right.
import { type Ctx, type Pt, darken, lighten, outline, pathFromPts, rimLight, rng, scallopPath } from './shade';

export const SQ_W = 84;
export const SQ_H = 60;
export const SQ_AX = 52;
export const SQ_AY = 52;
export type SquirrelPose = 'sit' | 'stretch' | 'crouch';
export const SQUIRREL_POSES: SquirrelPose[] = ['sit', 'stretch', 'crouch'];

const FUR = '#a98d76';
const FUR_D = '#7c624e';
const BELLY = '#f1e5d2';

function blob(ctx: Ctx, p: Path2D, fill: string | CanvasGradient, ow = 1.6): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = ow * 2;
  ctx.strokeStyle = outline(FUR);
  ctx.stroke(p);
  ctx.fillStyle = fill;
  ctx.fill(p);
}

function tail(ctx: Ctx, pose: SquirrelPose): void {
  // centreline as a cubic bezier, width profile, scalloped (fluffy)
  const pts: Pt[] = [];
  const cps =
    pose === 'stretch'
      ? [{ x: -9, y: -17 }, { x: -22, y: -20 }, { x: -26, y: -30 }, { x: -38, y: -28 }]
      : pose === 'crouch'
        ? [{ x: -9, y: -11 }, { x: -22, y: -10 }, { x: -22, y: -26 }, { x: -12, y: -33 }]
        : [{ x: -7, y: -9 }, { x: -22, y: -6 }, { x: -24, y: -26 }, { x: -12, y: -38 }];
  const N = 16;
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const x = u * u * u * cps[0].x + 3 * u * u * t * cps[1].x + 3 * u * t * t * cps[2].x + t * t * t * cps[3].x;
    const y = u * u * u * cps[0].y + 3 * u * u * t * cps[1].y + 3 * u * t * t * cps[2].y + t * t * t * cps[3].y;
    pts.push({ x, y });
  }
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(N, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const w = 3 + Math.sin((i / N) * Math.PI * 0.9 + 0.2) * 5.2 + (i / N) * 1.2;
    L.push({ x: pts[i].x - (dy / l) * w, y: pts[i].y + (dx / l) * w });
    R.push({ x: pts[i].x + (dy / l) * w, y: pts[i].y - (dx / l) * w });
  }
  const poly = L.concat(R.reverse());
  const p = new Path2D();
  scallopPath(p, poly, 1.3, 2);
  const g = ctx.createLinearGradient(-30, -40, -6, -6);
  g.addColorStop(0, lighten('#c3a487', 0.25));
  g.addColorStop(0.5, '#b0937a');
  g.addColorStop(1, darken('#b0937a', 0.25));
  blob(ctx, p, g);
  ctx.save();
  ctx.clip(p);
  // fur stripes + strokes along the tail
  const r = rng(77 + SQUIRREL_POSES.indexOf(pose));
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const q = pts[Math.floor(r() * pts.length)];
    const x = q.x + (r() - 0.5) * 12;
    const y = q.y + (r() - 0.5) * 12;
    const a = r() * Math.PI * 2;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(70,40,25,0.3)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * 2, y + Math.sin(a + 0.6) * 2, x + Math.cos(a) * 4, y + Math.sin(a) * 4);
    ctx.stroke();
  }
  // lighter tip
  const tip = pts[N];
  const tg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 11);
  tg.addColorStop(0, 'rgba(255,240,220,0.65)');
  tg.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = tg;
  ctx.fillRect(tip.x - 14, tip.y - 14, 28, 28);
  ctx.restore();
  rimLight(ctx, p, '#ffffff', FUR_D, 0.55, 0.3, 1.2);
}

export function drawSquirrel(ctx: Ctx, pose: SquirrelPose): void {
  ctx.save();
  ctx.translate(SQ_AX, SQ_AY);
  tail(ctx, pose);
  const sit = pose === 'sit';
  // body
  const body = new Path2D();
  const bx = sit ? 0 : 1;
  const by = sit ? -13 : pose === 'stretch' ? -13 : -11;
  if (sit) body.ellipse(bx, by, 8.5, 11.5, -0.18, 0, Math.PI * 2);
  else if (pose === 'stretch') body.ellipse(bx - 1, by, 13, 6.4, -0.18, 0, Math.PI * 2);
  else body.ellipse(bx, by, 10.5, 8, 0.1, 0, Math.PI * 2);
  // hind foot / haunch
  const legs = new Path2D();
  if (sit) {
    legs.ellipse(-1, -4.5, 7, 4.5, 0, 0, Math.PI * 2);
  } else if (pose === 'stretch') {
    legs.ellipse(-12, -7, 6, 3, 0.5, 0, Math.PI * 2);
    legs.ellipse(12, -6, 5, 2.6, -0.6, 0, Math.PI * 2);
  } else {
    legs.ellipse(-5, -3.5, 7, 3.8, 0, 0, Math.PI * 2);
    legs.ellipse(8, -3, 4.5, 2.8, 0, 0, Math.PI * 2);
  }
  blob(ctx, legs, darken(FUR, 0.1), 1.4);
  const g = ctx.createLinearGradient(0, by - 12, 0, by + 12);
  g.addColorStop(0, lighten(FUR, 0.22));
  g.addColorStop(0.5, FUR);
  g.addColorStop(1, darken(FUR, 0.22));
  blob(ctx, body, g);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = BELLY;
  ctx.beginPath();
  if (sit) ctx.ellipse(4, by + 1, 5.2, 8.5, -0.1, 0, Math.PI * 2);
  else ctx.ellipse(bx + 2, by + 5, 11, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const r = rng(5);
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = bx + (r() - 0.5) * 22;
    const y = by + (r() - 0.5) * 20;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(60,35,20,0.28)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2.4, y + 1.4);
    ctx.stroke();
  }
  ctx.restore();
  rimLight(ctx, body, '#ffffff', FUR_D, 0.55, 0.3, 1.2);
  // head
  const hx = sit ? 6 : pose === 'stretch' ? 16 : 12;
  const hy = sit ? -27 : pose === 'stretch' ? -17 : -17;
  // ears
  for (const [ex, ey, far] of [[hx - 1.5, hy - 6.5, true], [hx - 4.5, hy - 6, false]] as const) {
    const e = pathFromPts([
      { x: ex - 2.4, y: ey + 3 },
      { x: ex - 1.6, y: ey - 4.6 },
      { x: ex + 2.6, y: ey + 1.6 },
    ]);
    blob(ctx, e, far ? darken(FUR, 0.2) : FUR, 1.3);
    if (!far) {
      ctx.fillStyle = '#f0a8a0';
      ctx.beginPath();
      ctx.ellipse(ex - 0.3, ey, 0.9, 1.9, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const head = new Path2D();
  head.ellipse(hx, hy, 6.8, 6.2, 0, 0, Math.PI * 2);
  head.ellipse(hx + 5.4, hy + 2.2, 3.4, 2.6, 0.25, 0, Math.PI * 2);
  const hg = ctx.createRadialGradient(hx - 2, hy - 3, 1, hx, hy, 9);
  hg.addColorStop(0, lighten(FUR, 0.28));
  hg.addColorStop(1, darken(FUR, 0.12));
  blob(ctx, head, hg);
  ctx.save();
  ctx.clip(head);
  ctx.fillStyle = BELLY;
  ctx.beginPath();
  ctx.ellipse(hx + 3.5, hy + 4, 5.5, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  rimLight(ctx, head, '#ffffff', FUR_D, 0.55, 0.3, 1.1);
  // eye + nose
  ctx.fillStyle = '#1f1620';
  ctx.beginPath();
  ctx.ellipse(hx + 2.6, hy - 0.8, 1.5, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(hx + 2.2, hy - 1.5, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2428';
  ctx.beginPath();
  ctx.ellipse(hx + 8.6, hy + 1.6, 1.3, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  // arms + acorn (sit) or front paws
  if (sit) {
    const ac = new Path2D();
    ac.ellipse(7.6, -15.5, 3.2, 3.8, 0, 0, Math.PI * 2);
    blob(ctx, ac, '#c98a3c', 1.2);
    ctx.fillStyle = '#7a4a22';
    ctx.beginPath();
    ctx.ellipse(7.6, -18.2, 3.4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    const arm = new Path2D();
    arm.ellipse(5, -14, 3.6, 2, 0.5, 0, Math.PI * 2);
    blob(ctx, arm, FUR, 1.2);
  } else {
    const arm = new Path2D();
    arm.ellipse(hx + 1, pose === 'stretch' ? -9 : -5, 3.4, 2, pose === 'stretch' ? 0.6 : 0.1, 0, Math.PI * 2);
    blob(ctx, arm, FUR, 1.2);
  }
  ctx.restore();
}
