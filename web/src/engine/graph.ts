import type { CatalogEntry, NodeKind, TaskNode } from './types';
import { nodeId } from './types';

export interface CatalogIndex {
  get(kind: NodeKind, id: string): CatalogEntry | undefined;
  makeNode(kind: NodeKind, id: string, level: number): TaskNode;
  all(): CatalogEntry[];
}

export function buildIndex(entries: CatalogEntry[]): CatalogIndex {
  const map = new Map<string, CatalogEntry>();
  for (const e of entries) map.set(`${e.kind}:${e.id}`, e);

  const get = (kind: NodeKind, id: string) => map.get(`${kind}:${id}`);

  const makeNode = (kind: NodeKind, id: string, level: number): TaskNode => {
    const entry = get(kind, id);
    const row = entry?.levels.find((l) => l.level === level);
    if (!entry || !row) throw new Error(`unknown node ${kind}:${id}:${level}`);
    const deps: string[] = [];
    if (level > 1) deps.push(nodeId(kind, id, level - 1));
    for (const req of row.requirements) {
      if (get(req.type, req.id)) deps.push(nodeId(req.type, req.id, req.level));
    }
    return { key: nodeId(kind, id, level), kind, id, level,
             timeSec: row.timeSec, cost: row.cost, power: row.power, deps };
  };

  return { get, makeNode, all: () => entries };
}

/**
 * 해당 레벨로 올릴 때 실제로 얻는 전투력.
 * 카탈로그의 power는 그 레벨에서의 누적 전투력이므로 직전 레벨과의 차이가 증가분이다.
 */
export function powerGain(entry: CatalogEntry, level: number): number {
  const at = (l: number) => entry.levels.find((row) => row.level === l)?.power ?? 0;
  return at(level) - at(level - 1);
}
