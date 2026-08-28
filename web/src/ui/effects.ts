import type { CatalogEntry, Requirement } from '../engine/types';

/** 위키 효과명 → i18n 키 (예: 'Siege Unit Attack' → 'effect.siege_unit_attack') */
const effectKey = (effectName: string): string =>
  `effect.${effectName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;

/** 효과명을 현재 언어로. 번역이 없으면 위키 원문, 효과명이 없으면(병종 해금) 해금 라벨. */
export function effectLabel(
  effectName: string | null | undefined, t: (k: string) => string,
): string {
  if (!effectName) return t('effect.unlock');
  const key = effectKey(effectName);
  const translated = t(key);
  return translated === key ? effectName : translated;
}

export function effectValueAt(entry: CatalogEntry, level: number): string | null {
  return entry.levels.find((row) => row.level === level)?.effect ?? null;
}

/** 트리 카드용 'Lv1 → 최대' 요약. 수치가 없거나 문장형(긴 텍스트)이면 null. */
export function effectRange(entry: CatalogEntry): string | null {
  const values = entry.levels.map((row) => row.effect);
  if (values.some((value) => !value || value.length > 10)) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  return first === last ? first : `${first} → ${last}`;
}

/** 목표 레벨까지 필요한 직접 선행을 항목별 최고 레벨로 합산한다. 자기 자신(이전 레벨)은 제외. */
export function requirementsUpTo(entry: CatalogEntry, level: number): Requirement[] {
  const best = new Map<string, Requirement>();
  for (const row of entry.levels) {
    if (row.level > level) continue;
    for (const req of row.requirements) {
      if (req.type === entry.kind && req.id === entry.id) continue;
      const key = `${req.type}:${req.id}`;
      const previous = best.get(key);
      if (!previous || req.level > previous.level) best.set(key, req);
    }
  }
  return [...best.values()];
}
