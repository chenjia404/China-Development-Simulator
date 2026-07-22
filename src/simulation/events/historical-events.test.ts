import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import {
  foreignAidReserveFlowAdjustment,
  tickForeignAidEventAdjustment,
  updateForeignAidProgram,
} from "../diplomacy/foreign-aid";
import { applyModifiers } from "./modifiers";
import { createInitialGameState } from "../state/initial-state";
import {
  checkHistoricalEvents,
  enactHistoricalEventEarly,
  getHistoricalEventAxes,
  getHistoricalEventChoice,
  getHistoricalEventChoices,
  historicalEventDefinitions,
} from "./historical-event-engine";
import type { GameState } from "../state/game-state";
import type { SimulationEngine } from "../core/engine";

/** 交互模式下推进多月时顺手确认饥荒死亡报告，避免月度管线被卡住。 */
function advanceMonthsDismissingFamineReports(
  engine: SimulationEngine,
  months: number,
): void {
  for (let month = 0; month < months; month += 1) {
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    if (engine.getState().nation.famineMortality?.pendingReport) {
      engine.dispatch({ type: "DISMISS_FAMINE_MORTALITY_REPORT" });
    }
  }
}

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
    ).toBe(0);

    const choices = getHistoricalEventChoices(
      "foreign_assets_reorganization",
      state.nation,
    );
    expect(
      choices.map((choice) => ({
        id: choice.id,
        multiplier: choice.modifiers.find(
          (modifier) => modifier.target === "trade.foreignInvestment",
        )?.value,
      })),
    ).toEqual([
      { id: "historical_path", multiplier: 0 },
      { id: "compensated_transition", multiplier: 0.65 },
      { id: "regulated_foreign_business", multiplier: 0.9 },
    ]);
  });

  it("全行业公私合营在指定月份触发且只触发一次", () => {
    const state = createInitialGameState(1956, 1956);
    const first = checkHistoricalEvents(state.nation);
    const second = checkHistoricalEvents(state.nation);

    expect(first.map((event) => event.name)).toContain("全行业公私合营");
    expect(second).toEqual([]);
    expect(state.nation.history.historicalEvents).toHaveLength(1);
    expect(applyModifiers(state.nation, "sector.secondary.output", 100)).toBeCloseTo(
      100.8,
    );
    expect(applyModifiers(state.nation, "capital.privateInvestment", 100)).toBe(
      96,
    );
    expect(
      applyModifiers(
        state.nation,
        "privateEconomy.operatingSpaceChange",
        0,
      ),
    ).toBe(-0.018);
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
      durationMonths: 120,
    });
    expect(
      applyModifiers(
        engine.getState().nation,
        "capital.privateInvestment",
        100,
      ),
    ).toBeCloseTo(105);

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
    ).toBe(60);
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

    const runChoice = (choiceId: string, monthsAfterChoice = 1) => {
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
      // 后续月份还有三视教育等定时事件；多月推进时切自动，避免交互暂停截断比较窗口。
      if (monthsAfterChoice > 1) {
        engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
      }
      engine.dispatch({ type: "ADVANCE_MONTHS", months: monthsAfterChoice });
      return engine.getState();
    };

    const war = runChoice("historical_path");
    const prevented = runChoice("oppose_korean_war");
    const limited = runChoice("limited_defense_and_mediation");
    const warAfterYear = runChoice("historical_path", 12);
    const preventedAfterYear = runChoice("oppose_korean_war", 12);
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
    expect(war.nation.trade.externalDebt).toBeGreaterThan(
      limited.nation.trade.externalDebt,
    );
    expect(limited.nation.trade.externalDebt).toBeGreaterThan(
      prevented.nation.trade.externalDebt,
    );
    expect(war.nation.trade.monthlyExternalBorrowing).toBeGreaterThan(
      20_000_000,
    );
    expect(war.nation.trade.capitalGoodsImportCoverage).toBeLessThan(
      prevented.nation.trade.capitalGoodsImportCoverage,
    );
    expect(prevented.nation.economy.capitalStock).toBeGreaterThan(
      war.nation.economy.capitalStock,
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
    expect(preventedSouthKoreaRelation).toBeGreaterThan(-28);
    expect(preventedSouthKoreaRelation).toBeGreaterThan(
      warSouthKoreaRelation ?? Number.POSITIVE_INFINITY,
    );
    expect(
      prevented.world.countries.find((country) => country.id === "usa")
        ?.relationWithChina,
    ).toBeGreaterThan(-24);
    for (const countryId of ["usa", "south_korea"]) {
      const preventedRelation = preventedAfterYear.world.countries.find(
        (country) => country.id === countryId,
      )?.relationWithChina ?? Number.NEGATIVE_INFINITY;
      const warRelation = warAfterYear.world.countries.find(
        (country) => country.id === countryId,
      )?.relationWithChina ?? Number.POSITIVE_INFINITY;
      expect(preventedRelation).toBeGreaterThan(-18);
      expect(preventedRelation - warRelation).toBeGreaterThan(20);
    }
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

  it("三视教育运动在1950年11月触发，可选阻止，且受朝战劝阻决策缩放", () => {
    const choices = getHistoricalEventChoices("three_views_education_1950");
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "limited_current_affairs_education",
      "avoid_three_views_education",
    ]);
    expect(
      choices[0]?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.relationTarget.usa",
      ),
    ).toMatchObject({ operation: "add", value: -15 });
    expect(choices[2]).toMatchObject({
      id: "avoid_three_views_education",
      outcome: "prevented",
    });
    expect(
      choices[2]?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.relationTarget.usa",
      )?.value,
    ).toBe(8);

    const state = createInitialGameState(1950, 1950, "interactive");
    state.nation.date.month = 11;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.pendingHistoricalEventId).toBe(
      "three_views_education_1950",
    );
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "three_views_education_1950",
      choiceId: "historical_path",
    });
    expect(engine.getState().nation.history.historicalEvents).toHaveLength(1);
    expect(engine.getState().nation.history.historicalEvents[0]).toMatchObject({
      id: "three_views_education_1950",
      outcome: "occurred",
    });
    expect(
      applyModifiers(
        engine.getState().nation,
        "diplomacy.relationTarget.usa",
        0,
      ),
    ).toBe(-15);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.pendingHistoricalEventId).not.toBe(
      "three_views_education_1950",
    );

    const preventedState = createInitialGameState(1950, 1950, "interactive");
    preventedState.nation.date.month = 11;
    const preventedEngine = createSimulationEngine(preventedState);
    preventedEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    preventedEngine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "three_views_education_1950",
      choiceId: "avoid_three_views_education",
    });
    expect(
      preventedEngine.getState().nation.history.historicalEvents[0],
    ).toMatchObject({
      id: "three_views_education_1950",
      choiceId: "avoid_three_views_education",
      outcome: "prevented",
    });
    expect(
      applyModifiers(
        preventedEngine.getState().nation,
        "diplomacy.relationTarget.usa",
        0,
      ),
    ).toBe(8);

    const scaledState = createInitialGameState(1950, 1950, "interactive");
    scaledState.nation.date.month = 6;
    const scaledEngine = createSimulationEngine(scaledState);
    scaledEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(scaledEngine.getState().nation.pendingHistoricalEventId).toBe(
      "land_reform_1950",
    );
    scaledEngine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "land_reform_1950",
      choiceId: "historical_path",
    });
    scaledEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(scaledEngine.getState().nation.pendingHistoricalEventId).toBe(
      "korean_war_1950",
    );
    scaledEngine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "korean_war_1950",
      choiceId: "oppose_korean_war",
    });
    scaledEngine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
    scaledEngine.dispatch({ type: "ADVANCE_MONTHS", months: 5 });
    expect(scaledEngine.getState().nation.date).toMatchObject({
      year: 1950,
      month: 11,
    });
    scaledEngine.dispatch({
      type: "SET_HISTORICAL_EVENT_MODE",
      mode: "interactive",
    });
    scaledEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(scaledEngine.getState().nation.pendingHistoricalEventId).toBe(
      "three_views_education_1950",
    );
    const scaledChoices = getHistoricalEventChoices(
      "three_views_education_1950",
      scaledEngine.getState().nation,
    );
    const scaledHistorical = scaledChoices.find(
      (choice) => choice.id === "historical_path",
    );
    expect(scaledHistorical?.effects).toContain(
      "事前劝阻半岛开战，全国仇美动员缺乏史实动力，三视教育冲击显著减弱",
    );
    expect(scaledHistorical?.durationMonths).toBe(Math.round(36 * 0.6));
    expect(
      scaledHistorical?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.relationTarget.usa",
      )?.value,
    ).toBeCloseTo(-15 * 0.35, 6);
  });

  it("万隆会议在1955年4月触发，史实与保护侨胞路线形成二选一取舍", () => {
    const choices = getHistoricalEventChoices("bandung_conference_1955");
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "retain_overseas_chinese_nationality",
    ]);
    expect(choices[0]).toMatchObject({
      isHistoricalPath: true,
      durationMonths: 60,
    });
    expect(choices[1]).toMatchObject({
      name: "感谢抗战贡献、保护海外侨胞并保留国籍",
      durationMonths: 60,
    });
    expect(choices[1]?.description).toContain("保护海外侨胞");
    expect(choices[1]?.effects).toEqual(
      expect.arrayContaining([
        "保护海外侨胞权益",
        "保留华侨中国国籍",
        "侨汇与开放度提高",
        "东南亚关系承压",
      ]),
    );

    const historicalRemittance = choices[0]?.modifiers.find(
      (modifier) => modifier.target === "trade.remittanceInflows",
    )?.value;
    const retainRemittance = choices[1]?.modifiers.find(
      (modifier) => modifier.target === "trade.remittanceInflows",
    )?.value;
    expect(historicalRemittance).toBe(0.97);
    expect(retainRemittance).toBe(1.18);
    expect(retainRemittance ?? 0).toBeGreaterThan(historicalRemittance ?? 0);

    expect(
      choices[0]?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.relationTarget.indonesia",
      )?.value,
    ).toBe(18);
    expect(
      choices[1]?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.relationTarget.indonesia",
      )?.value,
    ).toBe(-12);
    expect(
      choices[0]?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.reputationTarget",
      )?.value,
    ).toBe(5);
    expect(
      choices[1]?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.reputationTarget",
      )?.value,
    ).toBe(2);
    expect(
      choices[1]?.modifiers.find(
        (modifier) => modifier.target === "trade.opennessTarget",
      ),
    ).toMatchObject({ operation: "add", value: 0.04 });
    expect(
      choices[0]?.modifiers.some(
        (modifier) => modifier.target === "trade.opennessTarget",
      ),
    ).toBe(false);

    const runChoice = (choiceId: string, monthsAfter = 36) => {
      const state = createInitialGameState(1955, 1955, "interactive");
      state.nation.date.month = 4;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      expect(engine.getState().nation.pendingHistoricalEventId).toBe(
        "bandung_conference_1955",
      );
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "bandung_conference_1955",
        choiceId,
      });
      engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
      advanceMonthsDismissingFamineReports(engine, monthsAfter);
      return engine.getState();
    };

    const historical = runChoice("historical_path");
    const retained = runChoice("retain_overseas_chinese_nationality");
    const relation = (state: typeof historical, countryId: string) =>
      state.world.countries.find((country) => country.id === countryId)
        ?.relationWithChina ?? Number.NaN;

    expect(
      historical.nation.history.historicalEvents.find(
        (event) => event.id === "bandung_conference_1955",
      ),
    ).toMatchObject({
      choiceId: "historical_path",
      outcome: "occurred",
    });
    expect(
      retained.nation.history.historicalEvents.find(
        (event) => event.id === "bandung_conference_1955",
      ),
    ).toMatchObject({
      choiceId: "retain_overseas_chinese_nationality",
      outcome: "occurred",
      choiceName: "感谢抗战贡献、保护海外侨胞并保留国籍",
    });

    expect(relation(historical, "indonesia")).toBeGreaterThan(
      relation(retained, "indonesia"),
    );
    expect(
      applyModifiers(historical.nation, "diplomacy.reputationTarget", 50),
    ).toBeGreaterThan(
      applyModifiers(retained.nation, "diplomacy.reputationTarget", 50),
    );
    expect(
      applyModifiers(retained.nation, "trade.remittanceInflows", 100),
    ).toBeGreaterThan(
      applyModifiers(historical.nation, "trade.remittanceInflows", 100),
    );
    expect(
      applyModifiers(retained.nation, "trade.opennessTarget", 0.1),
    ).toBeGreaterThan(
      applyModifiers(historical.nation, "trade.opennessTarget", 0.1),
    );
    expect(retained.nation.trade.openness).toBeGreaterThan(
      historical.nation.trade.openness,
    );
    expect(retained.nation.trade.remittanceInflows).toBeGreaterThan(
      historical.nation.trade.remittanceInflows,
    );
    expect(
      applyModifiers(retained.nation, "trade.remittanceTransferEfficiency", 1),
    ).toBeGreaterThan(
      applyModifiers(
        historical.nation,
        "trade.remittanceTransferEfficiency",
        1,
      ),
    );
  });

  it("日本战犯特赦在1956年6月触发，三线取舍区分对日关系与国内稳定", () => {
    const choices = getHistoricalEventChoices(
      "japanese_war_criminals_amnesty_1956",
    );
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "immediate_full_amnesty",
      "refuse_amnesty_prosecute",
    ]);
    expect(choices[0]).toMatchObject({
      isHistoricalPath: true,
      durationMonths: 96,
      outcome: "occurred",
    });
    expect(choices[1]).toMatchObject({
      id: "immediate_full_amnesty",
      name: "立即全部特赦遣返",
      durationMonths: 36,
    });
    expect(choices[2]).toMatchObject({
      id: "refuse_amnesty_prosecute",
      name: "依法严惩、拒绝特赦",
      outcome: "prevented",
      durationMonths: 120,
    });

    const japanRelation = (choiceId: string) =>
      choices
        .find((choice) => choice.id === choiceId)
        ?.modifiers.find(
          (modifier) => modifier.target === "diplomacy.relationTarget.japan",
        )?.value;
    expect(japanRelation("historical_path")).toBe(8);
    expect(japanRelation("immediate_full_amnesty")).toBe(16);
    expect(japanRelation("refuse_amnesty_prosecute")).toBe(-12);
    expect(japanRelation("immediate_full_amnesty") ?? 0).toBeGreaterThan(
      japanRelation("historical_path") ?? 0,
    );
    expect(japanRelation("historical_path") ?? 0).toBeGreaterThan(
      japanRelation("refuse_amnesty_prosecute") ?? 0,
    );

    const stability = (choiceId: string) =>
      choices
        .find((choice) => choice.id === choiceId)
        ?.modifiers.find((modifier) => modifier.target === "society.stability")
        ?.value;
    expect(stability("immediate_full_amnesty")).toBe(-4);
    expect(stability("historical_path")).toBe(-1.5);
    expect(stability("refuse_amnesty_prosecute")).toBe(3);

    const state = createInitialGameState(1956, 1956, "interactive");
    state.nation.date.month = 6;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.pendingHistoricalEventId).toBe(
      "japanese_war_criminals_amnesty_1956",
    );

    const runChoice = (choiceId: string, monthsAfter = 24) => {
      const runState = createInitialGameState(1956, 1956, "interactive");
      runState.nation.date.month = 6;
      const runEngine = createSimulationEngine(runState);
      runEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      expect(runEngine.getState().nation.pendingHistoricalEventId).toBe(
        "japanese_war_criminals_amnesty_1956",
      );
      runEngine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "japanese_war_criminals_amnesty_1956",
        choiceId,
      });
      runEngine.dispatch({
        type: "SET_HISTORICAL_EVENT_MODE",
        mode: "automatic",
      });
      advanceMonthsDismissingFamineReports(runEngine, monthsAfter);
      return runEngine.getState();
    };

    const historical = runChoice("historical_path");
    const immediate = runChoice("immediate_full_amnesty");
    const refused = runChoice("refuse_amnesty_prosecute");
    const relation = (gameState: typeof historical) =>
      gameState.world.countries.find((country) => country.id === "japan")
        ?.relationWithChina ?? Number.NaN;
    const japanTarget = (gameState: typeof historical) =>
      applyModifiers(gameState.nation, "diplomacy.relationTarget.japan", 0);

    expect(
      historical.nation.history.historicalEvents.find(
        (event) => event.id === "japanese_war_criminals_amnesty_1956",
      ),
    ).toMatchObject({
      choiceId: "historical_path",
      outcome: "occurred",
    });
    expect(
      immediate.nation.history.historicalEvents.find(
        (event) => event.id === "japanese_war_criminals_amnesty_1956",
      ),
    ).toMatchObject({
      choiceId: "immediate_full_amnesty",
      outcome: "occurred",
      choiceName: "立即全部特赦遣返",
    });
    expect(
      refused.nation.history.historicalEvents.find(
        (event) => event.id === "japanese_war_criminals_amnesty_1956",
      ),
    ).toMatchObject({
      choiceId: "refuse_amnesty_prosecute",
      outcome: "prevented",
      choiceName: "依法严惩、拒绝特赦",
    });

    expect(japanTarget(immediate)).toBeGreaterThan(japanTarget(historical));
    expect(japanTarget(historical)).toBeGreaterThan(japanTarget(refused));
    expect(relation(immediate)).toBeGreaterThan(relation(historical));
    expect(relation(historical)).toBeGreaterThan(relation(refused));
    expect(
      applyModifiers(immediate.nation, "diplomacy.reputationTarget", 50),
    ).toBeGreaterThan(
      applyModifiers(historical.nation, "diplomacy.reputationTarget", 50),
    );
    expect(
      applyModifiers(historical.nation, "diplomacy.reputationTarget", 50),
    ).toBeGreaterThan(
      applyModifiers(refused.nation, "diplomacy.reputationTarget", 50),
    );
    expect(
      applyModifiers(refused.nation, "society.stability", 50),
    ).toBeGreaterThan(
      applyModifiers(historical.nation, "society.stability", 50),
    );
    expect(
      applyModifiers(historical.nation, "society.stability", 50),
    ).toBeGreaterThan(
      applyModifiers(immediate.nation, "society.stability", 50),
    );
    expect(
      choices.every(
        (choice) =>
          !choice.modifiers.some(
            (modifier) => modifier.target === "fiscal.spending",
          ),
      ),
    ).toBe(true);
  });

  it("朝鲜战争军事贷款在战争期累积，1964年保留残债并于1965年清偿", () => {
    const state = createInitialGameState(1950, 1950, "interactive");
    state.nation.date.month = 6;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "land_reform_1950",
      choiceId: "historical_path",
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "korean_war_1950",
      choiceId: "historical_path",
    });
    engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 37 });

    expect(engine.getState().nation.trade.externalDebt).toBeGreaterThan(
      14_000_000_000,
    );
    expect(engine.getState().nation.trade.externalDebt).toBeLessThan(
      15_000_000_000,
    );

    const monthsToEnd1964 =
      (1964 - engine.getState().nation.date.year) * 12 +
      (12 - engine.getState().nation.date.month) +
      1;
    engine.dispatch({ type: "ADVANCE_MONTHS", months: monthsToEnd1964 });
    expect(engine.getState().nation.date).toMatchObject({
      year: 1965,
      month: 1,
    });
    expect(engine.getState().nation.trade.externalDebt).toBeGreaterThanOrEqual(
      120_000_000,
    );
    expect(engine.getState().nation.trade.externalDebt).toBeLessThanOrEqual(
      200_000_000,
    );

    const monthsToClearance =
      (1965 - engine.getState().nation.date.year) * 12 +
      (11 - engine.getState().nation.date.month);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: monthsToClearance });
    expect(engine.getState().nation.date).toMatchObject({
      year: 1965,
      month: 11,
    });
    expect(engine.getState().nation.trade.externalDebt).toBeLessThan(1_000_000);
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
    // 取消三线把资源留在民用与既有工业区，基建指数可高于全面铺开的史实路线。
    expect(canceled.nation.economy.infrastructureIndex).toBeGreaterThan(
      historical.nation.economy.infrastructureIndex,
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

  it("所有固定日期历史事件都有至少两个会改变数值传导的方案", () => {
    for (const event of historicalEventDefinitions.filter(
      (candidate) => candidate.triggerMode !== "conditional",
    )) {
      const choices = getHistoricalEventChoices(event);
      expect(choices.length).toBeGreaterThanOrEqual(2);
      expect(new Set(choices.map((choice) => choice.id)).size).toBe(
        choices.length,
      );
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
    ).toBe(100);
    expect(
      engine.getState().nation.modifiers.some(
        (modifier) => modifier.target.startsWith("sector.") &&
          modifier.target.endsWith(".output") &&
          modifier.value > 1,
      ),
    ).toBe(false);
    expect(
      applyModifiers(
        engine.getState().nation,
        "economy.structuralProductivityGrowth",
        0,
      ),
    ).toBeCloseTo(0.001);
  });

  it("人民公社史实路径按劳动、管理与副业偏强冲击压制农业与粮食", () => {
    const historicalChoice = getHistoricalEventChoice(
      "peoples_communes_1958",
      "historical_path",
    );
    expect(historicalChoice?.durationMonths).toBe(36);
    expect(
      historicalChoice?.modifiers.find(
        (modifier) =>
          modifier.target === "sector.primary.output" &&
          modifier.delayMonths === 6,
      ),
    ).toMatchObject({ value: 0.93, durationMonths: 24 });
    expect(
      historicalChoice?.modifiers.find(
        (modifier) =>
          modifier.target === "economy.institutionalEfficiencyTarget",
      )?.value,
    ).toBe(0.95);
    expect(
      historicalChoice?.modifiers.find(
        (modifier) => modifier.target === "capital.investmentEfficiency",
      )?.value,
    ).toBe(0.97);
    expect(
      historicalChoice?.modifiers.find(
        (modifier) => modifier.target === "capital.privateInvestment",
      )?.value,
    ).toBe(0.85);
    expect(
      historicalChoice?.modifiers.find(
        (modifier) =>
          modifier.target === "resources.foodSupply" &&
          modifier.delayMonths === 5,
      ),
    ).toMatchObject({ value: 0.95, durationMonths: 24 });
    expect(
      historicalChoice?.modifiers.find(
        (modifier) =>
          modifier.target === "economy.structuralProductivityGrowth",
      ),
    ).toMatchObject({ value: -0.00005, durationMonths: 72 });

    const runChoice = (choiceId: string) => {
      const state = createInitialGameState(1958, 1958, "interactive");
      state.nation.date.month = 8;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "peoples_communes_1958",
        choiceId,
      });
      // 越过粮供与农业产出的延迟窗口后再比较。
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 8 });
      return engine.getState();
    };

    const historical = runChoice("historical_path");
    const avoided = runChoice("avoid_communes");
    expect(historical.nation.resources.foodSupplyRatio).toBeLessThan(
      avoided.nation.resources.foodSupplyRatio,
    );
    expect(historical.nation.sectors.primary.output).toBeLessThan(
      avoided.nation.sectors.primary.output,
    );
    expect(historical.nation.economy.institutionalEfficiency).toBeLessThan(
      avoided.nation.economy.institutionalEfficiency,
    );
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
    expect(historicalPath.durationMonths).toBe(33);
    expect(historicalPath.effects).toContain(
      "未发动大跃进，政策性资源错配与农业冲击明显减轻",
    );
    expect(
      historicalPath.modifiers.find(
        (modifier) =>
          modifier.target === "resources.foodSupply" &&
          (modifier.delayMonths ?? 0) === 0,
      )?.value,
    ).toBeCloseTo(1 + (0.94 - 1) * 0.65 * 0.8, 6);
    expect(
      historicalPath.modifiers.find(
        (modifier) =>
          modifier.target === "resources.foodSupply" &&
          modifier.delayMonths === 12,
      )?.value,
    ).toBeCloseTo(1 + (0.97 - 1) * 0.65 * 0.8, 6);
    const acceptAid = choices.find(
      (choice) =>
        choice.id ===
          "continue_grain_exports+no_additional_relief+continue_high_procurement+foreign_aid_500mt",
    );
    // 组合持续期取各轴最大：贸易轴史实危机缩放后为 33 月。
    expect(acceptAid?.durationMonths).toBe(33);
    expect(
      acceptAid?.modifiers.find(
        (modifier) => modifier.target === "population.deathRate",
      )?.value,
    ).toBeCloseTo(1 + (1.006 - 1) * 0.65 * 0.8, 6);
  });

  it("三年经济困难可接受外国援助并减少死亡与经济冲击", () => {
    const axes = getHistoricalEventAxes("three_year_difficulties_1959");
    expect(axes.map((axis) => axis.id)).toEqual([
      "grain_trade",
      "crisis_relief",
      "procurement_ration",
      "foreign_aid",
    ]);
    const choices = getHistoricalEventChoices("three_year_difficulties_1959");
    expect(choices).toHaveLength(48);
    expect(choices.some((choice) => choice.id === "historical_path")).toBe(
      true,
    );
    const aidChoice = choices.find(
      (choice) =>
        choice.id ===
          "continue_grain_exports+no_additional_relief+continue_high_procurement+foreign_aid_500mt",
    );
    expect(aidChoice?.name).toContain("500 万吨");
    expect(aidChoice?.durationMonths).toBe(48);
    expect(
      aidChoice?.modifiers.find(
        (modifier) => modifier.target === "population.deathRate",
      )?.value,
    ).toBe(1.006);
    const aid200 = choices.find(
      (choice) =>
        choice.id ===
          "continue_grain_exports+no_additional_relief+continue_high_procurement+foreign_aid_200mt",
    );
    const aid1000 = choices.find(
      (choice) =>
        choice.id ===
          "continue_grain_exports+no_additional_relief+continue_high_procurement+foreign_aid_1000mt",
    );
    expect(aid200?.name).toContain("200 万吨");
    expect(aid1000?.name).toContain("1000 万吨");
    expect(
      aid200?.modifiers.find(
        (modifier) => modifier.target === "resources.foodSupply",
      )?.value,
    ).toBe(0.9625);
    expect(
      aid1000?.modifiers.find(
        (modifier) => modifier.target === "resources.foodSupply",
      )?.value,
    ).toBe(0.9925);
    expect(
      aidChoice?.modifiers
        .filter((modifier) =>
          modifier.target.startsWith("diplomacy.relationTarget.")
        )
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
    const aided200 = runChoice("foreign_aid_200mt");
    const aided = runChoice("foreign_aid_500mt");
    const aided1000 = runChoice("foreign_aid_1000mt");
    const relation = (state: typeof aided, countryId: string) =>
      state.world.countries.find((country) => country.id === countryId)
        ?.relationWithChina ?? Number.NaN;

    expect(aided.nation.population.monthlyDeaths).toBeLessThan(
      historical.nation.population.monthlyDeaths,
    );
    expect(aided.nation.resources.foodSupplyRatio).toBeGreaterThan(
      historical.nation.resources.foodSupplyRatio,
    );
    expect(aided.nation.resources.foodSupplyRatio).toBeGreaterThan(
      aided200.nation.resources.foodSupplyRatio,
    );
    expect(aided1000.nation.resources.foodSupplyRatio).toBeGreaterThan(
      aided.nation.resources.foodSupplyRatio,
    );
    expect(aided1000.nation.population.monthlyDeaths).toBeLessThan(
      aided.nation.population.monthlyDeaths,
    );
    expect(aided.nation.population.monthlyDeaths).toBeLessThan(
      aided200.nation.population.monthlyDeaths,
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

  it("三年困难可限制或禁止粮食出口，并可与外国援助、降征购组合", () => {
    const choices = getHistoricalEventChoices("three_year_difficulties_1959");
    const limit = choices.find(
      (choice) =>
        choice.id ===
          "limit_grain_exports+no_additional_relief+continue_high_procurement+no_foreign_aid",
    );
    const ban = choices.find(
      (choice) =>
        choice.id ===
          "ban_grain_exports_and_import+no_additional_relief+continue_high_procurement+no_foreign_aid",
    );
    const banWithAid = choices.find(
      (choice) =>
        choice.id ===
          "ban_grain_exports_and_import+no_additional_relief+continue_high_procurement+foreign_aid_500mt",
    );
    const reduceProcurement = choices.find(
      (choice) =>
        choice.id ===
          "continue_grain_exports+no_additional_relief+reduce_procurement_guarantee_ration+no_foreign_aid",
    );
    const banAidReduce = choices.find(
      (choice) =>
        choice.id ===
          "ban_grain_exports_and_import+no_additional_relief+reduce_procurement_guarantee_ration+foreign_aid_500mt",
    );
    expect(limit?.name).toContain("大幅限制粮食出口");
    expect(ban?.name).toContain("禁止粮食出口并提前进口");
    expect(banWithAid?.name).toContain("500 万吨");
    expect(reduceProcurement?.name).toContain("降低征购并保障农村最低口粮");
    expect(banAidReduce?.name).toContain("降低征购并保障农村最低口粮");
    expect(banAidReduce?.name).toContain("500 万吨");
    expect(
      banWithAid?.modifiers.find(
        (modifier) => modifier.target === "resources.foodSupply",
      )?.value,
    ).toBeCloseTo(1 - (1 - 0.962) * (1 - 0.985), 8);
    expect(
      banWithAid?.modifiers.find(
        (modifier) => modifier.target === "population.deathRate",
      )?.value,
    ).toBeCloseTo(1 + (1.011 - 1) * (1.006 - 1), 8);
    expect(
      banWithAid?.modifiers.find(
        (modifier) =>
          modifier.target === "trade.capitalGoodsImportCoverage",
      )?.value,
    ).toBe(0.978);
    expect(
      banWithAid?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.relationTarget.canada",
      )?.value,
    ).toBe(44);
    expect(
      banAidReduce?.modifiers.find(
        (modifier) => modifier.target === "resources.foodSupply",
      )?.value,
    ).toBeCloseTo(
      1 - (1 - (1 - (1 - 0.962) * (1 - 0.985))) * (1 - 0.972),
      8,
    );
    expect(
      banAidReduce?.modifiers.find(
        (modifier) => modifier.target === "population.deathRate",
      )?.value,
    ).toBeCloseTo(
      1 + (1.011 - 1) * (1.006 - 1) * (1.008 - 1),
      8,
    );

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
    const limited = runChoice("limit_grain_exports");
    const banned = runChoice("ban_grain_exports_and_import");
    const aided = runChoice("accept_foreign_aid");
    const reducedProcurement = runChoice(
      "reduce_procurement_guarantee_ration",
    );
    const bannedAndAided = runChoice(
      "ban_grain_exports_and_import+foreign_aid_500mt",
    );
    const bannedAidedReduced = runChoice(
      "ban_grain_exports_and_import+reduce_procurement_guarantee_ration+foreign_aid_500mt",
    );
    const relieved = runChoice("domestic_emergency_relief");
    const relation = (state: typeof historical, countryId: string) =>
      state.world.countries.find((country) => country.id === countryId)
        ?.relationWithChina ?? Number.NaN;

    expect(limited.nation.resources.foodSupplyRatio).toBeGreaterThan(
      historical.nation.resources.foodSupplyRatio,
    );
    expect(relieved.nation.resources.foodSupplyRatio).toBeGreaterThan(
      limited.nation.resources.foodSupplyRatio,
    );
    expect(banned.nation.resources.foodSupplyRatio).toBeGreaterThan(
      relieved.nation.resources.foodSupplyRatio,
    );
    expect(reducedProcurement.nation.resources.foodSupplyRatio).toBeGreaterThan(
      banned.nation.resources.foodSupplyRatio,
    );
    expect(aided.nation.resources.foodSupplyRatio).toBeGreaterThan(
      reducedProcurement.nation.resources.foodSupplyRatio,
    );
    expect(bannedAndAided.nation.resources.foodSupplyRatio).toBeGreaterThan(
      aided.nation.resources.foodSupplyRatio,
    );
    // 禁出口+外援后粮食/死亡率修正已接近中性，再叠降征购主要体现为财政与投资代价，
    // 以及仍可叠加的正向保命取向；不强求首月粮供再升一档。
    expect(bannedAidedReduced.nation.fiscal.expenditure).toBeGreaterThan(
      bannedAndAided.nation.fiscal.expenditure,
    );
    expect(bannedAidedReduced.nation.trade.exports).toBeLessThan(
      bannedAndAided.nation.trade.exports,
    );
    expect(bannedAidedReduced.nation.population.monthlyDeaths).toBeLessThanOrEqual(
      bannedAndAided.nation.population.monthlyDeaths,
    );
    expect(bannedAndAided.nation.population.monthlyDeaths).toBeLessThan(
      aided.nation.population.monthlyDeaths,
    );
    expect(reducedProcurement.nation.population.monthlyDeaths).toBeLessThan(
      banned.nation.population.monthlyDeaths,
    );
    expect(reducedProcurement.nation.sectors.secondary.output).toBeLessThan(
      historical.nation.sectors.secondary.output,
    );
    expect(bannedAndAided.nation.trade.capitalGoodsImportCoverage).toBeLessThan(
      aided.nation.trade.capitalGoodsImportCoverage,
    );
    expect(relation(bannedAndAided, "russia")).toBeGreaterThan(
      relation(banned, "russia"),
    );
    expect(relation(bannedAndAided, "canada")).toBeGreaterThan(
      relation(aided, "canada"),
    );
    expect(banned.nation.population.monthlyDeaths).toBeLessThan(
      limited.nation.population.monthlyDeaths,
    );
    expect(limited.nation.population.monthlyDeaths).toBeLessThan(
      historical.nation.population.monthlyDeaths,
    );
    expect(banned.nation.trade.capitalGoodsImportCoverage).toBeLessThan(
      historical.nation.trade.capitalGoodsImportCoverage,
    );
    expect(relation(banned, "canada")).toBeGreaterThan(
      relation(historical, "canada"),
    );
    expect(relation(banned, "australia")).toBeGreaterThan(
      relation(historical, "australia"),
    );
  });

  it("苏阿断援后可选择全额、削减或拒绝对阿援助", () => {
    const choices = getHistoricalEventChoices(
      "albania_aid_after_soviet_cutoff_1961",
    );
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "reduced_albania_aid",
      "refuse_albania_aid",
    ]);
    expect(choices[0]).toMatchObject({
      durationMonths: 36,
      isHistoricalPath: true,
    });
    expect(choices[1]).toMatchObject({
      name: "削减对阿援助规模",
      durationMonths: 36,
    });
    expect(choices[1]?.foreignAidAdjustment?.durationMonths).toBe(
      choices[1]?.durationMonths,
    );
    expect(choices[2]).toMatchObject({
      name: "拒绝对阿尔巴尼亚援助",
      outcome: "prevented",
    });
    expect(
      choices[0]?.modifiers.find(
        (modifier) => modifier.target === "capital.governmentInvestment",
      )?.value,
    ).toBe(0.997);
    expect(
      choices[0]?.modifiers.find(
        (modifier) => modifier.target === "diplomacy.relationTarget.albania",
      )?.value,
    ).toBe(45);
    expect(
      choices[0]?.modifiers.find(
        (modifier) => modifier.target === "resources.foodSupply",
      )?.value,
    ).toBe(0.998);
    expect(
      choices[0]?.foreignAidAdjustment,
    ).toMatchObject({
      annualRmbDelta: 0,
      durationMonths: 36,
    });
    expect(choices[0]?.foreignAidAdjustment?.annualForeignExchangeRmbDelta)
      .toBeCloseTo((250_000_000 / 3) * 0.95, 4);
    expect(choices[1]?.foreignAidAdjustment?.annualForeignExchangeRmbDelta)
      .toBeCloseTo((125_000_000 / 3) * 0.95, 4);
    expect(choices[2]?.foreignAidAdjustment?.annualForeignExchangeRmbDelta)
      .toBe(0);
    expect(choices[2]?.foreignAidAdjustment?.annualRmbDelta).toBeCloseTo(
      -250_000_000 / 3,
      5,
    );

    const runChoice = (choiceId: string, monthsAfter = 1) => {
      const state = createInitialGameState(1961, 1961, "interactive");
      state.nation.date.month = 3;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      expect(engine.getState().nation.pendingHistoricalEventId).toBe(
        "albania_aid_after_soviet_cutoff_1961",
      );
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "albania_aid_after_soviet_cutoff_1961",
        choiceId,
      });
      advanceMonthsDismissingFamineReports(engine, monthsAfter);
      return engine.getState();
    };

    const historical = runChoice("historical_path");
    const reduced = runChoice("reduced_albania_aid");
    const refused = runChoice("refuse_albania_aid");
    const relation = (state: typeof historical, countryId: string) =>
      state.world.countries.find((country) => country.id === countryId)
        ?.relationWithChina ?? Number.NaN;

    expect(
      historical.nation.history.historicalEvents.find(
        (event) => event.id === "albania_aid_after_soviet_cutoff_1961",
      ),
    ).toMatchObject({
      choiceId: "historical_path",
      outcome: "occurred",
    });
    expect(
      refused.nation.history.historicalEvents.find(
        (event) => event.id === "albania_aid_after_soviet_cutoff_1961",
      ),
    ).toMatchObject({
      choiceId: "refuse_albania_aid",
      outcome: "prevented",
    });

    expect(historical.nation.resources.foodSupplyRatio).toBeLessThan(
      reduced.nation.resources.foodSupplyRatio,
    );
    expect(reduced.nation.resources.foodSupplyRatio).toBeLessThan(
      refused.nation.resources.foodSupplyRatio,
    );
    expect(relation(historical, "albania")).toBeGreaterThan(
      relation(reduced, "albania"),
    );
    expect(relation(reduced, "albania")).toBeGreaterThan(
      relation(refused, "albania"),
    );
    expect(relation(historical, "russia")).toBeLessThan(
      relation(refused, "russia"),
    );
    expect(relation(historical, "japan")).toBeCloseTo(
      relation(refused, "japan"),
    );

    expect(historical.nation.diplomacy.annualForeignAidRMB).toBeCloseTo(
      630_000_000,
      -2,
    );
    expect(reduced.nation.diplomacy.annualForeignAidRMB).toBeLessThan(
      historical.nation.diplomacy.annualForeignAidRMB - 30_000_000,
    );
    expect(refused.nation.diplomacy.annualForeignAidRMB).toBeLessThan(
      reduced.nation.diplomacy.annualForeignAidRMB - 30_000_000,
    );
    expect(
      historical.nation.diplomacy.annualForeignAidForeignExchangeOutflow,
    ).toBeGreaterThan(0);
    expect(
      reduced.nation.diplomacy.annualForeignAidForeignExchangeOutflow,
    ).toBeGreaterThan(0);
    expect(
      refused.nation.diplomacy.annualForeignAidForeignExchangeOutflow,
    ).toBeGreaterThan(0);
    expect(
      reduced.nation.diplomacy.annualForeignAidForeignExchangeOutflow,
    ).toBeLessThan(
      historical.nation.diplomacy.annualForeignAidForeignExchangeOutflow,
    );
    expect(
      refused.nation.diplomacy.annualForeignAidForeignExchangeOutflow,
    ).toBeLessThan(
      reduced.nation.diplomacy.annualForeignAidForeignExchangeOutflow,
    );
    expect(refused.nation.diplomacy.cumulativeForeignAidRMB).toBeLessThan(
      historical.nation.diplomacy.cumulativeForeignAidRMB,
    );

    // 36 个月累计外汇（人民币等值）差额应接近文案中的 2.5 亿元。
    const accumulateFxRmb = (choiceId: string) => {
      const state = createInitialGameState(1961, 1961, "interactive");
      state.nation.date.month = 3;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "albania_aid_after_soviet_cutoff_1961",
        choiceId,
      });
      let total = 0;
      for (let month = 0; month < 36; month += 1) {
        advanceMonthsDismissingFamineReports(engine, 1);
        const diplomacy = engine.getState().nation.diplomacy;
        const rate =
          diplomacy.annualForeignAidUSD > 0
            ? diplomacy.annualForeignAidRMB / diplomacy.annualForeignAidUSD
            : 2.46;
        total += diplomacy.annualForeignAidForeignExchangeOutflow / 12 * rate;
      }
      return total;
    };
    const historicalFx = accumulateFxRmb("historical_path");
    const reducedFx = accumulateFxRmb("reduced_albania_aid");
    const refusedFx = accumulateFxRmb("refuse_albania_aid");
    expect(historicalFx - refusedFx).toBeGreaterThan(230_000_000);
    expect(historicalFx - refusedFx).toBeLessThan(280_000_000);
    expect(historicalFx - reducedFx).toBeGreaterThan(100_000_000);
    expect(historicalFx - reducedFx).toBeLessThan(160_000_000);

    // 第 35/36/37 月外储相对调整：史实路线结束月不得因提前清基线而多扣外汇。
    const prepareAfterMonths = (choiceId: string, months: number): GameState => {
      const state = createInitialGameState(1961, 1961, "interactive");
      state.nation.date.month = 3;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "albania_aid_after_soviet_cutoff_1961",
        choiceId,
      });
      advanceMonthsDismissingFamineReports(engine, months);
      return engine.getState();
    };
    const annualReserveAdj = (state: GameState) =>
      foreignAidReserveFlowAdjustment(state.nation);

    const historicalM35 = prepareAfterMonths("historical_path", 35);
    expect(
      historicalM35.nation.diplomacy.foreignAidEventAdjustmentRemainingMonths,
    ).toBe(1);
    expect(annualReserveAdj(historicalM35)).toBeCloseTo(0, -2);

    // 模拟第 36 月援外结算：递减尚未执行时，外储仍能看到史实基线。
    updateForeignAidProgram(historicalM35);
    expect(
      historicalM35.nation.diplomacy.foreignAidEventAdjustmentRemainingMonths,
    ).toBe(1);
    expect(annualReserveAdj(historicalM35)).toBeCloseTo(0, -2);
    expect(
      historicalM35.nation.diplomacy.foreignAidEventHistoricalFxBaselineRmb,
    ).toBeGreaterThan(0);

    tickForeignAidEventAdjustment(historicalM35.nation);
    expect(
      historicalM35.nation.diplomacy.foreignAidEventAdjustmentRemainingMonths,
    ).toBe(0);
    expect(
      historicalM35.nation.diplomacy.foreignAidEventHistoricalFxBaselineRmb,
    ).toBe(0);

    const historicalM36 = prepareAfterMonths("historical_path", 36);
    expect(
      historicalM36.nation.diplomacy.foreignAidEventAdjustmentRemainingMonths,
    ).toBe(0);
    expect(
      historicalM36.nation.diplomacy.foreignAidEventHistoricalFxBaselineRmb,
    ).toBe(0);

    const historicalM37 = prepareAfterMonths("historical_path", 37);
    expect(
      historicalM37.nation.diplomacy.foreignAidEventAdjustmentRemainingMonths,
    ).toBe(0);
    // 第 37 月已无事件专属外汇，相对方案基线的外储调整应回到近零。
    expect(annualReserveAdj(historicalM37)).toBeCloseTo(0, -2);

    const automatic = createInitialGameState(1961, 1961, "automatic");
    automatic.nation.date.month = 3;
    const autoEngine = createSimulationEngine(automatic);
    autoEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(autoEngine.getState().nation.pendingHistoricalEventId).toBeNull();
    expect(
      autoEngine
        .getState()
        .nation.history.historicalEvents.find(
          (event) => event.id === "albania_aid_after_soviet_cutoff_1961",
        ),
    ).toMatchObject({
      choiceId: "historical_path",
      outcome: "occurred",
    });
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
    ).toBe(1.35);
    expect(
      historicalPath?.modifiers.find(
        (modifier) => modifier.target === "technology.treeResearchProgress",
      )?.value,
    ).toBe(0.55);
    expect(
      historicalPath?.modifiers.find(
        (modifier) =>
          modifier.target === "education.higherEducationAdmissions" &&
          modifier.durationMonths === 54,
      )?.value,
    ).toBe(0.02);
    expect(
      historicalPath?.modifiers.find(
        (modifier) => modifier.target === "education.researchTalentRetention",
      )?.value,
    ).toBe(0.45);
    expect(
      historicalPath?.modifiers.some(
        (modifier) =>
          modifier.target === "economy.structuralProductivityGrowth" &&
          modifier.delayMonths === 408 &&
          modifier.value < 0,
      ),
    ).toBe(true);
    expect(
      protectedInstitutions?.modifiers.find(
        (modifier) => modifier.target === "technology.treeResearchProgress",
      )?.value,
    ).toBe(1.28);
    expect(
      protectedInstitutions?.modifiers.some(
        (modifier) => modifier.target === "capital.investmentEfficiency",
      ),
    ).toBe(true);
    expect(
      protectedInstitutions?.modifiers.some(
        (modifier) => modifier.target.startsWith("sector.") &&
          modifier.target.endsWith(".output") &&
          modifier.value > 1,
      ),
    ).toBe(false);
    expect(
      protectedInstitutions?.modifiers.find(
        (modifier) =>
          modifier.target === "economy.structuralProductivityGrowth",
      )?.value,
    ).toBe(0.0011);

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
    expect(historical.education.higherEducationAdmissionCapacity).toBeLessThan(
      protectedRoute.education.higherEducationAdmissionCapacity,
    );
    expect(historical.education.academicContinuity).toBeLessThan(
      protectedRoute.education.academicContinuity,
    );
    expect(historical.education.researchCohortGap).toBeGreaterThan(
      protectedRoute.education.researchCohortGap,
    );
    expect(historical.education.permanentResearchTalentLosses).toBeGreaterThan(
      0,
    );
    expect(protectedRoute.education.permanentResearchTalentLosses).toBe(0);

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
    expect(
      protectedAfterExpiry.technology.completedTechnologyIds.length,
    ).toBeGreaterThan(
      historicalAfterExpiry.technology.completedTechnologyIds.length,
    );
    expect(historicalAfterExpiry.education.educationDisruptionMonths).toBeGreaterThanOrEqual(
      120,
    );
    expect(historicalAfterExpiry.education.researchCohortGap).toBeGreaterThan(
      0.5,
    );
    expect(historicalAfterExpiry.education.permanentResearchTalentLosses).toBeGreaterThan(
      3_000,
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

  it("加入世界贸易组织按履约、红利与常态化三阶段传导并保留进口竞争代价", () => {
    const event = historicalEventDefinitions.find(
      (item) => item.id === "wto_accession_2001",
    );
    expect(event).toMatchObject({
      impact: "mixed",
      durationMonths: 108,
      triggerMode: "conditional",
    });
    expect(event?.effects.some((item) => item.includes("进口竞争"))).toBe(true);
    expect(event?.effects.some((item) => item.includes("中期出口"))).toBe(true);
    expect(
      event?.modifiers.filter(
        (modifier) => modifier.target === "trade.exportCompetitiveness",
      ).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      event?.modifiers.some(
        (modifier) =>
          modifier.target === "sector.primary.output" && modifier.value < 1,
      ),
    ).toBe(true);
    expect(
      event?.modifiers.some(
        (modifier) =>
          modifier.target === "industry.electronics_communications.productivity" &&
          (modifier.delayMonths ?? 0) > 0,
      ),
    ).toBe(true);

    const eligible = createInitialGameState(1982, 1982);
    enactHistoricalEventEarly(
      eligible.nation,
      "gatt_accession_application_1986",
      "test:gatt-application-wto-effect",
      "测试入世效果前置",
      [],
    );
    eligible.nation.date.year = 1987;
    eligible.nation.date.month = 1;
    eligible.nation.date.elapsedMonths = (1987 - 1949) * 12;
    eligible.nation.internationalInfluence = 50;
    eligible.nation.trade.openness = 0.5;
    for (const country of eligible.world.countries) {
      country.relationWithChina = 30;
    }
    for (const country of eligible.world.countries.slice(0, 3)) {
      country.tradeAgreement = true;
    }
    const engine = createSimulationEngine(eligible);
    const beforeExport = applyModifiers(
      engine.getState().nation,
      "trade.exportCompetitiveness",
      1,
    );
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.history.historicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "wto_accession_2001" }),
      ]),
    );
    expect(
      applyModifiers(engine.getState().nation, "trade.exportCompetitiveness", 1),
    ).toBeGreaterThan(beforeExport);
    expect(
      applyModifiers(engine.getState().nation, "fiscal.spending", 1),
    ).toBeGreaterThan(1);
    expect(
      applyModifiers(engine.getState().nation, "sector.primary.output", 1),
    ).toBeLessThan(1);

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 24 });
    expect(
      applyModifiers(
        engine.getState().nation,
        "industry.electronics_communications.productivity",
        1,
      ),
    ).toBeGreaterThan(1);
    expect(
      applyModifiers(engine.getState().nation, "trade.exportCompetitiveness", 1),
    ).toBeGreaterThan(1.05);
  });

  it("四三方案在1973年触发，兼具成套引进收益与外汇财政代价", () => {
    const event = historicalEventDefinitions.find(
      (item) => item.id === "four_three_plan_1973",
    );
    expect(event).toMatchObject({
      year: 1973,
      month: 1,
      category: "对外经济",
      impact: "mixed",
      durationMonths: 96,
    });
    expect(event?.description).toContain("43亿美元");
    expect(event?.effects.some((item) => item.includes("化肥"))).toBe(true);
    expect(event?.effects.some((item) => item.includes("外债"))).toBe(true);
    expect(
      event?.modifiers.some(
        (modifier) =>
          modifier.target === "trade.externalBorrowing" &&
          modifier.operation === "add" &&
          modifier.value > 0,
      ),
    ).toBe(true);
    expect(
      event?.modifiers.some(
        (modifier) =>
          modifier.target === "industry.chemicals_pharmaceuticals.productivity" &&
          (modifier.delayMonths ?? 0) > 0,
      ),
    ).toBe(true);

    const state = createInitialGameState(1973, 1973);
    state.nation.date.month = 1;
    const engine = createSimulationEngine(state);
    const beforeDebt = engine.getState().nation.trade.externalDebt;
    const beforeCoverage = engine.getState().nation.trade.capitalGoodsImportCoverage;
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });

    const nation = engine.getState().nation;
    expect(nation.history.historicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "four_three_plan_1973",
          outcome: "occurred",
        }),
      ]),
    );
    expect(
      nation.modifiers.some(
        (modifier) =>
          modifier.sourceId === "four_three_plan_1973" &&
          modifier.target === "fiscal.spending" &&
          modifier.value > 1,
      ),
    ).toBe(true);
    expect(nation.trade.externalDebt).toBeGreaterThan(beforeDebt);
    expect(nation.trade.capitalGoodsImportCoverage).toBeLessThan(beforeCoverage);

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 48 });
    expect(
      applyModifiers(engine.getState().nation, "resources.foodSupply", 1),
    ).toBeGreaterThan(1);
    expect(
      applyModifiers(
        engine.getState().nation,
        "industry.chemicals_pharmaceuticals.productivity",
        1,
      ),
    ).toBeGreaterThan(1);
  });

  it("仅亲苏路线在1960年7月触发中苏交恶，且三选一对苏冲击可区分", () => {
    const choices = getHistoricalEventChoices("sino_soviet_split_1960");
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "restrained_conciliation",
      "accelerate_self_reliance",
    ]);

    const balanced = createInitialGameState(1960, 1960, "interactive");
    balanced.nation.date.month = 7;
    const balancedEngine = createSimulationEngine(balanced);
    balancedEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(balancedEngine.getState().nation.pendingHistoricalEventId).not.toBe(
      "sino_soviet_split_1960",
    );
    expect(
      balancedEngine.getState().nation.history.historicalEvents.some(
        (event) => event.id === "sino_soviet_split_1960",
      ),
    ).toBe(false);

    const runSplit = (choiceId: string) => {
      const state = createInitialGameState(1960, 1960, "interactive");
      state.nation.date.month = 7;
      state.nation.diplomacy.strategyId = "pro_soviet";
      state.nation.diplomacy.strategyAlignment = -1;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      expect(engine.getState().nation.pendingHistoricalEventId).toBe(
        "sino_soviet_split_1960",
      );
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "sino_soviet_split_1960",
        choiceId,
      });
      advanceMonthsDismissingFamineReports(engine, 1);
      return engine.getState();
    };

    const historical = runSplit("historical_path");
    const restrained = runSplit("restrained_conciliation");
    const selfReliance = runSplit("accelerate_self_reliance");
    const russiaRelation = (state: typeof historical) =>
      state.world.countries.find((country) => country.id === "russia")
        ?.relationWithChina ?? Number.NaN;

    expect(russiaRelation(historical)).toBeLessThan(russiaRelation(restrained));
    expect(russiaRelation(selfReliance)).toBeLessThanOrEqual(
      russiaRelation(historical),
    );
    expect(historical.nation.trade.capitalGoodsImportCoverage).toBeLessThan(
      restrained.nation.trade.capitalGoodsImportCoverage,
    );
    expect(selfReliance.nation.trade.capitalGoodsImportCoverage).toBeLessThan(
      historical.nation.trade.capitalGoodsImportCoverage,
    );
    expect(
      applyModifiers(historical.nation, "technology.researchOutput", 1),
    ).toBeLessThan(
      applyModifiers(restrained.nation, "technology.researchOutput", 1),
    );
  });

  it("北戴河还债需交恶且朝战已爆发，三选一改变偿债计划与民生代价", () => {
    const choices = getHistoricalEventChoices(
      "soviet_debt_repayment_beidaihe_1960",
    );
    expect(choices.map((choice) => choice.id)).toEqual([
      "historical_path",
      "moderate_schedule",
      "ten_year_no_early",
    ]);

    const seedHistory = (
      state: GameState,
      koreanOutcome: "occurred" | "prevented",
      includeSplit: boolean,
    ) => {
      state.nation.history.historicalEvents.push({
        id: "korean_war_1950",
        name: "朝鲜战争",
        year: 1950,
        month: 6,
        scheduledYear: 1950,
        scheduledMonth: 6,
        category: "外部冲击",
        impact: "mixed",
        description: "test",
        effects: [],
        durationMonths: 37,
        choiceId:
          koreanOutcome === "prevented"
            ? "oppose_korean_war"
            : "historical_path",
        choiceName: koreanOutcome === "prevented" ? "劝阻开战" : "史实参战",
        choiceDescription: "test",
        outcome: koreanOutcome,
      });
      if (includeSplit) {
        state.nation.history.historicalEvents.push({
          id: "sino_soviet_split_1960",
          name: "中苏交恶",
          year: 1960,
          month: 7,
          scheduledYear: 1960,
          scheduledMonth: 7,
          category: "外交",
          impact: "negative",
          description: "test",
          effects: [],
          durationMonths: 60,
          choiceId: "historical_path",
          choiceName: "遵循历史路径",
          choiceDescription: "test",
          outcome: "occurred",
        });
      }
      state.nation.diplomacy.strategyId = "pro_soviet";
      state.nation.diplomacy.strategyAlignment = -1;
      state.nation.date.year = 1960;
      state.nation.date.month = 8;
    };

    const blockedByPreventedWar = createInitialGameState(1960, 1960, "interactive");
    seedHistory(blockedByPreventedWar, "prevented", true);
    const blockedEngine = createSimulationEngine(blockedByPreventedWar);
    blockedEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(blockedEngine.getState().nation.pendingHistoricalEventId).not.toBe(
      "soviet_debt_repayment_beidaihe_1960",
    );

    const blockedWithoutSplit = createInitialGameState(1960, 1960, "interactive");
    seedHistory(blockedWithoutSplit, "occurred", false);
    const noSplitEngine = createSimulationEngine(blockedWithoutSplit);
    noSplitEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(noSplitEngine.getState().nation.pendingHistoricalEventId).not.toBe(
      "soviet_debt_repayment_beidaihe_1960",
    );

    const runDebtChoice = (choiceId: string) => {
      const state = createInitialGameState(1960, 1960, "interactive");
      seedHistory(state, "occurred", true);
      state.nation.trade.externalDebt = 5_000_000_000;
      const engine = createSimulationEngine(state);
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      expect(engine.getState().nation.pendingHistoricalEventId).toBe(
        "soviet_debt_repayment_beidaihe_1960",
      );
      engine.dispatch({
        type: "RESOLVE_HISTORICAL_EVENT",
        eventId: "soviet_debt_repayment_beidaihe_1960",
        choiceId,
      });
      advanceMonthsDismissingFamineReports(engine, 3);
      return engine.getState();
    };

    const fiveYear = runDebtChoice("historical_path");
    const moderate = runDebtChoice("moderate_schedule");
    const tenYear = runDebtChoice("ten_year_no_early");

    expect(fiveYear.nation.trade.sovietDebtRepaymentPlan).toBe("five_year_early");
    expect(moderate.nation.trade.sovietDebtRepaymentPlan).toBe("moderate");
    expect(tenYear.nation.trade.sovietDebtRepaymentPlan).toBe("ten_year");
    expect(fiveYear.nation.policies).toContain(
      "soviet_debt_austerity_repayment",
    );
    expect(moderate.nation.policies).not.toContain(
      "soviet_debt_austerity_repayment",
    );
    expect(tenYear.nation.policies).not.toContain(
      "soviet_debt_austerity_repayment",
    );

    expect(fiveYear.nation.trade.externalDebt).toBeLessThan(
      moderate.nation.trade.externalDebt,
    );
    expect(moderate.nation.trade.externalDebt).toBeLessThan(
      tenYear.nation.trade.externalDebt,
    );
    expect(fiveYear.nation.resources.foodSupplyRatio).toBeLessThan(
      moderate.nation.resources.foodSupplyRatio,
    );
    expect(moderate.nation.resources.foodSupplyRatio).toBeLessThan(
      tenYear.nation.resources.foodSupplyRatio,
    );
  });
});
