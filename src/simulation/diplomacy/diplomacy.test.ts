import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { calculateTradeAccess, updateInternationalTrade } from "../economy/trade";
import { createInitialGameState } from "../state/initial-state";
import { enactHistoricalEventEarly } from "../events/historical-event-engine";
import { getInternationalOrganizationStatus, updateDiplomacy } from "./diplomacy";
import { updateTechnology } from "../technology/research";
import {
  diplomaticStrategyEffects,
  diplomaticStrategyDefinitions,
} from "./diplomatic-strategy";

describe("外交与国际贸易", () => {
  it("三种外交战略互斥，切换消耗点数并受五年冷却约束", () => {
    expect(diplomaticStrategyDefinitions.map((strategy) => strategy.id)).toEqual([
      "pro_soviet",
      "balanced",
      "pro_western",
    ]);
    const state = createInitialGameState(1949);
    state.nation.diplomacy.diplomaticPoints = 100;
    const engine = createSimulationEngine(state);
    engine.dispatch({
      type: "SET_DIPLOMATIC_STRATEGY",
      strategyId: "pro_western",
    });

    expect(engine.getState().nation.diplomacy).toMatchObject({
      strategyId: "pro_western",
      strategyAlignment: 0,
      diplomaticPoints: 85,
      lastStrategyChangeMonth: 0,
    });
    expect(() =>
      engine.dispatch({
        type: "SET_DIPLOMATIC_STRATEGY",
        strategyId: "balanced",
      }),
    ).toThrow("冷却 60 个月");

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 36 });
    expect(engine.getState().nation.diplomacy.strategyAlignment).toBeCloseTo(1);
  });

  it("亲苏与亲西方路线会以相反方向改变主要大国关系和安全", () => {
    const balanced = createInitialGameState(1);
    const proSoviet = structuredClone(balanced);
    const proWestern = structuredClone(balanced);
    proSoviet.nation.diplomacy.strategyId = "pro_soviet";
    proSoviet.nation.diplomacy.strategyAlignment = -1;
    proWestern.nation.diplomacy.strategyId = "pro_western";
    proWestern.nation.diplomacy.strategyAlignment = 1;

    updateDiplomacy(balanced);
    updateDiplomacy(proSoviet);
    updateDiplomacy(proWestern);
    const relation = (state: typeof balanced, countryId: string) =>
      state.world.countries.find((country) => country.id === countryId)?.relationWithChina ?? 0;

    expect(relation(proSoviet, "russia")).toBeGreaterThan(relation(balanced, "russia"));
    expect(relation(proSoviet, "usa")).toBeLessThan(relation(balanced, "usa"));
    expect(relation(proWestern, "usa")).toBeGreaterThan(relation(balanced, "usa"));
    expect(relation(proWestern, "russia")).toBeLessThan(relation(balanced, "russia"));
    expect(proSoviet.nation.diplomacy.securityIndex).toBeGreaterThan(
      balanced.nation.diplomacy.securityIndex,
    );
    expect(proWestern.nation.diplomacy.securityIndex).toBeLessThan(
      balanced.nation.diplomacy.securityIndex,
    );
  });

  it("外交路线通过贸易准入、外资和科技渠道形成差异", () => {
    const balanced = createInitialGameState(2);
    const proSoviet = structuredClone(balanced);
    const proWestern = structuredClone(balanced);
    proSoviet.nation.diplomacy.strategyId = "pro_soviet";
    proSoviet.nation.diplomacy.strategyAlignment = -1;
    proWestern.nation.diplomacy.strategyId = "pro_western";
    proWestern.nation.diplomacy.strategyAlignment = 1;
    for (const state of [balanced, proSoviet, proWestern]) {
      state.nation.trade.foreignInvestment = 1_000_000_000;
      state.nation.trade.openness = 0.5;
      state.nation.education.literacyRate = 0.8;
      state.nation.technology.index = 20;
    }

    expect(calculateTradeAccess(proWestern).marketAccessMultiplier).toBeGreaterThan(
      calculateTradeAccess(balanced).marketAccessMultiplier,
    );
    expect(calculateTradeAccess(proSoviet).marketAccessMultiplier).toBeLessThan(
      calculateTradeAccess(balanced).marketAccessMultiplier,
    );
    updateInternationalTrade(balanced);
    updateInternationalTrade(proSoviet);
    updateInternationalTrade(proWestern);
    expect(proWestern.nation.trade.foreignInvestment).toBeGreaterThan(
      balanced.nation.trade.foreignInvestment,
    );
    expect(proSoviet.nation.trade.foreignInvestment).toBeLessThan(
      balanced.nation.trade.foreignInvestment,
    );

    updateTechnology(balanced.nation);
    updateTechnology(proSoviet.nation);
    updateTechnology(proWestern.nation);
    expect(proSoviet.nation.technology.monthlyResearchOutput).toBeGreaterThan(
      balanced.nation.technology.monthlyResearchOutput,
    );
    expect(proWestern.nation.technology.index).toBeGreaterThan(
      balanced.nation.technology.index,
    );
    expect(diplomaticStrategyEffects(proWestern.nation).technologyDiffusionMultiplier)
      .toBeGreaterThan(diplomaticStrategyEffects(proSoviet.nation).technologyDiffusionMultiplier);
  });
  it("外交行动消耗点数、改变关系并受冷却期约束", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    const before = engine.getState().world.countries.find(
      (country) => country.id === "usa",
    );
    const initialRelation = before?.relationWithChina ?? 0;

    engine.dispatch({
      type: "DIPLOMATIC_ACTION",
      actionId: "improve_relations",
      countryId: "usa",
    });
    const state = engine.getState();
    const after = state.world.countries.find((country) => country.id === "usa");
    expect(after?.relationWithChina).toBe(initialRelation + 12);
    expect(state.nation.diplomacy.diplomaticPoints).toBe(23);
    expect(() =>
      engine.dispatch({
        type: "DIPLOMATIC_ACTION",
        actionId: "improve_relations",
        countryId: "usa",
      }),
    ).toThrow("冷却");
  });

  it("贸易协定和战略伙伴关系具有关系门槛及前置条件", () => {
    const state = createInitialGameState(1949);
    const country = state.world.countries.find((item) => item.id === "india");
    if (!country) throw new Error("测试国家不存在");
    country.relationWithChina = 34;
    state.nation.diplomacy.diplomaticPoints = 100;
    const engine = createSimulationEngine(state);

    expect(() =>
      engine.dispatch({
        type: "DIPLOMATIC_ACTION",
        actionId: "sign_trade_agreement",
        countryId: "india",
      }),
    ).toThrow("达到 35");

    const eligible = engine.exportState();
    const eligibleCountry = eligible.world.countries.find(
      (item) => item.id === "india",
    );
    if (!eligibleCountry) throw new Error("测试国家不存在");
    eligibleCountry.relationWithChina = 65;
    const eligibleEngine = createSimulationEngine(eligible);
    expect(() =>
      eligibleEngine.dispatch({
        type: "DIPLOMATIC_ACTION",
        actionId: "strategic_partnership",
        countryId: "india",
      }),
    ).toThrow("先签署贸易协定");
  });

  it("贸易协定提高市场准入和出口，制裁产生相反效果", () => {
    const baseline = createInitialGameState(1949);
    const agreement = structuredClone(baseline);
    const sanctioned = structuredClone(baseline);
    for (const state of [baseline, agreement, sanctioned]) {
      const country = state.world.countries.find((item) => item.id === "usa");
      if (!country) throw new Error("测试国家不存在");
      country.relationWithChina = 40;
    }
    const agreementCountry = agreement.world.countries.find(
      (item) => item.id === "usa",
    );
    const sanctionedCountry = sanctioned.world.countries.find(
      (item) => item.id === "usa",
    );
    if (!agreementCountry || !sanctionedCountry) throw new Error("测试国家不存在");
    agreementCountry.tradeAgreement = true;
    agreementCountry.diplomaticStatus = "partner";
    sanctionedCountry.sanctionLevel = 0.8;
    sanctionedCountry.diplomaticStatus = "sanctioned";

    expect(calculateTradeAccess(agreement).marketAccessMultiplier).toBeGreaterThan(
      calculateTradeAccess(baseline).marketAccessMultiplier,
    );
    expect(calculateTradeAccess(sanctioned).marketAccessMultiplier).toBeLessThan(
      calculateTradeAccess(baseline).marketAccessMultiplier,
    );

    updateInternationalTrade(baseline);
    updateInternationalTrade(agreement);
    updateInternationalTrade(sanctioned);
    expect(agreement.nation.trade.exports).toBeGreaterThan(
      baseline.nation.trade.exports,
    );
    expect(sanctioned.nation.trade.exports).toBeLessThan(
      baseline.nation.trade.exports,
    );
  });

  it("世界贸易组织在复关进程和外交条件达成后自动解锁", () => {
    const tooEarly = createInitialGameState(1949);
    expect(
      getInternationalOrganizationStatus(tooEarly, "world_trade_organization").blockers,
    ).toContain("最早可在 1995 年取得资格");

    const missingApplication = createInitialGameState(1995, 1995);
    missingApplication.nation.internationalInfluence = 50;
    missingApplication.nation.trade.openness = 0.5;
    missingApplication.nation.diplomacy.diplomaticPoints = 100;
    for (const country of missingApplication.world.countries) {
      country.relationWithChina = 30;
      country.tradeAgreement = true;
    }
    expect(
      getInternationalOrganizationStatus(
        missingApplication,
        "world_trade_organization",
      ).blockers,
    ).toContain("需先完成提交恢复关贸总协定缔约方地位申请");

    const eligible = createInitialGameState(1986, 1986);
    enactHistoricalEventEarly(
      eligible.nation,
      "gatt_accession_application_1986",
      "test:gatt-application",
      "测试复关进程前置条件",
      [],
    );
    eligible.nation.date.year = 1995;
    eligible.nation.date.month = 1;
    eligible.nation.date.elapsedMonths = (1995 - 1949) * 12;
    eligible.nation.internationalInfluence = 50;
    eligible.nation.trade.openness = 0.5;
    eligible.nation.diplomacy.diplomaticPoints = 100;
    for (const country of eligible.world.countries) country.relationWithChina = 30;
    for (const country of eligible.world.countries.slice(0, 3)) {
      country.tradeAgreement = true;
    }
    const engine = createSimulationEngine(eligible);
    expect(() =>
      engine.dispatch({
        type: "JOIN_ORGANIZATION",
        organizationId: "world_trade_organization",
      }),
    ).toThrow("自动解锁");
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    const joined = engine.getState();
    expect(joined.nation.diplomacy.organizationIds).toContain(
      "world_trade_organization",
    );
    expect(joined.nation.diplomacy.diplomaticPoints).toBe(100);
    expect(joined.nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "wto_accession_2001",
      year: 1995,
      scheduledYear: 2001,
      outcome: "enacted_early",
    });
  });

  it("联合国席位仅在足够国家形成外交支持后自动触发", () => {
    const insufficient = createInitialGameState(1965, 1965);
    insufficient.nation.diplomacy.diplomaticPoints = 100;
    const insufficientEngine = createSimulationEngine(insufficient);
    insufficientEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(insufficientEngine.getState().nation.diplomacy.organizationIds).not.toContain(
      "united_nations",
    );
    expect(
      insufficientEngine.getState().nation.history.historicalEvents.some(
        (event) => event.id === "un_seat_restored_1971",
      ),
    ).toBe(false);

    const eligible = createInitialGameState(1965, 1965);
    eligible.nation.diplomacy.diplomaticPoints = 100;
    for (const country of eligible.world.countries) country.relationWithChina = 25;
    const engine = createSimulationEngine(eligible);
    expect(() =>
      engine.dispatch({
        type: "JOIN_ORGANIZATION",
        organizationId: "united_nations",
      }),
    ).toThrow("自动解锁");
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });

    expect(engine.getState().nation.diplomacy.organizationIds).toContain(
      "united_nations",
    );
    expect(engine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "un_seat_restored_1971",
      year: 1965,
      scheduledYear: 1971,
      outcome: "enacted_early",
    });
    expect(engine.getState().nation.diplomacy.diplomaticPoints).toBe(100);
  });

  it("条件不足时不会因到达史实日期直接取得联合国席位或世贸成员资格", () => {
    const unState = createInitialGameState(1971, 1971);
    unState.nation.date.month = 10;
    unState.nation.date.elapsedMonths = (1971 - 1949) * 12 + 9;
    const unEngine = createSimulationEngine(unState);
    unEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(unEngine.getState().nation.diplomacy.organizationIds).not.toContain(
      "united_nations",
    );
    expect(
      unEngine.getState().nation.history.historicalEvents.some(
        (event) => event.id === "un_seat_restored_1971",
      ),
    ).toBe(false);

    const wtoState = createInitialGameState(2001, 2001);
    wtoState.nation.date.month = 12;
    wtoState.nation.date.elapsedMonths = (2001 - 1949) * 12 + 11;
    const wtoEngine = createSimulationEngine(wtoState);
    wtoEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(wtoEngine.getState().nation.diplomacy.organizationIds).not.toContain(
      "world_trade_organization",
    );
    expect(
      wtoEngine.getState().nation.history.historicalEvents.some(
        (event) => event.id === "wto_accession_2001",
      ),
    ).toBe(false);
  });

  it("错过史实日期后仍会在外交条件实际达成时自动取得资格", () => {
    const eligible = createInitialGameState(1975, 1975);
    eligible.nation.diplomacy.diplomaticPoints = 7;
    for (const country of eligible.world.countries) country.relationWithChina = 25;
    const engine = createSimulationEngine(eligible);

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });

    expect(engine.getState().nation.diplomacy.organizationIds).toContain(
      "united_nations",
    );
    expect(engine.getState().nation.history.historicalEvents.at(-1)).toMatchObject({
      id: "un_seat_restored_1971",
      year: 1975,
      scheduledYear: 1971,
      outcome: "occurred",
    });
    expect(engine.getState().nation.diplomacy.diplomaticPoints).toBeGreaterThanOrEqual(7);
  });

  it("国防投入通过安全指数和外交资源发挥作用", () => {
    const lowDefense = createInitialGameState(1);
    const highDefense = structuredClone(lowDefense);
    lowDefense.nation.fiscal.budget.defense = 0.02;
    highDefense.nation.fiscal.budget.defense = 0.3;
    updateDiplomacy(lowDefense);
    updateDiplomacy(highDefense);

    expect(highDefense.nation.diplomacy.securityIndex).toBeGreaterThan(
      lowDefense.nation.diplomacy.securityIndex,
    );
    expect(highDefense.nation.diplomacy.monthlyPointGain).toBeGreaterThan(
      lowDefense.nation.diplomacy.monthlyPointGain,
    );
  });

  it("旧存档缺少外交字段时可自动迁移并继续运行", () => {
    const state = createInitialGameState(1949);
    delete (state.nation as Partial<typeof state.nation>).diplomacy;
    const country = state.world.countries[0] as Partial<
      typeof state.world.countries[number]
    >;
    delete country.relationWithChina;
    delete country.diplomaticStatus;
    delete country.tradeAgreement;
    delete country.sanctionLevel;
    delete country.lastDiplomaticActionMonth;

    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.diplomacy.diplomaticPoints).toBeGreaterThan(0);
    expect(engine.getState().nation.diplomacy.strategyId).toBe("balanced");
    expect(engine.getState().nation.diplomacy.strategyAlignment).toBe(0);
    expect(
      Number.isFinite(engine.getState().world.countries[0].relationWithChina),
    ).toBe(true);
  });
});
