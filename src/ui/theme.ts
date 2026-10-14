// TS mirror of the CSS design tokens in src/style.css (spec: docs/12-art-direction-v2.md section 2).
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
  uiText: '#111111',
  uiMuted: '#6b6b6b',
  blue: '#2f6fdc',
  blueDeep: '#1f57b8',
  purple: '#7a1fd1',
  purpleDeep: '#5e12a8',
  green: '#20a63a',
  greenDeep: '#178a2e',
  red: '#e8241c',
  gold: '#f2b417',
  disabled: '#cfd3d8',
} as const;

export const motion = {
  durFast: 120,
  dur: 200,
  durSlow: 320,
  easeOut: 'cubic-bezier(.2,.8,.2,1)',
} as const;

export const radius = { sm: 10, btn: 18, card: 20, sheet: 28 } as const;

/** Confetti colours: flat UI chrome colours. */
export const confettiColors: readonly string[] = [
  palette.gold,
  palette.green,
  palette.blue,
  palette.red,
  palette.purple,
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
