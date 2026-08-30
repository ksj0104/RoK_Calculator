import { describe, expect, it } from 'vitest';
import type { Goal, UserState } from '../../engine/types';
import { defaultUserState, emptySpeedups } from '../../engine/types';
import { buildExport, parseImport } from '../persistence';
import { reducer } from '../userState';

const sampleState = (): UserState => ({
  buildings: { city_hall: 5, wall: 2 },
  research: { agriculture: 3 },
  speedups: { universal: { '1m': 4 }, building: { '5m': 1 }, research: {} },
  buffs: { buildingSpeedPct: 10, researchSpeedPct: 5, trainingSpeedPct: 20,
    allianceHelpCount: 30, allianceHelpSec: 90 },
  secondBuilder: true,
});

const sampleGoals = (): Goal[] => [
  { type: 'building', id: 'city_hall', level: 10 },
  { type: 'research', id: 'agriculture', level: 8 },
];

describe('buildExport / parseImport', () => {
  it('roundtrip preserves state and goals', () => {
    const state = sampleState();
    const goals = sampleGoals();
    const file = buildExport(state, goals);
    expect(file.version).toBe(1);
    const parsed = parseImport(JSON.stringify(file));
    expect(parsed.state).toEqual(state);
    expect(parsed.goals).toEqual(goals);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseImport('not json{')).toThrow('invalid');
  });

  it('throws on non-object JSON', () => {
    expect(() => parseImport('42')).toThrow('invalid');
    expect(() => parseImport('null')).toThrow('invalid');
    expect(() => parseImport('"str"')).toThrow('invalid');
  });

  it('throws on version mismatch', () => {
    const bad = JSON.stringify({ version: 2, state: sampleState(), goals: [] });
    expect(() => parseImport(bad)).toThrow('invalid');
  });

  it('throws when state is not an object', () => {
    const bad = JSON.stringify({ version: 1, state: 'nope', goals: [] });
    expect(() => parseImport(bad)).toThrow('invalid');
  });

  it('throws when goals is not an array', () => {
    const bad = JSON.stringify({ version: 1, state: sampleState(), goals: 'nope' });
    expect(() => parseImport(bad)).toThrow('invalid');
  });

  it('merges missing speedups subkeys to empty inventories without crashing', () => {
    const bad = JSON.stringify({
      version: 1,
      state: { buildings: { city_hall: 1 }, research: {}, speedups: { universal: { '1m': 2 } },
        buffs: {}, secondBuilder: false },
      goals: [],
    });
    const parsed = parseImport(bad);
    expect(parsed.state.speedups).toEqual({ ...emptySpeedups(), universal: { '1m': 2 } });
    expect(parsed.state.buffs).toEqual(defaultUserState().buffs);
  });

  it('filters out malformed goal entries', () => {
    const bad = JSON.stringify({
      version: 1,
      state: sampleState(),
      goals: [
        { type: 'building', id: 'city_hall', level: 5 },
        { type: 'nonsense', id: 'x', level: 1 },
        { type: 'research', id: 'agriculture', level: 0 },
        { type: 'research', id: 123, level: 2 },
        { type: 'building', id: 'wall', level: 'high' },
        {},
      ],
    });
    const parsed = parseImport(bad);
    expect(parsed.goals).toEqual([{ type: 'building', id: 'city_hall', level: 5 }]);
  });

  it('sanitizes malformed and negative state values', () => {
    const dirty = JSON.stringify({
      version: 1,
      state: {
        buildings: { city_hall: -4, wall: 2.9 }, research: null,
        speedups: { universal: null, building: { '1m': -2 }, research: { '5m': 3.8 } },
        buffs: { buildingSpeedPct: 999, researchSpeedPct: -5, trainingSpeedPct: 777,
          allianceHelpCount: 9999, allianceHelpSec: -30 }, secondBuilder: 'yes',
      },
      goals: [],
    });
    const parsed = parseImport(dirty);
    expect(parsed.state.buildings).toMatchObject({ city_hall: 0, wall: 2 });
    expect(parsed.state.speedups).toEqual({ universal: {}, building: { '1m': 0 }, research: { '5m': 3 } });
    expect(parsed.state.buffs).toEqual({ buildingSpeedPct: 500, researchSpeedPct: 0, trainingSpeedPct: 500,
      allianceHelpCount: 100, allianceHelpSec: 0 });
    expect(parsed.state.secondBuilder).toBe(false);
  });
});

describe('userState reducer replace action', () => {
  it('replaces state entirely', () => {
    const initial = defaultUserState();
    const next = sampleState();
    const result = reducer(initial, { type: 'replace', state: next });
    expect(result).toEqual(next);
  });

  it('clamps numeric actions to safe ranges', () => {
    let state = reducer(defaultUserState(), { type: 'setSpeedup', speedupType: 'building', duration: '1m', count: -3 });
    state = reducer(state, { type: 'setBuff', key: 'buildingSpeedPct', value: 999 });
    expect(state.speedups.building['1m']).toBe(0);
    expect(state.buffs.buildingSpeedPct).toBe(500);
  });

  it('clamps alliance help buffs to their own ranges', () => {
    let state = reducer(defaultUserState(), { type: 'setBuff', key: 'allianceHelpCount', value: 999 });
    state = reducer(state, { type: 'setBuff', key: 'allianceHelpSec', value: 99_999 });
    expect(state.buffs.allianceHelpCount).toBe(100);
    expect(state.buffs.allianceHelpSec).toBe(3600);
  });
});
