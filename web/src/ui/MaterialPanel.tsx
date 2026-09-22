import type { Dispatch } from 'react';
import type { MaterialId } from '../engine/materials';
import type { UserState } from '../engine/types';
import { useLang } from '../i18n/useLang';
import type { Action } from '../state/userState';

/** 보유량을 입력받는 재화. 청사진은 보유 개념이 아니라 제외한다. */
const OWNED_MATERIALS: MaterialId[] = ['covenant', 'arrow'];

export function MaterialPanel({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t } = useLang();
  return (
    <div className="speedup-panel">
      <p className="field-note">{t('city.materialNote')}</p>
      {OWNED_MATERIALS.map((id) => (
        <label key={id} className="speedup-row">
          <span>{t(`material.${id}`)}</span>
          <span className="number-field">
            <input type="number" min={0} value={state.materials[id]}
              aria-label={t(`material.${id}`)}
              onChange={(e) => dispatch({ type: 'setMaterial', material: id, count: Number(e.target.value) })} />
          </span>
        </label>
      ))}
      <label className="speedup-row">
        <span>{t('material.gems')}</span>
        <span className="number-field">
          <input type="number" min={0} value={state.gems}
            aria-label={t('material.gems')}
            onChange={(e) => dispatch({ type: 'setGems', count: Number(e.target.value) })} />
        </span>
      </label>
    </div>
  );
}
