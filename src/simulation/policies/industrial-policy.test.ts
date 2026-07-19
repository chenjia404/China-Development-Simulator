import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  calculateIndustrialPolicyAggregateEffects,
  industrialPolicyEffect,
  industrialPolicyCategoryIds,
  setIndustrialPolicyStance,
  updateIndustrialPolicy,
  updateIndustrialPolicyTransition,
  validateIndustrialPolicyConfiguration,
} from "./industrial-policy";
import { calculateFiscalSpending } from "../fiscal/spending";

describe("产业政策状态与命令", () => {
  it("配置完整覆盖十一类工业且初始状态全部中性", () => {
    const state = createInitialGameState(1949);
    expect(validateIndustrialPolicyConfiguration()).toEqual([]);
    expect(industrialPolicyCategoryIds).toHaveLength(11);
    expect(Object.values(state.nation.industrialPolicy.categories)).toHaveLength(11);
    expect(Object.values(state.nation.industrialPolicy.categories).every(
      (policy) => policy.stance === "neutral" && policy.effectiveIntensity === 0,
    )).toBe(true);
  });

  it("扶持和限制按各自过渡期渐进形成，不会瞬时跳变", () => {
    const support = createInitialGameState(1950).nation;
    const suppress = createInitialGameState(1951).nation;
    setIndustrialPolicyStance(support, "electronics_communications", "support");
    setIndustrialPolicyStance(suppress, "basic_materials", "suppress");

    updateIndustrialPolicyTransition(support);
    updateIndustrialPolicyTransition(suppress);
    expect(support.industrialPolicy.categories.electronics_communications.effectiveIntensity)
      .toBeCloseTo(1 / 24, 8);
    expect(suppress.industrialPolicy.categories.basic_materials.effectiveIntensity)
      .toBeCloseTo(-1 / 12, 8);
    for (let month = 1; month < 24; month += 1) {
      updateIndustrialPolicyTransition(support);
      updateIndustrialPolicyTransition(suppress);
    }
    expect(support.industrialPolicy.categories.electronics_communications.effectiveIntensity)
      .toBe(1);
    expect(suppress.industrialPolicy.categories.basic_materials.effectiveIntensity)
      .toBe(-1);
  });

  it("引擎命令写入目标行业并阻止六个月内反复切换", () => {
    const engine = createSimulationEngine(createInitialGameState(1952));
    engine.dispatch({
      type: "SET_INDUSTRIAL_POLICY",
      industryId: "consumer_goods",
      stance: "support",
    });
    expect(engine.getState().nation.industrialPolicy.categories.consumer_goods.stance)
      .toBe("support");
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.industrialPolicy.categories.consumer_goods.effectiveIntensity)
      .toBeCloseTo(1 / 24, 8);
    expect(() => engine.dispatch({
      type: "SET_INDUSTRIAL_POLICY",
      industryId: "consumer_goods",
      stance: "suppress",
    })).toThrow("需等待 6 个月");
    const exported = engine.exportState();
    exported.nation.industrialPolicy.categories.consumer_goods.stance = "neutral";
    expect(engine.getState().nation.industrialPolicy.categories.consumer_goods.stance)
      .toBe("support");
  });

  it("非法行业和非法政策方向会被明确拒绝", () => {
    const nation = createInitialGameState(1953).nation;
    expect(() => setIndustrialPolicyStance(
      nation,
      "unknown" as never,
      "support",
    )).toThrow("未知工业类别");
    expect(() => setIndustrialPolicyStance(
      nation,
      "consumer_goods",
      "unknown" as never,
    )).toThrow("未知产业政策方向");
  });

  it("扶持特定行业会增加定向投资、研发和出口能力并产生财政成本", () => {
    const baseline = createInitialGameState(1954).nation;
    const supported = structuredClone(baseline);
    supported.economy.institutionalEfficiency = 0.8;
    supported.institutions.stateCapacity = 0.8;
    supported.institutions.localImplementationCapacity = 0.8;
    supported.industries.electronics_communications.technologyReadiness = 0.8;
    setIndustrialPolicyStance(
      supported,
      "electronics_communications",
      "support",
    );
    for (let month = 0; month < 24; month += 1) updateIndustrialPolicy(supported);

    const effect = industrialPolicyEffect(supported, "electronics_communications");
    const aggregate = calculateIndustrialPolicyAggregateEffects(supported);
    calculateFiscalSpending(baseline);
    calculateFiscalSpending(supported);
    expect(effect.outputWeightMultiplier).toBeGreaterThan(1);
    expect(effect.productivityMultiplier).toBeGreaterThan(1);
    expect(effect.exportMultiplier).toBeGreaterThan(1);
    expect(aggregate.investmentMultiplier).toBeGreaterThan(1);
    expect(aggregate.researchMultiplier).toBeGreaterThan(1);
    expect(supported.industrialPolicy.annualFiscalCost).toBeGreaterThan(0);
    expect(supported.fiscal.expenditure).toBeGreaterThan(baseline.fiscal.expenditure);
    expect(supported.industrialPolicy.distortionIndex).toBeGreaterThan(0);
  });

  it("限制关键行业会压低投资、出口与供应链并形成就业冲击", () => {
    const nation = createInitialGameState(1955).nation;
    nation.economy.institutionalEfficiency = 0.8;
    nation.institutions.stateCapacity = 0.8;
    nation.institutions.localImplementationCapacity = 0.8;
    setIndustrialPolicyStance(nation, "basic_materials", "suppress");
    for (let month = 0; month < 12; month += 1) updateIndustrialPolicy(nation);

    const effect = industrialPolicyEffect(nation, "basic_materials");
    const aggregate = calculateIndustrialPolicyAggregateEffects(nation);
    expect(effect.outputWeightMultiplier).toBeLessThan(1);
    expect(effect.investmentMultiplier).toBeLessThan(1);
    expect(effect.exportMultiplier).toBeLessThan(1);
    expect(aggregate.investmentMultiplier).toBeLessThan(1);
    expect(aggregate.supplyChainConstraint).toBeLessThan(1);
    expect(nation.industrialPolicy.laborDisplacementPressure).toBeGreaterThan(0);
    expect(nation.industrialPolicy.annualFiscalCost).toBeGreaterThan(0);
  });

  it("同时扶持过多行业会稀释行政能力并扩大财政和错配代价", () => {
    const focused = createInitialGameState(1956).nation;
    const broad = structuredClone(focused);
    for (const nation of [focused, broad]) {
      nation.economy.institutionalEfficiency = 0.45;
      nation.institutions.stateCapacity = 0.45;
      nation.institutions.localImplementationCapacity = 0.45;
      for (const industry of Object.values(nation.industries)) {
        industry.technologyReadiness = 0.65;
      }
    }
    setIndustrialPolicyStance(focused, "electronics_communications", "support");
    for (const industryId of industrialPolicyCategoryIds) {
      setIndustrialPolicyStance(broad, industryId, "support");
    }
    for (let month = 0; month < 24; month += 1) {
      updateIndustrialPolicy(focused);
      updateIndustrialPolicy(broad);
    }

    expect(broad.industrialPolicy.administrativeEffectiveness)
      .toBeLessThan(focused.industrialPolicy.administrativeEffectiveness);
    expect(industrialPolicyEffect(broad, "electronics_communications").effectiveness)
      .toBeLessThan(
        industrialPolicyEffect(focused, "electronics_communications").effectiveness,
      );
    expect(broad.industrialPolicy.annualFiscalCost)
      .toBeGreaterThan(focused.industrialPolicy.annualFiscalCost);
    expect(broad.industrialPolicy.distortionIndex)
      .toBeGreaterThan(focused.industrialPolicy.distortionIndex);
  });
});
