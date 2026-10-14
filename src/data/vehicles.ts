import type { VehicleTierDef } from '../core/types';

export const VEHICLES: VehicleTierDef[] = [
  { id: 'bike_basket', name: 'Bike Basket', icon: '🚲', capacityPerMin: 300, cost: 100 },
  { id: 'wagon', name: 'Red Wagon', icon: '🛒', capacityPerMin: 1000, cost: 1500},
  { id: 'scooter', name: 'Scooter', icon: '🛵', capacityPerMin: 3000, cost: 50000},
  { id: 'delivery_van', name: 'Delivery Van', icon: '🚐', capacityPerMin: 10000, cost: 5e5},
  { id: 'pickup', name: 'Pickup Truck', icon: '🛻', capacityPerMin: 30000, cost: 5e6 },
  { id: 'box_truck', name: 'Box Truck', icon: '🚚', capacityPerMin: 1e5, cost: 5e7 },
  { id: 'semi', name: 'Semi', icon: '🚛', capacityPerMin: 3e5, cost: 5e8 },
  { id: 'double_semi', name: 'Double Semi', icon: '🚛', capacityPerMin: 1e6, cost: 5e9 },
  { id: 'cargo_plane', name: 'Cargo Plane', icon: '✈️', capacityPerMin: 3e6, cost: 5e10 },
  { id: 'bone_freighter', name: 'Bone Freighter', icon: '🚢', capacityPerMin: 1e7, cost: 5e11 },
  { id: 'hover_hauler', name: 'Hover Hauler', icon: '🛸', capacityPerMin: 3e7, cost: 5e12 },
  { id: 'rocket', name: 'Fetch Rocket', icon: '🚀', capacityPerMin: 1e8, cost: 5e13 },
  { id: 'teleporter', name: 'Teleporter', icon: '🌀', capacityPerMin: 5e8, cost: 5e14 },
];
