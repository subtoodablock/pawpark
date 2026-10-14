import type { TrainingDef, TrainingTierDef } from '../core/types';

export const TRAINING_TIERS: TrainingTierDef[] = [
  { tier: 1, name: 'Puppy School', unlockAt: 0 },
  { tier: 2, name: 'Obedience Class', unlockAt: 12 },
  { tier: 3, name: 'Agility Course', unlockAt: 40 },
  { tier: 4, name: 'Search & Rescue', unlockAt: 85 },
  { tier: 5, name: 'Space Academy', unlockAt: 130 },
];

export const TRAINING: TrainingDef[] = [
  { tier: 1, id: 'comfy_beds', name: 'Comfy Beds', icon: '🛏️', description: 'Well-rested pups dig faster.', stat: 'layRate', perLevel: 0.1, maxLevel: 15, baseCost: 25, costGrowth: 1.5 },
  { tier: 1, id: 'premium_kibble', name: 'Premium Kibble', icon: '🥣', description: 'Fancy food, fancier finds.', stat: 'findValue', perLevel: 0.1, maxLevel: 15, baseCost: 40, costGrowth: 1.5 },
  { tier: 1, id: 'louder_whistle', name: 'Louder Whistle', icon: '📯', description: 'Bigger adoption center stock.', stat: 'adoptionCap', perLevel: 20, maxLevel: 10, baseCost: 60, costGrowth: 1.6 },
  { tier: 1, id: 'rescue_program', name: 'Rescue Program', icon: '🚑', description: 'Pups per minute per kennel, automatically.', stat: 'rescueRate', perLevel: 2, maxLevel: 10, baseCost: 150, costGrowth: 1.7 },
  { tier: 2, id: 'bigger_holes', name: 'Bigger Holes', icon: '🕳️', description: 'Deeper holes, bigger dig rate.', stat: 'layRate', perLevel: 0.1, maxLevel: 12, baseCost: 1e4, costGrowth: 1.8 },
  { tier: 2, id: 'mud_wash', name: 'Mud Wash', icon: '🛁', description: 'Clean finds are worth more.', stat: 'findValue', perLevel: 0.1, maxLevel: 12, baseCost: 1.5e4, costGrowth: 1.8 },
  { tier: 2, id: 'extra_padding', name: 'Extra Padding', icon: '🛋️', description: 'Squeeze more pups into each kennel.', stat: 'kennelCapacity', perLevel: 0.1, maxLevel: 10, baseCost: 2e4, costGrowth: 1.8 },
  { tier: 2, id: 'tune_ups', name: 'Tune-Ups', icon: '🔧', description: 'Vehicles carry more per trip.', stat: 'shippingCapacity', perLevel: 0.1, maxLevel: 10, baseCost: 2e4, costGrowth: 1.8 },
  { tier: 2, id: 'zoomie_training', name: 'Zoomie Training', icon: '🏃', description: 'Each zoomie gives more bonus.', stat: 'zoomieBonus', perLevel: 0.01, maxLevel: 10, baseCost: 3e4, costGrowth: 1.8 },
  { tier: 2, id: 'quick_refill', name: 'Quick Refill', icon: '⏩', description: 'Adoption stock refills faster.', stat: 'adoptionRefill', perLevel: 0.5, maxLevel: 10, baseCost: 3e4, costGrowth: 1.8 },
  { tier: 3, id: 'fleet_expansion', name: 'Fleet Expansion', icon: '🚏', description: 'Unlock extra fleet slots.', stat: 'fleetSlots', perLevel: 1, maxLevel: 8, baseCost: 3e7, costGrowth: 3 },
  { tier: 3, id: 'truffle_noses', name: 'Truffle Noses', icon: '🐽', description: 'Sniff out finds faster.', stat: 'layRate', perLevel: 0.2, maxLevel: 10, baseCost: 1e8, costGrowth: 2 },
  { tier: 3, id: 'appraisers', name: 'Appraisers', icon: '🔍', description: 'Experts raise find value.', stat: 'findValue', perLevel: 0.2, maxLevel: 10, baseCost: 1.5e8, costGrowth: 2 },
  { tier: 3, id: 'bunk_beds', name: 'Bunk Beds', icon: '🛌', description: 'Stack the pups higher.', stat: 'kennelCapacity', perLevel: 0.2, maxLevel: 10, baseCost: 2e8, costGrowth: 2 },
  { tier: 3, id: 'rescue_network', name: 'Rescue Network', icon: '📡', description: 'More pups per minute per kennel.', stat: 'rescueRate', perLevel: 5, maxLevel: 10, baseCost: 3e8, costGrowth: 2.1 },
  { tier: 4, id: 'golden_retrievers', name: 'Golden Retrievers', icon: '🦮', description: 'The best finders around.', stat: 'findValue', perLevel: 0.4, maxLevel: 8, baseCost: 1e12, costGrowth: 2.5 },
  { tier: 4, id: 'excavators', name: 'Excavators', icon: '🚜', description: 'Heavy machinery, tiny pups.', stat: 'layRate', perLevel: 0.4, maxLevel: 8, baseCost: 1e12, costGrowth: 2.5 },
  { tier: 4, id: 'express_lanes', name: 'Express Lanes', icon: '🛣️', description: 'Faster roads, faster shipping.', stat: 'shippingCapacity', perLevel: 0.3, maxLevel: 8, baseCost: 2e12, costGrowth: 2.5 },
  { tier: 4, id: 'pup_pods', name: 'Pup Pods', icon: '🛏️', description: 'Cozy capsule kennels.', stat: 'kennelCapacity', perLevel: 0.3, maxLevel: 8, baseCost: 3e12, costGrowth: 2.5 },
  { tier: 4, id: 'rescue_choppers', name: 'Rescue Choppers', icon: '🚁', description: 'Airlifted adoptions: far more pups per minute.', stat: 'rescueRate', perLevel: 30, maxLevel: 8, baseCost: 5e12, costGrowth: 2.5 },
  { tier: 5, id: 'quantum_fetch', name: 'Quantum Fetch', icon: '⚛️', description: 'Fetch in many universes at once.', stat: 'layRate', perLevel: 1, maxLevel: 6, baseCost: 1e17, costGrowth: 3.5 },
  { tier: 5, id: 'celebrity_pups', name: 'Celebrity Pups', icon: '🌟', description: 'Famous paws, famous prices.', stat: 'findValue', perLevel: 1, maxLevel: 6, baseCost: 1e17, costGrowth: 3.5 },
  { tier: 5, id: 'hyper_shipping', name: 'Hyper Shipping', icon: '⚡', description: 'Next-nanosecond delivery.', stat: 'shippingCapacity', perLevel: 0.6, maxLevel: 6, baseCost: 3e17, costGrowth: 3.5 },
  { tier: 5, id: 'dimension_kennels', name: 'Dimension Kennels', icon: '🌀', description: 'Bigger on the inside.', stat: 'kennelCapacity', perLevel: 0.6, maxLevel: 6, baseCost: 5e17, costGrowth: 3.5 },
  { tier: 5, id: 'pup_portals', name: 'Pup Portals', icon: '🌌', description: 'Pups arrive through the portal by the thousand.', stat: 'rescueRate', perLevel: 100, maxLevel: 6, baseCost: 8e17, costGrowth: 3.5 },
];
