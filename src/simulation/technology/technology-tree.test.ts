import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { updateInternationalTrade } from "../economy/trade";
import {
  calculateTechnologyTreeMetrics,
  ensureTechnologyTreeState,
  getTechnologyNode,
  selectTechnologyResearch,
  technologyResearchRequirements,
  technologyTreeDefinitions,
  updateTechnologyTree,
  validateTechnologyTreeDefinitions,
} from "./technology-tree";

describe("科技树", () => {
  it("配置中的节点、前置关系和科研成本均有效", () => {
    expect(() => validateTechnologyTreeDefinitions()).not.toThrow();
    expect(technologyTreeDefinitions.length).toBeGreaterThanOrEqual(10);
  });

  it("教育和科技能力不足时不能跨级研究", () => {
    const nation = createInitialGameState(1949).nation;
    const electronics = getTechnologyNode("electronics_engineering")!;
    const requirements = technologyResearchRequirements(nation, electronics);
    expect(requirements.some((item) => item.includes("前置"))).toBe(true);
    expect(requirements.some((item) => item.includes("教育指数"))).toBe(true);
    expect(requirements.some((item) => item.includes("科技能力"))).toBe(true);
    expect(() =>
      selectTechnologyResearch(nation, electronics.id)
    ).toThrow("尚不可研究");
  });

  it("科研产出逐月推进节点并解锁产业层级", () => {
    const nation = createInitialGameState(1949).nation;
    nation.education.index = 30;
    nation.technology.index = 30;
    selectTechnologyResearch(nation, "basic_machine_tools");
    updateTechnologyTree(nation, 10);
    expect(nation.technology.completedTechnologyIds).toContain(
      "basic_machine_tools",
    );
    expect(calculateTechnologyTreeMetrics(nation).industryTier).toBe(1);
  });

  it("相同状态和推进过程产生完全一致的科技树", () => {
    const first = createSimulationEngine(createInitialGameState(1949));
    const second = createSimulationEngine(createInitialGameState(1949));
    first.dispatch({ type: "ADVANCE_MONTHS", months: 240 });
    second.dispatch({ type: "ADVANCE_MONTHS", months: 240 });
    expect(first.getState().nation.technology).toEqual(
      second.getState().nation.technology,
    );
    expect(
      first.getState().nation.technology.completedTechnologyIds.length,
    ).toBeGreaterThan(0);
  });

  it("外部只能通过模拟命令切换研究目标", () => {
    const state = createInitialGameState(1949);
    state.nation.education.index = 30;
    state.nation.technology.index = 30;
    const engine = createSimulationEngine(state);
    engine.dispatch({
      type: "SELECT_TECH_RESEARCH",
      technologyId: "basic_machine_tools",
    });
    expect(engine.getState().nation.technology.activeResearchId).toBe(
      "basic_machine_tools",
    );
  });

  it("旧存档缺失科技树字段时会确定性补齐", () => {
    const source = createSimulationEngine(createInitialGameState(1949));
    source.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    const state = source.exportState();
    const oldTechnology = state.nation.technology as Partial<
      typeof state.nation.technology
    >;
    delete oldTechnology.completedTechnologyIds;
    delete oldTechnology.activeResearchId;
    delete oldTechnology.activeResearchProgress;
    const oldAnnual = state.nation.history.annual[0] as Partial<
      typeof state.nation.history.annual[0]
    >;
    delete oldAnnual.completedTechnologyCount;
    delete oldAnnual.industryTechnologyTier;
    delete oldAnnual.industrialUpgradeReadiness;
    ensureTechnologyTreeState(state.nation);
    expect(state.nation.technology.completedTechnologyIds).toEqual([]);
    expect(state.nation.technology.activeResearchId).toBe(
      "mechanized_agriculture",
    );
    expect(state.nation.technology.activeResearchProgress).toBeGreaterThan(0);
    expect(state.nation.history.annual[0]).toMatchObject({
      completedTechnologyCount: 0,
      industryTechnologyTier: 0,
      industrialUpgradeReadiness: 0,
    });
  });

  it("产业升级收益受科技树层级约束，但财政和能源代价不会消失", () => {
    const incapable = createInitialGameState(1949).nation;
    const capable = structuredClone(incapable);
    incapable.policyProgress.industrial_upgrading = 1;
    capable.policyProgress.industrial_upgrading = 1;
    capable.education.index = 80;
    capable.technology.index = 90;
    capable.technology.completedTechnologyIds = technologyTreeDefinitions
      .filter((node) => node.industryTier <= 4)
      .map((node) => node.id);

    expect(
      applyPolicyModifiers(incapable, "trade.exportCompetitiveness", 1),
    ).toBe(1);
    expect(
      applyPolicyModifiers(capable, "trade.exportCompetitiveness", 1),
    ).toBeGreaterThan(1.08);
    expect(applyPolicyModifiers(incapable, "fiscal.spending", 1)).toBe(
      applyPolicyModifiers(capable, "fiscal.spending", 1),
    );
    expect(applyPolicyModifiers(incapable, "resources.energyDemand", 1)).toBe(
      applyPolicyModifiers(capable, "resources.energyDemand", 1),
    );
  });

  it("相同科技指数下，缺少产业科技节点会限制出口", () => {
    const constrained = createInitialGameState(1949);
    const upgraded = structuredClone(constrained);
    for (const state of [constrained, upgraded]) {
      state.nation.technology.index = 80;
      state.nation.education.index = 70;
      state.nation.trade.openness = 0.7;
    }
    upgraded.nation.technology.completedTechnologyIds =
      technologyTreeDefinitions
        .filter((node) => node.industryTier <= 4)
        .map((node) => node.id);
    updateInternationalTrade(constrained);
    updateInternationalTrade(upgraded);
    expect(upgraded.nation.trade.exports).toBeGreaterThan(
      constrained.nation.trade.exports,
    );
  });
});
