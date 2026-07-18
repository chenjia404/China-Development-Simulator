import educationConfig from "../../data/config/education.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { applyModifiers } from "../events/modifiers";

function laggedValue(queue: number[], months: number): number {
  return queue[Math.max(0, queue.length - 1 - months)] ?? 0;
}

/** 为旧存档补齐教育中断与科研人才存量字段。 */
export function ensureEducationState(nation: NationState): void {
  const education = nation.education;
  education.higherEducationAdmissionCapacity = Number.isFinite(
      education.higherEducationAdmissionCapacity,
    )
    ? clamp(education.higherEducationAdmissionCapacity, 0, 1)
    : 1;
  education.academicContinuity = Number.isFinite(education.academicContinuity)
    ? clamp(education.academicContinuity, 0, 1)
    : 1;
  education.researchCohortGap = Number.isFinite(education.researchCohortGap)
    ? clamp(education.researchCohortGap, 0, 1)
    : 0;
  education.educationDisruptionMonths = Number.isFinite(
      education.educationDisruptionMonths,
    )
    ? Math.max(0, Math.round(education.educationDisruptionMonths))
    : 0;
  education.permanentResearchTalentLosses = Number.isFinite(
      education.permanentResearchTalentLosses,
    )
    ? Math.max(0, education.permanentResearchTalentLosses)
    : 0;
}

export function updateEducation(nation: NationState): void {
  ensureEducationState(nation);
  const { education, fiscal, economy } = nation;
  const spending = fiscal.expenditure * fiscal.budget.education;
  const intensity = clamp(safeDivide(spending, economy.nominalGDP), 0, 0.2);
  const efficiency = clamp(
    applyModifiers(
      nation,
      "education.efficiency",
      applyPolicyModifiers(
        nation,
        "education.efficiency",
        0.45 + economy.institutionalEfficiency * 0.55,
      ),
    ),
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
  const admissionTarget = clamp(
    applyModifiers(nation, "education.higherEducationAdmissions", 1),
    0,
    1,
  );
  const academicContinuityTarget = clamp(
    applyModifiers(nation, "education.academicContinuityTarget", 1),
    0.05,
    1,
  );
  const researchCohortFormation = clamp(
    applyModifiers(nation, "education.researchCohortFormation", 1),
    0,
    1.5,
  );
  const researchTalentRetention = clamp(
    applyModifiers(nation, "education.researchTalentRetention", 1),
    0.2,
    1,
  );
  education.higherEducationAdmissionCapacity = approach(
    education.higherEducationAdmissionCapacity,
    admissionTarget,
    admissionTarget < education.higherEducationAdmissionCapacity
      ? educationConfig.admissionClosureSpeed
      : educationConfig.admissionRecoverySpeed,
  );
  education.academicContinuity = approach(
    education.academicContinuity,
    academicContinuityTarget,
    academicContinuityTarget < education.academicContinuity
      ? educationConfig.academicDisruptionSpeed
      : educationConfig.academicRecoverySpeed,
  );
  const cohortGapTarget = clamp(
    1 - education.higherEducationAdmissionCapacity *
      education.academicContinuity * Math.min(1, researchCohortFormation),
    0,
    1,
  );
  education.researchCohortGap = approach(
    education.researchCohortGap,
    cohortGapTarget,
    cohortGapTarget > education.researchCohortGap
      ? educationConfig.cohortGapAccumulationSpeed
      : educationConfig.cohortGapRecoverySpeed,
  );
  if (education.higherEducationAdmissionCapacity < 0.5) {
    education.educationDisruptionMonths += 1;
  }

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
        education.higherEducationAdmissionCapacity *
        education.academicContinuity *
        (1 - education.universityCoverage),
    0,
    1,
  );
  const forcedTalentLoss = education.researchTalent *
    Math.max(0, 1 - researchTalentRetention) *
    educationConfig.forcedResearchTalentLossScale;
  education.permanentResearchTalentLosses += forcedTalentLoss;
  education.researchTalent = Math.max(
    0,
    education.researchTalent * (1 - 0.012 / 12) - forcedTalentLoss +
      talentInput * education.secondaryCoverage *
        nation.population.ageGroups.workingAge * 0.000025 *
        education.higherEducationAdmissionCapacity *
        education.academicContinuity *
        researchCohortFormation *
        (1 - education.researchCohortGap *
          educationConfig.researchCohortTalentPenalty),
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
  const humanCapitalFormation = clamp(
    applyModifiers(
      nation,
      "education.humanCapitalFormation",
      applyPolicyModifiers(
        nation,
        "education.humanCapitalFormation",
        1,
      ),
    ),
    0.5,
    1.6,
  );
  economy.humanCapitalIndex = approach(
    economy.humanCapitalIndex,
    education.index * 0.8 + nation.health.index * 0.2,
    0.01 * humanCapitalFormation,
  );
}
