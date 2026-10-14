import type { VehicleTierDef } from '../core/types';

export const VEHICLES: VehicleTierDef[] = [
  { id: 'bike_basket', name: 'Bike Basket', icon: '🚲', capacityPerMin: 300, cost: 1e2 },
  { id: 'wagon', name: 'Red Wagon', icon: '🛒', capacityPerMin: 1000, cost: 1.5e3 },
  { id: 'scooter', name: 'Scooter', icon: '🛵', capacityPerMin: 3000, cost: 3e4 },
  { id: 'delivery_van', name: 'Delivery Van', icon: '🚐', capacityPerMin: 10000, cost: 3.6e5 },
  { id: 'pickup', name: 'Pickup Truck', icon: '🛻', capacityPerMin: 30000, cost: 4.3e6 },
  { id: 'box_truck', name: 'Box Truck', icon: '🚚', capacityPerMin: 100000, cost: 5.2e7 },
  { id: 'semi', name: 'Semi', icon: '🚛', capacityPerMin: 300000, cost: 6.2e8 },
  { id: 'double_semi', name: 'Double Semi', icon: '🚛', capacityPerMin: 1e6, cost: 7.5e9 },
  { id: 'cargo_plane', name: 'Cargo Plane', icon: '✈️', capacityPerMin: 3e6, cost: 9e10 },
  { id: 'bone_freighter', name: 'Bone Freighter', icon: '🚢', capacityPerMin: 1e7, cost: 1.1e12 },
  { id: 'hover_hauler', name: 'Hover Hauler', icon: '🛸', capacityPerMin: 3e7, cost: 1.3e13 },
  { id: 'rocket', name: 'Fetch Rocket', icon: '🚀', capacityPerMin: 1e8, cost: 1.5e14 },
  { id: 'teleporter', name: 'Teleporter', icon: '🌀', capacityPerMin: 5e8, cost: 1.9e15 },
];
