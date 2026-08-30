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

export interface GemBatchRecommendation {
  troopsPerBatch: number;
  timePerBatchSec: number;
  gemsPerBatch: number;
  powerPerGem: number;
  targetGemCost: number;
  capacityBatchGemCost: number;
  gemSavings: number;
}

export interface GemFacilityEfficiency {
  level: number;
  capacity: number;
  timeSec: number;
  gems: number;
  powerPerGem: number;
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

function batchTimeSec(troops: number, baseTimeSec: number, trainingSpeedPct: number): number {
  const speedMultiplier = 1 + toNonNegative(trainingSpeedPct) / 100;
  return Math.ceil(troops * baseTimeSec / speedMultiplier);
}

function repeatedBatchGemCost(
  totalTroops: number,
  troopsPerBatch: number,
  baseTimeSec: number,
  trainingSpeedPct: number,
): number {
  if (totalTroops <= 0 || troopsPerBatch <= 0) return 0;
  const fullBatches = Math.floor(totalTroops / troopsPerBatch);
  const remainder = totalTroops % troopsPerBatch;
  const fullBatchGems = minimumShopGemCost(batchTimeSec(
    troopsPerBatch, baseTimeSec, trainingSpeedPct,
  ));
  const remainderGems = remainder > 0
    ? minimumShopGemCost(batchTimeSec(remainder, baseTimeSec, trainingSpeedPct)) : 0;
  return fullBatches * fullBatchGems + remainderGems;
}

export function recommendGemBatch(input: TrainingInput): GemBatchRecommendation {
  const tier = troopData.tiers[String(input.tier) as keyof typeof troopData.tiers];
  const capacity = facilityCapacity(input.facilityLevel);
  const safeTargetPower = toNonNegative(input.targetPower);
  const totalTroops = safeTargetPower <= 0 ? 0 : Math.ceil(safeTargetPower / tier.power);
  const maxBatch = Math.max(1, Math.min(capacity, totalTroops || capacity));
  let bestTroops = 1;
  let bestTime = batchTimeSec(1, tier.timeSec, input.trainingSpeedPct);
  let bestGems = minimumShopGemCost(bestTime);

  for (let troops = 2; troops <= maxBatch; troops += 1) {
    const time = batchTimeSec(troops, tier.timeSec, input.trainingSpeedPct);
    const gems = minimumShopGemCost(time);
    const isBetter = troops * bestGems > bestTroops * gems;
    const isEqualAndLarger = troops * bestGems === bestTroops * gems && troops > bestTroops;
    if (isBetter || isEqualAndLarger) {
      bestTroops = troops;
      bestTime = time;
      bestGems = gems;
    }
  }

  const targetGemCost = repeatedBatchGemCost(
    totalTroops, bestTroops, tier.timeSec, input.trainingSpeedPct,
  );
  const capacityBatchGemCost = repeatedBatchGemCost(
    totalTroops, capacity, tier.timeSec, input.trainingSpeedPct,
  );
  return {
    troopsPerBatch: bestTroops,
    timePerBatchSec: bestTime,
    gemsPerBatch: bestGems,
    powerPerGem: bestGems > 0 ? bestTroops * tier.power / bestGems : 0,
    targetGemCost,
    capacityBatchGemCost,
    gemSavings: Math.max(0, capacityBatchGemCost - targetGemCost),
  };
}

export function rankGemFacilityLevels(input: TrainingInput): GemFacilityEfficiency[] {
  const tier = troopData.tiers[String(input.tier) as keyof typeof troopData.tiers];
  const currentLevel = Math.min(25, Math.max(1, Math.floor(toNonNegative(input.facilityLevel))));
  const candidates: GemFacilityEfficiency[] = [];
  for (let level = currentLevel; level <= 25; level += 1) {
    const capacity = facilityCapacity(level);
    const timeSec = batchTimeSec(capacity, tier.timeSec, input.trainingSpeedPct);
    const gems = minimumShopGemCost(timeSec);
    candidates.push({
      level,
      capacity,
      timeSec,
      gems,
      powerPerGem: capacity * tier.power / gems,
    });
  }
  return candidates.sort((left, right) => {
    const efficiencyOrder = right.capacity * left.gems - left.capacity * right.gems;
    return efficiencyOrder || left.level - right.level;
  });
}

export function calculateTraining(input: TrainingInput): TrainingResult {
  const tier = troopData.tiers[String(input.tier) as keyof typeof troopData.tiers];
  const type = troopData.types[input.troopType];
  const unitCost = type.costs[String(input.tier) as keyof typeof type.costs];
  const targetPower = Math.ceil(toNonNegative(input.targetPower));
  const troops = targetPower === 0 ? 0 : Math.ceil(targetPower / tier.power);
  const actualPower = troops * tier.power;
  const capacity = facilityCapacity(input.facilityLevel);
  const batches = troops === 0 ? 0 : Math.ceil(troops / capacity);
  const fullBatches = Math.floor(troops / capacity);
  const remainder = troops % capacity;
  const fullBatchTimeSec = batchTimeSec(capacity, tier.timeSec, input.trainingSpeedPct);
  const remainderTimeSec = remainder > 0
    ? batchTimeSec(remainder, tier.timeSec, input.trainingSpeedPct) : 0;
  const totalTimeSec = fullBatches * fullBatchTimeSec + remainderTimeSec;
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
    shopGemCost: fullBatches * minimumShopGemCost(fullBatchTimeSec)
      + minimumShopGemCost(remainderTimeSec),
    resources: totalResources,
  };
}
