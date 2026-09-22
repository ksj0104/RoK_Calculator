import { describe, expect, it } from 'vitest';
import { requiredNodes } from '../closure';
import { buildIndex } from '../graph';
import { allocateSpeedups } from '../speedups';
import { emptySpeedups } from '../types';
import { fixtureCatalog, freshState } from './fixtures';

const index = buildIndex(fixtureCatalog);
const opts = { builders: 1, buildingSpeedPct: 0, researchSpeedPct: 0 };
const goal = [{ type: 'building' as const, id: 'hall', level: 3 }];
const makespan = (tasks: { endSec: number }[]) => Math.max(...tasks.map((t) => t.endSec));

describe('allocateSpeedups', () => {
  it('가속 없음 → 원래 스케줄 그대로', () => {
    const nodes = requiredNodes(index, goal, freshState());
    const r = allocateSpeedups(nodes, emptySpeedups(), opts);
    expect(makespan(r.finalTasks)).toBe(490);
  });

  it('건설 가속이 총시간을 줄이고, 사용량이 기록된다', () => {
    const nodes = requiredNodes(index, goal, freshState());
    const r = allocateSpeedups(nodes, { ...emptySpeedups(), building: 180 }, opts);
    expect(makespan(r.finalTasks)).toBe(490 - 180);
    expect(r.remaining.building).toBe(0);
    const totalUsed = Object.values(r.used)
      .reduce((sum, perTask) => sum + (perTask.building ?? 0), 0);
    expect(totalUsed).toBe(180);
  });

  it('보유 시간이 남는 작업에도 남은 시간만큼만 쓴다 (초과 사용 없음)', () => {
    const nodes = requiredNodes(index, goal, freshState());
    // 전체 건설 시간(490초)보다 많이 보유 → 전부 0으로 줄이고 나머지는 남는다
    const r = allocateSpeedups(nodes, { ...emptySpeedups(), building: 10_000 }, opts);
    expect(makespan(r.finalTasks)).toBe(0);
    expect(r.remaining.building).toBe(10_000 - 490);
  });

  it('큰 보유량이어도 짧은 작업에 부분 사용된다 (칸 단위 제약 없음)', () => {
    const nodes = requiredNodes(index, goal, freshState());
    // 예전에는 30일짜리 한 장이면 200초 작업에 못 썼지만, 이제 필요한 만큼만 쓴다
    const r = allocateSpeedups(nodes, { ...emptySpeedups(), building: 2_592_000 }, opts);
    expect(makespan(r.finalTasks)).toBe(0);
    expect(r.remaining.building).toBe(2_592_000 - 490);
  });

  it('연구 가속은 건설 작업에 쓰이지 않는다', () => {
    const nodes = requiredNodes(index, goal, freshState()); // 건설만 있는 목표
    const r = allocateSpeedups(nodes, { ...emptySpeedups(), research: 600 }, opts);
    expect(makespan(r.finalTasks)).toBe(490);
    expect(r.remaining.research).toBe(600);
  });

  it('범용 가속은 건설에도 쓰이고, 전용 가속을 먼저 소진한다', () => {
    const nodes = requiredNodes(index, goal, freshState());
    // 전용 100 + 범용 1000 중 490만 필요 → 전용을 먼저 다 쓰고 범용에서 390만 쓴다
    const r = allocateSpeedups(nodes,
      { ...emptySpeedups(), building: 100, universal: 1000 }, opts);
    expect(makespan(r.finalTasks)).toBe(0);
    expect(r.remaining.building).toBe(0);
    expect(r.remaining.universal).toBe(1000 - 390);
  });

  it('작업 수가 많아도 보유 시간이 충분하면 전부 가속된다', () => {
    const cost = { food: 0, wood: 0, stone: 0, gold: 0 };
    const levels = Array.from({ length: 250 }, (_, i) => (
      { level: i + 1, requirements: [], cost, timeSec: 100, power: 0 }));
    const longIndex = buildIndex([
      { id: 'tower', kind: 'building' as const, category: 'other', maxLevel: 250, levels }]);
    const nodes = requiredNodes(longIndex,
      [{ type: 'building', id: 'tower', level: 250 }], freshState());
    const r = allocateSpeedups(nodes, { ...emptySpeedups(), building: 250 * 100 }, opts);
    expect(makespan(r.finalTasks)).toBe(0);
    expect(r.remaining.building).toBe(0);
  });
});
