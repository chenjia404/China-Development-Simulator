import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { calculateGDP } from "./gdp";
import {
  calculateBaseOutput,
  calculateIndustryOutputs,
  calculateSectorOutput,
} from "./production";

describe("产业生产和 GDP", () => {
  it("资本和劳动力增加会提高产出且资本边际收益递减", () => {
    const base = {
      productivity: 1,
      capital: 100,
      labor: 100,
      humanCapital: 10,
      capitalElasticity: 0.35,
      laborElasticity: 0.55,
      humanCapitalElasticity: 0.1,
    };
    const first = calculateBaseOutput(base);
    const doubled = calculateBaseOutput({ ...base, capital: 200 });
    const tripled = calculateBaseOutput({ ...base, capital: 300 });

    expect(doubled).toBeGreaterThan(first);
    expect(tripled).toBeGreaterThan(doubled);
    expect(doubled - first).toBeGreaterThan(tripled - doubled);
    expect(calculateBaseOutput({ ...base, labor: 120 })).toBeGreaterThan(first);
  });

  it("能源严重不足会压低工业产出", () => {
    const state = createInitialGameState(1);
    state.nation.resources.energySupplyRatio = 1;
    const normal = calculateSectorOutput(
      "secondary",
      state.nation.sectors.secondary,
      state.nation,
    );
    state.nation.resources.energySupplyRatio = 0.3;
    const shortage = calculateSectorOutput(
      "secondary",
      state.nation.sectors.secondary,
      state.nation,
    );

    expect(shortage).toBeLessThan(normal);
  });

  it("基础设施改善会提高服务业产出", () => {
    const state = createInitialGameState(1);
    state.nation.economy.infrastructureIndex = 5;
    const weak = calculateSectorOutput(
      "tertiary",
      state.nation.sectors.tertiary,
      state.nation,
    );
    state.nation.economy.infrastructureIndex = 80;
    const strong = calculateSectorOutput(
      "tertiary",
      state.nation.sectors.tertiary,
      state.nation,
    );

    expect(strong).toBeGreaterThan(weak);
  });

  it("实际 GDP 等于全部产业增加值之和", () => {
    const state = createInitialGameState(1);
    calculateIndustryOutputs(state.nation);
    calculateGDP(state.nation);
    const sectorTotal = Object.values(state.nation.sectors).reduce(
      (sum, sector) => sum + sector.valueAdded,
      0,
    );

    expect(state.nation.economy.realGDP).toBeCloseTo(sectorTotal, 6);
    expect(state.nation.economy.realGDPPerCapita).toBeGreaterThan(0);
  });

  it("连续运行十年不会出现非有限或负 GDP", () => {
    const engine = createSimulationEngine(createInitialGameState(2026));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 120 });
    const { economy, sectors } = engine.getState().nation;

    expect(Number.isFinite(economy.realGDP)).toBe(true);
    expect(economy.realGDP).toBeGreaterThan(0);
    for (const sector of Object.values(sectors)) {
      expect(Number.isFinite(sector.output)).toBe(true);
      expect(sector.output).toBeGreaterThanOrEqual(0);
    }
  });
});
