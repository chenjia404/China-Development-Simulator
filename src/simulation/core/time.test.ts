import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "./engine";
import { advanceMonth, createGameDate, monthsUntilYear } from "./time";

describe("时间推进", () => {
  it("十二月后准确进入下一年一月", () => {
    const date = createGameDate(1949);
    for (let index = 0; index < 12; index += 1) {
      advanceMonth(date);
    }

    expect(date).toEqual({ year: 1950, month: 1, elapsedMonths: 12 });
  });

  it("计算到目标年份所需月份", () => {
    expect(monthsUntilYear({ year: 1949, month: 7, elapsedMonths: 6 }, 1950)).toBe(6);
  });

  it("引擎连续推进到指定年月且导出为深拷贝", () => {
    const engine = createSimulationEngine();
    engine.dispatch({ type: "CREATE_GAME", seed: 42, startYear: 1949 });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 18 });
    const exported = engine.exportState();

    expect(exported.nation.date).toEqual({
      year: 1950,
      month: 7,
      elapsedMonths: 18,
    });
    exported.nation.date.year = 9999;
    expect(engine.getState().nation.date.year).toBe(1950);
  });
});
