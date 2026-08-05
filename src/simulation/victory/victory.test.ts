import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  checkVictoryCondition,
  ensureVictoryState,
  evaluateVictoryPaths,
  hasRecordedVictory,
  inferVictoryYearFromHistory,
  isWorldGdpLeader,
  requiredVictoryYears,
} from "./victory";

function qualifyEconomicLeadership(state: ReturnType<typeof createInitialGameState>): void {
  state.world.rankings.nominalGDP.china = 1;
  state.world.rankings.nominalGDPPerCapita.china = 40;
  state.nation.society.happinessIndex = 70;
  state.nation.fiscal.debtToGDP = 0.6;
}

function qualifyCommonProsperity(state: ReturnType<typeof createInitialGameState>): void {
  state.nation.economy.currentUSDGDPPerCapita = 25_000;
  state.nation.society.povertyRate = 0.02;
  state.nation.society.giniCoefficient = 0.35;
  state.nation.society.happinessIndex = 80;
  state.nation.health.lifeExpectancy = 81;
}

describe("持续保持型胜利", () => {
  it("开局三条路线均处于建设阶段", () => {
    const state = createInitialGameState(1949);
    expect(state.nation.victoryYear).toBeNull();
    expect(hasRecordedVictory(state)).toBe(false);
    expect(isWorldGdpLeader(state)).toBe(false);
    expect(evaluateVictoryPaths(state)).toHaveLength(3);
    expect(Object.values(state.nation.victory.paths).every(
      (progress) => progress.stage === "building",
    )).toBe(true);
  });

  it("经济领航必须连续满足全部门槛五年", () => {
    const state = createInitialGameState(1949);
    qualifyEconomicLeadership(state);

    for (let offset = 0; offset < requiredVictoryYears - 1; offset += 1) {
      state.nation.date.year = 2010 + offset;
      checkVictoryCondition(state);
      expect(hasRecordedVictory(state)).toBe(false);
    }
    expect(state.nation.victory.paths.economic_leadership.stage).toBe("sustaining");

    state.nation.date.year = 2010 + requiredVictoryYears - 1;
    checkVictoryCondition(state);
    expect(state.nation.victory.achievedPathId).toBe("economic_leadership");
    expect(state.nation.victoryYear).toBe(2014);
  });

  it("失守任一门槛会中断连续年份但保留最佳纪录", () => {
    const state = createInitialGameState(1949);
    qualifyEconomicLeadership(state);
    state.nation.date.year = 2010;
    checkVictoryCondition(state);
    state.nation.date.year = 2011;
    checkVictoryCondition(state);

    state.nation.society.happinessIndex = 50;
    state.nation.date.year = 2012;
    checkVictoryCondition(state);

    const progress = state.nation.victory.paths.economic_leadership;
    expect(progress.consecutiveQualifiedYears).toBe(0);
    expect(progress.bestConsecutiveYears).toBe(2);
    expect(progress.stage).toBe("building");
  });

  it("共同富裕可独立于 GDP 第一完成胜利", () => {
    const state = createInitialGameState(1949);
    state.world.rankings.nominalGDP.china = 8;
    qualifyCommonProsperity(state);
    for (let offset = 0; offset < requiredVictoryYears; offset += 1) {
      state.nation.date.year = 2020 + offset;
      checkVictoryCondition(state);
    }
    expect(state.nation.victory.achievedPathId).toBe("common_prosperity");
    expect(state.nation.victory.achievedYear).toBe(2024);
  });

  it("同一年重复检查不会重复累计", () => {
    const state = createInitialGameState(1949);
    qualifyEconomicLeadership(state);
    state.nation.date.year = 2010;
    checkVictoryCondition(state);
    checkVictoryCondition(state);
    expect(state.nation.victory.paths.economic_leadership.consecutiveQualifiedYears).toBe(1);
  });

  it("可从连续年度历史回填经济领航胜利", () => {
    const state = createInitialGameState(1949);
    delete (state.nation as Partial<typeof state.nation>).victory;
    delete (state.nation as Partial<typeof state.nation>).victoryYear;
    for (let year = 2010; year <= 2014; year += 1) {
      state.nation.history.annual.push({
        year,
        gdpRank: 1,
        gdpPerCapitaRank: 40,
        happinessIndex: 68,
        debtToGDP: 0.7,
      } as never);
    }

    ensureVictoryState(state);
    expect(inferVictoryYearFromHistory(state)).toBe(2014);
    expect(state.nation.victory.achievedYear).toBe(2014);
  });

  it("IMPORT_GAME 保留旧规则已经授予的胜利", () => {
    const legacy = createInitialGameState(2010);
    delete (legacy.nation as Partial<typeof legacy.nation>).victory;
    legacy.nation.victoryYear = 2018;

    const engine = createSimulationEngine(createInitialGameState(1));
    engine.dispatch({ type: "IMPORT_GAME", state: legacy });

    expect(engine.getState().nation.victory.achievedPathId).toBe("economic_leadership");
    expect(engine.getState().nation.victory.achievedYear).toBe(2018);
    expect(hasRecordedVictory(engine.getState())).toBe(true);
  });
});
