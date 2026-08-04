import economyConfig from "../../data/config/economy.json";
import industryConfigs from "../../data/config/industries.json";
import { clamp } from "../core/math";
import type { NationState, SectorId } from "../state/game-state";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { applyModifiers } from "../events/modifiers";
import {
  foreignExchangeInvestmentMultiplier,
  remittanceDirectedInvestment,
} from "./foreign-exchange";
import { calculatePrivateEconomyMultipliers } from "./private-economy";
import { foreignAidProgramEffects } from "../diplomacy/foreign-aid";
import { capitalMarketInvestmentMultipliers } from "./monetary-financial";
import { calculateIndustrialPolicyAggregateEffects } from "../policies/industrial-policy";
import { economicCoordinationSecondaryAllocationBias } from "./economic-coordination";

export function updateCapitalAndInvestment(nation: NationState): void {
  const { economy, fiscal } = nation;
  const privateEconomyMultiplier = calculatePrivateEconomyMultipliers(nation)
    .investment;
  const capitalMarket = capitalMarketInvestmentMultipliers(nation);
  const industrialPolicy = calculateIndustrialPolicyAggregateEffects(nation);
  const foreignAidEffects = foreignAidProgramEffects(nation);
  const governmentCapitalSpending = applyModifiers(
    nation,
    "capital.governmentInvestment",
    fiscal.expenditure *
      (fiscal.budget.industry +
        fiscal.budget.infrastructure +
        fiscal.budget.agriculture) *
      0.65,
  ) * foreignAidEffects.domesticInvestmentMultiplier;
  const exportSurplusReinvestmentRate = clamp(
    applyPolicyModifiers(
      nation,
      "capital.exportSurplusReinvestmentRate",
      0,
    ),
    0,
    0.8,
  );
  // 贸易顺差是上一结算月已经实现的流量，只将政策明确留存的部分转为
  // 本月设备和产能投资，避免把出口总额或外汇储备重复计入资本。
  const exportSurplusReinvestment =
    Math.max(0, nation.trade.balance) * exportSurplusReinvestmentRate;
  const privateInvestment = applyModifiers(
    nation,
    "capital.privateInvestment",
    applyPolicyModifiers(
      nation,
      "capital.privateInvestment",
      (economy.nationalSavings * economyConfig.savingsToInvestmentEfficiency +
        economy.realGDP * 0.08 +
        remittanceDirectedInvestment(nation) +
        exportSurplusReinvestment) * privateEconomyMultiplier *
        capitalMarket.privateInvestment *
        industrialPolicy.investmentMultiplier,
    ),
  );
  const annualNominalInvestment =
    privateInvestment +
    governmentCapitalSpending +
    nation.trade.foreignInvestment;
  const investmentEfficiency = clamp(
    applyModifiers(
      nation,
      "capital.investmentEfficiency",
      applyPolicyModifiers(
        nation,
        "capital.investmentEfficiency",
        economyConfig.baseInvestmentEfficiency *
          (0.7 + economy.institutionalEfficiency * 0.3) *
          capitalMarket.investmentEfficiency *
          foreignExchangeInvestmentMultiplier(nation) *
          Math.min(
            nation.resources.energySupplyRatio,
            nation.resources.foodSupplyRatio,
          ),
      ),
    ),
    0.1,
    0.9,
  );
  const maximumAnnualCapitalGrowth = clamp(
    applyPolicyModifiers(
      nation,
      "capital.maximumAnnualGrowth",
      economyConfig.maximumAnnualCapitalGrowth,
    ),
    0.08,
    0.3,
  );
  const maximumMonthlyInvestment =
    economy.capitalStock * maximumAnnualCapitalGrowth / 12;
  const effectiveMonthlyInvestment = Math.min(
    annualNominalInvestment * investmentEfficiency / 12,
    maximumMonthlyInvestment,
  );
  const primaryAllocation = applyPolicyModifiers(
    nation,
    "capital.primaryAllocation",
    0.2,
  );
  const secondaryAllocation = clamp(
    applyPolicyModifiers(
      nation,
      "capital.secondaryAllocation",
      0.42,
    ) + economicCoordinationSecondaryAllocationBias(nation),
    0.2,
    0.62,
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
  const infrastructureEffort = applyModifiers(
    nation,
    "economy.infrastructureInvestment",
    fiscal.budget.infrastructure * fiscal.expenditure /
      Math.max(economy.nominalGDP, 1),
  );
  economy.infrastructureIndex = clamp(
    economy.infrastructureIndex +
      infrastructureEffort * economyConfig.infrastructureMonthlyConvergence,
    0,
    100,
  );
}
