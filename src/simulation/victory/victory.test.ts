import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { calculateWorldRankings } from "../world/rankings";
import {
  checkVictoryCondition,
  ensureVictoryState,
  hasRecordedVictory,
  inferVictoryYearFromHistory,
  isWorldGdpLeader,
} from "./victory";

describe("victory", () => {
  it("开局尚未达成全球 GDP 第一", () => {
    const state = createInitialGameState(1949);
    expect(state.nation.victoryYear).toBeNull();
    expect(isWorldGdpLeader(state)).toBe(false);
  });

  it("首次登顶时记录胜利年份且不再改写", () => {
    const state = createInitialGameState(1949);
    state.nation.date.year = 2010;
    state.world.rankings.nominalGDP.china = 1;

    checkVictoryCondition(state);
    expect(state.nation.victoryYear).toBe(2010);

    state.nation.date.year = 2015;
    checkVictoryCondition(state);
    expect(state.nation.victoryYear).toBe(2010);
  });

  it("可从年度历史回填胜利年份", () => {
    const state = createInitialGameState(1949);
    delete (state.nation as { victoryYear?: number | null }).victoryYear;
    state.nation.history.annual.push({
      year: 2008,
      month: 12,
      gdpRank: 2,
    } as never);
    state.nation.history.annual.push({
      year: 2010,
      month: 12,
      gdpRank: 1,
    } as never);
    state.nation.history.annual.push({
      year: 2012,
      month: 12,
      gdpRank: 1,
    } as never);

    ensureVictoryState(state);
    expect(state.nation.victoryYear).toBe(2010);
    expect(inferVictoryYearFromHistory(state)).toBe(2010);
  });

  it("年度排名结算后可触发胜利检测", () => {
    const state = createInitialGameState(1949);
    state.nation.economy.realGDP = 1e15;
    state.nation.economy.internationalComparableGDP = 1e15;
    calculateWorldRankings(state);
    checkVictoryCondition(state);
    if (isWorldGdpLeader(state)) {
      expect(state.nation.victoryYear).toBe(state.nation.date.year);
      expect(hasRecordedVictory(state)).toBe(true);
    } else {
      expect(state.nation.victoryYear).toBeNull();
      expect(hasRecordedVictory(state)).toBe(false);
    }
  });

  it("IMPORT_GAME 路径会补齐缺失的 victoryYear", () => {
    const legacy = createInitialGameState(2010);
    delete (legacy.nation as { victoryYear?: number | null }).victoryYear;
    legacy.nation.history.annual.push({
      year: 2018,
      month: 12,
      gdpRank: 1,
    } as never);

    const engine = createSimulationEngine(createInitialGameState(1));
    engine.dispatch({ type: "IMPORT_GAME", state: legacy });

    expect(engine.getState().nation.victoryYear).toBe(2018);
    expect(hasRecordedVictory(engine.getState())).toBe(true);
  });

  it("undefined victoryYear 不应视为已获胜", () => {
    const state = createInitialGameState(1949);
    delete (state.nation as { victoryYear?: number | null }).victoryYear;
    expect(hasRecordedVictory(state)).toBe(false);
  });
});
