import populationConfig from "../../data/config/population.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";

export function updateLaborForce(nation: NationState): void {
  const { population, labor, education, health, society } = nation;
  const elderlyShare = safeDivide(population.ageGroups.elderly, population.total);
  const healthBonus = (health.index / 100 - 0.5) * 0.04;
  const targetParticipation = clamp(
    populationConfig.baseLaborParticipationRate - elderlyShare * 0.08 + healthBonus,
    populationConfig.minimumLaborParticipationRate,
    populationConfig.maximumLaborParticipationRate,
  );
  labor.participationRate = approach(
    labor.participationRate,
    targetParticipation,
    populationConfig.monthlyAdjustmentSpeed,
  );
  labor.laborForce = population.ageGroups.workingAge * labor.participationRate;

  const transitionPressure = Math.max(
    0,
    society.urbanizationRate - education.index / 100,
  );
  const targetUnemployment = clamp(
    populationConfig.baseUnemploymentRate + transitionPressure * 0.08,
    0,
    populationConfig.maximumUnemploymentRate,
  );
  labor.unemploymentRate = approach(
    labor.unemploymentRate,
    targetUnemployment,
    populationConfig.monthlyAdjustmentSpeed,
  );
  labor.unemployed = labor.laborForce * labor.unemploymentRate;
  labor.employed = labor.laborForce - labor.unemployed;

  const educationModifier = 0.65 + education.index / 200;
  const healthModifier = 0.72 + health.index / 250;
  const motivationModifier = 0.8 + society.happinessIndex / 500;
  labor.skillMatchRate = clamp(
    0.65 + education.index / 250 - transitionPressure * 0.15,
    0.5,
    1,
  );
  labor.effectiveLabor =
    labor.employed *
    educationModifier *
    healthModifier *
    labor.skillMatchRate *
    motivationModifier;
}
