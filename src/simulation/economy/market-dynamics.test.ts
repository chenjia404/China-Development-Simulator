import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import type { NationState } from "../state/game-state";
import { calculateSectorOutput } from "./production";
import {
  NATIONAL_ACCOUNTS_PRODUCT_IDS,
} from "./national-accounts";
import {
  ensureMarketDynamicsState,
  updateMarketDynamics,
  validateMarketDynamicsDefinitions,
} from "./market-dynamics";

describe("部门价格、工资、库存与经济周期", () => {
  it("完整结算14类产品价格、库存和宏观工资指标", () => {
    expect(validateMarketDynamicsDefinitions()).toEqual([]);
    const engine = createSimulationEngine(createInitialGameState(1949));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 24 });
    const { marketDynamics } = engine.getState().nation;

    expect(Object.keys(marketDynamics.products)).toHaveLength(14);
    expect(marketDynamics.consumerPriceIndex).toBeGreaterThan(0);
    expect(marketDynamics.producerPriceIndex).toBeGreaterThan(0);
    expect(marketDynamics.gdpDeflator).toBeGreaterThan(0);
    expect(marketDynamics.nominalWageIndex).toBeGreaterThan(0);
    expect(marketDynamics.realWageIndex).toBeGreaterThan(0);
    expect(marketDynamics.laborIncomeShare).toBeGreaterThanOrEqual(0.2);
    expect(marketDynamics.laborIncomeShare).toBeLessThanOrEqual(0.8);
    for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
      const product = marketDynamics.products[id];
      expect(Number.isFinite(product.priceIndex)).toBe(true);
      expect(product.priceIndex).toBeGreaterThan(0);
      expect(product.inventoryStock).toBeGreaterThanOrEqual(0);
      expect(product.inventoryMonths).toBeGreaterThanOrEqual(0);
    }
  });

  it("过量工业库存通过下一月产能约束压低生产", () => {
    const neutral = createInitialGameState(81);
    const excessive = structuredClone(neutral);
    for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
      if (id === "agriculture" || id === "market_services" || id === "public_services") {
        continue;
      }
      excessive.nation.marketDynamics.products[id].inventoryGapRatio = 3;
    }

    const neutralOutput = calculateSectorOutput(
      "secondary",
      neutral.nation.sectors.secondary,
      neutral.nation,
    );
    const excessiveOutput = calculateSectorOutput(
      "secondary",
      excessive.nation.sectors.secondary,
      excessive.nation,
    );
    expect(excessiveOutput).toBeLessThan(neutralOutput);
    expect(excessiveOutput).toBeGreaterThan(neutralOutput * 0.75);
  });

  it("短缺产品相对涨价且旧存档能确定性重建", () => {
    const state = createInitialGameState(8100);
    const agriculture = state.nation.marketDynamics.products.agriculture;
    const consumerGoods = state.nation.marketDynamics.products.consumer_goods;
    agriculture.inventoryStock = 0;
    consumerGoods.inventoryStock = consumerGoods.targetInventoryStock * 3;
    updateMarketDynamics(state.nation);
    expect(
      state.nation.marketDynamics.products.agriculture.annualPriceInflation,
    ).toBeGreaterThan(
      state.nation.marketDynamics.products.consumer_goods.annualPriceInflation,
    );

    const legacy = createInitialGameState(8101);
    delete (legacy.nation as Partial<NationState>).marketDynamics;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureMarketDynamicsState(first.nation);
    ensureMarketDynamicsState(second.nation);
    expect(first.nation.marketDynamics).toEqual(second.nation.marketDynamics);
    expect(first.nation.marketDynamics.products.agriculture.inventoryStock).toBeGreaterThan(0);
  });
});
