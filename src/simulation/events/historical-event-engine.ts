import historicalEventData from "../../data/config/historical-events.json";
import type { NationState } from "../state/game-state";
import type { HistoricalEventRecord } from "../state/history-state";
import { addModifier } from "./modifiers";

export type HistoricalEventCategory =
  | "经济制度"
  | "财政金融"
  | "农业农村"
  | "对外经济"
  | "工业化"
  | "经济危机"
  | "宏观调控"
  | "社会教育"
  | "外交"
  | "经济改革"
  | "外部冲击"
  | "公共卫生"
  | "外交经贸";

export type HistoricalEventImpact = "positive" | "negative" | "mixed";

export interface HistoricalEventDefinition {
  id: string;
  name: string;
  year: number;
  month: number;
  category: HistoricalEventCategory;
  impact: HistoricalEventImpact;
  description: string;
  effects: string[];
  durationMonths: number;
  modifiers: Array<{
    target: string;
    operation: "add" | "multiply" | "override";
    value: number;
  }>;
}

export const historicalEventDefinitions =
  historicalEventData as HistoricalEventDefinition[];

export function getHistoricalEvent(
  eventId: string,
): HistoricalEventDefinition | undefined {
  return historicalEventDefinitions.find((event) => event.id === eventId);
}

export function ensureHistoricalEventHistory(nation: NationState): void {
  nation.history.historicalEvents ??= [];
}

function toRecord(event: HistoricalEventDefinition): HistoricalEventRecord {
  return {
    id: event.id,
    name: event.name,
    year: event.year,
    month: event.month,
    category: event.category,
    impact: event.impact,
    description: event.description,
    effects: [...event.effects],
    durationMonths: event.durationMonths,
  };
}

/** 历史事件按年月确定触发；记录和修正均只写入一次。 */
export function checkHistoricalEvents(nation: NationState): HistoricalEventRecord[] {
  ensureHistoricalEventHistory(nation);
  const occurredIds = new Set(
    nation.history.historicalEvents.map((event) => event.id),
  );
  const triggered: HistoricalEventRecord[] = [];
  for (const event of historicalEventDefinitions) {
    if (
      event.year !== nation.date.year ||
      event.month !== nation.date.month ||
      occurredIds.has(event.id)
    ) {
      continue;
    }
    for (const [index, modifier] of event.modifiers.entries()) {
      addModifier(nation, {
        id: `historical:${event.id}:${index}`,
        sourceId: event.id,
        target: modifier.target,
        operation: modifier.operation,
        value: modifier.value,
        remainingMonths: event.durationMonths,
        stackRule: "replace",
      });
    }
    const record = toRecord(event);
    nation.history.historicalEvents.push(record);
    triggered.push(record);
  }
  return triggered;
}

export function historicalEventName(eventId: string): string | undefined {
  return getHistoricalEvent(eventId)?.name;
}
