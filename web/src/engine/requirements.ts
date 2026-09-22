import type { CatalogIndex } from './graph';
import type { NodeKind, Requirement, UserState } from './types';

/** 선행의 선행까지 모두 따라가 항목별 최고 요구 레벨로 합친다. 뿌리 항목 자신은 제외.
 *  closure.ts의 requiredNodes와 달리 보유 레벨과 무관하게 "이 레벨에 필요한 전부"를 구한다. */
export function transitiveRequirements(
  index: CatalogIndex, kind: NodeKind, id: string, level: number,
): Requirement[] {
  const best = new Map<string, Requirement>();
  const visitedUpTo = new Map<string, number>();  // 항목별로 이미 처리한 최고 레벨
  const stack: Array<{ kind: NodeKind; id: string; level: number }> = [{ kind, id, level }];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const itemKey = `${current.kind}:${current.id}`;
    if ((visitedUpTo.get(itemKey) ?? 0) >= current.level) continue;
    visitedUpTo.set(itemKey, current.level);

    const entry = index.get(current.kind, current.id);
    if (!entry) continue;
    for (const row of entry.levels) {
      if (row.level > current.level) continue;
      for (const req of row.requirements) {
        if (!index.get(req.type, req.id)) continue;
        stack.push({ kind: req.type, id: req.id, level: req.level });
        if (req.type === kind && req.id === id) continue;
        const key = `${req.type}:${req.id}`;
        const previous = best.get(key);
        if (!previous || req.level > previous.level) best.set(key, req);
      }
    }
  }

  return [...best.values()].sort((a, b) => (a.type === b.type
    ? a.id.localeCompare(b.id)
    : (a.type === 'building' ? -1 : 1)));
}

const achievedLevel = (state: UserState, req: Requirement): number =>
  (req.type === 'building' ? state.buildings[req.id] : state.research[req.id]) ?? 0;

/** 현재 보유 레벨 기준으로 아직 필요한 것과 이미 갖춘 것을 나눈다. 각 그룹은 입력 순서를 유지한다. */
export function splitByMet(
  requirements: Requirement[], state: UserState,
): { missing: Requirement[]; met: Requirement[] } {
  const missing: Requirement[] = [];
  const met: Requirement[] = [];
  for (const req of requirements) {
    (achievedLevel(state, req) >= req.level ? met : missing).push(req);
  }
  return { missing, met };
}
