import type { TreatDef } from '../core/types';

const FOUR_HOURS = 4 * 3600;

export const TREATS: TreatDef[] = [
  { id: 'bacon_strip', name: 'Bacon Strip', icon: '🥓', description: 'Doubles all earnings for 4 hours.', effect: 'earnings', multiplier: 2, durationSec: FOUR_HOURS, cost: 40 },
  { id: 'peanut_kong', name: 'Peanut Butter Kong', icon: '🥜', description: 'Adoption refill and rescues are 5x faster for 4 hours.', effect: 'adoption', multiplier: 5, durationSec: FOUR_HOURS, cost: 20 },
  { id: 'steak_dinner', name: 'Steak Dinner', icon: '🥩', description: 'Pups dig 3x faster for 4 hours. Zero regrets.', effect: 'layRate', multiplier: 3, durationSec: FOUR_HOURS, cost: 60 },
];
