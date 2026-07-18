import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { calculateTradeAccess, updateInternationalTrade } from "../economy/trade";
import { createInitialGameState } from "../state/initial-state";
import { updateDiplomacy } from "./diplomacy";

describe("外交与国际贸易", () => {
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

  it("国际组织受年份和发展条件限制，加入后提供持续收益", () => {
    const tooEarly = createSimulationEngine(createInitialGameState(1949));
    expect(() =>
      tooEarly.dispatch({
        type: "JOIN_ORGANIZATION",
        organizationId: "world_trade_organization",
      }),
    ).toThrow("2001 年");

    const eligible = createInitialGameState(2001, 2001);
    eligible.nation.internationalInfluence = 50;
    eligible.nation.trade.openness = 0.5;
    eligible.nation.diplomacy.diplomaticPoints = 100;
    for (const country of eligible.world.countries) country.relationWithChina = 10;
    const engine = createSimulationEngine(eligible);
    engine.dispatch({
      type: "JOIN_ORGANIZATION",
      organizationId: "world_trade_organization",
    });
    const joined = engine.getState();
    expect(joined.nation.diplomacy.organizationIds).toContain(
      "world_trade_organization",
    );
    expect(joined.nation.diplomacy.diplomaticPoints).toBe(55);
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
    expect(
      Number.isFinite(engine.getState().world.countries[0].relationWithChina),
    ).toBe(true);
  });
});
