import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  applyPolicyModifiers,
  getNationalPolicy,
} from "../policies/policy-engine";
import { calculateGDP } from "./gdp";
import { updateCapitalAndInvestment } from "./capital";
import {
  applyRemittanceChannelModifiers,
  foreignExchangeInvestmentMultiplier,
  remittanceDirectedInvestment,
  remittanceDomesticIncome,
  remittanceInvestmentRate,
  remittanceShockImmunity,
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

  it("历史事件可提高侨汇转投资比例并分流更多侨汇进入资本形成", () => {
    const baseline = createInitialGameState(1955);
    const boosted = structuredClone(baseline);
    boosted.nation.modifiers.push({
      id: "test:remittance-investment-rate",
      sourceId: "test",
      target: "capital.remittanceInvestmentRate",
      operation: "add",
      value: 0.12,
      remainingMonths: 12,
      stackRule: "stack",
    });
    baseline.nation.trade.remittanceInflows = 2_000_000_000;
    boosted.nation.trade.remittanceInflows = 2_000_000_000;

    expect(remittanceInvestmentRate(boosted.nation)).toBeCloseTo(
      remittanceInvestmentRate(baseline.nation) + 0.12,
      6,
    );
    expect(remittanceDirectedInvestment(boosted.nation)).toBeGreaterThan(
      remittanceDirectedInvestment(baseline.nation),
    );
    expect(remittanceDomesticIncome(boosted.nation)).toBeLessThan(
      remittanceDomesticIncome(baseline.nation),
    );
  });

  it("历史事件也可提高侨汇到户效率并增加居民所得", () => {
    const baseline = createInitialGameState(1955);
    const boosted = structuredClone(baseline);
    boosted.nation.modifiers.push({
      id: "test:remittance-transfer-efficiency",
      sourceId: "test",
      target: "trade.remittanceTransferEfficiency",
      operation: "multiply",
      value: 1.03,
      remainingMonths: 12,
      stackRule: "stack",
    });
    baseline.nation.trade.remittanceInflows = 2_000_000_000;
    boosted.nation.trade.remittanceInflows = 2_000_000_000;

    expect(remittanceDomesticIncome(boosted.nation)).toBeGreaterThan(
      remittanceDomesticIncome(baseline.nation),
    );
  });

  it("保护侨汇权益国策满额后可长期显著提高侨汇流入", () => {
    const policy = getNationalPolicy("remittance_protection");
    expect(policy).toMatchObject({
      transitionMonths: 36,
    });
    expect(
      policy?.modifiers.find(
        (modifier) => modifier.target === "trade.remittanceInflows",
      ),
    ).toMatchObject({ operation: "multiply", value: 1.28 });

    const baseline = createSimulationEngine(createInitialGameState(1955));
    const protectedRights = createSimulationEngine(
      createInitialGameState(1955),
    );
    protectedRights.dispatch({
      type: "SET_POLICIES",
      policyIds: ["remittance_protection"],
    });

    // 过渡期满后再继续维持多年，确认增益不会自行消退。
    baseline.dispatch({ type: "ADVANCE_MONTHS", months: 120 });
    protectedRights.dispatch({ type: "ADVANCE_MONTHS", months: 120 });

    const baselineState = baseline.getState();
    const protectedState = protectedRights.getState();
    expect(protectedState.nation.policyProgress.remittance_protection).toBe(1);
    expect(protectedState.nation.policies).toContain("remittance_protection");
    expect(
      applyPolicyModifiers(
        protectedState.nation,
        "trade.remittanceInflows",
        100,
      ),
    ).toBeCloseTo(128, 6);
    expect(protectedState.nation.trade.remittanceInflows).toBeGreaterThan(
      baselineState.nation.trade.remittanceInflows * 1.18,
    );
  }, 20_000);

  it("史实路线呈现高峰、1953回落、1962低谷与恢复；保护侨汇在大跃进前持续上涨", () => {
    const sampleYears = (policyIds: string[]) => {
      const engine = createSimulationEngine(createInitialGameState(1949));
      if (policyIds.length > 0) {
        engine.dispatch({ type: "SET_POLICIES", policyIds });
      }
      const byYear = new Map<number, number>();
      for (let year = 1949; year <= 1966; year += 1) {
        const { nation } = engine.getState();
        byYear.set(nation.date.year, nation.trade.remittanceInflows);
        engine.dispatch({
          type: "ADVANCE_MONTHS",
          months: 12 - nation.date.month + 1,
        });
      }
      return byYear;
    };

    const baseline = sampleYears([]);
    const protectedRights = sampleYears(["remittance_protection"]);
    const earlyPeak = Math.max(
      baseline.get(1951) ?? 0,
      baseline.get(1952) ?? 0,
    );
    expect(earlyPeak).toBeGreaterThan(180_000_000);
    expect(baseline.get(1954) ?? 0).toBeLessThan(earlyPeak * 0.9);

    for (const year of [1955, 1956, 1957]) {
      const remittance = baseline.get(year) ?? 0;
      expect(remittance).toBeGreaterThan(115_000_000);
      expect(remittance).toBeLessThan(165_000_000);
      expect(remittance).toBeLessThan(earlyPeak * 0.85);
    }

    const trough = Math.min(
      baseline.get(1960) ?? Number.POSITIVE_INFINITY,
      baseline.get(1961) ?? Number.POSITIVE_INFINITY,
      baseline.get(1962) ?? Number.POSITIVE_INFINITY,
    );
    expect(trough).toBeGreaterThan(30_000_000);
    expect(trough).toBeLessThan(85_000_000);
    expect(trough).toBeLessThan((baseline.get(1957) ?? 0) * 0.65);

    const recovery1965 = baseline.get(1965) ?? 0;
    expect(recovery1965).toBeGreaterThan(trough * 1.5);
    expect(recovery1965).toBeGreaterThan(100_000_000);

    const protected1954 = protectedRights.get(1954) ?? 0;
    const protected1957 = protectedRights.get(1957) ?? 0;
    const protected1962 = protectedRights.get(1962) ?? 0;
    expect(protected1954).toBeGreaterThan(baseline.get(1954) ?? 0);
    expect(protected1957).toBeGreaterThan(protected1954);
    expect(protected1957).toBeGreaterThan(baseline.get(1957) ?? 0);
    // 满额保护后免疫大跃进等侨汇负面冲击，1962 年仍高于 1957 并远高于史实低谷。
    expect(protected1962).toBeGreaterThan(protected1957);
    expect(protected1962).toBeGreaterThan(trough * 2.2);
  }, 30_000);

  it("保护侨汇满额后免疫侨汇渠道负面修正，并与正面修正叠加", () => {
    const unprotected = createInitialGameState(1960);
    const protectedRights = structuredClone(unprotected);
    protectedRights.nation.policyProgress.remittance_protection = 1;
    expect(remittanceShockImmunity(protectedRights.nation)).toBe(1);

    for (const state of [unprotected, protectedRights]) {
      state.nation.modifiers.push(
        {
          id: "test:glf-remittance-hit",
          sourceId: "test",
          target: "trade.remittanceInflows",
          operation: "multiply",
          value: 0.5,
          remainingMonths: 12,
          stackRule: "replace",
        },
        {
          id: "test:decree-remittance-boost",
          sourceId: "test",
          target: "trade.remittanceInflows",
          operation: "multiply",
          value: 1.2,
          remainingMonths: 12,
          stackRule: "replace",
        },
      );
    }

    expect(
      applyRemittanceChannelModifiers(unprotected.nation, "trade.remittanceInflows", 100),
    ).toBeCloseTo(60, 6);
    expect(
      applyRemittanceChannelModifiers(
        protectedRights.nation,
        "trade.remittanceInflows",
        100,
      ),
    ).toBeCloseTo(120, 6);
  });

  it("保护侨汇路线在冲击期仍抬高侨汇、外储贡献与资本品保障", () => {
    const runTo = (policyIds: string[], endYear: number) => {
      const engine = createSimulationEngine(createInitialGameState(1949));
      if (policyIds.length > 0) {
        engine.dispatch({ type: "SET_POLICIES", policyIds });
      }
      while (engine.getState().nation.date.year < endYear) {
        const { nation } = engine.getState();
        engine.dispatch({
          type: "ADVANCE_MONTHS",
          months: 12 - nation.date.month + 1,
        });
      }
      return engine.getState().nation;
    };

    const baseline = runTo([], 1965);
    const protectedRights = runTo(["remittance_protection"], 1965);
    expect(protectedRights.trade.remittanceInflows).toBeGreaterThan(
      baseline.trade.remittanceInflows * 1.8,
    );
    expect(protectedRights.trade.remittanceReserveContribution).toBeGreaterThan(
      baseline.trade.remittanceReserveContribution * 1.8,
    );
    expect(protectedRights.trade.capitalGoodsImportCoverage).toBeGreaterThan(
      baseline.trade.capitalGoodsImportCoverage,
    );
    expect(protectedRights.economy.capitalStock).toBeGreaterThan(
      baseline.economy.capitalStock,
    );
    expect(protectedRights.economy.householdIncome).toBeGreaterThan(
      baseline.economy.householdIncome,
    );
  }, 30_000);

  it("避免大跃进与公社化可使1962年侨汇显著高于史实低谷", () => {
    const runTo1962 = (choices: Array<{ eventId: string; choiceId: string }>) => {
      const engine = createSimulationEngine(
        createInitialGameState(1956, 1956, "interactive"),
      );
      while (engine.getState().nation.date.year < 1963) {
        if (
          engine.getState().nation.strategicPlanning.pendingReviewYear !== null
        ) {
          engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
          engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "interactive" });
        }
        const pending = engine.getState().nation.pendingHistoricalEventId;
        if (pending) {
          const choice = choices.find((item) => item.eventId === pending);
          engine.dispatch({
            type: "RESOLVE_HISTORICAL_EVENT",
            eventId: pending,
            choiceId: choice?.choiceId ?? "historical_path",
          });
        }
        engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
        if (engine.getState().nation.famineMortality?.pendingReport) {
          engine.dispatch({ type: "DISMISS_FAMINE_MORTALITY_REPORT" });
        }
      }
      return engine.getState().nation.trade.remittanceInflows;
    };

    const historical = runTo1962([]);
    const avoided = runTo1962([
      { eventId: "great_leap_forward_1958", choiceId: "avoid_great_leap" },
      { eventId: "peoples_communes_1958", choiceId: "avoid_communes" },
    ]);
    expect(historical).toBeLessThan(95_000_000);
    expect(avoided).toBeGreaterThan(historical * 1.35);
    expect(avoided).toBeGreaterThan(110_000_000);
  }, 30_000);

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
      0.25,
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

  it("更高侨汇结汇会提高资本品进口保障并缓解设备投资约束", () => {
    const lowRemittances = createInitialGameState(1955);
    const highRemittances = structuredClone(lowRemittances);
    for (const state of [lowRemittances, highRemittances]) {
      state.nation.trade.foreignExchangeReserves = 20_000_000;
      state.nation.trade.exports = 80_000_000;
      state.nation.trade.foreignInvestment = 0;
      state.nation.economy.investment = 40_000_000_000;
      state.nation.modifiers.push({
        id: "test:no-external-borrowing",
        sourceId: "test",
        target: "trade.externalBorrowing",
        operation: "override",
        value: 0,
        remainingMonths: 1,
        stackRule: "replace",
      });
    }
    lowRemittances.nation.trade.remittanceInflows = 40_000_000;
    highRemittances.nation.trade.remittanceInflows = 800_000_000;
    lowRemittances.nation.modifiers.push({
      id: "test:low-remittance-for-capital-goods",
      sourceId: "test",
      target: "trade.remittanceInflows",
      operation: "override",
      value: 40_000_000,
      remainingMonths: 1,
      stackRule: "replace",
    });
    highRemittances.nation.modifiers.push({
      id: "test:high-remittance-for-capital-goods",
      sourceId: "test",
      target: "trade.remittanceInflows",
      operation: "override",
      value: 800_000_000,
      remainingMonths: 1,
      stackRule: "replace",
    });

    updateForeignExchange(lowRemittances);
    updateForeignExchange(highRemittances);
    updateCapitalAndInvestment(lowRemittances.nation);
    updateCapitalAndInvestment(highRemittances.nation);

    expect(highRemittances.nation.trade.remittanceReserveContribution).toBeGreaterThan(
      lowRemittances.nation.trade.remittanceReserveContribution,
    );
    expect(highRemittances.nation.trade.capitalGoodsImportCoverage).toBeGreaterThan(
      lowRemittances.nation.trade.capitalGoodsImportCoverage,
    );
    expect(
      foreignExchangeInvestmentMultiplier(highRemittances.nation),
    ).toBeGreaterThan(
      foreignExchangeInvestmentMultiplier(lowRemittances.nation),
    );
    expect(highRemittances.nation.economy.capitalStock).toBeGreaterThan(
      lowRemittances.nation.economy.capitalStock,
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

  it("建国至改革开放前夕累计侨汇贴近史实75.86亿美元数量级", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    let cumulativeRemittance = 0;
    let firstYearRemittance = 0;

    // 史实口径约 1950—1980 年；以各年 1 月年度化流入近似年累计。
    for (let year = 1949; year <= 1980; year += 1) {
      const { nation } = engine.getState();
      if (year === 1949) {
        firstYearRemittance = nation.trade.remittanceInflows;
      } else {
        cumulativeRemittance += nation.trade.remittanceInflows;
      }
      engine.dispatch({
        type: "ADVANCE_MONTHS",
        months: 12 - nation.date.month + 1,
      });
    }

    // 史实累计约 75.86 亿美元，足以覆盖同期外贸逆差约 61.24 亿美元。
    expect(cumulativeRemittance).toBeGreaterThan(6_124_000_000);
    expect(cumulativeRemittance).toBeLessThan(9_500_000_000);
    expect(cumulativeRemittance).toBeGreaterThan(firstYearRemittance);
  }, 20_000);

  it("史实路线的外储和侨汇数量级合理并稳定运行至 2026 年", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 936 });
    const state = engine.getState();

    expect(state.nation.date).toMatchObject({ year: 2027, month: 1 });
    expect(state.nation.trade.foreignExchangeReserves).toBeGreaterThan(
      1_700_000_000_000,
    );
    expect(state.nation.trade.foreignExchangeReserves).toBeLessThan(
      5_000_000_000_000,
    );
    expect(state.nation.trade.remittanceInflows).toBeGreaterThan(
      24_000_000_000,
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
    delete oldTrade.sovietDebtRepaymentPlan;
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
    expect(restored.nation.trade.sovietDebtRepaymentPlan).toBe("unset");
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
