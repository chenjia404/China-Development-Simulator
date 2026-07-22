import domesticDemandConfig from "../../data/config/domestic-demand.json";
import { approach, clamp, safeDivide } from "../core/math";
import { applyModifiers } from "../events/modifiers";
import { applyPolicyModifiers } from "../policies/policy-engine";
import type { NationState, SectorId } from "../state/game-state";
import { remittanceDomesticIncome } from "./foreign-exchange";

export interface DemandComposition {
  consumptionShare: number;
  investmentShare: number;
  governmentConsumptionShare: number;
  exportShare: number;
  importShare: number;
}

function currentGovernmentConsumption(nation: NationState): number {
  const { budget, expenditure } = nation.fiscal;
  const currentServiceShare =
    budget.education +
    budget.health +
    budget.defense +
    budget.administration;
  return expenditure * currentServiceShare *
    domesticDemandConfig.governmentConsumptionEfficiency;
}

function nominalHouseholdConsumption(nation: NationState): number {
  return nation.economy.householdConsumption *
    Math.max(0.01, nation.economy.priceLevelIndex);
}

export function ensureDomesticDemandState(nation: NationState): void {
  const economy = nation.economy as Partial<NationState["economy"]>;
  const nominalGDP = Math.max(1, economy.nominalGDP ?? economy.realGDP ?? 1);
  const householdIncome = Math.max(0, economy.householdIncome ?? nominalGDP * 0.52);
  const disposableIncome = Math.max(
    0,
    economy.householdDisposableIncome ??
      householdIncome * (1 - nation.fiscal.effectiveTaxRate),
  );
  economy.householdDisposableIncome = disposableIncome;
  economy.consumptionPropensity = clamp(
    economy.consumptionPropensity ??
      safeDivide(economy.householdConsumption ?? 0, disposableIncome, 0.72),
    0.45,
    0.98,
  );
  economy.socialProtectionIncome = Math.max(0, economy.socialProtectionIncome ?? 0);
  economy.domesticDemand = Math.max(
    0,
    economy.domesticDemand ??
      (economy.householdConsumption ?? 0) *
        Math.max(0.01, economy.priceLevelIndex ?? 1) +
        (economy.investment ?? 0) +
        currentGovernmentConsumption(nation),
  );
  economy.domesticDemandShare = clamp(
    economy.domesticDemandShare ?? safeDivide(economy.domesticDemand, nominalGDP),
    0,
    2.5,
  );
}

/**
 * 计算居民收入和内需。社会保障属于收入再分配，不直接计入 GDP；它通过转移
 * 收入和降低预防性储蓄，在下一月影响产能利用率与实际生产。
 */
export function updateHouseholdAndDomesticDemand(nation: NationState): void {
  const { economy, fiscal, society, labor } = nation;
  const nominalGDP = Math.max(1, economy.nominalGDP);
  const welfareSpending = Math.max(
    0,
    applyModifiers(
      nation,
      "wellbeing.welfare",
      applyPolicyModifiers(
        nation,
        "wellbeing.welfare",
        fiscal.expenditure * fiscal.budget.welfare,
      ),
    ),
  );
  const socialProtectionIncome = Math.min(
    welfareSpending * domesticDemandConfig.socialProtection.transferEfficiency,
    nominalGDP * domesticDemandConfig.socialProtection.maximumTransferShareOfGDP,
  );
  const protectionIntensity = safeDivide(socialProtectionIncome, nominalGDP);
  const needMultiplier =
    1 + society.povertyRate * 0.65 + labor.unemploymentRate * 1.2;
  const propensityBoost = clamp(
    protectionIntensity *
      domesticDemandConfig.socialProtection.precautionarySavingRelief *
      needMultiplier,
    0,
    domesticDemandConfig.socialProtection.maximumConsumptionPropensityBoost,
  );

  economy.socialProtectionIncome = socialProtectionIncome;
  economy.householdIncome =
    economy.realGDP * 0.52 +
    remittanceDomesticIncome(nation) +
    socialProtectionIncome;
  economy.householdDisposableIncome = Math.max(
    0,
    economy.householdIncome * (1 - fiscal.effectiveTaxRate),
  );
  economy.consumptionPropensity = clamp(
    applyModifiers(
      nation,
      "economy.consumptionPropensity",
      applyPolicyModifiers(
        nation,
        "economy.consumptionPropensity",
        0.9 - Math.log1p(economy.realGDPPerCapita) / 40 + propensityBoost,
      ),
    ),
    0.52,
    0.98,
  );
  economy.householdConsumption =
    economy.householdDisposableIncome * economy.consumptionPropensity;
  economy.nationalSavings = Math.max(
    0,
    economy.householdDisposableIncome - economy.householdConsumption,
  );
  economy.domesticDemand = Math.max(
    0,
    nominalHouseholdConsumption(nation) +
      economy.investment +
      currentGovernmentConsumption(nation),
  );
  economy.domesticDemandShare = clamp(
    safeDivide(economy.domesticDemand, nominalGDP),
    0,
    2.5,
  );
}

export function calculateDemandComposition(nation: NationState): DemandComposition {
  ensureDomesticDemandState(nation);
  const nominalGDP = Math.max(1, nation.economy.nominalGDP);
  return {
    consumptionShare: clamp(
      safeDivide(nominalHouseholdConsumption(nation), nominalGDP),
      0,
      1.4,
    ),
    investmentShare: clamp(
      safeDivide(nation.economy.investment, nominalGDP),
      0,
      1,
    ),
    governmentConsumptionShare: clamp(
      safeDivide(currentGovernmentConsumption(nation), nominalGDP),
      0,
      0.6,
    ),
    exportShare: clamp(safeDivide(nation.trade.exports, nominalGDP), 0, 0.8),
    importShare: clamp(safeDivide(nation.trade.imports, nominalGDP), 0, 0.8),
  };
}

/** 使用上一结算月已经实现的内外需求，渐进调整本月产能利用率。 */
export function updateDemandDrivenCapacityUtilization(nation: NationState): void {
  const demand = calculateDemandComposition(nation);
  const reference = domesticDemandConfig.referenceDemandShares;
  for (const id of Object.keys(nation.sectors) as SectorId[]) {
    const weights = domesticDemandConfig.sectorDemandWeights[id];
    const demandAdjustment = clamp(
      (demand.consumptionShare - reference.consumption) * weights.consumption +
        (demand.investmentShare - reference.investment) * weights.investment +
        (demand.governmentConsumptionShare - reference.government) *
          weights.government +
        (demand.exportShare - reference.exports) * weights.exports +
        (demand.importShare - reference.imports) * weights.imports,
      -domesticDemandConfig.maximumDemandUtilizationAdjustment,
      domesticDemandConfig.maximumDemandUtilizationAdjustment,
    );
    const target = clamp(
      weights.baseline + demandAdjustment,
      domesticDemandConfig.minimumTargetUtilization,
      domesticDemandConfig.maximumTargetUtilization,
    );
    nation.sectors[id].capacityUtilization = approach(
      nation.sectors[id].capacityUtilization,
      target,
      domesticDemandConfig.capacityAdjustmentSpeed,
    );
  }
}
