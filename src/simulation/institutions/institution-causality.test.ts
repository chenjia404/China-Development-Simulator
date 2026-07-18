import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ENDOGENOUS_RISK_IDS,
  ensureInstitutionCausalityState,
  updateInstitutionCausality,
} from "./institution-causality";

describe("制度执行与内生风险因果图", () => {
  it("制度能力由行政、地方、法治和数据质量渐进形成", () => {
    const state = createInitialGameState(9301);
    for (let month = 0; month < 24; month += 1) updateInstitutionCausality(state.nation);
    const institutions = state.nation.institutions;
    expect(institutions.stateCapacity).toBeGreaterThanOrEqual(0);
    expect(institutions.stateCapacity).toBeLessThanOrEqual(1);
    expect(institutions.effectivePolicyExecutionRate).toBeGreaterThanOrEqual(0);
    expect(ENDOGENOUS_RISK_IDS.every((id) => institutions.risks[id])).toBe(true);
  });

  it("高债务通胀和不良贷款分别触发财政与金融风险", () => {
    const state = createInitialGameState(9302);
    state.nation.fiscal.debtToGDP = 1.3;
    state.nation.fiscal.interestExpense = state.nation.fiscal.revenue * 0.4;
    state.nation.economy.inflationRate = 0.3;
    state.nation.financialSystem.banking.nonPerformingLoanRatio = 0.32;
    state.nation.financialSystem.banking.capitalAdequacyRatio = 0.05;
    updateInstitutionCausality(state.nation);
    expect(state.nation.institutions.risks.fiscal_crisis.active).toBe(true);
    expect(state.nation.institutions.risks.financial_crisis.active).toBe(true);
    expect(state.nation.institutions.activeRiskIds).toContain("fiscal_crisis");
  });

  it("政策过载降低有效执行率但不直接修改GDP", () => {
    const baseline = createInitialGameState(9303);
    const overloaded = structuredClone(baseline);
    overloaded.nation.policies = Array.from({ length: 12 }, (_, index) => `test_${index}`);
    const gdp = overloaded.nation.economy.realGDP;
    updateInstitutionCausality(baseline.nation);
    updateInstitutionCausality(overloaded.nation);
    expect(overloaded.nation.institutions.effectivePolicyExecutionRate)
      .toBeLessThan(baseline.nation.institutions.effectivePolicyExecutionRate);
    expect(overloaded.nation.economy.realGDP).toBe(gdp);
  });

  it("旧存档缺失制度因果图时确定性重建", () => {
    const legacy = createInitialGameState(9304);
    delete (legacy.nation as Partial<NationState>).institutions;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureInstitutionCausalityState(first.nation);
    ensureInstitutionCausalityState(second.nation);
    expect(first.nation.institutions).toEqual(second.nation.institutions);
  });
});
