import fiscalConfig from "../../data/config/fiscal.json";
import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { updateWellbeing } from "../society/wellbeing";
import {
  ABOLISH_AGRICULTURAL_TAX_POLICY_ID,
  AGRICULTURAL_TAX_ABOLITION_EVENT_ID,
  calculateAgriculturalTaxPotentialShare,
  ensureFiscalAgricultureTaxState,
  resolveAgriculturalTaxIntensity,
} from "./agricultural-tax";
import { calculateFiscalRevenue } from "./revenue";
import { calculateFiscalSpending } from "./spending";
import { updateDebt } from "./debt";

function baseWithoutAgri(nation: ReturnType<typeof createInitialGameState>["nation"]): number {
  const { economy, trade, sectors, fiscal } = nation;
  const generalTax =
    economy.nominalGDP * fiscalConfig.taxableGDPShare * fiscal.effectiveTaxRate;
  const stateOwnedProfit = sectors.secondary.valueAdded * 0.055;
  const tariffRevenue =
    (trade.exports + trade.imports) * trade.openness * 0.035;
  return generalTax + stateOwnedProfit + tariffRevenue;
}

describe("农业税归因与废除", () => {
  it("潜在份额随一产占比下降，且 1949 附近处于高位", () => {
    const early = calculateAgriculturalTaxPotentialShare(0.505, 0.2);
    const mid = calculateAgriculturalTaxPotentialShare(0.28, 0.45);
    const late = calculateAgriculturalTaxPotentialShare(0.12, 0.7);
    expect(early).toBeGreaterThan(0.25);
    expect(early).toBeLessThan(0.4);
    expect(mid).toBeLessThan(early * 0.35);
    expect(late).toBeGreaterThanOrEqual(0.008);
    expect(late).toBeLessThanOrEqual(0.015);
    expect(late).toBeLessThan(mid);
  });

  it("开局状态即给出非零农税归因，而非等到第一月结算", () => {
    const state = createInitialGameState(1);
    expect(state.nation.fiscal.agriculturalTaxShare).toBeGreaterThan(0.2);
    expect(state.nation.fiscal.agriculturalTaxRevenue).toBeGreaterThan(0);
    expect(state.nation.fiscal.agriculturalTaxAbolished).toBe(false);
  });

  it("非有限一产占比不会污染农税份额", () => {
    expect(calculateAgriculturalTaxPotentialShare(Number.NaN, 0.3)).toBe(
      0.008,
    );
    expect(calculateAgriculturalTaxPotentialShare(0.4, Number.NaN)).toBeGreaterThan(
      0,
    );
    expect(
      Number.isFinite(calculateAgriculturalTaxPotentialShare(Infinity, 0.2)),
    ).toBe(true);
  });

  it("intensity 为 0 时总财政收入与未拆分口径一致", () => {
    const state = createInitialGameState(1);
    calculateFiscalRevenue(state.nation);
    const attributed = state.nation.fiscal.revenue;
    expect(state.nation.fiscal.agriculturalTaxAbolished).toBe(false);
    expect(state.nation.fiscal.agriculturalTaxShare).toBeGreaterThan(0);
    expect(state.nation.fiscal.agriculturalTaxRevenue).toBeCloseTo(
      baseWithoutAgri(state.nation) * state.nation.fiscal.agriculturalTaxShare,
      4,
    );
    // 未废除时，实收加回后与 base 经外层 modifier（空）一致
    expect(attributed).toBeCloseTo(baseWithoutAgri(state.nation), 4);
  });

  it("高一产份额对应更高潜在农税；intensity=1 时实收归零且总收入下降", () => {
    const high = createInitialGameState(1);
    const low = createInitialGameState(1);
    low.nation.sectors.primary.valueAdded =
      low.nation.economy.realGDP * 0.12;
    high.nation.sectors.primary.valueAdded =
      high.nation.economy.realGDP * 0.5;
    high.nation.fiscal.statutoryTaxRate = fiscalConfig.normalTaxRate;
    low.nation.fiscal.statutoryTaxRate = fiscalConfig.normalTaxRate;
    calculateFiscalRevenue(high.nation);
    calculateFiscalRevenue(low.nation);
    expect(high.nation.fiscal.agriculturalTaxShare).toBeGreaterThan(
      low.nation.fiscal.agriculturalTaxShare,
    );

    const before = high.nation.fiscal.revenue;
    const share = high.nation.fiscal.agriculturalTaxShare;
    high.nation.fiscal.agriculturalTaxAbolished = true;
    calculateFiscalRevenue(high.nation);
    expect(high.nation.fiscal.agriculturalTaxRevenue).toBeCloseTo(0, 8);
    expect(high.nation.fiscal.revenue).toBeCloseTo(
      baseWithoutAgri(high.nation) * (1 - share),
      5,
    );
    expect(high.nation.fiscal.revenue).toBeLessThan(before);
  });

  it("废农税扣减发生在财政乘子内侧", () => {
    const state = createInitialGameState(1);
    state.nation.policies = ["free_port_trade"];
    state.nation.policyProgress.free_port_trade = 1;
    state.nation.fiscal.agriculturalTaxAbolished = true;
    calculateFiscalRevenue(state.nation);
    const afterInnerCut = applyPolicyModifiers(
      state.nation,
      "fiscal.revenue",
      baseWithoutAgri(state.nation) *
        (1 - state.nation.fiscal.agriculturalTaxShare),
    );
    expect(state.nation.fiscal.revenue).toBeCloseTo(afterInnerCut, 5);
    expect(state.nation.fiscal.revenue).toBeLessThan(
      baseWithoutAgri(state.nation) * 0.96,
    );
  });

  it("国策满额后取消仍不恢复征收", () => {
    const engine = createSimulationEngine(createInitialGameState(2));
    engine.dispatch({
      type: "SET_POLICIES",
      policyIds: [ABOLISH_AGRICULTURAL_TAX_POLICY_ID],
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 18 });
    expect(engine.getState().nation.fiscal.agriculturalTaxAbolished).toBe(true);
    expect(engine.getState().nation.fiscal.agriculturalTaxRevenue).toBeCloseTo(
      0,
      6,
    );

    engine.dispatch({ type: "SET_POLICIES", policyIds: [] });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 24 });
    expect(engine.getState().nation.fiscal.agriculturalTaxAbolished).toBe(true);
    expect(engine.getState().nation.fiscal.agriculturalTaxRevenue).toBeCloseTo(
      0,
      6,
    );
    expect(
      engine.getState().nation.policyProgress[ABOLISH_AGRICULTURAL_TAX_POLICY_ID] ??
        0,
    ).toBe(0);
  });

  it("仅事件路径与仅国策路径在满强度时清税一致", () => {
    const byPolicy = createInitialGameState(3);
    byPolicy.nation.policyProgress[ABOLISH_AGRICULTURAL_TAX_POLICY_ID] = 1;
    calculateFiscalRevenue(byPolicy.nation);

    const byEvent = createInitialGameState(3);
    byEvent.nation.history.historicalEvents.push({
      id: AGRICULTURAL_TAX_ABOLITION_EVENT_ID,
      name: "全面取消农业税",
      year: 2006,
      month: 1,
      scheduledYear: 2006,
      scheduledMonth: 1,
      category: "财政金融",
      impact: "positive",
      description: "test",
      effects: [],
      durationMonths: 12,
      choiceId: "historical_path",
      choiceName: "遵循历史路径",
      choiceDescription: "test",
      outcome: "occurred",
    });
    calculateFiscalRevenue(byEvent.nation);

    expect(byPolicy.nation.fiscal.agriculturalTaxAbolished).toBe(true);
    expect(byEvent.nation.fiscal.agriculturalTaxAbolished).toBe(true);
    expect(byPolicy.nation.fiscal.agriculturalTaxRevenue).toBeCloseTo(0, 8);
    expect(byEvent.nation.fiscal.agriculturalTaxRevenue).toBeCloseTo(0, 8);
    expect(byPolicy.nation.fiscal.revenue).toBeCloseTo(
      byEvent.nation.fiscal.revenue,
      5,
    );
  });

  it("旧存档缺字段可由 ensure 补齐且不清除已废除标志", () => {
    const state = createInitialGameState(4);
    const fiscal = state.nation.fiscal as {
      agriculturalTaxShare?: number;
      agriculturalTaxRevenue?: number;
      agriculturalTaxAbolished?: boolean;
    };
    delete fiscal.agriculturalTaxShare;
    delete fiscal.agriculturalTaxRevenue;
    delete fiscal.agriculturalTaxAbolished;
    ensureFiscalAgricultureTaxState(state.nation);
    expect(state.nation.fiscal.agriculturalTaxShare).toBe(0);
    expect(state.nation.fiscal.agriculturalTaxAbolished).toBe(false);

    state.nation.fiscal.agriculturalTaxAbolished = true;
    ensureFiscalAgricultureTaxState(state.nation);
    expect(state.nation.fiscal.agriculturalTaxAbolished).toBe(true);
  });

  it("国策已废除后 interactive 在 2006 年不再留下待决策", () => {
    const state = createInitialGameState(5, 2006, "interactive");
    state.nation.fiscal.agriculturalTaxAbolished = true;
    state.nation.date.year = 2006;
    state.nation.date.month = 1;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    const nation = engine.getState().nation;
    expect(nation.pendingHistoricalEventId).toBeNull();
    expect(nation.history.historicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: AGRICULTURAL_TAX_ABOLITION_EVENT_ID,
          choiceId: "historical_path",
          outcome: "occurred",
        }),
      ]),
    );
    expect(nation.date.month).toBe(2);
  });

  it("早年满强度废除的财政净代价大于民生指数改善", () => {
    const baseline = createInitialGameState(6);
    const abolished = createInitialGameState(6);
    abolished.nation.fiscal.agriculturalTaxAbolished = true;
    calculateFiscalRevenue(baseline.nation);
    calculateFiscalSpending(baseline.nation);
    updateDebt(baseline.nation);
    updateWellbeing(baseline.nation);
    calculateFiscalRevenue(abolished.nation);
    calculateFiscalSpending(abolished.nation);
    updateDebt(abolished.nation);
    updateWellbeing(abolished.nation);

    const revenueLoss =
      baseline.nation.fiscal.revenue - abolished.nation.fiscal.revenue;
    expect(revenueLoss / baseline.nation.fiscal.revenue).toBeGreaterThan(0.2);
    expect(abolished.nation.fiscal.balance).toBeLessThan(
      baseline.nation.fiscal.balance,
    );
    const happinessGain =
      abolished.nation.society.happinessIndex -
      baseline.nation.society.happinessIndex;
    const stabilityGain =
      abolished.nation.society.stabilityIndex -
      baseline.nation.society.stabilityIndex;
    expect(happinessGain).toBeLessThan(3);
    expect(stabilityGain).toBeLessThan(3);
    expect(revenueLoss / baseline.nation.fiscal.revenue).toBeGreaterThan(
      Math.max(happinessGain, stabilityGain) / 100,
    );
  });

  it("事件与国策同时存在时 intensity 仍为 1 且不双重扣减", () => {
    const state = createInitialGameState(7);
    state.nation.policyProgress[ABOLISH_AGRICULTURAL_TAX_POLICY_ID] = 1;
    state.nation.history.historicalEvents.push({
      id: AGRICULTURAL_TAX_ABOLITION_EVENT_ID,
      name: "全面取消农业税",
      year: 2006,
      month: 1,
      scheduledYear: 2006,
      scheduledMonth: 1,
      category: "财政金融",
      impact: "positive",
      description: "test",
      effects: [],
      durationMonths: 12,
      choiceId: "historical_path",
      choiceName: "遵循历史路径",
      choiceDescription: "test",
      outcome: "occurred",
    });
    expect(resolveAgriculturalTaxIntensity(state.nation)).toBe(1);
    calculateFiscalRevenue(state.nation);
    const share = state.nation.fiscal.agriculturalTaxShare;
    expect(state.nation.fiscal.revenue).toBeCloseTo(
      baseWithoutAgri(state.nation) * (1 - share),
      5,
    );
  });
});
