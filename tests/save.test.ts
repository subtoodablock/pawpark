import { describe, expect, it } from 'vitest';
import {
  clearSave, createInitialState, deserialize, exportSave, importSave, loadGame, saveGame,
  serialize, SAVE_KEY, KENNEL_SLOTS, MAX_FLEET_SLOTS, MAIL_INTERVAL_SEC, TRAINING,
} from '../src/core';
import { memStorage, newState } from './helpers';

describe('save', () => {
  it('round-trips through serialize/deserialize', () => {
    const s = newState();
    s.cash = 12345.678;
    s.kennels = [2, 1, null, 0];
    s.training = { comfy_beds: 7 };
    s.academy = { epic_digging: 2 };
    s.treats = [{ id: 'bacon_strip', remaining: 12 }];
    s.trophies = ['pack_10k'];
    s.squirrels = [{ id: 3, age: 1, lifetime: 7, reward: { kind: 'goldenBones', amount: 2 } }];
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('rejects garbage', () => {
    expect(deserialize('')).toBeNull();
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('[]')).toBeNull();
    expect(deserialize('42')).toBeNull();
    expect(deserialize('null')).toBeNull();
    expect(deserialize('{}')).toBeNull();
    expect(deserialize(JSON.stringify({ ...newState(), version: 6 }))).toBeNull();
    expect(deserialize('{"version":2,"mailCount":"x"}')).toBeNull();
    expect(deserialize('{"version":1,"cash":"lots"}')).toBeNull();
    expect(deserialize('{"version":1,"cash":null}')).toBeNull();
    expect(deserialize('{"version":1,"pups":1e999}')).toBeNull();
  });

  it('merges missing fields from defaults and fixes array lengths', () => {
    const g = deserialize(JSON.stringify({ version: 1, cash: 99, kennels: [1], vehicles: [2, 0, 1] }))!;
    expect(g.cash).toBe(99);
    expect(g.kennels).toHaveLength(KENNEL_SLOTS);
    expect(g.kennels).toEqual([1, null, null, null]);
    expect(g.vehicles).toHaveLength(MAX_FLEET_SLOTS);
    expect(g.vehicles.slice(0, 4)).toEqual([2, 0, 1, null]);
    expect(g.goldenBones).toBe(10);
    expect(g.stats.totalTaps).toBe(0);
    expect(g.mailTimer).toBe(MAIL_INTERVAL_SEC);
    const long = deserialize(JSON.stringify({ ...newState(), kennels: [0, 0, 0, 0, 0, 0] }))!;
    expect(long.kennels).toHaveLength(KENNEL_SLOTS);
  });

  it('sanitizes bad nested values', () => {
    const g = deserialize(JSON.stringify({
      version: 1,
      kennels: [999, -1, 'x', 0],
      training: { comfy_beds: 9999, bogus: 5, mud_wash: 'a' },
      treats: [{ id: 'nope', remaining: 5 }, { id: 'bacon_strip', remaining: 5 }],
      findIndex: 99,
    }))!;
    expect(g.kennels).toEqual([null, null, null, 0]);
    expect(g.training).toEqual({ comfy_beds: TRAINING.find((d) => d.id === 'comfy_beds')!.maxLevel });
    expect(g.treats).toHaveLength(1);
    expect(g.findIndex).toBe(12);
    expect(g.highestFindIndex).toBe(12);
  });

  it('saveGame/loadGame/clearSave use the storage and set lastSaved', () => {
    const st = memStorage();
    const s = newState();
    expect(loadGame(st)).toBeNull();
    saveGame(s, st, 5_555);
    expect(s.lastSaved).toBe(5_555);
    expect(st.getItem(SAVE_KEY)).toBeTruthy();
    expect(loadGame(st)).toEqual(s);
    clearSave(st);
    expect(loadGame(st)).toBeNull();
  });

  it('loadGame returns null for corrupt storage or throwing storage', () => {
    const st = memStorage();
    st.setItem(SAVE_KEY, '{oops');
    expect(loadGame(st)).toBeNull();
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(loadGame(bad)).toBeNull();
    expect(() => saveGame(newState(), bad, 1)).not.toThrow();
    expect(() => clearSave(bad)).not.toThrow();
  });

  it('exports and imports base64', () => {
    const s = createInitialState(42);
    s.cash = 777;
    const text = exportSave(s);
    expect(text).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(importSave(text)).toEqual(s);
    expect(importSave(`  ${text}\n`)).toEqual(s);
    expect(importSave('!!!not base64!!!')).toBeNull();
    expect(importSave(btoa('hello'))).toBeNull();
    expect(importSave('')).toBeNull();
  });
});
