import { describe, expect, it } from "vitest";
import {
  compareSimulationWithHistory,
  compareSimulationWithTarget,
  comparisonTargetOptions,
  historicalComparisonAnchors,
  historicalCurrentPriceComparisonAnchors,
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
      currentPriceGDPPerCapita: 465,
      currentUSDGDPPerCapita: 170,
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

  it("提供历史、韩国、日本和台湾四个可选对标对象", () => {
    expect(comparisonTargetOptions.map((target) => target.id)).toEqual([
      "history",
      "south_korea",
      "japan",
      "taiwan",
    ]);
  });

  it("面向用户的中国历史对比统一使用完整年度当年价，并附同年美元口径", () => {
    expect(
      historicalCurrentPriceComparisonAnchors.map((anchor) => anchor.year),
    ).toEqual([1978, 1990, 2000, 2010, 2020]);
    const comparison = compareSimulationWithTarget([{
      year: 2000,
      realGDP: 5_000_000_000_000,
      realGDPPerCapita: 4_000,
      currentPriceGDPPerCapita: 20_000,
      currentUSDGDPPerCapita: 2_500,
      population: 50_000_000,
      gdpRank: 4,
    }], "history");

    expect(comparison.valueBasis).toBe("current_cny");
    expect(comparison.rows).toHaveLength(1);
    expect(comparison.rows[0].gdp.simulated).toBe(1_000_000_000_000);
    expect(comparison.rows[0].gdp.target).toBe(7_858 * 1_267_430_000);
    expect(comparison.rows[0].gdpPerCapita.target).toBe(7_858);
    expect(comparison.rows[0].gdpUSD?.simulated).toBe(125_000_000_000);
    expect(comparison.rows[0].gdpPerCapitaUSD?.target).toBe(969.2);
  });

  it("国家对标使用同期现价美元 GDP、人均 GDP、人口和世界排名", () => {
    const comparison = compareSimulationWithTarget([{
      year: 2000,
      realGDP: 5_000_000_000_000,
      realGDPPerCapita: 4_000,
      currentPriceGDPPerCapita: 30_000,
      currentUSDGDPPerCapita: 15_000,
      population: 50_000_000,
      gdpRank: 10,
    }], "south_korea");

    expect(comparison.targetLabel).toBe("韩国");
    expect(comparison.valueBasis).toBe("current_usd");
    expect(comparison.rows).toHaveLength(1);
    expect(comparison.rows[0].gdp.simulated).toBe(750_000_000_000);
    expect(comparison.rows[0].gdp.target).toBe(597_487_173_479);
    expect(comparison.rows[0].gdpPerCapita.target).toBe(12_710.3);
    expect(comparison.rows[0].population.target).toBe(47_008_111);
    expect(comparison.rows[0].gdpRank).toEqual({
      simulated: 10,
      target: 12,
      difference: -2,
      targetParticipants: 204,
    });
  });

  it("国家对标只展示本局已经到达的锚点年份", () => {
    const comparison = compareSimulationWithTarget([{
      year: 1978,
      realGDP: 580_000_000_000,
      realGDPPerCapita: 603,
      currentPriceGDPPerCapita: 2_000,
      currentUSDGDPPerCapita: 1_500,
      population: 36_000_000,
      gdpRank: 20,
    }], "taiwan");

    expect(comparison.rows.map((row) => row.year)).toEqual([1978]);
    expect(comparison.rows[0].gdpPerCapita.target).toBe(1_606);
    expect(comparison.rows[0].gdpRank?.target).toBe(32);
  });
});
