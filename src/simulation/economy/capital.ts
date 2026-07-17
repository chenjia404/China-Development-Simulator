import economyConfig from "../../data/config/economy.json";
import industryConfigs from "../../data/config/industries.json";
import { clamp } from "../core/math";
import type { NationState, SectorId } from "../state/game-state";

export function updateCapitalAndInvestment(nation: NationState): void {
  const { economy, fiscal } = nation;
  const governmentCapitalSpending =
    fiscal.expenditure *
    (fiscal.budget.industry +
      fiscal.budget.infrastructure +
      fiscal.budget.agriculture) *
    0.65;
  const annualNominalInvestment =
    economy.nationalSavings * economyConfig.savingsToInvestmentEfficiency +
    economy.realGDP * 0.08 +
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
  const industrialPriority = nation.policies.includes("industry_priority") ? 0.12 : 0;
  const agriculturePriority = nation.policies.includes("agriculture_priority") ? 0.1 : 0;
  const allocation: Record<SectorId, number> = {
    primary: 0.2 + agriculturePriority,
    secondary: 0.42 + industrialPriority,
    tertiary: 0.38 - agriculturePriority - industrialPriority,
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
