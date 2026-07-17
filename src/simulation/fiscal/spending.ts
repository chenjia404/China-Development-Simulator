import fiscalConfig from "../../data/config/fiscal.json";
import { clamp } from "../core/math";
import type { NationState } from "../state/game-state";

export function calculateFiscalSpending(nation: NationState): void {
  const { fiscal, economy, policies } = nation;
  const budgetIntensity = Object.values(fiscal.budget).reduce(
    (total, share) => total + clamp(share, 0, 1),
    0,
  );
  const policyMultiplier =
    (policies.includes("deficit_spending") ? 1.55 : 1) *
    (policies.includes("austerity") ? 0.75 : 1);
  const primarySpending =
    economy.nominalGDP *
    fiscalConfig.baseSpendingToGDP *
    budgetIntensity *
    policyMultiplier;

  fiscal.expenditure = Math.max(0, primarySpending + fiscal.interestExpense);
  fiscal.balance = fiscal.revenue - fiscal.expenditure;
}
