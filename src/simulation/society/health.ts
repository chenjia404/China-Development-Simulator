import healthConfig from "../../data/config/health.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";
import { applyPolicyModifiers } from "../policies/policy-engine";

export function updateHealth(nation: NationState): void {
  const { health, fiscal, economy, education, resources } = nation;
  const spending = fiscal.expenditure * fiscal.budget.health;
  const intensity = clamp(safeDivide(spending, economy.nominalGDP), 0, 0.2);
  const efficiency = clamp(
    applyPolicyModifiers(
      nation,
      "health.efficiency",
      0.4 + economy.institutionalEfficiency * 0.6,
    ),
    0.25,
    1,
  );
  const staffConstraint = clamp(
    0.35 + education.secondaryCoverage * 0.65,
    0.2,
    1,
  );

  health.coverageRate = clamp(
    health.coverageRate +
      intensity * healthConfig.coverageEffect * efficiency * staffConstraint / 12 *
        (1 - health.coverageRate) -
      0.00015,
    0,
    1,
  );
  health.hospitalCapacity = clamp(
    health.hospitalCapacity +
      intensity * healthConfig.capacityEffect * efficiency / 12 -
      health.hospitalCapacity * 0.008 / 12,
    0,
    100,
  );
  health.doctorsPerThousand = clamp(
    health.doctorsPerThousand +
      intensity * education.secondaryCoverage *
        healthConfig.doctorTrainingEffect / 12 -
      health.doctorsPerThousand * 0.006 / 12,
    0,
    15,
  );
  health.index = clamp(
    health.coverageRate * 45 +
      health.hospitalCapacity * 0.3 +
      clamp(health.doctorsPerThousand / 5, 0, 1) * 25,
    0,
    100,
  );
  const targetLifeExpectancy = clamp(
    35 +
      Math.sqrt(health.index / 100) * 45 +
      Math.min(resources.foodSupplyRatio, 1.05) * 5,
    healthConfig.minimumLifeExpectancy,
    healthConfig.maximumLifeExpectancy,
  );
  health.lifeExpectancy = clamp(
    approach(
      health.lifeExpectancy,
      targetLifeExpectancy,
      healthConfig.lifeExpectancyAdjustmentSpeed,
    ),
    healthConfig.minimumLifeExpectancy,
    healthConfig.maximumLifeExpectancy,
  );
}
