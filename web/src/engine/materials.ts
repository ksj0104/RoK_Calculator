import type { NodeKind } from './types';

/** 자원(식량/목재/석재/금화) 외에 업그레이드에 필요한 특수 재화.
 *  위키 스크래핑 대상이 아니므로 buildings.json이 아니라 여기서 손으로 관리한다
 *  (scrape_wiki.py가 데이터 파일을 다시 만들기 때문). */
export type MaterialId = 'covenant' | 'arrow' | 'blueprint';

/** 재화 1개당 보석 환산가 */
export const MATERIAL_GEMS: Record<MaterialId, number> = {
  covenant: 10,   // 계약의 서
  arrow: 10,      // 저항의 화살
  blueprint: 2000, // 청사진
};

export const MATERIAL_IDS: MaterialId[] = ['covenant', 'arrow', 'blueprint'];

export type MaterialCount = Partial<Record<MaterialId, number>>;

/** 성·경계탑을 해당 레벨로 올릴 때 필요한 개수 (목표 레벨 → 수량) */
const SPECIAL_BY_LEVEL: Record<number, number> = {
  2: 2, 3: 5, 4: 8, 5: 15, 6: 24, 7: 30, 8: 40, 9: 50, 10: 70,
  11: 80, 12: 100, 13: 125, 14: 150, 15: 300, 16: 500, 17: 700,
  18: 900, 19: 1200, 20: 1500, 21: 1800, 22: 2000, 23: 2500,
  24: 3000, 25: 5000,
};

/** 특수 재화를 쓰는 건물 */
const SPECIAL_MATERIAL: Record<string, MaterialId> = {
  castle: 'covenant',
  watchtower: 'arrow',
};

/** 모든 건물은 24→25에 청사진 1개가 든다. */
const BLUEPRINT_LEVEL = 25;

export function materialsForLevel(kind: NodeKind, id: string, level: number): MaterialCount {
  if (kind !== 'building') return {};
  const result: MaterialCount = {};
  const special = SPECIAL_MATERIAL[id];
  if (special) {
    const count = SPECIAL_BY_LEVEL[level];
    if (count) result[special] = count;
  }
  if (level === BLUEPRINT_LEVEL) result.blueprint = 1;
  return result;
}

export function sumMaterials(counts: MaterialCount[]): MaterialCount {
  const total: MaterialCount = {};
  for (const count of counts) {
    for (const id of MATERIAL_IDS) {
      const value = count[id];
      if (value) total[id] = (total[id] ?? 0) + value;
    }
  }
  return total;
}

export function materialGems(count: MaterialCount): number {
  return MATERIAL_IDS.reduce((sum, id) => sum + (count[id] ?? 0) * MATERIAL_GEMS[id], 0);
}
