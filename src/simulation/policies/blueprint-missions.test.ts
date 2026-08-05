import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  blueprintMissionChains,
  ensureBlueprintMissionState,
  getBlueprintMissionStatus,
  updateBlueprintMission,
} from "./blueprint-missions";

const heavyIndustryOpening = {
  economicMechanism: "planned" as const,
  diplomaticStrategyId: "balanced" as const,
  foreignPolicyDoctrineId: "status_quo" as const,
  developmentBlueprintId: "heavy_industry_priority",
};

describe("开局蓝图三阶段任务链", () => {
  it("四套开局蓝图均有三个顺序阶段和带取舍的奖励", () => {
    expect(blueprintMissionChains).toHaveLength(4);
    for (const chain of blueprintMissionChains) {
      expect(chain.stages).toHaveLength(3);
      expect(new Set(chain.stages.map((stage) => stage.id)).size).toBe(3);
      for (const stage of chain.stages) {
        expect(stage.metrics.length).toBeGreaterThanOrEqual(3);
        expect(stage.completionModifiers.some((modifier) =>
          modifier.operation === "multiply" && modifier.value > 1 ||
          modifier.operation === "add" && modifier.value > 0
        )).toBe(true);
        expect(stage.rewardText.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("未选择开局蓝图时不启用任务链", () => {
    const state = createInitialGameState(1949);
    const status = getBlueprintMissionStatus(state);
    expect(status.chain).toBeNull();
    expect(status.stage).toBeNull();
  });

  it("年末达标后只完成当前阶段并施加五年奖励与代价", () => {
    const state = createInitialGameState(1, 1950, "automatic", heavyIndustryOpening);
    state.nation.sectors.secondary.valueAdded = state.nation.economy.realGDP * 0.25;
    state.nation.resources.energySupplyRatio = 1;
    state.nation.economy.infrastructureIndex = 20;

    expect(updateBlueprintMission(state)).toBe("heavy_industry_foundation");
    expect(state.nation.blueprintMission.currentStageIndex).toBe(1);
    expect(state.nation.blueprintMission.completedStages).toHaveLength(1);
    const rewards = state.nation.modifiers.filter((modifier) =>
      modifier.sourceId === "blueprint_mission:heavy_industry_priority:heavy_industry_foundation"
    );
    expect(rewards).toHaveLength(4);
    expect(rewards.every((modifier) => modifier.remainingMonths === 60)).toBe(true);

    expect(updateBlueprintMission(state)).toBeNull();
    expect(state.nation.blueprintMission.currentStageIndex).toBe(1);
  });

  it("未满足全部指标时保留当前阶段", () => {
    const state = createInitialGameState(1, 1950, "automatic", heavyIndustryOpening);
    state.nation.resources.energySupplyRatio = 0.2;
    expect(updateBlueprintMission(state)).toBeNull();
    expect(state.nation.blueprintMission.currentStageIndex).toBe(0);
    expect(getBlueprintMissionStatus(state).qualified).toBe(false);
  });

  it("旧存档按开局蓝图确定性补齐任务状态", () => {
    const legacy = createInitialGameState(1, 1960, "interactive", heavyIndustryOpening);
    delete (legacy.nation as Partial<typeof legacy.nation>).blueprintMission;
    ensureBlueprintMissionState(legacy);
    expect(legacy.nation.blueprintMission.blueprintId).toBe("heavy_industry_priority");
    expect(legacy.nation.blueprintMission.currentStageIndex).toBe(0);

    delete (legacy.nation as Partial<typeof legacy.nation>).blueprintMission;
    const engine = createSimulationEngine(legacy);
    expect(engine.getState().nation.blueprintMission.blueprintId).toBe("heavy_industry_priority");
  });
});
