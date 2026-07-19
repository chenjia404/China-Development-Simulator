import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  industrialPolicyCategoryIds,
  setIndustrialPolicyStance,
  updateIndustrialPolicyTransition,
  validateIndustrialPolicyConfiguration,
} from "./industrial-policy";

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
});
