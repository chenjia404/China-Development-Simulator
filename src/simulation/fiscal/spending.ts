import fiscalConfig from "../../data/config/fiscal.json";
import { clamp } from "../core/math";
import type { NationState } from "../state/game-state";
import { applyPolicyModifiers } from "../policies/policy-engine";

export function calculateFiscalSpending(nation: NationState): void {
  const { fiscal, economy } = nation;
  const budgetIntensity = Object.values(fiscal.budget).reduce(
    (total, share) => total + clamp(share, 0, 1),
    0,
  );
  const policyMultiplier = applyPolicyModifiers(
    nation,
    "fiscal.spending",
    1,
  );
  const primarySpending =
    economy.nominalGDP *
    fiscalConfig.baseSpendingToGDP *
    budgetIntensity *
    policyMultiplier;

  fiscal.expenditure = Math.max(0, primarySpending + fiscal.interestExpense);
  fiscal.balance = fiscal.revenue - fiscal.expenditure;
}
