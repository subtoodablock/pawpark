import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CREWS, DIMENSIONS, FINDS, PORTAL_BUILD_COST, PORTAL_SLOTS, RECYCLE_BONES, RELIC_FAMILIES, STONES,
  applyOfflineProgress, buildPortal, checkPortalUnlock, collectAll, collectExpedition, computeStats,
  costMultiplier, craftRelic, craftStone, crewProgress, crewStars, crewUnlocked, deserialize, equipRelic,
  fuelCost, launchExpedition, prestige, rarityOdds, recycleRelic, relicEffect, resetForPrestige,
  serialize, socketStone, statValue, stepSimulation, syncShowMeta, tick, unequipRelic, unsocketStone,
  upgradeFind, createInitialState,
} from '../src/core';
import type { GameState, Relic, RelicRarity } from '../src/core';
import { lockGates, newState, restoreGates, seeded } from './helpers';

const NOW = 5_000_000_000;
const H = 3600_000;

beforeAll(lockGates);
afterEach(() => undefined);

/** A state that qualifies for the portal, with the gate built and plenty of cash. */
function portalState(): GameState {
  const s = newState();
  s.findIndex = 3;
  s.highestFindIndex = 3;
  s.prestigeCount = 1;
  tick(s, 0.1, seeded(1));
  s.cash = 1e12;
  s.goldenBones = 100;
  expect(buildPortal(s).ok).toBe(true);
  return s;
}

function addRelic(s: GameState, family: string, tier: number, rarity: RelicRarity): Relic {
  const p = s.portal!;
  const r: Relic = { id: p.nextRelicId++, family, tier, rarity, stones: [] };
  p.relics.push(r);
  return r;
}

describe('portal unlock + build', () => {
  it('needs Rawhide era and one prestige; emits portalUnlocked once', () => {
    const s = newState();
    s.findIndex = 3;
    expect(checkPortalUnlock(s)).toBeNull();
    s.prestigeCount = 1;
    s.findIndex = 2;
    expect(tick(s, 0.1, seeded(1)).some((e) => e.type === 'portalUnlocked')).toBe(false);
    expect(s.portal).toBeNull();
    s.findIndex = 3;
    const ev = tick(s, 0.1, seeded(1));
    expect(ev.filter((e) => e.type === 'portalUnlocked')).toHaveLength(1);
    expect(s.portal).not.toBeNull();
    expect(s.portal!.built).toBe(false);
    expect(s.portal!.slots).toHaveLength(PORTAL_SLOTS);
    expect(tick(s, 0.1, seeded(1)).some((e) => e.type === 'portalUnlocked')).toBe(false);
  });

  it('buildPortal pays cash once', () => {
    const s = newState();
    expect(buildPortal(s).ok).toBe(false); // not unlocked
    s.findIndex = 3;
    s.prestigeCount = 1;
    tick(s, 0.1, seeded(1));
    s.cash = PORTAL_BUILD_COST - 1;
    expect(buildPortal(s).ok).toBe(false);
    s.cash = PORTAL_BUILD_COST + 5;
    expect(buildPortal(s).ok).toBe(true);
    expect(s.cash).toBe(5);
    expect(s.portal!.built).toBe(true);
    expect(buildPortal(s).ok).toBe(false);
  });
});

describe('data tables', () => {
  it('match the spec shape', () => {
    expect(CREWS).toHaveLength(6);
    expect(CREWS.map((c) => c.unlockRuns)).toEqual([0, 6, 10, 15, 20, 30]);
    expect(CREWS[0].durationsSec).toEqual({ short: 1800, standard: 10800, long: 43200 });
    expect(CREWS[5].durationsSec.long).toBe(48 * 3600);
    expect(DIMENSIONS).toHaveLength(8);
    expect(RELIC_FAMILIES).toHaveLength(10);
    for (const f of RELIC_FAMILIES) {
      expect(f.effect).toHaveLength(4);
      const flat = f.effect.flat();
      for (let i = 1; i < flat.length; i++) expect(flat[i]).toBeGreaterThanOrEqual(flat[i - 1]);
    }
    expect(RELIC_FAMILIES[0].effect[0][0]).toBe(0.05);
    expect(RELIC_FAMILIES[0].effect[3][3]).toBe(1.0);
    expect(STONES.every((st) => st.effect.length === 3)).toBe(true);
    for (const o of [0, 1, 2, 3]) expect(rarityOdds(o, 0).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(rarityOdds(0, 1)[3]).toBeGreaterThan(rarityOdds(0, 0)[3]);
  });
});

describe('expeditions', () => {
  it('validates launches', () => {
    const s = portalState();
    const p = s.portal!;
    expect(launchExpedition(newState(), 0, 'puppy_scouts', 'bacon_dimension', 'short', NOW).ok).toBe(false);
    expect(launchExpedition(s, 9, 'puppy_scouts', 'bacon_dimension', 'short', NOW).ok).toBe(false);
    expect(launchExpedition(s, 0, 'nope', 'bacon_dimension', 'short', NOW).ok).toBe(false);
    expect(launchExpedition(s, 0, 'fetch_squad', 'bacon_dimension', 'short', NOW).ok).toBe(false); // crew locked
    expect(launchExpedition(s, 0, 'puppy_scouts', 'nope', 'short', NOW).ok).toBe(false);
    expect(launchExpedition(s, 0, 'puppy_scouts', 'cat_universe', 'short', NOW).ok).toBe(false); // minCrew
    expect(launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'weird' as never, NOW).ok).toBe(false);
    expect(p.launchSeq).toBe(0);
    const cost = fuelCost(s, 'standard');
    const cashBefore = s.cash;
    const r = launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'standard', NOW);
    expect(r.ok).toBe(true);
    expect(s.cash).toBeCloseTo(cashBefore - cost);
    expect(p.slots[0]!.returnsAt).toBe(NOW + 3 * H);
    expect(p.launchSeq).toBe(1);
    expect(launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'short', NOW).ok).toBe(false); // busy
    s.cash = 0;
    expect(launchExpedition(s, 1, 'puppy_scouts', 'bacon_dimension', 'short', NOW).ok).toBe(false);
  });

  it('can pay with Golden Bones', () => {
    const s = portalState();
    s.cash = 0;
    s.goldenBones = 20;
    expect(launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'long', NOW, 'bones').ok).toBe(true);
    expect(s.goldenBones).toBeLessThan(20);
    s.goldenBones = 0;
    expect(launchExpedition(s, 1, 'puppy_scouts', 'bacon_dimension', 'long', NOW, 'bones').ok).toBe(false);
  });

  it('rolls loot deterministically from the launch sequence (no reroll by reload)', () => {
    const a = portalState();
    const b = portalState();
    launchExpedition(a, 0, 'puppy_scouts', 'bacon_dimension', 'long', NOW);
    launchExpedition(b, 0, 'puppy_scouts', 'bacon_dimension', 'long', NOW);
    expect(a.portal!.slots[0]!.loot).toEqual(b.portal!.slots[0]!.loot);
    // a reload of the saved state keeps the same loot
    const c = deserialize(serialize(a))!;
    expect(c.portal!.slots[0]!.loot).toEqual(a.portal!.slots[0]!.loot);
    // a reload from before launching cannot reroll either: same seq -> same loot
    const d = portalState();
    launchExpedition(d, 2, 'puppy_scouts', 'bacon_dimension', 'long', NOW);
    expect(d.portal!.slots[2]!.loot).toEqual(a.portal!.slots[0]!.loot);
    // the next launch (seq+1) differs over a few tries
    const loots = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const s = portalState();
      s.portal!.launchSeq = i;
      launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'long', NOW);
      loots.add(JSON.stringify(s.portal!.slots[0]!.loot));
    }
    expect(loots.size).toBeGreaterThan(1);
  });

  it('loot respects capacity and dimension weights', () => {
    let bacon = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const s = portalState();
      s.portal!.launchSeq = i;
      launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'long', NOW);
      const loot = s.portal!.slots[0]!.loot;
      expect(loot.relics.length).toBeGreaterThanOrEqual(CREWS[0].capacity.long);
      for (const r of loot.relics) {
        total++;
        if (r.family === 'bacon_prism') bacon++;
        expect(r.tier).toBeGreaterThanOrEqual(0);
        expect(r.tier).toBeLessThanOrEqual(3);
      }
    }
    expect(bacon / total).toBeGreaterThan(0.3);
  });

  it('completes by wall-clock even offline; collect only when back', () => {
    const s = portalState();
    s.lastSaved = NOW;
    launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'short', NOW);
    expect(collectExpedition(s, 0, NOW + 1000).ok).toBe(false);
    expect(collectExpedition(s, 1, NOW + 99 * H).ok).toBe(false); // empty slot
    applyOfflineProgress(s, NOW + 2 * H);
    expect(s.portal!.slots[0]).not.toBeNull(); // waits in the slot
    const r = collectExpedition(s, 0, NOW + 2 * H);
    expect(r.ok).toBe(true);
    expect(r.relics!.length).toBeGreaterThan(0);
    expect(s.portal!.slots[0]).toBeNull();
  });

  it('emits expeditionReturned once per returned expedition', () => {
    const s = portalState();
    launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'short', NOW);
    launchExpedition(s, 1, 'puppy_scouts', 'bacon_dimension', 'long', NOW);
    const count = (now: number, offline = false) =>
      stepSimulation(s, 1, seeded(1), { offline, now }).filter((e) => e.type === 'expeditionReturned');
    expect(count(NOW + 1000)).toHaveLength(0);
    expect(count(NOW + 2 * H, true)).toHaveLength(0); // offline steps do not consume the announcement
    const ev = count(NOW + 2 * H);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'expeditionReturned', slot: 0 });
    expect(count(NOW + 3 * H)).toHaveLength(0);
    expect(count(NOW + 13 * H)).toHaveLength(1);
  });

  it('collect adds relics with ids, stones, bones and crew runs; collectAll takes all ready', () => {
    const s = portalState();
    launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'short', NOW);
    launchExpedition(s, 1, 'puppy_scouts', 'squeakopolis', 'standard', NOW);
    launchExpedition(s, 2, 'puppy_scouts', 'squeakopolis', 'long', NOW);
    const p = s.portal!;
    const expected = p.slots.slice(0, 2).reduce((n, e) => n + e!.loot.relics.length, 0);
    expect(collectAll(s, NOW + 1000).ok).toBe(false);
    const bonesBefore = s.goldenBones;
    const r = collectAll(s, NOW + 4 * H);
    expect(r.ok).toBe(true);
    expect(r.collected).toBe(2);
    expect(r.relics).toHaveLength(expected);
    expect(p.relics).toHaveLength(expected);
    expect(new Set(p.relics.map((x) => x.id)).size).toBe(expected);
    expect(p.crews.puppy_scouts.runs).toBe(2);
    expect(s.goldenBones).toBe(bonesBefore + r.goldenBones!);
    expect(p.slots[2]).not.toBeNull();
    expect(Object.values(p.stones).reduce((a, b) => a + b, 0)).toBe(r.stones!.length);
  });
});

describe('crews', () => {
  it('unlock thresholds and stars', () => {
    const s = portalState();
    const p = s.portal!;
    expect(crewUnlocked(s, 'puppy_scouts')).toBe(true);
    expect(crewUnlocked(s, 'fetch_squad')).toBe(false);
    p.crews.puppy_scouts.runs = 5;
    expect(crewUnlocked(s, 'fetch_squad')).toBe(false);
    p.crews.puppy_scouts.runs = 6;
    expect(crewUnlocked(s, 'fetch_squad')).toBe(true);
    expect(crewUnlocked(s, 'rescue_rangers')).toBe(false);
    p.crews.fetch_squad.runs = 10;
    expect(crewUnlocked(s, 'rescue_rangers')).toBe(true);
    expect(crewUnlocked(s, 'bogus')).toBe(false);
    expect(crewStars(s, 'puppy_scouts')).toBe(CREWS[0].starRuns.filter((r) => r <= 6).length);
    p.crews.puppy_scouts.runs = 1000;
    expect(crewStars(s, 'puppy_scouts')).toBe(CREWS[0].starRuns.length);
    const prog = crewProgress(s, 'infinity_pack')!;
    expect(prog.unlocked).toBe(false);
    expect(prog.runsToUnlock).toBe(30);
    // a higher crew can now launch into a minCrew-1 dimension
    expect(launchExpedition(s, 0, 'fetch_squad', 'tennis_ball_nebula', 'short', NOW).ok).toBe(true);
  });

  it('stars increase capacity', () => {
    const lootCount = (runs: number) => {
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const s = portalState();
        s.portal!.crews.puppy_scouts.runs = runs;
        s.portal!.launchSeq = i;
        launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'long', NOW);
        n += s.portal!.slots[0]!.loot.relics.length;
      }
      return n;
    };
    expect(lootCount(100)).toBeGreaterThan(lootCount(0));
  });
});

describe('equip + stats', () => {
  it('mult stat relic multiplies, add stat relic adds, unequip reverts', () => {
    const s = portalState();
    const base = statValue(s, 'layRate');
    const baseOff = statValue(s, 'offlineHours');
    const prism = addRelic(s, 'bacon_prism', 2, 2);
    const collar = addRelic(s, 'timefold_collar', 1, 1);
    expect(equipRelic(s, prism.id, 0).ok).toBe(true);
    expect(equipRelic(s, collar.id, 1).ok).toBe(true);
    expect(statValue(s, 'layRate')).toBeCloseTo(base * (1 + relicEffect(prism)));
    expect(statValue(s, 'offlineHours')).toBeCloseTo(baseOff + relicEffect(collar));
    expect(computeStats(s).offlineCapSec).toBeGreaterThan(0);
    expect(unequipRelic(s, 0).ok).toBe(true);
    expect(statValue(s, 'layRate')).toBe(base);
    expect(unequipRelic(s, 0).ok).toBe(false);
  });

  it('discount relic reduces research cost multiplier', () => {
    const s = portalState();
    const before = costMultiplier(s, 'researchDiscount');
    const bowl = addRelic(s, 'golden_bowl', 3, 3);
    equipRelic(s, bowl.id, 2);
    expect(costMultiplier(s, 'researchDiscount')).toBeCloseTo(before - 0.2);
  });

  it('allows one relic per family, 4 slots, moves, replaces', () => {
    const s = portalState();
    const a = addRelic(s, 'bacon_prism', 0, 0);
    const b = addRelic(s, 'bacon_prism', 1, 0);
    const c = addRelic(s, 'squeaky_orb', 0, 0);
    expect(equipRelic(s, a.id, 0).ok).toBe(true);
    expect(equipRelic(s, b.id, 1).ok).toBe(false); // same family elsewhere
    expect(equipRelic(s, b.id, 0).ok).toBe(true); // replacing the slot is fine
    expect(s.portal!.equipped[0]).toBe(b.id);
    expect(equipRelic(s, c.id, 1).ok).toBe(true);
    expect(equipRelic(s, c.id, 3).ok).toBe(true); // moves
    expect(s.portal!.equipped).toEqual([b.id, null, null, c.id]);
    expect(equipRelic(s, c.id, 4).ok).toBe(false);
    expect(equipRelic(s, 9999, 0).ok).toBe(false);
  });

  it('applies in the Dog Show park via meta sync', () => {
    const s = portalState();
    const prism = addRelic(s, 'bacon_prism', 3, 3);
    equipRelic(s, prism.id, 0);
    const park = createInitialState(NOW);
    syncShowMeta(s, park);
    expect(statValue(park, 'layRate')).toBeCloseTo(2);
    expect(park.portal!.relics).toHaveLength(1);
  });
});

describe('stones', () => {
  it('sockets by rarity, apply their stat, and return on unsocket', () => {
    const s = portalState();
    const p = s.portal!;
    const common = addRelic(s, 'bacon_prism', 0, 0);
    const rare = addRelic(s, 'squeaky_orb', 0, 1);
    const epic = addRelic(s, 'kennel_key', 0, 2);
    const leg = addRelic(s, 'rescue_beacon', 0, 3);
    p.stones = { 'lay_shard:2': 6 };
    expect(socketStone(s, common.id, 'lay_shard:2').ok).toBe(false);
    expect(socketStone(s, rare.id, 'lay_shard:2').ok).toBe(true);
    expect(socketStone(s, rare.id, 'lay_shard:2').ok).toBe(false); // full
    expect(socketStone(s, epic.id, 'lay_shard:2').ok).toBe(true);
    expect(socketStone(s, epic.id, 'lay_shard:2').ok).toBe(true);
    expect(socketStone(s, epic.id, 'lay_shard:2').ok).toBe(false);
    expect(socketStone(s, leg.id, 'lay_shard:2').ok).toBe(true);
    expect(socketStone(s, leg.id, 'lay_shard:2').ok).toBe(true);
    expect(socketStone(s, leg.id, 'lay_shard:2').ok).toBe(true); // 3 sockets
    expect(socketStone(s, leg.id, 'lay_shard:2').ok).toBe(false); // full / none left
    expect(socketStone(s, leg.id, 'bogus:1').ok).toBe(false);
    expect(p.stones['lay_shard:2']).toBeUndefined();
    // equipped relics' stones apply (rare squeaky orb has 1 layRate stone)
    equipRelic(s, rare.id, 0);
    const equippedEffect = relicEffect(rare);
    expect(statValue(s, 'findValue')).toBeCloseTo(1 + equippedEffect);
    expect(statValue(s, 'layRate')).toBeCloseTo(1.05);
    expect(unsocketStone(s, rare.id, 0).ok).toBe(true);
    expect(p.stones['lay_shard:2']).toBe(1);
    expect(statValue(s, 'layRate')).toBe(1);
    expect(unsocketStone(s, rare.id, 0).ok).toBe(false);
  });

  it('crafts 3 of tier N into 1 of tier N+1', () => {
    const s = portalState();
    s.portal!.stones = { 'lay_shard:0': 7 };
    expect(craftStone(s, 'lay_shard', 0).ok).toBe(true);
    expect(craftStone(s, 'lay_shard', 0).ok).toBe(true);
    expect(craftStone(s, 'lay_shard', 0).ok).toBe(false);
    expect(s.portal!.stones).toEqual({ 'lay_shard:0': 1, 'lay_shard:1': 2 });
    expect(craftStone(s, 'lay_shard', 2).ok).toBe(false);
  });
});

describe('crafting + recycling', () => {
  it('consumes the 3 lowest-rarity unequipped relics, charges cash, raises tier and XP', () => {
    const s = portalState();
    const p = s.portal!;
    const keep = addRelic(s, 'bacon_prism', 0, 3);
    const eq = addRelic(s, 'bacon_prism', 0, 0);
    equipRelic(s, eq.id, 0);
    const c1 = addRelic(s, 'bacon_prism', 0, 0);
    const c2 = addRelic(s, 'bacon_prism', 0, 1);
    const c3 = addRelic(s, 'bacon_prism', 0, 1);
    addRelic(s, 'squeaky_orb', 0, 0);
    expect(craftRelic(s, 'bacon_prism', 0, seeded(1)).ok).toBe(true);
    const ids = p.relics.map((r) => r.id);
    expect(ids).toContain(keep.id);
    expect(ids).toContain(eq.id);
    // lowest three unequipped: c1, c2, c3 (the Legendary stays)
    for (const c of [c1, c2, c3]) expect(ids).not.toContain(c.id);
    const out = p.relics[p.relics.length - 1];
    expect(out.tier).toBe(1);
    expect(out.family).toBe('bacon_prism');
    expect(p.craftXp).toBeGreaterThan(0);
  });

  it('fails without enough relics, cash, or at top tier; returns stones from consumed relics', () => {
    const s = portalState();
    const p = s.portal!;
    addRelic(s, 'bacon_prism', 0, 0);
    addRelic(s, 'bacon_prism', 0, 0);
    expect(craftRelic(s, 'bacon_prism', 0).ok).toBe(false);
    const third = addRelic(s, 'bacon_prism', 0, 1);
    third.stones = ['lay_shard:1'];
    s.cash = 0;
    expect(craftRelic(s, 'bacon_prism', 0).ok).toBe(false);
    s.cash = 1e12;
    const cash = s.cash;
    const r = craftRelic(s, 'bacon_prism', 0);
    expect(r.ok).toBe(true);
    expect(s.cash).toBeLessThan(cash);
    expect(p.stones['lay_shard:1']).toBe(1);
    expect(craftRelic(s, 'bacon_prism', 3).ok).toBe(false);
    expect(craftRelic(s, 'nope', 0).ok).toBe(false);
  });

  it('rolls the new rarity from the rng and craftXp improves odds', () => {
    const lo = portalState();
    for (let i = 0; i < 3; i++) addRelic(lo, 'bacon_prism', 0, 0);
    expect(craftRelic(lo, 'bacon_prism', 0, () => 0).relic!.rarity).toBe(0);
    const hi = portalState();
    for (let i = 0; i < 3; i++) addRelic(hi, 'bacon_prism', 0, 0);
    expect(craftRelic(hi, 'bacon_prism', 0, () => 0.9999).relic!.rarity).toBe(3);
    expect(rarityOdds(1, 1.5)[3]).toBeGreaterThan(rarityOdds(1, 0)[3]);
  });

  it('recycles for Golden Bones by tier x rarity, never while equipped', () => {
    const s = portalState();
    const r = addRelic(s, 'bacon_prism', 2, 3);
    equipRelic(s, r.id, 0);
    expect(recycleRelic(s, r.id).ok).toBe(false);
    unequipRelic(s, 0);
    r.stones = ['lay_shard:0'];
    const before = s.goldenBones;
    const res = recycleRelic(s, r.id);
    expect(res.ok).toBe(true);
    expect(res.goldenBones).toBe(RECYCLE_BONES[2][3]);
    expect(s.goldenBones).toBe(before + RECYCLE_BONES[2][3]);
    expect(s.portal!.relics.find((x) => x.id === r.id)).toBeUndefined();
    expect(s.portal!.stones['lay_shard:0']).toBe(1);
    expect(recycleRelic(s, r.id).ok).toBe(false);
  });
});

describe('persistence', () => {
  it('survives prestige and era upgrades', () => {
    const s = portalState();
    const r = addRelic(s, 'bacon_prism', 1, 1);
    equipRelic(s, r.id, 0);
    launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'short', NOW);
    const snapshot = JSON.stringify(s.portal);
    s.runEarnings = 1e15;
    expect(prestige(s).ok).toBe(true);
    expect(JSON.stringify(s.portal)).toBe(snapshot);
    resetForPrestige(s);
    expect(JSON.stringify(s.portal)).toBe(snapshot);
    restoreGates();
    s.findIndex = 0;
    s.highestFindIndex = 0;
    s.cash = 1e12;
    const bigState = s;
    bigState.pups = 1e6;
    // force an era upgrade by relaxing the gate for the next find
    const saved = FINDS[1].unlockParkValue;
    FINDS[1].unlockParkValue = 0;
    expect(upgradeFind(bigState).ok).toBe(true);
    FINDS[1].unlockParkValue = saved;
    lockGates();
    expect(JSON.stringify(s.portal)).toBe(snapshot);
  });
});

describe('save v6', () => {
  it('round-trips a portal in use', () => {
    const s = portalState();
    const r = addRelic(s, 'bacon_prism', 1, 2);
    r.stones = ['lay_shard:1'];
    equipRelic(s, r.id, 1);
    s.portal!.stones = { 'find_shard:0': 2 };
    s.portal!.craftXp = 4;
    launchExpedition(s, 0, 'puppy_scouts', 'bacon_dimension', 'short', NOW);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('migrates v5 (portal null; unlocks on the next step if qualifying)', () => {
    const s = newState();
    s.findIndex = 4;
    s.prestigeCount = 2;
    const raw = JSON.parse(serialize(s));
    raw.version = 5;
    delete raw.portal;
    const g = deserialize(JSON.stringify(raw))!;
    expect(g.version).toBe(6);
    expect(g.portal).toBeNull();
    const ev = tick(g, 0.1, seeded(1));
    expect(ev.some((e) => e.type === 'portalUnlocked')).toBe(true);
    expect(g.portal!.built).toBe(false);
  });

  it('sanitizes a damaged portal', () => {
    const s = portalState();
    const r1 = addRelic(s, 'bacon_prism', 1, 1);
    addRelic(s, 'bacon_prism', 0, 0);
    const raw = JSON.parse(serialize(s));
    const p = raw.portal;
    p.relics.push({ id: 50, family: 'ghost', tier: 1, rarity: 1, stones: [] });
    p.relics.push({ id: 51, family: 'golden_bowl', tier: 99, rarity: 77, stones: ['lay_shard:1', 'x:9'] });
    p.relics.push({ id: r1.id, family: 'lucky_acorn', tier: 0, rarity: 0, stones: [] }); // duplicate id
    p.equipped = [r1.id, r1.id, 50, 51, 123];
    p.slots[0] = { crewId: 'bad', dimensionId: 'bacon_dimension', length: 'short', launchedAt: 1, returnsAt: 2, loot: {} };
    p.slots[1] = { crewId: 'puppy_scouts', dimensionId: 'bacon_dimension', length: 'short', launchedAt: 1, returnsAt: 2,
      loot: { relics: [{ family: 'bacon_prism', tier: 9, rarity: -3 }, { family: 'nope' }], stones: ['lay_shard:0', 'zzz'], goldenBones: -4 } };
    p.stones = { 'lay_shard:0': 2.7, 'bad:0': 3, 'lay_shard:7': 1 };
    p.craftXp = 'x';
    const g = deserialize(JSON.stringify(raw))!;
    const gp = g.portal!;
    expect(gp.relics.map((r) => r.family)).not.toContain('ghost');
    const weird = gp.relics.find((r) => r.id === 51)!;
    expect(weird.tier).toBe(3);
    expect(weird.rarity).toBe(3);
    expect(weird.stones).toEqual(['lay_shard:1']);
    expect(gp.equipped).toHaveLength(4);
    expect(gp.equipped.filter((x) => x !== null)).toEqual([r1.id, 51]);
    expect(gp.slots[0]).toBeNull();
    expect(gp.slots[1]!.loot.relics).toEqual([{ family: 'bacon_prism', tier: 3, rarity: 0 }]);
    expect(gp.slots[1]!.loot.stones).toEqual(['lay_shard:0']);
    expect(gp.slots[1]!.loot.goldenBones).toBe(0);
    expect(gp.stones).toEqual({ 'lay_shard:0': 2 });
    expect(gp.craftXp).toBe(0);
    expect(gp.nextRelicId).toBeGreaterThan(51);
    expect(deserialize(JSON.stringify({ ...raw, portal: 'junk' }))!.portal).toBeNull();
  });
});
