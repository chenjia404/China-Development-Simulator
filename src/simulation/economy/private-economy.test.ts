import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  calculatePrivateEconomyMultipliers,
  ensurePrivateEconomyState,
} from "./private-economy";
import {
  calculateIndustrialStructureMetrics,
  updateIndustrialStructure,
} from "./industrial-structure";

describe("民营与混合所有制经济", () => {
  it("开局能力是中性传导基准", () => {
    const nation = createInitialGameState(1949).nation;
    const multipliers = calculatePrivateEconomyMultipliers(nation);

    expect(multipliers.investment).toBeCloseTo(1, 10);
    expect(multipliers.researchCommercialization).toBeCloseTo(1, 10);
    expect(multipliers.technologyDiffusion).toBeCloseTo(1, 10);
    expect(multipliers.exports).toBeCloseTo(1, 10);
    expect(multipliers.industrialDynamismRatio).toBeCloseTo(1, 10);
  });

  it("全行业公私合营史实路线比保留混合所有制更损害长期能力", () => {
    const runChoice = (choiceId: string) => {
      const state = createInitialGameState(1956, 1956, "interactive");
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "industry_wide_joint_ownership_1956",
        choiceId,
      });
      engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 36 });
      return engine.getState().nation;
    };

    const historical = runChoice("historical_path");
    const mixed = runChoice("preserve_mixed_ownership");
    expect(historical.privateEconomy.operatingSpace).toBeLessThan(0.12);
    expect(historical.privateEconomy.entrepreneurialCapacity).toBeLessThan(
      mixed.privateEconomy.entrepreneurialCapacity,
    );
    expect(historical.privateEconomy.technologyCommercialization).toBeLessThan(
      mixed.privateEconomy.technologyCommercialization,
    );
    expect(historical.privateEconomy.exportNetworkStrength).toBeLessThan(
      mixed.privateEconomy.exportNetworkStrength,
    );
    expect(calculatePrivateEconomyMultipliers(historical).investment).toBeLessThan(
      calculatePrivateEconomyMultipliers(mixed).investment,
    );
    expect(historical.industries.consumer_goods.productivityIndex).toBeLessThan(
      mixed.industries.consumer_goods.productivityIndex,
    );
    expect(historical.trade.exports).toBeLessThan(mixed.trade.exports);
  });

  it("改革开放后按月重建经营、技术和出口能力，而非瞬时覆盖历史基数", () => {
    const state = createInitialGameState(1978, 1978);
    state.nation.date.month = 12;
    state.nation.privateEconomy = {
      operatingSpace: 0.06,
      entrepreneurialCapacity: 0.24,
      technologyCommercialization: 0.14,
      exportNetworkStrength: 0.08,
    };
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    const firstMonth = structuredClone(engine.getState().nation.privateEconomy);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 71 });
    const recovered = engine.getState().nation.privateEconomy;

    expect(firstMonth.operatingSpace).toBeGreaterThan(0.06);
    expect(firstMonth.operatingSpace).toBeLessThan(0.07);
    expect(recovered.operatingSpace).toBeGreaterThan(0.35);
    expect(recovered.entrepreneurialCapacity).toBeGreaterThan(0.45);
    expect(recovered.technologyCommercialization).toBeGreaterThan(0.3);
    expect(recovered.exportNetworkStrength).toBeGreaterThan(0.2);
  });

  it("经营空间主要改善消费品和装备工业，而不是平均抬高全部类别", () => {
    const constrained = createInitialGameState(1949).nation;
    const active = structuredClone(constrained);
    constrained.privateEconomy = {
      operatingSpace: 0.05,
      entrepreneurialCapacity: 0.18,
      technologyCommercialization: 0.12,
      exportNetworkStrength: 0.06,
    };
    active.privateEconomy = {
      operatingSpace: 0.9,
      entrepreneurialCapacity: 0.85,
      technologyCommercialization: 0.78,
      exportNetworkStrength: 0.8,
    };
    for (let month = 0; month < 120; month += 1) {
      updateIndustrialStructure(constrained);
      updateIndustrialStructure(active);
    }

    const constrainedMetrics = calculateIndustrialStructureMetrics(constrained);
    const activeMetrics = calculateIndustrialStructureMetrics(active);
    expect(active.industries.consumer_goods.outputShare).toBeGreaterThan(
      constrained.industries.consumer_goods.outputShare,
    );
    expect(active.industries.general_machinery.productivityIndex).toBeGreaterThan(
      constrained.industries.general_machinery.productivityIndex,
    );
    expect(activeMetrics.exportCapability).toBeGreaterThan(
      constrainedMetrics.exportCapability,
    );
    expect(
      active.industries.mining_energy.outputShare -
        constrained.industries.mining_energy.outputShare,
    ).toBeLessThan(
      active.industries.consumer_goods.outputShare -
        constrained.industries.consumer_goods.outputShare,
    );
  });

  it("旧存档缺少民营经济状态时按固定基准迁移", () => {
    const nation = createInitialGameState(1949).nation;
    delete (nation as Partial<typeof nation>).privateEconomy;
    ensurePrivateEconomyState(nation);

    expect(nation.privateEconomy).toEqual({
      operatingSpace: 0.62,
      entrepreneurialCapacity: 0.58,
      technologyCommercialization: 0.38,
      exportNetworkStrength: 0.32,
    });
  });
});
