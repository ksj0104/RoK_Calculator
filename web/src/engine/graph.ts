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
