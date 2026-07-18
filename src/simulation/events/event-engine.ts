import eventConfig from "../../data/config/events.json";
import { clamp } from "../core/math";
import type { RandomGenerator } from "../core/random";
import type { NationState } from "../state/game-state";
import { addModifier } from "./modifiers";
import { historicalEventName } from "./historical-event-engine";

type EventId = typeof eventConfig.events[number]["id"];

function stateProbabilityFactor(eventId: EventId, nation: NationState): number {
  const foodShortage = Math.max(0, 1 - nation.resources.foodSupplyRatio);
  const energyShortage = Math.max(0, 1 - nation.resources.energySupplyRatio);
  switch (eventId) {
    case "natural_disaster":
      return 0.8 + (1 - nation.economy.infrastructureIndex / 100) * 0.4;
    case "epidemic":
      return 0.7 + (1 - nation.health.index / 100) * 0.7;
    case "energy_crisis":
      return 0.7 + energyShortage * 0.8 + nation.trade.openness * 0.2;
    case "financial_crisis":
      return 0.6 + nation.fiscal.debtToGDP * 1.2 + nation.trade.openness * 0.4;
    case "trade_opportunity":
      return 0.4 + nation.trade.openness * 1.2;
    case "technology_breakthrough":
      return 0.4 + nation.education.index / 200 + nation.fiscal.budget.research * 2;
    case "food_crisis":
      return 0.5 + foodShortage * 1.5;
    default:
      throw new Error(`未知事件：${eventId}`);
  }
}

export function calculateEventProbability(
  eventId: EventId,
  nation: NationState,
  randomFactor = 1,
): number {
  const event = eventConfig.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`未知事件：${eventId}`);
  const stageFactor = nation.date.year < 1978 ? 1.08 : 1;
  return clamp(
    event.baseProbability * stateProbabilityFactor(eventId, nation) * stageFactor * randomFactor,
    0,
    0.6,
  );
}

/** 每年一月检查事件；同一年最多触发配置指定的事件数。 */
export function checkRandomEvents(
  nation: NationState,
  random: RandomGenerator,
): string[] {
  if (nation.date.month !== 1) return [];
  const triggered: string[] = [];
  for (const event of eventConfig.events) {
    if (triggered.length >= eventConfig.maximumEventsPerYear) break;
    if (nation.modifiers.some((modifier) => modifier.sourceId === event.id)) continue;
    const randomFactor =
      eventConfig.randomProbabilityMinimum +
      random.next() * eventConfig.randomProbabilityRange;
    if (random.next() >= calculateEventProbability(event.id, nation, randomFactor)) continue;
    for (const [index, modifier] of event.modifiers.entries()) {
      addModifier(nation, {
        id: `${event.id}:${nation.date.year}:${index}`,
        sourceId: event.id,
        target: modifier.target,
        operation: modifier.operation as "add" | "multiply" | "override",
        value: modifier.value,
        remainingMonths: event.durationMonths,
        stackRule: "replace",
      });
    }
    triggered.push(event.name);
  }
  return triggered;
}

export function eventName(eventId: string): string {
  return eventConfig.events.find((event) => event.id === eventId)?.name ??
    historicalEventName(eventId) ??
    eventId;
}
