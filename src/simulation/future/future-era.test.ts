import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { evaluateModelIntegrity } from "../analysis/model-integrity";
import {
  futureDecisionDefinitions,
  resolveFutureDecision,
  updateFutureEra,
  validateFutureEraDefinitions,
} from "./future-era";

function createFutureState(
  year: number,
  mode: "automatic" | "interactive" = "interactive",
) {
  const state = createInitialGameState(2050, 1949, mode);
  state.nation.date = { year, month: 1, elapsedMonths: (year - 1949) * 12 };
  return state;
}

describe("2027—2050 未来时代", () => {
  it("六个未来节点都有三个互斥方案和有效默认项", () => {
    expect(() => validateFutureEraDefinitions()).not.toThrow();
    expect(futureDecisionDefinitions).toHaveLength(6);
    expect(new Set(futureDecisionDefinitions.map((item) => item.id)).size).toBe(6);
    for (const decision of futureDecisionDefinitions) {
      expect(decision.choices).toHaveLength(3);
      expect(new Set(decision.choices.map((choice) => choice.id)).size).toBe(3);
      expect(decision.choices.some((choice) => choice.id === decision.defaultChoiceId)).toBe(true);
      expect(decision.choices.every((choice) => choice.effects.length > 0)).toBe(true);
    }
  });

  it("交互模式在未来节点暂停，完成选择后才能继续", () => {
    const engine = createSimulationEngine(createFutureState(2028));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.date).toMatchObject({ year: 2028, month: 1 });
    expect(engine.getState().nation.futureEra.pendingDecisionId).toBe(
      "ai_social_contract_2028",
    );

    engine.dispatch({
      type: "RESOLVE_FUTURE_DECISION",
      decisionId: "ai_social_contract_2028",
      choiceId: "human_complement",
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.date).toMatchObject({ year: 2028, month: 2 });
    expect(engine.getState().nation.futureEra.decisions[0]?.choiceId).toBe(
      "human_complement",
    );
  });

  it("未来选择只调整中间库存并登记有期限的 modifier", () => {
    const state = createFutureState(2035);
    state.nation.futureEra.pendingDecisionId = "climate_resilience_2035";
    const gdpBefore = state.nation.economy.realGDP;
    const populationBefore = state.nation.population.total;
    resolveFutureDecision(
      state,
      "climate_resilience_2035",
      "integrated_adaptation",
    );
    expect(state.nation.futureEra.adaptationCapacity).toBeCloseTo(0.14);
    expect(state.nation.economy.realGDP).toBe(gdpBefore);
    expect(state.nation.population.total).toBe(populationBefore);
    expect(
      state.nation.modifiers.some((modifier) =>
        modifier.sourceId ===
          "future_decision:climate_resilience_2035:integrated_adaptation"
      ),
    ).toBe(true);
  });

  it("自动模式确定性采用默认方案且不会阻塞", () => {
    const first = createSimulationEngine(createFutureState(2028, "automatic"));
    const second = createSimulationEngine(createFutureState(2028, "automatic"));
    first.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    second.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(first.getState().nation.date).toMatchObject({ year: 2028, month: 2 });
    expect(first.getState().nation.futureEra.decisions[0]?.choiceId).toBe(
      "human_complement",
    );
    expect(first.getState().nation.futureEra).toEqual(
      second.getState().nation.futureEra,
    );
  });

  it("未来压力保持有限并形成有期限的动态传导", () => {
    const state = createFutureState(2050, "automatic");
    for (let month = 0; month < 24; month += 1) updateFutureEra(state);
    const futureValues = [
      state.nation.futureEra.climateRisk,
      state.nation.futureEra.ageingPressure,
      state.nation.futureEra.aiDiffusion,
      state.nation.futureEra.cleanEnergyTransition,
      state.nation.futureEra.adaptationCapacity,
      state.nation.futureEra.careCapacity,
    ];
    expect(futureValues.every((value) => Number.isFinite(value))).toBe(true);
    expect(futureValues.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(
      state.nation.modifiers.filter((modifier) =>
        modifier.sourceId.startsWith("future_pressure:")
      ),
    ).toHaveLength(5);
  });

  it("旧存档缺少未来状态时会确定性迁移", () => {
    const state = createFutureState(2027);
    delete (state.nation as Partial<typeof state.nation>).futureEra;
    const engine = createSimulationEngine(state);
    expect(engine.getState().nation.futureEra).toEqual({
      climateRisk: 0,
      ageingPressure: 0,
      aiDiffusion: 0,
      cleanEnergyTransition: 0,
      adaptationCapacity: 0,
      careCapacity: 0,
      pendingDecisionId: null,
      decisions: [],
    });
  });

  it("完整路线可确定性连续运行至 2050 年并通过账户审计", () => {
    const uninterrupted = createSimulationEngine(
      createInitialGameState(1949, 1949, "automatic"),
    );
    const resumedSource = createSimulationEngine(
      createInitialGameState(1949, 1949, "automatic"),
    );
    uninterrupted.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 1224 });
    resumedSource.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 936 });
    const resumed = createSimulationEngine(resumedSource.exportState());
    resumed.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 288 });

    const finalState = uninterrupted.exportState();
    expect(finalState.nation.date).toMatchObject({ year: 2051, month: 1 });
    expect(finalState.nation.futureEra.decisions).toHaveLength(6);
    expect(finalState.nation.futureEra).toEqual(
      resumed.getState().nation.futureEra,
    );
    expect(finalState.nation.economy).toEqual(resumed.getState().nation.economy);
    expect(finalState.nation.population).toEqual(
      resumed.getState().nation.population,
    );
    expect(evaluateModelIntegrity(finalState).status).toBe("通过");
    expect(finalState.nation.population.total).toBeGreaterThan(0);
    expect(Number.isFinite(finalState.nation.economy.realGDP)).toBe(true);
  });
});
