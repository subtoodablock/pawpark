// Delivery fleet sprites (side view, facing right). Wheels are separate sprites that rotate live.
import { type Ctx, type Pt, darken, lighten, outline, rgba, rimLight, roundRect, star4 } from './shade';

export const VEH_W = 156;
export const VEH_H = 64;
export const VEH_AX = 78;
export const VEH_AY = 54;

export interface VehicleSpec {
  /** visual width used for spacing */
  w: number;
  wheels: { x: number; r: number }[];
  /** floats above the road (px) */
  hover: number;
  /** contact shadow half width */
  sw: number;
  /** suspension bob amplitude */
  bob: number;
  /** emits smoke/exhaust: offset from anchor */
  exhaust?: Pt;
  swirl?: boolean;
}

export const VEHICLE_SPECS: VehicleSpec[] = [
  { w: 36, wheels: [{ x: -14, r: 8 }, { x: 14, r: 8 }], hover: 0, sw: 22, bob: 0.4 },
  { w: 44, wheels: [{ x: -12, r: 5.5 }, { x: 13, r: 5.5 }], hover: 0, sw: 24, bob: 0.5 },
  { w: 46, wheels: [{ x: -17, r: 6.5 }, { x: 17, r: 6.5 }], hover: 0, sw: 26, bob: 0.5 },
  { w: 72, wheels: [{ x: -22, r: 7.5 }, { x: 20, r: 7.5 }], hover: 0, sw: 38, bob: 0.7 },
  { w: 74, wheels: [{ x: -22, r: 7.5 }, { x: 21, r: 7.5 }], hover: 0, sw: 40, bob: 0.7 },
  { w: 82, wheels: [{ x: -26, r: 7.5 }, { x: -10, r: 7.5 }, { x: 24, r: 7.5 }], hover: 0, sw: 46, bob: 0.7 },
  { w: 108, wheels: [{ x: -42, r: 7.5 }, { x: -28, r: 7.5 }, { x: 34, r: 7.5 }], hover: 0, sw: 60, bob: 0.8 },
  { w: 146, wheels: [{ x: -58, r: 7 }, { x: -44, r: 7 }, { x: -10, r: 7 }, { x: 8, r: 7 }, { x: 46, r: 7 }], hover: 0, sw: 78, bob: 0.8 },
  { w: 92, wheels: [{ x: -20, r: 4 }, { x: 24, r: 4 }], hover: 3, sw: 52, bob: 0.6 },
  { w: 96, wheels: [], hover: 0, sw: 52, bob: 0.9 },
  { w: 62, wheels: [], hover: 11, sw: 32, bob: 1.6 },
  { w: 78, wheels: [{ x: -16, r: 4.5 }, { x: 16, r: 4.5 }], hover: 3, sw: 40, bob: 0.5, exhaust: { x: -40, y: -14 } },
  { w: 56, wheels: [], hover: 6, sw: 30, bob: 1.2, swirl: true },
];

const VOC = 1.5;

function fillPoly(ctx: Ctx, pts: Pt[], fill: string | CanvasGradient, oc: string, ow = VOC): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = ow;
  ctx.strokeStyle = oc;
  ctx.stroke();
}
function vg(ctx: Ctx, y0: number, y1: number, top: string, bot: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  return g;
}
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, col: string, ow = VOC, shine = true): Path2D {
  const p = new Path2D();
  roundRect(p as unknown as Ctx, x, y, w, h, r);
  ctx.lineJoin = 'round';
  ctx.lineWidth = ow * 2;
  ctx.strokeStyle = outline(col);
  ctx.stroke(p);
  ctx.fillStyle = vg(ctx, y, y + h, lighten(col, 0.2), darken(col, 0.18));
  ctx.fill(p);
  if (shine) rimLight(ctx, p, lighten(col, 0.8), darken(col, 0.5), 0.5, 0.22, 1);
  return p;
}

export function crate(ctx: Ctx, x: number, y: number, s: number, col = '#d8a25f'): void {
  const d = s * 0.28;
  const oc = outline(col);
  fillPoly(ctx, [{ x: x + s, y }, { x: x + s + d, y: y - d }, { x: x + s + d, y: y - s - d }, { x: x + s, y: y - s }], darken(col, 0.28), oc, 1.2);
  fillPoly(ctx, [{ x, y }, { x: x + s, y }, { x: x + s, y: y - s }, { x, y: y - s }], vg(ctx, y - s, y, lighten(col, 0.1), darken(col, 0.1)), oc, 1.2);
  fillPoly(ctx, [{ x, y: y - s }, { x: x + s, y: y - s }, { x: x + s + d, y: y - s - d }, { x: x + d, y: y - s - d }], lighten(col, 0.28), oc, 1.2);
  ctx.strokeStyle = rgba(darken(col, 0.5), 0.45);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y);
  ctx.lineTo(x + s * 0.5, y - s);
  ctx.moveTo(x + 1, y - s * 0.5);
  ctx.lineTo(x + s - 1, y - s * 0.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 1, y - s + 1, s * 0.4, 1.4);
}

function pawLogo(ctx: Ctx, x: number, y: number, s: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.3, s * 0.5, s * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [[-0.62, -0.2], [-0.22, -0.62], [0.22, -0.62], [0.62, -0.2]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, s * 0.2, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function cabWindow(ctx: Ctx, pts: Pt[]): void {
  fillPoly(ctx, pts, vg(ctx, pts[0].y, pts[pts.length - 1].y, '#d8f1ff', '#7fbbe8'), '#3e5f86', 1.1);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(pts[0].x + 1, pts[0].y + 1);
  ctx.lineTo(pts[0].x + 4.5, pts[0].y + 1);
  ctx.lineTo(pts[0].x + 1, pts[0].y + 6);
  ctx.fill();
}

function headlight(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#fff4b0';
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b08a2a';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

/** truck cab (facing right) whose rear edge sits at x0 */
function cab(ctx: Ctx, x0: number, w: number, h: number, col: string): void {
  const top = -h;
  const p: Pt[] = [
    { x: x0, y: -3 },
    { x: x0 + w, y: -3 },
    { x: x0 + w + 1, y: top + h * 0.55 },
    { x: x0 + w - 7, y: top },
    { x: x0 + 2, y: top },
    { x: x0, y: top + 2 },
  ];
  fillPoly(ctx, p, vg(ctx, top, -3, lighten(col, 0.22), darken(col, 0.16)), outline(col));
  rimLight(ctx, new Path2D(`M${p.map((q) => `${q.x} ${q.y}`).join('L')}Z`), lighten(col, 0.8), darken(col, 0.5), 0.5, 0.22, 1);
  cabWindow(ctx, [{ x: x0 + 5, y: top + 3 }, { x: x0 + w - 8, y: top + 3 }, { x: x0 + w - 2, y: top + h * 0.55 - 1 }, { x: x0 + 5, y: top + h * 0.55 - 1 }]);
  headlight(ctx, x0 + w - 1.5, -9);
  // bumper
  ctx.fillStyle = '#c3cad6';
  ctx.fillRect(x0 + w - 3, -6, 5, 3.4);
}

function chassis(ctx: Ctx, x0: number, x1: number): void {
  ctx.fillStyle = '#3a3f4b';
  roundRect(ctx, x0, -8, x1 - x0, 5, 1.5);
  ctx.fill();
}

function drawBike(ctx: Ctx): void {
  const red = '#ef5a47';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts: [number, number][], w: number, col: string): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  const frame: [number, number][][] = [
    [[-14, -8], [-4, -19], [10, -19]],
    [[-4, -19], [1, -8], [-14, -8]],
    [[10, -19], [14, -8]],
    [[1, -8], [10, -19]],
  ];
  for (const f of frame) line(f, 4.6, outline(red));
  for (const f of frame) line(f, 2.6, red);
  line([[10, -19], [9, -25], [13, -26]], 3.8, '#3a3f4b');
  line([[10, -19], [9, -25], [13, -26]], 2, '#6b7380');
  // seat
  rr(ctx, -9, -23, 9, 3.6, 1.6, '#3a3f4b', 1, false);
  // basket on the handlebar with a crate
  crate(ctx, 12, -24, 8, '#d8a25f');
  fillPoly(ctx, [{ x: 9, y: -22 }, { x: 24, y: -22 }, { x: 22, y: -14 }, { x: 11, y: -14 }], '#8a5a34', '#5a371c', 1.2);
  ctx.strokeStyle = 'rgba(40,20,5,0.4)';
  ctx.lineWidth = 0.7;
  for (let x = 13; x < 23; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x, -22);
    ctx.lineTo(x - 0.5, -14);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a8f99';
  ctx.beginPath();
  ctx.arc(1, -8, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawWagon(ctx: Ctx): void {
  const col = '#e0453a';
  const body = rr(ctx, -19, -19, 38, 11, 3, col);
  void body;
  ctx.fillStyle = '#fff4dc';
  ctx.fillRect(-19, -14.5, 38, 2.4);
  ctx.strokeStyle = outline(col);
  ctx.lineWidth = 1;
  ctx.strokeRect(-19, -14.5, 38, 2.4);
  // crates
  crate(ctx, -15, -19, 10, '#d8a25f');
  crate(ctx, -3, -19, 10, '#e0b36f');
  crate(ctx, -9, -29, 9, '#c98e52');
  // handle
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline('#3a3f4b');
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(19, -12);
  ctx.lineTo(30, -21);
  ctx.stroke();
  ctx.strokeStyle = '#6b7380';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = '#ef5a47';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(28.5, -20);
  ctx.lineTo(32, -23);
  ctx.stroke();
}

function drawScooter(ctx: Ctx): void {
  const col = '#4fd0bf';
  ctx.lineCap = 'round';
  // rear body
  const rear = new Path2D();
  rear.moveTo(-26, -8);
  rear.quadraticCurveTo(-27, -22, -14, -23);
  rear.lineTo(2, -21);
  rear.quadraticCurveTo(6, -14, 6, -8);
  rear.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline(col);
  ctx.stroke(rear);
  ctx.fillStyle = vg(ctx, -24, -8, lighten(col, 0.25), darken(col, 0.15));
  ctx.fill(rear);
  rimLight(ctx, rear, '#fff', darken(col, 0.5), 0.5, 0.22, 1);
  // floor + leg shield
  const sh = new Path2D();
  sh.moveTo(6, -8);
  sh.lineTo(12, -8);
  sh.quadraticCurveTo(14, -18, 12, -28);
  sh.lineTo(16, -29);
  sh.quadraticCurveTo(20, -18, 18, -8);
  sh.lineTo(24, -8);
  sh.lineTo(24, -4);
  sh.lineTo(6, -4);
  sh.closePath();
  ctx.lineWidth = 3;
  ctx.stroke(sh);
  ctx.fillStyle = vg(ctx, -28, -4, lighten(col, 0.2), darken(col, 0.18));
  ctx.fill(sh);
  // seat
  rr(ctx, -20, -29, 22, 6, 3, '#3a3f4b', 1, false);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-18, -28, 12, 1.4);
  // handlebar + headlight
  ctx.strokeStyle = '#3a3f4b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(14, -28);
  ctx.lineTo(14, -33);
  ctx.lineTo(19, -34);
  ctx.stroke();
  headlight(ctx, 19, -29);
  // rack + crate
  ctx.fillStyle = '#6b7380';
  ctx.fillRect(-30, -22, 10, 1.8);
  crate(ctx, -29, -22, 9, '#d8a25f');
}

function drawVan(ctx: Ctx): void {
  const box = rr(ctx, -36, -34, 46, 28, 4, '#f7f9fc');
  void box;
  ctx.fillStyle = '#4aa8ff';
  ctx.fillRect(-36, -14, 46, 4.4);
  pawLogo(ctx, -14, -24, 7, '#4aa8ff');
  cab(ctx, 8, 26, 25, '#4aa8ff');
  chassis(ctx, -34, 32);
  // roof rack with a crate
  crate(ctx, -26, -34, 9, '#d8a25f');
}

function drawPickup(ctx: Ctx): void {
  const col = '#47b267';
  // bed (open, back wall visible)
  fillPoly(ctx, [{ x: -38, y: -7 }, { x: 4, y: -7 }, { x: 4, y: -22 }, { x: -38, y: -22 }], vg(ctx, -22, -7, lighten(col, 0.1), darken(col, 0.25)), outline(col));
  crate(ctx, -34, -9, 12, '#d8a25f');
  crate(ctx, -21, -9, 12, '#e0b36f');
  crate(ctx, -28, -21, 11, '#c98e52');
  fillPoly(ctx, [{ x: -38, y: -7 }, { x: 4, y: -7 }, { x: 4, y: -16 }, { x: -38, y: -16 }], vg(ctx, -16, -7, lighten(col, 0.2), darken(col, 0.15)), outline(col));
  rimLight(ctx, new Path2D('M-38 -7L4 -7L4 -16L-38 -16Z'), lighten(col, 0.8), darken(col, 0.5), 0.5, 0.22, 1);
  cab(ctx, 2, 30, 26, col);
  chassis(ctx, -38, 31);
}

function drawBoxTruck(ctx: Ctx): void {
  rr(ctx, -42, -38, 56, 33, 4, '#ffcb3d');
  ctx.fillStyle = '#ef5a47';
  ctx.fillRect(-42, -12, 56, 4);
  pawLogo(ctx, -14, -25, 9, '#ef5a47');
  cab(ctx, 12, 26, 26, '#ef5a47');
  chassis(ctx, -40, 36);
}

function drawSemi(ctx: Ctx): void {
  rr(ctx, -52, -40, 76, 35, 3, '#4a8fe7');
  ctx.fillStyle = '#fff4dc';
  ctx.fillRect(-52, -16, 76, 3.4);
  pawLogo(ctx, -14, -28, 10, '#fff4dc');
  // trailer ribs
  ctx.strokeStyle = 'rgba(20,40,90,0.25)';
  ctx.lineWidth = 1;
  for (let x = -46; x < 22; x += 11) {
    ctx.beginPath();
    ctx.moveTo(x, -38);
    ctx.lineTo(x, -18);
    ctx.stroke();
  }
  cab(ctx, 22, 24, 30, '#ef5a47');
  // exhaust stack
  ctx.fillStyle = '#c3cad6';
  ctx.fillRect(25, -42, 3, 14);
  chassis(ctx, -50, 44);
}

function drawDouble(ctx: Ctx): void {
  rr(ctx, -70, -38, 52, 33, 3, '#47b267');
  rr(ctx, -14, -38, 52, 33, 3, '#4a8fe7');
  ctx.fillStyle = '#fff4dc';
  ctx.fillRect(-70, -15, 52, 3);
  ctx.fillRect(-14, -15, 52, 3);
  pawLogo(ctx, -44, -27, 9, '#fff4dc');
  pawLogo(ctx, 12, -27, 9, '#fff4dc');
  ctx.fillStyle = '#3a3f4b';
  ctx.fillRect(-19, -10, 6, 3);
  cab(ctx, 38, 24, 30, '#ef5a47');
  ctx.fillStyle = '#c3cad6';
  ctx.fillRect(41, -42, 3, 14);
  chassis(ctx, -68, 60);
}

function drawPlane(ctx: Ctx): void {
  const white = '#f4f7fc';
  // tail fin
  fillPoly(ctx, [{ x: -42, y: -22 }, { x: -48, y: -42 }, { x: -36, y: -40 }, { x: -28, y: -22 }], vg(ctx, -42, -22, lighten('#4a8fe7', 0.2), '#4a8fe7'), outline('#4a8fe7'));
  // far wing
  fillPoly(ctx, [{ x: -6, y: -26 }, { x: 8, y: -34 }, { x: 20, y: -34 }, { x: 8, y: -24 }], darken(white, 0.22), outline(white));
  // fuselage
  const fus = new Path2D();
  fus.moveTo(-46, -22);
  fus.quadraticCurveTo(-46, -34, -30, -35);
  fus.lineTo(22, -35);
  fus.quadraticCurveTo(46, -33, 46, -22);
  fus.quadraticCurveTo(44, -10, 22, -9);
  fus.lineTo(-30, -9);
  fus.quadraticCurveTo(-46, -10, -46, -22);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline(white);
  ctx.stroke(fus);
  ctx.fillStyle = vg(ctx, -36, -9, '#ffffff', darken(white, 0.2));
  ctx.fill(fus);
  ctx.save();
  ctx.clip(fus);
  ctx.fillStyle = '#4a8fe7';
  ctx.fillRect(-50, -19, 100, 4.4);
  ctx.restore();
  rimLight(ctx, fus, '#fff', darken(white, 0.5), 0.55, 0.22, 1.2);
  // cockpit + windows
  fillPoly(ctx, [{ x: 28, y: -31 }, { x: 40, y: -29 }, { x: 43, y: -23 }, { x: 28, y: -23 }], vg(ctx, -31, -23, '#d8f1ff', '#6fb2ea'), '#3e5f86', 1.1);
  for (let x = -26; x < 22; x += 8) {
    ctx.fillStyle = '#9fd0f5';
    ctx.beginPath();
    ctx.ellipse(x, -26, 2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // near wing + engine
  fillPoly(ctx, [{ x: -10, y: -20 }, { x: 14, y: -20 }, { x: 4, y: -4 }, { x: -22, y: -4 }], vg(ctx, -20, -4, lighten(white, 0.1), darken(white, 0.12)), outline(white));
  rr(ctx, -6, -9, 16, 7, 3, '#8e99b0');
  pawLogo(ctx, -32, -26, 6, '#ef5a47');
  // landing gear struts
  ctx.strokeStyle = '#3a3f4b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, -9);
  ctx.lineTo(-20, -4);
  ctx.moveTo(24, -9);
  ctx.lineTo(24, -4);
  ctx.stroke();
}

function drawShip(ctx: Ctx): void {
  const hull = '#c93f3a';
  // waves
  ctx.fillStyle = 'rgba(190,230,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(0, -2, 52, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // containers
  const cols = ['#ef5a47', '#4a8fe7', '#ffcb3d', '#47b267', '#8e6be8'];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 4; i++) {
      const x = -38 + i * 15 + (r ? 4 : 0);
      const y = -22 - r * 9;
      fillPoly(ctx, [{ x, y }, { x: x + 14, y }, { x: x + 14, y: y - 8 }, { x, y: y - 8 }], vg(ctx, y - 8, y, lighten(cols[(i + r * 2) % 5], 0.2), cols[(i + r * 2) % 5]), outline(cols[(i + r * 2) % 5]), 1.1);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 3; k < 14; k += 3) {
        ctx.moveTo(x + k, y - 1);
        ctx.lineTo(x + k, y - 7);
      }
      ctx.stroke();
    }
  }
  // hull
  const hp: Pt[] = [{ x: -50, y: -22 }, { x: 52, y: -22 }, { x: 44, y: -5 }, { x: -42, y: -5 }];
  fillPoly(ctx, hp, vg(ctx, -22, -5, lighten(hull, 0.2), darken(hull, 0.25)), outline(hull));
  rimLight(ctx, new Path2D('M-50 -22L52 -22L44 -5L-42 -5Z'), '#fff', darken(hull, 0.5), 0.5, 0.2, 1.1);
  ctx.fillStyle = '#fff4dc';
  ctx.fillRect(-47, -18, 97, 2.6);
  // bridge
  rr(ctx, 26, -44, 15, 22, 2.5, '#f4f7fc');
  ctx.fillStyle = '#6fb2ea';
  ctx.fillRect(28, -40, 11, 5);
  rr(ctx, 30, -53, 7, 9, 1.5, '#ef5a47');
  // bow flag
  ctx.fillStyle = '#ffcb3d';
  ctx.beginPath();
  ctx.moveTo(-44, -22);
  ctx.lineTo(-44, -34);
  ctx.lineTo(-37, -31);
  ctx.lineTo(-44, -28);
  ctx.fill();
}

function drawHover(ctx: Ctx): void {
  // beam
  const bg = ctx.createLinearGradient(0, -12, 0, 6);
  bg.addColorStop(0, 'rgba(160,255,220,0.5)');
  bg.addColorStop(1, 'rgba(160,255,220,0)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-14, -10);
  ctx.lineTo(14, -10);
  ctx.lineTo(24, 4);
  ctx.lineTo(-24, 4);
  ctx.fill();
  // crate on top
  crate(ctx, -7, -28, 14, '#d8a25f');
  // dome
  const dome = new Path2D();
  dome.ellipse(0, -17, 13, 11, 0, Math.PI, 0);
  ctx.fillStyle = 'rgba(190,255,235,0.65)';
  ctx.fill(dome);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#5bb89a';
  ctx.stroke(dome);
  // saucer
  const body = new Path2D();
  body.ellipse(0, -13, 30, 9, 0, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline('#9aa6bf');
  ctx.stroke(body);
  ctx.fillStyle = vg(ctx, -22, -4, '#e9eef8', '#7d89a5');
  ctx.fill(body);
  rimLight(ctx, body, '#fff', '#3a4260', 0.5, 0.25, 1.2);
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = i % 2 ? '#ffd24d' : '#ff6f91';
    ctx.beginPath();
    ctx.arc(i * 9, -11 + Math.abs(i) * 0.9, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRocket(ctx: Ctx): void {
  const white = '#f4f7fc';
  const body = new Path2D();
  body.moveTo(-34, -22);
  body.quadraticCurveTo(-34, -33, -22, -34);
  body.lineTo(14, -34);
  body.quadraticCurveTo(40, -30, 46, -21);
  body.quadraticCurveTo(40, -12, 14, -9);
  body.lineTo(-22, -9);
  body.quadraticCurveTo(-34, -10, -34, -22);
  // fins
  fillPoly(ctx, [{ x: -34, y: -30 }, { x: -46, y: -44 }, { x: -22, y: -32 }], '#ef5a47', outline('#ef5a47'));
  fillPoly(ctx, [{ x: -34, y: -14 }, { x: -46, y: -2 }, { x: -22, y: -12 }], darken('#ef5a47', 0.2), outline('#ef5a47'));
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline(white);
  ctx.stroke(body);
  ctx.fillStyle = vg(ctx, -34, -9, '#ffffff', darken(white, 0.2));
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = '#ef5a47';
  ctx.beginPath();
  ctx.moveTo(16, -40);
  ctx.quadraticCurveTo(26, -22, 14, -4);
  ctx.lineTo(60, -4);
  ctx.lineTo(60, -40);
  ctx.fill();
  ctx.fillStyle = '#4a8fe7';
  ctx.fillRect(-34, -23, 46, 3);
  ctx.restore();
  rimLight(ctx, body, '#fff', darken(white, 0.5), 0.55, 0.22, 1.2);
  // porthole
  ctx.fillStyle = '#9fd0f5';
  ctx.beginPath();
  ctx.arc(2, -23, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#8e99b0';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(0.5, -24.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // flame
  const fg = ctx.createLinearGradient(-36, 0, -62, 0);
  fg.addColorStop(0, '#fff3a0');
  fg.addColorStop(0.5, '#ffa63d');
  fg.addColorStop(1, 'rgba(255,90,40,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-34, -28);
  ctx.quadraticCurveTo(-52, -30, -64, -22);
  ctx.quadraticCurveTo(-52, -16, -34, -16);
  ctx.fill();
  // carrier cradle
  ctx.fillStyle = '#3a3f4b';
  roundRect(ctx, -26, -8, 56, 4, 1.5);
  ctx.fill();
}

function drawTeleporter(ctx: Ctx): void {
  // base pad
  const pad = new Path2D();
  pad.ellipse(0, -5, 22, 6, 0, 0, Math.PI * 2);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline('#8e6be8');
  ctx.stroke(pad);
  ctx.fillStyle = vg(ctx, -11, 1, '#c8b3ff', '#6e4fc4');
  ctx.fill(pad);
  // crate floating in front
  crate(ctx, -8, -17, 14, '#d8a25f');
  for (const [x, y, r] of [[-18, -22, 3], [20, -16, 2.2], [14, -38, 2.6]] as const) {
    ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    star4(ctx, x, y, r);
    ctx.fill();
  }
}

/** rotating swirl for the teleporter ring, 40 x 40 logical */
export function drawSwirl(ctx: Ctx): void {
  ctx.save();
  ctx.translate(20, 20);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(200,170,255,0.85)');
  g.addColorStop(1, 'rgba(120,80,230,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'round';
  for (let a = 0; a < 3; a++) {
    ctx.strokeStyle = a % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(150,110,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.05) {
      const ang = a * 2.094 + t * 4.2;
      const r = 3 + t * 15;
      ctx[t === 0 ? 'moveTo' : 'lineTo'](Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawVehicle(ctx: Ctx, tier: number): void {
  ctx.save();
  ctx.translate(VEH_AX, VEH_AY);
  switch (tier) {
    case 0: drawBike(ctx); break;
    case 1: drawWagon(ctx); break;
    case 2: drawScooter(ctx); break;
    case 3: drawVan(ctx); break;
    case 4: drawPickup(ctx); break;
    case 5: drawBoxTruck(ctx); break;
    case 6: drawSemi(ctx); break;
    case 7: drawDouble(ctx); break;
    case 8: drawPlane(ctx); break;
    case 9: drawShip(ctx); break;
    case 10: drawHover(ctx); break;
    case 11: drawRocket(ctx); break;
    default: drawTeleporter(ctx); break;
  }
  ctx.restore();
}

/** Wheel sprite (2r+4 square). Rotated live by ParkScene. */
export function drawWheel(ctx: Ctx, r: number, bike: boolean): void {
  const c = r + 2;
  ctx.save();
  ctx.translate(c, c);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = bike ? 'rgba(255,255,255,0.0)' : '#2f3340';
  ctx.fill();
  ctx.lineWidth = bike ? 2 : 1.4;
  ctx.strokeStyle = bike ? '#2f3340' : '#171a22';
  ctx.stroke();
  const rim = r * (bike ? 0.9 : 0.58);
  if (!bike) {
    ctx.beginPath();
    ctx.arc(0, 0, rim, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(-rim, -rim, rim, rim);
    g.addColorStop(0, '#f2f5fa');
    g.addColorStop(1, '#8e99b0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#5b6270';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.strokeStyle = bike ? 'rgba(90,96,110,0.9)' : '#7d89a5';
  ctx.lineWidth = bike ? 0.8 : 1.3;
  ctx.beginPath();
  const spokes = bike ? 8 : 5;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI;
    ctx.moveTo(Math.cos(a) * rim, Math.sin(a) * rim);
    ctx.lineTo(-Math.cos(a) * rim, -Math.sin(a) * rim);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.4, r * 0.18), 0, Math.PI * 2);
  ctx.fillStyle = bike ? '#8a8f99' : '#dfe5ef';
  ctx.fill();
  ctx.restore();
}
