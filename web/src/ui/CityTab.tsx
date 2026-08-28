import type { Dispatch } from 'react';
import { buildings, iconUrl } from '../catalog';
import type { UserState } from '../engine/types';
import { useLang } from '../i18n/useLang';
import type { Action } from '../state/userState';
import { ResearchTree } from './ResearchTree';
import { SpeedupPanel } from './SpeedupPanel';

const CATEGORIES = ['other', 'economic', 'military'] as const;

export function CityTab({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t, name } = useLang();
  const configuredBuildings = Object.values(state.buildings).filter((level) => level > 0).length;
  const configuredResearch = Object.values(state.research).filter((level) => level > 0).length;
  return (
    <div className="city-tab">
      <p className="drawer-intro">{t('city.intro')}</p>
      <details className="drawer-section" open>
        <summary>
          <span><span className="section-icon">▦</span>{t('city.buildings')}</span>
          <span className="summary-count">{configuredBuildings}</span>
        </summary>
        <div className="drawer-section-body">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="city-category">
              <h3>{t(cat === 'other' ? 'category.other' : `tree.${cat}`)}</h3>
              <div className="building-grid">
                {buildings.filter((b) => b.category === cat).map((b) => (
                  <label className="level-card" key={b.id}>
                    <img src={iconUrl('building', b.id)} alt="" loading="lazy" />
                    <span className="card-name">{name(b.id)}</span>
                    <select
                      aria-label={`${name(b.id)} ${t('level')}`}
                      value={state.buildings[b.id] ?? 0}
                      onChange={(e) => dispatch({ type: 'setBuilding', id: b.id, level: Number(e.target.value) })}
                    >
                      {Array.from({ length: b.maxLevel + 1 }, (_, i) => (
                        <option key={i} value={i}>{t('level')}{i}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
      <details className="drawer-section">
        <summary>
          <span><span className="section-icon">⌘</span>{t('city.research')}</span>
          <span className="summary-count">{configuredResearch}</span>
        </summary>
        <div className="drawer-section-body"><ResearchTree state={state} dispatch={dispatch} /></div>
      </details>
      <details className="drawer-section">
        <summary><span><span className="section-icon">»</span>{t('city.speedups')}</span></summary>
        <div className="drawer-section-body"><SpeedupPanel state={state} dispatch={dispatch} /></div>
      </details>
      <details className="drawer-section">
        <summary><span><span className="section-icon">✦</span>{t('city.buffs')}</span></summary>
        <div className="drawer-section-body buff-fields">
          <p className="field-note">{t('city.buffNote')}</p>
          <label><span>{t('city.buildingSpeed')}</span>
            <span className="number-field"><input type="number" min={0} max={500}
              value={state.buffs.buildingSpeedPct}
              onChange={(e) => dispatch({ type: 'setBuff', key: 'buildingSpeedPct', value: Number(e.target.value) })} />%</span>
          </label>
          <label><span>{t('city.researchSpeed')}</span>
            <span className="number-field"><input type="number" min={0} max={500}
              value={state.buffs.researchSpeedPct}
              onChange={(e) => dispatch({ type: 'setBuff', key: 'researchSpeedPct', value: Number(e.target.value) })} />%</span>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={state.secondBuilder}
              onChange={(e) => dispatch({ type: 'setSecondBuilder', value: e.target.checked })} />
            <span>{t('city.secondBuilder')}</span>
          </label>
          <button className="danger-button" onClick={() => dispatch({ type: 'reset' })}>{t('city.reset')}</button>
        </div>
      </details>
    </div>
  );
}
