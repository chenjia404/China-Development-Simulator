import calibrationData from "../../src/data/config/calibration-targets.json";
import type { AnnualSnapshot } from "../../src/simulation/index";
import {
  calibrationMetrics,
  confidenceForMetricYear,
  getHistoricalDataSeries,
  type CalibrationMetric,
  type CalibrationRole,
  type DataConfidence,
} from "./data-registry";

export type { CalibrationMetric } from "./data-registry";

interface CalibrationTarget {
  year: number;
  role: CalibrationRole;
  population: number;
  realGDP: number;
  currentPriceGDPPerCapita?: number;
  currentUSDGDPPerCapita?: number;
  gdpRank?: number;
  gdpPerCapitaRank?: number;
  urbanizationRate: number;
  lifeExpectancy: number;
  literacyRate: number;
  primarySectorShare: number;
  secondarySectorShare: number;
  tertiarySectorShare: number;
}

interface Tolerance {
  kind: "relative" | "absolute";
  value: number;
}

export interface CalibrationResult {
  year: number;
  role: CalibrationRole;
  metric: CalibrationMetric;
  confidence: DataConfidence;
  sourceIds: string[];
  simulatedValue: number;
  targetValue: number;
  absoluteError: number;
  relativeError: number;
  tolerance: number;
  toleranceKind: Tolerance["kind"];
  passed: boolean;
}

export function compareWithTargets(annual: AnnualSnapshot[]): CalibrationResult[] {
  const snapshots = new Map(annual.map((snapshot) => [snapshot.year, snapshot]));
  const tolerances = calibrationData.tolerances as Record<CalibrationMetric, Tolerance>;
  const results: CalibrationResult[] = [];
  for (const target of calibrationData.years as CalibrationTarget[]) {
    const snapshot = snapshots.get(target.year);
    if (!snapshot) throw new Error(`缺少 ${target.year} 年模拟快照`);
    for (const metric of calibrationMetrics) {
      const simulatedValue = snapshot[metric];
      const targetValue = target[metric];
      if (targetValue === undefined) continue;
      const absoluteError = Math.abs(simulatedValue - targetValue);
      const relativeError = targetValue === 0 ? 0 : absoluteError / Math.abs(targetValue);
      const tolerance = tolerances[metric];
      const series = getHistoricalDataSeries(metric);
      results.push({
        year: target.year,
        role: target.role,
        metric,
        confidence: confidenceForMetricYear(metric, target.year),
        sourceIds: [...series.sourceIds],
        simulatedValue,
        targetValue,
        absoluteError,
        relativeError,
        tolerance: tolerance.value,
        toleranceKind: tolerance.kind,
        passed: tolerance.kind === "relative"
          ? relativeError <= tolerance.value
          : absoluteError <= tolerance.value,
      });
    }
  }
  return results;
}

export function summarizeCalibration(results: CalibrationResult[]) {
  const passed = results.filter((result) => result.passed).length;
  const summarizeGroup = (group: CalibrationResult[]) => ({
    passed: group.filter((result) => result.passed).length,
    total: group.length,
    passRate: group.filter((result) => result.passed).length /
      Math.max(group.length, 1),
  });
  return {
    passed,
    total: results.length,
    passRate: passed / Math.max(results.length, 1),
    failed: results.filter((result) => !result.passed),
    byRole: Object.fromEntries(
      (["fit", "validation", "projection"] as CalibrationRole[]).map((role) => [
        role,
        summarizeGroup(results.filter((result) => result.role === role)),
      ]),
    ) as Record<CalibrationRole, ReturnType<typeof summarizeGroup>>,
    byConfidence: Object.fromEntries(
      (["high", "medium", "low"] as DataConfidence[]).map((confidence) => [
        confidence,
        summarizeGroup(results.filter((result) => result.confidence === confidence)),
      ]),
    ) as Record<DataConfidence, ReturnType<typeof summarizeGroup>>,
  };
}

export function calibrationResultsToCsv(results: CalibrationResult[]): string {
  const header = "年份,校准角色,指标,数据可信度,来源ID,模拟值,目标值,绝对误差,相对误差,容差类型,容差,是否通过";
  const rows = results.map((result) => [
    result.year,
    result.role,
    result.metric,
    result.confidence,
    result.sourceIds.join("|"),
    result.simulatedValue,
    result.targetValue,
    result.absoluteError,
    result.relativeError,
    result.toleranceKind,
    result.tolerance,
    result.passed ? "是" : "否",
  ].join(","));
  return [header, ...rows].join("\n");
}
