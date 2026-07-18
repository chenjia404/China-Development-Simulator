import technologyConfig from "../../data/config/technology.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";
import { applyModifiers } from "../events/modifiers";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { diplomaticStrategyEffects } from "../diplomacy/diplomatic-strategy";
import { updateTechnologyTree } from "./technology-tree";
import { calculatePrivateEconomyMultipliers } from "../economy/private-economy";

export function updateTechnology(nation: NationState): void {
  const { technology, education, fiscal, economy, sectors, trade } = nation;
  const strategyEffects = diplomaticStrategyEffects(nation);
  const privateEconomy = calculatePrivateEconomyMultipliers(nation);
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
  const researchContinuityFactor = clamp(
    0.7 + education.academicContinuity * 0.18 +
      (1 - education.researchCohortGap) * 0.12,
    0.7,
    1,
  );
  const institutionFactor = economy.institutionalEfficiency;
  const industryDemand = clamp(
    0.3 + sectors.secondary.valueAdded / Math.max(economy.realGDP, 1),
    0.25,
    0.8,
  );
  const policyResearchOutput = applyPolicyModifiers(
    nation,
    "technology.researchOutput",
    technologyConfig.researchProductivity *
      fundingIntensity *
      talentFactor *
      universityFactor *
      institutionFactor *
      industryDemand,
  );
  const researchOutputBeforeContinuity = applyModifiers(
    nation,
    "technology.researchOutput",
    policyResearchOutput,
  ) * strategyEffects.researchOutputMultiplier;
  const researchOutput = researchOutputBeforeContinuity *
    (0.9 + researchContinuityFactor * 0.1) *
    privateEconomy.researchCommercialization;
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
    technologyConfig.diffusionStrength *
    strategyEffects.technologyDiffusionMultiplier *
    privateEconomy.technologyDiffusion;
  const researchCommercialization = clamp(
    applyPolicyModifiers(
      nation,
      "technology.researchCommercialization",
      1,
    ),
    0.5,
    1.6,
  );
  const technologyGain =
    researchOutput *
      (0.2 + technology.adoptionRate * 0.8) *
      researchCommercialization +
    diffusion;
  const previousTechnologyIndex = technology.index;
  technology.index = clamp(
    technology.index + technologyGain,
    0,
    technologyConfig.maximumTechnologyIndex,
  );
  const effectiveTechnologyGain = technology.index - previousTechnologyIndex;
  updateTechnologyTree(nation, researchOutput * researchContinuityFactor);

  // 技术指数描述当期技术水平，结构性生产率则记录制度、人才和组织知识形成的
  // 路径依赖。后者在修正到期后不会倒扣，因而能让更高的发展基数继续复利。
  const policyStructuralProductivityGrowth = applyPolicyModifiers(
    nation,
    "economy.structuralProductivityGrowth",
    0,
  );
  const structuralProductivityGrowth = applyModifiers(
    nation,
    "economy.structuralProductivityGrowth",
    policyStructuralProductivityGrowth,
  );
  const exportIntensity = clamp(
    safeDivide(trade.exports, economy.nominalGDP),
    0,
    0.5,
  );
  const manufacturingShare = clamp(
    safeDivide(sectors.secondary.valueAdded, economy.realGDP),
    0.1,
    0.7,
  );
  const exportLearningRate = clamp(
    applyPolicyModifiers(nation, "technology.exportLearningRate", 0),
    0,
    0.03,
  );
  // 出口学习依赖真实出口、制造业能力和人力资本，不会在封闭或低技能状态下
  // 凭空产生生产率；形成的组织知识继续保存在 TFP 存量中。
  const exportLearningGrowth =
    exportLearningRate *
    exportIntensity *
    manufacturingShare *
    clamp(0.35 + economy.humanCapitalIndex / 100, 0.35, 1.2);
  const combinedStructuralGrowth =
    structuralProductivityGrowth + exportLearningGrowth;
  const monthlyTFPGrowth = clamp(
    effectiveTechnologyGain * 0.0267 + combinedStructuralGrowth,
    -technologyConfig.maximumMonthlyTFPGrowth,
    technologyConfig.maximumMonthlyTFPGrowth,
  );
  economy.totalFactorProductivity *= 1 + monthlyTFPGrowth;
  sectors.primary.productivity *= 1 + monthlyTFPGrowth * 0.65;
  sectors.secondary.productivity *= 1 + monthlyTFPGrowth * 0.88;
  sectors.tertiary.productivity *= 1 + monthlyTFPGrowth * 1.25;
}
