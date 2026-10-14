// Debug "art sheet": every findArt / kennelArt / vehicleArt / trainingArt / treatArt image in a grid.
// Enable with  ?artsheet=1  (optional: &px=96 icon size, &bg=dark).
import { FINDS, KENNELS, TRAINING, TREATS, VEHICLES } from '../../core';
import { findArt, kennelArt, trainingArt, treatArt, vehicleArt } from './art';

export function artSheetRequested(search: string): boolean {
  try {
    return !!new URLSearchParams(search).get('artsheet');
  } catch {
    return false;
  }
}

export function mountArtSheet(search: string): void {
  const q = new URLSearchParams(search);
  const px = Number(q.get('px')) || 96;
  const dark = q.get('bg') === 'dark';
  const root = document.createElement('div');
  root.style.cssText = `position:fixed;inset:0;z-index:2147483000;overflow:auto;background:${dark ? '#20242e' : '#f3f5f9'};font:12px/1.2 sans-serif;color:${dark ? '#ddd' : '#333'};padding:10px`;
  const section = (title: string, items: { label: string; src: string }[], size = px): void => {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-weight:700;font-size:14px;margin:10px 0 6px';
    root.appendChild(h);
    const g = document.createElement('div');
    g.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    for (const it of items) {
      const c = document.createElement('div');
      c.style.cssText = `width:${size + 8}px;text-align:center;background:${dark ? '#2b303c' : '#fff'};border-radius:10px;padding:4px`;
      const im = document.createElement('img');
      im.src = it.src;
      im.width = size;
      im.height = size;
      im.style.display = 'block';
      im.style.margin = '0 auto';
      const l = document.createElement('div');
      l.textContent = it.label;
      l.style.cssText = 'font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      c.append(im, l);
      g.appendChild(c);
    }
    root.appendChild(g);
  };
  section('Finds', FINDS.map((f, i) => ({ label: `${i} ${f.name}`, src: findArt(i, px) })));
  section('Kennels', KENNELS.map((k, i) => ({ label: `${i} ${k.name}`, src: kennelArt(i, px) })));
  section('Vehicles', VEHICLES.map((v, i) => ({ label: `${i} ${v.name}`, src: vehicleArt(i, px) })));
  section('Treats', TREATS.map((t) => ({ label: t.name, src: treatArt(t.id, px) })));
  section('Training (small)', TRAINING.map((t) => ({ label: `${t.tier} ${t.id}`, src: trainingArt(t.id, 64) })), 64);
  section('Training (large, one per tier-1 family)', TRAINING.filter((t, i, a) => a.findIndex((u) => u.stat === t.stat) === i).map((t) => ({ label: `${t.stat}`, src: trainingArt(t.id, px) })));
  document.body.appendChild(root);
}
