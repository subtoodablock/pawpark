// TS mirror of the CSS design tokens in src/style.css (spec: docs/07-art-direction.md section 3 and 7).
// Canvas / JS code that cannot read CSS variables imports from here.

export const palette = {
  skyTop: '#7cc8ff',
  skyBottom: '#d4f0ff',
  cloud: '#ffffff',
  grass1: '#7fd35b',
  grass2: '#6cc44a',
  grassDark: '#4f9e36',
  dirt: '#e7c597',
  path: '#f1dcb5',
  wood: '#b8743d',
  woodDark: '#8a5428',
  roofRed: '#ef5a47',
  roofBlue: '#4a8fe7',
  roofGreen: '#47b267',
  roofPurple: '#8e6be8',
  road: '#5b6270',
  roadLine: '#fff1b8',
  uiBg: '#ffffff',
  uiBg2: '#f4f8f1',
  uiText: '#24342a',
  uiMuted: '#6b7d70',
  btnGreen: '#45c766',
  btnGreenEdge: '#2f9b4c',
  btnGold: '#ffcb3d',
  btnGoldEdge: '#e29a00',
  btnBlue: '#4aa8ff',
  btnBlueEdge: '#2a7fd1',
  btnDisabled: '#d5dcd6',
  btnDisabledEdge: '#b4bdb6',
  danger: '#ff6159',
  star: '#ffcf33',
  bone: '#fff4dc',
} as const;

export const motion = {
  durFast: 120,
  dur: 200,
  durSlow: 320,
  easeOut: 'cubic-bezier(.2,.8,.2,1)',
  easeSpring: 'cubic-bezier(.34,1.56,.64,1)',
} as const;

export const radius = { sm: 10, btn: 14, card: 18, sheet: 26 } as const;

/** Confetti colours: bright, toy-like, drawn from the palette. */
export const confettiColors: readonly string[] = [
  palette.btnGold,
  palette.btnGreen,
  palette.btnBlue,
  palette.danger,
  palette.roofPurple,
  palette.star,
  '#ffffff',
];

/** Read a live CSS variable (falls back when unavailable). */
export function cssVar(name: string, fallback = ''): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}
