import type { FindDef } from '../core/types';

/**
 * v4 era cost scale (docs/08 §3.2): costScale_k = (value_k / value_0) * HARDNESS^k, 3 significant
 * digits, HARDNESS = 1.6 (see HARDNESS in constants.ts). Stick = 1. Tuned by the balance pass.
 */
export const FINDS: FindDef[] = [
  { id: 'stick', name: 'Stick', icon: '🪵', flavor: 'A classic. Every dog thinks it is the best one ever.', value: 0.25, unlockParkValue: 0, unlockReward: 0, costScale: 1 },
  { id: 'tennis_ball', name: 'Tennis Ball', icon: '🎾', flavor: 'Slightly slobbery, extremely valuable.', value: 1.25, unlockParkValue: 1.17e4, unlockReward: 10, costScale: 6.25 },
  { id: 'squeaky_toy', name: 'Squeaky Toy', icon: '🧸', flavor: 'Squeak squeak squeak. Collectors love the sound.', value: 6.25, unlockParkValue: 1.35e5, unlockReward: 15, costScale: 39.1 },
  { id: 'rawhide', name: 'Rawhide Bone', icon: '🦴', flavor: 'Chewy, classic, and buried in six places.', value: 30, unlockParkValue: 7.36e7, unlockReward: 25, costScale: 234 },
  { id: 'lost_wallet', name: 'Lost Wallet', icon: '👛', flavor: 'Someone is having a very bad day. You are not.', value: 150, unlockParkValue: 6.52e8, unlockReward: 40, costScale: 1.46e3 },
  { id: 'pirate_coin', name: 'Pirate Coin', icon: '🪙', flavor: 'Arr! The pups found the treasure map in the mud.', value: 700, unlockParkValue: 2.19e11, unlockReward: 60, costScale: 8.54e3 },
  { id: 'dino_fossil', name: 'Dino Fossil', icon: '🦕', flavor: 'The ultimate bone. Sixty-five million years old.', value: 2750, unlockParkValue: 1.17e13, unlockReward: 80, costScale: 4.2e4 },
  { id: 'crystal_bone', name: 'Crystal Bone', icon: '💎', flavor: 'Sparkles in the sun. Cannot be chewed. Pups try anyway.', value: 1.1e4, unlockParkValue: 7.53e15, unlockReward: 130, costScale: 2.1e5 },
  { id: 'meteorite', name: 'Meteorite', icon: '☄️', flavor: 'Fell from the sky, landed in the sandbox.', value: 4.2e4, unlockParkValue: 1.32e19, unlockReward: 180, costScale: 1e6 },
  { id: 'ancient_relic', name: 'Ancient Relic', icon: '🏺', flavor: 'Museum curators keep calling. The pups keep ignoring them.', value: 1.65e5, unlockParkValue: 4.94e21, unlockReward: 250, costScale: 4.92e6 },
  { id: 'moon_rock', name: 'Moon Rock', icon: '🌑', flavor: 'Dug all the way through. Good boy.', value: 6.5e5, unlockParkValue: 1.85e24, unlockReward: 350, costScale: 2.42e7 },
  { id: 'time_bone', name: 'Time Bone', icon: '⏳', flavor: 'Was buried tomorrow. Dug up yesterday.', value: 2.5e6, unlockParkValue: 6.5e20, unlockReward: 450, costScale: 1.16e8 },
  { id: 'cosmic_bone', name: 'Cosmic Bone', icon: '🌌', flavor: 'The universe itself is a very good boy.', value: 1e7, unlockParkValue: 5e22, unlockReward: 600, costScale: 5.82e8 },
];
