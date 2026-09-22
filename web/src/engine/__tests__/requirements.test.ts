import { describe, expect, it } from 'vitest';
import { buildIndex } from '../graph';
import { splitByMet, transitiveRequirements } from '../requirements';
import { fixtureCatalog, freshState } from './fixtures';

const index = buildIndex(fixtureCatalog);

describe('transitiveRequirements', () => {
  it('선행의 선행까지 따라간다', () => {
    // masonry1 ← academy1 ← hall2 ← wall1 (기존 직접 선행 계산은 academy1만 찾는다)
    expect(transitiveRequirements(index, 'research', 'masonry', 2)).toEqual([
      { type: 'building', id: 'academy', level: 1 },
      { type: 'building', id: 'hall', level: 2 },
      { type: 'building', id: 'wall', level: 1 },
    ]);
  });

  it('자기 자신은 선행으로 넣지 않는다 (academy1이 hall2를 요구해도)', () => {
    expect(transitiveRequirements(index, 'building', 'hall', 3)).toEqual([
      { type: 'building', id: 'academy', level: 1 },
      { type: 'building', id: 'wall', level: 2 },
    ]);
  });

  it('같은 항목은 가장 높은 요구 레벨로 합친다', () => {
    // hall2는 wall1, hall3은 wall2를 요구 → wall2
    const reqs = transitiveRequirements(index, 'building', 'hall', 3);
    expect(reqs.find((r) => r.id === 'wall')).toEqual({ type: 'building', id: 'wall', level: 2 });
  });

  it('목표 레벨보다 위의 요구사항은 포함하지 않는다', () => {
    expect(transitiveRequirements(index, 'building', 'hall', 2)).toEqual([
      { type: 'building', id: 'wall', level: 1 },
    ]);
  });

  it('선행이 없으면 빈 배열', () => {
    expect(transitiveRequirements(index, 'building', 'wall', 2)).toEqual([]);
  });
});

describe('splitByMet', () => {
  it('현재 레벨 기준으로 미충족과 충족을 나눈다', () => {
    const state = { ...freshState(), buildings: { hall: 2, wall: 1 } };
    const reqs = transitiveRequirements(index, 'research', 'masonry', 2);
    expect(splitByMet(reqs, state)).toEqual({
      missing: [{ type: 'building', id: 'academy', level: 1 }],
      met: [
        { type: 'building', id: 'hall', level: 2 },
        { type: 'building', id: 'wall', level: 1 },
      ],
    });
  });

  it('연구 레벨도 함께 판정한다', () => {
    const state = { ...freshState(), research: { masonry: 2 } };
    const reqs = [{ type: 'research' as const, id: 'masonry', level: 2 }];
    expect(splitByMet(reqs, state).met).toHaveLength(1);
    expect(splitByMet(reqs, state).missing).toHaveLength(0);
  });
});
