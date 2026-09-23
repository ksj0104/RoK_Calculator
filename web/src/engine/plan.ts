import { requiredNodes } from './closure';
import { buildIndex, powerGain } from './graph';
import type { MaterialCount } from './materials';
import { materialGems, materialsForLevel, sumMaterials } from './materials';
import type { ScheduledTask } from './scheduler';
import { schedule } from './scheduler';
import { SPEED_TECHNOLOGIES, technologyBonus } from './speedBonuses';
import type { SpeedupAllocation } from './speedups';
import { allocateSpeedups } from './speedups';
import type { CatalogEntry, Cost, Goal, PlanMode, SpeedupInventory, TaskNode, UserState } from './types';

export interface SelectedBoost {
  id: string;
  level: number;
  kind: 'building' | 'research';
  bonusPct: number;
}

export interface KindTime {
  finishSec: number;  // 해당 종류 마지막 작업이 끝나는 시점 (가속 적용 후)
  workSec: number;    // 해당 종류 작업 시간 단순 합계 (가속 적용 후)
}

export interface Plan {
  tasks: Array<ScheduledTask & { node: TaskNode }>;
  totalSecRaw: number;
  totalSecWithSpeedups: number;
  kindTimes: Record<'building' | 'research', KindTime>;
  /** 자원 외에 필요한 특수 재화(계약의 서·저항의 화살·청사진)와 보석 환산 합계 */
  totalMaterials: MaterialCount;
  totalGems: number;
  totalCost: Cost;
  /** 계획을 모두 수행해 실제로 늘어나는 전투력(각 항목의 목표 레벨 누적값 − 현재 레벨 누적값) */
  totalPower: number;
  speedupsUsed: SpeedupAllocation['used'];
  speedupsRemaining: SpeedupInventory;
  mode: PlanMode;
  selectedBoosts: SelectedBoost[];
}

function mergeGoals(goals: Goal[]): Goal[] {
  const merged = new Map<string, Goal>();
  for (const goal of goals) {
    const key = `${goal.type}:${goal.id}`;
    const previous = merged.get(key);
    if (!previous || goal.level > previous.level) merged.set(key, goal);
  }
  return [...merged.values()];
}

function makePlan(
  catalog: CatalogEntry[],
  state: UserState,
  goals: Goal[],
  mode: PlanMode,
  optimizationGoals: Goal[] = [],
  originalGoals: Goal[] = goals,
): Plan {
  const index = buildIndex(catalog);
  const nodes = requiredNodes(index, goals, state);
  const preferredNodes = optimizationGoals.length > 0
    ? new Set(requiredNodes(index, optimizationGoals, state).keys())
    : undefined;
  const opts = {
    builders: state.secondBuilder ? 2 : 1,
    buildingSpeedPct: state.buffs.buildingSpeedPct,
    researchSpeedPct: state.buffs.researchSpeedPct,
    allianceHelpCount: state.buffs.allianceHelpCount,
    allianceHelpSec: state.buffs.allianceHelpSec,
    researchLevels: state.research,
    preferredNodes,
  };

  const totalCost: Cost = { food: 0, wood: 0, stone: 0, gold: 0 };
  let totalPower = 0;
  for (const n of nodes.values()) {
    for (const k of Object.keys(totalCost) as Array<keyof Cost>) totalCost[k] += n.cost[k];
    totalPower += powerGain(index.get(n.kind, n.id)!, n.level);
  }
  const totalMaterials = sumMaterials(
    [...nodes.values()].map((n) => materialsForLevel(n.kind, n.id, n.level)));
  const totalGems = materialGems(totalMaterials);

  const emptyKindTimes = (): Plan['kindTimes'] => ({
    building: { finishSec: 0, workSec: 0 }, research: { finishSec: 0, workSec: 0 },
  });

  if (nodes.size === 0) {
    return { tasks: [], totalSecRaw: 0, totalSecWithSpeedups: 0, kindTimes: emptyKindTimes(),
             totalMaterials, totalGems, totalCost, totalPower,
             speedupsUsed: {}, speedupsRemaining: state.speedups, mode, selectedBoosts: [] };
  }

  const rawTasks = schedule(nodes, opts);
  const totalSecRaw = Math.max(...rawTasks.map((t) => t.endSec));
  const { finalTasks, used, remaining } = allocateSpeedups(nodes, state.speedups, opts);

  const originalNodes = requiredNodes(index, originalGoals, state);
  const optimizationNodes = optimizationGoals.length > 0
    ? requiredNodes(index, optimizationGoals, state)
    : new Map<string, TaskNode>();
  const selectedBoosts = SPEED_TECHNOLOGIES.flatMap((technology) => {
    const finalLevel = Math.max(0, ...[...optimizationNodes.values()]
      .filter((node) => node.kind === 'research' && node.id === technology.id)
      .map((node) => node.level));
    const originalLevel = Math.max(state.research[technology.id] ?? 0, ...[...originalNodes.values()]
      .filter((node) => node.kind === 'research' && node.id === technology.id)
      .map((node) => node.level));
    if (finalLevel <= originalLevel) return [];
    return [{ id: technology.id, level: finalLevel, kind: technology.kind,
      bonusPct: technologyBonus(technology.id, finalLevel) }];
  });

  const kindTimes = emptyKindTimes();
  for (const t of finalTasks) {
    kindTimes[t.kind].finishSec = Math.max(kindTimes[t.kind].finishSec, t.endSec);
    kindTimes[t.kind].workSec += t.durationSec;
  }

  return {
    tasks: finalTasks.map((t) => ({ ...t, node: nodes.get(t.key)! })),
    totalSecRaw,
    totalSecWithSpeedups: Math.max(...finalTasks.map((t) => t.endSec)),
    kindTimes, totalMaterials, totalGems,
    totalCost, totalPower,
    speedupsUsed: used, speedupsRemaining: remaining,
    mode, selectedBoosts,
  };
}

function efficientGoals(catalog: CatalogEntry[], state: UserState, goals: Goal[]): Goal[] {
  const extras: Goal[] = [];
  let best = makePlan(catalog, state, goals, 'efficient');
  // 보유 가속만으로 전부 끝나면 속도 연구로 더 줄일 시간이 없다 (탐색도 낭비)
  if (best.totalSecWithSpeedups <= 0) return extras;
  const totalLevels = (list: Goal[]) => list.reduce((sum, goal) => sum + goal.level, 0);

  for (let pass = 0; pass < SPEED_TECHNOLOGIES.length * 3; pass++) {
    let bestCandidate: { extras: Goal[]; plan: Plan } | null = null;
    for (const technology of SPEED_TECHNOLOGIES) {
      const entry = catalog.find((item) => item.kind === 'research' && item.id === technology.id);
      if (!entry) continue;
      const currentExtra = extras.find((goal) => goal.id === technology.id)?.level
        ?? state.research[technology.id] ?? 0;
      for (let level = currentExtra + 1; level <= entry.maxLevel; level++) {
        const candidateExtras = mergeGoals([
          ...extras.filter((goal) => goal.id !== technology.id),
          { type: 'research', id: technology.id, level },
        ]);
        const candidateGoals = mergeGoals([...goals, ...candidateExtras]);
        const candidatePlan = makePlan(catalog, state, candidateGoals, 'efficient', candidateExtras);
        // 총 완료 시간이 늘지 않는 한 속도 연구를 계속 채운다 (동률이면 더 높은 레벨 선택)
        if (candidatePlan.totalSecWithSpeedups > best.totalSecWithSpeedups) continue;
        if (!bestCandidate
          || candidatePlan.totalSecWithSpeedups < bestCandidate.plan.totalSecWithSpeedups
          || (candidatePlan.totalSecWithSpeedups === bestCandidate.plan.totalSecWithSpeedups
            && totalLevels(candidateExtras) > totalLevels(bestCandidate.extras))) {
          bestCandidate = { extras: candidateExtras, plan: candidatePlan };
        }
      }
    }
    if (!bestCandidate) break;
    extras.splice(0, extras.length, ...bestCandidate.extras);
    best = bestCandidate.plan;
    if (best.totalSecWithSpeedups <= 0) break;
  }
  return extras;
}

export function computePlan(
  catalog: CatalogEntry[],
  state: UserState,
  goals: Goal[],
  mode: PlanMode = 'fastest',
): Plan {
  const normalizedGoals = mergeGoals(goals);
  if (mode === 'fastest') return makePlan(catalog, state, normalizedGoals, mode);
  const extras = efficientGoals(catalog, state, normalizedGoals);
  return makePlan(
    catalog,
    state,
    mergeGoals([...normalizedGoals, ...extras]),
    mode,
    extras,
    normalizedGoals,
  );
}
