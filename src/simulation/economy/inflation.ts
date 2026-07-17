import fiscalConfig from "../../data/config/fiscal.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";

export function updateInflation(nation: NationState): void {
  const { economy, fiscal, resources } = nation;
  const previousNominalGDP = economy.nominalGDP;
  const totalDemand =
    economy.householdConsumption +
    economy.investment +
    fiscal.expenditure * 0.6;
  const demandPressure = Math.max(
    0,
    safeDivide(totalDemand, economy.nominalGDP) - 0.88,
  ) * 0.2;
  const monetaryPressure =
    safeDivide(fiscal.monetaryFinancing, economy.nominalGDP) * 1.5;
  const foodPressure = Math.max(0, 1 - resources.foodSupplyRatio) * 0.35;
  const energyPressure = Math.max(0, 1 - resources.energySupplyRatio) * 0.18;
  const productivityRelief = clamp(
    economy.annualRealGDPGrowth * 0.12,
    -0.03,
    0.05,
  );
  const targetInflation = clamp(
    fiscalConfig.baseInflationRate +
      demandPressure +
      monetaryPressure +
      foodPressure +
      energyPressure -
      productivityRelief,
    fiscalConfig.minimumInflationRate,
    fiscalConfig.maximumInflationRate,
  );
  economy.inflationRate = clamp(
    approach(
      economy.inflationRate,
      targetInflation,
      fiscalConfig.inflationAdjustmentSpeed,
    ),
    fiscalConfig.minimumInflationRate,
    fiscalConfig.maximumInflationRate,
  );
  economy.priceLevelIndex *= Math.max(
    0.01,
    (1 + economy.inflationRate) ** (1 / 12),
  );
  economy.nominalGDP = economy.realGDP * economy.priceLevelIndex;
  economy.nominalGDPPerCapita = safeDivide(
    economy.nominalGDP,
    nation.population.total,
  );
  const monthlyNominalGrowth =
    safeDivide(economy.nominalGDP, previousNominalGDP, 1) - 1;
  economy.annualNominalGDPGrowth = (1 + monthlyNominalGrowth) ** 12 - 1;
}
