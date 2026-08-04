import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  getHistoricalReferenceBudget,
} from "./historical-budget";

describe("史实参考预算", () => {
  it("各历史阶段返回与校准策略一致的预算结构", () => {
    expect(getHistoricalReferenceBudget(1950).industry).toBe(0.19);
    expect(getHistoricalReferenceBudget(1950).transport).toBe(0);
    expect(getHistoricalReferenceBudget(1965).industry).toBe(0.27);
    expect(getHistoricalReferenceBudget(1995).infrastructure).toBe(0.2);
    expect(getHistoricalReferenceBudget(2020).education).toBe(0.17);
  });

  it("未手动调整时每年 1 月自动对齐史实参考预算", () => {
    const engine = createSimulationEngine(
      createInitialGameState(9201, 1949, "automatic"),
    );
    expect(engine.exportState().nation.fiscal.budget.industry).toBe(0.19);

    for (let month = 0; month < (1957 - 1949) * 12; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    expect(engine.exportState().nation.fiscal.budget.industry).toBe(0.27);
    expect(engine.exportState().nation.fiscal.budget.transport).toBe(0);
  });

  it("手动调整预算后停止自动对齐", () => {
    const engine = createSimulationEngine(
      createInitialGameState(9202, 1949, "interactive"),
    );
    engine.dispatch({ type: "UPDATE_BUDGET", budget: { industry: 0.42 } });
    for (let month = 0; month < (1957 - 1949) * 12; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    expect(engine.exportState().nation.fiscal.budget.industry).toBe(0.42);
  });

  it("默认预算在各历史阶段与参考配置一致", () => {
    const engine = createSimulationEngine(
      createInitialGameState(9203, 1949, "automatic"),
    );
    const checkpoints = [
      { year: 1950, industry: 0.19 },
      { year: 1965, industry: 0.27 },
      { year: 1995, industry: 0.22 },
      { year: 2020, education: 0.17 },
    ];
    for (const checkpoint of checkpoints) {
      while (engine.exportState().nation.date.year < checkpoint.year) {
        engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
      }
      const budget = engine.exportState().nation.fiscal.budget;
      if (checkpoint.industry !== undefined) {
        expect(budget.industry).toBe(checkpoint.industry);
      }
      if (checkpoint.education !== undefined) {
        expect(budget.education).toBe(checkpoint.education);
      }
      expect(budget.transport).toBe(0);
      expect(engine.exportState().nation.budgetManuallyAdjusted).toBe(false);
    }
  }, 20_000);
});
