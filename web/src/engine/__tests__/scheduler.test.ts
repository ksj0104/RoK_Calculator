import { describe, expect, it } from 'vitest';
import { requiredNodes } from '../closure';
import { buildIndex } from '../graph';
import { applyAllianceHelps, schedule } from '../scheduler';
import { nodeId } from '../types';
import { fixtureCatalog, freshState } from './fixtures';

const index = buildIndex(fixtureCatalog);
const opts = { builders: 1, buildingSpeedPct: 0, researchSpeedPct: 0 };
const goalHall3 = [{ type: 'building' as const, id: 'hall', level: 3 }];

describe('schedule', () => {
  it('선행조건 위반 없음: 모든 태스크는 deps 완료 후 시작', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, opts);
    const endOf = new Map(tasks.map((t) => [t.key, t.endSec]));
    for (const t of tasks) {
      for (const d of nodes.get(t.key)!.deps) {
        expect(t.startSec).toBeGreaterThanOrEqual(endOf.get(d)!);
      }
    }
  });

  it('건설자 1명 직렬: 총시간 = 모든 건설 시간 합', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, opts);
    // wall1(50)+wall2(60)+hall2(100)+academy1(80)+hall3(200) = 490
    expect(Math.max(...tasks.map((t) => t.endSec))).toBe(490);
  });

  it('건설자 2명이면 병렬화로 단축된다', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, { ...opts, builders: 2 });
    expect(Math.max(...tasks.map((t) => t.endSec))).toBeLessThan(490);
  });

  it('연구는 연구 큐에서 건설과 병렬 진행', () => {
    const nodes = requiredNodes(index,
      [...goalHall3, { type: 'research' as const, id: 'masonry', level: 2 }], freshState());
    const tasks = schedule(nodes, opts);
    const masonry1 = tasks.find((t) => t.key === nodeId('research', 'masonry', 1))!;
    const academy1 = tasks.find((t) => t.key === nodeId('building', 'academy', 1))!;
    expect(masonry1.queue).toBe(1); // builders=1 → 연구 큐 번호 1
    expect(masonry1.startSec).toBeGreaterThanOrEqual(academy1.endSec);
  });

  it('건설 버프 100%면 건설 시간 절반', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, { ...opts, buildingSpeedPct: 100 });
    expect(Math.max(...tasks.map((t) => t.endSec))).toBe(245);
  });

  it('연맹 지원: 짧은 작업은 회당 감소 시간만큼 차감되고 0 밑으로 내려가지 않는다', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    // 모든 작업이 500초 이하라 1% < 5초 → 회당 5초 × 11회 = 55초씩 차감
    const tasks = schedule(nodes, { ...opts, allianceHelpCount: 11, allianceHelpSec: 5 });
    // wall1 50→0, wall2 60→5, hall2 100→45, academy1 80→25, hall3 200→145 = 220
    expect(Math.max(...tasks.map((t) => t.endSec))).toBe(220);
  });

  it('연맹 지원: 긴 작업은 회당 남은 시간의 1%씩 차감된다', () => {
    const longCatalog = [
      { id: 'keep', kind: 'building' as const, category: 'other', maxLevel: 1, levels: [
        { level: 1, requirements: [], cost: { food: 0, wood: 0, stone: 0, gold: 0 },
          timeSec: 10_000, power: 0 },
      ]},
    ];
    const nodes = requiredNodes(buildIndex(longCatalog),
      [{ type: 'building', id: 'keep', level: 1 }], freshState());
    const tasks = schedule(nodes, { ...opts, allianceHelpCount: 2, allianceHelpSec: 10 });
    // 1회: max(1% of 10000 = 100, 10) → 9900, 2회: max(ceil(99), 10) → 9801
    expect(tasks[0].durationSec).toBe(9_801);
  });

  describe('applyAllianceHelps', () => {
    it('회당 남은 시간의 1%와 회당 감소 시간 중 큰 값을 순차 차감한다', () => {
      expect(applyAllianceHelps(10_000, 1, 10)).toBe(9_900);
      expect(applyAllianceHelps(10_000, 3, 10)).toBe(9_702); // 9900 → 9801 → 9702
      expect(applyAllianceHelps(500, 3, 60)).toBe(320);      // 1%=5 < 60 → 60씩
      expect(applyAllianceHelps(150, 2, 100)).toBe(0);       // 50 → 0 (클램프)
    });

    it('횟수나 시간이 0이면 그대로다', () => {
      expect(applyAllianceHelps(10_000, 0, 60)).toBe(10_000);
      expect(applyAllianceHelps(0, 5, 60)).toBe(0);
    });
  });

  it('속도 연구 효과는 완료 후 시작하는 작업부터 적용된다', () => {
    const speedCatalog = [
      { id: 'tower', kind: 'building' as const, category: 'other', maxLevel: 2, levels: [
        { level: 1, requirements: [], cost: { food: 0, wood: 0, stone: 0, gold: 0 }, timeSec: 200, power: 0 },
        { level: 2, requirements: [], cost: { food: 0, wood: 0, stone: 0, gold: 0 }, timeSec: 10_000, power: 0 },
      ]},
      { id: 'masonry', kind: 'research' as const, category: 'economic', maxLevel: 1, levels: [
        { level: 1, requirements: [], cost: { food: 0, wood: 0, stone: 0, gold: 0 }, timeSec: 100, power: 0 },
      ]},
    ];
    const speedIndex = buildIndex(speedCatalog);
    const nodes = requiredNodes(speedIndex, [
      { type: 'building', id: 'tower', level: 2 },
      { type: 'research', id: 'masonry', level: 1 },
    ], freshState());
    const tasks = schedule(nodes, { ...opts, researchLevels: {} });
    expect(tasks.find((task) => task.key === nodeId('building', 'tower', 1))!.durationSec).toBe(200);
    expect(tasks.find((task) => task.key === nodeId('building', 'tower', 2))!.durationSec).toBe(9_901);
  });
});
