import { useState, type Dispatch } from 'react';
import { catalogIndex, iconUrl, research } from '../catalog';
import { transitiveRequirements } from '../engine/requirements';
import type { UserState } from '../engine/types';
import { useLang } from '../i18n/useLang';
import type { Action } from '../state/userState';
import { effectLabel, effectRange } from './effects';
import { LevelInfoCard } from './InfoHover';
import { LevelStepper } from './LevelStepper';
import { useInfoTip } from './useInfoTip';
import { upgradeTarget } from './levelInfo';

export function ResearchTree({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t, name } = useLang();
  const { bind, portal } = useInfoTip();
  const trees = ['economic', 'military'] as const;
  const [activeTree, setActiveTree] = useState<(typeof trees)[number]>('economic');
  const items = research.filter((r) => r.category === activeTree);
  const tiers = [...new Set(items.map((r) => Number((r as CatalogWithTier).tier)))].sort((a, b) => a - b);
  return (
    <div className="research-trees">
      <div className="segmented compact-segmented">
        {trees.map((tree) => (
          <button key={tree} className={activeTree === tree ? 'active' : ''}
            onClick={() => setActiveTree(tree)}>{t(`tree.${tree}`)}</button>
        ))}
      </div>
      <div className="research-tree">
        {tiers.map((tier) => (
          <div className="city-category" key={tier}>
            <h3>{t('tree.tier', { n: tier })}</h3>
            <div className="building-grid">
              {items.filter((r) => Number((r as CatalogWithTier).tier) === tier).map((r) => {
                const label = effectLabel(r.effectName, t);
                const range = effectRange(r);
                const effectText = range ? `${label} ${range}` : label;
                const level = state.research[r.id] ?? 0;
                const target = upgradeTarget(r, level);
                return (
                <div className="level-card" key={r.id}
                  {...(target ? bind(r.id,
                    <LevelInfoCard entry={r} row={target.row} isMax={target.isMax} state={state} />) : {})}>
                  <img src={iconUrl('research', r.id)} alt="" loading="lazy" />
                  <span className="card-name">{name(r.id)}</span>
                  <span className="card-effect" title={effectText}>{effectText}</span>
                  <LevelStepper value={level} max={r.maxLevel}
                    label={`${name(r.id)} ${t('level')}`}
                    onChange={(next) => dispatch({ type: 'setResearch', id: r.id, level: next,
                      implied: transitiveRequirements(catalogIndex, 'research', r.id, next) })} />
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {portal}
    </div>
  );
}

type CatalogWithTier = { tier?: number };
