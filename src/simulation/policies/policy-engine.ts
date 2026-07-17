import policyConfig from "../../data/config/policies.json";
import { approach, clamp } from "../core/math";
import type { NationState } from "../state/game-state";

export function updatePolicyEnvironment(nation: NationState): void {
  const openingTarget = nation.policies.includes("expand_opening")
    ? policyConfig.openingTarget
    : policyConfig.closedTarget;
  nation.trade.openness = clamp(
    approach(
      nation.trade.openness,
      openingTarget,
      policyConfig.openingAdjustmentSpeed,
    ),
    0,
    1,
  );
  const administrationCapacity = clamp(
    nation.fiscal.budget.administration / 0.1,
    0,
    1.5,
  );
  const institutionTarget = clamp(
    0.25 +
      nation.education.index / 100 * 0.35 +
      nation.trade.openness * 0.25 +
      administrationCapacity * 0.08,
    0.1,
    0.95,
  );
  nation.economy.institutionalEfficiency = approach(
    nation.economy.institutionalEfficiency,
    institutionTarget,
    policyConfig.institutionAdjustmentSpeed,
  );
  const investmentConfidence =
    nation.trade.openness *
    nation.economy.institutionalEfficiency *
    nation.society.stabilityIndex / 100;
  nation.trade.foreignInvestment =
    nation.economy.nominalGDP *
    policyConfig.maximumForeignInvestmentShare *
    investmentConfidence;
}
