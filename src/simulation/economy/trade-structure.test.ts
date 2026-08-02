import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { updateWorldTradeNetwork } from "./international-network";
import {
  calculateTradeBarrierExportMultiplier,
  INDUSTRIAL_CATEGORY_IDS,
  updateTradeStructure,
} from "./trade-structure";
import { allocateIndustrialExports } from "./industrial-structure";

describe("贸易结构深化", () => {
  it("品类出口按伙伴分解后分别守恒", () => {
    const state = createInitialGameState(9301);
    state.nation.trade.exports = 120_000_000_000;
    allocateIndustrialExports(state.nation);
    updateWorldTradeNetwork(state);
    const network = state.world.tradeNetwork;
    for (const categoryId of INDUSTRIAL_CATEGORY_IDS) {
      const allocated = Object.values(
        network.categoryPartnerExports.industrial[categoryId] ?? {},
      ).reduce((sum, value) => sum + value, 0);
      const expected = state.nation.industries[categoryId].exportValue;
      expect(Math.abs(allocated - expected) / Math.max(1, expected)).toBeLessThan(1e-8);
    }
    const otherAllocated = Object.values(network.categoryPartnerExports.other)
      .reduce((sum, value) => sum + value, 0);
    const industrialTotal = INDUSTRIAL_CATEGORY_IDS.reduce(
      (sum, id) => sum + state.nation.industries[id].exportValue,
      0,
    );
    expect(
      Math.abs(otherAllocated - (state.nation.trade.exports - industrialTotal)) /
        Math.max(1, state.nation.trade.exports),
    ).toBeLessThan(1e-8);
    for (const country of state.world.countries) {
      const partnerTotal = network.partners[country.id]?.exports ?? 0;
      const categoryTotal = [
        ...INDUSTRIAL_CATEGORY_IDS.map(
          (id) => network.categoryPartnerExports.industrial[id]?.[country.id] ?? 0,
        ),
        network.categoryPartnerExports.other[country.id] ?? 0,
      ].reduce((sum, value) => sum + value, 0);
      expect(Math.abs(categoryTotal - partnerTotal) / Math.max(1, partnerTotal))
        .toBeLessThan(1e-8);
    }
  });

  it("制裁提高贸易壁垒暴露并削弱出口竞争力倍率", () => {
    const baseline = createInitialGameState(9302);
    baseline.nation.trade.exports = 180_000_000_000;
    allocateIndustrialExports(baseline.nation);
    updateWorldTradeNetwork(baseline);
    const sanctioned = structuredClone(baseline);
    const usa = sanctioned.world.countries.find((item) => item.id === "usa");
    if (!usa) throw new Error("美国伙伴不存在");
    usa.sanctionLevel = 0.95;
    usa.relationWithChina = -70;
    updateTradeStructure(sanctioned);
    updateTradeStructure(baseline);
    expect(sanctioned.world.tradeNetwork.tradeBarrierExposure)
      .toBeGreaterThan(baseline.world.tradeNetwork.tradeBarrierExposure);
    expect(calculateTradeBarrierExportMultiplier(sanctioned))
      .toBeLessThan(calculateTradeBarrierExportMultiplier(baseline));
  });

  it("高技术品类制裁暴露高于资源品", () => {
    const state = createInitialGameState(9303);
    state.nation.trade.exports = 200_000_000_000;
    allocateIndustrialExports(state.nation);
    const usa = state.world.countries.find((item) => item.id === "usa");
    if (!usa) throw new Error("美国伙伴不存在");
    usa.sanctionLevel = 0.8;
    updateWorldTradeNetwork(state);
    const electronics = Object.values(
      state.world.tradeNetwork.categoryPartnerExports.industrial
        .electronics_communications ?? {},
    ).reduce((sum, value) => sum + value, 0);
    const mining = Object.values(
      state.world.tradeNetwork.categoryPartnerExports.industrial.mining_energy ?? {},
    ).reduce((sum, value) => sum + value, 0);
    expect(electronics).toBeGreaterThan(mining);
  });
});
