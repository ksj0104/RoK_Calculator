import { useState, type Dispatch } from 'react';
import { iconUrl, research } from '../catalog';
import type { UserState } from '../engine/types';
import { useLang } from '../i18n/useLang';
import type { Action } from '../state/userState';

export function ResearchTree({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t, name } = useLang();
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
              {items.filter((r) => Number((r as CatalogWithTier).tier) === tier).map((r) => (
                <label className="level-card" key={r.id}>
                  <img src={iconUrl('research', r.id)} alt="" loading="lazy" />
                  <span className="card-name">{name(r.id)}</span>
                  <select aria-label={`${name(r.id)} ${t('level')}`}
                    value={state.research[r.id] ?? 0}
                    onChange={(e) => dispatch({ type: 'setResearch', id: r.id, level: Number(e.target.value) })}
                  >
                    {Array.from({ length: r.maxLevel + 1 }, (_, i) => (
                      <option key={i} value={i}>{t('level')}{i}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type CatalogWithTier = { tier?: number };
