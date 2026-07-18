import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  getSinoUSNormalizationStatus,
  sinoUSNormalizationEffects,
} from "./sino-us-normalization";

function prepareNegotiationState(year: number, mode: "automatic" | "interactive") {
  const state = createInitialGameState(1949, year, mode);
  state.nation.diplomacy.diplomaticPoints = 100;
  state.nation.diplomacy.globalReputation = 60;
  state.nation.society.stabilityIndex = 60;
  state.nation.economy.institutionalEfficiency = 0.55;
  const usa = state.world.countries.find((country) => country.id === "usa");
  if (!usa) throw new Error("测试世界缺少美国");
  usa.relationWithChina = 50;
  return state;
}

describe("中美建交外交国策", () => {
  it("需要对美关系、国家能力和外交点，关系越好谈判时间越短", () => {
    const blocked = createInitialGameState(1949, 1950, "interactive");
    expect(getSinoUSNormalizationStatus(blocked).blockers).toContain(
      "对美关系需达到 10",
    );

    const prepared = prepareNegotiationState(1950, "interactive");
    const status = getSinoUSNormalizationStatus(prepared);
    expect(status.available).toBe(true);
    expect(status.estimatedNegotiationMonths).toBe(14);
    const engine = createSimulationEngine(prepared);
    engine.dispatch({ type: "START_SINO_US_NORMALIZATION" });
    expect(engine.getState().nation.diplomacy).toMatchObject({
      diplomaticPoints: 80,
      sinoUSNormalizationStatus: "negotiating",
      sinoUSNormalizationNegotiationMonths: 14,
    });
  });

  it("自动史实路线在1979年1月建交，作为经济倍率的中性校准基线", () => {
    const engine = createSimulationEngine(
      createInitialGameState(1949, 1979, "automatic"),
    );
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    const state = engine.exportState();
    const effects = sinoUSNormalizationEffects(state.nation);

    expect(state.nation.diplomacy).toMatchObject({
      sinoUSNormalizationStatus: "established",
      sinoUSNormalizationEstablishedYear: 1979,
      sinoUSNormalizationEstablishedMonth: 1,
      sinoUSNormalizationDelayMonths: 0,
    });
    expect(effects.relativeTimingAdvantage).toBeCloseTo(-1 / 60, 8);
    expect(effects.marketAccessMultiplier).toBeGreaterThan(0.999);
    expect(state.nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "sino_us_normalization_1979",
      year: 1979,
      month: 1,
      outcome: "occurred",
    });
  });

  it("提前建交更早积累教育、科技、出口和对美关系，同时降低对苏关系目标", () => {
    const earlyEngine = createSimulationEngine(
      prepareNegotiationState(1970, "automatic"),
    );
    earlyEngine.dispatch({ type: "START_SINO_US_NORMALIZATION" });
    const delayedEngine = createSimulationEngine(
      prepareNegotiationState(1970, "automatic"),
    );

    earlyEngine.dispatch({ type: "ADVANCE_MONTHS", months: 96 });
    delayedEngine.dispatch({ type: "ADVANCE_MONTHS", months: 96 });
    const early = earlyEngine.getState();
    const delayed = delayedEngine.getState();
    const relation = (state: typeof early, countryId: string) =>
      state.world.countries.find((country) => country.id === countryId)
        ?.relationWithChina ?? -100;

    expect(early.nation.diplomacy.sinoUSNormalizationEstablishedYear).toBe(1971);
    expect(early.nation.education.researchTalent).toBeGreaterThan(
      delayed.nation.education.researchTalent,
    );
    expect(early.nation.technology.index).toBeGreaterThan(delayed.nation.technology.index);
    expect(early.nation.trade.exports).toBeGreaterThan(delayed.nation.trade.exports);
    expect(relation(early, "usa")).toBeGreaterThan(relation(delayed, "usa"));
    expect(relation(early, "russia")).toBeLessThan(relation(delayed, "russia"));
  });

  it("1979年后延迟建交会持续记录错失月份并压低合作渠道", () => {
    const delayedState = prepareNegotiationState(1985, "interactive");
    const effects = sinoUSNormalizationEffects(delayedState.nation);
    const engine = createSimulationEngine(delayedState);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });

    expect(engine.getState().nation.diplomacy.sinoUSNormalizationDelayMonths)
      .toBeGreaterThan(72);
    expect(effects.relativeTimingAdvantage).toBe(-1);
    expect(effects.technologyDiffusionMultiplier).toBeLessThan(1);
    expect(effects.educationExchangeMultiplier).toBeLessThan(1);
    expect(effects.marketAccessMultiplier).toBeLessThan(1);
  });

  it("延后完成会记录延后实施，建交一年后自动形成对美贸易协定", () => {
    const engine = createSimulationEngine(
      prepareNegotiationState(1985, "interactive"),
    );
    engine.dispatch({ type: "START_SINO_US_NORMALIZATION" });
    engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 30 });
    const state = engine.getState();
    const usa = state.world.countries.find((country) => country.id === "usa");

    expect(state.nation.diplomacy.sinoUSNormalizationStatus).toBe("established");
    expect(state.nation.diplomacy.sinoUSNormalizationDelayMonths).toBeGreaterThan(72);
    expect(usa?.tradeAgreement).toBe(true);
    expect(state.nation.history.historicalEvents.find(
      (record) => record.id === "sino_us_normalization_1979",
    )).toMatchObject({
      id: "sino_us_normalization_1979",
      outcome: "enacted_late",
    });
  });

  it("旧自动存档确定性重建史实建交状态，交互存档保留玩家决策空间", () => {
    const automatic = createInitialGameState(1949, 1990, "automatic");
    const interactive = createInitialGameState(1949, 1990, "interactive");
    for (const state of [automatic, interactive]) {
      const diplomacy = state.nation.diplomacy as unknown as Record<string, unknown>;
      for (const key of Object.keys(diplomacy).filter((item) => item.startsWith("sinoUS"))) {
        Reflect.deleteProperty(diplomacy, key);
      }
    }

    const automaticEngine = createSimulationEngine(automatic);
    const interactiveEngine = createSimulationEngine(interactive);
    expect(automaticEngine.getState().nation.diplomacy.sinoUSNormalizationStatus)
      .toBe("established");
    expect(interactiveEngine.getState().nation.diplomacy.sinoUSNormalizationStatus)
      .toBe("not_started");
    expect(interactiveEngine.getState().nation.diplomacy.sinoUSNormalizationDelayMonths)
      .toBeGreaterThan(120);
  });
});
