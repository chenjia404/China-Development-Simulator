import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ensureAgricultureSystemState,
  updateAgricultureSystem,
} from "./agriculture-rural";

describe("农业农村与粮食安全", () => {
  it("粮食生产、进出口和库存形成守恒实物账户", () => {
    const state = createInitialGameState(8601);
    for (let month = 0; month < 24; month += 1) updateAgricultureSystem(state.nation);
    const agriculture = state.nation.resources.agriculture;
    expect(agriculture.cultivatedLandHectares).toBeGreaterThan(90_000_000);
    expect(agriculture.grainYieldKgPerHectare).toBeGreaterThan(0);
    expect(agriculture.strategicReserveStock).toBeGreaterThanOrEqual(0);
    expect(agriculture.massBalanceError).toBeLessThan(0.001);
    expect(agriculture.foodSecurityCoverage).toBeGreaterThan(0);
  });

  it("开放进口与战略储备会缓解短缺但消耗库存", () => {
    const closed = createInitialGameState(8602);
    const supported = structuredClone(closed);
    closed.nation.resources.foodProduction = 60_000_000;
    supported.nation.resources.foodProduction = 60_000_000;
    closed.nation.trade.openness = 0;
    supported.nation.trade.openness = 1;
    supported.nation.resources.agriculture.strategicReserveStock = 30_000_000;
    const openingReserve = supported.nation.resources.agriculture.strategicReserveStock;
    updateAgricultureSystem(closed.nation);
    updateAgricultureSystem(supported.nation);
    expect(supported.nation.resources.agriculture.foodImports)
      .toBeGreaterThan(closed.nation.resources.agriculture.foodImports);
    expect(supported.nation.resources.agriculture.foodSecurityCoverage)
      .toBeGreaterThan(closed.nation.resources.agriculture.foodSecurityCoverage);
    expect(supported.nation.resources.agriculture.strategicReserveStock)
      .toBeLessThan(openingReserve);
  });

  it("农业科技降低损耗并提高机械化", () => {
    const baseline = createInitialGameState(8603);
    const modern = structuredClone(baseline);
    modern.nation.technology.completedTechnologyIds.push(
      "mechanized_agriculture",
      "modern_agronomy",
    );
    modern.nation.economy.infrastructureIndex = 90;
    for (let month = 0; month < 120; month += 1) {
      updateAgricultureSystem(baseline.nation);
      updateAgricultureSystem(modern.nation);
    }
    expect(modern.nation.resources.agriculture.mechanizationRate)
      .toBeGreaterThan(baseline.nation.resources.agriculture.mechanizationRate);
    expect(modern.nation.resources.agriculture.postHarvestLoss)
      .toBeLessThan(baseline.nation.resources.agriculture.postHarvestLoss);
  });

  it("旧存档缺失农业细账时可确定性重建", () => {
    const legacy = createInitialGameState(8604);
    delete (legacy.nation.resources as Partial<NationState["resources"]>).agriculture;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureAgricultureSystemState(first.nation);
    ensureAgricultureSystemState(second.nation);
    expect(first.nation.resources.agriculture).toEqual(second.nation.resources.agriculture);
  });
});
