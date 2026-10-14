import type { TrophyDef } from '../core/types';

export const TROPHIES: TrophyDef[] = [
  // pack size
  { id: 'pack_1k', name: 'Litter Leader', icon: '🐾', kind: 'pups', threshold: 1e3, collars: 0, goldenBones: 5 },
  { id: 'pack_10k', name: 'Pack Leader', icon: '🥉', kind: 'pups', threshold: 1e4, collars: 1, goldenBones: 0 },
  { id: 'pack_100k', name: 'Top Dog', icon: '🥈', kind: 'pups', threshold: 1e5, collars: 1, goldenBones: 0 },
  { id: 'pack_1m', name: 'Big Kahuna', icon: '🥇', kind: 'pups', threshold: 1e6, collars: 1, goldenBones: 0 },
  { id: 'pack_10m', name: 'Dog Mayor', icon: '🏅', kind: 'pups', threshold: 1e7, collars: 2, goldenBones: 0 },
  { id: 'pack_100m', name: 'Canine Emperor', icon: '👑', kind: 'pups', threshold: 1e8, collars: 2, goldenBones: 0 },
  { id: 'pack_1b', name: 'Galactic Alpha', icon: '🏆', kind: 'pups', threshold: 1e9, collars: 3, goldenBones: 0 },
  // lifetime earnings
  { id: 'cash_1m', name: 'First Million', icon: '💵', kind: 'lifetimeEarnings', threshold: 1e6, collars: 0, goldenBones: 10 },
  { id: 'cash_1b', name: 'Bone Baron', icon: '💰', kind: 'lifetimeEarnings', threshold: 1e9, collars: 1, goldenBones: 0 },
  { id: 'cash_1t', name: 'Treat Tycoon', icon: '🏦', kind: 'lifetimeEarnings', threshold: 1e12, collars: 1, goldenBones: 0 },
  { id: 'cash_1q', name: 'Kibble Mogul', icon: '💸', kind: 'lifetimeEarnings', threshold: 1e15, collars: 1, goldenBones: 0 },
  { id: 'cash_1Q', name: 'Fetch Financier', icon: '🪙', kind: 'lifetimeEarnings', threshold: 1e18, collars: 2, goldenBones: 0 },
  { id: 'cash_1s', name: 'Squeaky Rich', icon: '🤑', kind: 'lifetimeEarnings', threshold: 1e21, collars: 2, goldenBones: 0 },
  { id: 'cash_1S', name: 'Doggone Wealthy', icon: '💎', kind: 'lifetimeEarnings', threshold: 1e24, collars: 3, goldenBones: 0 },
  { id: 'cash_1o', name: 'Richest Good Boy', icon: '🌟', kind: 'lifetimeEarnings', threshold: 1e27, collars: 3, goldenBones: 0 },
  // prestiges
  { id: 'park_1', name: 'New Leash on Life', icon: '🔑', kind: 'prestiges', threshold: 1, collars: 0, goldenBones: 20 },
  { id: 'park_5', name: 'Serial Park Opener', icon: '🎪', kind: 'prestiges', threshold: 5, collars: 1, goldenBones: 0 },
  { id: 'park_25', name: 'Park Pioneer', icon: '🏞️', kind: 'prestiges', threshold: 25, collars: 1, goldenBones: 0 },
  { id: 'park_100', name: 'Park Magnate', icon: '🗺️', kind: 'prestiges', threshold: 100, collars: 2, goldenBones: 0 },
  { id: 'park_500', name: 'Eternal Groundskeeper', icon: '♾️', kind: 'prestiges', threshold: 500, collars: 3, goldenBones: 0 },
  // finds
  { id: 'find_fossil', name: 'Bone Historian', icon: '🦕', kind: 'find', threshold: 6, collars: 1, goldenBones: 50 },
  { id: 'find_relic', name: 'Relic Hunter', icon: '🏺', kind: 'find', threshold: 9, collars: 2, goldenBones: 100 },
  { id: 'find_legend', name: 'Paw Park Legend', icon: '🌌', kind: 'find', threshold: 12, collars: 5, goldenBones: 500 },
];
