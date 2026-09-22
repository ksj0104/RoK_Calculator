import type { Dispatch } from 'react';
import type { UserState } from '../engine/types';
import { type SpeedupType } from '../engine/types';
import { useLang } from '../i18n/useLang';
import type { Action } from '../state/userState';

const TYPES: SpeedupType[] = ['universal', 'building', 'research'];
const DAY = 86_400;
const HOUR = 3_600;
const MINUTE = 60;

export function SpeedupPanel({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t } = useLang();

  return (
    <div className="speedup-panel">
      <p className="field-note">{t('city.speedupNote')}</p>
      {TYPES.map((type) => {
        const total = state.speedups[type];
        const parts = {
          d: Math.floor(total / DAY),
          h: Math.floor((total % DAY) / HOUR),
          m: Math.floor((total % HOUR) / MINUTE),
        };
        const set = (next: Partial<typeof parts>) => dispatch({
          type: 'setSpeedup', speedupType: type,
          seconds: ({ ...parts, ...next }).d * DAY
            + ({ ...parts, ...next }).h * HOUR
            + ({ ...parts, ...next }).m * MINUTE,
        });
        return (
          <label key={type} className="speedup-row">
            <span>{t(`speedup.${type}`)}</span>
            <span className="number-field">
              <input type="number" min={0} max={999} value={parts.d}
                aria-label={`${t(`speedup.${type}`)} ${t('unit.day')}`}
                onChange={(e) => set({ d: Number(e.target.value) })} />{t('unit.day')}
              <input type="number" min={0} max={23} value={parts.h}
                aria-label={`${t(`speedup.${type}`)} ${t('unit.hour')}`}
                onChange={(e) => set({ h: Number(e.target.value) })} />{t('unit.hour')}
              <input type="number" min={0} max={59} value={parts.m}
                aria-label={`${t(`speedup.${type}`)} ${t('unit.min')}`}
                onChange={(e) => set({ m: Number(e.target.value) })} />{t('unit.min')}
            </span>
          </label>
        );
      })}
    </div>
  );
}
