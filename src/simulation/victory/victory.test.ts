import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { calculateWorldRankings } from "../world/rankings";
import {
  checkVictoryCondition,
  ensureVictoryState,
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
    state.nation.victoryYear = undefined as never;
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
    } else {
      expect(state.nation.victoryYear).toBeNull();
    }
  });
});
