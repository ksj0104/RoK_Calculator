import { useEffect, useReducer } from 'react';
import type { SpeedupType, UserState } from '../engine/types';
import { defaultUserState } from '../engine/types';

const STORAGE_KEY = 'rok-calculator-state-v1';

export type Action =
  | { type: 'setBuilding'; id: string; level: number }
  | { type: 'setResearch'; id: string; level: number }
  | { type: 'setSpeedup'; speedupType: SpeedupType; duration: string; count: number }
  | { type: 'setBuff'; key: 'buildingSpeedPct' | 'researchSpeedPct'; value: number }
  | { type: 'setSecondBuilder'; value: boolean }
  | { type: 'reset' }
  | { type: 'replace'; state: UserState };

export function reducer(state: UserState, action: Action): UserState {
  switch (action.type) {
    case 'setBuilding':
      return { ...state, buildings: { ...state.buildings, [action.id]: action.level } };
    case 'setResearch':
      return { ...state, research: { ...state.research, [action.id]: action.level } };
    case 'setSpeedup':
      return { ...state, speedups: { ...state.speedups,
        [action.speedupType]: { ...state.speedups[action.speedupType], [action.duration]: action.count } } };
    case 'setBuff':
      return { ...state, buffs: { ...state.buffs, [action.key]: action.value } };
    case 'setSecondBuilder':
      return { ...state, secondBuilder: action.value };
    case 'reset':
      return defaultUserState();
    case 'replace':
      return action.state;
  }
}

function load(): UserState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultUserState(), ...JSON.parse(raw) };
  } catch { /* 손상된 저장값은 무시 */ }
  return defaultUserState();
}

export function useUserState() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  return [state, dispatch] as const;
}
