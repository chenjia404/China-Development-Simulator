import diplomacyConfig from "../../data/config/diplomacy.json";
import { approach, clamp } from "../core/math";
import type { GameState } from "../state/game-state";
import type { WorldCountryState } from "../state/world-state";
import { applyModifiers } from "../events/modifiers";
import {
  getHistoricalEvent,
  triggerConditionalHistoricalEvent,
} from "../events/historical-event-engine";
import {
  diplomaticRelationTargetAdjustment,
  diplomaticStrategyEffects,
  updateDiplomaticStrategy,
} from "./diplomatic-strategy";
import {
  foreignPolicyDoctrineEffects,
  foreignPolicyDoctrineRelationAdjustment,
  updateForeignPolicyDoctrine,
} from "./foreign-policy-doctrine";

export type DiplomaticActionId = keyof typeof diplomacyConfig.actions;

export interface InternationalOrganizationDefinition {
  id: string;
  name: string;
  description: string;
  automatic?: boolean;
  availableYear: number;
  cost: number;
  minimumInfluence: number;
  minimumOpenness: number;
  minimumAverageRelation: number;
  minimumStrategicPartners: number;
  supportRelationThreshold: number;
  minimumSupportingCountries: number;
  minimumTradeAgreements: number;
  requiredHistoricalEventIds?: string[];
  minimumMonthsSinceEvents?: Record<string, number>;
  historicalEventId?: string;
  tradeMultiplier: number;
  monthlyPointGain: number;
  reputationBonus: number;
}

export interface InternationalOrganizationStatus {
  definition: InternationalOrganizationDefinition;
  joined: boolean;
  available: boolean;
  blockers: string[];
  averageRelation: number;
  supportingCountries: number;
  tradeAgreements: number;
}

export const diplomaticActionDefinitions = diplomacyConfig.actions;
export const internationalOrganizations =
  diplomacyConfig.organizations as InternationalOrganizationDefinition[];

function initialRelation(countryId: string): number {
  return diplomacyConfig.initialRelations[
    countryId as keyof typeof diplomacyConfig.initialRelations
  ] ?? 0;
}

export function ensureDiplomacyState(state: GameState): void {
  state.nation.diplomacy ??= {
    diplomaticPoints: diplomacyConfig.initialDiplomaticPoints,
    monthlyPointGain: 0,
    globalReputation: diplomacyConfig.initialReputation,
    securityIndex: diplomacyConfig.initialSecurityIndex,
    organizationIds: [],
    strategyId: "balanced",
    strategyAlignment: 0,
    lastStrategyChangeMonth: null,
    foreignPolicyDoctrineId: "status_quo",
    previousForeignPolicyDoctrineId: null,
    foreignPolicyDoctrineProgress: 1,
    lastForeignPolicyDoctrineChangeMonth: null,
  };
  state.nation.diplomacy.organizationIds ??= [];
  state.nation.diplomacy.strategyId ??= "balanced";
  state.nation.diplomacy.strategyAlignment ??= 0;
  state.nation.diplomacy.lastStrategyChangeMonth ??= null;
  state.nation.diplomacy.foreignPolicyDoctrineId ??= "status_quo";
  state.nation.diplomacy.previousForeignPolicyDoctrineId ??= null;
  state.nation.diplomacy.foreignPolicyDoctrineProgress ??= 1;
  state.nation.diplomacy.lastForeignPolicyDoctrineChangeMonth ??= null;
  for (const country of state.world.countries) {
    country.relationWithChina ??= initialRelation(country.id);
    country.diplomaticStatus ??= "neutral";
    country.tradeAgreement ??= false;
    country.sanctionLevel ??= 0;
    country.lastDiplomaticActionMonth ??= null;
  }
}

export function averageInternationalRelation(state: GameState): number {
  if (state.world.countries.length === 0) return 0;
  return state.world.countries.reduce(
    (sum, country) => sum + country.relationWithChina,
    0,
  ) / state.world.countries.length;
}

function getCountry(state: GameState, countryId: string): WorldCountryState {
  const country = state.world.countries.find((item) => item.id === countryId);
  if (!country) throw new Error(`未知国家：${countryId}`);
  return country;
}

function validateActionState(
  actionId: DiplomaticActionId,
  country: WorldCountryState,
): void {
  if (actionId === "sign_trade_agreement" && country.tradeAgreement) {
    throw new Error(`已与${country.name}签署贸易协定`);
  }
  if (
    actionId === "strategic_partnership" &&
    (!country.tradeAgreement || country.diplomaticStatus === "strategic_partner")
  ) {
    throw new Error("建立战略伙伴关系前必须先签署贸易协定，且不得重复建立");
  }
  if (actionId === "impose_sanctions" && country.diplomaticStatus === "sanctioned") {
    throw new Error(`已对${country.name}实施制裁`);
  }
  if (actionId === "lift_sanctions" && country.diplomaticStatus !== "sanctioned") {
    throw new Error(`当前未对${country.name}实施制裁`);
  }
  if (
    country.diplomaticStatus === "sanctioned" &&
    (actionId === "sign_trade_agreement" || actionId === "strategic_partnership")
  ) {
    throw new Error("制裁期间不能签署协定或建立战略伙伴关系");
  }
}

export function executeDiplomaticAction(
  state: GameState,
  actionId: DiplomaticActionId,
  countryId: string,
): void {
  ensureDiplomacyState(state);
  const action = diplomaticActionDefinitions[actionId];
  if (!action) throw new Error(`未知外交行动：${actionId}`);
  const country = getCountry(state, countryId);
  validateActionState(actionId, country);
  if (country.relationWithChina < action.minimumRelation) {
    throw new Error(`${action.name}需要双边关系达到 ${action.minimumRelation}`);
  }
  if (country.lastDiplomaticActionMonth !== null) {
    const elapsed = state.nation.date.elapsedMonths - country.lastDiplomaticActionMonth;
    if (elapsed < action.cooldownMonths) {
      throw new Error(`${country.name}的外交行动还需冷却 ${action.cooldownMonths - elapsed} 个月`);
    }
  }
  if (state.nation.diplomacy.diplomaticPoints < action.cost) {
    throw new Error(`${action.name}需要 ${action.cost} 点外交点数`);
  }

  state.nation.diplomacy.diplomaticPoints -= action.cost;
  country.relationWithChina = clamp(
    country.relationWithChina + action.relationChange,
    -100,
    100,
  );
  country.lastDiplomaticActionMonth = state.nation.date.elapsedMonths;

  if (actionId === "sign_trade_agreement") {
    country.tradeAgreement = true;
    country.diplomaticStatus = "partner";
  }
  if (actionId === "strategic_partnership") {
    country.diplomaticStatus = "strategic_partner";
  }
  if (actionId === "impose_sanctions") {
    country.diplomaticStatus = "sanctioned";
    country.sanctionLevel = Math.max(country.sanctionLevel, 0.6);
    state.nation.diplomacy.globalReputation = clamp(
      state.nation.diplomacy.globalReputation - 2,
      0,
      100,
    );
  }
  if (actionId === "lift_sanctions") {
    country.sanctionLevel = 0;
    country.diplomaticStatus = country.tradeAgreement ? "partner" : "neutral";
    state.nation.diplomacy.globalReputation = clamp(
      state.nation.diplomacy.globalReputation + 1,
      0,
      100,
    );
  }
}

export function joinInternationalOrganization(
  state: GameState,
  organizationId: string,
): void {
  ensureDiplomacyState(state);
  const status = getInternationalOrganizationStatus(state, organizationId);
  const { definition: organization } = status;
  if (organization.automatic) {
    throw new Error(`${organization.name}由历史进程和外交条件自动解锁，不能手动申请`);
  }
  if (status.joined) throw new Error(`已经加入${organization.name}`);
  if (!status.available) {
    throw new Error(`加入${organization.name}的条件未满足：${status.blockers.join("；")}`);
  }

  state.nation.diplomacy.diplomaticPoints -= organization.cost;
  state.nation.diplomacy.organizationIds.push(organization.id);
  state.nation.diplomacy.globalReputation = clamp(
    state.nation.diplomacy.globalReputation + organization.reputationBonus,
    0,
    100,
  );
}

/** 在状态变更和月度推进后结算条件型国际资格；不消耗主动外交点数。 */
export function checkAutomaticInternationalOrganizations(state: GameState): string[] {
  ensureDiplomacyState(state);
  if (state.nation.pendingHistoricalEventId) return [];
  const unlocked: string[] = [];
  for (const organization of internationalOrganizations) {
    if (!organization.automatic) continue;
    const status = getInternationalOrganizationStatus(state, organization.id);
    if (!status.available) continue;
    if (organization.historicalEventId) {
      triggerConditionalHistoricalEvent(
        state.nation,
        organization.historicalEventId,
        `organization:${organization.id}`,
        `条件达成后自动取得${organization.name}`,
        [
          `平均国际关系达到 ${status.averageRelation.toFixed(1)}`,
          `${status.supportingCountries} 个国家达到支持门槛`,
        ],
      );
    }
    state.nation.diplomacy.organizationIds.push(organization.id);
    state.nation.diplomacy.globalReputation = clamp(
      state.nation.diplomacy.globalReputation + organization.reputationBonus,
      0,
      100,
    );
    unlocked.push(organization.id);
  }
  return unlocked;
}

export function getInternationalOrganizationStatus(
  state: GameState,
  organizationId: string,
): InternationalOrganizationStatus {
  const organization = internationalOrganizations.find(
    (item) => item.id === organizationId,
  );
  if (!organization) throw new Error(`未知国际组织：${organizationId}`);
  const averageRelation = averageInternationalRelation(state);
  const supportingCountries = state.world.countries.filter(
    (country) =>
      country.diplomaticStatus !== "sanctioned" &&
      country.relationWithChina >= organization.supportRelationThreshold,
  ).length;
  const tradeAgreements = state.world.countries.filter(
    (country) => country.tradeAgreement,
  ).length;
  const strategicPartners = state.world.countries.filter(
    (country) => country.diplomaticStatus === "strategic_partner",
  ).length;
  const blockers: string[] = [];
  if (state.nation.date.year < organization.availableYear) {
    blockers.push(
      organization.automatic
        ? `最早可在 ${organization.availableYear} 年取得资格`
        : `最早可在 ${organization.availableYear} 年申请`,
    );
  }
  for (const requiredEventId of organization.requiredHistoricalEventIds ?? []) {
    const requiredEvent = getHistoricalEvent(requiredEventId);
    const requiredRecord = state.nation.history.historicalEvents.find(
      (record) => record.id === requiredEventId,
    );
    if (!requiredRecord) {
      blockers.push(`需先完成${requiredEvent?.name ?? requiredEventId}`);
      continue;
    }
    const minimumMonths = organization.minimumMonthsSinceEvents?.[requiredEventId] ?? 0;
    const elapsedMonths = (state.nation.date.year - requiredRecord.year) * 12 +
      state.nation.date.month - requiredRecord.month;
    if (elapsedMonths < minimumMonths) {
      blockers.push(
        `${requiredRecord.name}需推进满 ${minimumMonths} 个月（还需 ${minimumMonths - elapsedMonths} 个月）`,
      );
    }
  }
  if (state.nation.internationalInfluence < organization.minimumInfluence) {
    blockers.push(`国际影响力需达到 ${organization.minimumInfluence}`);
  }
  if (state.nation.trade.openness < organization.minimumOpenness) {
    blockers.push(`开放度需达到 ${Math.round(organization.minimumOpenness * 100)}%`);
  }
  if (averageRelation < organization.minimumAverageRelation) {
    blockers.push(`平均国际关系需达到 ${organization.minimumAverageRelation}`);
  }
  if (supportingCountries < organization.minimumSupportingCountries) {
    blockers.push(
      `需至少 ${organization.minimumSupportingCountries} 个国家关系达到 ${organization.supportRelationThreshold}`,
    );
  }
  if (tradeAgreements < organization.minimumTradeAgreements) {
    blockers.push(`需至少签署 ${organization.minimumTradeAgreements} 项贸易协定`);
  }
  if (strategicPartners < organization.minimumStrategicPartners) {
    blockers.push(`需至少拥有 ${organization.minimumStrategicPartners} 个战略伙伴`);
  }
  if (
    !organization.automatic &&
    state.nation.diplomacy.diplomaticPoints < organization.cost
  ) {
    blockers.push(`需要 ${organization.cost} 点外交点数`);
  }
  const joined = state.nation.diplomacy.organizationIds.includes(organizationId);
  return {
    definition: organization,
    joined,
    available: !joined && blockers.length === 0,
    blockers,
    averageRelation,
    supportingCountries,
    tradeAgreements,
  };
}

export function organizationTradeMultiplier(state: GameState): number {
  return internationalOrganizations.reduce(
    (multiplier, organization) =>
      state.nation.diplomacy.organizationIds.includes(organization.id)
        ? multiplier * organization.tradeMultiplier
        : multiplier,
    1,
  );
}

export function updateDiplomacy(state: GameState): void {
  ensureDiplomacyState(state);
  const { nation } = state;
  updateDiplomaticStrategy(nation);
  updateForeignPolicyDoctrine(nation);
  const strategyEffects = diplomaticStrategyEffects(nation);
  const doctrineEffects = foreignPolicyDoctrineEffects(nation);
  const organizationPointGain = internationalOrganizations.reduce(
    (sum, organization) =>
      nation.diplomacy.organizationIds.includes(organization.id)
        ? sum + organization.monthlyPointGain
        : sum,
    0,
  );
  nation.diplomacy.monthlyPointGain = clamp(
    0.25 +
      nation.fiscal.budget.administration * 1.5 +
      nation.fiscal.budget.defense * 0.8 +
      nation.internationalInfluence / 250 +
      organizationPointGain +
      doctrineEffects.monthlyPointGainAdjustment,
    0.25,
    2,
  );
  nation.diplomacy.diplomaticPoints = clamp(
    nation.diplomacy.diplomaticPoints + nation.diplomacy.monthlyPointGain,
    0,
    diplomacyConfig.maximumDiplomaticPoints,
  );

  const securityTarget = clamp(
    applyModifiers(
      nation,
      "diplomacy.securityTarget",
      25 +
        nation.fiscal.budget.defense * 180 +
        nation.technology.index * 0.2 +
        nation.society.stabilityIndex * 0.15 +
        strategyEffects.securityTargetAdjustment +
        doctrineEffects.securityTargetAdjustment,
    ),
    0,
    100,
  );
  nation.diplomacy.securityIndex = approach(
    nation.diplomacy.securityIndex,
    securityTarget,
    0.02,
  );

  for (const country of state.world.countries) {
    const cooperationBonus =
      (country.tradeAgreement ? 8 : 0) +
      (country.diplomaticStatus === "strategic_partner" ? 12 : 0);
    const relationTarget = clamp(
      applyModifiers(
        nation,
        `diplomacy.relationTarget.${country.id}`,
        (nation.diplomacy.globalReputation - 50) * 0.3 +
          nation.trade.openness * 12 +
          cooperationBonus -
          country.sanctionLevel * 80 +
          diplomaticRelationTargetAdjustment(nation, country.id) +
          foreignPolicyDoctrineRelationAdjustment(nation, country.id),
      ),
      -100,
      100,
    );
    country.relationWithChina = approach(
      country.relationWithChina,
      relationTarget,
      0.002,
    );
  }

  const organizationReputation = internationalOrganizations.reduce(
    (sum, organization) =>
      nation.diplomacy.organizationIds.includes(organization.id)
        ? sum + organization.reputationBonus * 0.6
        : sum,
    0,
  );
  const reputationTarget = clamp(
    applyModifiers(
      nation,
      "diplomacy.reputationTarget",
      42 +
        averageInternationalRelation(state) * 0.18 +
        nation.economy.institutionalEfficiency * 12 +
        organizationReputation +
        strategyEffects.reputationTargetAdjustment +
        doctrineEffects.reputationTargetAdjustment,
    ),
    0,
    100,
  );
  nation.diplomacy.globalReputation = approach(
    nation.diplomacy.globalReputation,
    reputationTarget,
    0.01,
  );
}
