import calibrationData from "../../data/config/calibration-targets.json";
import comparisonTargetData from "../../data/config/comparison-economy-targets.json";
import type { AnnualSnapshot } from "../state/history-state";

export type ComparisonTargetId =
  | "history"
  | "south_korea"
  | "japan"
  | "taiwan";

export interface ComparisonTargetOption {
  id: ComparisonTargetId;
  label: string;
  description: string;
}

export interface TargetComparisonMetric {
  simulated: number;
  target: number;
  relativeDifference: number;
}

export interface TargetRankComparison {
  simulated: number;
  target: number;
  difference: number;
  targetParticipants: number | null;
}

export interface TargetComparisonRow {
  year: number;
  gdp: TargetComparisonMetric;
  gdpPerCapita: TargetComparisonMetric;
  population: TargetComparisonMetric;
  gdpRank: TargetRankComparison | null;
}

export interface TargetComparisonResult {
  targetId: ComparisonTargetId;
  targetLabel: string;
  valueBasis: "internal_real_1949" | "current_usd";
  rows: TargetComparisonRow[];
}

export const comparisonTargetOptions: ComparisonTargetOption[] = [
  {
    id: "history",
    label: "历史",
    description: "与中国真实历史校准锚点比较",
  },
  {
    id: "south_korea",
    label: "韩国",
    description: "与韩国同期现价美元指标比较",
  },
  {
    id: "japan",
    label: "日本",
    description: "与日本同期现价美元指标比较",
  },
  {
    id: "taiwan",
    label: "台湾",
    description: "与台湾同期官方国民账户指标比较",
  },
];

export function isComparisonTargetId(value: string): value is ComparisonTargetId {
  return comparisonTargetOptions.some((target) => target.id === value);
}

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
  | "year"
  | "realGDP"
  | "realGDPPerCapita"
  | "currentUSDGDPPerCapita"
  | "population"
  | "gdpRank"
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

function targetMetric(
  simulated: number,
  target: number,
): TargetComparisonMetric {
  return {
    simulated,
    target,
    relativeDifference: relativeDifference(simulated, target),
  };
}

/**
 * 根据玩家选择生成只读对标数据。国家对标统一使用现价美元，避免跨经济体比较内部不变价数值。
 */
export function compareSimulationWithTarget(
  annual: readonly ComparableAnnualSnapshot[],
  targetId: ComparisonTargetId,
): TargetComparisonResult {
  if (targetId === "history") {
    return {
      targetId,
      targetLabel: "中国真实历史",
      valueBasis: "internal_real_1949",
      rows: compareSimulationWithHistory(annual).map((row) => ({
        year: row.year,
        gdp: targetMetric(row.realGDP.simulated, row.realGDP.historical),
        gdpPerCapita: targetMetric(
          row.realGDPPerCapita.simulated,
          row.realGDPPerCapita.historical,
        ),
        population: targetMetric(
          row.population.simulated,
          row.population.historical,
        ),
        gdpRank: row.gdpRank === null
          ? null
          : {
              simulated: row.gdpRank.simulated,
              target: row.gdpRank.historical,
              difference: row.gdpRank.difference,
              targetParticipants: null,
            },
      })),
    };
  }

  const target = comparisonTargetData.targets.find((item) => item.id === targetId);
  if (!target) {
    throw new Error(`未知的经济对标对象：${targetId}`);
  }
  const snapshots = new Map(annual.map((snapshot) => [snapshot.year, snapshot]));
  const rows = target.years.flatMap((anchor) => {
    const snapshot = snapshots.get(anchor.year);
    if (!snapshot) return [];
    const simulatedNominalGDP =
      snapshot.currentUSDGDPPerCapita * snapshot.population;
    return [{
      year: anchor.year,
      gdp: targetMetric(simulatedNominalGDP, anchor.nominalGDP),
      gdpPerCapita: targetMetric(
        snapshot.currentUSDGDPPerCapita,
        anchor.currentUSDGDPPerCapita,
      ),
      population: targetMetric(snapshot.population, anchor.population),
      gdpRank: {
        simulated: snapshot.gdpRank,
        target: anchor.gdpRank,
        difference: snapshot.gdpRank - anchor.gdpRank,
        targetParticipants: anchor.rankParticipants,
      },
    }];
  });

  return {
    targetId,
    targetLabel: target.name,
    valueBasis: "current_usd",
    rows,
  };
}
