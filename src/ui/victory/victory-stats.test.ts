import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../simulation/state/initial-state";
import { buildVictorySummary } from "./victory-stats";

describe("buildVictorySummary", () => {
  it("未记录胜利年份时返回 null", () => {
    const game = createInitialGameState(1949);
    expect(buildVictorySummary(game)).toBeNull();
  });

  it("缺失 victoryYear 字段时返回 null", () => {
    const game = createInitialGameState(1949);
    delete (game.nation as { victoryYear?: number | null }).victoryYear;
    expect(buildVictorySummary(game)).toBeNull();
  });

  it("已记录胜利年份时返回完整摘要", () => {
    const game = createInitialGameState(1949);
    game.nation.victoryYear = 2010;
    game.nation.history.annual.push({
      year: 2010,
      month: 12,
      realGDP: 5e13,
      population: 1_340_000_000,
      currentUSDGDPPerCapita: 4500,
      urbanizationRate: 0.49,
      gdpRank: 1,
      score: 72.5,
      technologyIndex: 48.2,
      happinessIndex: 61.3,
    } as never);

    const summary = buildVictorySummary(game);
    expect(summary).not.toBeNull();
    expect(summary?.victoryYear).toBe(2010);
    expect(summary?.hero.value).toBe("第 1 名");
    expect(summary?.metrics.some((metric) => metric.label === "综合评分")).toBe(true);
  });
});
