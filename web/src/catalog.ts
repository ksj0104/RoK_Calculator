import buildingsJson from './data/buildings.json';
import researchJson from './data/research.json';
import type { CatalogEntry } from './engine/types';

export const buildings: CatalogEntry[] = (buildingsJson as any[]).map(
  (b) => ({ ...b, kind: 'building' as const }));
export const research: CatalogEntry[] = (researchJson as any[]).map(
  (r) => ({ ...r, kind: 'research' as const, category: r.tree }));
export const catalog: CatalogEntry[] = [...buildings, ...research];

export const iconUrl = (kind: 'building' | 'research', id: string) =>
  `${import.meta.env.BASE_URL}icons/${kind === 'building' ? 'buildings' : 'research'}/${id}.png`;
