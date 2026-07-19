import { describe, expect, it } from "vitest";
import historicalEconomicAnchors from "../../data/config/historical-economic-anchors.json";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  calculateCurrentPriceGDPPerCapita,
  calculateCurrentUSDGDPPerCapita,
  calculateGlobalGDPPerCapitaStanding,
  calculateWorldComparableGDP,
  calculateWorldPeerNominalGDPScale,
} from "./historical-accounting";

function factorAt(
  anchors: readonly { year: number; factor: number }[],
  year: number,
): number {
  return anchors.find((anchor) => anchor.year === year)?.factor ?? 0;
}

describe("历史经济统计口径", () => {
  it("三个关键年份可折算为国家统计局当年价人均 GDP", () => {
    const priceFactor1978 = factorAt(
      historicalEconomicAnchors.currentPriceGDPPerCapitaFactors,
      1978,
    );
    const priceFactor1990 = factorAt(
      historicalEconomicAnchors.currentPriceGDPPerCapitaFactors,
      1990,
    );
    const priceFactor2000 = factorAt(
      historicalEconomicAnchors.currentPriceGDPPerCapitaFactors,
      2000,
    );
    expect(calculateCurrentPriceGDPPerCapita(381 / priceFactor1978, 1978))
      .toBeCloseTo(381, 6);
    expect(calculateCurrentPriceGDPPerCapita(1644 / priceFactor1990, 1990))
      .toBeCloseTo(1644, 6);
    expect(calculateCurrentPriceGDPPerCapita(7858 / priceFactor2000, 2000))
      .toBeCloseTo(7858, 6);
  });

  it("1978 年史实口径为约 156.7 美元并位列 146 个经济体中的第 134 名", () => {
    const usdFactor1978 = factorAt(
      historicalEconomicAnchors.currentUSDGDPPerCapitaFactors,
      1978,
    );
    const currentUSD = calculateCurrentUSDGDPPerCapita(
      156.7 / usdFactor1978,
      1978,
    );
    const standing = calculateGlobalGDPPerCapitaStanding(currentUSD, 1978);

    expect(currentUSD).toBeCloseTo(156.7, 1);
    expect(standing).toEqual({ rank: 134, participants: 146 });
  });

  it("偏离史实路线的真实人均产出会改变全球排名", () => {
    const baseline = calculateGlobalGDPPerCapitaStanding(156.6556, 1978);
    const doubled = calculateGlobalGDPPerCapitaStanding(313.3112, 1978);
    const halved = calculateGlobalGDPPerCapitaStanding(78.3278, 1978);

    expect(doubled.rank).toBeLessThan(baseline.rank);
    expect(halved.rank).toBeGreaterThan(baseline.rank);
  });

  it("国际比较折算保持不同发展路线之间的 GDP 比例", () => {
    const baseline = calculateWorldComparableGDP(1_000, 2, 1990);
    const fasterRoute = calculateWorldComparableGDP(1_300, 2, 1990);

    expect(fasterRoute / baseline).toBeCloseTo(1.3, 12);
  });

  it("轻量世界同伴名义 GDP 缩放在史实锚点年为正且介于合理区间", () => {
    expect(calculateWorldPeerNominalGDPScale(1978)).toBeGreaterThan(0.2);
    expect(calculateWorldPeerNominalGDPScale(1978)).toBeLessThan(1);
    expect(calculateWorldPeerNominalGDPScale(1990)).toBeGreaterThan(
      calculateWorldPeerNominalGDPScale(1978),
    );
  });

  it("旧存档缺少新统计字段时能够确定性迁移", () => {
    const state = createInitialGameState(1949);
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    const oldState = engine.exportState();
    delete (
      oldState.nation.economy as Partial<typeof oldState.nation.economy>
    ).currentPriceGDPPerCapita;
    delete (
      oldState.nation.economy as Partial<typeof oldState.nation.economy>
    ).currentUSDGDPPerCapita;
    delete (
      oldState.nation.economy as Partial<typeof oldState.nation.economy>
    ).globalGDPPerCapitaRank;
    delete (
      oldState.nation.economy as Partial<typeof oldState.nation.economy>
    ).globalGDPPerCapitaParticipants;
    delete (
      oldState.nation.economy as Partial<typeof oldState.nation.economy>
    ).internationalComparableGDP;
    delete (
      oldState.nation.history.annual[0] as Partial<
        typeof oldState.nation.history.annual[0]
      >
    ).currentPriceGDPPerCapita;
    delete (
      oldState.nation.history.annual[0] as Partial<
        typeof oldState.nation.history.annual[0]
      >
    ).currentUSDGDPPerCapita;
    delete (
      oldState.nation.history.annual[0] as Partial<
        typeof oldState.nation.history.annual[0]
      >
    ).gdpPerCapitaRank;
    delete (
      oldState.nation.history.annual[0] as Partial<
        typeof oldState.nation.history.annual[0]
      >
    ).gdpPerCapitaRankParticipants;

    const restored = createSimulationEngine(oldState).getState();
    expect(restored.nation.economy.currentPriceGDPPerCapita).toBeGreaterThan(0);
    expect(restored.nation.economy.internationalComparableGDP).toBeGreaterThan(0);
    expect(restored.nation.economy.currentUSDGDPPerCapita).toBeGreaterThan(0);
    expect(restored.nation.economy.globalGDPPerCapitaRank).toBeGreaterThan(0);
    expect(
      restored.nation.history.annual[0].currentPriceGDPPerCapita,
    ).toBeGreaterThan(0);
    expect(restored.nation.history.annual[0].currentUSDGDPPerCapita)
      .toBeGreaterThan(0);
    expect(restored.nation.history.annual[0].gdpPerCapitaRank).toBeGreaterThan(0);
  });
});
