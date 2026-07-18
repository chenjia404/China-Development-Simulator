import calibrationData from "../../data/config/calibration-targets.json";
import type { AnnualSnapshot } from "../state/history-state";

export interface HistoricalComparisonMetric {
  simulated: number;
  historical: number;
  relativeDifference: number;
}

export interface HistoricalRankComparison {
  simulated: number;
  historical: number;
  difference: number;
}

export interface HistoricalComparisonRow {
  year: number;
  realGDP: HistoricalComparisonMetric;
  realGDPPerCapita: HistoricalComparisonMetric;
  population: HistoricalComparisonMetric;
  gdpRank: HistoricalRankComparison | null;
}

export interface HistoricalComparisonAnchor {
  year: number;
  realGDP: number;
  realGDPPerCapita: number;
  population: number;
  gdpRank: number | null;
}

type ComparableAnnualSnapshot = Pick<
  AnnualSnapshot,
  "year" | "realGDP" | "realGDPPerCapita" | "population" | "gdpRank"
>;

function relativeDifference(simulated: number, historical: number): number {
  return historical === 0 ? 0 : simulated / historical - 1;
}

export const historicalComparisonAnchors: HistoricalComparisonAnchor[] =
  calibrationData.years
    .filter(
      (target) =>
        target.year <= calibrationData.metadata.historicalActualThroughYear,
    )
    .map((target) => ({
      year: target.year,
      realGDP: target.realGDP,
      realGDPPerCapita: target.realGDP / target.population,
      population: target.population,
      gdpRank: "gdpRank" in target && typeof target.gdpRank === "number"
        ? target.gdpRank
        : null,
    }));

/**
 * 只负责把本局年度快照与同年份史实锚点对齐，不会把史实值写回模拟状态。
 */
export function compareSimulationWithHistory(
  annual: readonly ComparableAnnualSnapshot[],
): HistoricalComparisonRow[] {
  const snapshots = new Map(annual.map((snapshot) => [snapshot.year, snapshot]));
  return historicalComparisonAnchors.flatMap((anchor) => {
    const snapshot = snapshots.get(anchor.year);
    if (!snapshot) return [];
    return [{
      year: anchor.year,
      realGDP: {
        simulated: snapshot.realGDP,
        historical: anchor.realGDP,
        relativeDifference: relativeDifference(snapshot.realGDP, anchor.realGDP),
      },
      realGDPPerCapita: {
        simulated: snapshot.realGDPPerCapita,
        historical: anchor.realGDPPerCapita,
        relativeDifference: relativeDifference(
          snapshot.realGDPPerCapita,
          anchor.realGDPPerCapita,
        ),
      },
      population: {
        simulated: snapshot.population,
        historical: anchor.population,
        relativeDifference: relativeDifference(
          snapshot.population,
          anchor.population,
        ),
      },
      gdpRank: anchor.gdpRank === null
        ? null
        : {
            simulated: snapshot.gdpRank,
            historical: anchor.gdpRank,
            difference: snapshot.gdpRank - anchor.gdpRank,
          },
    }];
  });
}
