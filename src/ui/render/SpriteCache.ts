// LRU cache of pre-rendered sprites (offscreen canvases at the current DPR).
export type SpriteCanvas = HTMLCanvasElement | OffscreenCanvas;
export type SCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Sprite {
  c: SpriteCanvas;
  /** logical (css px) size */
  w: number;
  h: number;
  used: number;
}

export function makeCanvas(pw: number, ph: number): SpriteCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(pw, ph);
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  return c;
}

export class SpriteCache {
  dpr = 1;
  private map = new Map<string, Sprite>();
  private tick = 0;
  /** sprites baked since the last call to `resetBudget` */
  baked = 0;
  /** ms spent baking since the last `nextFrame` */
  bakeMs = 0;
  constructor(private max = 900) {}

  get size(): number {
    return this.map.size;
  }

  setDpr(d: number): void {
    if (d !== this.dpr) {
      this.dpr = d;
      this.map.clear();
    }
  }

  clear(): void {
    this.map.clear();
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  peek(key: string): Sprite | undefined {
    return this.map.get(key);
  }

  touch(s: Sprite): void {
    s.used = this.tick;
  }

  nextFrame(): void {
    this.tick++;
    this.baked = 0;
    this.bakeMs = 0;
  }

  /** Like `get`, but returns null (and bakes nothing) once this frame's bake budget (ms) is spent. */
  getOrNull(key: string, w: number, h: number, drawFn: (ctx: SCtx, w: number, h: number, dpr: number) => void, budget = 2.5): Sprite | null {
    const s = this.map.get(key);
    if (s) {
      s.used = this.tick;
      return s;
    }
    if (this.bakeMs >= budget) return null;
    const t0 = performance.now();
    const r = this.get(key, w, h, drawFn);
    this.bakeMs += performance.now() - t0;
    return r;
  }

  /** Get (or bake) a sprite of logical size w x h. drawFn draws in logical px (already scaled by dpr). */
  get(key: string, w: number, h: number, drawFn: (ctx: SCtx, w: number, h: number, dpr: number) => void): Sprite {
    let s = this.map.get(key);
    if (s) {
      s.used = this.tick;
      return s;
    }
    const d = this.dpr;
    const c = makeCanvas(Math.max(1, Math.ceil(w * d)), Math.max(1, Math.ceil(h * d)));
    const ctx = c.getContext('2d') as SCtx;
    ctx.scale(d, d);
    drawFn(ctx, w, h, d);
    s = { c, w, h, used: this.tick };
    this.map.set(key, s);
    this.baked++;
    if (this.map.size > this.max) this.evict();
    return s;
  }

  private evict(): void {
    // drop the least recently used quarter
    const arr = [...this.map.entries()].sort((a, b) => a[1].used - b[1].used);
    const drop = Math.floor(arr.length / 4);
    for (let i = 0; i < drop; i++) this.map.delete(arr[i][0]);
  }
}

/** Draw a sprite so that its logical anchor (ax, ay) lands on (x, y). No per-call save/restore. */
export function blit(ctx: CanvasRenderingContext2D, dpr: number, s: Sprite, x: number, y: number, ax: number, ay: number, sx = 1, sy = sx, flip = 1): void {
  ctx.setTransform(dpr * sx * flip, 0, 0, dpr * sy, dpr * x, dpr * y);
  ctx.drawImage(s.c, -ax, -ay, s.w, s.h);
}
