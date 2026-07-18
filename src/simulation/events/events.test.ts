import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { createSimulationEngine } from "../core/engine";
import { calculateEventProbability, checkRandomEvents } from "./event-engine";
import { addModifier, advanceModifiers, applyModifiers } from "./modifiers";
import { Mulberry32 } from "../core/random";

describe("确定性随机事件与 Modifier", () => {
  it("相同状态和事件随机种子产生相同结果", () => {
    const first = createInitialGameState(1949);
    const second = createInitialGameState(1949);
    const firstEvents = checkRandomEvents(first.nation, new Mulberry32(88));
    const secondEvents = checkRandomEvents(second.nation, new Mulberry32(88));

    expect(secondEvents).toEqual(firstEvents);
    expect(second.nation.modifiers).toEqual(first.nation.modifiers);
  });

  it("脆弱医疗系统提高疫情概率", () => {
    const weak = createInitialGameState(1).nation;
    const strong = structuredClone(weak);
    weak.health.index = 10;
    strong.health.index = 90;

    expect(calculateEventProbability("epidemic", weak)).toBeGreaterThan(
      calculateEventProbability("epidemic", strong),
    );
  });

  it("修正器按月生效并在到期后清除", () => {
    const nation = createInitialGameState(1).nation;
    addModifier(nation, {
      id: "测试修正器",
      sourceId: "test",
      target: "sector.primary.output",
      operation: "multiply",
      value: 0.8,
      remainingMonths: 2,
      stackRule: "replace",
    });

    expect(applyModifiers(nation, "sector.primary.output", 100)).toBe(80);
    advanceModifiers(nation);
    expect(nation.modifiers).toHaveLength(1);
    advanceModifiers(nation);
    expect(nation.modifiers).toHaveLength(0);
    expect(applyModifiers(nation, "sector.primary.output", 100)).toBe(100);
  });

  it("延迟修正只在等待期结束后计入持续时间", () => {
    const nation = createInitialGameState(1).nation;
    addModifier(nation, {
      id: "延迟测试修正器",
      sourceId: "test",
      target: "sector.secondary.output",
      operation: "multiply",
      value: 0.8,
      delayMonths: 2,
      remainingMonths: 1,
      stackRule: "stack",
    });

    expect(applyModifiers(nation, "sector.secondary.output", 100)).toBe(100);
    advanceModifiers(nation);
    expect(applyModifiers(nation, "sector.secondary.output", 100)).toBe(100);
    advanceModifiers(nation);
    expect(applyModifiers(nation, "sector.secondary.output", 100)).toBe(80);
    expect(nation.modifiers[0]?.remainingMonths).toBe(1);
    advanceModifiers(nation);
    expect(nation.modifiers).toHaveLength(0);
  });

  it("旧存档缺少事件随机状态时自动迁移", () => {
    const legacyState = createInitialGameState(77);
    delete (legacyState as Partial<typeof legacyState>).eventRandomState;
    const engine = createSimulationEngine(legacyState);

    expect(engine.exportState().eventRandomState).toBe((77 ^ 0x9e3779b9) >>> 0);
    expect(() => engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 })).not.toThrow();
  });
});
