import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { applyModifiers } from "./modifiers";
import { createInitialGameState } from "../state/initial-state";
import {
  checkHistoricalEvents,
  historicalEventDefinitions,
} from "./historical-event-engine";

describe("确定性历史事件", () => {
  it("事件目录具有唯一编号、有效日期和详细影响说明", () => {
    const ids = historicalEventDefinitions.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(historicalEventDefinitions.length).toBeGreaterThanOrEqual(25);
    for (const event of historicalEventDefinitions) {
      expect(event.year).toBeGreaterThanOrEqual(1949);
      expect(event.month).toBeGreaterThanOrEqual(1);
      expect(event.month).toBeLessThanOrEqual(12);
      expect(event.description.length).toBeGreaterThan(30);
      expect(event.effects.length).toBeGreaterThanOrEqual(2);
      expect(event.durationMonths).toBeGreaterThan(0);
    }
  });

  it("区分没收官僚资本与清理在华外资企业", () => {
    const state = createInitialGameState(1950, 1950);
    state.nation.date.month = 12;
    const triggered = checkHistoricalEvents(state.nation);

    expect(triggered.map((event) => event.id)).toContain(
      "foreign_assets_reorganization",
    );
    expect(triggered[0].description).toContain("合法经营外资");
    expect(triggered[0].description).toContain("对价转让");
    expect(
      applyModifiers(state.nation, "trade.foreignInvestment", 100),
    ).toBe(30);
  });

  it("全行业公私合营在指定月份触发且只触发一次", () => {
    const state = createInitialGameState(1956, 1956);
    const first = checkHistoricalEvents(state.nation);
    const second = checkHistoricalEvents(state.nation);

    expect(first.map((event) => event.name)).toContain("全行业公私合营");
    expect(second).toEqual([]);
    expect(state.nation.history.historicalEvents).toHaveLength(1);
    expect(applyModifiers(state.nation, "sector.secondary.output", 100)).toBeCloseTo(
      102.5,
    );
    expect(applyModifiers(state.nation, "capital.privateInvestment", 100)).toBe(
      94,
    );
  });

  it("历史事件进入年度报告并保留详细记录", () => {
    const engine = createSimulationEngine(createInitialGameState(1956, 1956));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    const state = engine.getState();

    expect(state.nation.history.reports[0].majorEvents).toContain(
      "全行业公私合营",
    );
    expect(state.nation.history.historicalEvents[0]).toMatchObject({
      id: "industry_wide_joint_ownership_1956",
      year: 1956,
      month: 1,
      category: "经济制度",
    });
  });

  it("旧存档缺少历史事件记录时自动迁移", () => {
    const state = createInitialGameState(1949);
    delete (
      state.nation.history as Partial<typeof state.nation.history>
    ).historicalEvents;
    const engine = createSimulationEngine(state);

    expect(engine.getState().nation.history.historicalEvents).toEqual([]);
    expect(() =>
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 }),
    ).not.toThrow();
  });
});
