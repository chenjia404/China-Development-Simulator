import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { getDiplomaticStrategy } from "../diplomacy/diplomatic-strategy";
import { getEconomicMechanismPreset } from "../economy/economic-coordination";
import { getOpeningDevelopmentBlueprint } from "../policies/opening-routes";
import type { OpeningChoices } from "./game-state";
import { createInitialGameState } from "./initial-state";

const sampleChoices: OpeningChoices = {
  economicMechanism: "market",
  diplomaticStrategyId: "pro_soviet",
  foreignPolicyDoctrineId: "revolutionary_internationalism",
  developmentBlueprintId: "agriculture_first",
};

describe("开局路线选择", () => {
  it("未传 openingChoices 时保持校准默认初值", () => {
    const state = createInitialGameState(42, 1949, "automatic");
    expect(state.nation.openingChoices).toBeUndefined();
    expect(state.nation.policies).toEqual([]);
    expect(state.nation.diplomacy.strategyId).toBe("balanced");
    expect(state.nation.diplomacy.strategyAlignment).toBe(0);
    expect(state.nation.diplomacy.foreignPolicyDoctrineId).toBe("status_quo");
    expect(state.nation.economicCoordination.planningIntensity).toBeCloseTo(0.72);
    expect(state.nation.economicCoordination.domesticMarketFreedom).toBeCloseTo(0.22);
  });

  it("按预设写入经济机制、外交与满进度国策", () => {
    const state = createInitialGameState(42, 1949, "interactive", sampleChoices);
    const mechanism = getEconomicMechanismPreset("market");
    const strategy = getDiplomaticStrategy("pro_soviet");
    const blueprint = getOpeningDevelopmentBlueprint("agriculture_first");
    expect(strategy).toBeDefined();
    expect(blueprint).toBeDefined();

    expect(state.nation.openingChoices).toEqual(sampleChoices);
    expect(state.nation.economicCoordination.planningIntensity).toBe(
      mechanism.planningIntensity,
    );
    expect(state.nation.economicCoordination.planningTarget).toBe(
      mechanism.planningTarget,
    );
    expect(state.nation.economicCoordination.domesticMarketFreedom).toBe(
      mechanism.domesticMarketFreedom,
    );
    expect(state.nation.economicCoordination.landStance).toBe(mechanism.landStance);
    expect(state.nation.economicCoordination.enterpriseStance).toBe(
      mechanism.enterpriseStance,
    );
    expect(state.nation.economicCoordination.priceStance).toBe(mechanism.priceStance);

    expect(state.nation.diplomacy.strategyId).toBe("pro_soviet");
    expect(state.nation.diplomacy.strategyAlignment).toBe(strategy!.targetAlignment);
    expect(state.nation.diplomacy.lastStrategyChangeMonth).toBeNull();
    expect(state.nation.diplomacy.foreignPolicyDoctrineId).toBe(
      "revolutionary_internationalism",
    );
    expect(state.nation.diplomacy.foreignPolicyDoctrineProgress).toBe(1);
    expect(state.nation.diplomacy.lastForeignPolicyDoctrineChangeMonth).toBeNull();

    expect(state.nation.policies).toEqual(blueprint!.policyIds);
    for (const policyId of blueprint!.policyIds) {
      expect(state.nation.policyProgress[policyId]).toBe(1);
    }
  });

  it("计划经济预设写入高计划强度", () => {
    const state = createInitialGameState(7, 1949, "automatic", {
      ...sampleChoices,
      economicMechanism: "planned",
      developmentBlueprintId: "heavy_industry_priority",
    });
    const mechanism = getEconomicMechanismPreset("planned");
    expect(state.nation.economicCoordination.planningIntensity).toBe(
      mechanism.planningIntensity,
    );
    expect(state.nation.economicCoordination.enterpriseStance).toBe("soe_led");
    expect(state.nation.economicCoordination.priceStance).toBe("planned");
  });

  it("相同种子与开局选择结果完全一致", () => {
    const a = createInitialGameState(99, 1949, "interactive", sampleChoices);
    const b = createInitialGameState(99, 1949, "interactive", sampleChoices);
    expect(a).toEqual(b);
  });

  it("CREATE_GAME 命令可携带 openingChoices", () => {
    const engine = createSimulationEngine();
    const result = engine.dispatch({
      type: "CREATE_GAME",
      seed: 1949,
      startYear: 1949,
      historicalEventDecisionMode: "interactive",
      openingChoices: sampleChoices,
    });
    expect(result.state.nation.openingChoices).toEqual(sampleChoices);
    expect(result.state.nation.diplomacy.strategyId).toBe("pro_soviet");
  });
});
