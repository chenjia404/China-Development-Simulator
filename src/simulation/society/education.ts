import educationConfig from "../../data/config/education.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";

function laggedValue(queue: number[], months: number): number {
  return queue[Math.max(0, queue.length - 1 - months)] ?? 0;
}

export function updateEducation(nation: NationState): void {
  const { education, fiscal, economy } = nation;
  const spending = fiscal.expenditure * fiscal.budget.education;
  const intensity = clamp(safeDivide(spending, economy.nominalGDP), 0, 0.2);
  const efficiency = clamp(
    0.45 + economy.institutionalEfficiency * 0.55,
    0.25,
    1,
  );

  while (education.delayedInvestment.length < educationConfig.queueMonths) {
    education.delayedInvestment.unshift(0);
  }
  education.delayedInvestment = education.delayedInvestment.slice(
    -educationConfig.queueMonths,
  );
  education.delayedInvestment.shift();
  education.delayedInvestment.push(intensity);

  const literacyInput = laggedValue(
    education.delayedInvestment,
    educationConfig.literacyLagMonths,
  );
  const primaryInput = laggedValue(
    education.delayedInvestment,
    educationConfig.primaryLagMonths,
  );
  const secondaryInput = laggedValue(
    education.delayedInvestment,
    educationConfig.secondaryLagMonths,
  );
  const universityInput = laggedValue(
    education.delayedInvestment,
    educationConfig.universityLagMonths,
  );
  const talentInput = laggedValue(
    education.delayedInvestment,
    educationConfig.researchTalentLagMonths,
  );

  education.literacyRate = clamp(
    education.literacyRate +
      literacyInput * educationConfig.literacyEffect * efficiency *
        (1 - education.literacyRate),
    0,
    1,
  );
  education.primaryCoverage = clamp(
    education.primaryCoverage +
      primaryInput * educationConfig.primaryEffect * efficiency *
        (1 - education.primaryCoverage),
    0,
    1,
  );
  education.secondaryCoverage = clamp(
    education.secondaryCoverage +
      secondaryInput * educationConfig.secondaryEffect * efficiency *
        (1 - education.secondaryCoverage),
    0,
    1,
  );
  education.universityCoverage = clamp(
    education.universityCoverage +
      universityInput * educationConfig.universityEffect * efficiency *
        (1 - education.universityCoverage),
    0,
    1,
  );
  education.researchTalent = Math.max(
    0,
    education.researchTalent * (1 - 0.012 / 12) +
      talentInput * education.secondaryCoverage *
        nation.population.ageGroups.workingAge * 0.000025,
  );
  const targetYears =
    education.primaryCoverage * 6 +
    education.secondaryCoverage * 5 +
    education.universityCoverage * 4;
  education.averageYearsOfSchooling = approach(
    education.averageYearsOfSchooling,
    targetYears,
    0.0025,
  );
  education.index = clamp(
    (education.literacyRate * 0.3 +
      education.primaryCoverage * 0.2 +
      education.secondaryCoverage * 0.2 +
      education.universityCoverage * 0.15 +
      clamp(education.averageYearsOfSchooling / 15, 0, 1) * 0.15) *
      100,
    0,
    educationConfig.maximumIndex,
  );
  economy.humanCapitalIndex = approach(
    economy.humanCapitalIndex,
    education.index * 0.8 + nation.health.index * 0.2,
    0.01,
  );
}
