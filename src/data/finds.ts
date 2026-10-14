import type { FindDef } from '../core/types';

/**
 * v5 (docs/10): prices are flat (costScale = 1 in every era); the wall is the Park Value gate.
 * The costScale field and engine support remain as an optional <= x1.5 tax.
 */
export const FINDS: FindDef[] = [
  { id: 'stick', name: 'Stick', icon: '🪵', flavor: 'A classic. Every dog thinks it is the best one ever.', value: 0.25, unlockParkValue: 0, unlockReward: 0, costScale: 1 },
  { id: 'tennis_ball', name: 'Tennis Ball', icon: '🎾', flavor: 'Slightly slobbery, extremely valuable.', value: 1.25, unlockParkValue: 1.42e4, unlockReward: 10, costScale: 1 },
  { id: 'squeaky_toy', name: 'Squeaky Toy', icon: '🧸', flavor: 'Squeak squeak squeak. Collectors love the sound.', value: 6.25, unlockParkValue: 6.10e5, unlockReward: 15, costScale: 1 },
  { id: 'rawhide', name: 'Rawhide Bone', icon: '🦴', flavor: 'Chewy, classic, and buried in six places.', value: 30, unlockParkValue: 1.19e8, unlockReward: 25, costScale: 1 },
  { id: 'lost_wallet', name: 'Lost Wallet', icon: '👛', flavor: 'Someone is having a very bad day. You are not.', value: 150, unlockParkValue: 9.80e10, unlockReward: 40, costScale: 1 },
  { id: 'pirate_coin', name: 'Pirate Coin', icon: '🪙', flavor: 'Arr! The pups found the treasure map in the mud.', value: 700, unlockParkValue: 4.22e13, unlockReward: 60, costScale: 1 },
  { id: 'dino_fossil', name: 'Dino Fossil', icon: '🦕', flavor: 'The ultimate bone. Sixty-five million years old.', value: 2750, unlockParkValue: 8.98e14, unlockReward: 80, costScale: 1 },
  { id: 'crystal_bone', name: 'Crystal Bone', icon: '💎', flavor: 'Sparkles in the sun. Cannot be chewed. Pups try anyway.', value: 1.1e4, unlockParkValue: 6.47e17, unlockReward: 130, costScale: 1 },
  { id: 'meteorite', name: 'Meteorite', icon: '☄️', flavor: 'Fell from the sky, landed in the sandbox.', value: 4.2e4, unlockParkValue: 1.33e20, unlockReward: 180, costScale: 1 },
  { id: 'ancient_relic', name: 'Ancient Relic', icon: '🏺', flavor: 'Museum curators keep calling. The pups keep ignoring them.', value: 1.65e5, unlockParkValue: 3.08e25, unlockReward: 250, costScale: 1 },
  { id: 'moon_rock', name: 'Moon Rock', icon: '🌑', flavor: 'Dug all the way through. Good boy.', value: 6.5e5, unlockParkValue: 1.70e29, unlockReward: 350, costScale: 1 },
  { id: 'time_bone', name: 'Time Bone', icon: '⏳', flavor: 'Was buried tomorrow. Dug up yesterday.', value: 2.5e6, unlockParkValue: 2.48e35, unlockReward: 450, costScale: 1 },
  { id: 'cosmic_bone', name: 'Cosmic Bone', icon: '🌌', flavor: 'The universe itself is a very good boy.', value: 1e7, unlockParkValue: 3.21e41, unlockReward: 600, costScale: 1 },
];
