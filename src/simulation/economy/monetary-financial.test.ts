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

  it("旧存档缺失金融账户时可确定性重建", () => {
    const legacy = createInitialGameState(8504);
    delete (legacy.nation as Partial<NationState>).financialSystem;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureFinancialSystemState(first);
    ensureFinancialSystemState(second);
    expect(first.nation.financialSystem).toEqual(second.nation.financialSystem);
  });
});
