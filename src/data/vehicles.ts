import type { VehicleTierDef } from '../core/types';

export const VEHICLES: VehicleTierDef[] = [
  { id: 'bike_basket', name: 'Bike Basket', icon: '🚲', capacityPerMin: 300, cost: 100 },
  { id: 'wagon', name: 'Red Wagon', icon: '🛒', capacityPerMin: 1000, cost: 1.5e4 },
  { id: 'scooter', name: 'Scooter', icon: '🛵', capacityPerMin: 3000, cost: 2.25e6 },
  { id: 'delivery_van', name: 'Delivery Van', icon: '🚐', capacityPerMin: 10000, cost: 3.38e8 },
  { id: 'pickup', name: 'Pickup Truck', icon: '🛻', capacityPerMin: 30000, cost: 5.06e10 },
  { id: 'box_truck', name: 'Box Truck', icon: '🚚', capacityPerMin: 100000, cost: 7.59e12 },
  { id: 'semi', name: 'Semi', icon: '🚛', capacityPerMin: 300000, cost: 1.14e15 },
  { id: 'double_semi', name: 'Double Semi', icon: '🚛', capacityPerMin: 1e6, cost: 1.71e17 },
  { id: 'cargo_plane', name: 'Cargo Plane', icon: '✈️', capacityPerMin: 3e6, cost: 2.56e19 },
  { id: 'bone_freighter', name: 'Bone Freighter', icon: '🚢', capacityPerMin: 1e7, cost: 3.84e21 },
  { id: 'hover_hauler', name: 'Hover Hauler', icon: '🛸', capacityPerMin: 3e7, cost: 5.77e23 },
  { id: 'rocket', name: 'Fetch Rocket', icon: '🚀', capacityPerMin: 1e8, cost: 8.65e25 },
  { id: 'teleporter', name: 'Teleporter', icon: '🌀', capacityPerMin: 5e8, cost: 1.3e28 },
];
