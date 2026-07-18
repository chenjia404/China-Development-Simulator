import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { applyModifiers } from "./modifiers";
import { createInitialGameState } from "../state/initial-state";
import {
  checkHistoricalEvents,
  getHistoricalEventChoices,
  historicalEventDefinitions,
} from "./historical-event-engine";

describe("确定性历史事件", () => {
  it("事件目录具有唯一编号、有效日期和详细影响说明", () => {
    const ids = historicalEventDefinitions.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(historicalEventDefinitions.length).toBeGreaterThanOrEqual(25);
    for (const event of historicalEventDefinitions) {
      expect(event.year).toBeGreaterThanOrEqual(1949);
      expect(event.month).toBeGreaterThanOrEqual(1);
      expect(event.month).toBeLessThanOrEqual(12);
      expect(event.description.length).toBeGreaterThan(30);
      expect(event.effects.length).toBeGreaterThanOrEqual(2);
      expect(event.durationMonths).toBeGreaterThan(0);
    }
  });

  it("区分没收官僚资本与清理在华外资企业", () => {
    const state = createInitialGameState(1950, 1950);
    state.nation.date.month = 12;
    const triggered = checkHistoricalEvents(state.nation);

    expect(triggered.map((event) => event.id)).toContain(
      "foreign_assets_reorganization",
    );
    expect(triggered[0].description).toContain("合法经营外资");
    expect(triggered[0].description).toContain("对价转让");
    expect(
      applyModifiers(state.nation, "trade.foreignInvestment", 100),
    ).toBe(30);
  });

  it("全行业公私合营在指定月份触发且只触发一次", () => {
    const state = createInitialGameState(1956, 1956);
    const first = checkHistoricalEvents(state.nation);
    const second = checkHistoricalEvents(state.nation);

    expect(first.map((event) => event.name)).toContain("全行业公私合营");
    expect(second).toEqual([]);
    expect(state.nation.history.historicalEvents).toHaveLength(1);
    expect(applyModifiers(state.nation, "sector.secondary.output", 100)).toBeCloseTo(
      102.5,
    );
    expect(applyModifiers(state.nation, "capital.privateInvestment", 100)).toBe(
      94,
    );
  });

  it("历史事件进入年度报告并保留详细记录", () => {
    const engine = createSimulationEngine(createInitialGameState(1956, 1956));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    const state = engine.getState();

    expect(state.nation.history.reports[0].majorEvents).toContain(
      "全行业公私合营",
    );
    expect(state.nation.history.historicalEvents[0]).toMatchObject({
      id: "industry_wide_joint_ownership_1956",
      year: 1956,
      month: 1,
      category: "经济制度",
      choiceId: "historical_path",
      choiceName: "遵循历史路径",
    });
  });

  it("交互模式在事件月份暂停，决策后才结算当月", () => {
    const state = createInitialGameState(1956, 1956, "interactive");
    const engine = createSimulationEngine(state);

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    expect(engine.getState().nation.date).toMatchObject({ year: 1956, month: 1 });
    expect(engine.getState().nation.pendingHistoricalEventId).toBe(
      "industry_wide_joint_ownership_1956",
    );
    expect(engine.getState().nation.history.monthly).toHaveLength(0);

    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "industry_wide_joint_ownership_1956",
      choiceId: "preserve_mixed_ownership",
    });
    expect(engine.getState().nation.pendingHistoricalEventId).toBeNull();
    expect(engine.getState().nation.history.historicalEvents[0]).toMatchObject({
      choiceId: "preserve_mixed_ownership",
      choiceName: "保留混合所有制",
      durationMonths: 60,
    });
    expect(
      applyModifiers(
        engine.getState().nation,
        "capital.privateInvestment",
        100,
      ),
    ).toBeCloseTo(102.5);

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.date).toMatchObject({ year: 1956, month: 2 });
    expect(engine.getState().nation.history.monthly).toHaveLength(1);
  });

  it("关键事件提供有实际差异的专属决策", () => {
    const foreignChoices = getHistoricalEventChoices(
      "foreign_assets_reorganization",
    );
    const jointChoices = getHistoricalEventChoices(
      "industry_wide_joint_ownership_1956",
    );

    expect(foreignChoices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "compensated_transition",
      "regulated_foreign_business",
    ]);
    expect(
      foreignChoices.find((choice) => choice.id === "compensated_transition")
        ?.modifiers,
    ).toContainEqual({
      target: "fiscal.spending",
      operation: "multiply",
      value: 1.015,
    });
    expect(jointChoices.map((choice) => choice.id)).toContain(
      "preserve_mixed_ownership",
    );
    expect(
      jointChoices.find((choice) => choice.id === "historical_path")
        ?.durationMonths,
    ).toBe(48);
    expect(
      jointChoices.find((choice) => choice.id === "gradual_state_capitalism")
        ?.durationMonths,
    ).toBe(72);
  });

  it("朝鲜战争可被阻止，参战路线会产生人口、财政、产业和外交影响", () => {
    const choices = getHistoricalEventChoices("korean_war_1950");
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "oppose_korean_war",
      "limited_defense_and_mediation",
    ]);

    const runChoice = (choiceId: string) => {
      const state = createInitialGameState(1950, 1950, "interactive");
      state.nation.date.month = 6;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      expect(engine.getState().nation.pendingHistoricalEventId).toBe(
        "land_reform_1950",
      );
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "land_reform_1950",
        choiceId: "historical_path",
      });
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      expect(engine.getState().nation.pendingHistoricalEventId).toBe(
        "korean_war_1950",
      );
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "korean_war_1950",
        choiceId,
      });
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      return engine.getState();
    };

    const war = runChoice("historical_path");
    const prevented = runChoice("oppose_korean_war");
    const preventedChoice = choices.find(
      (choice) => choice.id === "oppose_korean_war",
    );
    const westernRelationTargets = [
      "diplomacy.relationTarget.usa",
      "diplomacy.relationTarget.united_kingdom",
      "diplomacy.relationTarget.france",
      "diplomacy.relationTarget.canada",
      "diplomacy.relationTarget.australia",
      "diplomacy.relationTarget.japan",
    ];
    expect(
      preventedChoice?.modifiers
        .filter((modifier) => westernRelationTargets.includes(modifier.target))
        .map((modifier) => modifier.target),
    ).toEqual(westernRelationTargets);
    expect(
      preventedChoice?.modifiers.find(
        (modifier) =>
          modifier.target === "diplomacy.relationTarget.south_korea",
      ),
    ).toMatchObject({ value: 60, durationMonths: 120 });
    const warRecord = war.nation.history.historicalEvents.find(
      (event) => event.id === "korean_war_1950",
    );
    const preventedRecord = prevented.nation.history.historicalEvents.find(
      (event) => event.id === "korean_war_1950",
    );
    expect(warRecord?.outcome).toBe("occurred");
    expect(preventedRecord).toMatchObject({
      choiceId: "oppose_korean_war",
      outcome: "prevented",
    });
    expect(war.nation.population.monthlyDeaths).toBeGreaterThan(
      prevented.nation.population.monthlyDeaths,
    );
    expect(war.nation.fiscal.expenditure).toBeGreaterThan(
      prevented.nation.fiscal.expenditure,
    );
    expect(war.nation.sectors.secondary.output).toBeGreaterThan(
      prevented.nation.sectors.secondary.output,
    );
    expect(
      war.world.countries.find((country) => country.id === "usa")
        ?.relationWithChina,
    ).toBeLessThan(
      prevented.world.countries.find((country) => country.id === "usa")
        ?.relationWithChina ?? Number.NEGATIVE_INFINITY,
    );
    expect(
      war.world.countries.find((country) => country.id === "russia")
        ?.relationWithChina,
    ).toBeGreaterThan(
      prevented.world.countries.find((country) => country.id === "russia")
        ?.relationWithChina ?? Number.POSITIVE_INFINITY,
    );
    const warSouthKoreaRelation = war.world.countries.find(
      (country) => country.id === "south_korea",
    )?.relationWithChina;
    const preventedSouthKoreaRelation = prevented.world.countries.find(
      (country) => country.id === "south_korea",
    )?.relationWithChina;
    expect(warSouthKoreaRelation).toBeLessThan(-30);
    expect(preventedSouthKoreaRelation).toBeGreaterThan(-30);
    expect(preventedSouthKoreaRelation).toBeGreaterThan(
      warSouthKoreaRelation ?? Number.POSITIVE_INFINITY,
    );
    for (const countryId of [
      "united_kingdom",
      "france",
      "canada",
      "australia",
      "japan",
    ]) {
      const warRelation = war.world.countries.find(
        (country) => country.id === countryId,
      )?.relationWithChina;
      const preventedRelation = prevented.world.countries.find(
        (country) => country.id === countryId,
      )?.relationWithChina;
      expect(preventedRelation).toBeGreaterThan(
        warRelation ?? Number.POSITIVE_INFINITY,
      );
    }
  });

  it("三线建设可选，史实、集中建设和取消路线形成完整收益代价", () => {
    const choices = getHistoricalEventChoices("third_front_construction_1964");
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "focused_third_front",
      "cancel_third_front",
    ]);
    expect(choices[0]?.durationMonths).toBe(192);
    expect(choices[1]?.durationMonths).toBe(144);
    expect(choices[2]?.outcome).toBe("prevented");
    expect(
      choices[0]?.modifiers.find(
        (modifier) => modifier.target === "sector.secondary.output",
      )?.durationMonths,
    ).toBe(72);

    const runChoice = (choiceId: string) => {
      const state = createInitialGameState(1964, 1964, "interactive");
      state.nation.date.month = 5;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      expect(engine.getState().nation.pendingHistoricalEventId).toBe(
        "third_front_construction_1964",
      );
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "third_front_construction_1964",
        choiceId,
      });
      engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
      return engine.getState();
    };

    const historical = runChoice("historical_path");
    const focused = runChoice("focused_third_front");
    const canceled = runChoice("cancel_third_front");
    expect(canceled.nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "third_front_construction_1964",
      choiceId: "cancel_third_front",
      outcome: "prevented",
    });
    expect(
      historical.nation.modifiers.find(
        (modifier) => modifier.target === "sector.secondary.output",
      )?.remainingMonths,
    ).toBe(60);
    expect(
      historical.nation.modifiers.find(
        (modifier) => modifier.target === "diplomacy.securityTarget",
      )?.remainingMonths,
    ).toBe(180);
    expect(historical.nation.diplomacy.securityIndex).toBeGreaterThan(
      focused.nation.diplomacy.securityIndex,
    );
    expect(focused.nation.diplomacy.securityIndex).toBeGreaterThan(
      canceled.nation.diplomacy.securityIndex,
    );
    expect(historical.nation.economy.infrastructureIndex).toBeGreaterThan(
      canceled.nation.economy.infrastructureIndex,
    );
    expect(
      historical.nation.fiscal.expenditure /
        historical.nation.economy.nominalGDP,
    ).toBeGreaterThan(
      canceled.nation.fiscal.expenditure /
        canceled.nation.economy.nominalGDP,
    );
    expect(historical.nation.sectors.tertiary.output).toBeLessThan(
      canceled.nation.sectors.tertiary.output,
    );
    expect(historical.nation.society.urbanizationRate).toBeGreaterThan(
      canceled.nation.society.urbanizationRate,
    );
    expect(historical.nation.economy.institutionalEfficiency).toBeLessThan(
      canceled.nation.economy.institutionalEfficiency,
    );
  });

  it("所有历史事件都有三个会改变数值传导的方案", () => {
    for (const event of historicalEventDefinitions) {
      const choices = getHistoricalEventChoices(event);
      expect(choices).toHaveLength(3);
      expect(new Set(choices.map((choice) => choice.id)).size).toBe(3);
      expect(choices[0].isHistoricalPath).toBe(true);
      expect(choices[1].modifiers).not.toEqual(choices[0].modifiers);
    }
  });

  it("切换为自动模式会按历史方案解决当前待决策事件", () => {
    const engine = createSimulationEngine(
      createInitialGameState(1956, 1956, "interactive"),
    );
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });

    expect(engine.getState().nation.pendingHistoricalEventId).toBeNull();
    expect(engine.getState().nation.history.historicalEvents[0].choiceId).toBe(
      "historical_path",
    );
  });

  it("可以阻止大跃进，且不会施加大跃进修正", () => {
    const state = createInitialGameState(1958, 1958, "interactive");
    state.nation.date.month = 5;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "great_leap_forward_1958",
      choiceId: "avoid_great_leap",
    });

    expect(engine.getState().nation.history.historicalEvents[0]).toMatchObject({
      id: "great_leap_forward_1958",
      choiceId: "avoid_great_leap",
      outcome: "prevented",
      durationMonths: 252,
    });
    expect(
      applyModifiers(
        engine.getState().nation,
        "sector.primary.output",
        100,
      ),
    ).toBeCloseTo(120);
    expect(
      applyModifiers(
        engine.getState().nation,
        "economy.structuralProductivityGrowth",
        0,
      ),
    ).toBeCloseTo(0.00045);
  });

  it("避免大跃进和人民公社化会显著减轻三年经济困难", () => {
    const state = createInitialGameState(1958, 1958, "interactive");
    state.nation.date.month = 5;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "great_leap_forward_1958",
      choiceId: "avoid_great_leap",
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 4 });
    expect(engine.getState().nation.pendingHistoricalEventId).toBe(
      "peoples_communes_1958",
    );
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "peoples_communes_1958",
      choiceId: "avoid_communes",
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 5 });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });

    const choices = getHistoricalEventChoices(
      "three_year_difficulties_1959",
      engine.getState().nation,
    );
    const historicalPath = choices[0];
    expect(engine.getState().nation.pendingHistoricalEventId).toBe(
      "three_year_difficulties_1959",
    );
    expect(historicalPath.durationMonths).toBe(24);
    expect(historicalPath.effects).toContain(
      "未发动大跃进，政策性资源错配与农业冲击明显减轻",
    );
    expect(
      historicalPath.modifiers.find(
        (modifier) => modifier.target === "resources.foodSupply",
      )?.value,
    ).toBeCloseTo(0.9688, 6);
  });

  it("三年经济困难可接受外国援助并减少死亡与经济冲击", () => {
    const choices = getHistoricalEventChoices("three_year_difficulties_1959");
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "accept_foreign_aid",
      "domestic_emergency_relief",
    ]);
    const aidChoice = choices.find(
      (choice) => choice.id === "accept_foreign_aid",
    );
    expect(aidChoice).toMatchObject({
      name: "接受外国粮食与医疗援助",
      durationMonths: 24,
    });
    expect(
      aidChoice?.modifiers.find(
        (modifier) => modifier.target === "population.deathRate",
      )?.value,
    ).toBe(1.006);
    expect(
      aidChoice?.modifiers
        .filter((modifier) => modifier.target.startsWith("diplomacy.relationTarget."))
        .map((modifier) => modifier.target),
    ).toEqual([
      "diplomacy.relationTarget.russia",
      "diplomacy.relationTarget.canada",
      "diplomacy.relationTarget.australia",
      "diplomacy.relationTarget.usa",
    ]);

    const runChoice = (choiceId: string) => {
      const engine = createSimulationEngine(
        createInitialGameState(1959, 1959, "interactive"),
      );
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "three_year_difficulties_1959",
        choiceId,
      });
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      return engine.getState();
    };
    const historical = runChoice("historical_path");
    const aided = runChoice("accept_foreign_aid");
    const relation = (state: typeof aided, countryId: string) =>
      state.world.countries.find((country) => country.id === countryId)
        ?.relationWithChina ?? Number.NaN;

    expect(aided.nation.population.monthlyDeaths).toBeLessThan(
      historical.nation.population.monthlyDeaths,
    );
    expect(aided.nation.resources.foodSupplyRatio).toBeGreaterThan(
      historical.nation.resources.foodSupplyRatio,
    );
    expect(aided.nation.economy.realGDP).toBeGreaterThan(
      historical.nation.economy.realGDP,
    );
    for (const providerId of ["russia", "canada", "australia", "usa"]) {
      expect(relation(aided, providerId)).toBeGreaterThan(
        relation(historical, providerId),
      );
    }
    expect(relation(aided, "japan")).toBeCloseTo(relation(historical, "japan"));
  });

  it("不发动文革会长期保护教育、科研、制度和投资传导", () => {
    const choices = getHistoricalEventChoices(
      "cultural_revolution_disruption_1966",
    );
    const historicalPath = choices[0];
    const protectedInstitutions = choices.find(
      (choice) => choice.id === "protect_institutions",
    );
    expect(
      historicalPath?.modifiers.some(
        (modifier) =>
          modifier.target === "sector.secondary.output" &&
          modifier.delayMonths === 8 &&
          modifier.durationMonths === 36,
      ),
    ).toBe(true);
    expect(
      historicalPath?.modifiers.some(
        (modifier) =>
          modifier.target === "sector.secondary.output" &&
          modifier.delayMonths === 116 &&
          modifier.durationMonths === 12,
      ),
    ).toBe(true);
    expect(protectedInstitutions).toMatchObject({
      durationMonths: 144,
      outcome: "prevented",
    });
    expect(
      protectedInstitutions?.modifiers.find(
        (modifier) => modifier.target === "education.efficiency",
      )?.value,
    ).toBe(1.25);
    expect(
      protectedInstitutions?.modifiers.some(
        (modifier) => modifier.target === "capital.investmentEfficiency",
      ),
    ).toBe(true);
    expect(
      protectedInstitutions?.modifiers.find(
        (modifier) =>
          modifier.target === "economy.structuralProductivityGrowth",
      )?.value,
    ).toBe(0.00065);

    const runChoice = (choiceId: string, months = 12) => {
      const state = createInitialGameState(1966, 1966, "interactive");
      state.nation.date.month = 5;
      state.nation.date.elapsedMonths = (1966 - 1949) * 12 + 4;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "cultural_revolution_disruption_1966",
        choiceId,
      });
      engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
      engine.dispatch({ type: "ADVANCE_MONTHS", months });
      return engine.getState().nation;
    };
    const historical = runChoice("historical_path");
    const protectedRoute = runChoice("protect_institutions");

    expect(
      applyModifiers(protectedRoute, "education.efficiency", 1),
    ).toBeGreaterThan(
      applyModifiers(historical, "education.efficiency", 1),
    );
    expect(protectedRoute.technology.index).toBeGreaterThan(
      historical.technology.index,
    );
    expect(protectedRoute.economy.institutionalEfficiency).toBeGreaterThan(
      historical.economy.institutionalEfficiency,
    );

    const historicalAfterExpiry = runChoice("historical_path", 180);
    const protectedAfterExpiry = runChoice("protect_institutions", 180);
    expect(
      protectedAfterExpiry.modifiers.some(
        (modifier) =>
          modifier.target === "economy.structuralProductivityGrowth",
      ),
    ).toBe(false);
    expect(protectedAfterExpiry.economy.totalFactorProductivity).toBeGreaterThan(
      historicalAfterExpiry.economy.totalFactorProductivity,
    );
    expect(protectedAfterExpiry.economy.humanCapitalIndex).toBeGreaterThan(
      historicalAfterExpiry.economy.humanCapitalIndex,
    );
  });

  it("旧存档缺少历史事件记录时自动迁移", () => {
    const state = createInitialGameState(1949);
    delete (
      state.nation.history as Partial<typeof state.nation.history>
    ).historicalEvents;
    delete (
      state.nation as Partial<typeof state.nation>
    ).historicalEventDecisionMode;
    delete (state.nation as Partial<typeof state.nation>).pendingHistoricalEventId;
    const engine = createSimulationEngine(state);

    expect(engine.getState().nation.history.historicalEvents).toEqual([]);
    expect(engine.getState().nation.historicalEventDecisionMode).toBe(
      "automatic",
    );
    expect(() =>
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 }),
    ).not.toThrow();
  });
});
