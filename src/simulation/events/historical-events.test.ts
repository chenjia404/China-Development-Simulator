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
    });
    expect(
      engine.getState().nation.modifiers.some(
        (modifier) => modifier.sourceId === "great_leap_forward_1958",
      ),
    ).toBe(false);
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
      return engine.getState().nation;
    };
    const historical = runChoice("historical_path");
    const aided = runChoice("accept_foreign_aid");

    expect(aided.population.monthlyDeaths).toBeLessThan(
      historical.population.monthlyDeaths,
    );
    expect(aided.resources.foodSupplyRatio).toBeGreaterThan(
      historical.resources.foodSupplyRatio,
    );
    expect(aided.economy.realGDP).toBeGreaterThan(historical.economy.realGDP);
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
