import technologyConfig from "../../data/config/technology.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";

export function updateTechnology(nation: NationState): void {
  const { technology, education, fiscal, economy, sectors, trade } = nation;
  const researchSpending = fiscal.expenditure * fiscal.budget.research;
  const fundingIntensity = clamp(
    Math.sqrt(safeDivide(researchSpending, economy.nominalGDP) / 0.01),
    0,
    2,
  );
  const talentFactor = clamp(
    Math.log1p(education.researchTalent) / Math.log(10_000_001),
    0.05,
    1,
  );
  const universityFactor = 0.2 + education.universityCoverage * 0.8;
  const institutionFactor = economy.institutionalEfficiency;
  const industryDemand = clamp(
    0.3 + sectors.secondary.valueAdded / Math.max(economy.realGDP, 1),
    0.25,
    0.8,
  );
  const researchOutput =
    technologyConfig.researchProductivity *
    fundingIntensity *
    talentFactor *
    universityFactor *
    institutionFactor *
    industryDemand;
  technology.monthlyResearchOutput = researchOutput;
  technology.researchPoints += researchOutput;

  const targetAdoption = clamp(
    education.index / 100 * 0.38 +
      economy.infrastructureIndex / 100 * 0.32 +
      economy.institutionalEfficiency * 0.2 +
      trade.openness * 0.1,
    0.05,
    1,
  );
  technology.adoptionRate = approach(
    technology.adoptionRate,
    targetAdoption,
    technologyConfig.adoptionAdjustmentSpeed,
  );
  const diffusion =
    Math.max(0, 85 - technology.index) *
    trade.openness *
    education.literacyRate *
    technologyConfig.diffusionStrength;
  const technologyGain =
    researchOutput * (0.2 + technology.adoptionRate * 0.8) + diffusion;
  technology.index = clamp(
    technology.index + technologyGain,
    0,
    technologyConfig.maximumTechnologyIndex,
  );

  const monthlyTFPGrowth = clamp(
    technologyGain * 0.0035,
    -technologyConfig.maximumMonthlyTFPGrowth,
    technologyConfig.maximumMonthlyTFPGrowth,
  );
  economy.totalFactorProductivity *= 1 + monthlyTFPGrowth;
  sectors.primary.productivity *= 1 + monthlyTFPGrowth * 0.75;
  sectors.secondary.productivity *= 1 + monthlyTFPGrowth * 1.15;
  sectors.tertiary.productivity *= 1 + monthlyTFPGrowth;
}
