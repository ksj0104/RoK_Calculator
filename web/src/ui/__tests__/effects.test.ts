import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../../engine/types';
import { effectLabel, effectRange, effectValueAt, requirementsUpTo } from '../effects';

const dict: Record<string, string> = {
  'effect.building_speed': '건설 속도',
  'effect.unlock': '병종 해금',
};
const t = (key: string) => dict[key] ?? key;

const cost = { food: 0, wood: 0, stone: 0, gold: 0 };
const entry: CatalogEntry = {
  id: 'masonry', kind: 'research', category: 'economic', maxLevel: 3,
  effectName: 'Building Speed',
  levels: [
    { level: 1, requirements: [
      { type: 'research', id: 'irrigation', level: 1 },
      { type: 'building', id: 'academy', level: 5 },
    ], cost, timeSec: 60, power: 1, effect: '+1.0%' },
    { level: 2, requirements: [
      { type: 'research', id: 'masonry', level: 1 },
      { type: 'building', id: 'academy', level: 7 },
    ], cost, timeSec: 60, power: 1, effect: '+3.0%' },
    { level: 3, requirements: [
      { type: 'building', id: 'academy', level: 9 },
    ], cost, timeSec: 60, power: 1, effect: '+6.0%' },
  ],
};

describe('effectLabel', () => {
  it('알려진 효과명은 i18n 키로 번역한다', () => {
    expect(effectLabel('Building Speed', t)).toBe('건설 속도');
  });

  it('번역이 없으면 원문 그대로 보여준다', () => {
    expect(effectLabel('Siege Unit Attack', t)).toBe('Siege Unit Attack');
  });

  it('효과명이 없으면(병종 해금 연구) 해금 라벨을 쓴다', () => {
    expect(effectLabel(null, t)).toBe('병종 해금');
    expect(effectLabel(undefined, t)).toBe('병종 해금');
  });
});

describe('effectValueAt / effectRange', () => {
  it('선택한 레벨의 효과 수치를 반환한다', () => {
    expect(effectValueAt(entry, 2)).toBe('+3.0%');
    expect(effectValueAt(entry, 9)).toBeNull();
  });

  it('레벨 1 → 최대 레벨 요약을 만든다', () => {
    expect(effectRange(entry)).toBe('+1.0% → +6.0%');
  });

  it('수치가 없거나(해금 연구) 문장형이면 null', () => {
    const unlock = { ...entry, effectName: null,
      levels: entry.levels.map((l) => ({ ...l, effect: undefined })) };
    expect(effectRange(unlock)).toBeNull();
    const sentence = { ...entry,
      levels: entry.levels.map((l) => ({ ...l, effect: 'Able to detect target reserves' })) };
    expect(effectRange(sentence)).toBeNull();
  });

  it('레벨이 1개면 단일 값을 그대로 쓴다', () => {
    const single = { ...entry, maxLevel: 1, levels: [entry.levels[0]] };
    expect(effectRange(single)).toBe('+1.0%');
  });
});

describe('requirementsUpTo', () => {
  it('목표 레벨까지의 선행을 항목별 최고 레벨로 합산하고 자기 자신은 제외한다', () => {
    expect(requirementsUpTo(entry, 3)).toEqual([
      { type: 'research', id: 'irrigation', level: 1 },
      { type: 'building', id: 'academy', level: 9 },
    ]);
  });

  it('목표 레벨보다 위의 요구사항은 포함하지 않는다', () => {
    expect(requirementsUpTo(entry, 1)).toEqual([
      { type: 'research', id: 'irrigation', level: 1 },
      { type: 'building', id: 'academy', level: 5 },
    ]);
  });
});
