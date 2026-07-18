import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { createSimulationEngine } from "../core/engine";
import { searchCalibrationCandidates } from "./automatic-calibration";
import { evaluateModelIntegrity } from "./model-integrity";
import {
  summarizeUncertainty,
  type UncertaintySample,
} from "./uncertainty";

function sample(seed: number, offset: number): UncertaintySample {
  return {
    seed,
    metrics: {
      realGDP: 100 + offset,
      realGDPPerCapita: 10 + offset,
      population: 1_000 + offset,
      inflationRate: 0.02 + offset / 1_000,
      debtToGDP: 0.3 + offset / 1_000,
      technologyIndex: 50 + offset,
      score: 60 + offset,
    },
  };
}

describe("不确定性、自动校准与完整性分析", () => {
  it("多种子分位区间不受批次返回顺序影响", () => {
    const forward = [sample(1, -2), sample(2, 0), sample(3, 4)];
    const reversed = [...forward].reverse();
    expect(summarizeUncertainty(reversed)).toEqual(summarizeUncertainty(forward));
    const interval = summarizeUncertainty(forward).metrics.realGDP;
    expect(interval.minimum).toBe(98);
    expect(interval.median).toBe(100);
    expect(interval.maximum).toBe(104);
    expect(interval.p10).toBeLessThanOrEqual(interval.median);
    expect(interval.median).toBeLessThanOrEqual(interval.p90);
  });

  it("有界候选搜索可重复且不会恶化目标函数", () => {
    const definitions = [
      { id: "output", initial: 1, minimum: 0.8, maximum: 1.2, step: 0.01 },
      { id: "population", initial: 1, minimum: 0.8, maximum: 1.2, step: 0.01 },
    ];
    const objective = (parameters: Readonly<Record<string, number>>) =>
      (parameters.output - 1.07) ** 2 + (parameters.population - 0.94) ** 2;
    const first = searchCalibrationCandidates(definitions, objective);
    const second = searchCalibrationCandidates(definitions, objective);
    expect(first).toEqual(second);
    expect(first.bestLoss).toBeLessThanOrEqual(first.initialLoss);
    expect(first.parameters.output).toBeCloseTo(1.07);
    expect(first.parameters.population).toBeCloseTo(0.94);
  });

  it("月度管线结算后所有细分账户均能通过统一完整性检查", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    engine.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 12 });
    const report = evaluateModelIntegrity(engine.exportState());
    expect(report.status).toBe("通过");
    expect(report.passed).toBe(report.total);
    expect(report.indicators).toHaveLength(11);
  });
});
