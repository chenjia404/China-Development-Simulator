import strategyConfig from "../../data/config/diplomatic-strategies.json";
import { clamp } from "../core/math";
import type { GameState, NationState } from "../state/game-state";

export type DiplomaticStrategyId = "pro_soviet" | "balanced" | "pro_western";

export interface DiplomaticStrategyDefinition {
  id: DiplomaticStrategyId;
  name: string;
  shortName: string;
  description: string;
  targetAlignment: number;
  activationCost: number;
  effects: string[];
  marketAccessMultiplier: number;
  foreignInvestmentMultiplier: number;
  technologyDiffusionMultiplier: number;
  researchOutputMultiplier: number;
  securityTargetAdjustment: number;
  reputationTargetAdjustment: number;
  relationTargetAdjustments: Record<string, number>;
}

export interface DiplomaticStrategyEffects {
  marketAccessMultiplier: number;
  foreignInvestmentMultiplier: number;
  technologyDiffusionMultiplier: number;
  researchOutputMultiplier: number;
  securityTargetAdjustment: number;
  reputationTargetAdjustment: number;
}

export const diplomaticStrategyDefinitions =
  strategyConfig.strategies as DiplomaticStrategyDefinition[];
export const diplomaticStrategyCooldownMonths = strategyConfig.cooldownMonths;

export function getDiplomaticStrategy(
  strategyId: string,
): DiplomaticStrategyDefinition | undefined {
  return diplomaticStrategyDefinitions.find((strategy) => strategy.id === strategyId);
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function blendedValue(
  alignment: number,
  getValue: (strategy: DiplomaticStrategyDefinition) => number,
): number {
  const balanced = getDiplomaticStrategy("balanced");
  const directional = getDiplomaticStrategy(
    alignment < 0 ? "pro_soviet" : "pro_western",
  );
  if (!balanced || !directional) throw new Error("外交战略配置不完整");
  return interpolate(getValue(balanced), getValue(directional), Math.abs(alignment));
}

export function diplomaticStrategyEffects(
  nation: NationState,
): DiplomaticStrategyEffects {
  const alignment = clamp(nation.diplomacy.strategyAlignment, -1, 1);
  return {
    marketAccessMultiplier: blendedValue(
      alignment,
      (strategy) => strategy.marketAccessMultiplier,
    ),
    foreignInvestmentMultiplier: blendedValue(
      alignment,
      (strategy) => strategy.foreignInvestmentMultiplier,
    ),
    technologyDiffusionMultiplier: blendedValue(
      alignment,
      (strategy) => strategy.technologyDiffusionMultiplier,
    ),
    researchOutputMultiplier: blendedValue(
      alignment,
      (strategy) => strategy.researchOutputMultiplier,
    ),
    securityTargetAdjustment: blendedValue(
      alignment,
      (strategy) => strategy.securityTargetAdjustment,
    ),
    reputationTargetAdjustment: blendedValue(
      alignment,
      (strategy) => strategy.reputationTargetAdjustment,
    ),
  };
}

export function diplomaticRelationTargetAdjustment(
  nation: NationState,
  countryId: string,
): number {
  const alignment = clamp(nation.diplomacy.strategyAlignment, -1, 1);
  const balanced = getDiplomaticStrategy("balanced");
  const directional = getDiplomaticStrategy(
    alignment < 0 ? "pro_soviet" : "pro_western",
  );
  if (!balanced || !directional) throw new Error("外交战略配置不完整");
  return interpolate(
    balanced.relationTargetAdjustments[countryId] ?? 0,
    directional.relationTargetAdjustments[countryId] ?? 0,
    Math.abs(alignment),
  );
}

export function updateDiplomaticStrategy(nation: NationState): void {
  const strategy = getDiplomaticStrategy(nation.diplomacy.strategyId);
  if (!strategy) throw new Error(`未知外交战略：${nation.diplomacy.strategyId}`);
  const difference = strategy.targetAlignment - nation.diplomacy.strategyAlignment;
  nation.diplomacy.strategyAlignment = clamp(
    nation.diplomacy.strategyAlignment + clamp(
      difference,
      -strategyConfig.alignmentStepPerMonth,
      strategyConfig.alignmentStepPerMonth,
    ),
    -1,
    1,
  );
}

export function diplomaticStrategyCooldownRemaining(state: GameState): number {
  const changedAt = state.nation.diplomacy.lastStrategyChangeMonth;
  if (changedAt === null) return 0;
  return Math.max(
    0,
    diplomaticStrategyCooldownMonths -
      (state.nation.date.elapsedMonths - changedAt),
  );
}

export function setDiplomaticStrategy(
  state: GameState,
  strategyId: DiplomaticStrategyId,
): void {
  const strategy = getDiplomaticStrategy(strategyId);
  if (!strategy) throw new Error(`未知外交战略：${strategyId}`);
  if (state.nation.diplomacy.strategyId === strategyId) {
    throw new Error(`当前已经采用${strategy.name}`);
  }
  const cooldown = diplomaticStrategyCooldownRemaining(state);
  if (cooldown > 0) throw new Error(`外交路线调整还需冷却 ${cooldown} 个月`);
  if (state.nation.diplomacy.diplomaticPoints < strategy.activationCost) {
    throw new Error(`采用${strategy.name}需要 ${strategy.activationCost} 点外交点数`);
  }
  state.nation.diplomacy.diplomaticPoints -= strategy.activationCost;
  state.nation.diplomacy.strategyId = strategy.id;
  state.nation.diplomacy.lastStrategyChangeMonth = state.nation.date.elapsedMonths;
}
