import troopData from '../data/troops.json';
import type { Cost, Resource } from './types';

export type TroopType = 'infantry' | 'archer' | 'cavalry' | 'siege';
export type TroopTier = 1 | 2 | 3 | 4 | 5;

export interface TrainingInput {
  troopType: TroopType;
  tier: TroopTier;
  targetPower: number;
  trainingSpeedPct: number;
  facilityLevel: number;
}

export interface TrainingResult {
  troops: number;
  actualPower: number;
  powerPerTroop: number;
  baseTimePerTroopSec: number;
  facilityId: string;
  facilityCapacity: number;
  academyLevel: number;
  batches: number;
  fullBatchTimeSec: number;
  totalTimeSec: number;
  speedupMinutes: number;
  shopGemCost: number;
  resources: Cost;
}

const resources: Resource[] = ['food', 'wood', 'stone', 'gold'];
const shopSpeedups = troopData.shopSpeedups;
const largestShopMinutes = Math.max(...shopSpeedups.map((item) => item.minutes));
const gemDpLimit = largestShopMinutes * 2;
const gemDp = new Array<number>(gemDpLimit + 1).fill(Number.POSITIVE_INFINITY);
gemDp[0] = 0;
for (let minute = 1; minute <= gemDpLimit; minute += 1) {
  for (const item of shopSpeedups) {
    if (item.minutes <= minute) {
      gemDp[minute] = Math.min(gemDp[minute], gemDp[minute - item.minutes] + item.gems);
    }
  }
}

const toNonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export function facilityCapacity(level: number): number {
  const safeLevel = Math.min(25, Math.max(1, Math.floor(toNonNegative(level))));
  return troopData.facilityCapacity[safeLevel - 1];
}

export function minimumShopGemCost(durationSec: number): number {
  const targetMinutes = Math.ceil(toNonNegative(durationSec) / 60);
  if (targetMinutes === 0) return 0;

  const fullChunks = Math.floor(targetMinutes / largestShopMinutes);
  let best = Number.POSITIVE_INFINITY;
  for (let chunks = Math.max(0, fullChunks - 1); chunks <= fullChunks + 1; chunks += 1) {
    const remainder = Math.max(0, targetMinutes - chunks * largestShopMinutes);
    if (remainder === 0) {
      best = Math.min(best, chunks * 40_000);
      continue;
    }
    const maxCovered = Math.min(gemDpLimit, remainder + largestShopMinutes);
    for (let covered = remainder; covered <= maxCovered; covered += 1) {
      best = Math.min(best, chunks * 40_000 + gemDp[covered]);
    }
  }
  return best;
}

export function calculateTraining(input: TrainingInput): TrainingResult {
  const tier = troopData.tiers[String(input.tier) as keyof typeof troopData.tiers];
  const type = troopData.types[input.troopType];
  const unitCost = type.costs[String(input.tier) as keyof typeof type.costs];
  const targetPower = Math.ceil(toNonNegative(input.targetPower));
  const troops = targetPower === 0 ? 0 : Math.ceil(targetPower / tier.power);
  const actualPower = troops * tier.power;
  const capacity = facilityCapacity(input.facilityLevel);
  const speedMultiplier = 1 + toNonNegative(input.trainingSpeedPct) / 100;
  const batches = troops === 0 ? 0 : Math.ceil(troops / capacity);
  const fullBatches = Math.floor(troops / capacity);
  const remainder = troops % capacity;
  const batchTime = (count: number): number => Math.ceil(count * tier.timeSec / speedMultiplier);
  const fullBatchTimeSec = batchTime(capacity);
  const totalTimeSec = fullBatches * fullBatchTimeSec + (remainder > 0 ? batchTime(remainder) : 0);
  const totalResources = Object.fromEntries(resources.map((resource) => [
    resource, unitCost[resource] * troops,
  ])) as unknown as Cost;

  return {
    troops,
    actualPower,
    powerPerTroop: tier.power,
    baseTimePerTroopSec: tier.timeSec,
    facilityId: type.facility,
    facilityCapacity: capacity,
    academyLevel: tier.academyLevel,
    batches,
    fullBatchTimeSec,
    totalTimeSec,
    speedupMinutes: Math.ceil(totalTimeSec / 60),
    shopGemCost: minimumShopGemCost(totalTimeSec),
    resources: totalResources,
  };
}
