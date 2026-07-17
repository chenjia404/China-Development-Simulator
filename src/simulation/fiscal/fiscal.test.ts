import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { updateInflation } from "../economy/inflation";
import { createInitialGameState } from "../state/initial-state";
import { updateDebt } from "./debt";
import { calculateEffectiveTaxRate, calculateFiscalRevenue } from "./revenue";
import { calculateFiscalSpending } from "./spending";

describe("财政、债务与通胀", () => {
  it("过高税率不会无限提高有效税率和财政收入", () => {
    const normal = calculateEffectiveTaxRate(0.25, 0.7);
    const extreme = calculateEffectiveTaxRate(0.8, 0.7);

    expect(extreme).toBeLessThan(normal);
  });

  it("财政赤字增加债务且债务产生利息", () => {
    const state = createInitialGameState(1);
    calculateFiscalRevenue(state.nation);
    state.nation.fiscal.expenditure = state.nation.fiscal.revenue * 2;
    state.nation.fiscal.balance =
      state.nation.fiscal.revenue - state.nation.fiscal.expenditure;
    const before = state.nation.fiscal.governmentDebt;
    updateDebt(state.nation);

    expect(state.nation.fiscal.governmentDebt).toBeGreaterThan(before);
    expect(state.nation.fiscal.interestExpense).toBeGreaterThan(0);
  });

  it("财政盈余用于偿还债务", () => {
    const state = createInitialGameState(1);
    state.nation.fiscal.balance = 1_000_000_000;
    const before = state.nation.fiscal.governmentDebt;
    updateDebt(state.nation);

    expect(state.nation.fiscal.governmentDebt).toBeLessThan(before);
  });

  it("货币融资提高通胀目标和价格水平", () => {
    const baseline = createInitialGameState(1);
    const financed = createInitialGameState(1);
    financed.nation.fiscal.monetaryFinancing =
      financed.nation.economy.nominalGDP * 0.2;
    const baselinePrice = baseline.nation.economy.priceLevelIndex;

    updateInflation(baseline.nation);
    updateInflation(financed.nation);

    expect(financed.nation.economy.inflationRate).toBeGreaterThan(
      baseline.nation.economy.inflationRate,
    );
    expect(financed.nation.economy.priceLevelIndex).toBeGreaterThan(baselinePrice);
  });

  it("极端赤字连续运行时债务和通胀仍保持有限值", () => {
    const engine = createSimulationEngine(createInitialGameState(9));
    engine.dispatch({
      type: "SET_POLICIES",
      policyIds: ["deficit_spending", "monetary_financing"],
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 360 });
    const { fiscal, economy } = engine.getState().nation;

    expect(Number.isFinite(fiscal.governmentDebt)).toBe(true);
    expect(Number.isFinite(economy.inflationRate)).toBe(true);
    expect(fiscal.governmentDebt).toBeGreaterThan(0);
    expect(economy.inflationRate).toBeLessThanOrEqual(10);
  });

  it("正常预算能闭合收入、支出和余额", () => {
    const state = createInitialGameState(1);
    calculateFiscalRevenue(state.nation);
    calculateFiscalSpending(state.nation);

    expect(state.nation.fiscal.balance).toBeCloseTo(
      state.nation.fiscal.revenue - state.nation.fiscal.expenditure,
      6,
    );
  });
});
