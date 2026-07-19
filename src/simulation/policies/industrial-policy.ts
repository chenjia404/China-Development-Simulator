import industrialPolicyConfig from "../../data/config/industrial-policies.json";
import { clamp } from "../core/math";
import type {
  IndustrialCategoryId,
  IndustrialPolicyCategoryState,
  IndustrialPolicyStance,
  IndustrialPolicyState,
  NationState,
} from "../state/game-state";

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
  };
}

export function ensureIndustrialPolicyState(nation: NationState): void {
  const existing = nation.industrialPolicy as Partial<IndustrialPolicyState> | undefined;
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

export function updateIndustrialPolicyTransition(nation: NationState): void {
  ensureIndustrialPolicyState(nation);
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
