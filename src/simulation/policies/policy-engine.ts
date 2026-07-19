import policyConfig from "../../data/config/policies.json";
import policyCatalog from "../../data/config/national-policies.json";
import { approach, clamp } from "../core/math";
import type { NationState } from "../state/game-state";
import { applyModifiers } from "../events/modifiers";
import { calculateTechnologyTreeMetrics } from "../technology/technology-tree";
import { historicalEventName } from "../events/historical-event-engine";

export type PolicyCategory = "产业" | "社会" | "发展" | "开放" | "财政";
export type PolicyOperation = "add" | "multiply";

export interface NationalPolicyRequirements {
  requiredHistoricalEventIds?: string[];
  availableFromYear?: number;
  minimumEducationBudgetShare?: number;
  minimumStateCapacity?: number;
  minimumLocalImplementationCapacity?: number;
  minimumStabilityIndex?: number;
  minimumInstitutionalEfficiency?: number;
  minimumLegalPredictability?: number;
  minimumPrivateOperatingSpace?: number;
}

export interface NationalPolicyDefinition {
  id: string;
  name: string;
  category: PolicyCategory;
  description: string;
  transitionMonths: number;
  conflictsWith: string[];
  requirements?: NationalPolicyRequirements;
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

export function nationalPolicyRequirementDescriptions(
  policy: NationalPolicyDefinition,
): string[] {
  const requirements = policy.requirements;
  if (!requirements) return [];
  const descriptions: string[] = [];
  for (const eventId of requirements.requiredHistoricalEventIds ?? []) {
    descriptions.push(`需先完成${historicalEventName(eventId) ?? eventId}`);
  }
  if (requirements.availableFromYear !== undefined) {
    descriptions.push(`最早 ${requirements.availableFromYear} 年`);
  }
  if (requirements.minimumEducationBudgetShare !== undefined) {
    descriptions.push(
      `教育预算至少占财政预算 ${(requirements.minimumEducationBudgetShare * 100).toFixed(0)}%`,
    );
  }
  if (requirements.minimumStateCapacity !== undefined) {
    descriptions.push(`国家能力至少 ${(requirements.minimumStateCapacity * 100).toFixed(0)}%`);
  }
  if (requirements.minimumLocalImplementationCapacity !== undefined) {
    descriptions.push(
      `地方执行能力至少 ${(requirements.minimumLocalImplementationCapacity * 100).toFixed(0)}%`,
    );
  }
  if (requirements.minimumStabilityIndex !== undefined) {
    descriptions.push(`社会稳定度至少 ${requirements.minimumStabilityIndex.toFixed(0)}`);
  }
  if (requirements.minimumInstitutionalEfficiency !== undefined) {
    descriptions.push(
      `制度效率至少 ${(requirements.minimumInstitutionalEfficiency * 100).toFixed(0)}%`,
    );
  }
  if (requirements.minimumLegalPredictability !== undefined) {
    descriptions.push(
      `法律可预期性至少 ${(requirements.minimumLegalPredictability * 100).toFixed(0)}%`,
    );
  }
  if (requirements.minimumPrivateOperatingSpace !== undefined) {
    descriptions.push(
      `民营经营空间至少 ${(requirements.minimumPrivateOperatingSpace * 100).toFixed(0)}%`,
    );
  }
  return descriptions;
}

export function nationalPolicyRequirementBlockers(
  nation: NationState,
  policyId: string,
): string[] {
  const policy = getNationalPolicy(policyId);
  if (!policy?.requirements) return [];
  const requirements = policy.requirements;
  const blockers: string[] = [];
  for (const eventId of requirements.requiredHistoricalEventIds ?? []) {
    if (!nation.history.historicalEvents.some(
      (record) => record.id === eventId && record.outcome !== "prevented",
    )) {
      blockers.push(`需先完成${historicalEventName(eventId) ?? eventId}`);
    }
  }
  if (
    requirements.availableFromYear !== undefined &&
    nation.date.year < requirements.availableFromYear
  ) {
    blockers.push(`最早可在 ${requirements.availableFromYear} 年实施`);
  }
  if (
    requirements.minimumEducationBudgetShare !== undefined &&
    nation.fiscal.budget.education < requirements.minimumEducationBudgetShare
  ) {
    blockers.push(
      `教育预算占比需达到 ${(requirements.minimumEducationBudgetShare * 100).toFixed(0)}%`,
    );
  }
  if (
    requirements.minimumStateCapacity !== undefined &&
    nation.institutions.stateCapacity < requirements.minimumStateCapacity
  ) {
    blockers.push(
      `国家能力需达到 ${(requirements.minimumStateCapacity * 100).toFixed(0)}%`,
    );
  }
  if (
    requirements.minimumLocalImplementationCapacity !== undefined &&
    nation.institutions.localImplementationCapacity <
      requirements.minimumLocalImplementationCapacity
  ) {
    blockers.push(
      `地方执行能力需达到 ${(requirements.minimumLocalImplementationCapacity * 100).toFixed(0)}%`,
    );
  }
  if (
    requirements.minimumStabilityIndex !== undefined &&
    nation.society.stabilityIndex < requirements.minimumStabilityIndex
  ) {
    blockers.push(`社会稳定度需达到 ${requirements.minimumStabilityIndex.toFixed(0)}`);
  }
  if (
    requirements.minimumInstitutionalEfficiency !== undefined &&
    nation.economy.institutionalEfficiency <
      requirements.minimumInstitutionalEfficiency
  ) {
    blockers.push(
      `制度效率需达到 ${(requirements.minimumInstitutionalEfficiency * 100).toFixed(0)}%`,
    );
  }
  if (
    requirements.minimumLegalPredictability !== undefined &&
    nation.institutions.legalPredictability <
      requirements.minimumLegalPredictability
  ) {
    blockers.push(
      `法律可预期性需达到 ${(requirements.minimumLegalPredictability * 100).toFixed(0)}%`,
    );
  }
  if (
    requirements.minimumPrivateOperatingSpace !== undefined &&
    nation.privateEconomy.operatingSpace <
      requirements.minimumPrivateOperatingSpace
  ) {
    blockers.push(
      `民营经营空间需达到 ${(requirements.minimumPrivateOperatingSpace * 100).toFixed(0)}%`,
    );
  }
  return blockers;
}

/**
 * 计算需要持续公共执行的国策落实率。普通国策保持完整进度；义务教育
 * 若后续失去预算或治理条件，教育收益会下降，但财政承诺仍按政策进度承担。
 */
export function nationalPolicyImplementationRate(
  nation: NationState,
  policyId: string,
): number {
  const policy = getNationalPolicy(policyId);
  if (
    policyId !== "compulsory_education_implementation" ||
    !policy?.requirements
  ) return 1;
  const requirements = policy.requirements;
  const rates: number[] = [];
  for (const eventId of requirements.requiredHistoricalEventIds ?? []) {
    rates.push(
      nation.history.historicalEvents.some(
        (record) => record.id === eventId && record.outcome !== "prevented",
      )
        ? 1
        : 0,
    );
  }
  if (requirements.availableFromYear !== undefined) {
    rates.push(nation.date.year >= requirements.availableFromYear ? 1 : 0);
  }
  if (requirements.minimumEducationBudgetShare !== undefined) {
    rates.push(
      nation.fiscal.budget.education /
        Math.max(requirements.minimumEducationBudgetShare, 0.001),
    );
  }
  if (requirements.minimumStateCapacity !== undefined) {
    rates.push(
      nation.institutions.stateCapacity /
        Math.max(requirements.minimumStateCapacity, 0.001),
    );
  }
  if (requirements.minimumLocalImplementationCapacity !== undefined) {
    rates.push(
      nation.institutions.localImplementationCapacity /
        Math.max(requirements.minimumLocalImplementationCapacity, 0.001),
    );
  }
  if (requirements.minimumStabilityIndex !== undefined) {
    rates.push(
      nation.society.stabilityIndex /
        Math.max(requirements.minimumStabilityIndex, 0.001),
    );
  }
  return clamp(Math.min(...rates, 1), 0, 1);
}

export function validatePolicySelection(
  policyIds: string[],
  nation?: NationState,
  activePolicyIds: string[] = [],
): void {
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
    if (nation && !activePolicyIds.includes(policyId)) {
      const blockers = nationalPolicyRequirementBlockers(nation, policyId);
      if (blockers.length > 0) {
        throw new Error(`${policy.name}尚不可实施：${blockers.join("；")}`);
      }
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
  const technologyGatedTargets = new Set([
    "technology.exportLearningRate",
    "economy.structuralProductivityGrowth",
    "trade.exportCompetitiveness",
    "capital.investmentEfficiency",
  ]);
  for (const policy of nationalPolicyDefinitions) {
    let progress = nation.policyProgress[policy.id] ?? 0;
    if (progress <= 0) continue;
    if (
      policy.id === "industrial_upgrading" &&
      technologyGatedTargets.has(target)
    ) {
      progress *= calculateTechnologyTreeMetrics(nation)
        .industrialUpgradeReadiness;
    }
    if (
      policy.id === "compulsory_education_implementation" &&
      target.startsWith("education.")
    ) {
      progress *= nationalPolicyImplementationRate(nation, policy.id);
    }
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
  const openingTarget = applyPolicyModifiers(
    nation,
    "trade.opennessTarget",
    policyConfig.closedTarget +
      (policyConfig.openingTarget - policyConfig.closedTarget) * openingProgress,
  );
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
      applyPolicyModifiers(
        nation,
        "economy.institutionalEfficiencyTarget",
        0.25 +
          nation.education.index / 100 * 0.35 +
          nation.trade.openness * 0.25 +
          administrationCapacity * 0.08,
      ),
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
    applyPolicyModifiers(
      nation,
      "trade.foreignInvestment",
      nation.economy.nominalGDP *
        policyConfig.maximumForeignInvestmentShare *
        investmentConfidence,
    ),
  );
}
