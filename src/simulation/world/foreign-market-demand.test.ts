import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { createSimulationEngine } from "../core/engine";
import { updateInternationalTrade } from "../economy/trade";
import {
  calculateForeignExportDemandMultiplier,
  calculateForeignImportPool,
  ensureForeignMarketState,
  updateForeignMarketIndices,
} from "./foreign-market-demand";
import { simulateWorldCountries } from "./world-simulation";
import { Mulberry32 } from "../core/random";
import { getWorldCountryAnchor } from "./world-calibration";

describe("外国市场进口需求", () => {
  it("初始化外国市场状态并计算正进口吸收池", () => {
    const state = createInitialGameState(3);
    ensureForeignMarketState(state);
    const pool = calculateForeignImportPool(state);

    expect(state.world.foreignImportDemandIndex).toBe(1);
    expect(pool).toBeGreaterThan(0);
    expect(state.world.foreignImportPool).toBe(pool);
  });

  it("外国经济体增长会抬升进口需求指数并提高中国出口目标", () => {
    const state = createInitialGameState(11);
    ensureForeignMarketState(state);
    state.nation.trade.exports = 0;
    state.nation.trade.openness = 0.35;
    updateInternationalTrade(state);
    const baselineExports = state.nation.trade.exports;

    for (const country of state.world.countries) {
      country.realGDP *= 1.35;
      country.nominalGDP = country.realGDP * country.priceLevelIndex;
    }
    updateForeignMarketIndices(state);
    const boostedDemand = calculateForeignExportDemandMultiplier(state);
    for (let month = 0; month < 24; month += 1) {
      updateInternationalTrade(state);
    }

    expect(boostedDemand).toBeGreaterThan(1);
    expect(state.world.foreignImportDemandIndex).toBeGreaterThan(1);
    expect(state.nation.trade.exports).toBeGreaterThan(baselineExports);
  });

  it("制裁主要伙伴会降低可及进口池并压制出口", () => {
    const state = createInitialGameState(17);
    ensureForeignMarketState(state);
    const usa = state.world.countries.find((country) => country.id === "usa");
    expect(usa).toBeDefined();
    updateInternationalTrade(state);
    const baselineExports = state.nation.trade.exports;
    const baselinePool = calculateForeignImportPool(state);

    usa!.sanctionLevel = 0.85;
    usa!.relationWithChina = -60;
    updateForeignMarketIndices(state);
    for (let month = 0; month < 18; month += 1) {
      updateInternationalTrade(state);
    }

    expect(calculateForeignImportPool(state)).toBeLessThan(baselinePool);
    expect(state.nation.trade.exports).toBeLessThan(baselineExports);
  });

  it("世界模拟会沿历史锚点校准主要经济体规模", () => {
    const state = createInitialGameState(5);
    const random = new Mulberry32(5);
    state.nation.date.year = 1949;
    state.nation.date.month = 1;

    for (let month = 0; month < (1978 - 1949 + 1) * 12; month += 1) {
      simulateWorldCountries(state, random);
      state.nation.date.month += 1;
      if (state.nation.date.month > 12) {
        state.nation.date.month = 1;
        state.nation.date.year += 1;
      }
    }

    const japan = state.world.countries.find((country) => country.id === "japan");
    const anchor = getWorldCountryAnchor("japan", 1978);
    expect(japan).toBeDefined();
    expect(anchor).not.toBeNull();
    expect(japan!.realGDP / anchor!).toBeGreaterThan(0.55);
    expect(japan!.realGDP / anchor!).toBeLessThan(1.8);
  });

  it("史实路线推进后外国进口需求指数高于开局", () => {
    const engine = createSimulationEngine(createInitialGameState(21));
    const initialIndex = engine.getState().world.foreignImportDemandIndex;
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 240 });
    const laterIndex = engine.getState().world.foreignImportDemandIndex;

    expect(laterIndex).toBeGreaterThan(initialIndex);
    expect(engine.getState().nation.trade.exports).toBeGreaterThan(0);
  });
});
