import { catalogIndex, iconUrl } from '../catalog';
import { splitByMet, transitiveRequirements } from '../engine/requirements';
import type { NodeKind, UserState } from '../engine/types';
import { useLang } from '../i18n/useLang';

/** 선행의 선행까지 포함한 전체 선행 조건. 미충족을 앞에, 이미 갖춘 것은 흐리게 보여준다.
 *  limit을 주면 그만큼만 칩으로 보여주고 나머지는 "+N"으로 접는다(좁은 호버 카드용). */
export function RequirementBlock({ kind, id, level, state, limit, className }: {
  kind: NodeKind; id: string; level: number;
  state: UserState; limit?: number; className: string;
}) {
  const { t, name } = useLang();
  const { missing, met } = splitByMet(
    transitiveRequirements(catalogIndex, kind, id, level), state);
  const ordered = [...missing, ...met];
  const shown = limit === undefined ? ordered : ordered.slice(0, limit);
  const hidden = ordered.length - shown.length;
  const missingKeys = new Set(missing.map((req) => `${req.type}:${req.id}`));

  return (
    <div className={className}>
      <span>
        {t('goals.requires')}
        {ordered.length > 0 && (
          <em className={missing.length > 0 ? 'req-count-missing' : 'req-count-met'}>
            {missing.length > 0
              ? t('goals.requiresMissing', { n: missing.length })
              : t('goals.requiresAllMet')}
          </em>
        )}
      </span>
      {ordered.length === 0 ? <em className="req-none">{t('goals.requiresNone')}</em> : (
        <>
          {shown.map((req) => (
            <span key={`${req.type}:${req.id}`}
              className={`req-chip ${missingKeys.has(`${req.type}:${req.id}`) ? 'missing' : 'met'}`}>
              <img src={iconUrl(req.type, req.id)} alt="" loading="lazy" />
              {name(req.id)} {t('level')}{req.level}
            </span>
          ))}
          {hidden > 0 && <span className="req-chip more">+{hidden}</span>}
        </>
      )}
    </div>
  );
}
