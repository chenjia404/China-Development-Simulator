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

  // foreignAidExpenditure 是与年度承诺同口径的展示归因，不得叠加进总支出。
  // 史实校准已隐含史实援外；玩家路线差额由援助模块的国内倍率与外汇流量传导。
  // 不再用主支出上限夹取，否则会与 annualForeignAidRMB 口径短暂偏离。
  fiscal.foreignAidExpenditure = Math.max(0, fiscal.foreignAidExpenditure);

  fiscal.expenditure = Math.max(
    0,
    primarySpending + fiscal.interestExpense +
      nation.industrialPolicy.annualFiscalCost,
  );
  fiscal.balance = fiscal.revenue - fiscal.expenditure;
}
