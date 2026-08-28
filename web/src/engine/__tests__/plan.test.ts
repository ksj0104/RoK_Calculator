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

  it('연맹 지원(횟수 × 회당 감소)이 모든 작업 시간에 반영된다', () => {
    const state = freshState();
    state.buffs.allianceHelpCount = 10;
    state.buffs.allianceHelpSec = 5; // 작업당 50초 감소
    const plan = computePlan(fixtureCatalog, state,
      [{ type: 'building', id: 'hall', level: 3 }]);
    // wall1 50→0, wall2 60→10, hall2 100→50, academy1 80→30, hall3 200→150 = 240
    expect(plan.totalSecRaw).toBe(240);
    expect(plan.totalSecWithSpeedups).toBe(240);
  });

  it('건설/연구별 완료 시점과 작업 시간 합계를 제공한다', () => {
    const plan = computePlan(fixtureCatalog, freshState(), [
      { type: 'building', id: 'hall', level: 3 },
      { type: 'research', id: 'masonry', level: 2 },
    ]);
    // 연구는 academy1 완료(230초) 후 masonry1(40)+masonry2(70) = 340초에 종료.
    // masonry1(석공술 +1%) 완료 후 시작하는 hall3은 200→199초로 단축되어 건설은 489초에 종료
    expect(plan.kindTimes.building).toEqual({ finishSec: 489, workSec: 489 });
    expect(plan.kindTimes.research).toEqual({ finishSec: 340, workSec: 110 });
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
