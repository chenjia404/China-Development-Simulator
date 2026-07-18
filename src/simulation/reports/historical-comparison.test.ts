import { describe, expect, it } from "vitest";
import {
  compareSimulationWithHistory,
  historicalComparisonAnchors,
} from "./historical-comparison";

describe("真实历史对比", () => {
  it("只公开已有完整史实的锚点，并排除 2026 年预测目标", () => {
    expect(historicalComparisonAnchors.map((anchor) => anchor.year)).toEqual([
      1949,
      1957,
      1965,
      1978,
      1990,
      2000,
      2010,
      2020,
    ]);
    expect(
      historicalComparisonAnchors.find((anchor) => anchor.year === 2010)
        ?.gdpRank,
    ).toBe(2);
    expect(
      historicalComparisonAnchors.find((anchor) => anchor.year === 2020)
        ?.gdpRank,
    ).toBe(2);
  });

  it("按相同年份和不变价口径计算模拟值与史实值偏差", () => {
    const comparison = compareSimulationWithHistory([{
      year: 1978,
      realGDP: 638_000_000_000,
      realGDPPerCapita: 660,
      population: 962_590_000,
      gdpRank: 8,
    }]);

    expect(comparison).toHaveLength(1);
    expect(comparison[0].realGDP.relativeDifference).toBeCloseTo(0.1);
    expect(comparison[0].population.relativeDifference).toBe(0);
    expect(comparison[0].realGDPPerCapita.historical).toBeCloseTo(
      580_000_000_000 / 962_590_000,
    );
    expect(comparison[0].gdpRank).toEqual({
      simulated: 8,
      historical: 10,
      difference: -2,
    });
  });
});
