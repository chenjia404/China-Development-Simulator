import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  configureScenario,
  ensureScenarioState,
  gameDifficultyDefinitions,
  gameScenarioDefinitions,
  updateScenarioProgress,
} from "./game-scenarios";

const reformOpening = {
  economicMechanism: "market" as const,
  diplomaticStrategyId: "balanced" as const,
  foreignPolicyDoctrineId: "economic_diplomacy" as const,
  developmentBlueprintId: "light_export_earning",
  scenarioId: "reform_1978" as const,
  difficultyId: "challenge" as const,
};

describe("短剧本与难度", () => {
  it("提供一个完整战役、三个短剧本与三档难度", () => {
    expect(gameScenarioDefinitions.filter((scenario) => scenario.short)).toHaveLength(3);
    const fullCampaign = gameScenarioDefinitions.filter((scenario) => !scenario.short);
    expect(fullCampaign).toHaveLength(1);
    expect(fullCampaign[0].endYear).toBe(2050);
    expect(gameDifficultyDefinitions.map((difficulty) => difficulty.id)).toEqual([
      "relaxed",
      "standard",
      "challenge",
    ]);
  });

  it("挑战难度只通过永久中间变量修正生效", () => {
    const state = createInitialGameState(1949);
    configureScenario(state, "full_campaign", "challenge");
    const difficultyModifiers = state.nation.modifiers.filter(
      (modifier) => modifier.sourceId === "difficulty:challenge",
    );
    expect(difficultyModifiers).toHaveLength(4);
    expect(difficultyModifiers.every((modifier) => modifier.remainingMonths === null)).toBe(true);
    expect(difficultyModifiers.some((modifier) => modifier.target === "capital.investmentEfficiency")).toBe(true);
  });

  it("改革短剧本通过确定性背景预演从 1978 年开始", () => {
    const first = createSimulationEngine();
    const second = createSimulationEngine();
    const command = {
      type: "CREATE_GAME" as const,
      seed: 77,
      historicalEventDecisionMode: "interactive" as const,
      openingChoices: reformOpening,
    };
    first.dispatchHeadless(command);
    second.dispatchHeadless(command);

    const left = first.getState();
    const right = second.getState();
    expect(left.nation.date).toMatchObject({ year: 1978, month: 1 });
    expect(left.nation.historicalEventDecisionMode).toBe("interactive");
    expect(left.nation.scenario.scenarioId).toBe("reform_1978");
    expect(left.nation.scenario.difficultyId).toBe("challenge");
    expect(left.nation.scenario.completedYear).toBeNull();
    expect(left.nation.history.annual.length).toBeGreaterThan(20);
    expect(left.nation.economy.realGDP).toBe(right.nation.economy.realGDP);
    expect(left.randomState).toBe(right.randomState);
  });

  it("短剧本到期时按完成目标数固定评级", () => {
    const state = createInitialGameState(1, 1992, "automatic", reformOpening);
    state.nation.trade.openness = 0.5;
    state.nation.society.povertyRate = 0.2;
    state.nation.enterprises.privateAndMixedShare = 0.1;
    updateScenarioProgress(state);
    expect(state.nation.scenario.completedYear).toBe(1992);
    expect(state.nation.scenario.rating).toBe("silver");
    expect(state.nation.scenario.objectiveResults.filter((item) => item.met)).toHaveLength(2);

    state.nation.enterprises.privateAndMixedShare = 0.8;
    state.nation.date.year = 1993;
    updateScenarioProgress(state);
    expect(state.nation.scenario.rating).toBe("silver");
  });

  it("旧存档迁移为标准难度完整战役", () => {
    const legacy = createInitialGameState(1949);
    delete (legacy.nation as Partial<typeof legacy.nation>).scenario;
    ensureScenarioState(legacy);
    expect(legacy.nation.scenario.scenarioId).toBe("full_campaign");
    expect(legacy.nation.scenario.difficultyId).toBe("standard");
  });
});
