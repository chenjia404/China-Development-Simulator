import calibrationData from "../../src/data/config/calibration-targets.json";
import type { AnnualSnapshot } from "../../src/simulation/index";

export type CalibrationMetric =
  | "population"
  | "realGDP"
  | "urbanizationRate"
  | "lifeExpectancy"
  | "literacyRate"
  | "primarySectorShare"
  | "secondarySectorShare"
  | "tertiarySectorShare";

interface CalibrationTarget {
  year: number;
  population: number;
  realGDP: number;
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
  metric: CalibrationMetric;
  simulatedValue: number;
  targetValue: number;
  absoluteError: number;
  relativeError: number;
  tolerance: number;
  toleranceKind: Tolerance["kind"];
  passed: boolean;
}

const metrics: CalibrationMetric[] = [
  "population",
  "realGDP",
  "urbanizationRate",
  "lifeExpectancy",
  "literacyRate",
  "primarySectorShare",
  "secondarySectorShare",
  "tertiarySectorShare",
];

export function compareWithTargets(annual: AnnualSnapshot[]): CalibrationResult[] {
  const snapshots = new Map(annual.map((snapshot) => [snapshot.year, snapshot]));
  const tolerances = calibrationData.tolerances as Record<CalibrationMetric, Tolerance>;
  const results: CalibrationResult[] = [];
  for (const target of calibrationData.years as CalibrationTarget[]) {
    const snapshot = snapshots.get(target.year);
    if (!snapshot) throw new Error(`缺少 ${target.year} 年模拟快照`);
    for (const metric of metrics) {
      const simulatedValue = snapshot[metric];
      const targetValue = target[metric];
      const absoluteError = Math.abs(simulatedValue - targetValue);
      const relativeError = targetValue === 0 ? 0 : absoluteError / Math.abs(targetValue);
      const tolerance = tolerances[metric];
      results.push({
        year: target.year,
        metric,
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
  return {
    passed,
    total: results.length,
    passRate: passed / Math.max(results.length, 1),
    failed: results.filter((result) => !result.passed),
  };
}

export function calibrationResultsToCsv(results: CalibrationResult[]): string {
  const header = "年份,指标,模拟值,目标值,绝对误差,相对误差,容差类型,容差,是否通过";
  const rows = results.map((result) => [
    result.year,
    result.metric,
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
