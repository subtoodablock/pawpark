import { SUFFIXES } from '../core/format';

// Number suffixes are case-sensitive (q = quadrillion, Q = quintillion, o = octillion, d = decillion), but
// buttons and labels are drawn with `text-transform: uppercase`, which would turn "$561.51o" into "$561.510".
// This watches the game DOM and wraps such money amounts in <span class="nt"> (text-transform: none).

const LOWER = SUFFIXES.filter((x) => /[a-z]/.test(x)).sort((a, b) => b.length - a.length);
const MULTI = LOWER.filter((x) => x.length > 1);
// Money: any suffix containing a lowercase letter. Bare numbers: only q/o and the two-letter suffixes
// (a bare "5s"/"3d" is a duration, not a number).
const AMOUNT = new RegExp(
  `\\$\\d[\\d.,]*(?:${LOWER.join('|')})(?![A-Za-z])|\\b\\d[\\d.,]*(?:${[...MULTI, 'q', 'o'].join('|')})(?![A-Za-z])`,
  'g',
);
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SVG']);

function wrapNode(text: Text): void {
  const parent = text.parentElement;
  if (!parent || SKIP.has(parent.tagName) || parent.classList.contains('nt')) return;
  const s = text.data;
  AMOUNT.lastIndex = 0;
  if (!AMOUNT.test(s)) return;
  AMOUNT.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of s.matchAll(AMOUNT)) {
    if (m.index! > last) frag.append(s.slice(last, m.index));
    const span = document.createElement('span');
    span.className = 'nt';
    span.textContent = m[0];
    frag.append(span);
    last = m.index! + m[0].length;
  }
  if (last < s.length) frag.append(s.slice(last));
  text.replaceWith(frag);
}

function scan(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    wrapNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) found.push(n as Text);
  for (const t of found) wrapNode(t);
}

export function installCaseSafeAmounts(root: HTMLElement): void {
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') scan(m.target);
      else m.addedNodes.forEach((n) => scan(n));
    }
  });
  scan(root);
  obs.observe(root, { childList: true, subtree: true, characterData: true });
}
