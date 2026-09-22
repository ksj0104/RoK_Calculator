import type { ScheduleOptions, ScheduledTask } from './scheduler';
import { schedule } from './scheduler';
import type { NodeId, SpeedupInventory, SpeedupType, TaskNode } from './types';

export interface SpeedupAllocation {
  finalTasks: ScheduledTask[];
  /** 작업별로 어떤 종류의 가속을 몇 초 썼는지 */
  used: Record<NodeId, Partial<Record<SpeedupType, number>>>;
  remaining: SpeedupInventory;
}

/** 한 번의 반복이 작업 하나를 줄이고 재스케줄하므로, 상한은 작업 수에 비례해야 한다
 *  (고정 상한이면 작업이 많은 계획에서 보유 가속이 남는데도 배분이 중단된다). */
const maxIterations = (taskCount: number) => taskCount * 2 + 10;

/** 크리티컬 체인(makespan을 결정하는 작업 사슬)을 끝에서부터 역추적. */
function criticalChain(tasks: ScheduledTask[], nodes: Map<NodeId, TaskNode>): ScheduledTask[] {
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  const makespan = Math.max(...tasks.map((t) => t.endSec));
  let current = tasks.find((t) => t.endSec === makespan)!;
  const chain = [current];
  while (current.startSec > 0) {
    // 시작을 막은 원인: (a) 완료가 startSec와 일치하는 dep, (b) 같은 큐에서 직전에 끝난 작업
    const deps = nodes.get(current.key)!.deps.map((d) => byKey.get(d)!).filter(Boolean);
    const blocker = deps.find((d) => d.endSec === current.startSec)
      ?? tasks.find((t) => t.queue === current.queue && t.endSec === current.startSec);
    if (!blocker) break;
    chain.push(blocker);
    current = blocker;
  }
  return chain;
}

/** 작업 하나에 보유 시간을 붓는다. 전용 가속을 먼저 쓰고 남으면 범용을 쓴다.
 *  연속된 시간이라 남은 작업 시간만큼만 정확히 소모한다(초과·낭비 없음). 줄인 초를 반환. */
function applyToTask(
  duration: number, kinds: SpeedupType[], remaining: SpeedupInventory,
  usedForTask: Partial<Record<SpeedupType, number>>,
): number {
  let left = duration;
  for (const kind of kinds) {
    if (left <= 0) break;
    const spend = Math.min(remaining[kind], left);
    if (spend <= 0) continue;
    remaining[kind] -= spend;
    usedForTask[kind] = (usedForTask[kind] ?? 0) + spend;
    left -= spend;
  }
  return duration - left;
}

export function allocateSpeedups(
  nodes: Map<NodeId, TaskNode>, inventory: SpeedupInventory, opts: ScheduleOptions,
): SpeedupAllocation {
  const remaining: SpeedupInventory = { ...inventory };
  const used: SpeedupAllocation['used'] = {};
  const reductions = new Map<NodeId, number>(opts.durationReduction ?? []);
  const optsWith = () => ({ ...opts, durationReduction: reductions });

  let tasks = schedule(nodes, optsWith());
  const failed = new Set<NodeId>();

  for (let i = 0; i < maxIterations(nodes.size); i++) {
    if (remaining.universal + remaining.building + remaining.research <= 0) break;
    const chain = criticalChain(tasks, nodes)
      .filter((t) => !failed.has(t.key))
      .sort((a, b) => b.durationSec - a.durationSec);
    let improved = false;
    for (const t of chain) {
      const node = nodes.get(t.key)!;
      const current = t.durationSec;
      if (current <= 0) continue;
      const kinds: SpeedupType[] =
        node.kind === 'building' ? ['building', 'universal'] : ['research', 'universal'];
      const usedForTask = used[t.key] ?? {};
      const reduced = applyToTask(current, kinds, remaining, usedForTask);
      if (reduced > 0) {
        used[t.key] = usedForTask;
        reductions.set(t.key, (reductions.get(t.key) ?? 0) + reduced);
        improved = true;
        break; // 줄인 뒤 크리티컬 체인이 달라지므로 재스케줄하고 다시 고른다
      }
      failed.add(t.key);
    }
    if (!improved) break;
    tasks = schedule(nodes, optsWith());
  }
  return { finalTasks: tasks, used, remaining };
}
