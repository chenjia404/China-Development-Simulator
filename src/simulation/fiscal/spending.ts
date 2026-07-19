import fiscalConfig from "../../data/config/fiscal.json";
import { clamp } from "../core/math";
import type { NationState } from "../state/game-state";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { applyModifiers } from "../events/modifiers";

export function calculateFiscalSpending(nation: NationState): void {
  const { fiscal, economy } = nation;
  const budgetIntensity = Object.values(fiscal.budget).reduce(
    (total, share) => total + clamp(share, 0, 1),
    0,
  );
  const policyMultiplier = applyModifiers(
    nation,
    "fiscal.spending",
    applyPolicyModifiers(
      nation,
      "fiscal.spending",
      1,
    ),
  );
  const primarySpending =
    economy.nominalGDP *
    fiscalConfig.baseSpendingToGDP *
    budgetIntensity *
    policyMultiplier;

  // 援外支出是财政总盘子的一部分，不得在总支出中重复相加。史实校准已经
  // 隐含史实援外规模，玩家路线差异由援外模块对国内资源配置逐项传导。
  fiscal.foreignAidExpenditure = clamp(
    fiscal.foreignAidExpenditure,
    0,
    primarySpending,
  );

  fiscal.expenditure = Math.max(
    0,
    primarySpending + fiscal.interestExpense +
      nation.industrialPolicy.annualFiscalCost,
  );
  fiscal.balance = fiscal.revenue - fiscal.expenditure;
}
