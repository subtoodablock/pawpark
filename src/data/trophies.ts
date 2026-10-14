import type { TrophyDef } from '../core/types';

export const TROPHIES: TrophyDef[] = [
  { id: 'pack_10k', name: 'Pack Leader', icon: '🥉', pupsRequired: 1e4, collars: 1 },
  { id: 'pack_100k', name: 'Top Dog', icon: '🥈', pupsRequired: 1e5, collars: 1 },
  { id: 'pack_1m', name: 'Big Kahuna', icon: '🥇', pupsRequired: 1e6, collars: 1 },
  { id: 'pack_10m', name: 'Dog Mayor', icon: '🏅', pupsRequired: 1e7, collars: 2 },
  { id: 'pack_100m', name: 'Canine Emperor', icon: '👑', pupsRequired: 1e8, collars: 2 },
  { id: 'pack_1b', name: 'Galactic Alpha', icon: '🏆', pupsRequired: 1e9, collars: 3 },
];
