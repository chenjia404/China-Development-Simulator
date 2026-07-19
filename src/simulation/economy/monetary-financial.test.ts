import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ensureFinancialSystemState,
  updateFinancialSystem,
  validateFinancialConfiguration,
} from "./monetary-financial";

describe("货币银行与国际收支", () => {
  it("货币和银行资产负债表保持守恒", () => {
    const state = createInitialGameState(8501);
    for (let month = 0; month < 36; month += 1) updateFinancialSystem(state);
    const { monetary, banking } = state.nation.financialSystem;
    expect(validateFinancialConfiguration()).toEqual([]);
    expect(monetary.broadMoney).toBeGreaterThan(monetary.monetaryBase);
    expect(monetary.deposits + monetary.currencyInCirculation).toBeCloseTo(
      monetary.broadMoney,
      4,
    );
    expect(banking.totalLoans).toBeGreaterThan(0);
    expect(banking.balanceSheetError / banking.totalAssets).toBeLessThan(1e-12);
    expect(banking.nonPerformingLoanRatio).toBeGreaterThan(0);
  });

  it("经济下行和低制度效率提高不良贷款但不直接修改GDP", () => {
    const healthy = createInitialGameState(8502);
    const stressed = structuredClone(healthy);
    stressed.nation.economy.institutionalEfficiency = 0.05;
    stressed.nation.economy.annualRealGDPGrowth = -0.12;
    stressed.nation.labor.unemploymentRate = 0.25;
    const gdpBefore = stressed.nation.economy.realGDP;
    updateFinancialSystem(healthy);
    updateFinancialSystem(stressed);
    expect(stressed.nation.financialSystem.banking.nonPerformingLoanRatio)
      .toBeGreaterThan(healthy.nation.financialSystem.banking.nonPerformingLoanRatio);
    expect(stressed.nation.economy.realGDP).toBe(gdpBefore);
  });

  it("国际收支由误差遗漏项与储备变动严格闭合", () => {
    const state = createInitialGameState(8503);
    state.nation.trade.monthlyReserveChange = 12_345_678;
    updateFinancialSystem(state);
    const bop = state.nation.financialSystem.balanceOfPayments;
    expect(bop.reserveAssetChange).toBe(12_345_678 * 12);
    expect(bop.identityError).toBeLessThan(0.001);
  });

  it("证券交易所通过直接融资提高社会融资和创新能力但不重复创造GDP", () => {
    const baseline = createInitialGameState(8505);
    const exchange = structuredClone(baseline);
    exchange.nation.policyProgress.securities_exchange = 1;
    exchange.nation.economy.institutionalEfficiency = 0.72;
    exchange.nation.institutions.legalPredictability = 0.7;
    exchange.nation.institutions.stateCapacity = 0.68;
    const gdpBefore = exchange.nation.economy.realGDP;
    for (let month = 0; month < 120; month += 1) {
      updateFinancialSystem(baseline);
      updateFinancialSystem(exchange);
    }
    const baselineMarket = baseline.nation.financialSystem.capitalMarket;
    const exchangeMarket = exchange.nation.financialSystem.capitalMarket;
    expect(baselineMarket.equityMarketDepth).toBe(0);
    expect(exchangeMarket.exchangeOperationalCapacity).toBeGreaterThan(0.5);
    expect(exchangeMarket.equityMarketDepth).toBeGreaterThan(0.2);
    expect(exchangeMarket.annualEquityFinancing).toBeGreaterThan(0);
    expect(exchangeMarket.socialFinancingCapacity)
      .toBeGreaterThan(baselineMarket.socialFinancingCapacity);
    expect(exchangeMarket.innovationFinancingShare).toBeGreaterThan(0);
    expect(exchange.nation.economy.realGDP).toBe(gdpBefore);
  });

  it("投资者保护不足会降低股权融资并提高市场波动", () => {
    const protectedMarket = createInitialGameState(8506);
    const weakProtection = structuredClone(protectedMarket);
    for (const state of [protectedMarket, weakProtection]) {
      state.nation.policyProgress.securities_exchange = 1;
    }
    protectedMarket.nation.economy.institutionalEfficiency = 0.8;
    protectedMarket.nation.institutions.legalPredictability = 0.85;
    protectedMarket.nation.institutions.stateCapacity = 0.8;
    weakProtection.nation.economy.institutionalEfficiency = 0.28;
    weakProtection.nation.institutions.legalPredictability = 0.15;
    weakProtection.nation.institutions.stateCapacity = 0.3;
    for (let month = 0; month < 120; month += 1) {
      updateFinancialSystem(protectedMarket);
      updateFinancialSystem(weakProtection);
    }
    const strong = protectedMarket.nation.financialSystem.capitalMarket;
    const weak = weakProtection.nation.financialSystem.capitalMarket;
    expect(strong.investorProtectionIndex).toBeGreaterThan(
      weak.investorProtectionIndex,
    );
    expect(strong.marketVolatilityIndex).toBeLessThan(weak.marketVolatilityIndex);
    expect(strong.annualEquityFinancing).toBeGreaterThan(
      weak.annualEquityFinancing,
    );
  });

  it("旧存档缺失金融账户时可确定性重建", () => {
    const legacy = createInitialGameState(8504);
    delete (legacy.nation as Partial<NationState>).financialSystem;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureFinancialSystemState(first);
    ensureFinancialSystemState(second);
    expect(first.nation.financialSystem).toEqual(second.nation.financialSystem);
  });

  it("旧存档仅缺失资本市场子账户时保留已有货币银行数据", () => {
    const legacy = createInitialGameState(8507);
    legacy.nation.financialSystem.monetary.broadMoney = 123_456_789;
    delete (legacy.nation.financialSystem as Partial<
      NationState["financialSystem"]
    >).capitalMarket;
    ensureFinancialSystemState(legacy);
    expect(legacy.nation.financialSystem.capitalMarket).toBeDefined();
    expect(legacy.nation.financialSystem.monetary.broadMoney)
      .not.toBe(0);
  });
});
