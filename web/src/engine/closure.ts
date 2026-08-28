import type { CatalogIndex } from './graph';
import type { Goal, NodeId, NodeKind, TaskNode, UserState } from './types';
import { nodeId } from './types';

const achievedLevel = (state: UserState, kind: NodeKind, id: string): number =>
  (kind === 'building' ? state.buildings[id] : state.research[id]) ?? 0;

/** 목표 달성에 필요한 미완료 노드 전체(전이 폐소). deps는 미완료 노드로만 필터된다. */
export function requiredNodes(
  index: CatalogIndex, goals: Goal[], state: UserState,
): Map<NodeId, TaskNode> {
  const result = new Map<NodeId, TaskNode>();
  const stack: Array<{ kind: NodeKind; id: string; level: number }> = [];

  const push = (kind: NodeKind, id: string, level: number) => {
    const from = achievedLevel(state, kind, id);
    for (let l = from + 1; l <= level; l++) {
      if (!result.has(nodeId(kind, id, l))) stack.push({ kind, id, level: l });
    }
  };

  for (const g of goals) push(g.type, g.id, g.level);

  while (stack.length > 0) {
    const { kind, id, level } = stack.pop()!;
    const key = nodeId(kind, id, level);
    if (result.has(key)) continue;
    const node = index.makeNode(kind, id, level);
    result.set(key, node);
    const entry = index.get(kind, id)!;
    const row = entry.levels.find((l) => l.level === level)!;
    if (level > 1 && achievedLevel(state, kind, id) < level - 1) push(kind, id, level - 1);
    for (const req of row.requirements) {
      if (index.get(req.type, req.id) && achievedLevel(state, req.type, req.id) < req.level) {
        push(req.type, req.id, req.level);
      }
    }
  }

  // deps를 미완료 노드로 한정
  for (const node of result.values()) {
    node.deps = node.deps.filter((d) => result.has(d));
  }
  return result;
}
