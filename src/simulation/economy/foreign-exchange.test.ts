import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { calculateGDP } from "./gdp";
import { updateCapitalAndInvestment } from "./capital";
import {
  remittanceDirectedInvestment,
  remittanceInvestmentRate,
  updateForeignExchange,
} from "./foreign-exchange";

describe("外汇储备与侨汇", () => {
  it("侨汇先进入居民收入和储蓄，再影响后续投资能力", () => {
    const withoutRemittances = createInitialGameState(1949);
    const withRemittances = structuredClone(withoutRemittances);
    withoutRemittances.nation.trade.remittanceInflows = 0;
    withRemittances.nation.trade.remittanceInflows = 2_000_000_000;

    calculateGDP(withoutRemittances.nation);
    calculateGDP(withRemittances.nation);

    expect(withRemittances.nation.economy.householdIncome).toBeGreaterThan(
      withoutRemittances.nation.economy.householdIncome,
    );
    expect(withRemittances.nation.economy.nationalSavings).toBeGreaterThan(
      withoutRemittances.nation.economy.nationalSavings,
    );
    expect(withRemittances.nation.economy.realGDP).toBe(
      withoutRemittances.nation.economy.realGDP,
    );
  });

  it("侨汇结汇会形成可追踪的外汇储备贡献", () => {
    const lowRemittances = createInitialGameState(1949);
    const highRemittances = structuredClone(lowRemittances);
    lowRemittances.nation.modifiers.push({
      id: "test:low-remittances",
      sourceId: "test",
      target: "trade.remittanceInflows",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });
    highRemittances.nation.modifiers.push({
      id: "test:high-remittances",
      sourceId: "test",
      target: "trade.remittanceInflows",
      operation: "override",
      value: 100_000_000_000,
      remainingMonths: 1,
      stackRule: "replace",
    });

    updateForeignExchange(lowRemittances);
    updateForeignExchange(highRemittances);

    expect(
      highRemittances.nation.trade.remittanceReserveContribution,
    ).toBeGreaterThan(
      lowRemittances.nation.trade.remittanceReserveContribution,
    );
    expect(highRemittances.nation.trade.monthlyReserveChange).toBeGreaterThan(
      lowRemittances.nation.trade.monthlyReserveChange,
    );
  });

  it("侨汇国策会在家庭收入、投资与储备之间形成取舍", () => {
    const baseline = createInitialGameState(1949);
    const protectedRights = structuredClone(baseline);
    const directedInvestment = structuredClone(baseline);
    const centralizedSettlement = structuredClone(baseline);
    protectedRights.nation.policyProgress.remittance_protection = 1;
    directedInvestment.nation.policyProgress.overseas_chinese_investment = 1;
    centralizedSettlement.nation.policyProgress.centralized_fx_settlement = 1;

    for (const state of [
      baseline,
      protectedRights,
      directedInvestment,
      centralizedSettlement,
    ]) {
      updateForeignExchange(state);
      calculateGDP(state.nation);
    }

    expect(protectedRights.nation.trade.remittanceInflows).toBeGreaterThan(
      baseline.nation.trade.remittanceInflows,
    );
    expect(protectedRights.nation.economy.householdIncome).toBeGreaterThan(
      centralizedSettlement.nation.economy.householdIncome,
    );
    expect(remittanceInvestmentRate(directedInvestment.nation)).toBeCloseTo(
      0.26,
      8,
    );
    expect(remittanceDirectedInvestment(directedInvestment.nation)).toBeGreaterThan(
      remittanceDirectedInvestment(baseline.nation),
    );
    expect(centralizedSettlement.nation.trade.remittanceInflows).toBeLessThan(
      baseline.nation.trade.remittanceInflows,
    );
    expect(
      centralizedSettlement.nation.trade.remittanceReserveContribution,
    ).toBeGreaterThan(
      baseline.nation.trade.remittanceReserveContribution,
    );
  });

  it("资本品投资受外汇满足率约束，而不是只看国内储蓄", () => {
    const constrained = createInitialGameState(1949);
    const funded = structuredClone(constrained);
    constrained.nation.trade.capitalGoodsImportShare = 0.3;
    constrained.nation.trade.capitalGoodsImportCoverage = 0.15;
    funded.nation.trade.capitalGoodsImportShare = 0.3;
    funded.nation.trade.capitalGoodsImportCoverage = 1;

    updateCapitalAndInvestment(constrained.nation);
    updateCapitalAndInvestment(funded.nation);

    expect(funded.nation.economy.capitalStock).toBeGreaterThan(
      constrained.nation.economy.capitalStock,
    );
  });

  it("改革后可用生产性外债弥补资本品外汇缺口", () => {
    const blocked = createInitialGameState(1949, 1980);
    const financed = structuredClone(blocked);
    for (const state of [blocked, financed]) {
      state.nation.trade.foreignExchangeReserves = 1_000_000;
      state.nation.trade.exports = 10_000_000;
      state.nation.trade.foreignInvestment = 0;
      state.nation.trade.remittanceReserveContribution = 0;
      state.nation.trade.openness = 0.6;
      state.nation.economy.institutionalEfficiency = 0.7;
      state.nation.economy.investment = 120_000_000_000;
      state.nation.diplomacy.globalReputation = 60;
    }
    blocked.nation.modifiers.push({
      id: "test:no-external-borrowing",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });

    updateForeignExchange(blocked);
    updateForeignExchange(financed);

    expect(financed.nation.trade.monthlyExternalBorrowing).toBeGreaterThan(0);
    expect(financed.nation.trade.externalDebt).toBeGreaterThan(
      blocked.nation.trade.externalDebt,
    );
    expect(financed.nation.trade.capitalGoodsImportCoverage).toBeGreaterThan(
      blocked.nation.trade.capitalGoodsImportCoverage,
    );
  });

  it("外债按月支付利息和本金并消耗外汇", () => {
    const state = createInitialGameState(1949, 1955);
    state.nation.trade.externalDebt = 500_000_000;
    state.nation.trade.foreignExchangeReserves = 1_000_000_000;
    state.nation.modifiers.push({
      id: "test:no-new-debt",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });

    updateForeignExchange(state);

    expect(state.nation.trade.externalDebt).toBeLessThan(500_000_000);
    expect(state.nation.trade.annualExternalDebtService).toBeGreaterThan(0);
    expect(state.nation.trade.externalDebtInterestRate).toBeGreaterThan(0);
    expect(Number.isFinite(state.nation.trade.externalDebtServiceRatio)).toBe(
      true,
    );
  });

  it("苏债窗口维持约百分之一利率，并按史实节点注入残债与清偿", () => {
    const sovietEra = createInitialGameState(1949, 1958);
    sovietEra.nation.trade.externalDebt = 400_000_000;
    sovietEra.nation.trade.foreignExchangeReserves = 800_000_000;
    sovietEra.nation.modifiers.push({
      id: "test:no-new-debt-soviet",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });
    updateForeignExchange(sovietEra);
    expect(sovietEra.nation.trade.externalDebtInterestRate).toBeCloseTo(0.01, 8);

    const sovietGoodsInterest = createInitialGameState(1949, 1958);
    sovietGoodsInterest.nation.trade.externalDebt = 400_000_000;
    sovietGoodsInterest.nation.trade.foreignExchangeReserves = 0;
    sovietGoodsInterest.nation.economy.capitalStock = 80_000_000_000;
    for (const sector of Object.values(sovietGoodsInterest.nation.sectors)) {
      sector.capitalStock = 16_000_000_000;
    }
    sovietGoodsInterest.nation.modifiers.push({
      id: "test:no-new-debt-soviet-goods",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });
    const openingSovietDebt = sovietGoodsInterest.nation.trade.externalDebt;
    updateForeignExchange(sovietGoodsInterest);
    // 外储不足时，对苏窗口利息按实货结算，仍计入年化偿债口径。
    expect(sovietGoodsInterest.nation.trade.annualExternalDebtService).toBeGreaterThanOrEqual(
      openingSovietDebt * 0.01 - 1,
    );

    const residualMonth = createInitialGameState(1949, 1961);
    residualMonth.nation.date.month = 4;
    residualMonth.nation.trade.externalDebt = 50_000_000;
    residualMonth.nation.trade.foreignExchangeReserves = 300_000_000;
    residualMonth.nation.modifiers.push({
      id: "test:no-new-debt-residual",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });
    updateForeignExchange(residualMonth);
    expect(residualMonth.nation.trade.externalDebt).toBeCloseTo(160_000_000, -2);
    expect(residualMonth.nation.trade.monthlyExternalBorrowing).toBeCloseTo(
      110_000_000,
      -2,
    );

    const residualProtected = structuredClone(residualMonth);
    residualProtected.nation.date.month = 5;
    residualProtected.nation.modifiers.push({
      id: "test:force-repay-residual",
      sourceId: "test",
      target: "trade.externalDebtPrincipalRepaymentRate",
      operation: "override",
      value: 1,
      remainingMonths: 1,
      stackRule: "replace",
    });
    residualProtected.nation.modifiers.push({
      id: "test:no-new-debt-residual-may",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });
    updateForeignExchange(residualProtected);
    expect(residualProtected.nation.trade.externalDebt).toBeCloseTo(
      160_000_000,
      -2,
    );

    const formalClearance = createInitialGameState(1949, 1964);
    formalClearance.nation.date.month = 1;
    formalClearance.nation.trade.externalDebt = 2_000_000_000;
    formalClearance.nation.trade.foreignExchangeReserves = 100_000_000;
    formalClearance.nation.modifiers.push({
      id: "test:no-new-debt-formal",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });
    updateForeignExchange(formalClearance);
    expect(formalClearance.nation.trade.externalDebt).toBeCloseTo(
      160_000_000,
      -2,
    );
    expect(
      Number.isFinite(formalClearance.nation.trade.annualExternalDebtService),
    ).toBe(true);
    expect(formalClearance.nation.trade.annualExternalDebtService).toBeGreaterThan(
      0,
    );

    const formalPreserveBorrow = createInitialGameState(1949, 1964);
    formalPreserveBorrow.nation.date.month = 1;
    formalPreserveBorrow.nation.trade.externalDebt = 2_000_000_000;
    formalPreserveBorrow.nation.trade.foreignExchangeReserves = 50_000_000;
    formalPreserveBorrow.nation.modifiers.push({
      id: "test:borrow-with-formal",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 120_000_000,
      remainingMonths: 1,
      stackRule: "replace",
    });
    updateForeignExchange(formalPreserveBorrow);
    expect(formalPreserveBorrow.nation.trade.monthlyExternalBorrowing).toBeCloseTo(
      10_000_000,
      -2,
    );
    expect(formalPreserveBorrow.nation.trade.externalDebt).toBeCloseTo(
      170_000_000,
      -2,
    );

    const formalNoInflate = createInitialGameState(1949, 1964);
    formalNoInflate.nation.date.month = 1;
    formalNoInflate.nation.trade.externalDebt = 40_000_000;
    formalNoInflate.nation.trade.foreignExchangeReserves = 100_000_000;
    formalNoInflate.nation.modifiers.push({
      id: "test:no-new-debt-formal-low",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });
    updateForeignExchange(formalNoInflate);
    expect(formalNoInflate.nation.trade.externalDebt).toBeLessThanOrEqual(
      40_000_000,
    );

    const finalClearance = createInitialGameState(1949, 1965);
    finalClearance.nation.date.month = 10;
    finalClearance.nation.trade.externalDebt = 160_000_000;
    finalClearance.nation.trade.foreignExchangeReserves = 50_000_000;
    finalClearance.nation.modifiers.push({
      id: "test:no-new-debt-final",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 0,
      remainingMonths: 1,
      stackRule: "replace",
    });
    updateForeignExchange(finalClearance);
    expect(finalClearance.nation.trade.externalDebt).toBe(0);

    const finalPreserveBorrow = createInitialGameState(1949, 1965);
    finalPreserveBorrow.nation.date.month = 10;
    finalPreserveBorrow.nation.trade.externalDebt = 160_000_000;
    finalPreserveBorrow.nation.trade.foreignExchangeReserves = 50_000_000;
    finalPreserveBorrow.nation.modifiers.push({
      id: "test:borrow-with-final",
      sourceId: "test",
      target: "trade.externalBorrowing",
      operation: "override",
      value: 120_000_000,
      remainingMonths: 1,
      stackRule: "replace",
    });
    updateForeignExchange(finalPreserveBorrow);
    expect(finalPreserveBorrow.nation.trade.externalDebt).toBeCloseTo(
      10_000_000,
      -2,
    );
  });

  it("史实路线的外储和侨汇数量级合理并稳定运行至 2026 年", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 936 });
    const state = engine.getState();

    expect(state.nation.date).toMatchObject({ year: 2027, month: 1 });
    expect(state.nation.trade.foreignExchangeReserves).toBeGreaterThan(
      2_000_000_000_000,
    );
    expect(state.nation.trade.foreignExchangeReserves).toBeLessThan(
      5_000_000_000_000,
    );
    expect(state.nation.trade.remittanceInflows).toBeGreaterThan(
      35_000_000_000,
    );
    expect(state.nation.trade.remittanceInflows).toBeLessThan(
      70_000_000_000,
    );
    expect(state.nation.trade.importCoverageMonths).toBeGreaterThan(6);
    expect(state.nation.history.annual.at(-1)).toMatchObject({
      foreignExchangeReserves: state.nation.trade.foreignExchangeReserves,
      remittanceInflows: state.nation.trade.remittanceInflows,
    });
  }, 20_000);

  it("旧存档会确定性补齐外汇和侨汇字段", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    const oldState = engine.exportState();
    const oldTrade = oldState.nation.trade as Partial<
      typeof oldState.nation.trade
    >;
    delete oldTrade.foreignExchangeReserves;
    delete oldTrade.monthlyReserveChange;
    delete oldTrade.remittanceInflows;
    delete oldTrade.remittanceReserveContribution;
    delete oldTrade.importCoverageMonths;
    delete oldTrade.externalDebt;
    delete oldTrade.externalDebtToGDP;
    delete oldTrade.externalDebtInterestRate;
    delete oldTrade.annualExternalDebtService;
    delete oldTrade.externalDebtServiceRatio;
    delete oldTrade.monthlyExternalBorrowing;
    delete oldTrade.capitalGoodsForeignExchangeNeed;
    delete oldTrade.capitalGoodsImportShare;
    delete oldTrade.capitalGoodsImportCoverage;
    const oldAnnual = oldState.nation.history.annual[0] as Partial<
      typeof oldState.nation.history.annual[0]
    >;
    delete oldAnnual.foreignExchangeReserves;
    delete oldAnnual.remittanceInflows;
    delete oldAnnual.externalDebt;
    delete oldAnnual.externalDebtToGDP;
    delete oldAnnual.annualExternalDebtService;
    delete oldAnnual.capitalGoodsImportCoverage;

    const restored = createSimulationEngine(oldState).getState();
    expect(restored.nation.trade.foreignExchangeReserves).toBeGreaterThan(0);
    expect(restored.nation.trade.remittanceInflows).toBeGreaterThan(0);
    expect(restored.nation.trade.importCoverageMonths).toBeGreaterThanOrEqual(0);
    expect(restored.nation.trade.externalDebt).toBe(0);
    expect(restored.nation.trade.externalDebtToGDP).toBeGreaterThanOrEqual(0);
    expect(restored.nation.trade.capitalGoodsImportCoverage).toBeGreaterThan(0);
    expect(restored.nation.history.annual[0]).toMatchObject({
      foreignExchangeReserves: 0,
      remittanceInflows: 0,
      externalDebt: 0,
      externalDebtToGDP: 0,
      annualExternalDebtService: 0,
      capitalGoodsImportCoverage: 0,
    });
  });
});
