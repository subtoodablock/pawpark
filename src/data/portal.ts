// Paw Portal content (docs/11-paw-portal.md). First-pass numbers; the balance pass tunes them.
import type {
  CrewDef, DimensionDef, ExpeditionLength, RelicFamilyDef, Stat, StoneDef,
} from '../core/types';

const H = 3600;

export const PORTAL_SLOTS = 3;
export const RELIC_EQUIP_SLOTS = 4;
export const RELIC_TIERS = 4;
export const STONE_TIERS = 3;
/** Findable index of the Rawhide Bone (the era that unlocks the Portal Gate with >= 1 prestige) */
export const PORTAL_UNLOCK_FIND = 3;
export const PORTAL_UNLOCK_PRESTIGES = 1;
/** one-time cash cost of the Portal Gate (about a Pup Barn) */
export const PORTAL_BUILD_COST = 1e6;

export const EXPEDITION_LENGTHS: readonly ExpeditionLength[] = ['short', 'standard', 'long'];

/** loot items per run: short 1, standard round(scale), long round(2 x scale) (balance pass: relics are a bounded layer, docs/11 §5) */
const CAP_SCALE = [1, 1.3, 1.6, 2, 2.4, 3];
const cap = (i: number): Record<ExpeditionLength, number> => ({
  short: 1,
  standard: Math.max(1, Math.round(CAP_SCALE[i])),
  long: Math.max(2, Math.round(2 * CAP_SCALE[i])),
});

export const CREWS: CrewDef[] = [
  { id: 'puppy_scouts', name: 'Puppy Scouts', unlockRuns: 0, durationsSec: { short: 0.5 * H, standard: 3 * H, long: 12 * H }, capacity: cap(0), starRuns: [5, 12, 25, 45, 75] },
  { id: 'fetch_squad', name: 'Fetch Squad', unlockRuns: 15, durationsSec: { short: 1 * H, standard: 4 * H, long: 12 * H }, capacity: cap(1), starRuns: [5, 12, 25, 45, 75] },
  { id: 'rescue_rangers', name: 'Rescue Rangers', unlockRuns: 30, durationsSec: { short: 2 * H, standard: 6 * H, long: 16 * H }, capacity: cap(2), starRuns: [5, 12, 25, 45, 75] },
  { id: 'sky_hounds', name: 'Sky Hounds', unlockRuns: 60, durationsSec: { short: 3 * H, standard: 8 * H, long: 24 * H }, capacity: cap(3), starRuns: [5, 12, 25, 45, 75] },
  { id: 'star_retrievers', name: 'Star Retrievers', unlockRuns: 100, durationsSec: { short: 4 * H, standard: 12 * H, long: 36 * H }, capacity: cap(4), starRuns: [5, 12, 25, 45, 75] },
  { id: 'infinity_pack', name: 'Infinity Pack', unlockRuns: 150, durationsSec: { short: 6 * H, standard: 18 * H, long: 48 * H }, capacity: cap(5), starRuns: [5, 12, 25, 45, 75] },
];

export const DIMENSIONS: DimensionDef[] = [
  { id: 'bacon_dimension', name: 'The Bacon Dimension', description: 'Sizzling seas and crispy shores.', minCrew: 0, familyWeights: { bacon_prism: 4, golden_bowl: 2, kennel_key: 1 } },
  { id: 'squeakopolis', name: 'Squeakopolis', description: 'A city made entirely of toys.', minCrew: 0, familyWeights: { squeaky_orb: 4, lucky_acorn: 2, rescue_beacon: 1 } },
  { id: 'tennis_ball_nebula', name: 'Tennis Ball Nebula', description: 'Fuzzy green clouds, endless bounce.', minCrew: 1, familyWeights: { cosmic_frisbee: 4, wormhole_leash: 2, squeaky_orb: 1 } },
  { id: 'upside_down_park', name: 'The Upside-Down Dog Park', description: 'Where dogs walk the humans.', minCrew: 1, familyWeights: { rescue_beacon: 4, kennel_key: 2, bark_tablet: 1 } },
  { id: 'planet_nap', name: 'Planet Nap', description: 'Everything here is a warm patch of sun.', minCrew: 2, familyWeights: { timefold_collar: 4, golden_bowl: 2, kennel_key: 1 } },
  { id: 'mailmans_rift', name: "The Mailman's Rift", description: 'Scary. Very scary. Loud footsteps.', minCrew: 3, familyWeights: { wormhole_leash: 4, lucky_acorn: 2, cosmic_frisbee: 2 } },
  { id: 'cat_universe', name: 'Cat Universe', description: 'Very scary, but the best loot.', minCrew: 4, familyWeights: { bark_tablet: 3, bacon_prism: 3, squeaky_orb: 3, timefold_collar: 2, rescue_beacon: 2 } },
  { id: 'bone_zero', name: 'Bone Zero', description: 'The origin of all bones.', minCrew: 5, familyWeights: { bark_tablet: 4, bacon_prism: 2, squeaky_orb: 2, rescue_beacon: 2 } },
];

/** weight of a family a dimension does not list */
export const DIMENSION_DEFAULT_WEIGHT = 0.25;
/** extra rarity boost for the scary dimensions */
export const DIMENSION_RARITY_BOOST: Record<string, number> = { mailmans_rift: 0.2, bone_zero: 0.4, cat_universe: 0.6 };

/** Geometric T1-Common -> T4-Legendary interpolation over the 16 (tier x rarity) cells. */
function grid(lo: number, hi: number, digits: number): number[][] {
  const p = 10 ** digits;
  const out: number[][] = [];
  for (let t = 0; t < 4; t++) {
    const row: number[] = [];
    for (let r = 0; r < 4; r++) {
      const v = lo * Math.pow(hi / lo, (t * 4 + r) / 15);
      row.push(Math.round(v * p) / p);
    }
    out.push(row);
  }
  out[0][0] = lo;
  out[3][3] = hi;
  return out;
}

export const RELIC_FAMILIES: RelicFamilyDef[] = [
  { id: 'bacon_prism', name: 'Bacon Prism', description: 'Pups dig faster.', stat: 'layRate', effect: grid(0.03, 0.75, 4) },
  { id: 'squeaky_orb', name: 'Squeaky Orb', description: 'Finds are worth more.', stat: 'findValue', effect: grid(0.03, 0.75, 4) },
  { id: 'kennel_key', name: 'Pocket Kennel Key', description: 'Kennels hold more pups.', stat: 'kennelCapacity', effect: grid(0.03, 0.4, 4) },
  { id: 'wormhole_leash', name: 'Wormhole Leash', description: 'Vehicles carry more.', stat: 'shippingCapacity', effect: grid(0.03, 0.75, 4) },
  { id: 'rescue_beacon', name: 'Rescue Beacon', description: 'More pups are rescued.', stat: 'rescueMult', effect: grid(0.03, 0.9, 4) },
  { id: 'timefold_collar', name: 'Time-Fold Collar', description: 'Longer Treat Jar (hours).', stat: 'offlineHours', effect: grid(1, 12, 2) },
  { id: 'lucky_acorn', name: 'Lucky Acorn', description: 'Squirrels visit more often.', stat: 'squirrelRate', effect: grid(0.1, 1.5, 4) },
  { id: 'bark_tablet', name: 'Ancient Bark Tablet', description: 'More power per Spirit Paw.', stat: 'spiritPawBonus', effect: grid(0.002, 0.03, 5) },
  { id: 'cosmic_frisbee', name: 'Cosmic Frisbee', description: 'Higher max Zoomies.', stat: 'maxZoomies', effect: grid(5, 60, 2) },
  { id: 'golden_bowl', name: 'Golden Food Bowl', description: 'Training costs less.', stat: 'researchDiscount', effect: grid(0.02, 0.2, 4) },
];

/** Stones: effect by stone tier 0..2 (+1% .. +5%). All mult stats. */
const SE = [0.01, 0.025, 0.05];
export const STONES: StoneDef[] = [
  { id: 'lay_shard', name: 'Bacon Shard', stat: 'layRate', effect: SE },
  { id: 'find_shard', name: 'Squeak Shard', stat: 'findValue', effect: SE },
  { id: 'kennel_shard', name: 'Kennel Shard', stat: 'kennelCapacity', effect: SE },
  { id: 'ship_shard', name: 'Leash Shard', stat: 'shippingCapacity', effect: SE },
  { id: 'rescue_shard', name: 'Beacon Shard', stat: 'rescueMult', effect: SE },
  { id: 'acorn_shard', name: 'Acorn Shard', stat: 'squirrelRate', effect: SE },
];

/** stone sockets by relic rarity (Common 0, Rare 1, Epic 2, Legendary 3) */
export const SOCKETS_BY_RARITY: readonly number[] = [0, 1, 2, 3];

export const RARITY_NAMES: readonly string[] = ['Common', 'Rare', 'Epic', 'Legendary'];

/** base rarity probabilities per relic tier (index 0..3) */
export const RARITY_ODDS: number[][] = [
  [0.8, 0.17, 0.028, 0.002],
  [0.7, 0.23, 0.065, 0.005],
  [0.6, 0.28, 0.1, 0.02],
  [0.5, 0.3, 0.15, 0.05],
];
/** each crew star raises the rare+ weights: weight_r x (1 + boost x r) */
export const RARITY_STAR_BOOST = 0.25;
/** craftXp -> same boost, capped */
export const RARITY_CRAFT_XP_BOOST = 0.01;
export const RARITY_CRAFT_XP_BOOST_CAP = 1.5;
/** +capacity fraction per crew star */
export const STAR_CAPACITY_BONUS = 0.08;

/** loot extras */
export const STONE_DROP_CHANCE = 0.18;
export const GOLDEN_BONES_CHANCE = 0.4;

/** Fuel: cash = max(income, MIN) x seconds of income; Golden Bones as the alternative */
export const FUEL_INCOME_SEC: Record<ExpeditionLength, number> = { short: 300, standard: 1800, long: 7200 };
export const FUEL_BONES: Record<ExpeditionLength, number> = { short: 2, standard: 6, long: 15 };

/** Craft fee into tier t+1 (index t = source tier 0..2): seconds of income */
export const CRAFT_INCOME_SEC: number[] = [900, 3600, 14400];
/** craftXp gained per craft into tier t+1 */
export const CRAFT_XP: number[] = [1, 3, 8];
export const CRAFT_COUNT = 3;

/** golden bones for recycling a relic: [tier][rarity] */
export const RECYCLE_BONES: number[][] = [
  [0, 0, 0, 1],
  [0, 0, 1, 2],
  [0, 1, 2, 4],
  [1, 2, 4, 8],
];

export const RELIC_STATS: readonly Stat[] = RELIC_FAMILIES.map((f) => f.stat);
export const STONE_CRAFT_COUNT = 3;
