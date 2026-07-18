import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ECONOMIC_REGION_IDS,
  ensureRegionalEconomyState,
  updateRegionalEconomy,
} from "./regional-economy";

describe("区域经济与跨区域流动", () => {
  it("六大区域完整分配全国人口、GDP、就业、投资和出口", () => {
    const state = createInitialGameState(9001);
    updateRegionalEconomy(state.nation);
    const regional = state.nation.regionalEconomy;
    const sum = (key: "population" | "realGDP" | "employment" | "investment" | "exports") =>
      ECONOMIC_REGION_IDS.reduce((total, id) => total + regional.regions[id][key], 0);
    expect(sum("population")).toBeCloseTo(state.nation.population.total, 2);
    expect(sum("realGDP")).toBeCloseTo(state.nation.economy.realGDP, 2);
    expect(sum("employment")).toBeCloseTo(state.nation.labor.employed, 2);
    expect(sum("investment")).toBeCloseTo(state.nation.economy.investment, 2);
    expect(sum("exports")).toBeCloseTo(state.nation.trade.exports, 2);
  });

  it("跨区人口、资本与财政净流动分别归零", () => {
    const state = createInitialGameState(9002);
    updateRegionalEconomy(state.nation);
    const regions = state.nation.regionalEconomy.regions;
    for (const key of ["netInterregionalMigration", "netCapitalFlow", "netFiscalTransfer"] as const) {
      const total = ECONOMIC_REGION_IDS.reduce((sum, id) => sum + regions[id][key], 0);
      expect(Math.abs(total)).toBeLessThan(0.01);
    }
    expect(state.nation.regionalEconomy.regionalGDPPerCapitaRatio).toBeGreaterThan(1);
  });

  it("旧存档缺失区域账户时确定性重建", () => {
    const legacy = createInitialGameState(9003);
    delete (legacy.nation as Partial<NationState>).regionalEconomy;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureRegionalEconomyState(first.nation);
    ensureRegionalEconomyState(second.nation);
    expect(first.nation.regionalEconomy).toEqual(second.nation.regionalEconomy);
  });
});
