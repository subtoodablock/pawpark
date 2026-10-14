import type { AcademyDef } from '../core/types';

export const ACADEMY: AcademyDef[] = [
  // automation unlocks
  { id: 'foreman_pup', name: 'Foreman Pup', icon: '👷', description: 'Automatically buys kennel and vehicle upgrades.', stat: 'autoBuild', perLevel: 1, maxLevel: 1, baseCost: 10, costGrowth: 1 },
  { id: 'head_trainer', name: 'Head Trainer', icon: '🎓', description: 'Automatically buys training levels.', stat: 'autoTraining', perLevel: 1, maxLevel: 1, baseCost: 30, costGrowth: 1 },
  { id: 'volunteer_walkers', name: 'Volunteer Walkers', icon: '🚶', description: 'Adopt pups for you from the adoption center, 20% of the refill rate per level.', stat: 'autoWhistle', perLevel: 0.2, maxLevel: 5, baseCost: 20, costGrowth: 1.6 },
  { id: 'retirement_planner', name: 'Retirement Planner', icon: '🧳', description: 'Opens a new park automatically when it is worth it.', stat: 'autoPrestige', perLevel: 1, maxLevel: 1, baseCost: 400, costGrowth: 1 },
  // being away
  { id: 'bigger_jar', name: 'Bigger Treat Jar', icon: '🫙', description: 'Two more offline hours of progress per level.', stat: 'offlineHours', perLevel: 2, maxLevel: 20, baseCost: 15, costGrowth: 1.25 },
  { id: 'bigger_mailbox', name: 'Bigger Mailbox', icon: '📮', description: 'Hold one more letter per level.', stat: 'mailCapacity', perLevel: 1, maxLevel: 7, baseCost: 25, costGrowth: 1.5 },
  { id: 'squirrel_hound', name: 'Squirrel Hound', icon: '🐕‍🦺', description: 'Catches escaping squirrels for you, 10% per level.', stat: 'squirrelHound', perLevel: 0.1, maxLevel: 10, baseCost: 20, costGrowth: 1.35 },
  { id: 'squirrel_spotter', name: 'Squirrel Spotter', icon: '🐿️', description: 'Squirrels show up more often.', stat: 'squirrelRate', perLevel: 0.1, maxLevel: 10, baseCost: 10, costGrowth: 1.35 },
  // power
  { id: 'epic_digging', name: 'Epic Digging', icon: '⛏️', description: 'Permanent dig rate boost.', stat: 'layRate', perLevel: 0.05, maxLevel: 50, baseCost: 5, costGrowth: 1.18 },
  { id: 'epic_kibble', name: 'Epic Kibble', icon: '🍖', description: 'Permanent find value boost.', stat: 'findValue', perLevel: 0.05, maxLevel: 50, baseCost: 5, costGrowth: 1.18 },
  { id: 'spirit_bond', name: 'Spirit Bond', icon: '👻', description: 'Each Spirit Paw is worth more.', stat: 'spiritPawBonus', perLevel: 0.01, maxLevel: 20, baseCost: 20, costGrowth: 1.3 },
  { id: 'legend_lore', name: 'Legend Lore', icon: '📜', description: 'Legend Collars compound harder.', stat: 'collarBonus', perLevel: 0.01, maxLevel: 10, baseCost: 50, costGrowth: 1.45 },
  { id: 'max_zoomies', name: 'Max Zoomies', icon: '💨', description: 'Higher zoomies cap.', stat: 'maxZoomies', perLevel: 5, maxLevel: 10, baseCost: 8, costGrowth: 1.35 },
  { id: 'bargain_hunter', name: 'Bargain Hunter', icon: '🏷️', description: 'Training costs less.', stat: 'researchDiscount', perLevel: 0.05, maxLevel: 10, baseCost: 15, costGrowth: 1.4 },
  { id: 'kennel_deals', name: 'Kennel Deals', icon: '🔨', description: 'Kennels cost less.', stat: 'kennelDiscount', perLevel: 0.05, maxLevel: 10, baseCost: 10, costGrowth: 1.35 },
  { id: 'fleet_deals', name: 'Fleet Deals', icon: '🔧', description: 'Vehicles cost less.', stat: 'fleetDiscount', perLevel: 0.05, maxLevel: 10, baseCost: 10, costGrowth: 1.35 },
];
