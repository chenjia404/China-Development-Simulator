import { approach, clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";

export function updateWellbeing(nation: NationState): void {
  const { society, economy, fiscal, education, health, labor, resources } = nation;
  const incomeScore = clamp(
    Math.log1p(economy.realGDPPerCapita) / Math.log(60_001),
    0,
    1,
  );
  const welfareIntensity = safeDivide(
    fiscal.expenditure * fiscal.budget.welfare,
    economy.nominalGDP,
  );
  const targetPoverty = clamp(
    0.92 - incomeScore * 0.82 - welfareIntensity * 1.5,
    0.01,
    0.95,
  );
  society.povertyRate = approach(society.povertyRate, targetPoverty, 0.012);
  const transitionInequality = society.urbanizationRate *
    (1 - society.urbanizationRate) * 0.42;
  const targetGini = clamp(
    0.25 + transitionInequality - fiscal.effectiveTaxRate * 0.12 -
      welfareIntensity * 0.8,
    0.2,
    0.7,
  );
  society.giniCoefficient = approach(
    society.giniCoefficient,
    targetGini,
    0.01,
  );
  society.medianDisposableIncome =
    safeDivide(economy.householdIncome, nation.population.total) *
    (1 - fiscal.effectiveTaxRate) *
    (1 - society.giniCoefficient * 0.45);
  const housingInvestment = safeDivide(
    fiscal.expenditure * fiscal.budget.housing,
    economy.nominalGDP,
  );
  society.housingIndex = clamp(
    society.housingIndex + housingInvestment * 2.5 / 12 - 0.001,
    0,
    100,
  );

  const inflationPenalty = clamp(Math.abs(economy.inflationRate) / 0.25, 0, 1);
  const shortagePenalty =
    Math.max(0, 1 - resources.foodSupplyRatio) * 0.6 +
    Math.max(0, 1 - resources.energySupplyRatio) * 0.2;
  const targetHappiness = clamp(
    100 *
      (incomeScore * 0.2 +
        (1 - labor.unemploymentRate) * 0.16 +
        health.index / 100 * 0.16 +
        education.index / 100 * 0.12 +
        (1 - society.povertyRate) * 0.14 +
        Math.min(resources.foodSupplyRatio, 1) * 0.12 +
        society.housingIndex / 100 * 0.1) -
      inflationPenalty * 18 -
      shortagePenalty * 20,
    0,
    100,
  );
  society.happinessIndex = approach(
    society.happinessIndex,
    targetHappiness,
    0.04,
  );
  const targetStability = clamp(
    society.happinessIndex * 0.55 +
      (1 - labor.unemploymentRate) * 25 +
      (1 - society.povertyRate) * 20 -
      inflationPenalty * 20,
    0,
    100,
  );
  society.stabilityIndex = approach(
    society.stabilityIndex,
    targetStability,
    0.035,
  );
}
