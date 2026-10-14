import { describe, expect, it } from 'vitest';
import {
  applyOfflineProgress,
  AUTOMATION_MAX_BUYS,
  AUTO_PRESTIGE_MIN_RUN_SEC,
  FINDS,
  MAIL_INTERVAL_SEC,
  PRESTIGE_DIVISOR,
  PRESTIGE_EXPONENT,
  BASE_MAIL_CAPACITY,
  SQUIRREL_INTERVAL_MAX,
  SQUIRREL_INTERVAL_MIN,
  SAVE_KEY,
  buyAcademy,
  computeStats,
  deserialize,
  openAllMail,
  runAutomation,
  setAutoPrestigeThreshold,
  setAutomation,
  stepSimulation,
  tick,
} from '../src/core';
import type { GameEvent, GameState } from '../src/core';
import { constRng, newState, seeded } from './helpers';

function quiet(s: GameState): GameState {
  s.squirrelTimer = 1e9;
  s.mailTimer = 1e9;
  return s;
}

function withAutomation(keys: Partial<GameState['automation']>, academy: Record<string, number> = {}): GameState {
  const s = quiet(newState());
  s.academy = {
    foreman_pup: 1,
    head_trainer: 1,
    volunteer_walkers: 0,
    retirement_planner: 1,
    ...academy,
  };
  s.automation = { ...s.automation, build: false, training: false, whistle: false, prestige: false, ...keys };
  return s;
}

const trainingLevels = (s: GameState) => Object.values(s.training).reduce((a, b) => a + b, 0);

describe('setAutomation / unlocks', () => {
  it('rejects locked keys and bad input, allows find', () => {
    const s = newState();
    expect(setAutomation(s, 'build', true).ok).toBe(false);
    expect(setAutomation(s, 'prestige', true).ok).toBe(false);
    expect(setAutomation(s, 'nope' as never, true).ok).toBe(false);
    expect(setAutomation(s, 'find', 'yes' as never).ok).toBe(false);
    expect(setAutomation(s, 'find', false).ok).toBe(true);
    expect(s.automation.find).toBe(false);
    expect(computeStats(s).automationUnlocked).toEqual({
      find: true, build: false, training: false, whistle: false, prestige: false,
    });
  });

  it('buying an automation item unlocks and enables it', () => {
    const s = newState();
    s.goldenBones = 1000;
    expect(buyAcademy(s, 'foreman_pup').ok).toBe(true);
    expect(s.automation.build).toBe(true);
    expect(computeStats(s).automationUnlocked.build).toBe(true);
    expect(setAutomation(s, 'build', false).ok).toBe(true);
    expect(setAutomation(s, 'build', true).ok).toBe(true);
    buyAcademy(s, 'volunteer_walkers');
    expect(s.automation.whistle).toBe(true);
    expect(computeStats(s).autoWhistleFrac).toBeCloseTo(0.2, 10);
    for (let i = 0; i < 10; i++) buyAcademy(s, 'volunteer_walkers');
    expect(computeStats(s).autoWhistleFrac).toBe(1);
  });

  it('validates the prestige threshold', () => {
    const s = newState();
    expect(setAutoPrestigeThreshold(s, 0.25).ok).toBe(true);
    expect(s.automation.prestigeThreshold).toBe(0.25);
    expect(setAutoPrestigeThreshold(s, 3).ok).toBe(false);
    expect(s.automation.prestigeThreshold).toBe(0.25);
  });
});

describe('runAutomation: find', () => {
  function rich(paws: number): GameState {
    const s = quiet(newState());
    s.pups = 100;
    s.kennels = [3, 3, null, null];
    s.vehicles[0] = 3;
    s.spiritPaws = paws;
    return s;
  }
  it('upgrades while parkValue allows, once for first-time rewards', () => {
    const s = rich(30);
    const ev = runAutomation(s);
    expect(ev).toEqual([{ type: 'findUnlocked', findIndex: 1, auto: true, firstTime: true }]);
    expect(s.findIndex).toBe(1);
    expect(s.goldenBones).toBe(10 + FINDS[1].unlockReward);
  });
  it('loops over several finds', () => {
    const s = rich(1000);
    const ev = runAutomation(s);
    expect(ev.filter((e) => e.type === 'findUnlocked')).toHaveLength(2);
    expect(s.findIndex).toBe(2);
  });
  it('does nothing when disabled', () => {
    const s = rich(1000);
    s.automation.find = false;
    expect(runAutomation(s)).toEqual([]);
    expect(s.findIndex).toBe(0);
  });
  it('is not firstTime when the find was already reached', () => {
    const s = rich(30);
    s.highestFindIndex = 3;
    const ev = runAutomation(s);
    expect(ev[0]).toMatchObject({ findIndex: 1, firstTime: false });
    expect(s.goldenBones).toBe(10);
  });
});

describe('runAutomation: purchases', () => {
  it('does nothing for locked keys even if toggled on', () => {
    const s = quiet(newState());
    s.automation.build = true;
    s.automation.training = true;
    s.cash = 1e6;
    runAutomation(s);
    expect(s.cash).toBe(1e6);
  });

  it('buys the priority bucket first (ship bottleneck: vehicles before cheaper kennels)', () => {
    const s = withAutomation({ build: true });
    s.kennels = [0, null, null, null]; // empty slots cost 50
    s.pups = 250;
    s.vehicles = [0, 0, 0, 0, ...new Array(8).fill(null)];
    expect(computeStats(s).bottleneck).toBe('ship');
    s.cash = 1520;
    runAutomation(s);
    expect(s.vehicles.slice(0, 4).filter((v) => v === 1)).toHaveLength(1);
    expect(s.kennels).toEqual([0, null, null, null]);
    expect(s.cash).toBeCloseTo(20, 8);
  });

  it('kennel bucket when pups fill the kennels', () => {
    const s = withAutomation({ build: true, training: true });
    s.kennels = [0, 0, 0, 0];
    s.vehicles = [5, 5, 5, 5, ...new Array(8).fill(null)];
    s.pups = 990;
    expect(computeStats(s).bottleneck).toBe('dig');
    s.cash = 620; // kennel 600 affordable; comfy_beds (25) is cheaper but off-bucket
    runAutomation(s);
    expect(s.kennels.filter((k) => k === 1)).toHaveLength(1);
  });

  it('splurges only on items <= 10% of the cheapest priority item', () => {
    const s = withAutomation({ build: true, training: true });
    s.kennels = [0, 0, 0, 0];
    s.vehicles = [5, 5, 5, 5, ...new Array(8).fill(null)];
    s.pups = 990; // kennel bucket, cheapest 600 -> splurge limit 60
    s.cash = 20;
    runAutomation(s);
    expect(s.cash).toBe(20); // nothing affordable
    expect(trainingLevels(s)).toBe(0);
    s.cash = 30;
    const buys = (() => {
      let n = 0;
      const before = trainingLevels(s);
      runAutomation(s);
      n = trainingLevels(s) - before;
      return n;
    })();
    expect(buys).toBe(1); // comfy_beds 25; next level (36) is unaffordable
    expect(s.training.comfy_beds).toBe(1);
    expect(s.cash).toBeCloseTo(5, 8);
  });

  it('does not splurge on items above the fraction', () => {
    const s = withAutomation({ build: true, training: true });
    s.kennels = [0, 0, 0, 0];
    s.vehicles = [5, 5, 5, 5, ...new Array(8).fill(null)];
    s.pups = 990;
    s.cash = 500; // under the 600 kennel; every training item costs > 60 except cheap ones
    s.training = { comfy_beds: 25, premium_kibble: 25, louder_whistle: 10, rescue_program: 10 };
    runAutomation(s);
    // only tier-1 maxed -> tier 2 unlock needs 15 levels, all unlocked now; their cost 1e4+ > 60
    expect(s.cash).toBe(500);
  });

  it('caps a pass at AUTOMATION_MAX_BUYS and only uses unlocked fleet slots', () => {
    const s = withAutomation({ build: true, training: true });
    s.cash = 1e30;
    const before = {
      kennels: s.kennels.map((k) => (k ?? -1) + 1).reduce((a, b) => a + b, 0),
      vehicles: s.vehicles.map((k) => (k ?? -1) + 1).reduce((a, b) => a + b, 0),
    };
    const ev = runAutomation(s);
    expect(ev).toEqual([]);
    const spent =
      trainingLevels(s) +
      (s.kennels.map((k) => (k ?? -1) + 1).reduce((a, b) => a + b, 0) - before.kennels) +
      (s.vehicles.map((k) => (k ?? -1) + 1).reduce((a, b) => a + b, 0) - before.vehicles);
    expect(spent).toBe(AUTOMATION_MAX_BUYS);
    expect(s.vehicles.slice(computeStats(s).fleetSlots).every((v) => v === null)).toBe(true);
  });

  it('respects max levels, locked tiers, and keeps buying through a stalled bucket', () => {
    const s = withAutomation({ training: true });
    s.cash = 1e30;
    runAutomation(s);
    // tier 2+ stays locked until 15 tier-1 levels exist; training never exceeds max level
    expect(s.training.comfy_beds ?? 0).toBeLessThanOrEqual(25);
    expect(trainingLevels(s)).toBe(AUTOMATION_MAX_BUYS);
    expect(s.kennels).toEqual([0, null, null, null]);
  });
});

describe('auto prestige', () => {
  const GAIN = Math.floor(1e5 ** PRESTIGE_EXPONENT);
  function ready(): GameState {
    const s = withAutomation({ prestige: true });
    s.runEarnings = PRESTIGE_DIVISOR * 1e5; // gain GAIN
    s.runTimeSec = AUTO_PRESTIGE_MIN_RUN_SEC;
    return s;
  }
  it('prestiges when gain meets the threshold and the run is old enough', () => {
    const s = ready();
    const ev = runAutomation(s);
    expect(ev).toContainEqual({ type: 'autoPrestige', gained: GAIN });
    expect(s.spiritPaws).toBe(GAIN);
    expect(s.prestigeCount).toBe(1);
    expect(s.runTimeSec).toBe(0);
    expect(s.automation.prestige).toBe(true);
  });
  it('waits for the minimum run time', () => {
    const s = ready();
    s.runTimeSec = AUTO_PRESTIGE_MIN_RUN_SEC - 1;
    expect(runAutomation(s)).toEqual([]);
    expect(s.prestigeCount).toBe(0);
  });
  it('requires gain >= threshold x spiritPaws', () => {
    const s = ready();
    s.spiritPaws = 4 * GAIN;
    s.automation.prestigeThreshold = 0.5; // needs 2 x GAIN
    expect(runAutomation(s)).toEqual([]);
    s.automation.prestigeThreshold = 0.1; // needs 0.4 x GAIN
    expect(runAutomation(s)).toContainEqual({ type: 'autoPrestige', gained: GAIN });
    expect(s.spiritPaws).toBe(5 * GAIN);
  });
  it('needs at least 1 paw of gain and the toggle on', () => {
    const s = ready();
    s.runEarnings = PRESTIGE_DIVISOR * 0.5;
    expect(runAutomation(s)).toEqual([]);
    const t = ready();
    t.automation.prestige = false;
    expect(runAutomation(t)).toEqual([]);
  });
});

describe('automation inside stepSimulation', () => {
  it('fires every AUTOMATION_INTERVAL_SEC online', () => {
    const s = withAutomation({ build: true });
    s.cash = 1e6;
    s.automationTimer = 2;
    tick(s, 1, constRng(0.5));
    expect(s.cash).toBeGreaterThan(9e5); // not yet
    tick(s, 1.5, constRng(0.5));
    expect(s.cash).toBeLessThan(1e6 - 100);
    expect(s.automationTimer).toBe(2);
  });
  it('fires once per call offline and reports purchases', () => {
    const s = withAutomation({ build: true });
    s.cash = 1e6;
    s.automationTimer = 1e9;
    stepSimulation(s, 60, constRng(0.5), { offline: true });
    expect(s.cash).toBeLessThan(1e6 - 100);
  });
  it('auto-whistle adopts at small dt, using the stock', () => {
    const s = withAutomation({ whistle: true }, { volunteer_walkers: 5 });
    s.kennels = [3, 3, 3, 3];
    s.adoptionStock = 50;
    for (let i = 0; i < 100; i++) tick(s, 0.1, constRng(0.5));
    expect(s.stats.totalTaps).toBe(0);
    expect(s.zoomies).toBe(0);
    const off = withAutomation({ whistle: false }, { volunteer_walkers: 5 });
    off.kennels = [3, 3, 3, 3];
    for (let i = 0; i < 100; i++) tick(off, 0.1, constRng(0.5));
    expect(s.pups - off.pups).toBeGreaterThanOrEqual(8);
    expect(s.pups - off.pups).toBeLessThanOrEqual(11);
  });
  it('tracks runTimeSec', () => {
    const s = quiet(newState());
    tick(s, 3, constRng(0.5));
    expect(s.runTimeSec).toBeCloseTo(3, 10);
  });
});

describe('mail', () => {
  it('openAllMail opens every letter', () => {
    const s = newState();
    s.mailCount = 3;
    const rs = openAllMail(s, constRng(0.1, 0.5, 0.6));
    expect(rs).toHaveLength(3);
    expect(s.mailCount).toBe(0);
    expect(s.stats.mailOpened).toBe(3);
    expect(openAllMail(s)).toEqual([]);
  });
  it('mail accumulates during a long offline stretch up to capacity', () => {
    const s = newState();
    s.academy = { bigger_mailbox: 2, bigger_jar: 20 };
    s.mailTimer = MAIL_INTERVAL_SEC;
    expect(48 * 3600 / MAIL_INTERVAL_SEC).toBeGreaterThan(BASE_MAIL_CAPACITY + 2);
    const r = applyOfflineProgress(s, s.lastSaved + 48 * 3600 * 1000)!;
    expect(r.mailWaiting).toBe(BASE_MAIL_CAPACITY + 2);
  });
});

describe('squirrel hound', () => {
  const sq = () => ({ id: 1, age: 6.5, lifetime: 7, reward: { kind: 'goldenBones', amount: 2 } as const });
  it('catches expiring squirrels online with the hound chance', () => {
    const s = quiet(newState());
    s.academy = { squirrel_hound: 5 }; // 50%
    s.squirrels = [sq()];
    const ev = tick(s, 1, constRng(0.1));
    expect(ev).toContainEqual({ type: 'squirrelHound', reward: { kind: 'goldenBones', amount: 2 } });
    expect(s.stats.squirrelsCaught).toBe(1);
    expect(s.goldenBones).toBe(12);
    expect(s.squirrels).toHaveLength(0);
  });
  it('lets the squirrel escape on a failed roll', () => {
    const s = quiet(newState());
    s.academy = { squirrel_hound: 5 };
    s.squirrels = [sq()];
    const ev = tick(s, 1, constRng(0.9));
    expect(ev.some((e) => e.type === 'squirrelHound')).toBe(false);
    expect(s.stats.squirrelsCaught).toBe(0);
    expect(s.squirrels).toHaveLength(0);
  });
  it('does not use the rng without a hound', () => {
    const s = quiet(newState());
    s.squirrels = [sq()];
    let calls = 0;
    tick(s, 1, () => (calls++, 0.1));
    expect(calls).toBe(0);
  });
  it('resolves squirrels immediately offline', () => {
    const full = newState();
    full.academy = { squirrel_hound: 20, bigger_jar: 20 }; // 100% hound, 48 h jar
    const expected = (48 * 3600) / ((SQUIRREL_INTERVAL_MIN + SQUIRREL_INTERVAL_MAX) / 2);
    const r = applyOfflineProgress(full, full.lastSaved + 48 * 3600 * 1000)!;
    expect(full.squirrels).toHaveLength(0);
    expect(r.squirrelsCaught).toBeGreaterThan(expected * 0.6);
    expect(r.squirrelsCaught).toBeLessThan(expected * 1.4);
    expect(full.stats.squirrelsCaught).toBe(r.squirrelsCaught);
    const none = newState();
    none.academy = { bigger_jar: 20 };
    const r0 = applyOfflineProgress(none, none.lastSaved + 48 * 3600 * 1000)!;
    expect(r0.squirrelsCaught).toBe(0);
    expect(none.squirrels).toHaveLength(0);
    expect(none.nextSquirrelId).toBeGreaterThan(expected * 0.6);
  });
  it('is deterministic with a seeded rng', () => {
    const run = () => {
      const s = newState();
      s.academy = { squirrel_hound: 5 };
      const rng = seeded(7);
      const events: GameEvent[] = [];
      for (let i = 0; i < 20; i++) events.push(...stepSimulation(s, 60, rng, { offline: true }));
      return [s.stats.squirrelsCaught, s.goldenBones, s.nextSquirrelId];
    };
    expect(run()).toEqual(run());
  });
});

describe('trophies v2', () => {
  function ev(s: GameState) {
    return tick(quiet(s), 0.1, constRng(0.5)).filter((e) => e.type === 'trophy');
  }
  it('awards lifetime earnings, prestige and find trophies once', () => {
    const s = newState();
    s.lifetimeEarnings = 1e9;
    s.prestigeCount = 1;
    s.highestFindIndex = 6;
    const e1 = ev(s);
    const ids = e1.map((e) => (e as { trophyId: string }).trophyId);
    expect(ids).toEqual(['cash_1m', 'cash_1b', 'park_1', 'find_fossil']);
    expect(s.legendCollars).toBe(0 + 1 + 0 + 1);
    expect(s.goldenBones).toBe(10 + 10 + 20 + 50);
    expect(ev(s)).toHaveLength(0);
  });
  it('find trophies compare against highestFindIndex, not the current find', () => {
    const s = newState();
    s.findIndex = 0;
    s.highestFindIndex = 9;
    ev(s);
    expect(s.trophies).toContain('find_relic');
    expect(s.trophies).not.toContain('find_legend');
  });
  it('emits endgame exactly once at the last find', () => {
    const s = quiet(newState());
    s.highestFindIndex = FINDS.length - 1;
    const e1 = tick(s, 0.1, constRng(0.5));
    expect(e1.filter((e) => e.type === 'endgame')).toHaveLength(1);
    expect(s.endgameReached).toBe(true);
    expect(s.trophies).toContain('find_legend');
    expect(tick(s, 0.1, constRng(0.5)).some((e) => e.type === 'endgame')).toBe(false);
  });
  it('reports endgame and trophies from offline', () => {
    const s = newState();
    s.highestFindIndex = FINDS.length - 1;
    const r = applyOfflineProgress(s, s.lastSaved + 60_000)!;
    expect(r.endgame).toBe(true);
    expect(r.trophies).toContain('find_legend');
  });
});

describe('long offline with the full Pack', () => {
  function pack(): GameState {
    const s = newState();
    s.academy = {
      foreman_pup: 1, head_trainer: 1, retirement_planner: 1, volunteer_walkers: 5,
      bigger_jar: 20, squirrel_hound: 20,
    };
    s.automation = { find: true, build: true, training: true, whistle: true, prestige: true, prestigeThreshold: 0.5 };
    s.cash = 1000;
    s.pups = 10;
    return s;
  }
  it('plays the game: buys, finds, prestiges, bones, squirrels, mail', () => {
    const s = pack();
    const t0 = performance.now();
    const r = applyOfflineProgress(s, s.lastSaved + 72 * 3600 * 1000)!;
    const ms = performance.now() - t0;
    expect(r.elapsedSec).toBe(72 * 3600);
    expect(r.simulatedSec).toBe(48 * 3600);
    expect(r.lostSec).toBe(24 * 3600);
    expect(r.purchases).toBeGreaterThan(20);
    expect(r.findsUnlocked.length).toBeGreaterThan(0);
    expect(r.prestiges).toBeGreaterThan(0);
    expect(r.prestiges).toBe(s.prestigeCount);
    expect(r.spiritPawsGained).toBe(s.spiritPaws);
    expect(r.goldenBonesGained).toBeGreaterThan(0);
    expect(r.squirrelsCaught).toBeGreaterThan(((48 * 3600) / SQUIRREL_INTERVAL_MAX) * 0.6);
    expect(r.mailWaiting).toBe(BASE_MAIL_CAPACITY);
    expect(r.earned).toBeGreaterThan(0);
    expect(r.earned).toBeCloseTo(s.lifetimeEarnings, 3);
    expect(r.trophies.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500);
  });
  it('is fast: 48h of offline well under 500 ms', () => {
    const s = pack();
    const t0 = performance.now();
    applyOfflineProgress(s, s.lastSaved + 48 * 3600 * 1000);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('save migration v1 -> v2', () => {
  it('migrates mailReady, automation, run timers and drops night_shift', () => {
    const v1 = {
      version: 1,
      cash: 55,
      mailReady: true,
      academy: { epic_digging: 2, night_shift: 3, foreman_pup: 1 },
      mailTimer: 12,
    };
    const g = deserialize(JSON.stringify(v1))!;
    expect(g.version).toBe(3);
    expect('mailReady' in g).toBe(false);
    expect(g.mailCount).toBe(1);
    expect(g.academy).toEqual({ epic_digging: 2, foreman_pup: 1 });
    expect(g.automation).toEqual({
      find: true, build: true, training: false, whistle: false, prestige: false, prestigeThreshold: 0.5,
    });
    expect(g.runTimeSec).toBe(0);
    expect(g.automationTimer).toBe(0);
    expect(g.endgameReached).toBe(false);
    expect(g.mailTimer).toBe(12);
    expect(g.cash).toBe(55);
    expect(deserialize(JSON.stringify({ version: 1, mailReady: false }))!.mailCount).toBe(0);
  });
  it('round-trips v2 and sanitizes automation', () => {
    const s = newState();
    s.mailCount = 2;
    s.runTimeSec = 123;
    s.academy = { foreman_pup: 1 };
    s.automation = { find: false, build: true, training: true, whistle: true, prestige: false, prestigeThreshold: 2 };
    const g = deserialize(JSON.stringify(s))!;
    expect(g.mailCount).toBe(2);
    expect(g.runTimeSec).toBe(123);
    // training/whistle are locked -> forced off
    expect(g.automation).toEqual({
      find: false, build: true, training: false, whistle: false, prestige: false, prestigeThreshold: 2,
    });
    const bad = deserialize(JSON.stringify({ ...s, automation: { prestigeThreshold: 7, build: 'x' } }))!;
    expect(bad.automation.prestigeThreshold).toBe(0.5);
    expect(bad.automation.find).toBe(true);
    expect(SAVE_KEY).toBe('pawpark.save.v1');
  });
  it('clamps mailCount to capacity', () => {
    expect(deserialize(JSON.stringify({ ...newState(), mailCount: 99 }))!.mailCount).toBe(BASE_MAIL_CAPACITY);
  });
});
