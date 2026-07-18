import policyConfig from "../../data/config/policies.json";
import policyCatalog from "../../data/config/national-policies.json";
import { approach, clamp } from "../core/math";
import type { NationState } from "../state/game-state";
import { applyModifiers } from "../events/modifiers";

export type PolicyCategory = "产业" | "社会" | "发展" | "开放" | "财政";
export type PolicyOperation = "add" | "multiply";

export interface NationalPolicyDefinition {
  id: string;
  name: string;
  category: PolicyCategory;
  description: string;
  transitionMonths: number;
  conflictsWith: string[];
  modifiers: Array<{
    target: string;
    operation: PolicyOperation;
    value: number;
  }>;
}

export const nationalPolicyDefinitions =
  policyCatalog.definitions as NationalPolicyDefinition[];
export const maximumActivePolicies = policyCatalog.maximumActivePolicies;

export function getNationalPolicy(policyId: string): NationalPolicyDefinition | undefined {
  return nationalPolicyDefinitions.find((policy) => policy.id === policyId);
}

export function validatePolicySelection(policyIds: string[]): void {
  const unique = [...new Set(policyIds)];
  if (unique.length !== policyIds.length) throw new Error("国策不得重复选择");
  if (unique.length > maximumActivePolicies) {
    throw new Error(`同时实施的国策不得超过 ${maximumActivePolicies} 项`);
  }
  for (const policyId of unique) {
    const policy = getNationalPolicy(policyId);
    if (!policy) throw new Error(`未知国策：${policyId}`);
    const conflict = policy.conflictsWith.find((id) => unique.includes(id));
    if (conflict) {
      throw new Error(`${policy.name}与${getNationalPolicy(conflict)?.name ?? conflict}冲突`);
    }
  }
}

export function updatePolicyProgress(nation: NationState): void {
  const knownIds = new Set(nationalPolicyDefinitions.map((policy) => policy.id));
  for (const policy of nationalPolicyDefinitions) {
    const current = nation.policyProgress[policy.id] ?? 0;
    const step = 1 / Math.max(policy.transitionMonths, 1);
    nation.policyProgress[policy.id] = clamp(
      current + (nation.policies.includes(policy.id) ? step : -step),
      0,
      1,
    );
  }
  nation.policyProgress = Object.fromEntries(
    Object.entries(nation.policyProgress).filter(
      ([id, progress]) => knownIds.has(id) && progress > 0,
    ),
  );
}

export function applyPolicyModifiers(
  nation: NationState,
  target: string,
  baseValue: number,
): number {
  let value = baseValue;
  for (const policy of nationalPolicyDefinitions) {
    const progress = nation.policyProgress[policy.id] ?? 0;
    if (progress <= 0) continue;
    for (const modifier of policy.modifiers.filter((item) => item.target === target)) {
      if (modifier.operation === "add") value += modifier.value * progress;
      if (modifier.operation === "multiply") {
        value *= 1 + (modifier.value - 1) * progress;
      }
    }
  }
  return value;
}

export function updatePolicyEnvironment(nation: NationState): void {
  updatePolicyProgress(nation);
  const openingProgress = nation.policyProgress.expand_opening ?? 0;
  const openingTarget =
    policyConfig.closedTarget +
    (policyConfig.openingTarget - policyConfig.closedTarget) * openingProgress;
  nation.trade.openness = clamp(
    approach(
      nation.trade.openness,
      openingTarget,
      policyConfig.openingAdjustmentSpeed,
    ),
    0,
    1,
  );
  const administrationCapacity = clamp(
    nation.fiscal.budget.administration / 0.1,
    0,
    1.5,
  );
  const institutionTarget = clamp(
    applyModifiers(
      nation,
      "economy.institutionalEfficiencyTarget",
      0.25 +
        nation.education.index / 100 * 0.35 +
        nation.trade.openness * 0.25 +
        administrationCapacity * 0.08,
    ),
    0.1,
    0.95,
  );
  nation.economy.institutionalEfficiency = approach(
    nation.economy.institutionalEfficiency,
    institutionTarget,
    policyConfig.institutionAdjustmentSpeed,
  );
  const investmentConfidence =
    nation.trade.openness *
    nation.economy.institutionalEfficiency *
    nation.society.stabilityIndex / 100;
  nation.trade.foreignInvestment = applyModifiers(
    nation,
    "trade.foreignInvestment",
    nation.economy.nominalGDP *
      policyConfig.maximumForeignInvestmentShare *
      investmentConfidence,
  );
}
