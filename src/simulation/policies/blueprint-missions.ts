import missionConfig from "../../data/config/blueprint-missions.json";
import { addModifier } from "../events/modifiers";
import { safeDivide } from "../core/math";
import type {
  BlueprintMissionState,
  GameState,
  ModifierState,
} from "../state/game-state";
import { calculateTechnologyTreeMetrics } from "../technology/technology-tree";

export type BlueprintMissionMetricId =
  | "secondary_sector_share"
  | "energy_supply_ratio"
  | "infrastructure_index"
  | "food_supply_ratio"
  | "daily_calories"
  | "stability"
  | "grain_yield"
  | "mechanization_rate"
  | "education_index"
  | "poverty_rate"
  | "happiness"
  | "literacy_rate"
  | "higher_education_rate"
  | "technology_index"
  | "completed_technologies"
  | "technology_rank"
  | "education_rank"
  | "openness"
  | "exports_to_gdp"
  | "foreign_exchange_reserves"
  | "private_mixed_share"
  | "logistics_efficiency"
  | "trade_agreements"
  | "gdp_per_capita_usd"
  | "industry_technology_tier";

export interface BlueprintMissionMetricDefinition {
  id: BlueprintMissionMetricId;
  label: string;
  comparison: "at_least" | "at_most";
  target: number;
  format: "percent" | "index" | "count" | "usd" | "decimal" | "money" | "rank";
}

interface BlueprintMissionModifierDefinition {
  target: string;
  operation: ModifierState["operation"];
  value: number;
}

export interface BlueprintMissionStageDefinition {
  id: string;
  name: string;
  description: string;
  metrics: BlueprintMissionMetricDefinition[];
  rewardText: string[];
  completionModifiers: BlueprintMissionModifierDefinition[];
}

export interface BlueprintMissionChainDefinition {
  blueprintId: string;
  name: string;
  stages: BlueprintMissionStageDefinition[];
}

export interface BlueprintMissionMetricEvaluation extends BlueprintMissionMetricDefinition {
  value: number;
  met: boolean;
}

export interface BlueprintMissionStatus {
  chain: BlueprintMissionChainDefinition | null;
  stage: BlueprintMissionStageDefinition | null;
  stageIndex: number;
  completed: boolean;
  metrics: BlueprintMissionMetricEvaluation[];
  qualified: boolean;
}

export const blueprintMissionChains = missionConfig.chains as BlueprintMissionChainDefinition[];

function chainForBlueprint(blueprintId: string | null): BlueprintMissionChainDefinition | null {
  return blueprintMissionChains.find((chain) => chain.blueprintId === blueprintId) ?? null;
}

export function createInitialBlueprintMissionState(
  blueprintId?: string,
): BlueprintMissionState {
  return {
    blueprintId: chainForBlueprint(blueprintId ?? null)?.blueprintId ?? null,
    currentStageIndex: 0,
    completedStages: [],
    lastEvaluatedYear: null,
  };
}

export function ensureBlueprintMissionState(state: GameState): void {
  const expectedBlueprintId = state.nation.openingChoices?.developmentBlueprintId;
  if (!state.nation.blueprintMission) {
    state.nation.blueprintMission = createInitialBlueprintMissionState(expectedBlueprintId);
    return;
  }
  const mission = state.nation.blueprintMission;
  mission.completedStages ??= [];
  mission.lastEvaluatedYear ??= null;
  if (!chainForBlueprint(mission.blueprintId)) {
    mission.blueprintId = chainForBlueprint(expectedBlueprintId ?? null)?.blueprintId ?? null;
    mission.currentStageIndex = 0;
    mission.completedStages = [];
  }
  if (!Number.isInteger(mission.currentStageIndex) || mission.currentStageIndex < 0) {
    mission.currentStageIndex = mission.completedStages.length;
  }
  const chain = chainForBlueprint(mission.blueprintId);
  if (chain) mission.currentStageIndex = Math.min(mission.currentStageIndex, chain.stages.length);
}

export function readBlueprintMissionMetric(
  state: GameState,
  metricId: BlueprintMissionMetricId,
): number {
  switch (metricId) {
    case "secondary_sector_share": return safeDivide(
      state.nation.sectors.secondary.valueAdded,
      state.nation.economy.realGDP,
    );
    case "energy_supply_ratio": return state.nation.resources.energySupplyRatio;
    case "infrastructure_index": return state.nation.economy.infrastructureIndex;
    case "food_supply_ratio": return state.nation.resources.foodSupplyRatio;
    case "daily_calories": return state.nation.resources.agriculture.dailyCaloriesPerCapita;
    case "stability": return state.nation.society.stabilityIndex;
    case "grain_yield": return state.nation.resources.agriculture.grainYieldKgPerHectare;
    case "mechanization_rate": return state.nation.resources.agriculture.mechanizationRate;
    case "education_index": return state.nation.education.index;
    case "poverty_rate": return state.nation.society.povertyRate;
    case "happiness": return state.nation.society.happinessIndex;
    case "literacy_rate": return state.nation.education.literacyRate;
    case "higher_education_rate": return state.nation.humanDevelopment.educationStages.higher.enrollmentRate;
    case "technology_index": return state.nation.technology.index;
    case "completed_technologies": return state.nation.technology.completedTechnologyIds.length;
    case "technology_rank": return state.world.rankings.technology.china ?? Number.POSITIVE_INFINITY;
    case "education_rank": return state.world.rankings.education.china ?? Number.POSITIVE_INFINITY;
    case "openness": return state.nation.trade.openness;
    case "exports_to_gdp": return safeDivide(
      state.nation.trade.exports,
      state.nation.economy.nominalGDP,
    );
    case "foreign_exchange_reserves": return state.nation.trade.foreignExchangeReserves;
    case "private_mixed_share": return state.nation.enterprises.privateAndMixedShare;
    case "logistics_efficiency": return state.nation.resources.infrastructureResources.logisticsEfficiencyIndex;
    case "trade_agreements": return state.world.countries.filter((country) => country.tradeAgreement).length;
    case "gdp_per_capita_usd": return state.nation.economy.currentUSDGDPPerCapita;
    case "industry_technology_tier": return calculateTechnologyTreeMetrics(state.nation).industryTier;
  }
}

function metricMet(metric: BlueprintMissionMetricDefinition, value: number): boolean {
  return metric.comparison === "at_least" ? value >= metric.target : value <= metric.target;
}

export function getBlueprintMissionStatus(state: GameState): BlueprintMissionStatus {
  const mission = state.nation.blueprintMission ?? createInitialBlueprintMissionState(
    state.nation.openingChoices?.developmentBlueprintId,
  );
  const chain = chainForBlueprint(mission.blueprintId);
  const stage = chain?.stages[mission.currentStageIndex] ?? null;
  const metrics = stage?.metrics.map((metric) => {
    const value = readBlueprintMissionMetric(state, metric.id);
    return { ...metric, value, met: metricMet(metric, value) };
  }) ?? [];
  return {
    chain,
    stage,
    stageIndex: mission.currentStageIndex,
    completed: chain !== null && mission.currentStageIndex >= chain.stages.length,
    metrics,
    qualified: stage !== null && metrics.every((metric) => metric.met),
  };
}

function applyStageReward(
  state: GameState,
  chain: BlueprintMissionChainDefinition,
  stage: BlueprintMissionStageDefinition,
): void {
  stage.completionModifiers.forEach((modifier, index) => {
    addModifier(state.nation, {
      id: `blueprint_mission:${chain.blueprintId}:${stage.id}:${index}`,
      sourceId: `blueprint_mission:${chain.blueprintId}:${stage.id}`,
      target: modifier.target,
      operation: modifier.operation,
      value: modifier.value,
      remainingMonths: 60,
      stackRule: "replace",
    });
  });
}

/** 每个年末最多完成一个阶段，避免高指标旧档在同一年吞掉整条任务链。 */
export function updateBlueprintMission(state: GameState): string | null {
  ensureBlueprintMissionState(state);
  const status = getBlueprintMissionStatus(state);
  const mission = state.nation.blueprintMission;
  if (!status.chain || !status.stage || status.completed) return null;
  if (mission.lastEvaluatedYear === state.nation.date.year) return null;
  mission.lastEvaluatedYear = state.nation.date.year;
  if (!status.qualified) return null;

  mission.completedStages.push({
    stageId: status.stage.id,
    stageName: status.stage.name,
    year: state.nation.date.year,
  });
  mission.currentStageIndex += 1;
  applyStageReward(state, status.chain, status.stage);
  return status.stage.id;
}

export function completedBlueprintStageNamesForYear(
  state: GameState,
  year: number,
): string[] {
  return state.nation.blueprintMission.completedStages
    .filter((record) => record.year === year)
    .map((record) => record.stageName);
}
