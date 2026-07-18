import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { ensureDiplomacyState } from "./diplomacy";
import {
  foreignAidProgramCooldownRemaining,
  foreignAidProgramDefinitions,
  foreignAidProgramEffects,
  foreignAidRelationTargetAdjustment,
  historicalForeignAidTotalsThrough1980,
  validateForeignAidPrograms,
} from "./foreign-aid";

function relation(
  state: ReturnType<typeof createInitialGameState>,
  countryId: string,
): number {
  return state.world.countries.find((country) => country.id === countryId)
    ?.relationWithChina ?? Number.NaN;
}

describe("可选对外援助方案", () => {
  it("提供暂停、人道、伙伴、发展、史实、经贸和扩大援助七种方案", () => {
    const countryIds = new Set(
      createInitialGameState(1949).world.countries.map((country) => country.id),
    );
    expect(() => validateForeignAidPrograms(countryIds)).not.toThrow();
    expect(foreignAidProgramDefinitions).toHaveLength(7);
    expect(foreignAidProgramDefinitions.map((program) => program.id)).toEqual([
      "suspended",
      "limited_humanitarian",
      "socialist_solidarity",
      "south_south_development",
      "historical_comprehensive",
      "economic_technical_cooperation",
      "expanded_internationalist",
    ]);
  });

  it("史实方案在1950至1980年累计约355亿元和165亿美元", () => {
    const configured = historicalForeignAidTotalsThrough1980();
    expect(configured.rmb).toBeCloseTo(35_500_000_000, -2);
    expect(configured.usd).toBeGreaterThan(15_000_000_000);
    expect(configured.usd).toBeLessThan(18_000_000_000);

    const engine = createSimulationEngine(
      createInitialGameState(1949, 1949, "automatic"),
    );
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 384 });
    const diplomacy = engine.getState().nation.diplomacy;
    expect(diplomacy.cumulativeForeignAidRMBThrough1980)
      .toBeCloseTo(35_500_000_000, -2);
    expect(diplomacy.cumulativeForeignAidUSDThrough1980)
      .toBeCloseTo(configured.usd, -2);
  });

  it("玩家可在援助开始前停止援助并释放国内资源但损失伙伴关系和出口网络", () => {
    const historicalEngine = createSimulationEngine(
      createInitialGameState(1949, 1949, "automatic"),
    );
    const suspendedEngine = createSimulationEngine(
      createInitialGameState(1949, 1949, "automatic"),
    );
    suspendedEngine.dispatch({
      type: "SET_FOREIGN_AID_PROGRAM",
      programId: "suspended",
    });
    historicalEngine.dispatch({ type: "ADVANCE_MONTHS", months: 384 });
    suspendedEngine.dispatch({ type: "ADVANCE_MONTHS", months: 384 });
    const historical = historicalEngine.getState();
    const suspended = suspendedEngine.getState();

    expect(suspended.nation.diplomacy.cumulativeForeignAidRMBThrough1980).toBe(0);
    expect(suspended.nation.economy.realGDP).toBeGreaterThan(
      historical.nation.economy.realGDP,
    );
    expect(suspended.nation.economy.capitalStock).toBeGreaterThan(
      historical.nation.economy.capitalStock,
    );
    expect(suspended.nation.technology.index).toBeGreaterThan(
      historical.nation.technology.index,
    );
    expect(suspended.nation.trade.foreignExchangeReserves).toBeGreaterThan(
      historical.nation.trade.foreignExchangeReserves,
    );
    expect(suspended.nation.trade.exports).toBeLessThan(
      historical.nation.trade.exports,
    );
    expect(relation(suspended, "north_korea")).toBeLessThan(
      relation(historical, "north_korea"),
    );
    expect(relation(suspended, "vietnam")).toBeLessThan(
      relation(historical, "vietnam"),
    );
  });

  it("不同援助方向只对相应国家和中间变量形成不同反馈", () => {
    const socialist = createInitialGameState(1949).nation;
    socialist.diplomacy.foreignAidProgramId = "socialist_solidarity";
    socialist.diplomacy.foreignAidProgramProgress = 1;
    const development = structuredClone(socialist);
    development.diplomacy.foreignAidProgramId = "south_south_development";

    expect(foreignAidRelationTargetAdjustment(socialist, "north_korea"))
      .toBeGreaterThan(foreignAidRelationTargetAdjustment(development, "north_korea"));
    expect(foreignAidRelationTargetAdjustment(development, "south_africa"))
      .toBeGreaterThan(foreignAidRelationTargetAdjustment(socialist, "south_africa"));
    expect(foreignAidRelationTargetAdjustment(development, "usa")).toBe(0);
    expect(foreignAidProgramEffects(development).industrialProductivityMultiplier)
      .toBeGreaterThan(1);
    expect(foreignAidProgramEffects(socialist).researchOutputMultiplier)
      .toBeLessThan(1);
  });

  it("调整援助方案消耗外交点并触发两年冷却和一年过渡", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    const before = engine.getState().nation.diplomacy.diplomaticPoints;
    engine.dispatch({
      type: "SET_FOREIGN_AID_PROGRAM",
      programId: "limited_humanitarian",
    });
    let nation = engine.getState().nation;
    expect(nation.diplomacy.diplomaticPoints).toBe(before - 3);
    expect(nation.diplomacy.foreignAidProgramProgress).toBe(0);
    expect(foreignAidProgramCooldownRemaining(nation)).toBe(24);
    expect(() => engine.dispatch({
      type: "SET_FOREIGN_AID_PROGRAM",
      programId: "suspended",
    })).toThrow(/冷却/);

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    nation = engine.getState().nation;
    expect(nation.diplomacy.foreignAidProgramProgress).toBeCloseTo(1);
    expect(nation.diplomacy.previousForeignAidProgramId).toBeNull();
  });

  it("旧存档缺少援助字段时按史实方案和已推进月份确定性迁移", () => {
    const state = createInitialGameState(1949);
    state.nation.date.year = 1971;
    state.nation.date.month = 1;
    state.nation.date.elapsedMonths = 264;
    const legacyDiplomacy = state.nation.diplomacy as Partial<
      typeof state.nation.diplomacy
    >;
    delete legacyDiplomacy.foreignAidProgramId;
    delete legacyDiplomacy.previousForeignAidProgramId;
    delete legacyDiplomacy.foreignAidProgramProgress;
    delete legacyDiplomacy.lastForeignAidProgramChangeMonth;
    delete legacyDiplomacy.annualForeignAidRMB;
    delete legacyDiplomacy.annualForeignAidUSD;
    delete legacyDiplomacy.annualForeignAidForeignExchangeOutflow;
    delete legacyDiplomacy.cumulativeForeignAidRMB;
    delete legacyDiplomacy.cumulativeForeignAidUSD;
    delete legacyDiplomacy.cumulativeForeignAidRMBThrough1980;
    delete legacyDiplomacy.cumulativeForeignAidUSDThrough1980;

    ensureDiplomacyState(state);

    expect(state.nation.diplomacy.foreignAidProgramId)
      .toBe("historical_comprehensive");
    expect(state.nation.diplomacy.cumulativeForeignAidRMBThrough1980)
      .toBeCloseTo(16_520_000_000, -2);
  });
});
