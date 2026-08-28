import { requiredNodes } from './closure';
import { buildIndex } from './graph';
import type { ScheduledTask } from './scheduler';
import { schedule } from './scheduler';
import type { SpeedupAllocation } from './speedups';
import { allocateSpeedups } from './speedups';
import type { CatalogEntry, Cost, Goal, SpeedupInventory, TaskNode, UserState } from './types';

export interface Plan {
  tasks: Array<ScheduledTask & { node: TaskNode }>;
  totalSecRaw: number;
  totalSecWithSpeedups: number;
  totalCost: Cost;
  totalPower: number;
  speedupsUsed: SpeedupAllocation['used'];
  speedupsRemaining: SpeedupInventory;
}

export function computePlan(catalog: CatalogEntry[], state: UserState, goals: Goal[]): Plan {
  const index = buildIndex(catalog);
  const nodes = requiredNodes(index, goals, state);
  const opts = {
    builders: state.secondBuilder ? 2 : 1,
    buildingSpeedPct: state.buffs.buildingSpeedPct,
    researchSpeedPct: state.buffs.researchSpeedPct,
  };

  const totalCost: Cost = { food: 0, wood: 0, stone: 0, gold: 0 };
  let totalPower = 0;
  for (const n of nodes.values()) {
    for (const k of Object.keys(totalCost) as Array<keyof Cost>) totalCost[k] += n.cost[k];
    totalPower += n.power;
  }

  if (nodes.size === 0) {
    return { tasks: [], totalSecRaw: 0, totalSecWithSpeedups: 0, totalCost, totalPower,
             speedupsUsed: {}, speedupsRemaining: state.speedups };
  }

  const rawTasks = schedule(nodes, opts);
  const totalSecRaw = Math.max(...rawTasks.map((t) => t.endSec));
  const { finalTasks, used, remaining } = allocateSpeedups(nodes, state.speedups, opts);

  return {
    tasks: finalTasks.map((t) => ({ ...t, node: nodes.get(t.key)! })),
    totalSecRaw,
    totalSecWithSpeedups: Math.max(...finalTasks.map((t) => t.endSec)),
    totalCost, totalPower,
    speedupsUsed: used, speedupsRemaining: remaining,
  };
}
