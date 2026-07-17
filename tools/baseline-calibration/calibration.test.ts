import { describe, expect, it } from "vitest";
import { compareWithTargets, summarizeCalibration } from "./calibration";
import { runSimulation } from "./runner";

describe("1949—2026 历史校准", () => {
  it("历史参考策略至少 85% 的校准项进入设计容差", () => {
    const run = runSimulation({
      strategy: "historical",
      seed: 1949,
      startYear: 1949,
      endYear: 2026,
    });
    const summary = summarizeCalibration(compareWithTargets(run.annual));

    expect(summary.passRate).toBeGreaterThanOrEqual(0.85);
  });

  it("当前年份的人口、GDP、城市化、寿命与产业结构通过校准", () => {
    const run = runSimulation({
      strategy: "historical",
      seed: 1949,
      startYear: 1949,
      endYear: 2026,
    });
    const current = compareWithTargets(run.annual).filter(
      (result) => result.year === 2026,
    );

    expect(current.every((result) => result.passed)).toBe(true);
  });
});
