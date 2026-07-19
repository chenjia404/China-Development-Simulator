import { describe, expect, it } from "vitest";
import historicalEventDecisions from "../data/config/historical-event-decisions.json";
import historicalEventInitiatives from "../data/config/historical-event-initiatives.json";
import historicalEvents from "../data/config/historical-events.json";
import {
  formatHistoricalModifier,
  historicalModifierLabels,
} from "./historical-modifier-text";

function collectModifierTargets(
  value: unknown,
  targets = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectModifierTargets(item, targets);
    return targets;
  }
  if (value === null || typeof value !== "object") return targets;
  const record = value as Record<string, unknown>;
  if (typeof record.target === "string") targets.add(record.target);
  for (const nested of Object.values(record)) collectModifierTargets(nested, targets);
  return targets;
}

describe("国策影响说明中文化", () => {
  it("覆盖全部历史事件、玩家决策和主动国策的模型变量", () => {
    const targets = collectModifierTargets([
      historicalEvents,
      historicalEventDecisions,
      historicalEventInitiatives,
    ]);
    const missing = [...targets].filter((target) => !historicalModifierLabels[target]);
    expect(missing).toEqual([]);
  });

  it("未知内部字段也不会直接显示为英文标识符", () => {
    expect(formatHistoricalModifier({
      target: "future.internalTarget",
      operation: "add",
      value: 1,
    })).toBe("其他政策传导指标 +1.0");
  });
});
