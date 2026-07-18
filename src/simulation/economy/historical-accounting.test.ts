import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  calculateCurrentPriceGDPPerCapita,
  calculateWorldComparableGDP,
} from "./historical-accounting";

describe("历史经济统计口径", () => {
  it("三个关键年份可折算为国家统计局当年价人均 GDP", () => {
    expect(calculateCurrentPriceGDPPerCapita(538.2627222468241, 1978))
      .toBeCloseTo(381, 6);
    expect(calculateCurrentPriceGDPPerCapita(1472.4058582406724, 1990))
      .toBeCloseTo(1644, 6);
    expect(calculateCurrentPriceGDPPerCapita(4038.042111736811, 2000))
      .toBeCloseTo(7858, 6);
  });

  it("国际比较折算保持不同发展路线之间的 GDP 比例", () => {
    const baseline = calculateWorldComparableGDP(1_000, 2, 1990);
    const fasterRoute = calculateWorldComparableGDP(1_300, 2, 1990);

    expect(fasterRoute / baseline).toBeCloseTo(1.3, 12);
  });

  it("旧存档缺少新统计字段时能够确定性迁移", () => {
    const state = createInitialGameState(1949);
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    const oldState = engine.exportState();
    delete (
      oldState.nation.economy as Partial<typeof oldState.nation.economy>
    ).currentPriceGDPPerCapita;
    delete (
      oldState.nation.economy as Partial<typeof oldState.nation.economy>
    ).internationalComparableGDP;
    delete (
      oldState.nation.history.annual[0] as Partial<
        typeof oldState.nation.history.annual[0]
      >
    ).currentPriceGDPPerCapita;

    const restored = createSimulationEngine(oldState).getState();
    expect(restored.nation.economy.currentPriceGDPPerCapita).toBeGreaterThan(0);
    expect(restored.nation.economy.internationalComparableGDP).toBeGreaterThan(0);
    expect(
      restored.nation.history.annual[0].currentPriceGDPPerCapita,
    ).toBeGreaterThan(0);
  });
});
