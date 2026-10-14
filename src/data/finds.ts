import type { FindDef } from '../core/types';

export const FINDS: FindDef[] = [
  { id: 'stick', name: 'Stick', icon: '🪵', flavor: 'A classic. Every dog thinks it is the best one ever.', value: 0.25, unlockParkValue: 0, unlockReward: 0 },
  { id: 'tennis_ball', name: 'Tennis Ball', icon: '🎾', flavor: 'Slightly slobbery, extremely valuable.', value: 1.25, unlockParkValue: 5e4, unlockReward: 5 },
  { id: 'squeaky_toy', name: 'Squeaky Toy', icon: '🧸', flavor: 'Squeak squeak squeak. Collectors love the sound.', value: 6.25, unlockParkValue: 1e6, unlockReward: 10 },
  { id: 'rawhide', name: 'Rawhide Bone', icon: '🦴', flavor: 'Chewy, classic, and buried in six places.', value: 30, unlockParkValue: 3e7, unlockReward: 15 },
  { id: 'lost_wallet', name: 'Lost Wallet', icon: '👛', flavor: 'Someone is having a very bad day. You are not.', value: 150, unlockParkValue: 1e9, unlockReward: 20 },
  { id: 'pirate_coin', name: 'Pirate Coin', icon: '🪙', flavor: 'Arr! The pups found the treasure map in the mud.', value: 700, unlockParkValue: 5e10, unlockReward: 25 },
  { id: 'dino_fossil', name: 'Dino Fossil', icon: '🦕', flavor: 'The ultimate bone. Sixty-five million years old.', value: 3000, unlockParkValue: 2e12, unlockReward: 30 },
  { id: 'crystal_bone', name: 'Crystal Bone', icon: '💎', flavor: 'Sparkles in the sun. Cannot be chewed. Pups try anyway.', value: 12500, unlockParkValue: 1e14, unlockReward: 40 },
  { id: 'meteorite', name: 'Meteorite', icon: '☄️', flavor: 'Fell from the sky, landed in the sandbox.', value: 50000, unlockParkValue: 5e15, unlockReward: 50 },
  { id: 'ancient_relic', name: 'Ancient Relic', icon: '🏺', flavor: 'Museum curators keep calling. The pups keep ignoring them.', value: 175000, unlockParkValue: 2e17, unlockReward: 60 },
  { id: 'moon_rock', name: 'Moon Rock', icon: '🌑', flavor: 'Dug all the way through. Good boy.', value: 525000, unlockParkValue: 1e19, unlockReward: 75 },
  { id: 'time_bone', name: 'Time Bone', icon: '⏳', flavor: 'Was buried tomorrow. Dug up yesterday.', value: 1.5e6, unlockParkValue: 5e20, unlockReward: 100 },
  { id: 'cosmic_bone', name: 'Cosmic Bone', icon: '🌌', flavor: 'The universe itself is a very good boy.', value: 1e7, unlockParkValue: 3e22, unlockReward: 150 },
];
