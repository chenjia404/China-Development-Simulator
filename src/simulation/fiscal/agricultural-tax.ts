import fiscalConfig from "../../data/config/fiscal.json";
import { clamp, safeDivide } from "../core/math";
import type { FiscalState, NationState } from "../state/game-state";

export const ABOLISH_AGRICULTURAL_TAX_POLICY_ID = "abolish_agricultural_tax";
export const AGRICULTURAL_TAX_ABOLITION_EVENT_ID =
  "agricultural_tax_abolition_2006";

const PROGRESS_LATCH_EPSILON = 1e-12;

/** 农业税潜在份额：随一产占比下降，并受制度能力弱抑制。
 * 注意：1995–2000 史实农税占财政收入一度回升到约 4%，无法由单调的一产份额函数同时拟合
 * 「1978≈2.5%」与「2000≈4%」；本函数优先锚定早期高份额与 1978 低谷，中后期用 floor
 * 保持废除前仍有约 0.8% 量级代价（接近 2004 前后），废止后清零。
 */
export function calculateAgriculturalTaxPotentialShare(
  primaryShare: number,
  institutionalEfficiency: number,
): number {
  const share = clamp(
    Number.isFinite(primaryShare) ? primaryShare : 0,
    0,
    1,
  );
  const efficiency = clamp(
    Number.isFinite(institutionalEfficiency) ? institutionalEfficiency : 0,
    0,
    1,
  );
  const raw =
    fiscalConfig.agriculturalTaxShareCoefficient *
    share ** fiscalConfig.agriculturalTaxShareExponent *
    (1 - efficiency * fiscalConfig.agriculturalTaxShareWeakDevWeight);
  if (!Number.isFinite(raw)) {
    return fiscalConfig.agriculturalTaxShareFloor;
  }
  return clamp(
    raw,
    fiscalConfig.agriculturalTaxShareFloor,
    fiscalConfig.agriculturalTaxShareCap,
  );
}

function hasNonPreventedAbolitionEvent(nation: NationState): boolean {
  return nation.history.historicalEvents.some(
    (record) =>
      record.id === AGRICULTURAL_TAX_ABOLITION_EVENT_ID &&
      record.outcome !== "prevented",
  );
}

/**
 * 解析废除强度并幂等闩上永久标志。只允许 false→true，不得清回。
 */
export function resolveAgriculturalTaxIntensity(nation: NationState): number {
  ensureFiscalAgricultureTaxState(nation);
  const { fiscal } = nation;
  const policyIntensity = clamp(
    nation.policyProgress[ABOLISH_AGRICULTURAL_TAX_POLICY_ID] ?? 0,
    0,
    1,
  );
  const eventAbolished = hasNonPreventedAbolitionEvent(nation);
  if (
    policyIntensity >= 1 - PROGRESS_LATCH_EPSILON ||
    eventAbolished ||
    fiscal.agriculturalTaxAbolished
  ) {
    fiscal.agriculturalTaxAbolished = true;
  }
  return fiscal.agriculturalTaxAbolished ? 1 : policyIntensity;
}

export function ensureFiscalAgricultureTaxState(nation: NationState): void {
  const fiscal = nation.fiscal as Partial<FiscalState> & FiscalState;
  if (!Number.isFinite(fiscal.agriculturalTaxShare)) {
    fiscal.agriculturalTaxShare = 0;
  }
  if (!Number.isFinite(fiscal.agriculturalTaxRevenue)) {
    fiscal.agriculturalTaxRevenue = 0;
  }
  if (typeof fiscal.agriculturalTaxAbolished !== "boolean") {
    fiscal.agriculturalTaxAbolished = false;
  }
  // 旧档若已有非阻止的废除事件，补扫闩上（不把已 true 清回）。
  if (hasNonPreventedAbolitionEvent(nation)) {
    fiscal.agriculturalTaxAbolished = true;
  }
}

/** 从合并税基中归因拆出农税潜在量与实收，并返回扣减后的税基。 */
export function applyAgriculturalTaxAttribution(
  nation: NationState,
  baseRevenue: number,
): number {
  ensureFiscalAgricultureTaxState(nation);
  const intensity = resolveAgriculturalTaxIntensity(nation);
  const primaryShare = safeDivide(
    nation.sectors.primary.valueAdded,
    nation.economy.realGDP,
  );
  const potentialShare = calculateAgriculturalTaxPotentialShare(
    primaryShare,
    nation.economy.institutionalEfficiency,
  );
  const agriPotential = Math.max(0, baseRevenue) * potentialShare;
  const collected = agriPotential * (1 - intensity);
  nation.fiscal.agriculturalTaxShare = potentialShare;
  nation.fiscal.agriculturalTaxRevenue = Number.isFinite(collected)
    ? collected
    : 0;
  const netBase = Math.max(0, baseRevenue - agriPotential * intensity);
  return Number.isFinite(netBase) ? netBase : 0;
}
