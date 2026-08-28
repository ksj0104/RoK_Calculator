import { criticalWeights } from './critical';
import { researchBonus } from './speedBonuses';
import type { NodeId, NodeKind, TaskNode } from './types';

export interface ScheduleOptions {
  builders: number;               // 1 또는 2
  buildingSpeedPct: number;
  researchSpeedPct: number;
  durationOverride?: Map<NodeId, number>; // 가속 적용 후 시간 (speedups.ts가 사용)
  durationReduction?: Map<NodeId, number>;
  allianceReductionSec?: number;  // 연맹 지원: 작업마다 차감되는 총 시간(횟수 × 회당 감소)
  researchLevels?: Readonly<Record<string, number>>;
  preferredNodes?: ReadonlySet<NodeId>;
}

export interface ScheduledTask {
  key: NodeId; kind: NodeKind; queue: number;
  startSec: number; endSec: number; durationSec: number;
}

export function effectiveDuration(
  node: TaskNode,
  opts: ScheduleOptions,
  researchLevels: Readonly<Record<string, number>> = opts.researchLevels ?? {},
): number {
  const override = opts.durationOverride?.get(node.key);
  if (override !== undefined) return override;
  const basePct = node.kind === 'building' ? opts.buildingSpeedPct : opts.researchSpeedPct;
  const pct = basePct + researchBonus(node.kind, researchLevels);
  const reduction = (opts.allianceReductionSec ?? 0) + (opts.durationReduction?.get(node.key) ?? 0);
  return Math.max(0, Math.ceil(node.timeSec / (1 + pct / 100)) - reduction);
}

/** 이산 사건 시뮬레이션. 큐 0..builders-1 = 건설, builders = 연구. */
export function schedule(
  nodes: Map<NodeId, TaskNode>, opts: ScheduleOptions,
): ScheduledTask[] {
  const estimate = (n: TaskNode) => effectiveDuration(n, opts);
  const weights = criticalWeights(nodes, estimate);
  const completedResearch = { ...(opts.researchLevels ?? {}) };

  const pendingDeps = new Map<NodeId, number>();
  const dependents = new Map<NodeId, NodeId[]>();
  for (const n of nodes.values()) {
    pendingDeps.set(n.key, n.deps.length);
    for (const d of n.deps) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d)!.push(n.key);
    }
  }

  const ready: Record<NodeKind, NodeId[]> = { building: [], research: [] };
  const pushReady = (key: NodeId) => {
    const kind = nodes.get(key)!.kind;
    ready[kind].push(key);
    ready[kind].sort((a, b) => {
      const preferred = Number(opts.preferredNodes?.has(b) ?? false)
        - Number(opts.preferredNodes?.has(a) ?? false);
      return preferred || weights.get(b)! - weights.get(a)!;
    });
  };
  for (const n of nodes.values()) if (n.deps.length === 0) pushReady(n.key);

  const queueCount = opts.builders + 1;
  const queueFreeAt = new Array<number>(queueCount).fill(0);
  const queueKind = (q: number): NodeKind => (q < opts.builders ? 'building' : 'research');
  const running: Array<{ task: ScheduledTask } | null> = new Array(queueCount).fill(null);
  const result: ScheduledTask[] = [];
  let done = 0;
  let now = 0;

  const tryStart = () => {
    for (let q = 0; q < queueCount; q++) {
      if (running[q] !== null || queueFreeAt[q] > now) continue;
      const kind = queueKind(q);
      const key = ready[kind].shift();
      if (key === undefined) continue;
      const node = nodes.get(key)!;
      const d = effectiveDuration(node, opts, completedResearch);
      const task: ScheduledTask = {
        key, kind, queue: q, startSec: now, endSec: now + d, durationSec: d,
      };
      running[q] = { task };
      result.push(task);
    }
  };

  tryStart();
  while (done < nodes.size) {
    const active = running.filter((r): r is { task: ScheduledTask } => r !== null);
    if (active.length === 0) throw new Error('deadlock: no runnable task (cycle in deps?)');
    now = Math.min(...active.map((r) => r.task.endSec));
    for (let q = 0; q < queueCount; q++) {
      const r = running[q];
      if (r && r.task.endSec <= now) {
        running[q] = null;
        queueFreeAt[q] = now;
        done++;
        const completedNode = nodes.get(r.task.key)!;
        if (completedNode.kind === 'research') {
          completedResearch[completedNode.id] = Math.max(
            completedResearch[completedNode.id] ?? 0,
            completedNode.level,
          );
        }
        for (const dep of dependents.get(r.task.key) ?? []) {
          const left = pendingDeps.get(dep)! - 1;
          pendingDeps.set(dep, left);
          if (left === 0) pushReady(dep);
        }
      }
    }
    tryStart();
  }
  return result.sort((a, b) => a.startSec - b.startSec);
}
