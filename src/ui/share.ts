import { shareText } from '../core';
import type { GameController } from './GameController';
import { h, setText } from './dom';
import { rich } from './icons';
import { toast } from './Toasts';

export async function shareNow(c: GameController): Promise<void> {
  const text = shareText(c.home, c.today());
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ text });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    /* fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied! Paste it to your friends', 'good');
  } catch {
    toast('Could not share. Select the text and copy it manually.', 'warn');
  }
}

/** Share card: text preview + button. */
export function createShareCard(c: GameController): { el: HTMLElement; update(): void } {
  const pre = h('pre', { cls: 'share-preview' });
  const btn = h('button', { cls: 'btn primary', attrs: { type: 'button' }, on: { click: () => void shareNow(c) } }, ...rich('{share} Share', 18));
  const el = h('div', { cls: 'card' }, h('div', { cls: 'row-title', text: 'Brag to your friends' }), pre, btn);
  return { el, update: () => setText(pre, shareText(c.home, c.today())) };
}
