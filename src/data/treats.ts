import type { TreatDef } from '../core/types';

export const TREATS: TreatDef[] = [
  { id: 'bacon_strip', name: 'Bacon Strip', icon: '🥓', description: 'Doubles all earnings.', effect: 'earnings', multiplier: 2, durationSec: 30 * 60, cost: 25 },
  { id: 'peanut_kong', name: 'Peanut Butter Kong', icon: '🥜', description: 'Adoption center refills 10x faster.', effect: 'adoption', multiplier: 10, durationSec: 10 * 60, cost: 15 },
  { id: 'steak_dinner', name: 'Steak Dinner', icon: '🥩', description: 'Pups dig 5x faster. Zero regrets.', effect: 'layRate', multiplier: 5, durationSec: 10 * 60, cost: 40 },
];
