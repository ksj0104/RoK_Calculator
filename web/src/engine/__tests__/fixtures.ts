import type { CatalogEntry, UserState } from '../types';
import { emptySpeedups } from '../types';

const cost0 = { food: 0, wood: 0, stone: 0, gold: 0 };
const lv = (level: number, timeSec: number, requirements: CatalogEntry['levels'][0]['requirements'] = []) =>
  ({ level, requirements, cost: { ...cost0, food: level * 100 }, timeSec, power: level * 10 });

/** hall(3레벨) ← wall(2레벨) 선행, academy(2) ← hall2, tech masonry(2) ← academy1 */
export const fixtureCatalog: CatalogEntry[] = [
  { id: 'hall', kind: 'building', category: 'other', maxLevel: 3, levels: [
    lv(1, 0),
    lv(2, 100, [{ type: 'building', id: 'wall', level: 1 }]),
    lv(3, 200, [{ type: 'building', id: 'wall', level: 2 }, { type: 'building', id: 'academy', level: 1 }]),
  ]},
  { id: 'wall', kind: 'building', category: 'other', maxLevel: 2, levels: [lv(1, 50), lv(2, 60)] },
  { id: 'academy', kind: 'building', category: 'economic', maxLevel: 2, levels: [
    lv(1, 80, [{ type: 'building', id: 'hall', level: 2 }]), lv(2, 90),
  ]},
  { id: 'masonry', kind: 'research', category: 'economic', maxLevel: 2, levels: [
    lv(1, 40, [{ type: 'building', id: 'academy', level: 1 }]), lv(2, 70),
  ]},
];

export const freshState = (): UserState => ({
  buildings: { hall: 1 },
  research: {},
  speedups: emptySpeedups(),
  buffs: { buildingSpeedPct: 0, researchSpeedPct: 0, trainingSpeedPct: 0,
    allianceHelpCount: 0, allianceHelpSec: 0 },
  secondBuilder: false,
});
