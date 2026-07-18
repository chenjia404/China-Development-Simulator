import initiativeData from "../../data/config/historical-event-initiatives.json";
import { averageInternationalRelation } from "../diplomacy/diplomacy";
import type { GameState, ModifierState } from "../state/game-state";
import type { HistoricalEventRecord } from "../state/history-state";
import { addModifier } from "./modifiers";
import {
  enactHistoricalEventEarly,
  getHistoricalEvent,
} from "./historical-event-engine";

export interface HistoricalInitiativeRequirements {
  historicalEventIds: string[];
  minimumMonthsSinceEvents: Partial<Record<string, number>>;
  minimumInstitutionalEfficiency: number;
  minimumStability: number;
  minimumOpenness: number;
  minimumReputation: number;
  minimumAverageRelation: number;
  supportRelationThreshold?: number;
  minimumSupportingCountries?: number;
  minimumTradeAgreements: number;
  minimumInternationalInfluence: number;
}

export interface HistoricalInitiativeDefinition {
  id: string;
  eventId: string;
  name: string;
  description: string;
  availableFromYear: number;
  diplomaticPointCost: number;
  transitionDurationMonths: number;
  requirements: HistoricalInitiativeRequirements;
  transitionEffects: string[];
  transitionModifiers: Array<{
    target: string;
    operation: ModifierState["operation"];
    value: number;
  }>;
}

export interface HistoricalInitiativeStatus {
  definition: HistoricalInitiativeDefinition;
  completed: boolean;
  available: boolean;
  blockers: string[];
  completedRecord: HistoricalEventRecord | null;
}

export const historicalInitiativeDefinitions =
  initiativeData as HistoricalInitiativeDefinition[];

export function getHistoricalInitiative(
  initiativeId: string,
): HistoricalInitiativeDefinition | undefined {
  return historicalInitiativeDefinitions.find(
    (initiative) => initiative.id === initiativeId,
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getHistoricalInitiativeStatus(
  state: GameState,
  initiativeOrId: HistoricalInitiativeDefinition | string,
): HistoricalInitiativeStatus {
  const definition = typeof initiativeOrId === "string"
    ? getHistoricalInitiative(initiativeOrId)
    : initiativeOrId;
  if (!definition) throw new Error(`未知历史转折国策：${initiativeOrId}`);
  const event = getHistoricalEvent(definition.eventId);
  if (!event) throw new Error(`历史转折国策关联了未知事件：${definition.eventId}`);
  const completedRecord = state.nation.history.historicalEvents.find(
    (record) => record.id === definition.eventId,
  ) ?? null;
  if (completedRecord) {
    return {
      definition,
      completed: true,
      available: false,
      blockers: [],
      completedRecord,
    };
  }

  const blockers: string[] = [];
  const { nation } = state;
  const requirements = definition.requirements;
  const isBeforeSchedule = nation.date.year < event.year ||
    (nation.date.year === event.year && nation.date.month < event.month);
  if (!isBeforeSchedule) blockers.push(`已到${event.year}年${event.month}月史实触发期`);
  if (nation.date.year < definition.availableFromYear) {
    blockers.push(`最早可在 ${definition.availableFromYear} 年发动`);
  }
  if (nation.pendingHistoricalEventId) blockers.push("需先处理当前历史事件决策");
  for (const requiredEventId of requirements.historicalEventIds) {
    const requiredRecord = nation.history.historicalEvents.find(
      (record) => record.id === requiredEventId,
    );
    if (!requiredRecord) {
      blockers.push(`需先完成${getHistoricalEvent(requiredEventId)?.name ?? requiredEventId}`);
      continue;
    }
    const minimumMonths = requirements.minimumMonthsSinceEvents[requiredEventId] ?? 0;
    const elapsedMonths = (nation.date.year - requiredRecord.year) * 12 +
      nation.date.month - requiredRecord.month;
    if (elapsedMonths < minimumMonths) {
      blockers.push(
        `${requiredRecord.name}需实施满 ${minimumMonths} 个月（还需 ${minimumMonths - elapsedMonths} 个月）`,
      );
    }
  }
  if (nation.economy.institutionalEfficiency < requirements.minimumInstitutionalEfficiency) {
    blockers.push(`制度效率需达到 ${formatPercent(requirements.minimumInstitutionalEfficiency)}`);
  }
  if (nation.society.stabilityIndex < requirements.minimumStability) {
    blockers.push(`社会稳定需达到 ${requirements.minimumStability.toFixed(0)}`);
  }
  if (nation.trade.openness < requirements.minimumOpenness) {
    blockers.push(`开放度需达到 ${formatPercent(requirements.minimumOpenness)}`);
  }
  if (nation.diplomacy.globalReputation < requirements.minimumReputation) {
    blockers.push(`国际声誉需达到 ${requirements.minimumReputation.toFixed(0)}`);
  }
  if (averageInternationalRelation(state) < requirements.minimumAverageRelation) {
    blockers.push(`总体国际关系需达到 ${requirements.minimumAverageRelation.toFixed(0)}`);
  }
  const supportRelationThreshold = requirements.supportRelationThreshold ?? 0;
  const supportingCountries = state.world.countries.filter(
    (country) =>
      country.diplomaticStatus !== "sanctioned" &&
      country.relationWithChina >= supportRelationThreshold,
  ).length;
  if (supportingCountries < (requirements.minimumSupportingCountries ?? 0)) {
    blockers.push(
      `需至少 ${requirements.minimumSupportingCountries} 个国家关系达到 ${supportRelationThreshold}`,
    );
  }
  const tradeAgreements = state.world.countries.filter(
    (country) => country.tradeAgreement,
  ).length;
  if (tradeAgreements < requirements.minimumTradeAgreements) {
    blockers.push(`需至少签署 ${requirements.minimumTradeAgreements} 项贸易协定`);
  }
  if (nation.internationalInfluence < requirements.minimumInternationalInfluence) {
    blockers.push(`国际影响力需达到 ${requirements.minimumInternationalInfluence.toFixed(0)}`);
  }
  if (nation.diplomacy.diplomaticPoints < definition.diplomaticPointCost) {
    blockers.push(`需要 ${definition.diplomaticPointCost} 点外交点数`);
  }
  return {
    definition,
    completed: false,
    available: blockers.length === 0,
    blockers,
    completedRecord: null,
  };
}

/** 发动一次性历史转折国策；全部门槛均由当前可序列化状态确定。 */
export function enactHistoricalInitiative(
  state: GameState,
  initiativeId: string,
): HistoricalEventRecord {
  const status = getHistoricalInitiativeStatus(state, initiativeId);
  if (status.completed) throw new Error(`${status.definition.name}已经完成`);
  if (!status.available) {
    throw new Error(`${status.definition.name}尚不可发动：${status.blockers.join("；")}`);
  }

  const { definition } = status;
  const record = enactHistoricalEventEarly(
    state.nation,
    definition.eventId,
    definition.id,
    definition.name,
    definition.transitionEffects,
  );
  state.nation.diplomacy.diplomaticPoints -= definition.diplomaticPointCost;
  for (const [index, modifier] of definition.transitionModifiers.entries()) {
    addModifier(state.nation, {
      id: `historical-initiative:${definition.id}:${index}`,
      sourceId: `historical-initiative:${definition.id}`,
      target: modifier.target,
      operation: modifier.operation,
      value: modifier.value,
      remainingMonths: definition.transitionDurationMonths,
      stackRule: "replace",
    });
  }

  return record;
}
