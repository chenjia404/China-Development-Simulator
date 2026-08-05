import futureConfig from "../../data/config/future-era.json";
import { approach, clamp, safeDivide } from "../core/math";
import { addModifier } from "../events/modifiers";
import type {
  FutureEraState,
  GameState,
  ModifierState,
} from "../state/game-state";
import { technologyNormalizedEffect } from "../technology/technology-growth";

interface FutureStateAdjustments {
  aiDiffusion: number;
  careCapacity: number;
  adaptationCapacity: number;
  cleanEnergyTransition: number;
}

interface FutureModifierDefinition {
  target: string;
  operation: ModifierState["operation"];
  value: number;
  durationMonths: number;
}

export interface FutureChoiceDefinition {
  id: string;
  name: string;
  description: string;
  effects: string[];
  stateAdjustments: FutureStateAdjustments;
  modifiers: FutureModifierDefinition[];
}

export interface FutureDecisionDefinition {
  id: string;
  year: number;
  month: number;
  name: string;
  description: string;
  defaultChoiceId: string;
  choices: FutureChoiceDefinition[];
}

export const futureEraStartYear = futureConfig.startYear;
export const futureEraEndYear = futureConfig.endYear;
export const futureDecisionDefinitions = futureConfig.decisions as FutureDecisionDefinition[];

export function validateFutureEraDefinitions(): void {
  if (futureEraStartYear !== 2027 || futureEraEndYear !== 2050) {
    throw new Error("未来时代年份范围必须为 2027—2050");
  }
  const decisionIds = new Set<string>();
  for (const decision of futureDecisionDefinitions) {
    if (decisionIds.has(decision.id)) throw new Error(`未来情景 ID 重复：${decision.id}`);
    decisionIds.add(decision.id);
    if (
      decision.year < futureEraStartYear ||
      decision.year > futureEraEndYear ||
      decision.month < 1 ||
      decision.month > 12
    ) {
      throw new Error(`未来情景“${decision.name}”日期越界`);
    }
    if (decision.choices.length !== 3) {
      throw new Error(`未来情景“${decision.name}”必须提供三个方案`);
    }
    const choiceIds = new Set(decision.choices.map((choice) => choice.id));
    if (choiceIds.size !== decision.choices.length) {
      throw new Error(`未来情景“${decision.name}”存在重复方案 ID`);
    }
    if (!choiceIds.has(decision.defaultChoiceId)) {
      throw new Error(`未来情景“${decision.name}”缺少默认方案`);
    }
    for (const choice of decision.choices) {
      if (choice.effects.length === 0) {
        throw new Error(`未来方案“${choice.name}”必须说明收益与代价`);
      }
      if (
        !Object.values(choice.stateAdjustments).every((value) =>
          Number.isFinite(value) && value >= -1 && value <= 1
        )
      ) {
        throw new Error(`未来方案“${choice.name}”的状态调整无效`);
      }
      if (
        choice.modifiers.length === 0 ||
        choice.modifiers.some((modifier) =>
          !modifier.target ||
          !Number.isFinite(modifier.value) ||
          !Number.isInteger(modifier.durationMonths) ||
          modifier.durationMonths <= 0
        )
      ) {
        throw new Error(`未来方案“${choice.name}”的传导配置无效`);
      }
    }
  }
}

export function createInitialFutureEraState(): FutureEraState {
  return {
    climateRisk: 0,
    ageingPressure: 0,
    aiDiffusion: 0,
    cleanEnergyTransition: 0,
    adaptationCapacity: 0,
    careCapacity: 0,
    pendingDecisionId: null,
    decisions: [],
  };
}

export function ensureFutureEraState(state: GameState): void {
  if (!state.nation.futureEra) {
    state.nation.futureEra = createInitialFutureEraState();
    return;
  }
  const future = state.nation.futureEra;
  future.climateRisk = clamp(Number.isFinite(future.climateRisk) ? future.climateRisk : 0, 0, 1);
  future.ageingPressure = clamp(Number.isFinite(future.ageingPressure) ? future.ageingPressure : 0, 0, 1);
  future.aiDiffusion = clamp(Number.isFinite(future.aiDiffusion) ? future.aiDiffusion : 0, 0, 1);
  future.cleanEnergyTransition = clamp(
    Number.isFinite(future.cleanEnergyTransition) ? future.cleanEnergyTransition : 0,
    0,
    1,
  );
  future.adaptationCapacity = clamp(
    Number.isFinite(future.adaptationCapacity) ? future.adaptationCapacity : 0,
    0,
    1,
  );
  future.careCapacity = clamp(Number.isFinite(future.careCapacity) ? future.careCapacity : 0, 0, 1);
  future.pendingDecisionId ??= null;
  future.decisions ??= [];
}

export function getFutureDecision(decisionId: string): FutureDecisionDefinition | undefined {
  return futureDecisionDefinitions.find((decision) => decision.id === decisionId);
}

function hasResolvedDecision(state: GameState, decisionId: string): boolean {
  return state.nation.futureEra.decisions.some((record) => record.decisionId === decisionId);
}

function applyChoiceModifiers(
  state: GameState,
  decision: FutureDecisionDefinition,
  choice: FutureChoiceDefinition,
): void {
  choice.modifiers.forEach((modifier, index) => {
    addModifier(state.nation, {
      id: `future_decision:${decision.id}:${choice.id}:${index}`,
      sourceId: `future_decision:${decision.id}:${choice.id}`,
      target: modifier.target,
      operation: modifier.operation,
      value: modifier.value,
      remainingMonths: modifier.durationMonths,
      stackRule: "replace",
    });
  });
}

export function resolveFutureDecision(
  state: GameState,
  decisionId: string,
  choiceId: string,
): void {
  ensureFutureEraState(state);
  const decision = getFutureDecision(decisionId);
  if (!decision) throw new Error(`未知未来情景：${decisionId}`);
  if (hasResolvedDecision(state, decisionId)) throw new Error(`未来情景“${decision.name}”已经处理`);
  if (
    state.nation.historicalEventDecisionMode === "interactive" &&
    state.nation.futureEra.pendingDecisionId !== decisionId
  ) {
    throw new Error(`未来情景“${decision.name}”尚未进入决策期`);
  }
  const choice = decision.choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error(`未知未来情景选项：${choiceId}`);

  const adjustment = choice.stateAdjustments;
  state.nation.futureEra.aiDiffusion = clamp(
    state.nation.futureEra.aiDiffusion + adjustment.aiDiffusion,
    0,
    1,
  );
  state.nation.futureEra.careCapacity = clamp(
    state.nation.futureEra.careCapacity + adjustment.careCapacity,
    0,
    1,
  );
  state.nation.futureEra.adaptationCapacity = clamp(
    state.nation.futureEra.adaptationCapacity + adjustment.adaptationCapacity,
    0,
    1,
  );
  state.nation.futureEra.cleanEnergyTransition = clamp(
    state.nation.futureEra.cleanEnergyTransition + adjustment.cleanEnergyTransition,
    0,
    1,
  );
  applyChoiceModifiers(state, decision, choice);
  state.nation.futureEra.decisions.push({
    decisionId,
    decisionName: decision.name,
    choiceId,
    choiceName: choice.name,
    year: state.nation.date.year,
    month: state.nation.date.month,
  });
  state.nation.futureEra.pendingDecisionId = null;
}

/** 月初检查未来情景；交互模式返回 true 表示暂停等待玩家。 */
export function checkFutureDecision(state: GameState): boolean {
  ensureFutureEraState(state);
  if (state.nation.date.year < futureEraStartYear) return false;
  if (state.nation.futureEra.pendingDecisionId) return true;
  const decision = futureDecisionDefinitions.find((item) =>
    item.year === state.nation.date.year &&
    item.month === state.nation.date.month &&
    !hasResolvedDecision(state, item.id)
  );
  if (!decision) return false;
  if (state.nation.historicalEventDecisionMode === "interactive") {
    state.nation.futureEra.pendingDecisionId = decision.id;
    return true;
  }
  resolveFutureDecision(state, decision.id, decision.defaultChoiceId);
  return false;
}

function replacePressureModifier(
  state: GameState,
  id: string,
  target: string,
  operation: ModifierState["operation"],
  value: number,
): void {
  addModifier(state.nation, {
    id: `future_pressure:${id}`,
    sourceId: `future_pressure:${id}`,
    target,
    operation,
    value,
    remainingMonths: 2,
    stackRule: "replace",
  });
}

/** 更新四类未来库存并生成短期动态压力，不直接改写 GDP 或人口。 */
export function updateFutureEra(state: GameState): void {
  ensureFutureEraState(state);
  if (state.nation.date.year < futureEraStartYear) return;
  const nation = state.nation;
  const future = nation.futureEra;
  const elapsedYears = Math.max(
    0,
    (nation.date.year - futureEraStartYear) + (nation.date.month - 1) / 12,
  );
  const elderlyShare = safeDivide(
    nation.population.ageGroups.elderly,
    nation.population.total,
  );
  const dependencyRatio = safeDivide(
    nation.population.ageGroups.children + nation.population.ageGroups.elderly,
    nation.population.ageGroups.workingAge,
  );
  const ageingTarget = clamp(
    elderlyShare * 1.9 + dependencyRatio * 0.12 - future.careCapacity * 0.32,
    0,
    1,
  );
  future.ageingPressure = approach(future.ageingPressure, ageingTarget, 0.025);

  const pollutionPressure = clamp(
    nation.resources.infrastructureResources.airPollutionIndex / 180,
    0,
    0.35,
  );
  const climateTarget = clamp(
    0.16 + elapsedYears * 0.014 + pollutionPressure -
      future.adaptationCapacity * 0.42 -
      future.cleanEnergyTransition * 0.16,
    0,
    1,
  );
  future.climateRisk = approach(future.climateRisk, climateTarget, 0.02);

  const aiTarget = clamp(
    technologyNormalizedEffect(nation.technology.index) * 0.68 +
      nation.education.index / 100 * 0.22 +
      elapsedYears * 0.006,
    0,
    1,
  );
  future.aiDiffusion = approach(future.aiDiffusion, aiTarget, 0.018);

  const energyMix = nation.resources.infrastructureResources.energyMix;
  const lowCarbonShare = energyMix.renewables.share + energyMix.nuclear.share + energyMix.hydro.share;
  future.cleanEnergyTransition = approach(
    future.cleanEnergyTransition,
    clamp(lowCarbonShare, 0, 1),
    0.012,
  );

  replacePressureModifier(
    state,
    "climate_food",
    "resources.foodSupply",
    "multiply",
    Math.max(0.94, 1 - future.climateRisk * 0.03),
  );
  replacePressureModifier(
    state,
    "climate_investment",
    "capital.investmentEfficiency",
    "multiply",
    Math.max(0.96, 1 - future.climateRisk * 0.018),
  );
  replacePressureModifier(
    state,
    "ageing_fiscal",
    "fiscal.spending",
    "multiply",
    1 + future.ageingPressure * Math.max(0.006, 0.022 - future.careCapacity * 0.012),
  );
  replacePressureModifier(
    state,
    "ai_productivity",
    "economy.structuralProductivityGrowth",
    "add",
    future.aiDiffusion * 0.0025,
  );
  replacePressureModifier(
    state,
    "clean_energy",
    "resources.energySupply",
    "multiply",
    1 + future.cleanEnergyTransition * 0.012,
  );
}
