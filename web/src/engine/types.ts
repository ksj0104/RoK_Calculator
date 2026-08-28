export type Resource = 'food' | 'wood' | 'stone' | 'gold';
export type Cost = Record<Resource, number>;
export type NodeKind = 'building' | 'research';

export interface Requirement { type: NodeKind; id: string; level: number }

export interface LevelData {
  level: number;
  requirements: Requirement[];
  cost: Cost;
  timeSec: number;
  power: number;
}

export interface CatalogEntry {
  id: string;
  kind: NodeKind;
  category: string;      // building: economic|military|other, research: economic|military(tree)
  maxLevel: number;
  levels: LevelData[];
}

export interface Goal { type: NodeKind; id: string; level: number }

export type PlanMode = 'fastest' | 'efficient';

export type NodeId = string; // `${kind}:${id}:${level}`
export const nodeId = (kind: NodeKind, id: string, level: number): NodeId =>
  `${kind}:${id}:${level}`;

export interface TaskNode {
  key: NodeId;
  kind: NodeKind;
  id: string;
  level: number;
  timeSec: number;       // 원시(버프 미적용) 시간
  cost: Cost;
  power: number;
  deps: NodeId[];
}

export type SpeedupType = 'universal' | 'building' | 'research';
/** 가속 종류 → { 지속시간 id → 개수 }. 지속시간 id는 SPEEDUP_DURATIONS의 키. */
export type SpeedupInventory = Record<SpeedupType, Record<string, number>>;

export const SPEEDUP_DURATIONS: Record<string, number> = {
  '1m': 60, '5m': 300, '10m': 600, '15m': 900, '30m': 1800, '60m': 3600,
  '3h': 10800, '8h': 28800, '15h': 54000, '24h': 86400,
  '3d': 259200, '7d': 604800, '30d': 2592000,
};

export interface UserState {
  buildings: Record<string, number>;   // id → 현재 레벨 (없으면 0)
  research: Record<string, number>;
  speedups: SpeedupInventory;
  /** allianceHelpCount × allianceHelpSec 만큼 각 작업 시간이 차감된다 */
  buffs: {
    buildingSpeedPct: number;
    researchSpeedPct: number;
    allianceHelpCount: number;
    allianceHelpSec: number;
  };
  secondBuilder: boolean;
}

export const emptySpeedups = (): SpeedupInventory => ({
  universal: {}, building: {}, research: {},
});

export const defaultUserState = (): UserState => ({
  buildings: { city_hall: 1 },
  research: {},
  speedups: emptySpeedups(),
  buffs: { buildingSpeedPct: 0, researchSpeedPct: 0, allianceHelpCount: 0, allianceHelpSec: 0 },
  secondBuilder: false,
});
