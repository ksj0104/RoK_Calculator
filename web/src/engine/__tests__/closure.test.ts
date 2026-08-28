import { describe, expect, it } from 'vitest';
import { requiredNodes } from '../closure';
import { buildIndex } from '../graph';
import { nodeId } from '../types';
import { fixtureCatalog, freshState } from './fixtures';

const index = buildIndex(fixtureCatalog);

describe('requiredNodes', () => {
  it('목표 hall3 → 전이 선행(wall1..2, academy1, hall2..3) 전부 포함', () => {
    const nodes = requiredNodes(index, [{ type: 'building', id: 'hall', level: 3 }], freshState());
    expect([...nodes.keys()].sort()).toEqual([
      nodeId('building', 'academy', 1),
      nodeId('building', 'hall', 2),
      nodeId('building', 'hall', 3),
      nodeId('building', 'wall', 1),
      nodeId('building', 'wall', 2),
    ].sort());
  });

  it('이미 달성한 레벨은 제외되고 deps에서도 빠진다', () => {
    const state = freshState();
    state.buildings.wall = 2;
    state.buildings.hall = 2;
    const nodes = requiredNodes(index, [{ type: 'building', id: 'hall', level: 3 }], state);
    expect([...nodes.keys()].sort()).toEqual([
      nodeId('building', 'academy', 1),
      nodeId('building', 'hall', 3),
    ].sort());
    const hall3 = nodes.get(nodeId('building', 'hall', 3))!;
    expect(hall3.deps).toEqual([nodeId('building', 'academy', 1)]); // wall2는 달성됨
  });

  it('연구 목표는 건물 선행도 끌고 온다', () => {
    const nodes = requiredNodes(index, [{ type: 'research', id: 'masonry', level: 1 }], freshState());
    expect(nodes.has(nodeId('building', 'academy', 1))).toBe(true);
    expect(nodes.has(nodeId('building', 'hall', 2))).toBe(true);
  });

  it('달성 완료 목표는 빈 결과', () => {
    const state = freshState();
    state.buildings.hall = 3;
    state.buildings.wall = 2;
    state.buildings.academy = 1;
    const nodes = requiredNodes(index, [{ type: 'building', id: 'hall', level: 3 }], state);
    expect(nodes.size).toBe(0);
  });
});
