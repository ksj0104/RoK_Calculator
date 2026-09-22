import { useEffect, useReducer } from 'react';
import type { Requirement, SpeedupType, UserState } from '../engine/types';
import { defaultUserState } from '../engine/types';
import { normalizeState } from './persistence';

const STORAGE_KEY = 'rok-calculator-state-v1';

export type Action =
  | { type: 'setBuilding'; id: string; level: number; implied?: Requirement[] }
  | { type: 'setResearch'; id: string; level: number; implied?: Requirement[] }
  | { type: 'setSpeedup'; speedupType: SpeedupType; seconds: number }
  | { type: 'setBuff'; key: keyof UserState['buffs']; value: number }
  | { type: 'setSecondBuilder'; value: boolean }
  | { type: 'reset' }
  | { type: 'replace'; state: UserState };

const nonNegativeInteger = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const BUFF_MAX: Record<keyof UserState['buffs'], number> = {
  buildingSpeedPct: 500, researchSpeedPct: 500, trainingSpeedPct: 500,
  allianceHelpCount: 100, allianceHelpSec: 3600,
};

/** 선행 조건을 max(현재, 필요) 로 끌어올린다. 이미 더 높은 레벨은 내리지 않는다. */
function withImplied(state: UserState, implied: Requirement[] | undefined): UserState {
  if (!implied || implied.length === 0) return state;
  const buildings = { ...state.buildings };
  const research = { ...state.research };
  for (const req of implied) {
    const target = req.type === 'building' ? buildings : research;
    target[req.id] = Math.max(target[req.id] ?? 0, nonNegativeInteger(req.level));
  }
  return { ...state, buildings, research };
}

export function reducer(state: UserState, action: Action): UserState {
  switch (action.type) {
    case 'setBuilding':
      return withImplied(
        { ...state, buildings: { ...state.buildings, [action.id]: nonNegativeInteger(action.level) } },
        action.implied);
    case 'setResearch':
      return withImplied(
        { ...state, research: { ...state.research, [action.id]: nonNegativeInteger(action.level) } },
        action.implied);
    case 'setSpeedup':
      return { ...state, speedups: { ...state.speedups,
        [action.speedupType]: nonNegativeInteger(action.seconds) } };
    case 'setBuff':
      return { ...state, buffs: { ...state.buffs,
        [action.key]: Math.min(BUFF_MAX[action.key], nonNegativeInteger(action.value)) } };
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
    if (raw) return normalizeState(JSON.parse(raw));
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
