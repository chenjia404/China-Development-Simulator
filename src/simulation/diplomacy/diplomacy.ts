import diplomacyConfig from "../../data/config/diplomacy.json";
import { approach, clamp } from "../core/math";
import type { GameState } from "../state/game-state";
import type { WorldCountryState } from "../state/world-state";

export type DiplomaticActionId = keyof typeof diplomacyConfig.actions;

export interface InternationalOrganizationDefinition {
  id: string;
  name: string;
  description: string;
  availableYear: number;
  cost: number;
  minimumInfluence: number;
  minimumOpenness: number;
  minimumAverageRelation: number;
  minimumStrategicPartners: number;
  tradeMultiplier: number;
  monthlyPointGain: number;
  reputationBonus: number;
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
  };
  state.nation.diplomacy.organizationIds ??= [];
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
  const organization = internationalOrganizations.find(
    (item) => item.id === organizationId,
  );
  if (!organization) throw new Error(`未知国际组织：${organizationId}`);
  if (state.nation.diplomacy.organizationIds.includes(organizationId)) {
    throw new Error(`已经加入${organization.name}`);
  }
  if (state.nation.date.year < organization.availableYear) {
    throw new Error(`${organization.name}需到 ${organization.availableYear} 年才可加入`);
  }
  if (state.nation.internationalInfluence < organization.minimumInfluence) {
    throw new Error(`${organization.name}需要国际影响力达到 ${organization.minimumInfluence}`);
  }
  if (state.nation.trade.openness < organization.minimumOpenness) {
    throw new Error(`${organization.name}需要开放度达到 ${Math.round(organization.minimumOpenness * 100)}%`);
  }
  if (averageInternationalRelation(state) < organization.minimumAverageRelation) {
    throw new Error(`${organization.name}需要更好的总体国际关系`);
  }
  const strategicPartners = state.world.countries.filter(
    (country) => country.diplomaticStatus === "strategic_partner",
  ).length;
  if (strategicPartners < organization.minimumStrategicPartners) {
    throw new Error(`${organization.name}需要至少 ${organization.minimumStrategicPartners} 个战略伙伴`);
  }
  if (state.nation.diplomacy.diplomaticPoints < organization.cost) {
    throw new Error(`加入${organization.name}需要 ${organization.cost} 点外交点数`);
  }

  state.nation.diplomacy.diplomaticPoints -= organization.cost;
  state.nation.diplomacy.organizationIds.push(organization.id);
  state.nation.diplomacy.globalReputation = clamp(
    state.nation.diplomacy.globalReputation + organization.reputationBonus,
    0,
    100,
  );
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
      organizationPointGain,
    0.25,
    2,
  );
  nation.diplomacy.diplomaticPoints = clamp(
    nation.diplomacy.diplomaticPoints + nation.diplomacy.monthlyPointGain,
    0,
    diplomacyConfig.maximumDiplomaticPoints,
  );

  const securityTarget = clamp(
    25 +
      nation.fiscal.budget.defense * 180 +
      nation.technology.index * 0.2 +
      nation.society.stabilityIndex * 0.15,
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
      (nation.diplomacy.globalReputation - 50) * 0.3 +
        nation.trade.openness * 12 +
        cooperationBonus -
        country.sanctionLevel * 80,
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
    42 +
      averageInternationalRelation(state) * 0.18 +
      nation.economy.institutionalEfficiency * 12 +
      organizationReputation,
    0,
    100,
  );
  nation.diplomacy.globalReputation = approach(
    nation.diplomacy.globalReputation,
    reputationTarget,
    0.01,
  );
}
