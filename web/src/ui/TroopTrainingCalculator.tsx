import { useMemo, useState, type Dispatch } from 'react';
import { iconUrl } from '../catalog';
import troopData from '../data/troops.json';
import { calculateTraining, type TroopTier, type TroopType } from '../engine/training';
import { trainingTechnologyBonus } from '../engine/speedBonuses';
import type { Resource, UserState } from '../engine/types';
import { useLang } from '../i18n/useLang';
import type { Action } from '../state/userState';
import { formatDuration } from './format';

const troopTypes: TroopType[] = ['infantry', 'archer', 'cavalry', 'siege'];
const tiers: TroopTier[] = [1, 2, 3, 4, 5];
const resources: Resource[] = ['food', 'wood', 'stone', 'gold'];

export function TroopTrainingCalculator({ state, dispatch }: {
  state: UserState;
  dispatch: Dispatch<Action>;
}) {
  const { t, name, lang } = useLang();
  const [troopType, setTroopType] = useState<TroopType>('infantry');
  const [tier, setTier] = useState<TroopTier>(4);
  const [targetMode, setTargetMode] = useState<'power' | 'troops'>('power');
  const [targetPower, setTargetPower] = useState(100_000);
  const [targetTroops, setTargetTroops] = useState(25_000);
  const facilityId = troopData.types[troopType].facility;
  const facilityLevel = Math.min(25, Math.max(1, state.buildings[facilityId] ?? 0));
  const technologySpeedPct = trainingTechnologyBonus(state.research);
  const totalTrainingSpeedPct = state.buffs.trainingSpeedPct + technologySpeedPct;
  const powerPerTroop = troopData.tiers[String(tier) as keyof typeof troopData.tiers].power;
  const calculatedTargetPower = targetMode === 'power' ? targetPower : targetTroops * powerPerTroop;
  const result = useMemo(() => calculateTraining({
    troopType,
    tier,
    targetPower: calculatedTargetPower,
    trainingSpeedPct: totalTrainingSpeedPct,
    facilityLevel,
  }), [calculatedTargetPower, facilityLevel, tier, totalTrainingSpeedPct, troopType]);
  const number = (value: number) => new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US').format(value);
  const academyLevel = state.buildings.academy ?? 0;

  return (
    <div className="training-workspace">
      <section className="training-hero">
        <div>
          <span className="eyebrow">TROOP PRODUCTION</span>
          <h2>{t('training.title')}</h2>
          <p>{t('training.description')}</p>
        </div>
        <div className="training-target">
          <div className="training-target-switch" role="group" aria-label={t('training.targetMode')}>
            <button className={targetMode === 'power' ? 'active' : ''} onClick={() => {
              setTargetPower(result.actualPower);
              setTargetMode('power');
            }}>{t('training.byPower')}</button>
            <button className={targetMode === 'troops' ? 'active' : ''} onClick={() => {
              setTargetTroops(result.troops);
              setTargetMode('troops');
            }}>{t('training.byTroops')}</button>
          </div>
          <label htmlFor="training-target">{targetMode === 'power'
            ? t('training.targetPower') : t('training.targetTroops')}</label>
          <input id="training-target" type="number" min={0} step={targetMode === 'power' ? 1000 : 100}
            value={targetMode === 'power' ? targetPower : targetTroops}
            onChange={(event) => {
              const value = Math.max(0, Math.floor(Number(event.target.value) || 0));
              if (targetMode === 'power') setTargetPower(value);
              else setTargetTroops(value);
            }} />
        </div>
      </section>

      <section className="training-controls">
        <div className="training-control-block">
          <span>{t('training.troopType')}</span>
          <div className="troop-type-grid">
            {troopTypes.map((type) => {
              const buildingId = troopData.types[type].facility;
              return (
                <button key={type} className={troopType === type ? 'active' : ''}
                  onClick={() => setTroopType(type)}>
                  <img src={iconUrl('building', buildingId)} alt="" />
                  <span>{t(`troop.${type}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="training-control-block">
          <span>{t('training.tier')}</span>
          <div className="tier-grid">
            {tiers.map((value) => (
              <button key={value} className={tier === value ? 'active' : ''}
                onClick={() => setTier(value)}>T{value}</button>
            ))}
          </div>
        </div>
        <div className="training-fields">
          <label>
            <span>{name(facilityId)} {t('level')}</span>
            <select value={facilityLevel} onChange={(event) => dispatch({
              type: 'setBuilding', id: facilityId, level: Number(event.target.value),
            })}>
              {Array.from({ length: 25 }, (_, index) => index + 1).map((level) => (
                <option key={level} value={level}>{t('level')}{level}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('training.speedExcludingTech')}</span>
            <span className="training-percent"><input type="number" min={0} max={500}
              value={state.buffs.trainingSpeedPct}
              onChange={(event) => dispatch({ type: 'setBuff', key: 'trainingSpeedPct',
                value: Number(event.target.value) })} />%</span>
          </label>
        </div>
        <p className="training-formula">{t('training.speedApplied', {
          total: totalTrainingSpeedPct, other: state.buffs.trainingSpeedPct, tech: technologySpeedPct,
        })} {t('training.formula')}</p>
        {academyLevel < result.academyLevel && (
          <p className="training-warning">{t('training.academyWarning', {
            required: result.academyLevel, current: academyLevel,
          })}</p>
        )}
      </section>

      <section className="training-results">
        <div className="section-heading training-result-heading">
          <div><span className="step-number">02</span><div>
            <h2>{t('training.result')}</h2>
            <p>{t('training.resultDesc', { type: t(`troop.${troopType}`), tier })}</p>
          </div></div>
        </div>
        <div className="training-stat-grid">
          <article className="primary-stat"><span>{t('training.troopsNeeded')}</span>
            <strong>{number(result.troops)}</strong><small>{t('training.actualPower', { n: number(result.actualPower) })}</small></article>
          <article><span>{t('training.speedupsNeeded')}</span><strong>{formatDuration(result.totalTimeSec, t)}</strong>
            <small>{number(result.speedupMinutes)} {t('unit.min')}</small></article>
          <article><span>{t('training.gemsNeeded')}</span><strong>{number(result.shopGemCost)}</strong>
            <small>{t('training.shopPrice')}</small></article>
          <article><span>{t('training.batches')}</span><strong>{number(result.batches)}</strong>
            <small>{t('training.capacity', { n: number(result.facilityCapacity) })}</small></article>
        </div>

        <div className="training-detail-grid">
          <article>
            <h3>{t('training.resources')}</h3>
            <div className="resource-results">
              {resources.map((resource) => (
                <div key={resource}><span>{t(`res.${resource}`)}</span><strong>{number(result.resources[resource])}</strong></div>
              ))}
            </div>
          </article>
          <article>
            <h3>{t('training.basis')}</h3>
            <dl className="training-basis">
              <div><dt>{t('training.powerPerTroop')}</dt><dd>{result.powerPerTroop}</dd></div>
              <div><dt>{t('training.baseTime')}</dt><dd>{result.baseTimePerTroopSec}{t('unit.sec')}</dd></div>
              <div><dt>{t('training.fullBatchTime')}</dt><dd>{formatDuration(result.fullBatchTimeSec, t)}</dd></div>
              <div><dt>{t('training.requiredAcademy')}</dt><dd>{t('level')}{result.academyLevel}</dd></div>
            </dl>
          </article>
        </div>
        <p className="training-note">{t('training.gemNote')}</p>
        <details className="training-sources">
          <summary>{t('training.sources')}</summary>
          <p>{t('training.sourceNote', { date: troopData.verifiedAt })}</p>
          <ul>{troopData.sources.map((source) => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul>
        </details>
      </section>
    </div>
  );
}
