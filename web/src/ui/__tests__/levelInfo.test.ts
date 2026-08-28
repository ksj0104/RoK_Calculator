import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../../engine/types';
import { clampTipPosition, upgradeTarget } from '../levelInfo';

const cost = { food: 0, wood: 0, stone: 0, gold: 0 };
const entry: CatalogEntry = {
  id: 'wall', kind: 'building', category: 'other', maxLevel: 3,
  levels: [
    { level: 1, requirements: [], cost, timeSec: 10, power: 1 },
    { level: 2, requirements: [], cost, timeSec: 20, power: 2 },
    { level: 3, requirements: [], cost, timeSec: 30, power: 3 },
  ],
};

describe('upgradeTarget', () => {
  it('현재 레벨 + 1 행을 반환한다', () => {
    expect(upgradeTarget(entry, 0)).toEqual({ row: entry.levels[0], isMax: false });
    expect(upgradeTarget(entry, 2)).toEqual({ row: entry.levels[2], isMax: false });
  });

  it('최대 레벨이면 최대 레벨 행과 isMax를 반환한다', () => {
    expect(upgradeTarget(entry, 3)).toEqual({ row: entry.levels[2], isMax: true });
    expect(upgradeTarget(entry, 99)).toEqual({ row: entry.levels[2], isMax: true });
  });
});

describe('clampTipPosition', () => {
  const viewport = { width: 1000, height: 800 };
  const tip = { width: 200, height: 100 };

  it('기본: 앵커 아래 가운데 정렬', () => {
    const anchor = { left: 400, right: 500, top: 300, bottom: 350 };
    expect(clampTipPosition(anchor, tip, viewport)).toEqual({ x: 350, y: 356 });
  });

  it('좌우 화면 밖으로 나가면 여백 8px로 고정한다', () => {
    const left = { left: 0, right: 40, top: 300, bottom: 350 };
    expect(clampTipPosition(left, tip, viewport).x).toBe(8);
    const right = { left: 960, right: 1000, top: 300, bottom: 350 };
    expect(clampTipPosition(right, tip, viewport).x).toBe(1000 - 200 - 8);
  });

  it('아래 공간이 부족하면 앵커 위에 띄운다', () => {
    const anchor = { left: 400, right: 500, top: 740, bottom: 780 };
    expect(clampTipPosition(anchor, tip, viewport)).toEqual({ x: 350, y: 740 - 100 - 6 });
  });
});
