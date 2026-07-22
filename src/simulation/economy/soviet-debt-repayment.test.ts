import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import {
  allowsSovietDebtFinalClearance,
  allowsSovietDebtFormalClearance,
  applySovietDebtRepaymentChoice,
  ensureSovietDebtRepaymentState,
  sovietDebtAnnualPrincipalRepaymentRate,
} from "./soviet-debt-repayment";

describe("对苏还债计划", () => {
  it("旧存档缺字段时补齐为 unset，并保持校准提前还债年率", () => {
    const state = createInitialGameState(1949);
    delete (state.nation.trade as { sovietDebtRepaymentPlan?: string })
      .sovietDebtRepaymentPlan;
    ensureSovietDebtRepaymentState(state.nation);
    expect(state.nation.trade.sovietDebtRepaymentPlan).toBe("unset");
    expect(
      sovietDebtAnnualPrincipalRepaymentRate("unset", 1963, 0.11, 0.055, 1965),
    ).toBe(0.11);
    expect(
      sovietDebtAnnualPrincipalRepaymentRate("unset", 1966, 0.11, 0.055, 1965),
    ).toBe(0.055);
  });

  it("三选一分别改变本金率与史实清偿加速门槛", () => {
    expect(
      sovietDebtAnnualPrincipalRepaymentRate(
        "five_year_early",
        1963,
        0.11,
        0.055,
        1965,
      ),
    ).toBe(0.11);
    expect(
      sovietDebtAnnualPrincipalRepaymentRate(
        "moderate",
        1963,
        0.11,
        0.055,
        1965,
      ),
    ).toBeCloseTo(0.0825, 8);
    expect(
      sovietDebtAnnualPrincipalRepaymentRate(
        "ten_year",
        1963,
        0.11,
        0.055,
        1965,
      ),
    ).toBe(0.055);

    expect(allowsSovietDebtFormalClearance("unset")).toBe(true);
    expect(allowsSovietDebtFormalClearance("five_year_early")).toBe(true);
    expect(allowsSovietDebtFormalClearance("moderate")).toBe(false);
    expect(allowsSovietDebtFormalClearance("ten_year")).toBe(false);

    expect(allowsSovietDebtFinalClearance("moderate")).toBe(true);
    expect(allowsSovietDebtFinalClearance("ten_year")).toBe(false);
  });

  it("五年史实路径会启用勒紧裤腰带还债国策", () => {
    const state = createInitialGameState(1960);
    state.nation.policies = [
      "agriculture_priority",
      "education_priority",
      "technology_priority",
      "consumption_stimulus",
      "livelihood_priority",
    ];
    applySovietDebtRepaymentChoice(state.nation, "historical_path");
    expect(state.nation.trade.sovietDebtRepaymentPlan).toBe("five_year_early");
    expect(state.nation.policies).toContain("soviet_debt_austerity_repayment");
    expect(state.nation.policies).not.toContain("consumption_stimulus");
    expect(state.nation.policies.length).toBeLessThanOrEqual(5);
  });
});
