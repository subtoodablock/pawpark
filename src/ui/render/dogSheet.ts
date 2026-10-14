// Debug "breed sheet": every breed x pose drawn large on the park canvas.
// Enable with  ?dogsheet=1  (optional: &ss=3 scale, &b=0,3,5 breed filter, &cols=walk0,run1,... column filter).
import { BREEDS } from './breeds';
import { DOG_AX, DOG_AY, DOG_H, DOG_W, type Pose, TAIL_AX, TAIL_AY, TAIL_W, drawDogFrame, drawTail, tailAnchor } from './dogSprite';
import { SpriteCache } from './SpriteCache';

export interface SheetCfg {
  scale: number;
  breeds: number[];
  cols: [Pose, number, boolean][];
}

const ALL_COLS: [Pose, number, boolean][] = [
  ['walk', 0, false],
  ['walk', 2, false],
  ['walk', 4, false],
  ['walk', 6, false],
  ['run', 0, false],
  ['run', 2, false],
  ['sit', 0, false],
  ['dig', 0, false],
  ['sniff', 0, false],
  ['nap', 0, false],
  ['walk', 0, true],
  ['sit', 0, true],
  ['nap', 0, true],
];

export function parseSheet(search: string): SheetCfg | null {
  const q = new URLSearchParams(search);
  if (!q.get('dogsheet')) return null;
  const scale = Number(q.get('ss')) || 2;
  const bq = q.get('b');
  const breeds = bq ? bq.split(',').map(Number).filter((n) => n >= 0 && n < BREEDS.length) : BREEDS.map((_, i) => i);
  let cols = ALL_COLS;
  const cq = q.get('cols');
  if (cq) {
    cols = [];
    for (const tok of cq.split(',')) {
      const m = /^(walk|run|sit|dig|nap|sniff)(\d*)(p?)$/.exec(tok);
      if (m) cols.push([m[1] as Pose, Number(m[2] || 0), m[3] === 'p']);
    }
  }
  return { scale, breeds, cols };
}

export class DogSheet {
  private cache = new SpriteCache(4000);
  constructor(private cfg: SheetCfg) {}

  draw(ctx: CanvasRenderingContext2D, dpr: number, w: number, h: number): void {
    const { scale: s, breeds, cols } = this.cfg;
    const cache = this.cache;
    // full-window overlay so the sheet is not limited to the phone column
    const cv = ctx.canvas;
    if (cv.parentElement !== document.body) document.body.appendChild(cv);
    const ww = window.innerWidth;
    const hh = window.innerHeight;
    if (cv.style.position !== 'fixed' || cv.width !== Math.round(ww * dpr) || cv.height !== Math.round(hh * dpr)) {
      cv.style.cssText = `position:fixed;left:0;top:0;z-index:2147483000;width:${ww}px;height:${hh}px`;
      cv.width = Math.round(ww * dpr);
      cv.height = Math.round(hh * dpr);
    }
    w = ww;
    h = hh;
    cache.setDpr(dpr * s);
    cache.nextFrame();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#74c64f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < h; y += 80) ctx.fillRect(0, y, w, 40);
    const cw = DOG_W * s * 0.86;
    const ch = DOG_H * s * 0.92;
    for (let bi = 0; bi < breeds.length; bi++) {
      const b = breeds[bi];
      for (let ci = 0; ci < cols.length; ci++) {
        const [pose, f, pup] = cols[ci];
        const key = `${b}:${pose}:${f}:${pup}`;
        const sp = cache.get(key, DOG_W, DOG_H, (c) => drawDogFrame(c, BREEDS[b], pose, f, pup));
        const tk = `t${b}:${pup}`;
        const tl = cache.get(tk, TAIL_W, TAIL_W, (c) => drawTail(c, BREEDS[b], pup));
        const x0 = 6 + ci * cw;
        const y0 = 6 + bi * ch;
        // ground shadow
        ctx.fillStyle = 'rgba(30,18,50,0.22)';
        ctx.beginPath();
        ctx.ellipse(x0 + DOG_AX * s * 0.86, y0 + DOG_AY * s * 0.92 + 1 * s, 11 * s, 3.2 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        // tail (rest angle)
        const ta = tailAnchor(BREEDS[b], pose, f, pup);
        if (!ta.hide) {
          ctx.save();
          ctx.translate(x0 + ta.x * s * 0.86, y0 + ta.y * s * 0.92);
          ctx.rotate(ta.rest);
          ctx.drawImage(tl.c as CanvasImageSource, -TAIL_AX * s * 0.86, -TAIL_AY * s * 0.92, TAIL_W * s * 0.86, TAIL_W * s * 0.92);
          ctx.restore();
        }
        ctx.drawImage(sp.c as CanvasImageSource, x0, y0, DOG_W * s * 0.86, DOG_H * s * 0.92);
      }
      ctx.fillStyle = 'rgba(20,40,10,0.7)';
      ctx.font = '10px sans-serif';
      ctx.fillText(BREEDS[b].name, 8, 6 + bi * ch + 10);
    }
  }
}
