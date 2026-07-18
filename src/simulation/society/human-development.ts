import humanDevelopmentData from "../../data/config/human-development.json";
import { clamp, safeDivide } from "../core/math";
import type {
  EducationStageAccount,
  EducationStageId,
  HumanDevelopmentState,
  LaborSkillAccount,
  LaborSkillId,
  NationState,
} from "../state/game-state";

interface HumanDevelopmentConfig {
  educationStageWeights: Record<EducationStageId, number>;
  baseCompletionRates: Record<EducationStageId, number>;
  laborSkillWages: Record<LaborSkillId, number>;
}
const config = humanDevelopmentData as HumanDevelopmentConfig;
export const EDUCATION_STAGE_IDS = ["primary", "secondary", "vocational", "higher"] as const;
export const LABOR_SKILL_IDS = ["basic", "skilled", "advanced", "research"] as const;

function educationStage(id: EducationStageId): EducationStageAccount {
  return { id, eligiblePopulation: 0, enrolledStudents: 0, enrollmentRate: 0,
    completionRate: 0, graduates: 0 };
}
function laborSkill(id: LaborSkillId): LaborSkillAccount {
  return { id, laborForce: 0, employed: 0, unemploymentRate: 0,
    relativeWage: config.laborSkillWages[id] };
}
export function createEmptyHumanDevelopmentState(): HumanDevelopmentState {
  return {
    educationStages: {
      primary: educationStage("primary"), secondary: educationStage("secondary"),
      vocational: educationStage("vocational"), higher: educationStage("higher"),
    },
    laborSkills: {
      basic: laborSkill("basic"), skilled: laborSkill("skilled"),
      advanced: laborSkill("advanced"), research: laborSkill("research"),
    },
    skillMismatchRate: 0, vocationalCapacity: 0, lifelongLearningRate: 0,
    primaryCareCoverage: 0, preventiveCareCoverage: 0,
    hospitalBedsPerThousand: 0, healthWorkersPerThousand: 0,
    communicableDiseaseBurden: 0, nonCommunicableDiseaseBurden: 0,
    injuryBurden: 0, healthyLifeExpectancy: 0, outOfPocketHealthShare: 0,
    healthRelatedLaborLoss: 0, educationPopulationError: 0,
    laborForceError: 0, employmentError: 0,
  };
}

export function ensureHumanDevelopmentState(nation: NationState): void {
  const existing = nation.humanDevelopment as Partial<HumanDevelopmentState> | undefined;
  if (existing?.educationStages && existing.laborSkills &&
    Number.isFinite(existing.laborForceError)) return;
  nation.humanDevelopment = createEmptyHumanDevelopmentState();
  updateHumanDevelopment(nation);
}

function allocateLaborSkills(nation: NationState): Record<LaborSkillId, number> {
  const education = nation.education.index / 100;
  const technology = nation.technology.index / 100;
  const raw = {
    basic: Math.max(0.08, 0.86 - education * 0.66),
    skilled: 0.1 + education * 0.38,
    advanced: 0.025 + education * 0.2 + technology * 0.06,
    research: 0.002 + education * technology * 0.045,
  };
  const total = LABOR_SKILL_IDS.reduce((sum, id) => sum + raw[id], 0);
  return Object.fromEntries(LABOR_SKILL_IDS.map((id) => [id, raw[id] / total])) as
    Record<LaborSkillId, number>;
}

/** 将既有教育、就业与医疗总量守恒拆分为学段、技能和疾病账户。 */
export function updateHumanDevelopment(nation: NationState): void {
  if (!nation.humanDevelopment?.educationStages) {
    nation.humanDevelopment = createEmptyHumanDevelopmentState();
  }
  const state = nation.humanDevelopment;
  const children = nation.population.ageGroups.children;
  const educationIndex = nation.education.index / 100;
  const continuity = nation.education.academicContinuity;
  let educationPopulation = 0;
  for (const id of EDUCATION_STAGE_IDS) {
    const account = state.educationStages[id];
    account.eligiblePopulation = children * config.educationStageWeights[id];
    const levelPenalty = id === "higher" ? 0.22 : id === "vocational" ? 0.1 : id === "secondary" ? 0.05 : 0;
    const baseCoverage = id === "primary"
      ? nation.education.primaryCoverage
      : id === "secondary"
        ? nation.education.secondaryCoverage
        : id === "vocational"
          ? nation.education.secondaryCoverage * 0.72
          : nation.education.universityCoverage *
            nation.education.higherEducationAdmissionCapacity;
    account.enrollmentRate = clamp(
      baseCoverage * (1 - levelPenalty) + educationIndex * levelPenalty,
      0, 1,
    );
    account.enrolledStudents = account.eligiblePopulation * account.enrollmentRate;
    account.completionRate = clamp(
      config.baseCompletionRates[id] * (0.55 + continuity * 0.25 + educationIndex * 0.3),
      0, 1,
    );
    account.graduates = account.enrolledStudents * account.completionRate /
      (id === "primary" ? 6 : id === "secondary" ? 6 : id === "vocational" ? 3 : 4);
    educationPopulation += account.eligiblePopulation;
  }
  state.educationPopulationError = Math.abs(educationPopulation - children);
  state.vocationalCapacity = safeDivide(
    state.educationStages.vocational.enrolledStudents,
    nation.population.ageGroups.workingAge,
  );
  state.lifelongLearningRate = clamp(
    educationIndex * 0.18 + nation.technology.adoptionRate * 0.12,
    0, 0.45,
  );

  const skillShares = allocateLaborSkills(nation);
  let laborTotal = 0;
  let employmentTotal = 0;
  for (const id of LABOR_SKILL_IDS) {
    const account = state.laborSkills[id];
    account.laborForce = nation.labor.laborForce * skillShares[id];
    const unemploymentAdjustment = id === "basic" ? 0.025 : id === "research" ? -0.018 : 0;
    account.unemploymentRate = clamp(
      nation.labor.unemploymentRate + unemploymentAdjustment, 0, 0.6,
    );
    account.employed = account.laborForce * (1 - account.unemploymentRate);
    laborTotal += account.laborForce;
    employmentTotal += account.employed;
  }
  const employmentScale = safeDivide(nation.labor.employed, employmentTotal, 1);
  for (const id of LABOR_SKILL_IDS) state.laborSkills[id].employed *= employmentScale;
  employmentTotal = LABOR_SKILL_IDS.reduce((sum, id) => sum + state.laborSkills[id].employed, 0);
  state.laborForceError = Math.abs(laborTotal - nation.labor.laborForce);
  state.employmentError = Math.abs(employmentTotal - nation.labor.employed);
  state.skillMismatchRate = clamp(1 - nation.labor.skillMatchRate, 0, 1);

  state.primaryCareCoverage = clamp(
    nation.health.coverageRate * 0.75 + nation.fiscal.budget.health * 1.4, 0, 1,
  );
  state.preventiveCareCoverage = clamp(
    state.primaryCareCoverage * 0.72 + nation.education.literacyRate * 0.18, 0, 1,
  );
  state.hospitalBedsPerThousand = Math.max(0, nation.health.hospitalCapacity * 0.55);
  state.healthWorkersPerThousand = Math.max(0, nation.health.doctorsPerThousand * 1.65);
  state.communicableDiseaseBurden = clamp(
    0.72 - state.primaryCareCoverage * 0.45 -
      nation.resources.agriculture.foodSecurityCoverage * 0.16, 0.01, 0.9,
  );
  state.nonCommunicableDiseaseBurden = clamp(
    0.08 + nation.health.lifeExpectancy / 100 * 0.32 +
      nation.resources.infrastructureResources.airPollutionIndex / 100 * 0.18, 0.05, 0.75,
  );
  state.injuryBurden = clamp(
    0.16 - nation.economy.infrastructureIndex / 100 * 0.06, 0.04, 0.2,
  );
  const totalBurden = state.communicableDiseaseBurden +
    state.nonCommunicableDiseaseBurden + state.injuryBurden;
  state.healthyLifeExpectancy = clamp(
    nation.health.lifeExpectancy - totalBurden * 5.5, 20, nation.health.lifeExpectancy,
  );
  state.outOfPocketHealthShare = clamp(
    0.78 - nation.health.coverageRate * 0.58 -
      nation.fiscal.federalism.socialProtection.medical.benefitExpenditure /
        Math.max(nation.fiscal.expenditure, 1) * 0.2,
    0.08, 0.85,
  );
  state.healthRelatedLaborLoss = clamp(totalBurden * 0.035, 0, 0.12);
}
