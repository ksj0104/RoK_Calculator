import type { Dispatch } from 'react';
import type { UserState } from '../engine/types';
import { SPEEDUP_DURATIONS, type SpeedupType } from '../engine/types';
import { useLang } from '../i18n/useLang';
import type { Action } from '../state/userState';

const TYPES: SpeedupType[] = ['universal', 'building', 'research'];

export function SpeedupPanel({ state, dispatch }: { state: UserState; dispatch: Dispatch<Action> }) {
  const { t } = useLang();
  return (
    <div className="speedup-panel">
      <table>
        <thead>
          <tr><th />{Object.keys(SPEEDUP_DURATIONS).map((d) => <th key={d}>{d}</th>)}</tr>
        </thead>
        <tbody>
          {TYPES.map((type) => (
            <tr key={type}>
              <th>{t(`speedup.${type}`)}</th>
              {Object.keys(SPEEDUP_DURATIONS).map((d) => (
                <td key={d}>
                  <input type="number" min={0} value={state.speedups[type][d] ?? 0}
                    onChange={(e) => dispatch({ type: 'setSpeedup', speedupType: type, duration: d, count: Number(e.target.value) })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
