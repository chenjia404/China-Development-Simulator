import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  dismissFamineMortalityReport,
  FAMINE_MORTALITY_WINDOW,
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
});
