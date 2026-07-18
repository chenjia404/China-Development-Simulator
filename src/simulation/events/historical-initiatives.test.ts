import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { checkHistoricalEvents } from "./historical-event-engine";
import {
  getHistoricalInitiativeStatus,
  historicalInitiativeDefinitions,
} from "./historical-initiatives";

function prepareReformConditions(year: number) {
  const state = createInitialGameState(1949, year);
  state.nation.economy.institutionalEfficiency = 0.4;
  state.nation.society.stabilityIndex = 55;
  state.nation.trade.openness = 0.1;
  state.nation.diplomacy.globalReputation = 48;
  return state;
}

describe("历史转折国策", () => {
  it("三项国策具有唯一事件映射和严格早于史实的开放年份", () => {
    expect(historicalInitiativeDefinitions).toHaveLength(3);
    expect(new Set(historicalInitiativeDefinitions.map((item) => item.id)).size).toBe(3);
    expect(new Set(historicalInitiativeDefinitions.map((item) => item.eventId)).size).toBe(3);
    expect(
      historicalInitiativeDefinitions.map((item) => item.availableFromYear),
    ).toEqual([1965, 1966, 1986]);
  });

  it("改革开放只能在达到年份和治理门槛后提前发动", () => {
    const tooEarly = prepareReformConditions(1964);
    expect(
      getHistoricalInitiativeStatus(tooEarly, "early_reform_and_opening").blockers,
    ).toContain("最早可在 1965 年发动");

    const engine = createSimulationEngine(prepareReformConditions(1965));
    const beforePoints = engine.getState().nation.diplomacy.diplomaticPoints;
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    const record = engine.getState().nation.history.historicalEvents[0];

    expect(record).toMatchObject({
      id: "reform_and_opening_1978",
      year: 1965,
      month: 1,
      scheduledYear: 1978,
      scheduledMonth: 12,
      outcome: "enacted_early",
      choiceId: "initiative:early_reform_and_opening",
    });
    expect(engine.getState().nation.diplomacy.diplomaticPoints).toBe(beforePoints - 8);
    expect(
      engine.getState().nation.modifiers.some(
        (modifier) => modifier.sourceId === "reform_and_opening_1978",
      ),
    ).toBe(true);
  });

  it("合资企业法必须以已经启动的改革开放为前提", () => {
    const engine = createSimulationEngine(prepareReformConditions(1970));
    expect(
      getHistoricalInitiativeStatus(
        engine.exportState(),
        "early_joint_venture_law",
      ).blockers,
    ).toContain("需先完成改革开放启动");

    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_joint_venture_law",
    });

    expect(engine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "joint_venture_law_1979",
      year: 1970,
      scheduledYear: 1979,
      outcome: "enacted_early",
    });
  });

  it("提前加入世贸需要国内改革、开放条件和真实外交基础", () => {
    const preparationEngine = createSimulationEngine(prepareReformConditions(1970));
    preparationEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    preparationEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_joint_venture_law",
    });
    const state = preparationEngine.exportState();
    state.nation.date.year = 1986;
    state.nation.date.month = 1;
    state.nation.date.elapsedMonths = (1986 - 1949) * 12;
    state.nation.economy.institutionalEfficiency = 0.55;
    state.nation.society.stabilityIndex = 60;
    state.nation.trade.openness = 0.3;
    state.nation.diplomacy.globalReputation = 60;
    state.nation.diplomacy.diplomaticPoints = 100;
    state.nation.internationalInfluence = 25;
    for (const country of state.world.countries) country.relationWithChina = 10;
    state.world.countries[0].tradeAgreement = true;
    state.world.countries[1].tradeAgreement = true;

    const engine = createSimulationEngine(state);
    const status = getHistoricalInitiativeStatus(
      engine.exportState(),
      "early_wto_accession",
    );
    expect(status.available).toBe(true);
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_wto_accession",
    });

    expect(engine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "wto_accession_2001",
      year: 1986,
      scheduledYear: 2001,
      outcome: "enacted_early",
    });
    expect(engine.getState().nation.diplomacy.organizationIds).toContain(
      "world_trade_organization",
    );
    expect(engine.getState().nation.diplomacy.diplomaticPoints).toBe(75);
  });

  it("提前实施后史实月份不会重复触发同一事件", () => {
    const engine = createSimulationEngine(prepareReformConditions(1970));
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    const state = engine.exportState();
    state.nation.date.year = 1978;
    state.nation.date.month = 12;

    expect(checkHistoricalEvents(state.nation)).toEqual([]);
    expect(
      state.nation.history.historicalEvents.filter(
        (record) => record.id === "reform_and_opening_1978",
      ),
    ).toHaveLength(1);
  });
});
