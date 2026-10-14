// Paw Portal engine (docs/11-paw-portal.md): unlock, expeditions, relics, stones, crafting, recycling.
import type {
  ActionResult, Expedition, ExpeditionLength, GameEvent, GameState, PortalState, Relic, RelicRarity, Rng,
} from './types';
import {
  CRAFT_COUNT, CRAFT_INCOME_SEC, CRAFT_XP, CREWS, DIMENSIONS, DIMENSION_DEFAULT_WEIGHT,
  DIMENSION_RARITY_BOOST, EXPEDITION_LENGTHS, FUEL_BONES, FUEL_INCOME_SEC, GOLDEN_BONES_CHANCE,
  MIN_SQUIRREL_CASH_RATE, PORTAL_BUILD_COST, PORTAL_SLOTS, PORTAL_UNLOCK_FIND, PORTAL_UNLOCK_PRESTIGES,
  RARITY_CRAFT_XP_BOOST, RARITY_CRAFT_XP_BOOST_CAP, RARITY_ODDS, RARITY_STAR_BOOST, RECYCLE_BONES,
  RELIC_EQUIP_SLOTS, RELIC_FAMILIES, RELIC_TIERS, SOCKETS_BY_RARITY, STAR_CAPACITY_BONUS, STONES,
  STONE_DROP_CHANCE, STONE_TIERS, STONE_CRAFT_COUNT,
} from '../data';
import { computeStats } from './stats';
import { hashString, seededRng } from './dates';
import { familyDef, isStoneKey, stoneKey } from './relics';

const fail = (reason: string): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

// ---------------------------------------------------------------- state + unlock

export function createPortalState(): PortalState {
  const crews: PortalState['crews'] = {};
  for (const c of CREWS) crews[c.id] = { runs: 0 };
  return {
    built: false,
    slots: new Array(PORTAL_SLOTS).fill(null),
    crews,
    relics: [],
    nextRelicId: 1,
    equipped: new Array(RELIC_EQUIP_SLOTS).fill(null),
    stones: {},
    craftXp: 0,
    launchSeq: 0,
  };
}

/** True when the Portal Gate should exist (but maybe not yet built). */
export function portalQualifies(state: GameState): boolean {
  return state.findIndex >= PORTAL_UNLOCK_FIND && state.prestigeCount >= PORTAL_UNLOCK_PRESTIGES;
}

/** Creates state.portal the first time the player qualifies. Returns the event, or null. */
export function checkPortalUnlock(state: GameState): GameEvent | null {
  if (state.portal || !portalQualifies(state)) return null;
  state.portal = createPortalState();
  return { type: 'portalUnlocked' };
}

export function buildPortal(state: GameState): ActionResult {
  const p = state.portal;
  if (!p) return fail('The Portal Gate is not unlocked yet.');
  if (p.built) return fail('The Portal Gate is already built.');
  if (state.cash < PORTAL_BUILD_COST) return fail('Not enough cash.');
  state.cash -= PORTAL_BUILD_COST;
  p.built = true;
  return OK;
}

// ---------------------------------------------------------------- crews

const crewIndex = (id: string) => CREWS.findIndex((c) => c.id === id);

export function crewRuns(state: GameState, crewId: string): number {
  return state.portal?.crews[crewId]?.runs ?? 0;
}

export function crewUnlocked(state: GameState, crewId: string): boolean {
  const i = crewIndex(crewId);
  if (i < 0) return false;
  if (i === 0) return true;
  return crewRuns(state, CREWS[i - 1].id) >= CREWS[i].unlockRuns;
}

export function crewStars(state: GameState, crewId: string): number {
  const def = CREWS.find((c) => c.id === crewId);
  if (!def) return 0;
  const runs = crewRuns(state, crewId);
  let stars = 0;
  for (const r of def.starRuns) if (runs >= r) stars++;
  return stars;
}

export interface CrewProgress {
  unlocked: boolean;
  runs: number;
  stars: number;
  maxStars: number;
  /** runs needed for the next star, or null at max stars */
  nextStarRuns: number | null;
  /** runs of the previous crew still needed to unlock this one (0 when unlocked) */
  runsToUnlock: number;
}

export function crewProgress(state: GameState, crewId: string): CrewProgress | null {
  const i = crewIndex(crewId);
  if (i < 0) return null;
  const def = CREWS[i];
  const stars = crewStars(state, crewId);
  const unlocked = crewUnlocked(state, crewId);
  return {
    unlocked,
    runs: crewRuns(state, crewId),
    stars,
    maxStars: def.starRuns.length,
    nextStarRuns: def.starRuns[stars] ?? null,
    runsToUnlock: unlocked || i === 0 ? 0 : Math.max(0, def.unlockRuns - crewRuns(state, CREWS[i - 1].id)),
  };
}

// ---------------------------------------------------------------- odds + loot rolls

/** Rarity probabilities [common..legendary] for a relic tier. boost: crew stars, craft XP and dimension. */
export function rarityOdds(tier: number, boost: number): number[] {
  const base = RARITY_ODDS[Math.min(RELIC_TIERS - 1, Math.max(0, tier))];
  const w = base.map((p, r) => p * (1 + boost * r));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

/** Rarity boost from craft XP (capped) */
export function craftXpBoost(state: GameState): number {
  return Math.min(RARITY_CRAFT_XP_BOOST_CAP, (state.portal?.craftXp ?? 0) * RARITY_CRAFT_XP_BOOST);
}

export function rollRarity(tier: number, boost: number, rng: Rng): RelicRarity {
  const odds = rarityOdds(tier, boost);
  let x = rng();
  for (let r = 0; r < odds.length; r++) {
    x -= odds[r];
    if (x < 0) return r as RelicRarity;
  }
  return 3;
}

function pickWeighted<T>(items: T[], weights: number[], rng: Rng): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Tier weights: peaks at a target tier that grows with crew index and length. */
function tierWeights(crewIdx: number, lengthIdx: number): number[] {
  const target = ((crewIdx + lengthIdx) * (RELIC_TIERS - 1)) / (CREWS.length - 1 + 2);
  return Array.from({ length: RELIC_TIERS }, (_, t) => Math.exp(-1.5 * (t - target) ** 2));
}

/** Rolls the loot of an expedition. Pure given rng and (stars, craftXpBoost). */
export function rollLoot(
  crewId: string,
  dimensionId: string,
  length: ExpeditionLength,
  stars: number,
  craftBoost: number,
  rng: Rng,
): Expedition['loot'] {
  const ci = Math.max(0, crewIndex(crewId));
  const li = EXPEDITION_LENGTHS.indexOf(length);
  const crew = CREWS[ci];
  const dim = DIMENSIONS.find((d) => d.id === dimensionId);
  const mean = crew.capacity[length] * (1 + STAR_CAPACITY_BONUS * stars);
  const count = Math.max(1, Math.floor(mean) + (rng() < mean - Math.floor(mean) ? 1 : 0));
  const boost = stars * RARITY_STAR_BOOST + craftBoost + (DIMENSION_RARITY_BOOST[dimensionId] ?? 0);
  const tw = tierWeights(ci, li);
  const fw = RELIC_FAMILIES.map((f) => dim?.familyWeights[f.id] ?? DIMENSION_DEFAULT_WEIGHT);
  const relics: Expedition['loot']['relics'] = [];
  const stones: string[] = [];
  for (let i = 0; i < count; i++) {
    const tier = pickWeighted([0, 1, 2, 3], tw, rng);
    const family = pickWeighted(RELIC_FAMILIES, fw, rng).id;
    const rarity = rollRarity(tier, boost, rng);
    relics.push({ family, tier, rarity });
    if (rng() < STONE_DROP_CHANCE) {
      const st = STONES[Math.floor(rng() * STONES.length)];
      const stTier = Math.max(0, Math.min(STONE_TIERS - 1, tier - (rng() < 0.4 ? 1 : 0)));
      stones.push(stoneKey(st.id, stTier));
    }
  }
  let goldenBones = 0;
  if (rng() < GOLDEN_BONES_CHANCE) goldenBones = 1 + Math.floor(rng() * (2 + ci + 2 * li));
  return { relics, stones, goldenBones };
}

// ---------------------------------------------------------------- expeditions

const incomeRate = (state: GameState) => Math.max(computeStats(state).incomePerSec, MIN_SQUIRREL_CASH_RATE);

/** Treat Fuel in cash for an expedition length. */
export function fuelCost(state: GameState, length: ExpeditionLength): number {
  return incomeRate(state) * FUEL_INCOME_SEC[length];
}
export const fuelBones = (length: ExpeditionLength): number => FUEL_BONES[length];

export function launchExpedition(
  state: GameState,
  slot: number,
  crewId: string,
  dimensionId: string,
  length: ExpeditionLength,
  now: number,
  payWith: 'cash' | 'bones' = 'cash',
): ActionResult {
  const p = state.portal;
  if (!p || !p.built) return fail('Build the Portal Gate first.');
  if (!Number.isInteger(slot) || slot < 0 || slot >= p.slots.length) return fail('No such portal slot.');
  if (p.slots[slot]) return fail('That slot is busy.');
  const ci = crewIndex(crewId);
  if (ci < 0) return fail('Unknown crew.');
  if (!crewUnlocked(state, crewId)) return fail('That crew is not unlocked yet.');
  const dim = DIMENSIONS.find((d) => d.id === dimensionId);
  if (!dim) return fail('Unknown dimension.');
  if (ci < dim.minCrew) return fail(`Needs ${CREWS[dim.minCrew].name} or better.`);
  if (!EXPEDITION_LENGTHS.includes(length)) return fail('Unknown expedition length.');
  if (!Number.isFinite(now)) return fail('Invalid time.');
  if (payWith === 'bones') {
    if (state.goldenBones < FUEL_BONES[length]) return fail('Not enough Golden Bones.');
  } else if (state.cash < fuelCost(state, length)) {
    return fail('Not enough cash for Treat Fuel.');
  }
  // pay, roll (seeded: a reload cannot reroll), store
  if (payWith === 'bones') state.goldenBones -= FUEL_BONES[length];
  else state.cash -= fuelCost(state, length);
  const seq = p.launchSeq++;
  const rng = seededRng(hashString(`${seq}|${crewId}|${dimensionId}|${length}`));
  const loot = rollLoot(crewId, dimensionId, length, crewStars(state, crewId), craftXpBoost(state), rng);
  p.slots[slot] = {
    crewId,
    dimensionId,
    length,
    launchedAt: now,
    returnsAt: now + CREWS[ci].durationsSec[length] * 1000,
    loot,
  };
  return OK;
}

export const expeditionReady = (e: Expedition | null | undefined, now: number): boolean => !!e && now >= e.returnsAt;

export interface CollectResult extends ActionResult {
  relics?: Relic[];
  stones?: string[];
  goldenBones?: number;
}

/** Highest rarity in an expedition's loot (0 when empty). */
export function bestRarity(loot: Expedition['loot']): RelicRarity {
  let best = 0;
  for (const r of loot.relics) if (r.rarity > best) best = r.rarity;
  return best as RelicRarity;
}

export function collectExpedition(state: GameState, slot: number, now: number): CollectResult {
  const p = state.portal;
  if (!p) return fail('No portal.');
  const exp = p.slots[slot];
  if (!exp) return fail('Nothing to collect.');
  if (!(now >= exp.returnsAt)) return fail('The crew is still away.');
  const relics: Relic[] = exp.loot.relics.map((r) => ({
    id: p.nextRelicId++,
    family: r.family,
    tier: r.tier,
    rarity: r.rarity,
    stones: [],
  }));
  p.relics.push(...relics);
  for (const k of exp.loot.stones) p.stones[k] = (p.stones[k] ?? 0) + 1;
  state.goldenBones += exp.loot.goldenBones;
  const crew = (p.crews[exp.crewId] ??= { runs: 0 });
  crew.runs += 1;
  p.slots[slot] = null;
  return { ok: true, relics, stones: [...exp.loot.stones], goldenBones: exp.loot.goldenBones };
}

export function collectAll(state: GameState, now: number): CollectResult & { collected: number } {
  const out = { ok: false, relics: [] as Relic[], stones: [] as string[], goldenBones: 0, collected: 0 } as
    CollectResult & { collected: number; relics: Relic[]; stones: string[]; goldenBones: number };
  const p = state.portal;
  if (!p) return { ...fail('No portal.'), collected: 0 };
  for (let i = 0; i < p.slots.length; i++) {
    if (!expeditionReady(p.slots[i], now)) continue;
    const r = collectExpedition(state, i, now);
    if (!r.ok) continue;
    out.relics.push(...(r.relics ?? []));
    out.stones.push(...(r.stones ?? []));
    out.goldenBones += r.goldenBones ?? 0;
    out.collected++;
  }
  if (out.collected === 0) return { ...fail('No crews are back yet.'), collected: 0 };
  out.ok = true;
  return out;
}

// ---- expeditionReturned events (once per expedition object)
const notified = new WeakSet<Expedition>();

/** Emits expeditionReturned once per expedition whose returnsAt has passed. Called from the simulation step. */
export function portalStep(state: GameState, now: number, events: GameEvent[], emitReturns: boolean): void {
  const unlock = checkPortalUnlock(state);
  if (unlock) events.push(unlock);
  const p = state.portal;
  if (!p || !emitReturns) return;
  p.slots.forEach((e, slot) => {
    if (e && now >= e.returnsAt && !notified.has(e)) {
      notified.add(e);
      events.push({ type: 'expeditionReturned', slot, bestRarity: bestRarity(e.loot) });
    }
  });
}

// ---------------------------------------------------------------- relics: equip

export function findRelic(state: GameState, relicId: number): Relic | undefined {
  return state.portal?.relics.find((r) => r.id === relicId);
}

export function isEquipped(state: GameState, relicId: number): boolean {
  return !!state.portal && state.portal.equipped.includes(relicId);
}

/** Equips a relic into a collar slot. Replaces the slot's occupant. Only one relic per family may be equipped. */
export function equipRelic(state: GameState, relicId: number, slotIndex: number): ActionResult {
  const p = state.portal;
  if (!p) return fail('No portal.');
  const relic = findRelic(state, relicId);
  if (!relic) return fail('Unknown relic.');
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= RELIC_EQUIP_SLOTS) return fail('No such collar slot.');
  for (let i = 0; i < p.equipped.length; i++) {
    if (i === slotIndex || p.equipped[i] === null) continue;
    const other = findRelic(state, p.equipped[i] as number);
    if (p.equipped[i] === relicId) continue; // moved below
    if (other && other.family === relic.family) return fail('A relic of that family is already equipped.');
  }
  const prev = p.equipped.indexOf(relicId);
  if (prev >= 0) p.equipped[prev] = null;
  p.equipped[slotIndex] = relicId;
  return OK;
}

export function unequipRelic(state: GameState, slotIndex: number): ActionResult {
  const p = state.portal;
  if (!p) return fail('No portal.');
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= RELIC_EQUIP_SLOTS) return fail('No such collar slot.');
  if (p.equipped[slotIndex] === null) return fail('Nothing equipped there.');
  p.equipped[slotIndex] = null;
  return OK;
}

// ---------------------------------------------------------------- stones

export function socketCapacity(relic: Pick<Relic, 'rarity'>): number {
  return SOCKETS_BY_RARITY[relic.rarity] ?? 0;
}

function addStone(p: PortalState, key: string, n = 1): void {
  p.stones[key] = (p.stones[key] ?? 0) + n;
}

export function socketStone(state: GameState, relicId: number, key: string): ActionResult {
  const p = state.portal;
  if (!p) return fail('No portal.');
  const relic = findRelic(state, relicId);
  if (!relic) return fail('Unknown relic.');
  if (!isStoneKey(key)) return fail('Unknown stone.');
  if ((p.stones[key] ?? 0) < 1) return fail('You do not have that stone.');
  if (relic.stones.length >= socketCapacity(relic)) {
    return fail(socketCapacity(relic) === 0 ? 'Common relics have no sockets.' : 'No free sockets.');
  }
  p.stones[key] -= 1;
  if (p.stones[key] <= 0) delete p.stones[key];
  relic.stones.push(key);
  return OK;
}

/** Removes the stone at `index` from a relic and returns it to the inventory. */
export function unsocketStone(state: GameState, relicId: number, index: number): ActionResult {
  const p = state.portal;
  if (!p) return fail('No portal.');
  const relic = findRelic(state, relicId);
  if (!relic) return fail('Unknown relic.');
  if (!Number.isInteger(index) || index < 0 || index >= relic.stones.length) return fail('No stone there.');
  const [key] = relic.stones.splice(index, 1);
  addStone(p, key);
  return OK;
}

/** 3 stones of tier N -> 1 of tier N+1 (same stone type). */
export function craftStone(state: GameState, stoneId: string, tier: number): ActionResult & { stone?: string } {
  const p = state.portal;
  if (!p) return fail('No portal.');
  if (!STONES.some((s) => s.id === stoneId)) return fail('Unknown stone.');
  if (!Number.isInteger(tier) || tier < 0 || tier >= STONE_TIERS - 1) return fail('That stone cannot be upgraded.');
  const from = stoneKey(stoneId, tier);
  if ((p.stones[from] ?? 0) < STONE_CRAFT_COUNT) return fail(`Needs ${STONE_CRAFT_COUNT} stones.`);
  p.stones[from] -= STONE_CRAFT_COUNT;
  if (p.stones[from] <= 0) delete p.stones[from];
  const to = stoneKey(stoneId, tier + 1);
  addStone(p, to);
  return { ok: true, stone: to };
}

// ---------------------------------------------------------------- crafting + recycling

/** Cash fee to craft a relic of source tier `tier` (0..2) into the next tier. */
export function craftCost(state: GameState, tier: number): number {
  return incomeRate(state) * (CRAFT_INCOME_SEC[tier] ?? Infinity);
}

/** Unequipped relics of a family/tier, lowest rarity first. */
export function craftableRelics(state: GameState, familyId: string, tier: number): Relic[] {
  const p = state.portal;
  if (!p) return [];
  return p.relics
    .filter((r) => r.family === familyId && r.tier === tier && !p.equipped.includes(r.id))
    .sort((a, b) => a.rarity - b.rarity || a.id - b.id);
}

export function craftRelic(
  state: GameState,
  familyId: string,
  tier: number,
  rng?: Rng,
): ActionResult & { relic?: Relic } {
  const p = state.portal;
  if (!p) return fail('No portal.');
  if (!familyDef(familyId)) return fail('Unknown relic family.');
  if (!Number.isInteger(tier) || tier < 0 || tier >= RELIC_TIERS - 1) return fail('That relic is already top tier.');
  const pool = craftableRelics(state, familyId, tier);
  if (pool.length < CRAFT_COUNT) return fail(`Needs ${CRAFT_COUNT} unequipped relics of that tier.`);
  const cost = craftCost(state, tier);
  if (state.cash < cost) return fail('Not enough cash.');
  const roller = rng ?? seededRng(hashString(`craft|${p.nextRelicId}|${familyId}|${tier}|${p.craftXp}`));
  state.cash -= cost;
  const used = pool.slice(0, CRAFT_COUNT);
  for (const r of used) for (const k of r.stones) addStone(p, k);
  const ids = new Set(used.map((r) => r.id));
  p.relics = p.relics.filter((r) => !ids.has(r.id));
  const rarity = rollRarity(tier + 1, craftXpBoost(state), roller);
  const relic: Relic = { id: p.nextRelicId++, family: familyId, tier: tier + 1, rarity, stones: [] };
  p.relics.push(relic);
  p.craftXp += CRAFT_XP[tier] ?? 1;
  return { ok: true, relic };
}

export function recycleValue(relic: Pick<Relic, 'tier' | 'rarity'>): number {
  return RECYCLE_BONES[relic.tier]?.[relic.rarity] ?? 0;
}

export function recycleRelic(state: GameState, relicId: number): ActionResult & { goldenBones?: number } {
  const p = state.portal;
  if (!p) return fail('No portal.');
  const relic = findRelic(state, relicId);
  if (!relic) return fail('Unknown relic.');
  if (p.equipped.includes(relicId)) return fail('Unequip the relic first.');
  const bones = recycleValue(relic);
  for (const k of relic.stones) addStone(p, k);
  p.relics = p.relics.filter((r) => r.id !== relicId);
  state.goldenBones += bones;
  return { ok: true, goldenBones: bones };
}

/** Best relic by (rarity, tier) for share text; null when none. */
export function bestRelic(state: GameState): Relic | null {
  const rs = state.portal?.relics ?? [];
  let best: Relic | null = null;
  for (const r of rs) if (!best || r.rarity > best.rarity || (r.rarity === best.rarity && r.tier > best.tier)) best = r;
  return best;
}

// ---------------------------------------------------------------- show mirroring

/** Read-only mirror for the Dog Show park: only equipped relics (+ their stones), no slots/inventory. */
export function mirrorPortal(home: GameState): PortalState | null {
  const p = home.portal;
  if (!p) return null;
  const equipped = p.equipped.map((id) => (id !== null && p.relics.some((r) => r.id === id) ? id : null));
  return {
    built: p.built,
    slots: new Array(p.slots.length).fill(null),
    crews: {},
    relics: p.relics.filter((r) => equipped.includes(r.id)).map((r) => ({ ...r, stones: [...r.stones] })),
    nextRelicId: p.nextRelicId,
    equipped,
    stones: {},
    craftXp: 0,
    launchSeq: 0,
  };
}
