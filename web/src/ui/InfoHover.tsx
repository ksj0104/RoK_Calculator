import { iconUrl } from '../catalog';
import type { CatalogEntry, LevelData, Resource } from '../engine/types';
import { useLang } from '../i18n/useLang';
import { effectLabel } from './effects';
import { formatDuration, formatNumber } from './format';

const RESOURCES: Resource[] = ['food', 'wood', 'stone', 'gold'];

/** 특정 레벨의 소요 시간·자원·전투력·효과·선행 조건을 담은 호버 카드 내용. */
export function LevelInfoCard({ entry, row, isMax = false, durationSec }: {
  entry: CatalogEntry; row: LevelData; isMax?: boolean; durationSec?: number;
}) {
  const { t, name } = useLang();
  const requirements = row.requirements.filter(
    (req) => !(req.type === entry.kind && req.id === entry.id));
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
      <div className="info-card-row"><span>{t('result.totalPower')}</span><b>+{formatNumber(row.power)}</b></div>
      {requirements.length > 0 && (
        <div className="info-card-reqs">
          <span>{t('goals.requires')}</span>
          {requirements.map((req) => (
            <span className="req-chip" key={`${req.type}:${req.id}`}>
              <img src={iconUrl(req.type, req.id)} alt="" />
              {name(req.id)} {t('level')}{req.level}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
