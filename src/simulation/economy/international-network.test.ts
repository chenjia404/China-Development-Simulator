import { describe, expect, it } from "vitest";
import type { WorldState } from "../state/world-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ensureWorldTradeNetworkState,
  updateWorldTradeNetwork,
} from "./international-network";

describe("世界贸易与国际金融网络", () => {
  it("伙伴账户守恒分配贸易、外资和外债总量", () => {
    const state = createInitialGameState(9101);
    updateWorldTradeNetwork(state);
    const accounts = Object.values(state.world.tradeNetwork.partners);
    expect(accounts.reduce((sum, item) => sum + item.exports, 0)).toBeCloseTo(state.nation.trade.exports, 2);
    expect(accounts.reduce((sum, item) => sum + item.imports, 0)).toBeCloseTo(state.nation.trade.imports, 2);
    expect(accounts.reduce((sum, item) => sum + item.foreignDirectInvestment, 0)).toBeCloseTo(state.nation.trade.foreignInvestment, 2);
    expect(accounts.reduce((sum, item) => sum + item.externalDebtClaims, 0)).toBeCloseTo(state.nation.trade.externalDebt, 2);
  });

  it("贸易协定提高伙伴份额，制裁降低伙伴份额并提高风险", () => {
    const agreement = createInitialGameState(9102);
    const sanctioned = structuredClone(agreement);
    const agreementUS = agreement.world.countries.find((item) => item.id === "usa");
    const sanctionedUS = sanctioned.world.countries.find((item) => item.id === "usa");
    if (!agreementUS || !sanctionedUS) throw new Error("美国伙伴不存在");
    agreementUS.tradeAgreement = true;
    agreementUS.relationWithChina = 80;
    sanctionedUS.sanctionLevel = 0.9;
    sanctionedUS.relationWithChina = -80;
    updateWorldTradeNetwork(agreement);
    updateWorldTradeNetwork(sanctioned);
    expect(agreement.world.tradeNetwork.partners.usa.exports)
      .toBeGreaterThan(sanctioned.world.tradeNetwork.partners.usa.exports);
    expect(agreement.world.tradeNetwork.partners.usa.shippingRiskIndex)
      .toBeLessThan(sanctioned.world.tradeNetwork.partners.usa.shippingRiskIndex);
  });

  it("旧存档缺失贸易网络时确定性重建", () => {
    const legacy = createInitialGameState(9103);
    delete (legacy.world as Partial<WorldState>).tradeNetwork;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureWorldTradeNetworkState(first);
    ensureWorldTradeNetworkState(second);
    expect(first.world.tradeNetwork).toEqual(second.world.tradeNetwork);
  });
});
