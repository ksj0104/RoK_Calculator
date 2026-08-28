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
    const inv = emptySpeedups();
    inv.building = { '1m': 3 }; // 180초어치
    const r = allocateSpeedups(nodes, inv, opts);
    expect(makespan(r.finalTasks)).toBe(490 - 180);
    expect(Object.keys(r.used).length).toBeGreaterThan(0);
    expect(r.remaining.building['1m'] ?? 0).toBe(0);
  });

  it('작업 시간을 초과하는 가속은 쓰지 않는다 (낭비 방지)', () => {
    const nodes = requiredNodes(index, goal, freshState());
    const inv = emptySpeedups();
    inv.building = { '30d': 1 }; // 어떤 단일 작업(최대 200초)보다 큼 → 사용 불가
    const r = allocateSpeedups(nodes, inv, opts);
    expect(makespan(r.finalTasks)).toBe(490);
    expect(r.remaining.building['30d']).toBe(1);
  });

  it('연구 가속은 건설 작업에 쓰이지 않는다', () => {
    const nodes = requiredNodes(index, goal, freshState()); // 건설만 있는 목표
    const inv = emptySpeedups();
    inv.research = { '1m': 10 };
    const r = allocateSpeedups(nodes, inv, opts);
    expect(makespan(r.finalTasks)).toBe(490);
    expect(r.remaining.research['1m']).toBe(10);
  });
});
