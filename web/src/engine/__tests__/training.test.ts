import { describe, expect, it } from 'vitest';
import { calculateTraining, facilityCapacity, minimumShopGemCost, rankGemFacilityLevels,
  recommendGemBatch } from '../training';
import { trainingTechnologyBonus } from '../speedBonuses';

describe('troop training calculator', () => {
  it('converts a T4 infantry power target into troops, time, and resources', () => {
    const result = calculateTraining({
      troopType: 'infantry', tier: 4, targetPower: 100_000,
      trainingSpeedPct: 100, facilityLevel: 25,
    });

    expect(result.troops).toBe(25_000);
    expect(result.actualPower).toBe(100_000);
    expect(result.facilityId).toBe('barracks');
    expect(result.facilityCapacity).toBe(2_000);
    expect(result.batches).toBe(13);
    expect(result.totalTimeSec).toBe(1_000_000);
    expect(result.resources).toEqual({ food: 7_500_000, wood: 7_500_000, stone: 0, gold: 500_000 });
  });

  it('rounds troop count up when target power is not divisible by unit power', () => {
    const result = calculateTraining({
      troopType: 'archer', tier: 5, targetPower: 11,
      trainingSpeedPct: 0, facilityLevel: 1,
    });
    expect(result.troops).toBe(2);
    expect(result.actualPower).toBe(20);
    expect(result.resources).toEqual({ food: 0, wood: 1_600, stone: 1_200, gold: 800 });
  });

  it('applies training speed and in-game per-batch second rounding', () => {
    const result = calculateTraining({
      troopType: 'siege', tier: 1, targetPower: 21,
      trainingSpeedPct: 33, facilityLevel: 1,
    });
    expect(result.batches).toBe(2);
    expect(result.fullBatchTimeSec).toBe(226);
    expect(result.totalTimeSec).toBe(238);
  });

  it('contains the published facility capacity endpoints', () => {
    expect(facilityCapacity(1)).toBe(20);
    expect(facilityCapacity(12)).toBe(550);
    expect(facilityCapacity(25)).toBe(2_000);
  });

  it('uses the cheapest standard Shop speedups that cover the time', () => {
    expect(minimumShopGemCost(0)).toBe(0);
    expect(minimumShopGemCost(60)).toBe(3);
    expect(minimumShopGemCost(15 * 60)).toBe(40);
    expect(minimumShopGemCost(8 * 3600)).toBe(600);
    expect(minimumShopGemCost(30 * 86400)).toBe(40_000);
  });

  it('adds Military Discipline only when the user has researched it', () => {
    expect(trainingTechnologyBonus({})).toBe(0);
    expect(trainingTechnologyBonus({ military_discipline: 1 })).toBe(20);
  });

  it('prices separate facility queues separately instead of combining their time', () => {
    const result = calculateTraining({
      troopType: 'infantry', tier: 4, targetPower: 16_000,
      trainingSpeedPct: 100 / 3, facilityLevel: 25,
    });
    expect(result.troops).toBe(4_000);
    expect(result.batches).toBe(2);
    expect(result.shopGemCost).toBe(4_550);
  });

  it('finds the 24-hour price breakpoint as the efficient batch size', () => {
    const recommendation = recommendGemBatch({
      troopType: 'infantry', tier: 4, targetPower: 80_000,
      trainingSpeedPct: 100 / 3, facilityLevel: 25,
    });
    expect(recommendation.troopsPerBatch).toBe(1_440);
    expect(recommendation.timePerBatchSec).toBe(86_400);
    expect(recommendation.gemsPerBatch).toBe(1_500);
    expect(recommendation.gemSavings).toBeGreaterThan(0);
  });

  it('ranks only the current and higher facility levels by full-queue gem efficiency', () => {
    const ranking = rankGemFacilityLevels({
      troopType: 'infantry', tier: 4, targetPower: 100_000,
      trainingSpeedPct: 100 / 3, facilityLevel: 20,
    });
    expect(ranking).toHaveLength(6);
    expect(ranking.every((candidate) => candidate.level >= 20)).toBe(true);
    expect(ranking[0].level).toBe(21);
    expect(ranking[0].capacity).toBe(1_400);
    expect(ranking[0].gems).toBe(1_500);
  });
});
