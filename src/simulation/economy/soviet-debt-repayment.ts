import policyCatalog from "../../data/config/national-policies.json";
import type { NationState } from "../state/game-state";

export type SovietDebtRepaymentPlan =
  | "unset"
  | "five_year_early"
  | "moderate"
  | "ten_year";

export const SOVIET_DEBT_REPAYMENT_EVENT_ID =
  "soviet_debt_repayment_beidaihe_1960";
export const SOVIET_DEBT_AUSTERITY_POLICY_ID =
  "soviet_debt_austerity_repayment";

const maximumActivePolicies = policyCatalog.maximumActivePolicies;

const choiceToPlan: Record<string, SovietDebtRepaymentPlan> = {
  historical_path: "five_year_early",
  moderate_schedule: "moderate",
  ten_year_no_early: "ten_year",
};

export function ensureSovietDebtRepaymentState(nation: NationState): void {
  const plan = nation.trade.sovietDebtRepaymentPlan;
  if (
    plan === "unset" ||
    plan === "five_year_early" ||
    plan === "moderate" ||
    plan === "ten_year"
  ) {
    return;
  }
  nation.trade.sovietDebtRepaymentPlan = "unset";
}

/** 按还债事件选项写入偿债计划；五年史实路径同时启用勒紧裤腰带国策。 */
export function applySovietDebtRepaymentChoice(
  nation: NationState,
  choiceId: string,
): void {
  ensureSovietDebtRepaymentState(nation);
  const normalizedChoiceId = choiceId.startsWith("condition:")
    ? "historical_path"
    : choiceId.startsWith("initiative:")
      ? "historical_path"
      : choiceId;
  const plan = choiceToPlan[normalizedChoiceId];
  if (!plan) {
    throw new Error(`未知对苏还债方案：${choiceId}`);
  }
  nation.trade.sovietDebtRepaymentPlan = plan;
  if (plan === "five_year_early") {
    activateSovietDebtAusterityPolicy(nation);
  }
}

function activateSovietDebtAusterityPolicy(nation: NationState): void {
  const policy = policyCatalog.definitions.find(
    (item) => item.id === SOVIET_DEBT_AUSTERITY_POLICY_ID,
  );
  if (!policy) {
    throw new Error(`未知国策：${SOVIET_DEBT_AUSTERITY_POLICY_ID}`);
  }
  const conflicts = new Set(policy.conflictsWith);
  let next = nation.policies.filter(
    (policyId) =>
      policyId !== SOVIET_DEBT_AUSTERITY_POLICY_ID && !conflicts.has(policyId),
  );
  while (next.length >= maximumActivePolicies) {
    next = next.slice(1);
  }
  nation.policies = [...next, SOVIET_DEBT_AUSTERITY_POLICY_ID];
}

export function sovietDebtAnnualPrincipalRepaymentRate(
  plan: SovietDebtRepaymentPlan | undefined,
  year: number,
  earlyAnnualRate: number,
  baseAnnualRate: number,
  earlyRepaymentEndYear: number,
): number {
  const resolved = plan ?? "unset";
  if (resolved === "five_year_early") {
    return earlyAnnualRate;
  }
  if (resolved === "moderate") {
    return (earlyAnnualRate + baseAnnualRate) / 2;
  }
  if (resolved === "ten_year") {
    return baseAnnualRate;
  }
  return year <= earlyRepaymentEndYear ? earlyAnnualRate : baseAnnualRate;
}

/** unset/五年路径保留史实清偿加速；折中仅保留最终清偿；十年路径全部关闭。 */
export function allowsSovietDebtFormalClearance(
  plan: SovietDebtRepaymentPlan | undefined,
): boolean {
  const resolved = plan ?? "unset";
  return resolved === "unset" || resolved === "five_year_early";
}

export function allowsSovietDebtFinalClearance(
  plan: SovietDebtRepaymentPlan | undefined,
): boolean {
  const resolved = plan ?? "unset";
  return (
    resolved === "unset" ||
    resolved === "five_year_early" ||
    resolved === "moderate"
  );
}
