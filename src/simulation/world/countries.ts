import countryData from "../../data/config/world-countries.json";
import diplomacyConfig from "../../data/config/diplomacy.json";
import type { DevelopmentStage, WorldCountryState, WorldState } from "../state/world-state";

export interface CountryGrowthPhase {
  startYear: number;
  endYear: number;
  growthModifier: number;
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
  phases: CountryGrowthPhase[];
}

export const worldCountryConfigs = countryData as WorldCountryConfig[];

export function createInitialWorldState(): WorldState {
  const countries: WorldCountryState[] = worldCountryConfigs.map((config) => ({
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
    relationWithChina:
      diplomacyConfig.initialRelations[
        config.id as keyof typeof diplomacyConfig.initialRelations
      ] ?? 0,
    diplomaticStatus: "neutral",
    tradeAgreement: false,
    sanctionLevel: 0,
    lastDiplomaticActionMonth: null,
    modifiers: [],
  }));

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
    worldPriceLevel: 1,
  };
}
