import industrialPolicyConfig from "../../data/config/industrial-policies.json";
import { clamp } from "../core/math";
import { economicCoordinationDistortionBias } from "../economy/economic-coordination";
import type {
  IndustrialCategoryId,
  IndustrialPolicyCategoryState,
  IndustrialPolicyStance,
  IndustrialPolicyState,
  NationState,
} from "../state/game-state";

interface IndustrialPolicyStanceEffect {
  outputWeightMultiplier: number;
  productivityMultiplier: number;
  investmentMultiplier: number;
  exportMultiplier: number;
  researchMultiplier: number;
  energyDemandMultiplier: number;
  annualFiscalCostRate: number;
  creditBias: number;
  distortionRate: number;
  laborDisplacementRate: number;
}

interface IndustrialPolicyCategoryParameters {
  supportCostMultiplier: number;
  employmentSensitivity: number;
  supplyChainImportance: number;
}

export interface IndustrialPolicyEffect {
  outputWeightMultiplier: number;
  productivityMultiplier: number;
  investmentMultiplier: number;
  exportMultiplier: number;
  researchMultiplier: number;
  energyDemandMultiplier: number;
  creditBias: number;
  effectiveness: number;
}

export interface IndustrialPolicyAggregateEffects {
  investmentMultiplier: number;
  researchMultiplier: number;
  energyDemandMultiplier: number;
  supplyChainConstraint: number;
}

export interface SupportAllocationShare {
  supportLoad: number;
  supportCapacity: number;
  allocationShare: number;
}

const neutralIndustrialPolicyEffect: IndustrialPolicyEffect = {
  outputWeightMultiplier: 1,
  productivityMultiplier: 1,
  investmentMultiplier: 1,
  exportMultiplier: 1,
  researchMultiplier: 1,
  energyDemandMultiplier: 1,
  creditBias: 0,
  effectiveness: 0,
};

const neutralIndustrialPolicyAggregateEffects: IndustrialPolicyAggregateEffects = {
  investmentMultiplier: 1,
  researchMultiplier: 1,
  energyDemandMultiplier: 1,
  supplyChainConstraint: 1,
};

export const industrialPolicyCategoryIds: IndustrialCategoryId[] = [
  "mining_energy",
  "basic_materials",
  "consumer_goods",
  "construction",
  "general_machinery",
  "transport_equipment",
  "chemicals_pharmaceuticals",
  "electrical_equipment",
  "electronics_communications",
  "precision_medical",
  "aerospace_advanced",
];

export const industrialPolicyStances: IndustrialPolicyStance[] = [
  "support",
  "neutral",
  "suppress",
];

function createCategoryPolicyState(
  industryId: IndustrialCategoryId,
): IndustrialPolicyCategoryState {
  return {
    industryId,
    stance: "neutral",
    effectiveIntensity: 0,
    lastChangedElapsedMonth: null,
  };
}

export function createInitialIndustrialPolicyState(): IndustrialPolicyState {
  return {
    categories: Object.fromEntries(
      industrialPolicyCategoryIds.map((industryId) => [
        industryId,
        createCategoryPolicyState(industryId),
      ]),
    ) as Record<IndustrialCategoryId, IndustrialPolicyCategoryState>,
    annualFiscalCost: 0,
    creditAllocationBias: 0,
    distortionIndex: 0,
    laborDisplacementPressure: 0,
    administrativeEffectiveness: 1,
    supplyChainConstraint: 1,
  };
}

function isCompleteIndustrialPolicyState(
  state: Partial<IndustrialPolicyState> | undefined,
): state is IndustrialPolicyState {
  if (!state?.categories) return false;
  const categoriesAreValid = industrialPolicyCategoryIds.every((industryId) => {
    const category = state.categories?.[industryId];
    return category?.industryId === industryId &&
      industrialPolicyStances.includes(category.stance) &&
      Number.isFinite(category.effectiveIntensity) &&
      category.effectiveIntensity >= -1 &&
      category.effectiveIntensity <= 1 &&
      (
        category.lastChangedElapsedMonth === null ||
        Number.isInteger(category.lastChangedElapsedMonth)
      );
  });
  return categoriesAreValid &&
    Number.isFinite(state.annualFiscalCost) &&
    (state.annualFiscalCost ?? -1) >= 0 &&
    Number.isFinite(state.creditAllocationBias) &&
    Math.abs(state.creditAllocationBias ?? 2) <= 1 &&
    Number.isFinite(state.distortionIndex) &&
    (state.distortionIndex ?? -1) >= 0 &&
    (state.distortionIndex ?? 2) <= 1 &&
    Number.isFinite(state.laborDisplacementPressure) &&
    (state.laborDisplacementPressure ?? -1) >= 0 &&
    (state.laborDisplacementPressure ?? 2) <= 1 &&
    Number.isFinite(state.administrativeEffectiveness) &&
    (state.administrativeEffectiveness ?? -1) >= 0 &&
    (state.administrativeEffectiveness ?? 2) <= 1 &&
    Number.isFinite(state.supplyChainConstraint) &&
    (state.supplyChainConstraint ?? 0) >= 0.5 &&
    (state.supplyChainConstraint ?? 2) <= 1;
}

export function ensureIndustrialPolicyState(nation: NationState): void {
  const existing = nation.industrialPolicy as Partial<IndustrialPolicyState> | undefined;
  if (isCompleteIndustrialPolicyState(existing)) return;
  const fallback = createInitialIndustrialPolicyState();
  nation.industrialPolicy = fallback;
  for (const industryId of industrialPolicyCategoryIds) {
    const source = existing?.categories?.[industryId];
    nation.industrialPolicy.categories[industryId] = {
      industryId,
      stance: industrialPolicyStances.includes(source?.stance ?? "neutral")
        ? source?.stance ?? "neutral"
        : "neutral",
      effectiveIntensity: Number.isFinite(source?.effectiveIntensity)
        ? clamp(source?.effectiveIntensity ?? 0, -1, 1)
        : 0,
      lastChangedElapsedMonth: Number.isInteger(source?.lastChangedElapsedMonth)
        ? source?.lastChangedElapsedMonth ?? null
        : null,
    };
  }
  nation.industrialPolicy.annualFiscalCost = Number.isFinite(existing?.annualFiscalCost)
    ? Math.max(0, existing?.annualFiscalCost ?? 0)
    : 0;
  nation.industrialPolicy.creditAllocationBias = Number.isFinite(existing?.creditAllocationBias)
    ? clamp(existing?.creditAllocationBias ?? 0, -1, 1)
    : 0;
  nation.industrialPolicy.distortionIndex = Number.isFinite(existing?.distortionIndex)
    ? clamp(existing?.distortionIndex ?? 0, 0, 1)
    : 0;
  nation.industrialPolicy.laborDisplacementPressure = Number.isFinite(
    existing?.laborDisplacementPressure,
  )
    ? clamp(existing?.laborDisplacementPressure ?? 0, 0, 1)
    : 0;
  nation.industrialPolicy.administrativeEffectiveness = Number.isFinite(
    existing?.administrativeEffectiveness,
  )
    ? clamp(existing?.administrativeEffectiveness ?? 1, 0, 1)
    : 1;
  nation.industrialPolicy.supplyChainConstraint = Number.isFinite(
    existing?.supplyChainConstraint,
  )
    ? clamp(existing?.supplyChainConstraint ?? 1, 0.5, 1)
    : 1;
}

export function validateIndustrialPolicyConfiguration(): string[] {
  const errors: string[] = [];
  const configuredIds = Object.keys(industrialPolicyConfig.categoryParameters);
  if (
    configuredIds.length !== industrialPolicyCategoryIds.length ||
    industrialPolicyCategoryIds.some((industryId) => !configuredIds.includes(industryId))
  ) {
    errors.push("产业政策类别参数必须完整覆盖十一类工业");
  }
  if (industrialPolicyConfig.minimumChangeIntervalMonths < 1) {
    errors.push("产业政策最短调整间隔必须为正整数月");
  }
  for (const stance of industrialPolicyStances) {
    if (industrialPolicyConfig.transitionMonths[stance] < 1) {
      errors.push(`${stance}产业政策过渡期必须为正数`);
    }
  }
  const allocation = industrialPolicyConfig.supportAllocation;
  if (!allocation || !(allocation.baseFullyEffectiveIndustries > 0)) {
    errors.push("优先扶持配额基数必须为正数");
  }
  if (!allocation || !(allocation.institutionalCapacityScale >= 0)) {
    errors.push("优先扶持配额制度扩容系数不可为负");
  }
  return errors;
}

export function setIndustrialPolicyStance(
  nation: NationState,
  industryId: IndustrialCategoryId,
  stance: IndustrialPolicyStance,
): void {
  ensureIndustrialPolicyState(nation);
  if (!industrialPolicyCategoryIds.includes(industryId)) {
    throw new Error(`未知工业类别：${industryId}`);
  }
  if (!industrialPolicyStances.includes(stance)) {
    throw new Error(`未知产业政策方向：${stance}`);
  }
  const policy = nation.industrialPolicy.categories[industryId];
  if (policy.stance === stance) return;
  const elapsedSinceChange = policy.lastChangedElapsedMonth === null
    ? Number.POSITIVE_INFINITY
    : nation.date.elapsedMonths - policy.lastChangedElapsedMonth;
  if (elapsedSinceChange < industrialPolicyConfig.minimumChangeIntervalMonths) {
    throw new Error(
      `该行业产业政策调整后需等待 ${industrialPolicyConfig.minimumChangeIntervalMonths} 个月才能再次修改`,
    );
  }
  policy.stance = stance;
  policy.lastChangedElapsedMonth = nation.date.elapsedMonths;
}

export function industrialPolicyChangeCooldownRemaining(
  nation: NationState,
  industryId: IndustrialCategoryId,
): number {
  const lastChanged = nation.industrialPolicy.categories[industryId]
    .lastChangedElapsedMonth;
  if (lastChanged === null) return 0;
  return Math.max(
    0,
    industrialPolicyConfig.minimumChangeIntervalMonths -
      (nation.date.elapsedMonths - lastChanged),
  );
}

export function updateIndustrialPolicyTransition(nation: NationState): void {
  for (const policy of Object.values(nation.industrialPolicy.categories)) {
    const target = policy.stance === "support" ? 1 : policy.stance === "suppress" ? -1 : 0;
    const transitionMonths = industrialPolicyConfig.transitionMonths[policy.stance];
    const maximumStep = 1 / transitionMonths;
    const difference = target - policy.effectiveIntensity;
    policy.effectiveIntensity = Math.abs(difference) <= maximumStep + 1e-12
      ? target
      : clamp(
          policy.effectiveIntensity + Math.sign(difference) * maximumStep,
          -1,
          1,
        );
  }
}

function stanceEffect(
  stance: IndustrialPolicyStance,
): IndustrialPolicyStanceEffect {
  return industrialPolicyConfig.stances[stance] as IndustrialPolicyStanceEffect;
}

export function industrialPolicyCategoryParameters(
  industryId: IndustrialCategoryId,
): IndustrialPolicyCategoryParameters {
  return industrialPolicyConfig.categoryParameters[
    industryId
  ] as IndustrialPolicyCategoryParameters;
}

/**
 * 按当前扶持强度即时计算优先扶持配额份额。限制强度不占用配额。
 */
export function calculateSupportAllocationShare(
  nation: NationState,
): SupportAllocationShare {
  const supportLoad = industrialPolicyCategoryIds.reduce(
    (sum, industryId) =>
      sum + Math.max(0, nation.industrialPolicy.categories[industryId].effectiveIntensity),
    0,
  );
  const institutionMix = nation.economy.institutionalEfficiency * 0.5 +
    nation.institutions.stateCapacity * 0.3 +
    nation.institutions.localImplementationCapacity * 0.2;
  const supportCapacity = industrialPolicyConfig.supportAllocation
    .baseFullyEffectiveIndustries +
    institutionMix * industrialPolicyConfig.supportAllocation.institutionalCapacityScale;
  const allocationShare = supportLoad <= 1e-12
    ? 1
    : Math.min(1, supportCapacity / supportLoad);
  return { supportLoad, supportCapacity, allocationShare };
}

export function industrialPolicyEffect(
  nation: NationState,
  industryId: IndustrialCategoryId,
): IndustrialPolicyEffect {
  const categoryPolicy = nation.industrialPolicy.categories[industryId];
  const intensity = categoryPolicy.effectiveIntensity;
  if (Math.abs(intensity) < 1e-12) {
    return neutralIndustrialPolicyEffect;
  }
  const stance = intensity > 0 ? "support" : "suppress";
  const target = stanceEffect(stance);
  const budgetCapacity = clamp(nation.fiscal.budget.industry / 0.18, 0.15, 1.15);
  const enforcementCapacity = clamp(
    (
      nation.economy.institutionalEfficiency +
      nation.institutions.stateCapacity +
      nation.institutions.localImplementationCapacity
    ) / 1.8,
    0.3,
    1,
  );
  const readiness = nation.industries[industryId].technologyReadiness;
  const readinessGate = clamp(budgetCapacity * (0.45 + readiness * 0.55), 0.1, 1);
  const allocationShare = stance === "support"
    ? calculateSupportAllocationShare(nation).allocationShare
    : 1;
  const effectiveness = Math.abs(intensity) * (
    stance === "support"
      ? allocationShare * readinessGate
      : enforcementCapacity
  );
  const blend = (value: number) => 1 + (value - 1) * effectiveness;
  return {
    outputWeightMultiplier: blend(target.outputWeightMultiplier),
    productivityMultiplier: blend(target.productivityMultiplier),
    investmentMultiplier: blend(target.investmentMultiplier),
    exportMultiplier: blend(target.exportMultiplier),
    researchMultiplier: blend(target.researchMultiplier),
    energyDemandMultiplier: blend(target.energyDemandMultiplier),
    creditBias: target.creditBias * effectiveness,
    effectiveness,
  };
}

export function calculateIndustrialPolicyAggregateEffects(
  nation: NationState,
): IndustrialPolicyAggregateEffects {
  const coordinationDistortion = economicCoordinationDistortionBias(nation);
  const industrialNeutral =
    nation.industrialPolicy.annualFiscalCost <= 1e-12 &&
    Math.abs(nation.industrialPolicy.creditAllocationBias) <= 1e-12 &&
    nation.industrialPolicy.distortionIndex <= 1e-12 &&
    nation.industrialPolicy.laborDisplacementPressure <= 1e-12 &&
    nation.industrialPolicy.supplyChainConstraint >= 1 - 1e-12;
  if (industrialNeutral && coordinationDistortion <= 1e-12) {
    return neutralIndustrialPolicyAggregateEffects;
  }
  let investmentDelta = 0;
  let researchDelta = 0;
  let energyDelta = 0;
  if (!industrialNeutral) {
    for (const industryId of industrialPolicyCategoryIds) {
      const share = nation.industries[industryId].outputShare;
      const effect = industrialPolicyEffect(nation, industryId);
      investmentDelta += share * (effect.investmentMultiplier - 1);
      researchDelta += share * (effect.researchMultiplier - 1);
      energyDelta += share * (effect.energyDemandMultiplier - 1);
    }
  }
  const distortionPenalty =
    (nation.industrialPolicy.distortionIndex + coordinationDistortion) * 0.35;
  return {
    investmentMultiplier: clamp(1 + investmentDelta - distortionPenalty, 0.7, 1.25),
    researchMultiplier: clamp(1 + researchDelta - distortionPenalty * 0.45, 0.72, 1.2),
    energyDemandMultiplier: clamp(1 + energyDelta, 0.75, 1.18),
    supplyChainConstraint: nation.industrialPolicy.supplyChainConstraint,
  };
}

/**
 * 先推进政策强度，再按优先扶持配额均分结算财政承诺、信贷倾斜、错配与就业冲击。
 * 这些均为后续模块的中间变量，不在此处直接修改产出或GDP。
 */
export function updateIndustrialPolicy(nation: NationState): void {
  const isNeutral = industrialPolicyCategoryIds.every((industryId) => {
    const policy = nation.industrialPolicy.categories[industryId];
    return policy.stance === "neutral" && Math.abs(policy.effectiveIntensity) < 1e-12;
  });
  if (isNeutral) {
    nation.industrialPolicy.annualFiscalCost = 0;
    nation.industrialPolicy.creditAllocationBias = 0;
    nation.industrialPolicy.distortionIndex = 0;
    nation.industrialPolicy.laborDisplacementPressure = 0;
    nation.industrialPolicy.administrativeEffectiveness = 1;
    nation.industrialPolicy.supplyChainConstraint = 1;
    return;
  }
  updateIndustrialPolicyTransition(nation);
  const { allocationShare } = calculateSupportAllocationShare(nation);
  nation.industrialPolicy.administrativeEffectiveness = allocationShare;
  let rawSupportFiscal = 0;
  let suppressFiscal = 0;
  let creditBias = 0;
  let distortion = 0;
  let laborDisplacement = 0;
  let supplyChainDamage = 0;
  for (const industryId of industrialPolicyCategoryIds) {
    const categoryPolicy = nation.industrialPolicy.categories[industryId];
    const intensity = categoryPolicy.effectiveIntensity;
    if (Math.abs(intensity) < 1e-12) continue;
    const stance = intensity > 0 ? "support" : "suppress";
    const target = stanceEffect(stance);
    const parameters = industrialPolicyCategoryParameters(industryId);
    const effect = industrialPolicyEffect(nation, industryId);
    const share = nation.industries[industryId].outputShare;
    const rawFiscal = nation.industries[industryId].valueAdded *
      target.annualFiscalCostRate *
      Math.abs(intensity) *
      parameters.supportCostMultiplier;
    if (stance === "support") {
      rawSupportFiscal += rawFiscal;
    } else {
      suppressFiscal += rawFiscal;
    }
    creditBias += share * effect.creditBias;
    distortion += share * target.distortionRate * Math.abs(intensity) *
      (stance === "support" ? 1.35 - effect.effectiveness * 0.35 : 1);
    if (stance === "suppress") {
      laborDisplacement += share * target.laborDisplacementRate *
        Math.abs(intensity) * parameters.employmentSensitivity * effect.effectiveness;
      supplyChainDamage += share * parameters.supplyChainImportance *
        Math.abs(intensity) * effect.effectiveness * 0.12;
    }
  }
  nation.industrialPolicy.annualFiscalCost = Math.max(
    0,
    rawSupportFiscal * allocationShare + suppressFiscal,
  );
  nation.industrialPolicy.creditAllocationBias = clamp(creditBias, -0.35, 0.25);
  nation.industrialPolicy.distortionIndex = clamp(distortion, 0, 0.2);
  nation.industrialPolicy.laborDisplacementPressure = clamp(
    laborDisplacement,
    0,
    0.18,
  );
  nation.industrialPolicy.supplyChainConstraint = clamp(
    1 - supplyChainDamage,
    0.72,
    1,
  );
}
