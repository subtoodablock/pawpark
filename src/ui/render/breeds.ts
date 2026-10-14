// Breed data (docs/12-art-direction-v2.md §6). Pure data; dogSprite.ts turns it into pixels.
// Natural proportions: the skull is ~30-35% of standing height, real snout, legs in breed proportion.
// Units are "dog units" (about 1 css px each at size 1). A golden is ~19 units to the withers, ~34 long.
export type EarKind = 'floppy' | 'long' | 'pointy' | 'big' | 'small' | 'rose' | 'puff';
export type TailKind = 'plume' | 'curl' | 'whip' | 'stub' | 'pom' | 'otter' | 'pug' | 'fluffcurl';
export type FurKind = 'smooth' | 'fluffy' | 'curly' | 'glossy';

/** Flat marks (opaque hex colours only). Each mark is re-shaded with its own tones so shading stays consistent. */
export type Mark =
  | { k: 'e'; x: number; y: number; rx: number; ry: number; rot?: number; col: string }
  | { k: 'spots'; n: number; rMin: number; rMax: number; col: string; seed: number; rx: number; ry: number; ox?: number; oy?: number };

export interface Breed {
  id: string;
  name: string;
  seed: number;
  base: string;
  earCol: string;
  tailCol: string;
  /** muzzle colour (same as base when there is no distinct muzzle) */
  snoutCol: string;
  /** paw colour (null: same as the leg) */
  sockCol: string | null;
  nose: string;
  ear: EarKind;
  tail: TailKind;
  fur: FurKind;
  /** soft chest / rear ruff on the silhouette */
  fluff: 'none' | 'rear' | 'all' | 'chest';
  /** distance between hip and shoulder centres */
  bodyL: number;
  /** torso depth */
  bodyH: number;
  /** belly-to-ground leg length */
  legH: number;
  legW: number;
  /** skull radius */
  headR: number;
  /** snout length beyond the skull */
  snoutL: number;
  size: number;
  /** body-local marks (origin = torso middle, x along the spine toward the chest, y down) */
  body: Mark[];
  /** head-local marks (origin = skull centre, +x toward the nose, y down) */
  head: Mark[];
}

export const BREEDS: Breed[] = [
  {
    id: 'golden',
    name: 'Golden Retriever',
    seed: 11,
    base: '#dc9d3a',
    earCol: '#b97a24',
    tailCol: '#e2a643',
    snoutCol: '#dc9d3a',
    sockCol: null,
    nose: '#26201f',
    ear: 'floppy',
    tail: 'plume',
    fur: 'fluffy',
    fluff: 'chest',
    bodyL: 11.5,
    bodyH: 11.8,
    legH: 7.2,
    legW: 1.1,
    headR: 5.3,
    snoutL: 4.4,
    size: 1.04,
    body: [{ k: 'e', x: 0, y: 6.2, rx: 14, ry: 2.4, col: '#e9b862' }],
    head: [],
  },
  {
    id: 'dalmatian',
    name: 'Dalmatian',
    seed: 23,
    base: '#f3f0e9',
    earCol: '#2e2b33',
    tailCol: '#f3f0e9',
    snoutCol: '#f3f0e9',
    sockCol: null,
    nose: '#222027',
    ear: 'floppy',
    tail: 'whip',
    fur: 'smooth',
    fluff: 'none',
    bodyL: 12.5,
    bodyH: 10.6,
    legH: 9,
    legW: 1.0,
    headR: 4.9,
    snoutL: 4.8,
    size: 1.04,
    body: [{ k: 'spots', n: 14, rMin: 0.9, rMax: 1.6, col: '#2e2b33', seed: 5, rx: 11.5, ry: 4.3 }],
    head: [{ k: 'spots', n: 2, rMin: 0.8, rMax: 1.1, col: '#2e2b33', seed: 9, rx: 2.2, ry: 1.6, ox: -1.2, oy: -2.6 }],
  },
  {
    id: 'corgi',
    name: 'Corgi',
    seed: 37,
    base: '#e8913d',
    earCol: '#e8913d',
    tailCol: '#ee9b46',
    snoutCol: '#fbf0de',
    sockCol: '#fbf0de',
    nose: '#26201f',
    ear: 'big',
    tail: 'stub',
    fur: 'fluffy',
    fluff: 'rear',
    bodyL: 13.5,
    bodyH: 11,
    legH: 3.4,
    legW: 1.2,
    headR: 5.2,
    snoutL: 3.9,
    size: 1.0,
    body: [
      { k: 'e', x: 0, y: 6.2, rx: 15, ry: 2.6, col: '#fbf0de' },
      { k: 'e', x: 8.8, y: 2, rx: 3.6, ry: 4.8, col: '#fbf0de' },
    ],
    head: [
      { k: 'e', x: 3.2, y: 3.6, rx: 7.2, ry: 3.4, col: '#fbf0de' },
      { k: 'e', x: 5.0, y: -1.6, rx: 1.0, ry: 4.0, rot: 0.2, col: '#fbf0de' },
    ],
  },
  {
    id: 'husky',
    name: 'Husky',
    seed: 41,
    base: '#8b96a6',
    earCol: '#6c7787',
    tailCol: '#8b96a6',
    snoutCol: '#f1f3f7',
    sockCol: '#f1f3f7',
    nose: '#22242a',
    ear: 'pointy',
    tail: 'fluffcurl',
    fur: 'fluffy',
    fluff: 'all',
    bodyL: 11.5,
    bodyH: 11.4,
    legH: 6.8,
    legW: 1.08,
    headR: 5.3,
    snoutL: 3.9,
    size: 1.04,
    body: [
      { k: 'e', x: 0.5, y: 6.6, rx: 14, ry: 3.0, col: '#f1f3f7' },
      { k: 'e', x: 9, y: 3.4, rx: 3.2, ry: 4.4, col: '#f1f3f7' },
    ],
    head: [
      { k: 'e', x: -1.2, y: -2.6, rx: 5.4, ry: 3.2, col: '#6c7787' },
      { k: 'e', x: 3.6, y: 3.4, rx: 7.6, ry: 3.4, col: '#f1f3f7' },
      { k: 'e', x: 4.2, y: -2.6, rx: 0.9, ry: 2.6, rot: 0.15, col: '#f1f3f7' },
    ],
  },
  {
    id: 'beagle',
    name: 'Beagle',
    seed: 53,
    base: '#f3ebdc',
    earCol: '#8a4a1e',
    tailCol: '#a6622c',
    snoutCol: '#f3ebdc',
    sockCol: '#f3ebdc',
    nose: '#26201f',
    ear: 'long',
    tail: 'whip',
    fur: 'smooth',
    fluff: 'none',
    bodyL: 11,
    bodyH: 10.6,
    legH: 6,
    legW: 1.05,
    headR: 5.1,
    snoutL: 4.1,
    size: 1.0,
    body: [{ k: 'e', x: -0.5, y: -2.8, rx: 9.6, ry: 4.4, col: '#b56e34' }],
    head: [
      { k: 'e', x: -2.2, y: -1.6, rx: 4.2, ry: 4.4, col: '#b56e34' },
      { k: 'e', x: 3.6, y: -1.2, rx: 1.0, ry: 4.0, rot: 0.2, col: '#f3ebdc' },
    ],
  },
  {
    id: 'poodle',
    name: 'Poodle',
    seed: 67,
    base: '#f1deba',
    earCol: '#ecd5ac',
    tailCol: '#f1deba',
    snoutCol: '#f1deba',
    sockCol: null,
    nose: '#26201f',
    ear: 'puff',
    tail: 'pom',
    fur: 'curly',
    fluff: 'none',
    bodyL: 7.5,
    bodyH: 10,
    legH: 9.4,
    legW: 0.8,
    headR: 4.6,
    snoutL: 4.6,
    size: 1.02,
    body: [],
    head: [],
  },
  {
    id: 'shiba',
    name: 'Shiba',
    seed: 79,
    base: '#e2843a',
    earCol: '#d8782f',
    tailCol: '#e68c42',
    snoutCol: '#fbeed6',
    sockCol: '#fbeed6',
    nose: '#26201f',
    ear: 'small',
    tail: 'curl',
    fur: 'fluffy',
    fluff: 'chest',
    bodyL: 10,
    bodyH: 11,
    legH: 6,
    legW: 1.08,
    headR: 5.1,
    snoutL: 3.3,
    size: 1.0,
    body: [
      { k: 'e', x: 0, y: 6.4, rx: 12, ry: 2.8, col: '#fbeed6' },
      { k: 'e', x: 7.8, y: 3.2, rx: 3.2, ry: 4.0, col: '#fbeed6' },
    ],
    head: [
      { k: 'e', x: 3.0, y: 3.6, rx: 7.2, ry: 3.4, col: '#fbeed6' },
      { k: 'e', x: 1.2, y: -3.4, rx: 1.0, ry: 0.7, col: '#fbeed6' },
    ],
  },
  {
    id: 'lab',
    name: 'Black Lab',
    seed: 83,
    base: '#3f4352',
    earCol: '#33362f',
    tailCol: '#3a3e4c',
    snoutCol: '#3f4352',
    sockCol: null,
    nose: '#14141a',
    ear: 'floppy',
    tail: 'otter',
    fur: 'glossy',
    fluff: 'none',
    bodyL: 12.5,
    bodyH: 11.8,
    legH: 7.2,
    legW: 1.15,
    headR: 5.2,
    snoutL: 4.3,
    size: 1.06,
    body: [],
    head: [],
  },
  {
    id: 'dachshund',
    name: 'Dachshund',
    seed: 97,
    base: '#9f5c33',
    earCol: '#74401e',
    tailCol: '#8a5026',
    snoutCol: '#b8774a',
    sockCol: '#7e4624',
    nose: '#1e1512',
    ear: 'long',
    tail: 'whip',
    fur: 'smooth',
    fluff: 'none',
    bodyL: 19,
    bodyH: 8.8,
    legH: 3.2,
    legW: 1.05,
    headR: 4.5,
    snoutL: 4.7,
    size: 1.0,
    body: [{ k: 'e', x: 0, y: 4.6, rx: 22, ry: 1.9, col: '#b8774a' }],
    head: [{ k: 'e', x: 3.4, y: 2.8, rx: 7, ry: 2.6, col: '#b8774a' }],
  },
  {
    id: 'pug',
    name: 'Pug',
    seed: 101,
    base: '#e9c78f',
    earCol: '#4b3b35',
    tailCol: '#e9c78f',
    snoutCol: '#4b3b35',
    sockCol: null,
    nose: '#1c1614',
    ear: 'rose',
    tail: 'pug',
    fur: 'smooth',
    fluff: 'none',
    bodyL: 8,
    bodyH: 11,
    legH: 4.6,
    legW: 1.2,
    headR: 5.6,
    snoutL: 1.2,
    size: 0.98,
    body: [{ k: 'e', x: 0, y: 6.2, rx: 11, ry: 2.2, col: '#f1d6a8' }],
    head: [],
  },
];
