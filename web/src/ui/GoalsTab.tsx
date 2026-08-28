import { useMemo, useState } from 'react';
import { buildings, iconUrl, research } from '../catalog';
import type { CatalogEntry, Goal, NodeKind, PlanMode } from '../engine/types';
import { useLang } from '../i18n/useLang';
import { effectLabel, effectValueAt, requirementsUpTo } from './effects';

const CH_PRESETS = [8, 11, 16, 17, 21, 22, 25];

interface GoalsTabProps {
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
  mode: PlanMode;
  setMode: (mode: PlanMode) => void;
}

export function GoalsTab({ goals, setGoals, mode, setMode }: GoalsTabProps) {
  const { t, name } = useLang();
  const [kind, setKind] = useState<NodeKind>('building');
  const [selectedId, setSelectedId] = useState('city_hall');
  const [level, setLevel] = useState(1);
  const [query, setQuery] = useState('');
  const entries = kind === 'building' ? buildings : research;
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) =>
      name(entry.id).toLocaleLowerCase().includes(normalized)
      || entry.id.toLocaleLowerCase().includes(normalized));
  }, [entries, name, query]);

  const addGoal = (goal: Goal) => {
    const rest = goals.filter((item) => !(item.type === goal.type && item.id === goal.id));
    setGoals([...rest, goal]);
  };

  const chooseKind = (nextKind: NodeKind) => {
    const nextEntries = nextKind === 'building' ? buildings : research;
    setKind(nextKind);
    setSelectedId(nextEntries[0].id);
    setLevel(1);
    setQuery('');
  };

  const chooseEntry = (entry: CatalogEntry) => {
    setSelectedId(entry.id);
    const existing = goals.find((goal) => goal.type === kind && goal.id === entry.id);
    setLevel(existing?.level ?? Math.min(1, entry.maxLevel));
  };

  return (
    <div className="goals-workspace">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">ROUTE PLANNER</span>
          <h2>{t('goals.title')}</h2>
          <p>{t('goals.description')}</p>
        </div>
        <div className="mode-switch" role="radiogroup" aria-label={t('mode.title')}>
          {(['fastest', 'efficient'] as const).map((item) => (
            <button key={item} role="radio" aria-checked={mode === item}
              className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>
              <span className="mode-icon" aria-hidden="true">{item === 'fastest' ? '⚡' : '⌁'}</span>
              <span><strong>{t(`mode.${item}`)}</strong><small>{t(`mode.${item}Desc`)}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="goal-panel">
        <div className="section-heading">
          <div>
            <span className="step-number">01</span>
            <div><h2>{t('goals.choose')}</h2><p>{t('goals.chooseDesc')}</p></div>
          </div>
          <span className="selection-count">{t('goals.selectedCount', { n: goals.length })}</span>
        </div>

        <div className="preset-strip" aria-label={t('goals.presets')}>
          {CH_PRESETS.map((presetLevel) => (
            <button key={presetLevel}
              className={goals.some((goal) => goal.type === 'building' && goal.id === 'city_hall'
                && goal.level === presetLevel) ? 'active' : ''}
              onClick={() => addGoal({ type: 'building', id: 'city_hall', level: presetLevel })}>
              <img src={iconUrl('building', 'city_hall')} alt="" />
              <span>{t('goals.cityHallTo', { n: presetLevel })}</span>
            </button>
          ))}
        </div>

        <div className="catalog-toolbar">
          <div className="segmented">
            <button className={kind === 'building' ? 'active' : ''}
              onClick={() => chooseKind('building')}>{t('city.buildings')}</button>
            <button className={kind === 'research' ? 'active' : ''}
              onClick={() => chooseKind('research')}>{t('city.research')}</button>
          </div>
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={t('goals.search')} aria-label={t('goals.search')} />
          </label>
        </div>

        <div className="goal-catalog">
          {filteredEntries.map((entry) => {
            const existing = goals.find((goal) => goal.type === kind && goal.id === entry.id);
            return (
              <button key={entry.id}
                className={`goal-option ${selected.id === entry.id ? 'selected' : ''} ${existing ? 'added' : ''}`}
                onClick={() => chooseEntry(entry)}>
                <span className="goal-icon-wrap">
                  <img src={iconUrl(kind, entry.id)} alt="" loading="lazy" />
                  {existing && <span className="goal-level-badge">{existing.level}</span>}
                </span>
                <span>{name(entry.id)}</span>
                <small>{t('goals.maxLevel', { n: entry.maxLevel })}</small>
              </button>
            );
          })}
          {filteredEntries.length === 0 && <p className="empty-search">{t('goals.noMatches')}</p>}
        </div>

        <div className="goal-editor">
          <img src={iconUrl(kind, selected.id)} alt="" />
          <div className="goal-editor-name"><small>{t('goals.target')}</small><strong>{name(selected.id)}</strong></div>
          <label>{t('goals.targetLevel')}
            <select value={Math.min(level, selected.maxLevel)}
              onChange={(event) => setLevel(Number(event.target.value))}>
              {Array.from({ length: selected.maxLevel }, (_, index) => (
                <option key={index + 1} value={index + 1}>{t('level')}{index + 1}</option>
              ))}
            </select>
          </label>
          <button className="primary-button"
            onClick={() => addGoal({ type: kind, id: selected.id, level: Math.min(level, selected.maxLevel) })}>
            {t('goals.add')}
          </button>
        </div>

        <div className="goal-detail">
          {kind === 'research' && (
            <div className="goal-detail-row">
              <span>{t('goals.effect')}</span>
              <strong>
                {effectLabel(selected.effectName, t)}
                {(() => {
                  const value = effectValueAt(selected, Math.min(level, selected.maxLevel));
                  return value ? ` ${value}` : '';
                })()}
              </strong>
            </div>
          )}
          <div className="goal-detail-row">
            <span>{t('goals.requires')}</span>
            {(() => {
              const requirements = requirementsUpTo(selected, Math.min(level, selected.maxLevel));
              if (requirements.length === 0) return <em>{t('goals.requiresNone')}</em>;
              return (
                <span className="req-chips">
                  {requirements.map((req) => (
                    <span className="req-chip" key={`${req.type}:${req.id}`}>
                      <img src={iconUrl(req.type, req.id)} alt="" loading="lazy" />
                      {name(req.id)} {t('level')}{req.level}
                    </span>
                  ))}
                </span>
              );
            })()}
          </div>
        </div>
      </section>

      <section className="selected-goals-panel">
        <div className="section-heading compact-heading">
          <div><span className="step-number">02</span><div><h2>{t('goals.selected')}</h2></div></div>
        </div>
        {goals.length === 0 ? <p className="empty-state">{t('goals.empty')}</p> : (
          <div className="selected-goals">
            {goals.map((goal) => (
              <div className="selected-goal" key={`${goal.type}:${goal.id}`}>
                <img src={iconUrl(goal.type, goal.id)} alt="" />
                <span><strong>{name(goal.id)}</strong><small>{t('level')}{goal.level}</small></span>
                <button aria-label={`${name(goal.id)} ${t('goals.remove')}`}
                  onClick={() => setGoals(goals.filter((item) => item !== goal))}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
