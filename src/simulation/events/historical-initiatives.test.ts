import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { checkHistoricalEvents } from "./historical-event-engine";
import {
  getHistoricalInitiative,
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
  it("十八项主动国策具有唯一事件映射，战争危机与组织资格不属于可选国策", () => {
    expect(historicalInitiativeDefinitions).toHaveLength(18);
    expect(new Set(historicalInitiativeDefinitions.map((item) => item.id)).size).toBe(18);
    expect(new Set(historicalInitiativeDefinitions.map((item) => item.eventId)).size).toBe(18);
    expect(getHistoricalInitiative("early_wto_accession")).toBeUndefined();
    expect(
      historicalInitiativeDefinitions.map((item) => item.eventId),
    ).not.toEqual(expect.arrayContaining([
      "korean_war_1950",
      "great_leap_forward_1958",
      "cultural_revolution_disruption_1966",
      "asian_financial_crisis_1997",
      "covid_19_2020",
      "un_seat_restored_1971",
      "wto_accession_2001",
    ]));
  });

  it("义务教育立法和证券交易所可提前成为永久历史转折", () => {
    const state = createInitialGameState(1949, 1949);
    state.nation.fiscal.budget.education = 0.12;
    state.nation.economy.institutionalEfficiency = 0.5;
    state.nation.institutions.stateCapacity = 0.5;
    state.nation.institutions.localImplementationCapacity = 0.5;
    state.nation.institutions.legalPredictability = 0.5;
    state.nation.society.stabilityIndex = 60;
    state.nation.education.index = 20;
    state.nation.technology.index = 15;
    state.nation.society.urbanizationRate = 0.15;
    state.nation.privateEconomy.operatingSpace = 0.6;
    const engine = createSimulationEngine(state);

    expect(getHistoricalInitiativeStatus(
      engine.exportState(),
      "early_compulsory_education_law",
    ).available).toBe(true);
    expect(getHistoricalInitiativeStatus(
      engine.exportState(),
      "early_securities_exchange",
    ).available).toBe(true);
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_compulsory_education_law",
    });
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_securities_exchange",
    });
    engine.dispatch({
      type: "SET_POLICIES",
      policyIds: ["compulsory_education_implementation"],
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 72 });

    const nation = engine.getState().nation;
    expect(nation.history.historicalEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "compulsory_education_law_1986",
        outcome: "enacted_early",
      }),
      expect.objectContaining({
        id: "securities_exchange_1990",
        outcome: "enacted_early",
      }),
    ]));
    expect(nation.financialSystem.capitalMarket.exchangeOperationalCapacity)
      .toBeGreaterThan(0);
    expect(nation.financialSystem.capitalMarket.equityMarketDepth)
      .toBeGreaterThan(0);
    expect(() => engine.dispatch({
      type: "SET_POLICIES",
      policyIds: ["securities_exchange"],
    })).toThrow("未知国策");
  });

  it("可提前废除农业税且史实年份不再重复触发", () => {
    const state = createInitialGameState(1949, 1949);
    state.nation.economy.institutionalEfficiency = 0.4;
    state.nation.institutions.stateCapacity = 0.35;
    state.nation.institutions.localImplementationCapacity = 0.3;
    state.nation.institutions.legalPredictability = 0.3;
    state.nation.society.stabilityIndex = 50;
    const engine = createSimulationEngine(state);

    expect(getHistoricalInitiativeStatus(
      engine.exportState(),
      "early_agricultural_tax_abolition",
    ).available).toBe(true);
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_agricultural_tax_abolition",
    });
    expect(engine.getState().nation.fiscal.agriculturalTaxAbolished).toBe(true);
    expect(engine.getState().nation.history.historicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "agricultural_tax_abolition_2006",
          outcome: "enacted_early",
        }),
      ]),
    );

    const advanced = engine.exportState();
    advanced.nation.date.year = 2006;
    advanced.nation.date.month = 1;
    advanced.nation.historicalEventDecisionMode = "automatic";
    const later = createSimulationEngine(advanced);
    later.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(
      later.getState().nation.history.historicalEvents.filter(
        (record) => record.id === "agricultural_tax_abolition_2006",
      ),
    ).toHaveLength(1);
  });

  it("财政统一、土地改革和五年计划可由玩家依次提前启动", () => {
    const engine = createSimulationEngine(createInitialGameState(1949, 1949));
    const beforePoints = engine.getState().nation.diplomacy.diplomaticPoints;

    expect(getHistoricalInitiativeStatus(
      engine.exportState(),
      "early_unified_finance",
    ).available).toBe(true);
    expect(getHistoricalInitiativeStatus(
      engine.exportState(),
      "early_land_reform",
    ).available).toBe(true);
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_unified_finance",
    });
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_land_reform",
    });

    expect(engine.getState().nation.diplomacy.diplomaticPoints).toBe(beforePoints);
    expect(getHistoricalInitiativeStatus(
      engine.exportState(),
      "early_first_five_year_plan",
    ).blockers).toContain("统一国家财政经济需实施满 6 个月（还需 6 个月）");

    const preparedState = engine.exportState();
    preparedState.nation.date.month = 7;
    preparedState.nation.date.elapsedMonths = 6;
    const preparedEngine = createSimulationEngine(preparedState);
    expect(getHistoricalInitiativeStatus(
      preparedEngine.exportState(),
      "early_first_five_year_plan",
    ).available).toBe(true);
    preparedEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_first_five_year_plan",
    });

    expect(preparedEngine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "first_five_year_plan",
      year: 1949,
      month: 7,
      outcome: "enacted_early",
    });
    const historicalDateState = preparedEngine.exportState();
    historicalDateState.nation.date.year = 1953;
    historicalDateState.nation.date.month = 1;
    expect(checkHistoricalEvents(historicalDateState.nation)).toEqual([]);
  });

  it("后续改革必须经过能力积累，达标后可沿改革链提前推进", () => {
    const engine = createSimulationEngine(prepareReformConditions(1950));
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_joint_venture_law",
    });
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_special_economic_zones",
    });

    const prematureState = engine.exportState();
    prematureState.nation.date.year = 1952;
    prematureState.nation.date.month = 1;
    prematureState.nation.date.elapsedMonths = 24;
    expect(getHistoricalInitiativeStatus(
      prematureState,
      "early_urban_economic_reform",
    ).blockers).toEqual(expect.arrayContaining([
      "制度效率需达到 42%",
      "教育指数需达到 18",
      "科技指数需达到 10",
      "城镇化率需达到 12%",
    ]));

    prematureState.nation.economy.institutionalEfficiency = 0.6;
    prematureState.nation.society.stabilityIndex = 60;
    prematureState.nation.trade.openness = 0.35;
    prematureState.nation.diplomacy.globalReputation = 60;
    prematureState.nation.internationalInfluence = 30;
    prematureState.nation.education.index = 50;
    prematureState.nation.technology.index = 45;
    prematureState.nation.society.urbanizationRate = 0.4;
    for (const country of prematureState.world.countries) {
      country.relationWithChina = 15;
    }
    prematureState.world.countries[0].tradeAgreement = true;
    const reformEngine = createSimulationEngine(prematureState);
    reformEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_urban_economic_reform",
    });

    const marketState = reformEngine.exportState();
    marketState.nation.date.year = 1956;
    marketState.nation.date.elapsedMonths = 72;
    const marketEngine = createSimulationEngine(marketState);
    marketEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_socialist_market_economy",
    });

    const fiscalState = marketEngine.exportState();
    fiscalState.nation.date.year = 1958;
    fiscalState.nation.date.elapsedMonths = 96;
    const fiscalEngine = createSimulationEngine(fiscalState);
    fiscalEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_tax_sharing_reform",
    });

    const supplyState = fiscalEngine.exportState();
    supplyState.nation.date.year = 1966;
    supplyState.nation.date.elapsedMonths = 192;
    supplyState.nation.sectors.secondary.output = 80_000_000_000;
    const supplyEngine = createSimulationEngine(supplyState);
    expect(getHistoricalInitiativeStatus(
      supplyEngine.exportState(),
      "early_supply_side_reform",
    ).available).toBe(true);
    supplyEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_supply_side_reform",
    });

    expect(supplyEngine.getState().nation.history.historicalEvents.map((event) => event.id))
      .toEqual(expect.arrayContaining([
        "urban_economic_reform_1984",
        "socialist_market_economy_1992",
        "tax_sharing_reform_1994",
        "supply_side_reform_2015",
      ]));
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

  it("经济特区在改革开放和合资企业法启动后可于1949年同月设立", () => {
    const engine = createSimulationEngine(createInitialGameState(1949, 1949));
    expect(
      getHistoricalInitiativeStatus(
        engine.exportState(),
        "early_special_economic_zones",
      ).blockers,
    ).toContain("需先完成改革开放启动");

    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    expect(
      getHistoricalInitiativeStatus(
        engine.exportState(),
        "early_special_economic_zones",
      ).blockers,
    ).toContain("需先完成中外合资经营企业法");
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_joint_venture_law",
    });
    expect(
      getHistoricalInitiativeStatus(
        engine.exportState(),
        "early_special_economic_zones",
      ).available,
    ).toBe(true);
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_special_economic_zones",
    });

    expect(engine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "special_economic_zones_1980",
      year: 1949,
      month: 1,
      scheduledYear: 1980,
      outcome: "enacted_early",
    });
    expect(
      engine.getState().nation.modifiers.some(
        (modifier) => modifier.sourceId === "special_economic_zones_1980",
      ),
    ).toBe(true);
  });

  it("私营经济法律承认无需外交点，但需要改革和现实民营经济基础", () => {
    const engine = createSimulationEngine(createInitialGameState(1949, 1949));
    expect(
      getHistoricalInitiativeStatus(
        engine.exportState(),
        "early_private_economy_legal_recognition",
      ).blockers,
    ).toContain("需先完成改革开放启动");

    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_reform_and_opening",
    });
    const constrainedState = engine.exportState();
    constrainedState.nation.privateEconomy.operatingSpace = 0.12;
    constrainedState.nation.privateEconomy.entrepreneurialCapacity = 0.1;
    expect(
      getHistoricalInitiativeStatus(
        constrainedState,
        "early_private_economy_legal_recognition",
      ).blockers,
    ).toEqual(expect.arrayContaining([
      "民营经营空间需达到 20%",
      "企业家组织能力需达到 18%",
    ]));

    const beforePoints = engine.getState().nation.diplomacy.diplomaticPoints;
    expect(
      getHistoricalInitiativeStatus(
        engine.exportState(),
        "early_private_economy_legal_recognition",
      ).available,
    ).toBe(true);
    engine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_private_economy_legal_recognition",
    });

    expect(engine.getState().nation.diplomacy.diplomaticPoints).toBe(beforePoints);
    expect(engine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "private_economy_legal_recognition_1988",
      year: 1949,
      month: 1,
      scheduledYear: 1988,
      outcome: "enacted_early",
    });
    expect(
      engine.getState().nation.modifiers.some(
        (modifier) =>
          modifier.sourceId === "private_economy_legal_recognition_1988" &&
          modifier.target === "privateEconomy.operatingSpaceChange",
      ),
    ).toBe(true);

    const historicalDateState = engine.exportState();
    historicalDateState.nation.date.year = 1988;
    historicalDateState.nation.date.month = 4;
    expect(checkHistoricalEvents(historicalDateState.nation)).toEqual([]);
  });

  it("多边贸易主动国策只推进观察员和复关申请，不直接授予世贸成员资格", () => {
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
    legalEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_special_economic_zones",
    });
    const observerState = legalEngine.exportState();
    observerState.nation.date.year = 1972;
    observerState.nation.date.month = 1;
    observerState.nation.date.elapsedMonths = (1972 - 1949) * 12;
    observerState.nation.economy.institutionalEfficiency = 0.5;
    observerState.nation.institutions.stateCapacity = 0.5;
    observerState.nation.institutions.localImplementationCapacity = 0.5;
    observerState.nation.institutions.legalPredictability = 0.5;
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
    expect(
      getHistoricalInitiativeStatus(observerEngine.exportState(), "early_gatt_observer")
        .blockers.some((blocker) => blocker.includes("最早可在")),
    ).toBe(false);
    expect(getHistoricalInitiative("early_gatt_observer")?.availableFromYear)
      .toBeUndefined();
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
    applicationState.nation.date.year = 1973;
    applicationState.nation.date.month = 1;
    applicationState.nation.date.elapsedMonths = (1973 - 1949) * 12;
    applicationState.world.countries[1].tradeAgreement = true;
    const applicationEngine = createSimulationEngine(applicationState);
    const applicationStatus = getHistoricalInitiativeStatus(
      applicationEngine.exportState(),
      "early_gatt_accession_application",
    );
    expect(applicationStatus.blockers.some((blocker) => blocker.includes("最早可在")))
      .toBe(false);
    expect(getHistoricalInitiative("early_gatt_accession_application")?.availableFromYear)
      .toBeUndefined();
    applicationEngine.dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId: "early_gatt_accession_application",
    });
    expect(applicationEngine.getState().nation.diplomacy.organizationIds).not.toContain(
      "world_trade_organization",
    );

    expect(applicationEngine.getState().nation.history.historicalEvents.map((event) => event.id))
      .toEqual([
        "reform_and_opening_1978",
        "joint_venture_law_1979",
        "special_economic_zones_1980",
        "gatt_observer_1982",
        "gatt_accession_application_1986",
      ]);
    expect(applicationEngine.getState().nation.diplomacy.organizationIds).not.toContain(
      "world_trade_organization",
    );
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
