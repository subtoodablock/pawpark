// Art-direction palette (docs/07-art-direction.md §3) as TS constants for the canvas scene.
export const P = {
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
  star: '#ffcf33',
  bone: '#fff4dc',
  danger: '#ff6159',
} as const;

/** Light comes from the top-left (spec §2). */
export const LIGHT_X = -0.6;
export const LIGHT_Y = -0.8;

export const FONT = "'Fredoka', ui-rounded, system-ui, sans-serif";
