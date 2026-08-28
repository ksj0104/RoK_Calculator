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
});
