import type { VehicleTierDef } from '../core/types';
import { LADDER_STEEP_FROM, VEHICLE_COST_GROWTH, VEHICLE_EXTRA_GROWTH } from './constants';

const sig3 = (x: number) => Number(x.toPrecision(3));
/** docs/10 §2.1: 100 x growth^t, steepened above tier LADDER_STEEP_FROM */
const cost = (t: number) => sig3(100 * VEHICLE_COST_GROWTH ** t * VEHICLE_EXTRA_GROWTH ** Math.max(0, t - LADDER_STEEP_FROM));

export const VEHICLES: VehicleTierDef[] = [
  { id: 'bike_basket', name: 'Bike Basket', icon: '🚲', capacityPerMin: 300, cost: cost(0) },
  { id: 'wagon', name: 'Red Wagon', icon: '🛒', capacityPerMin: 1000, cost: cost(1) },
  { id: 'scooter', name: 'Scooter', icon: '🛵', capacityPerMin: 3000, cost: cost(2) },
  { id: 'delivery_van', name: 'Delivery Van', icon: '🚐', capacityPerMin: 10000, cost: cost(3) },
  { id: 'pickup', name: 'Pickup Truck', icon: '🛻', capacityPerMin: 30000, cost: cost(4) },
  { id: 'box_truck', name: 'Box Truck', icon: '🚚', capacityPerMin: 100000, cost: cost(5) },
  { id: 'semi', name: 'Semi', icon: '🚛', capacityPerMin: 300000, cost: cost(6) },
  { id: 'double_semi', name: 'Double Semi', icon: '🚛', capacityPerMin: 1e6, cost: cost(7) },
  { id: 'cargo_plane', name: 'Cargo Plane', icon: '✈️', capacityPerMin: 3e6, cost: cost(8) },
  { id: 'bone_freighter', name: 'Bone Freighter', icon: '🚢', capacityPerMin: 1e7, cost: cost(9) },
  { id: 'hover_hauler', name: 'Hover Hauler', icon: '🛸', capacityPerMin: 3e7, cost: cost(10) },
  { id: 'rocket', name: 'Fetch Rocket', icon: '🚀', capacityPerMin: 1e8, cost: cost(11) },
  { id: 'teleporter', name: 'Teleporter', icon: '🌀', capacityPerMin: 5e8, cost: cost(12) },
];
