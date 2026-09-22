import { describe, expect, it } from 'vitest';
import type { Goal, UserState } from '../../engine/types';
import { defaultUserState, emptySpeedups } from '../../engine/types';
import { buildExport, parseImport } from '../persistence';
import { reducer } from '../userState';

const sampleState = (): UserState => ({
  buildings: { city_hall: 5, wall: 2 },
  research: { agriculture: 3 },
  speedups: { universal: 240, building: 300, research: 0 },
  materials: { covenant: 1200, arrow: 800, blueprint: 0 },
  gems: 50_000,
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

  it('예전 개수 방식 백업은 총 보유 시간(초)으로 변환한다', () => {
    const old = JSON.stringify({
      version: 1,
      state: { buildings: { city_hall: 1 }, research: {},
        speedups: { universal: { '1m': 2, '3h': 1 }, building: { '24h': 1 } },
        buffs: {}, secondBuilder: false },
      goals: [],
    });
    const parsed = parseImport(old);
    expect(parsed.state.speedups).toEqual({
      universal: 2 * 60 + 10_800, building: 86_400, research: 0,
    });
    expect(parsed.state.buffs).toEqual(defaultUserState().buffs);
  });

  it('알 수 없는 지속시간 키는 무시하고 나머지만 합산한다', () => {
    const old = JSON.stringify({
      version: 1,
      state: { buildings: {}, research: {},
        speedups: { universal: { '1m': 2, 'bogus': 99 } }, buffs: {}, secondBuilder: false },
      goals: [],
    });
    expect(parseImport(old).state.speedups.universal).toBe(120);
  });

  it('보유 재화가 없는 예전 백업은 0으로 채운다', () => {
    const old = JSON.stringify({
      version: 1,
      state: { buildings: {}, research: {}, buffs: {}, secondBuilder: false },
      goals: [],
    });
    const parsed = parseImport(old);
    expect(parsed.state.materials).toEqual({ covenant: 0, arrow: 0, blueprint: 0 });
    expect(parsed.state.gems).toBe(0);
  });

  it('보유 재화의 잘못된 값은 0으로 정리한다', () => {
    const dirty = JSON.stringify({
      version: 1,
      state: { buildings: {}, research: {},
        materials: { covenant: -5, arrow: 12.9, blueprint: 'x' }, gems: -100,
        buffs: {}, secondBuilder: false },
      goals: [],
    });
    const parsed = parseImport(dirty);
    expect(parsed.state.materials).toEqual({ covenant: 0, arrow: 12, blueprint: 0 });
    expect(parsed.state.gems).toBe(0);
  });

  it('speedups가 없으면 0으로 채운다', () => {
    const bare = JSON.stringify({
      version: 1,
      state: { buildings: { city_hall: 1 }, research: {}, buffs: {}, secondBuilder: false },
      goals: [],
    });
    expect(parseImport(bare).state.speedups).toEqual(emptySpeedups());
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
        speedups: { universal: null, building: -500, research: 3.8 },
        buffs: { buildingSpeedPct: 999, researchSpeedPct: -5, trainingSpeedPct: 777,
          allianceHelpCount: 9999, allianceHelpSec: -30 }, secondBuilder: 'yes',
      },
      goals: [],
    });
    const parsed = parseImport(dirty);
    expect(parsed.state.buildings).toMatchObject({ city_hall: 0, wall: 2 });
    expect(parsed.state.speedups).toEqual({ universal: 0, building: 0, research: 3 });
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
    let state = reducer(defaultUserState(), { type: 'setSpeedup', speedupType: 'building', seconds: -3 });
    state = reducer(state, { type: 'setBuff', key: 'buildingSpeedPct', value: 999 });
    expect(state.speedups.building).toBe(0);
    expect(state.buffs.buildingSpeedPct).toBe(500);
  });

  it('implied 선행은 더 낮은 레벨만 올리고 높은 레벨은 유지한다', () => {
    let state = reducer(defaultUserState(), { type: 'setResearch', id: 'masonry', level: 3 });
    state = reducer(state, { type: 'setBuilding', id: 'academy', level: 20, implied: [
      { type: 'building', id: 'city_hall', level: 20 },  // 기본값 1 → 20으로 상향
      { type: 'research', id: 'masonry', level: 1 },     // 이미 3이므로 그대로
    ]});
    expect(state.buildings.academy).toBe(20);
    expect(state.buildings.city_hall).toBe(20);
    expect(state.research.masonry).toBe(3);
  });

  it('implied 없이 레벨만 내리면 다른 항목은 건드리지 않는다', () => {
    let state = reducer(defaultUserState(), { type: 'setBuilding', id: 'academy', level: 20, implied: [
      { type: 'building', id: 'city_hall', level: 20 },
    ]});
    state = reducer(state, { type: 'setBuilding', id: 'academy', level: 5 });
    expect(state.buildings.academy).toBe(5);
    expect(state.buildings.city_hall).toBe(20);
  });

  it('보유 재화와 보석을 설정하고 음수는 0으로 막는다', () => {
    let state = reducer(defaultUserState(), { type: 'setMaterial', material: 'covenant', count: 1500 });
    state = reducer(state, { type: 'setMaterial', material: 'arrow', count: -3 });
    state = reducer(state, { type: 'setGems', count: 42_000 });
    expect(state.materials).toEqual({ covenant: 1500, arrow: 0, blueprint: 0 });
    expect(state.gems).toBe(42_000);
  });

  it('clamps alliance help buffs to their own ranges', () => {
    let state = reducer(defaultUserState(), { type: 'setBuff', key: 'allianceHelpCount', value: 999 });
    state = reducer(state, { type: 'setBuff', key: 'allianceHelpSec', value: 99_999 });
    expect(state.buffs.allianceHelpCount).toBe(100);
    expect(state.buffs.allianceHelpSec).toBe(3600);
  });
});
