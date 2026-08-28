import type { ScheduleOptions, ScheduledTask } from './scheduler';
import { schedule } from './scheduler';
import type { NodeId, SpeedupInventory, SpeedupType, TaskNode } from './types';
import { SPEEDUP_DURATIONS } from './types';

export interface SpeedupAllocation {
  finalTasks: ScheduledTask[];
  used: Record<NodeId, Partial<Record<SpeedupType, Record<string, number>>>>;
  remaining: SpeedupInventory;
}

const MAX_ITER = 200;

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

/** 인벤토리에서 작업 하나에 그리디(큰 단위 우선, 초과 금지)로 가속 적용. 줄인 초를 반환. */
function applyToTask(
  duration: number, kinds: SpeedupType[], remaining: SpeedupInventory,
  usedForTask: Partial<Record<SpeedupType, Record<string, number>>>,
): number {
  let left = duration;
  const unitsDesc = Object.entries(SPEEDUP_DURATIONS).sort((a, b) => b[1] - a[1]);
  for (const kind of kinds) {
    for (const [unitId, unitSec] of unitsDesc) {
      while ((remaining[kind][unitId] ?? 0) > 0 && unitSec <= left) {
        remaining[kind][unitId]!--;
        const bucket = (usedForTask[kind] ??= {});
        bucket[unitId] = (bucket[unitId] ?? 0) + 1;
        left -= unitSec;
      }
    }
  }
  return duration - left;
}

export function allocateSpeedups(
  nodes: Map<NodeId, TaskNode>, inventory: SpeedupInventory, opts: ScheduleOptions,
): SpeedupAllocation {
  const remaining: SpeedupInventory = {
    universal: { ...inventory.universal },
    building: { ...inventory.building },
    research: { ...inventory.research },
  };
  const used: SpeedupAllocation['used'] = {};
  const reductions = new Map<NodeId, number>(opts.durationReduction ?? []);
  const optsWith = () => ({ ...opts, durationReduction: reductions });

  let tasks = schedule(nodes, optsWith());
  const failed = new Set<NodeId>();

  for (let i = 0; i < MAX_ITER; i++) {
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
        break; // 스케줄 재계산 후 다음 크리티컬 체인으로
      }
      failed.add(t.key);
    }
    if (!improved) break;
    tasks = schedule(nodes, optsWith());
  }
  return { finalTasks: tasks, used, remaining };
}
