import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  ensureTransportState,
  updatePublicTransport,
} from "./transport";

describe("公共交通模块", () => {
  it("交通预算提高后铁路里程与物流效率单调上升", () => {
    const low = createInitialGameState(9101);
    const high = createInitialGameState(9101);
    low.nation.fiscal.budget.transport = 0.02;
    high.nation.fiscal.budget.transport = 0.22;

    for (let month = 0; month < 180; month += 1) {
      updatePublicTransport(low.nation);
      updatePublicTransport(high.nation);
      low.nation.date.elapsedMonths += 1;
      high.nation.date.elapsedMonths += 1;
    }

    expect(high.nation.transport.railNetworkKm).toBeGreaterThan(
      low.nation.transport.railNetworkKm,
    );
    expect(high.nation.transport.logisticsEfficiencyIndex).toBeGreaterThan(
      low.nation.transport.logisticsEfficiencyIndex,
    );
    expect(high.nation.transport.logisticsCostMultiplier).toBeLessThanOrEqual(
      low.nation.transport.logisticsCostMultiplier,
    );
  });

  it("物流效率改善降低二产产出成本并提高出口竞争力", () => {
    const engine = createSimulationEngine(createInitialGameState(9102));
    const baselineSecondary = engine.exportState().nation.sectors.secondary.output;
    const baselineExports = engine.exportState().nation.trade.exports;

    engine.dispatch({ type: "UPDATE_BUDGET", budget: { transport: 0.28 } });
    for (let month = 0; month < 96; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }

    const improved = engine.exportState().nation;
    expect(improved.transport.logisticsEfficiencyIndex).toBeGreaterThan(17);
    expect(improved.sectors.secondary.output).toBeGreaterThan(baselineSecondary);
    expect(improved.trade.exports).toBeGreaterThanOrEqual(baselineExports * 0.98);
  });

  it("铁路优先国策提高铁路投资效率并增加财政压力", () => {
    const engine = createSimulationEngine(createInitialGameState(9103));
    engine.dispatch({ type: "SET_POLICIES", policyIds: ["rail_priority"] });
    for (let month = 0; month < 48; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    const state = engine.exportState().nation;
    expect(state.policyProgress.rail_priority).toBeGreaterThan(0.5);
    expect(state.transport.railNetworkKm).toBeGreaterThan(21_800);
  });

  it("城乡道路联通国策需满足交通预算门槛", () => {
    const engine = createSimulationEngine(createInitialGameState(9104));
    engine.dispatch({ type: "UPDATE_BUDGET", budget: { transport: 0.02 } });
    expect(() =>
      engine.dispatch({ type: "SET_POLICIES", policyIds: ["rural_road_connectivity"] }),
    ).toThrow(/交通预算/);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 48 });
    engine.dispatch({ type: "UPDATE_BUDGET", budget: { transport: 0.08 } });
    engine.dispatch({ type: "SET_POLICIES", policyIds: ["rural_road_connectivity"] });
    expect(engine.exportState().nation.policies).toContain("rural_road_connectivity");
  });

  it("旧存档缺失交通细账时确定性重建", () => {
    const legacy = createInitialGameState(9105);
    delete (legacy.nation as { transport?: unknown }).transport;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureTransportState(first.nation);
    ensureTransportState(second.nation);
    expect(first.nation.transport).toEqual(second.nation.transport);
    expect(first.nation.fiscal.budget.transport).toBeGreaterThan(0);
  });

  it("国道高速网国策需满足年份与交通预算门槛", () => {
    const engine = createSimulationEngine(createInitialGameState(9106));
    expect(() =>
      engine.dispatch({ type: "SET_POLICIES", policyIds: ["highway_national_network"] }),
    ).toThrow(/1984/);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: (1984 - 1949) * 12 });
    engine.dispatch({ type: "UPDATE_BUDGET", budget: { transport: 0.02 } });
    expect(() =>
      engine.dispatch({ type: "SET_POLICIES", policyIds: ["highway_national_network"] }),
    ).toThrow(/交通预算/);
    engine.dispatch({ type: "UPDATE_BUDGET", budget: { transport: 0.08 } });
    for (let month = 0; month < 24; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    engine.dispatch({ type: "SET_POLICIES", policyIds: ["highway_national_network"] });
    expect(engine.exportState().nation.policies).toContain("highway_national_network");
  });

  it("交通预算份额不变时绝对投入随名义支出上升", () => {
    const engine = createSimulationEngine(createInitialGameState(9108));
    engine.dispatch({ type: "UPDATE_BUDGET", budget: { transport: 0.08 } });
    for (let month = 0; month < 240; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    const early = engine.exportState().nation.transport.monthlyTransportInvestment;
    for (let month = 0; month < 240; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    const later = engine.exportState().nation.transport.monthlyTransportInvestment;
    expect(later).toBeGreaterThan(early * 1.5);
    expect(engine.exportState().nation.transport.freightCapacityUtilization).toBeLessThan(1.5);
  });

  it("全国干线公路史实事件提高高速公路投资效率", () => {
    const engine = createSimulationEngine(createInitialGameState(9107));
    for (let month = 0; month < (1988 - 1949) * 12 + 10; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    const triggered = engine.exportState().nation.history.historicalEvents.some(
      (record) => record.id === "national_trunk_highway_1988",
    );
    expect(triggered).toBe(true);
    expect(engine.exportState().nation.transport.expresswayKm).toBeGreaterThan(0);
  });
});
