// Rendered game-object images for the DOM UI (Finds, kennels, vehicles, training, treats).
// The procedural renderers live in render/art.ts and cache their PNG data URLs.
import { findArt, kennelArt, relicArt, stoneArt, trainingArt, treatArt, vehicleArt } from './render/art';

export type ArtKind = 'find' | 'kennel' | 'vehicle' | 'training' | 'treat' | 'relic' | 'stone';

function dpr(): number {
  try {
    return Math.min(2, window.devicePixelRatio || 1);
  } catch {
    return 1;
  }
}

function srcFor(kind: ArtKind, key: string | number, px: number): string {
  const p = Math.round(px * dpr());
  switch (kind) {
    case 'find':
      return findArt(Number(key), p);
    case 'kennel':
      return kennelArt(Number(key), p);
    case 'vehicle':
      return vehicleArt(Number(key), p);
    case 'training':
      return trainingArt(String(key), p);
    case 'treat':
      return treatArt(String(key), p);
    case 'relic': {
      // key: `${family}:${tier}:${rarity}`
      const [f, t, r] = String(key).split(':');
      return relicArt(f, Number(t), Number(r), p);
    }
    case 'stone': {
      // key: `${stoneId}:${tier}`
      const [id, t] = String(key).split(':');
      return stoneArt(id, Number(t), p);
    }
  }
}

/** Create an `<img>` for a game object, sized in CSS px. */
export function artImg(kind: ArtKind, key: string | number, px: number, cls = ''): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'art' + (cls ? ' ' + cls : '');
  img.width = px;
  img.height = px;
  img.alt = '';
  img.draggable = false;
  setArt(img, kind, key, px);
  return img;
}

/** Point an existing `<img>` at another object; no-op when it already shows it (safe every frame). */
export function setArt(img: HTMLImageElement, kind: ArtKind, key: string | number, px: number): void {
  const k = `${kind}:${key}:${px}`;
  if (img.dataset.art === k) return;
  img.dataset.art = k;
  img.src = srcFor(kind, key, px);
}
