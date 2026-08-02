import countryData from "../../data/config/world-countries.json";
import diplomacyConfig from "../../data/config/diplomacy.json";
import type { DevelopmentStage, WorldCountryState, WorldState } from "../state/world-state";
import { createEmptyWorldTradeNetworkState } from "../economy/international-network";
import { cityStateRelationForCountry } from "./city-state-relations";

export interface CountryGrowthPhase {
  startYear: number;
  endYear: number;
  growthModifier: number;
}

export interface CountryPopulationPhase {
  startYear: number;
  endYear: number;
  populationGrowth: number;
}

export interface WorldCountryConfig {
  id: string;
  name: string;
  population: number;
  realGDP: number;
  technology: number;
  education: number;
  lifeExpectancy: number;
  happiness: number;
  influence: number;
  baseGrowth: number;
  populationGrowth: number;
  stage: DevelopmentStage;
  importPropensity?: number;
  phases: CountryGrowthPhase[];
  populationPhases?: CountryPopulationPhase[];
}

export const worldCountryConfigs = countryData as WorldCountryConfig[];

function createWorldCountryState(config: WorldCountryConfig): WorldCountryState {
  return {
    id: config.id,
    name: config.name,
    population: config.population,
    realGDP: config.realGDP,
    nominalGDP: config.realGDP,
    priceLevelIndex: 1,
    technologyIndex: config.technology,
    educationIndex: config.education,
    lifeExpectancy: config.lifeExpectancy,
    happinessIndex: config.happiness,
    internationalInfluence: config.influence,
    baseGrowthPotential: config.baseGrowth,
    developmentStage: config.stage,
    importPropensity: config.importPropensity ?? 1,
    cityStateRelation: cityStateRelationForCountry(config.id),
    relationWithChina:
      diplomacyConfig.initialRelations[
        config.id as keyof typeof diplomacyConfig.initialRelations
      ] ?? 0,
    diplomaticStatus: "neutral",
    tradeAgreement: false,
    sanctionLevel: 0,
    lastDiplomaticActionMonth: null,
    modifiers: [],
  };
}

/**
 * 为旧存档补齐配置中新增的世界国家，并按配置顺序重排，
 * 避免迁移后与新开局的国家迭代顺序不一致。
 */
export function ensureWorldCountriesState(world: WorldState): boolean {
  const byId = new Map(
    world.countries.map((country) => [country.id, country] as const),
  );
  let changed = false;
  for (const config of worldCountryConfigs) {
    if (byId.has(config.id)) continue;
    byId.set(config.id, createWorldCountryState(config));
    changed = true;
  }
  const knownIds = new Set(worldCountryConfigs.map((config) => config.id));
  const ordered = worldCountryConfigs.map((config) => byId.get(config.id)!);
  const extras = world.countries.filter((country) => !knownIds.has(country.id));
  const next = extras.length > 0 ? [...ordered, ...extras] : ordered;
  for (const country of next) {
    const config = worldCountryConfigs.find((item) => item.id === country.id);
    if (!Number.isFinite(country.importPropensity)) {
      country.importPropensity = config?.importPropensity ?? 1;
      changed = true;
    }
    const expectedRelation = config
      ? cityStateRelationForCountry(config.id)
      : country.cityStateRelation ?? "trade_partner";
    if (country.cityStateRelation !== expectedRelation) {
      country.cityStateRelation = expectedRelation;
      changed = true;
    }
  }
  const orderChanged = next.length !== world.countries.length ||
    next.some((country, index) => country.id !== world.countries[index]?.id);
  if (orderChanged) {
    world.countries = next;
    changed = true;
  }
  return changed;
}

export function createInitialWorldState(): WorldState {
  const countries: WorldCountryState[] = worldCountryConfigs.map((config) =>
    createWorldCountryState(config),
  );

  return {
    countries,
    rankings: {
      nominalGDP: {},
      nominalGDPPerCapita: {},
      technology: {},
      education: {},
      lifeExpectancy: {},
      happiness: {},
      influence: {},
    },
    globalDemandIndex: 1,
    foreignImportDemandIndex: 1,
    foreignImportPool: 0,
    lastForeignNominalGDP: {},
    worldPriceLevel: 1,
    tradeNetwork: createEmptyWorldTradeNetworkState(),
  };
}
