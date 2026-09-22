import type { Goal, UserState } from '../engine/types';
import { MATERIAL_IDS } from '../engine/materials';
import { SPEEDUP_DURATIONS, defaultUserState, emptyMaterials, emptySpeedups } from '../engine/types';

export interface BackupFile {
  version: 1;
  state: UserState;
  goals: Goal[];
}

export function buildExport(state: UserState, goals: Goal[]): BackupFile {
  return { version: 1, state, goals };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const nonNegativeInteger = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** 총 보유 시간(초). 예전 { '1m': 2, '3h': 1 } 개수 방식 저장값도 합산해 받아들인다. */
function speedupSeconds(value: unknown): number {
  if (typeof value === 'number') return nonNegativeInteger(value);
  if (!isPlainObject(value)) return 0;
  let total = 0;
  for (const [unit, count] of Object.entries(value)) {
    const unitSec = SPEEDUP_DURATIONS[unit];
    if (unitSec) total += unitSec * nonNegativeInteger(count);
  }
  return total;
}

function levelRecord(value: unknown): Record<string, number> {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([id, level]) => [id, nonNegativeInteger(level)]));
}

export function normalizeState(raw: unknown): UserState {
  if (!isPlainObject(raw)) throw new Error('invalid');
  const defaults = defaultUserState();
  const rawSpeedups = isPlainObject(raw.speedups) ? raw.speedups : {};
  const speedups = emptySpeedups();
  for (const type of ['universal', 'building', 'research'] as const) {
    speedups[type] = speedupSeconds(rawSpeedups[type]);
  }
  const rawMaterials = isPlainObject(raw.materials) ? raw.materials : {};
  const materials = emptyMaterials();
  for (const id of MATERIAL_IDS) materials[id] = nonNegativeInteger(rawMaterials[id]);
  const rawBuffs = isPlainObject(raw.buffs) ? raw.buffs : {};
  return {
    buildings: { ...defaults.buildings, ...levelRecord(raw.buildings) },
    research: levelRecord(raw.research),
    speedups,
    materials,
    gems: nonNegativeInteger(raw.gems),
    buffs: {
      buildingSpeedPct: Math.min(500, nonNegativeInteger(rawBuffs.buildingSpeedPct)),
      researchSpeedPct: Math.min(500, nonNegativeInteger(rawBuffs.researchSpeedPct)),
      trainingSpeedPct: Math.min(500, nonNegativeInteger(rawBuffs.trainingSpeedPct)),
      allianceHelpCount: Math.min(100, nonNegativeInteger(rawBuffs.allianceHelpCount)),
      allianceHelpSec: Math.min(3600, nonNegativeInteger(rawBuffs.allianceHelpSec)),
    },
    secondBuilder: raw.secondBuilder === true,
  };
}

function isValidGoal(g: unknown): g is Goal {
  if (!isPlainObject(g)) return false;
  const { type, id, level } = g;
  return (type === 'building' || type === 'research')
    && typeof id === 'string'
    && typeof level === 'number' && Number.isInteger(level) && level >= 1;
}

export function parseImport(text: string): { state: UserState; goals: Goal[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalid');
  }
  if (!isPlainObject(parsed)) throw new Error('invalid');
  if (parsed.version !== 1) throw new Error('invalid');
  if (!Array.isArray(parsed.goals)) throw new Error('invalid');
  const state = normalizeState(parsed.state);
  const goals = parsed.goals.filter(isValidGoal);
  return { state, goals };
}

export function downloadBackup(state: UserState, goals: Goal[]): void {
  const json = JSON.stringify(buildExport(state, goals), null, 1);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `rok-calculator-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
