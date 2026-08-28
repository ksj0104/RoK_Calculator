import { describe, expect, it } from 'vitest';
import buildingsJson from '../../data/buildings.json';
import researchJson from '../../data/research.json';
import { computePlan } from '../plan';
import type { CatalogEntry } from '../types';
import { defaultUserState } from '../types';

const catalog: CatalogEntry[] = [
  ...(buildingsJson as any[]).map((b) => ({ ...b, kind: 'building' as const })),
  ...(researchJson as any[]).map((r) => ({ ...r, kind: 'research' as const, category: r.tree })),
];

describe('실데이터', () => {
  it('시청 25 플랜: 선행 위반 없이 완주, 총시간 > 0', () => {
    const plan = computePlan(catalog, defaultUserState(),
      [{ type: 'building', id: 'city_hall', level: 25 }]);
    expect(plan.tasks.length).toBeGreaterThan(50);
    expect(plan.totalSecRaw).toBeGreaterThan(0);
    const endOf = new Map(plan.tasks.map((t) => [t.key, t.endSec]));
    for (const t of plan.tasks) {
      for (const d of t.node.deps) {
        expect(t.startSec).toBeGreaterThanOrEqual(endOf.get(d)!);
      }
    }
  });

  it('효율 경로는 시청 25의 완료 시간을 최단 경로보다 늘리지 않는다', () => {
    const goals = [{ type: 'building' as const, id: 'city_hall', level: 25 }];
    const fastest = computePlan(catalog, defaultUserState(), goals, 'fastest');
    const efficient = computePlan(catalog, defaultUserState(), goals, 'efficient');
    expect(efficient.totalSecWithSpeedups).toBeLessThanOrEqual(fastest.totalSecWithSpeedups);
    expect(efficient.selectedBoosts.length).toBeGreaterThan(0);
  });
});
