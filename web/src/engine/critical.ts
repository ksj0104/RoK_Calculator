import type { NodeId, TaskNode } from './types';

/** 각 노드에 대해 "이 노드부터 최종 후속까지의 최장 경로 시간" (자기 시간 포함).
 *  스케줄러가 이 값이 큰 작업부터 큐에 넣는다. */
export function criticalWeights(
  nodes: Map<NodeId, TaskNode>, dur: (n: TaskNode) => number,
): Map<NodeId, number> {
  const memo = new Map<NodeId, number>();
  const dependents = new Map<NodeId, NodeId[]>();
  for (const n of nodes.values()) {
    for (const d of n.deps) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d)!.push(n.key);
    }
  }
  const weight = (key: NodeId): number => {
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const node = nodes.get(key)!;
    const next = dependents.get(key) ?? [];
    const best = next.length === 0 ? 0 : Math.max(...next.map(weight));
    const w = dur(node) + best;
    memo.set(key, w);
    return w;
  };
  for (const key of nodes.keys()) weight(key);
  return memo;
}
