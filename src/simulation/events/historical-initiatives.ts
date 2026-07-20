import diplomacyConfig from "../../data/config/diplomacy.json";
import initiativeData from "../../data/config/historical-event-initiatives.json";
import { averageInternationalRelation } from "../diplomacy/diplomacy";
import { ensureSinoUSNormalizationState } from "../diplomacy/sino-us-normalization";
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
  requiredOrganizationIds?: string[];
  requireSinoUSNormalization?: boolean;
  minimumInstitutionalEfficiency: number;
  minimumStateCapacity?: number;
  minimumLocalImplementationCapacity?: number;
  minimumLegalPredictability?: number;
  minimumEducationBudgetShare?: number;
  minimumStability: number;
  minimumOpenness: number;
  minimumReputation: number;
  minimumAverageRelation: number;
  supportRelationThreshold?: number;
  minimumSupportingCountries?: number;
  minimumTradeAgreements: number;
  minimumInternationalInfluence: number;
  minimumEducationIndex?: number;
  minimumTechnologyIndex?: number;
  minimumUrbanizationRate?: number;
  minimumSecondarySectorShare?: number;
  minimumPrivateOperatingSpace?: number;
  minimumEntrepreneurialCapacity?: number;
}

function organizationName(organizationId: string): string {
  const organization = diplomacyConfig.organizations.find(
    (item) => item.id === organizationId,
  );
  return organization?.name ?? organizationId;
}

export interface HistoricalInitiativeDefinition {
  id: string;
  eventId: string;
  name: string;
  category: string;
  description: string;
  availableFromYear?: number;
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
  if (
    definition.availableFromYear !== undefined &&
    nation.date.year < definition.availableFromYear
  ) {
    blockers.push(`最早可在 ${definition.availableFromYear} 年发动`);
  }
  if (nation.pendingHistoricalEventId) blockers.push("需先处理当前历史事件决策");
  if (nation.famineMortality?.pendingReport) {
    blockers.push("需先确认三年困难人口损失报告");
  }
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
  for (const organizationId of requirements.requiredOrganizationIds ?? []) {
    if (!nation.diplomacy.organizationIds.includes(organizationId)) {
      blockers.push(`需先取得${organizationName(organizationId)}`);
    }
  }
  if (requirements.requireSinoUSNormalization) {
    ensureSinoUSNormalizationState(state);
    if (nation.diplomacy.sinoUSNormalizationStatus !== "established") {
      blockers.push("需先完成中美建交");
    }
  }
  if (nation.economy.institutionalEfficiency < requirements.minimumInstitutionalEfficiency) {
    blockers.push(`制度效率需达到 ${formatPercent(requirements.minimumInstitutionalEfficiency)}`);
  }
  if (
    requirements.minimumStateCapacity !== undefined &&
    nation.institutions.stateCapacity < requirements.minimumStateCapacity
  ) {
    blockers.push(`国家能力需达到 ${formatPercent(requirements.minimumStateCapacity)}`);
  }
  if (
    requirements.minimumLocalImplementationCapacity !== undefined &&
    nation.institutions.localImplementationCapacity <
      requirements.minimumLocalImplementationCapacity
  ) {
    blockers.push(
      `地方执行能力需达到 ${formatPercent(requirements.minimumLocalImplementationCapacity)}`,
    );
  }
  if (
    requirements.minimumLegalPredictability !== undefined &&
    nation.institutions.legalPredictability < requirements.minimumLegalPredictability
  ) {
    blockers.push(
      `法律可预期性需达到 ${formatPercent(requirements.minimumLegalPredictability)}`,
    );
  }
  if (
    requirements.minimumEducationBudgetShare !== undefined &&
    nation.fiscal.budget.education < requirements.minimumEducationBudgetShare
  ) {
    blockers.push(
      `教育预算占比需达到 ${formatPercent(requirements.minimumEducationBudgetShare)}`,
    );
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
  if (
    requirements.minimumEducationIndex !== undefined &&
    nation.education.index < requirements.minimumEducationIndex
  ) {
    blockers.push(`教育指数需达到 ${requirements.minimumEducationIndex.toFixed(0)}`);
  }
  if (
    requirements.minimumTechnologyIndex !== undefined &&
    nation.technology.index < requirements.minimumTechnologyIndex
  ) {
    blockers.push(`科技指数需达到 ${requirements.minimumTechnologyIndex.toFixed(0)}`);
  }
  if (
    requirements.minimumUrbanizationRate !== undefined &&
    nation.society.urbanizationRate < requirements.minimumUrbanizationRate
  ) {
    blockers.push(`城镇化率需达到 ${formatPercent(requirements.minimumUrbanizationRate)}`);
  }
  const totalSectorOutput = Object.values(nation.sectors).reduce(
    (sum, sector) => sum + sector.output,
    0,
  );
  const secondarySectorShare = totalSectorOutput > 0
    ? nation.sectors.secondary.output / totalSectorOutput
    : 0;
  if (
    requirements.minimumSecondarySectorShare !== undefined &&
    secondarySectorShare < requirements.minimumSecondarySectorShare
  ) {
    blockers.push(`第二产业占比需达到 ${formatPercent(requirements.minimumSecondarySectorShare)}`);
  }
  if (
    requirements.minimumPrivateOperatingSpace !== undefined &&
    nation.privateEconomy.operatingSpace < requirements.minimumPrivateOperatingSpace
  ) {
    blockers.push(
      `民营经营空间需达到 ${formatPercent(requirements.minimumPrivateOperatingSpace)}`,
    );
  }
  if (
    requirements.minimumEntrepreneurialCapacity !== undefined &&
    nation.privateEconomy.entrepreneurialCapacity <
      requirements.minimumEntrepreneurialCapacity
  ) {
    blockers.push(
      `企业家组织能力需达到 ${formatPercent(requirements.minimumEntrepreneurialCapacity)}`,
    );
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
