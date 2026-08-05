import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { applyModifiers } from "../events/modifiers";
import { annualReviewRequiresNewPlan } from "./strategic-planning";

describe("年度复盘与五年规划", () => {
  it("交互模式在年度结算后暂停并生成可解释报告", () => {
    const engine = createSimulationEngine(
      createInitialGameState(2030, 2030, "interactive"),
    );

    engine.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 12 });
    const pending = engine.getState();
    const report = pending.nation.history.reports.at(-1);

    expect(pending.nation.date).toMatchObject({ year: 2031, month: 1 });
    expect(pending.nation.strategicPlanning.pendingReviewYear).toBe(2030);
    expect(report?.highlights.length).toBeGreaterThanOrEqual(4);
    expect(report?.risks.length).toBeGreaterThan(0);
    expect(report?.causalDrivers.length).toBeGreaterThan(0);

    const elapsedMonths = pending.nation.date.elapsedMonths;
    engine.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.date.elapsedMonths).toBe(elapsedMonths);
  });

  it("年度重点产生十二个月中间变量修正", () => {
    const engine = createSimulationEngine(
      createInitialGameState(2030, 2030, "interactive"),
    );
    engine.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 12 });
    engine.dispatchHeadless({
      type: "RESOLVE_ANNUAL_REVIEW",
      annualFocusId: "technology",
    });

    const nation = engine.getState().nation;
    expect(nation.strategicPlanning.pendingReviewYear).toBeNull();
    expect(nation.strategicPlanning.annualFocusId).toBe("technology");
    expect(applyModifiers(nation, "technology.researchOutput", 1)).toBeGreaterThan(1);
    expect(applyModifiers(nation, "fiscal.spending", 1)).toBeGreaterThan(1);
  });

  it("规划到期时要求选择新一轮长期重点", () => {
    const state = createInitialGameState(2030, 2030, "interactive");
    state.nation.strategicPlanning.planEndYear = 2030;
    const engine = createSimulationEngine(state);
    engine.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 12 });

    expect(annualReviewRequiresNewPlan(engine.getState().nation)).toBe(true);
    expect(() => engine.dispatchHeadless({
      type: "RESOLVE_ANNUAL_REVIEW",
      annualFocusId: "education",
      nextPlanPriorityIds: [],
    })).toThrow("五年规划必须选择");

    engine.dispatchHeadless({
      type: "RESOLVE_ANNUAL_REVIEW",
      annualFocusId: "education",
      nextPlanPriorityIds: ["education", "technology", "fiscal_stability"],
    });
    const planning = engine.getState().nation.strategicPlanning;
    expect(planning).toMatchObject({
      planStartYear: 2031,
      planEndYear: 2035,
      annualFocusId: "education",
      pendingReviewYear: null,
    });
    expect(planning.priorityIds).toEqual([
      "education",
      "technology",
      "fiscal_stability",
    ]);
  });

  it("旧存档缺少规划字段时可确定性迁移", () => {
    const legacy = createInitialGameState(1949);
    delete (legacy.nation as Partial<typeof legacy.nation>).strategicPlanning;
    const engine = createSimulationEngine(legacy);

    expect(engine.getState().nation.strategicPlanning).toMatchObject({
      planStartYear: 1949,
      planEndYear: 1953,
      pendingReviewYear: null,
    });
  });
});
