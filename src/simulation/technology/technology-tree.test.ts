import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
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

  it("旧存档缺失科技树字段时会确定性补齐", () => {
    const state = createInitialGameState(1949);
    const oldTechnology = state.nation.technology as Partial<
      typeof state.nation.technology
    >;
    delete oldTechnology.completedTechnologyIds;
    delete oldTechnology.activeResearchId;
    delete oldTechnology.activeResearchProgress;
    ensureTechnologyTreeState(state.nation);
    expect(state.nation.technology.completedTechnologyIds).toEqual([]);
    expect(state.nation.technology.activeResearchId).toBeNull();
    expect(state.nation.technology.activeResearchProgress).toBe(0);
  });
});
