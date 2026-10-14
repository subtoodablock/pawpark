import type { AcademyDef } from '../core/types';

export const ACADEMY: AcademyDef[] = [
  // automation unlocks
  { id: 'foreman_pup', name: 'Foreman Pup', icon: '👷', description: 'Automatically buys kennel and vehicle upgrades.', stat: 'autoBuild', perLevel: 1, maxLevel: 1, baseCost: 10, costGrowth: 1 },
  { id: 'head_trainer', name: 'Head Trainer', icon: '🎓', description: 'Automatically buys training levels.', stat: 'autoTraining', perLevel: 1, maxLevel: 1, baseCost: 30, costGrowth: 1 },
  { id: 'volunteer_walkers', name: 'Volunteer Walkers', icon: '🚶', description: 'Adopt pups for you from the adoption center, 20% of the refill rate per level.', stat: 'autoWhistle', perLevel: 0.2, maxLevel: 5, baseCost: 8, costGrowth: 1.4 },
  { id: 'retirement_planner', name: 'Retirement Planner', icon: '🧳', description: 'Opens a new park automatically when it is worth it.', stat: 'autoPrestige', perLevel: 1, maxLevel: 1, baseCost: 500, costGrowth: 1 },
  // being away
  { id: 'bigger_jar', name: 'Bigger Treat Jar', icon: '🫙', description: 'Two more offline hours of progress per level.', stat: 'offlineHours', perLevel: 2, maxLevel: 20, baseCost: 5, costGrowth: 1.2 },
  { id: 'bigger_mailbox', name: 'Bigger Mailbox', icon: '📮', description: 'Hold one more letter per level.', stat: 'mailCapacity', perLevel: 1, maxLevel: 6, baseCost: 12, costGrowth: 1.4 },
  { id: 'squirrel_hound', name: 'Squirrel Hound', icon: '🐕‍🦺', description: 'Catches escaping squirrels for you, 10% per level.', stat: 'squirrelHound', perLevel: 0.05, maxLevel: 20, baseCost: 20, costGrowth: 1.22 },
  { id: 'squirrel_spotter', name: 'Squirrel Spotter', icon: '🐿️', description: 'Squirrels show up more often.', stat: 'squirrelRate', perLevel: 0.04, maxLevel: 25, baseCost: 10, costGrowth: 1.18 },
  // power
  { id: 'epic_digging', name: 'Epic Digging', icon: '⛏️', description: 'Permanent dig rate boost.', stat: 'layRate', perLevel: 0.05, maxLevel: 50, baseCost: 5, costGrowth: 1.18 },
  { id: 'epic_kibble', name: 'Epic Kibble', icon: '🍖', description: 'Permanent find value boost.', stat: 'findValue', perLevel: 0.05, maxLevel: 50, baseCost: 5, costGrowth: 1.18 },
  { id: 'spirit_bond', name: 'Spirit Bond', icon: '👻', description: 'Each Spirit Paw is worth more.', stat: 'spiritPawBonus', perLevel: 0.005, maxLevel: 40, baseCost: 20, costGrowth: 1.15 },
  { id: 'legend_lore', name: 'Legend Lore', icon: '📜', description: 'Legend Collars compound harder.', stat: 'collarBonus', perLevel: 0.005, maxLevel: 30, baseCost: 40, costGrowth: 1.17 },
  { id: 'max_zoomies', name: 'Max Zoomies', icon: '💨', description: 'Higher zoomies cap.', stat: 'maxZoomies', perLevel: 2, maxLevel: 25, baseCost: 8, costGrowth: 1.17 },
  { id: 'bargain_hunter', name: 'Bargain Hunter', icon: '🏷️', description: 'Training costs less.', stat: 'researchDiscount', perLevel: 0.02, maxLevel: 25, baseCost: 15, costGrowth: 1.18 },
  { id: 'kennel_deals', name: 'Kennel Deals', icon: '🔨', description: 'Kennels cost less.', stat: 'kennelDiscount', perLevel: 0.02, maxLevel: 25, baseCost: 10, costGrowth: 1.18 },
  { id: 'fleet_deals', name: 'Fleet Deals', icon: '🔧', description: 'Vehicles cost less.', stat: 'fleetDiscount', perLevel: 0.02, maxLevel: 25, baseCost: 10, costGrowth: 1.18 },
];
