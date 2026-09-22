import { MATERIAL_IDS, materialsForLevel } from '../engine/materials';
import type { CatalogEntry, LevelData, Resource, UserState } from '../engine/types';
import { useLang } from '../i18n/useLang';
import { effectLabel } from './effects';
import { formatDuration, formatNumber } from './format';
import { RequirementBlock } from './RequirementBlock';

const RESOURCES: Resource[] = ['food', 'wood', 'stone', 'gold'];
const HOVER_CHIP_LIMIT = 10;

/** 특정 레벨의 소요 시간·자원·전투력·효과·선행 조건을 담은 호버 카드 내용. */
export function LevelInfoCard({ entry, row, state, isMax = false, durationSec }: {
  entry: CatalogEntry; row: LevelData; state: UserState; isMax?: boolean; durationSec?: number;
}) {
  const { t, name } = useLang();
  const materials = materialsForLevel(entry.kind, entry.id, row.level);
  const materialText = MATERIAL_IDS.filter((id) => (materials[id] ?? 0) > 0)
    .map((id) => `${t(`material.${id}`)} ${formatNumber(materials[id]!)}`).join(' · ');
  const costText = RESOURCES.filter((res) => row.cost[res] > 0)
    .map((res) => `${t(`res.${res}`)} ${formatNumber(row.cost[res])}`).join(' · ');
  return (
    <>
      <div className="info-card-head">
        <strong>{name(entry.id)}</strong>
        <span>{t('level')}{row.level}{isMax ? ` · ${t('tip.max')}` : ''}</span>
      </div>
      {entry.kind === 'research' && (
        <div className="info-card-row"><span>{t('goals.effect')}</span>
          <b>{effectLabel(entry.effectName, t)}{row.effect ? ` ${row.effect}` : ''}</b></div>
      )}
      <div className="info-card-row"><span>{t('result.duration')}</span>
        <b>{formatDuration(durationSec ?? row.timeSec, t)}</b></div>
      <div className="info-card-row"><span>{t('tip.cost')}</span><b>{costText || '—'}</b></div>
      {materialText && (
        <div className="info-card-row"><span>{t('result.materials')}</span><b>{materialText}</b></div>
      )}
      <div className="info-card-row"><span>{t('result.totalPower')}</span><b>+{formatNumber(row.power)}</b></div>
      <RequirementBlock className="info-card-reqs" kind={entry.kind} id={entry.id}
        level={row.level} state={state} limit={HOVER_CHIP_LIMIT} />
    </>
  );
}
