import type { AcademyDef } from '../core/types';

export const ACADEMY: AcademyDef[] = [
  { id: 'epic_digging', name: 'Epic Digging', icon: '⛏️', description: 'Permanent dig rate boost.', stat: 'layRate', perLevel: 0.05, maxLevel: 20, baseCost: 5, costGrowth: 1.3 },
  { id: 'epic_kibble', name: 'Epic Kibble', icon: '🍖', description: 'Permanent find value boost.', stat: 'findValue', perLevel: 0.05, maxLevel: 20, baseCost: 5, costGrowth: 1.3 },
  { id: 'spirit_bond', name: 'Spirit Bond', icon: '👻', description: 'Each Spirit Paw is worth more.', stat: 'spiritPawBonus', perLevel: 0.01, maxLevel: 10, baseCost: 20, costGrowth: 1.4 },
  { id: 'legend_lore', name: 'Legend Lore', icon: '📜', description: 'Legend Collars compound harder.', stat: 'collarBonus', perLevel: 0.01, maxLevel: 5, baseCost: 50, costGrowth: 1.6 },
  { id: 'bigger_jar', name: 'Bigger Treat Jar', icon: '🫙', description: 'More offline hours of earnings.', stat: 'offlineHours', perLevel: 0.5, maxLevel: 10, baseCost: 10, costGrowth: 1.35 },
  { id: 'night_shift', name: 'Night Shift', icon: '🌙', description: 'Rescues keep going while you are away.', stat: 'offlineRescue', perLevel: 0.1, maxLevel: 5, baseCost: 15, costGrowth: 1.4 },
  { id: 'squirrel_spotter', name: 'Squirrel Spotter', icon: '🐿️', description: 'Squirrels show up more often.', stat: 'squirrelRate', perLevel: 0.1, maxLevel: 10, baseCost: 10, costGrowth: 1.35 },
  { id: 'max_zoomies', name: 'Max Zoomies', icon: '💨', description: 'Higher zoomies cap.', stat: 'maxZoomies', perLevel: 5, maxLevel: 10, baseCost: 8, costGrowth: 1.35 },
  { id: 'bargain_hunter', name: 'Bargain Hunter', icon: '🏷️', description: 'Training costs less.', stat: 'researchDiscount', perLevel: 0.05, maxLevel: 10, baseCost: 15, costGrowth: 1.4 },
  { id: 'kennel_deals', name: 'Kennel Deals', icon: '🔨', description: 'Kennels cost less.', stat: 'kennelDiscount', perLevel: 0.05, maxLevel: 10, baseCost: 10, costGrowth: 1.35 },
  { id: 'fleet_deals', name: 'Fleet Deals', icon: '🔧', description: 'Vehicles cost less.', stat: 'fleetDiscount', perLevel: 0.05, maxLevel: 10, baseCost: 10, costGrowth: 1.35 },
];
