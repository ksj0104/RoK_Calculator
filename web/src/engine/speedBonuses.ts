import type { NodeKind } from './types';

export interface SpeedTechnology {
  id: string;
  kind: Extract<NodeKind, 'building' | 'research'>;
  cumulativePct: readonly number[];
}

export const SPEED_TECHNOLOGIES: readonly SpeedTechnology[] = [
  { id: 'masonry', kind: 'building', cumulativePct: [1, 3, 6, 10, 15] },
  { id: 'engineering', kind: 'building', cumulativePct: [1, 3, 6, 10, 14, 18, 22, 26, 30, 35] },
  { id: 'writing', kind: 'research', cumulativePct: [1, 2, 4, 6, 10] },
  { id: 'mathematics', kind: 'research', cumulativePct: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15] },
];

export function technologyBonus(id: string, level: number): number {
  const technology = SPEED_TECHNOLOGIES.find((item) => item.id === id);
  if (!technology || level <= 0) return 0;
  return technology.cumulativePct[Math.min(level, technology.cumulativePct.length) - 1] ?? 0;
}

export function researchBonus(
  kind: NodeKind,
  levels: Readonly<Record<string, number>>,
): number {
  return SPEED_TECHNOLOGIES
    .filter((technology) => technology.kind === kind)
    .reduce((sum, technology) => sum + technologyBonus(technology.id, levels[technology.id] ?? 0), 0);
}
