import type { Dispatch } from 'react';
import { iconUrl, research } from '../catalog';
import type { UserState } from '../engine/types';
import { useLang } from '../i18n';
import type { Action } from '../state/userState';

export function ResearchTree({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t, name } = useLang();
  const trees = ['economic', 'military'] as const;
  return (
    <div className="research-trees">
      {trees.map((tree) => {
        const items = research.filter((r) => r.category === tree);
        const tiers = [...new Set(items.map((r: any) => r.tier as number))].sort((a, b) => a - b);
        return (
          <div key={tree} className="research-tree">
            <h3>{t(`tree.${tree}`)}</h3>
            {tiers.map((tier) => (
              <div className="tier-row" key={tier}>
                {items.filter((r: any) => r.tier === tier).map((r) => (
                  <div className="card small" key={r.id}>
                    <img src={iconUrl('research', r.id)} alt={name(r.id)} loading="lazy" />
                    <div className="card-name">{name(r.id)}</div>
                    <select
                      value={state.research[r.id] ?? 0}
                      onChange={(e) => dispatch({ type: 'setResearch', id: r.id, level: Number(e.target.value) })}
                    >
                      {Array.from({ length: r.maxLevel + 1 }, (_, i) => (
                        <option key={i} value={i}>{t('level')}{i}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
