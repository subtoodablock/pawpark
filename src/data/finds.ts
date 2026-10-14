import type { FindDef } from '../core/types';

/**
 * v4 era cost scale (docs/08 §3.2): costScale_k = (value_k / value_0) * HARDNESS^k, 3 significant
 * digits, HARDNESS = 1.6 (see HARDNESS in constants.ts). Stick = 1. Tuned by the balance pass.
 */
export const FINDS: FindDef[] = [
  { id: 'stick', name: 'Stick', icon: '🪵', flavor: 'A classic. Every dog thinks it is the best one ever.', value: 0.25, unlockParkValue: 0, unlockReward: 0, costScale: 1 },
  { id: 'tennis_ball', name: 'Tennis Ball', icon: '🎾', flavor: 'Slightly slobbery, extremely valuable.', value: 1.25, unlockParkValue: 1.25e4, unlockReward: 10, costScale: 5.25 },
  { id: 'squeaky_toy', name: 'Squeaky Toy', icon: '🧸', flavor: 'Squeak squeak squeak. Collectors love the sound.', value: 6.25, unlockParkValue: 1e6, unlockReward: 15, costScale: 27.6 },
  { id: 'rawhide', name: 'Rawhide Bone', icon: '🦴', flavor: 'Chewy, classic, and buried in six places.', value: 30, unlockParkValue: 8e7, unlockReward: 25, costScale: 139 },
  { id: 'lost_wallet', name: 'Lost Wallet', icon: '👛', flavor: 'Someone is having a very bad day. You are not.', value: 150, unlockParkValue: 6.14e9, unlockReward: 40, costScale: 729 },
  { id: 'pirate_coin', name: 'Pirate Coin', icon: '🪙', flavor: 'Arr! The pups found the treasure map in the mud.', value: 700, unlockParkValue: 4.92e11, unlockReward: 60, costScale: 3.57e3 },
  { id: 'dino_fossil', name: 'Dino Fossil', icon: '🦕', flavor: 'The ultimate bone. Sixty-five million years old.', value: 2750, unlockParkValue: 3.67e13, unlockReward: 80, costScale: 1.47e4 },
  { id: 'crystal_bone', name: 'Crystal Bone', icon: '💎', flavor: 'Sparkles in the sun. Cannot be chewed. Pups try anyway.', value: 1.1e4, unlockParkValue: 2.31e15, unlockReward: 130, costScale: 6.19e4 },
  { id: 'meteorite', name: 'Meteorite', icon: '☄️', flavor: 'Fell from the sky, landed in the sandbox.', value: 4.2e4, unlockParkValue: 1.48e17, unlockReward: 180, costScale: 2.48e5 },
  { id: 'ancient_relic', name: 'Ancient Relic', icon: '🏺', flavor: 'Museum curators keep calling. The pups keep ignoring them.', value: 1.65e5, unlockParkValue: 9.02e18, unlockReward: 250, costScale: 1.02e6 },
  { id: 'moon_rock', name: 'Moon Rock', icon: '🌑', flavor: 'Dug all the way through. Good boy.', value: 6.5e5, unlockParkValue: 5.67e20, unlockReward: 350, costScale: 4.24e6 },
  { id: 'time_bone', name: 'Time Bone', icon: '⏳', flavor: 'Was buried tomorrow. Dug up yesterday.', value: 2.5e6, unlockParkValue: 3.57e22, unlockReward: 450, costScale: 1.71e7 },
  { id: 'cosmic_bone', name: 'Cosmic Bone', icon: '🌌', flavor: 'The universe itself is a very good boy.', value: 1e7, unlockParkValue: 2.2e24, unlockReward: 600, costScale: 7.18e7 },
];
