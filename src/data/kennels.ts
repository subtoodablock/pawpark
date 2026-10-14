import type { KennelTierDef } from '../core/types';
import { KENNEL_COST_GROWTH, KENNEL_EXTRA_GROWTH, LADDER_STEEP_FROM } from './constants';

const sig3 = (x: number) => Number(x.toPrecision(3));
/** docs/10 §2.1: 50 x growth^t, steepened above tier LADDER_STEEP_FROM */
const cost = (t: number) => sig3(50 * KENNEL_COST_GROWTH ** t * KENNEL_EXTRA_GROWTH ** Math.max(0, t - LADDER_STEEP_FROM));

export const KENNELS: KennelTierDef[] = [
  { id: 'doghouse', name: 'Doghouse', icon: '🏠', capacity: 250, cost: cost(0) },
  { id: 'twin_doghouse', name: 'Twin Doghouse', icon: '🏘️', capacity: 500, cost: cost(1) },
  { id: 'kennel_shed', name: 'Kennel Shed', icon: '🛖', capacity: 1000, cost: cost(2) },
  { id: 'pup_barn', name: 'Pup Barn', icon: '🛖', capacity: 2000, cost: cost(3) },
  { id: 'bark_lodge', name: 'Bark Lodge', icon: '🏡', capacity: 5000, cost: cost(4) },
  { id: 'doggy_daycare', name: 'Doggy Daycare', icon: '🏫', capacity: 10000, cost: cost(5) },
  { id: 'pooch_plaza', name: 'Pooch Plaza', icon: '🏬', capacity: 20000, cost: cost(6) },
  { id: 'hound_hall', name: 'Hound Hall', icon: '🏛️', capacity: 50000, cost: cost(7) },
  { id: 'canine_complex', name: 'Canine Complex', icon: '🏢', capacity: 100000, cost: cost(8) },
  { id: 'woof_warehouse', name: 'Woof Warehouse', icon: '🏭', capacity: 200000, cost: cost(9) },
  { id: 'mutt_mansion', name: 'Mutt Mansion', icon: '🏰', capacity: 500000, cost: cost(10) },
  { id: 'tail_tower', name: 'Tail Tower', icon: '🗼', capacity: 1e6, cost: cost(11) },
  { id: 'pupscraper', name: 'Pupscraper', icon: '🏙️', capacity: 2e6, cost: cost(12) },
  { id: 'bark_bunker', name: 'Bark Bunker', icon: '⛰️', capacity: 1e7, cost: cost(13) },
  { id: 'sky_kennel', name: 'Sky Kennel', icon: '☁️', capacity: 2.5e7, cost: cost(14) },
  { id: 'orbital_kennel', name: 'Orbital Kennel', icon: '🛰️', capacity: 5e7, cost: cost(15) },
  { id: 'moon_pound', name: 'Moon Pound', icon: '🌙', capacity: 1e8, cost: cost(16) },
  { id: 'planet_paw', name: 'Planet Paw', icon: '🪐', capacity: 6e8, cost: cost(17) },
];
