import { describe, expect, it } from "vitest";
import {
  createSimulationEngine,
  deserializeGameState,
  serializeGameState,
} from "../../src/simulation/index";
import { annualSnapshotsToCsv } from "./csv";
import { runSimulation } from "./runner";
import koreanTargets from "../../src/data/config/korean-catch-up-targets.json";

describe("无界面批量模拟器", () => {
  it("从 1949 年稳定运行至 2026 年并保留正确历史长度", () => {
    const result = runSimulation({
      strategy: "historical",
      seed: 1949,
      startYear: 1949,
      endYear: 2026,
    });

    expect(result.finalState.nation.date).toEqual({
      year: 2027,
      month: 1,
      elapsedMonths: 936,
    });
    expect(result.annual).toHaveLength(78);
    expect(result.finalState.nation.history.monthly).toHaveLength(120);
    expect(result.durationMs).toBeLessThan(5_000);
  });

  it("相同策略和种子产生完全相同的年度序列", () => {
    const options = {
      strategy: "historical" as const,
      seed: 2026,
      startYear: 1949,
      endYear: 2026,
    };
    const first = runSimulation(options);
    const second = runSimulation(options);

    expect(second.annual).toEqual(first.annual);
    expect(second.finalState.randomState).toBe(first.finalState.randomState);
  });

  it("存档读取后继续模拟与未中断结果一致", () => {
    const firstHalf = runSimulation({
      strategy: "historical",
      seed: 77,
      startYear: 1949,
      endYear: 1978,
    });
    const restoredState = deserializeGameState(
      serializeGameState(firstHalf.finalState, "1979-01-01T00:00:00.000Z"),
    );
    const continued = createSimulationEngine(restoredState);
    continued.dispatch({ type: "ADVANCE_MONTHS", months: 120 });
    const direct = createSimulationEngine(firstHalf.finalState);
    direct.dispatch({ type: "ADVANCE_MONTHS", months: 120 });

    expect(continued.exportState()).toEqual(direct.exportState());
  });

  it("CSV 包含全部年度且使用中文表头", () => {
    const result = runSimulation({
      strategy: "none",
      seed: 1,
      startYear: 1949,
      endYear: 1950,
    });
    const csv = annualSnapshotsToCsv(result.annual);

    expect(csv.split("\n")).toHaveLength(3);
    expect(csv.startsWith("年份,人口,实际GDP")).toBe(true);
  });

  it("韩国式追赶预设通过积累机制在 2000 年进入韩国收入数量级", () => {
    const result = runSimulation({
      strategy: "korean_catch_up",
      seed: 1949,
      startYear: 1949,
      endYear: 2000,
    });
    const snapshot = result.annual.find((item) => item.year === 2000);
    const target = koreanTargets.years.find((item) => item.year === 2000);
    expect(snapshot).toBeDefined();
    expect(target).toBeDefined();
    expect(snapshot!.currentUSDGDPPerCapita).toBeGreaterThanOrEqual(
      target!.currentUSDGDPPerCapita * 0.85,
    );
    expect(snapshot!.currentUSDGDPPerCapita).toBeLessThanOrEqual(
      target!.currentUSDGDPPerCapita * 1.15,
    );
    expect(
      result.finalState.nation.trade.exports /
        result.finalState.nation.economy.nominalGDP,
    ).toBeLessThanOrEqual(0.551);
    expect(
      result.finalState.nation.history.historicalEvents.find(
        (event) => event.id === "great_leap_forward_1958",
      )?.choiceId,
    ).toBe("avoid_great_leap");
    expect(
      result.finalState.nation.history.historicalEvents.find(
        (event) => event.id === "cultural_revolution_disruption_1966",
      )?.choiceId,
    ).toBe("protect_institutions");
  });
});
