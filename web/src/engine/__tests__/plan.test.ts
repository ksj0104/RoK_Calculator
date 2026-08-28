import { describe, expect, it } from 'vitest';
import { computePlan } from '../plan';
import { fixtureCatalog, freshState } from './fixtures';

describe('computePlan', () => {
  it('총 비용/파워/시간 집계가 맞다', () => {
    const plan = computePlan(fixtureCatalog, freshState(),
      [{ type: 'building', id: 'hall', level: 3 }]);
    // wall1+wall2+hall2+academy1+hall3 = food (100+200+200+100+300) = 900
    expect(plan.totalCost.food).toBe(900);
    expect(plan.totalPower).toBe(90);
    expect(plan.totalSecRaw).toBe(490);
    expect(plan.tasks).toHaveLength(5);
    expect(plan.tasks[0].node).toBeDefined();
  });

  it('효율 모드는 전체 시간을 줄이는 속도 연구만 경로에 추가한다', () => {
    const cost = { food: 0, wood: 0, stone: 0, gold: 0 };
    const speedCatalog = [
      { id: 'tower', kind: 'building' as const, category: 'other', maxLevel: 2, levels: [
        { level: 1, requirements: [], cost, timeSec: 200, power: 0 },
        { level: 2, requirements: [], cost, timeSec: 10_000, power: 0 },
      ]},
      { id: 'masonry', kind: 'research' as const, category: 'economic', maxLevel: 1, levels: [
        { level: 1, requirements: [], cost, timeSec: 100, power: 0 },
      ]},
    ];
    const goals = [{ type: 'building' as const, id: 'tower', level: 2 }];
    const fastest = computePlan(speedCatalog, freshState(), goals, 'fastest');
    const efficient = computePlan(speedCatalog, freshState(), goals, 'efficient');
    expect(fastest.tasks).toHaveLength(2);
    expect(efficient.tasks).toHaveLength(3);
    expect(efficient.totalSecWithSpeedups).toBeLessThan(fastest.totalSecWithSpeedups);
    expect(efficient.selectedBoosts).toEqual([
      { id: 'masonry', level: 1, kind: 'building', bonusPct: 1 },
    ]);
  });

  it('완료 전에 시작되는 작업만 있으면 불필요한 속도 연구를 추가하지 않는다', () => {
    const cost = { food: 0, wood: 0, stone: 0, gold: 0 };
    const speedCatalog = [
      { id: 'tower', kind: 'building' as const, category: 'other', maxLevel: 1, levels: [
        { level: 1, requirements: [], cost, timeSec: 10_000, power: 0 },
      ]},
      { id: 'masonry', kind: 'research' as const, category: 'economic', maxLevel: 1, levels: [
        { level: 1, requirements: [], cost, timeSec: 100, power: 0 },
      ]},
    ];
    const efficient = computePlan(speedCatalog, freshState(),
      [{ type: 'building', id: 'tower', level: 1 }], 'efficient');
    expect(efficient.tasks).toHaveLength(1);
    expect(efficient.selectedBoosts).toHaveLength(0);
  });
});
