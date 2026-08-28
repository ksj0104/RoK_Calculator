import type { CatalogEntry, LevelData } from '../engine/types';

/** 카드 호버 시 보여줄 업그레이드 대상: 현재 레벨 + 1, 최대 레벨이면 최대 레벨 행. */
export function upgradeTarget(
  entry: CatalogEntry, currentLevel: number,
): { row: LevelData; isMax: boolean } | null {
  if (entry.levels.length === 0) return null;
  const isMax = currentLevel >= entry.maxLevel;
  const targetLevel = isMax ? entry.maxLevel : currentLevel + 1;
  const row = entry.levels.find((r) => r.level === targetLevel) ?? entry.levels[entry.levels.length - 1];
  return { row, isMax };
}

export interface AnchorRect { left: number; right: number; top: number; bottom: number }

/** 툴팁 위치: 앵커 아래 가운데. 좌우는 8px 여백으로 고정하고, 아래 공간이 부족하면 위로. */
export function clampTipPosition(
  anchor: AnchorRect,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const margin = 8;
  const gap = 6;
  const centered = (anchor.left + anchor.right) / 2 - tip.width / 2;
  const x = Math.min(Math.max(centered, margin), viewport.width - tip.width - margin);
  const below = anchor.bottom + gap;
  const y = below + tip.height > viewport.height - margin
    ? anchor.top - tip.height - gap
    : below;
  return { x, y };
}
