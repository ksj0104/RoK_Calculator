import type { Dispatch } from 'react';
import { buildings, iconUrl } from '../catalog';
import type { UserState } from '../engine/types';
import { useLang } from '../i18n';
import type { Action } from '../state/userState';
import { ResearchTree } from './ResearchTree';
import { SpeedupPanel } from './SpeedupPanel';

const CATEGORIES = ['other', 'economic', 'military'] as const;

export function CityTab({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t, name } = useLang();
  return (
    <div className="city-tab">
      <section>
        <h2>{t('city.buildings')}</h2>
        {CATEGORIES.map((cat) => (
          <div key={cat}>
            <h3>{t(cat === 'other' ? 'category.other' : `tree.${cat}`)}</h3>
            <div className="building-grid">
              {buildings.filter((b) => b.category === cat).map((b) => (
                <div className="card" key={b.id}>
                  <img src={iconUrl('building', b.id)} alt={name(b.id)} loading="lazy" />
                  <div className="card-name">{name(b.id)}</div>
                  <select
                    value={state.buildings[b.id] ?? 0}
                    onChange={(e) => dispatch({ type: 'setBuilding', id: b.id, level: Number(e.target.value) })}
                  >
                    {Array.from({ length: b.maxLevel + 1 }, (_, i) => (
                      <option key={i} value={i}>{t('level')}{i}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section>
        <h2>{t('city.research')}</h2>
        <ResearchTree state={state} dispatch={dispatch} />
      </section>
      <section>
        <h2>{t('city.speedups')}</h2>
        <SpeedupPanel state={state} dispatch={dispatch} />
      </section>
      <section>
        <h2>{t('city.buffs')}</h2>
        <label>{t('city.buildingSpeed')}
          <input type="number" min={0} max={500} value={state.buffs.buildingSpeedPct}
            onChange={(e) => dispatch({ type: 'setBuff', key: 'buildingSpeedPct', value: Number(e.target.value) })} />
        </label>
        <label>{t('city.researchSpeed')}
          <input type="number" min={0} max={500} value={state.buffs.researchSpeedPct}
            onChange={(e) => dispatch({ type: 'setBuff', key: 'researchSpeedPct', value: Number(e.target.value) })} />
        </label>
        <label>
          <input type="checkbox" checked={state.secondBuilder}
            onChange={(e) => dispatch({ type: 'setSecondBuilder', value: e.target.checked })} />
          {t('city.secondBuilder')}
        </label>
        <button onClick={() => dispatch({ type: 'reset' })}>{t('city.reset')}</button>
      </section>
    </div>
  );
}
