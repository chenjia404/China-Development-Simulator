import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  dismissFamineMortalityReport,
  FAMINE_MORTALITY_WINDOW,
  HISTORICAL_PATH_FAMINE_EXCESS_DEATHS,
} from "./famine-mortality-account";

describe("三年困难超额死亡账户", () => {
  it("交互模式下于 1961 年末生成待确认超额死亡报告", () => {
    const engine = createSimulationEngine(
      createInitialGameState(1949, 1949, "interactive"),
    );

    for (let guard = 0; guard < 220; guard += 1) {
      const state = engine.getState();
      if (state.nation.famineMortality.pendingReport) break;
      if (state.nation.pendingHistoricalEventId) {
        engine.dispatch({
          type: "RESOLVE_HISTORICAL_EVENT",
          eventId: state.nation.pendingHistoricalEventId,
          choiceId: "historical_path",
        });
        continue;
      }
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }

    const afterFinalize = engine.getState();
    const account = afterFinalize.nation.famineMortality;
    expect(account.finalized).toBe(true);
    expect(account.baselineMonths).toBe(36);
    expect(account.windowMonths).toBe(36);
    expect(account.pendingReport).not.toBeNull();
    expect(account.report?.accountComplete).toBe(true);
    expect(account.report?.baselineSource).toBe("recorded");
    expect(account.report?.excessDeaths).toBeGreaterThan(10_000_000);
    expect(account.report?.excessDeaths).toBeLessThan(30_000_000);
    expect(account.report?.historicalPathExcessDeaths).toBe(
      HISTORICAL_PATH_FAMINE_EXCESS_DEATHS,
    );
    expect(account.report?.vsHistoricalPathExcessDeaths).toBeCloseTo(
      (account.report?.excessDeaths ?? 0) - HISTORICAL_PATH_FAMINE_EXCESS_DEATHS,
      6,
    );
    // 史实路径超额应贴近锚点，便于报告「相对史实」对照。
    expect(
      Math.abs(
        (account.report?.excessDeaths ?? 0) -
          HISTORICAL_PATH_FAMINE_EXCESS_DEATHS,
      ),
    ).toBeLessThan(750_000);
    expect(account.report?.choiceId).toBe("historical_path");
    // 1961-12 结算后日期会滚到 1962-01，但 1 月尚未结算，推进被阻断。
    expect(afterFinalize.nation.date).toMatchObject({ year: 1962, month: 1 });
    expect(
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 }).state.nation.date,
    ).toMatchObject({ year: 1962, month: 1 });

    engine.dispatch({ type: "DISMISS_FAMINE_MORTALITY_REPORT" });
    expect(engine.getState().nation.famineMortality.pendingReport).toBeNull();
    expect(engine.getState().nation.famineMortality.report?.excessDeaths)
      .toBe(account.report?.excessDeaths);

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.date).toMatchObject({ year: 1962, month: 2 });
    expect(engine.getState().nation.famineMortality.pendingReport).toBeNull();
  });

  it("自动模式只落盘报告不阻断推进", () => {
    const engine = createSimulationEngine(
      createInitialGameState(1949, 1949, "automatic"),
    );
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 13 * 12 });
    const account = engine.getState().nation.famineMortality;
    expect(account.finalized).toBe(true);
    expect(account.pendingReport).toBeNull();
    expect(account.report?.excessDeaths).toBeGreaterThan(10_000_000);
    expect(engine.getState().nation.date.year).toBeGreaterThanOrEqual(1962);
  });

  it("切换到自动模式会清除待确认报告，避免批处理死锁", () => {
    const engine = createSimulationEngine(
      createInitialGameState(1949, 1949, "interactive"),
    );
    for (let guard = 0; guard < 220; guard += 1) {
      const state = engine.getState();
      if (state.nation.famineMortality.pendingReport) break;
      if (state.nation.pendingHistoricalEventId) {
        engine.dispatch({
          type: "RESOLVE_HISTORICAL_EVENT",
          eventId: state.nation.pendingHistoricalEventId,
          choiceId: "historical_path",
        });
        continue;
      }
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    expect(engine.getState().nation.famineMortality.pendingReport).not.toBeNull();
    engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
    expect(engine.getState().nation.famineMortality.pendingReport).toBeNull();
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    expect(engine.getState().nation.date).toMatchObject({ year: 1962, month: 2 });
  });

  it("无待确认报告时 dismiss 抛错", () => {
    const state = createInitialGameState(1949, 1949, "interactive");
    expect(() => dismissFamineMortalityReport(state.nation)).toThrow(
      /没有待确认/,
    );
  });

  it("中途开局会标记账户不完整", () => {
    const engine = createSimulationEngine(
      createInitialGameState(1949, 1960, "interactive"),
    );
    for (let guard = 0; guard < 40; guard += 1) {
      const state = engine.getState();
      if (state.nation.famineMortality.pendingReport) break;
      if (state.nation.pendingHistoricalEventId) {
        engine.dispatch({
          type: "RESOLVE_HISTORICAL_EVENT",
          eventId: state.nation.pendingHistoricalEventId,
          choiceId: "historical_path",
        });
        continue;
      }
      if (
        state.nation.date.year > FAMINE_MORTALITY_WINDOW.windowEndYear
      ) {
        break;
      }
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    const report = engine.getState().nation.famineMortality.report;
    expect(report).not.toBeNull();
    expect(report?.accountComplete).toBe(false);
    expect(report?.baselineSource).not.toBe("recorded");
  });

  it("避免双运动并禁出口降征购后超额死亡接近或低于常态，叠外援后不高于常态", () => {
    const runToReport = (choose: (eventId: string) => string) => {
      const engine = createSimulationEngine(
        createInitialGameState(1949, 1949, "interactive"),
      );
      for (let guard = 0; guard < 400; guard += 1) {
        const state = engine.getState();
        if (state.nation.famineMortality.finalized) {
          if (state.nation.famineMortality.pendingReport) {
            engine.dispatch({ type: "DISMISS_FAMINE_MORTALITY_REPORT" });
          }
          break;
        }
        if (state.nation.pendingHistoricalEventId) {
          const eventId = state.nation.pendingHistoricalEventId;
          engine.dispatch({
            type: "RESOLVE_HISTORICAL_EVENT",
            eventId,
            choiceId: choose(eventId),
          });
          continue;
        }
        engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
      }
      const report = engine.getState().nation.famineMortality.report;
      expect(report?.accountComplete).toBe(true);
      return report!;
    };

    const historical = runToReport(() => "historical_path");
    const avoidedWithoutAid = runToReport((eventId) =>
      (
        {
          great_leap_forward_1958: "avoid_great_leap",
          peoples_communes_1958: "avoid_communes",
          three_year_difficulties_1959:
            "ban_grain_exports_and_import+no_additional_relief+reduce_procurement_guarantee_ration",
        } as Record<string, string>
      )[eventId] ?? "historical_path",
    );
    const avoidedWithAid = runToReport((eventId) =>
      (
        {
          great_leap_forward_1958: "avoid_great_leap",
          peoples_communes_1958: "avoid_communes",
          three_year_difficulties_1959:
            "ban_grain_exports_and_import+no_additional_relief+reduce_procurement_guarantee_ration+foreign_aid_500mt",
        } as Record<string, string>
      )[eventId] ?? "historical_path",
    );

    // 史实仍保留全国性饥荒级超额死亡。
    expect(historical.excessDeaths).toBeGreaterThan(10_000_000);
    // 不建公社 + 不大跃进 + 禁出口并进口 + 降征购：大饥荒基本避免（超额≈0或更优）。
    expect(avoidedWithoutAid.excessDeaths).toBeLessThan(2_000_000);
    expect(avoidedWithoutAid.excessDeaths).toBeLessThan(
      historical.excessDeaths * 0.15,
    );
    // 再接受约 500 万吨外援：相对 1955–1957 常态不产生超额饿死（可≤0）。
    expect(avoidedWithAid.excessDeaths).toBeLessThanOrEqual(0);
    expect(avoidedWithAid.excessDeaths).toBeLessThanOrEqual(
      avoidedWithoutAid.excessDeaths,
    );
  }, 15_000);
});
