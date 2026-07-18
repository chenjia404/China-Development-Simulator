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
  it("五项国策具有唯一事件映射和严格早于史实的开放年份", () => {
    expect(historicalInitiativeDefinitions).toHaveLength(5);
    expect(new Set(historicalInitiativeDefinitions.map((item) => item.id)).size).toBe(5);
    expect(new Set(historicalInitiativeDefinitions.map((item) => item.eventId)).size).toBe(5);
    expect(
      historicalInitiativeDefinitions.map((item) => item.availableFromYear),
    ).toEqual([1949, 1949, 1979, 1982, 1995]);
  });

  it("改革开放可按1949年初始状态立即发动", () => {
    const engine = createSimulationEngine(createInitialGameState(1949, 1949));
    expect(
      getHistoricalInitiativeStatus(engine.exportState(), "early_reform_and_opening")
        .available,
    ).toBe(true);
    const beforePoints = engine.getState().nation.diplomacy.diplomaticPoints;
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    const record = engine.getState().nation.history.historicalEvents[0];

    expect(record).toMatchObject({
      id: "reform_and_opening_1978",
      year: 1949,
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

  it("合资企业法在改革开放启动后可于1949年同月发动", () => {
    const engine = createSimulationEngine(createInitialGameState(1949, 1949));
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
    expect(
      getHistoricalInitiativeStatus(
        engine.exportState(),
        "early_joint_venture_law",
      ).available,
    ).toBe(true);
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_joint_venture_law",
    });

    expect(engine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "joint_venture_law_1979",
      year: 1949,
      scheduledYear: 1979,
      outcome: "enacted_early",
    });
  });

  it("多边贸易进程必须依次经历观察员、复关申请和正式加入世贸", () => {
    const preparationEngine = createSimulationEngine(prepareReformConditions(1970));
    preparationEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    const legalState = preparationEngine.exportState();
    legalState.nation.date.year = 1971;
    legalState.nation.date.month = 1;
    legalState.nation.date.elapsedMonths += 12;
    const legalEngine = createSimulationEngine(legalState);
    legalEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_joint_venture_law",
    });
    const observerState = legalEngine.exportState();
    observerState.nation.date.year = 1979;
    observerState.nation.date.month = 1;
    observerState.nation.date.elapsedMonths = (1979 - 1949) * 12;
    observerState.nation.economy.institutionalEfficiency = 0.5;
    observerState.nation.society.stabilityIndex = 60;
    observerState.nation.trade.openness = 0.22;
    observerState.nation.diplomacy.globalReputation = 60;
    observerState.nation.diplomacy.diplomaticPoints = 100;
    observerState.nation.internationalInfluence = 30;
    for (const country of observerState.world.countries) country.relationWithChina = -20;
    observerState.world.countries[0].tradeAgreement = true;

    const observerEngine = createSimulationEngine(observerState);
    expect(
      getHistoricalInitiativeStatus(observerEngine.exportState(), "early_gatt_observer")
        .blockers,
    ).toContain("需至少 3 个国家关系达到 10");
    const supportedObserverState = observerEngine.exportState();
    for (const country of supportedObserverState.world.countries) {
      country.relationWithChina = 15;
    }
    const supportedObserverEngine = createSimulationEngine(supportedObserverState);
    expect(
      getHistoricalInitiativeStatus(
        supportedObserverEngine.exportState(),
        "early_gatt_accession_application",
      ).blockers,
    ).toContain("需先完成取得关贸总协定观察员地位");
    supportedObserverEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_gatt_observer",
    });
    expect(supportedObserverEngine.getState().nation.diplomacy.organizationIds).not.toContain(
      "world_trade_organization",
    );

    const applicationState = supportedObserverEngine.exportState();
    applicationState.nation.date.year = 1982;
    applicationState.nation.date.month = 1;
    applicationState.nation.date.elapsedMonths = (1982 - 1949) * 12;
    applicationState.world.countries[1].tradeAgreement = true;
    const applicationEngine = createSimulationEngine(applicationState);
    applicationEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_gatt_accession_application",
    });
    expect(applicationEngine.getState().nation.diplomacy.organizationIds).not.toContain(
      "world_trade_organization",
    );

    const wtoState = applicationEngine.exportState();
    wtoState.nation.date.year = 1995;
    wtoState.nation.date.month = 1;
    wtoState.nation.date.elapsedMonths = (1995 - 1949) * 12;
    wtoState.nation.economy.institutionalEfficiency = 0.6;
    wtoState.nation.trade.openness = 0.45;
    wtoState.world.countries[2].tradeAgreement = true;
    for (const country of wtoState.world.countries) country.relationWithChina = 30;
    const wtoEngine = createSimulationEngine(wtoState);
    expect(
      getHistoricalInitiativeStatus(wtoEngine.exportState(), "early_wto_accession")
        .available,
    ).toBe(true);
    wtoEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_wto_accession",
    });

    expect(wtoEngine.getState().nation.history.historicalEvents.map((event) => event.id))
      .toEqual([
        "reform_and_opening_1978",
        "joint_venture_law_1979",
        "gatt_observer_1982",
        "gatt_accession_application_1986",
        "wto_accession_2001",
      ]);
    expect(wtoEngine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "wto_accession_2001",
      year: 1995,
      scheduledYear: 2001,
      outcome: "enacted_early",
    });
    expect(wtoEngine.getState().nation.diplomacy.organizationIds).toContain(
      "world_trade_organization",
    );
    expect(wtoEngine.getState().nation.diplomacy.diplomaticPoints).toBe(45);
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
