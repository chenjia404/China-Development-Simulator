import calibrationData from "../../src/data/config/calibration-targets.json";
import { describe, expect, it } from "vitest";
import {
  calibrationMetrics,
  confidenceForMetricYear,
  historicalDataRegistry,
  type RegisteredCalibrationTarget,
  validateHistoricalDataRegistry,
} from "./data-registry";

describe("历史数据注册表", () => {
  it("每个校准指标都有唯一来源、口径和完整年份可信度", () => {
    const errors = validateHistoricalDataRegistry(
      calibrationData.years as RegisteredCalibrationTarget[],
    );

    expect(errors).toEqual([]);
    expect(historicalDataRegistry.sources).toHaveLength(10);
    expect(historicalDataRegistry.series).toHaveLength(calibrationMetrics.length);
    expect(confidenceForMetricYear("realGDP", 1949)).toBe("low");
    expect(confidenceForMetricYear("population", 2020)).toBe("high");
  });

  it("重复年份和缺失留出组会被数据审计拒绝", () => {
    const invalidTargets: RegisteredCalibrationTarget[] = [
      { year: 1949, role: "fit", population: 1 },
      { year: 1949, role: "fit", population: 1 },
    ];
    const errors = validateHistoricalDataRegistry(invalidTargets);

    expect(errors).toEqual(expect.arrayContaining([
      "校准年份存在重复",
      "校准目标缺少 validation 分组",
      "校准目标缺少 projection 分组",
    ]));
  });
});
