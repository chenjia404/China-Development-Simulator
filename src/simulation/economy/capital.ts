import economyConfig from "../../data/config/economy.json";
import industryConfigs from "../../data/config/industries.json";
import { clamp } from "../core/math";
import type { NationState, SectorId } from "../state/game-state";
import { applyPolicyModifiers } from "../policies/policy-engine";

export function updateCapitalAndInvestment(nation: NationState): void {
  const { economy, fiscal } = nation;
  const governmentCapitalSpending =
    fiscal.expenditure *
    (fiscal.budget.industry +
      fiscal.budget.infrastructure +
      fiscal.budget.agriculture) *
    0.65;
  const privateInvestment = applyPolicyModifiers(
    nation,
    "capital.privateInvestment",
    economy.nationalSavings * economyConfig.savingsToInvestmentEfficiency +
      economy.realGDP * 0.08,
  );
  const annualNominalInvestment =
    privateInvestment +
    governmentCapitalSpending +
    nation.trade.foreignInvestment;
  const investmentEfficiency = clamp(
    economyConfig.baseInvestmentEfficiency *
      (0.7 + economy.institutionalEfficiency * 0.3) *
      Math.min(nation.resources.energySupplyRatio, nation.resources.foodSupplyRatio),
    0.1,
    0.9,
  );
  const maximumMonthlyInvestment =
    economy.capitalStock * economyConfig.maximumAnnualCapitalGrowth / 12;
  const effectiveMonthlyInvestment = Math.min(
    annualNominalInvestment * investmentEfficiency / 12,
    maximumMonthlyInvestment,
  );
  const primaryAllocation = applyPolicyModifiers(
    nation,
    "capital.primaryAllocation",
    0.2,
  );
  const secondaryAllocation = applyPolicyModifiers(
    nation,
    "capital.secondaryAllocation",
    0.42,
  );
  const allocation: Record<SectorId, number> = {
    primary: primaryAllocation,
    secondary: secondaryAllocation,
    tertiary: Math.max(0.08, 1 - primaryAllocation - secondaryAllocation),
  };

  let totalCapital = 0;
  for (const id of Object.keys(nation.sectors) as SectorId[]) {
    const sector = nation.sectors[id];
    const depreciation =
      sector.capitalStock * industryConfigs[id].annualDepreciationRate / 12;
    sector.capitalStock = Math.max(
      1,
      sector.capitalStock + effectiveMonthlyInvestment * allocation[id] - depreciation,
    );
    totalCapital += sector.capitalStock;
  }

  economy.investment = annualNominalInvestment;
  economy.capitalStock = totalCapital;
  const infrastructureEffort =
    fiscal.budget.infrastructure * fiscal.expenditure /
    Math.max(economy.nominalGDP, 1);
  economy.infrastructureIndex = clamp(
    economy.infrastructureIndex +
      infrastructureEffort * economyConfig.infrastructureMonthlyConvergence,
    0,
    100,
  );
}
