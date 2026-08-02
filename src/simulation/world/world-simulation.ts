import { clamp } from "../core/math";
import type { RandomGenerator } from "../core/random";
import { Mulberry32 } from "../core/random";
import type { GameState } from "../state/game-state";
import { technologyDiminishingFactor } from "../technology/technology-growth";
import {
  type WorldCountryConfig,
  worldCountryConfigs,
} from "./countries";
import { applyWorldCountryCalibration } from "./world-calibration";
import { updateForeignMarketIndices } from "./foreign-market-demand";

/**
 * 加入阿尔巴尼亚之前冻结的世界国家共享随机流顺序。
 * 此后新增国家不得写入本列表，否则会改变既有国家与中国的随机消耗。
 */
export const legacySharedWorldCountryIds = [
  "usa",
  "japan",
  "south_korea",
  "north_korea",
  "germany",
  "france",
  "united_kingdom",
  "russia",
  "india",
  "brazil",
  "singapore",
  "canada",
  "australia",
  "italy",
  "spain",
  "mexico",
  "indonesia",
  "turkey",
  "saudi_arabia",
  "iran",
  "south_africa",
  "argentina",
  "netherlands",
  "switzerland",
  "sweden",
  "norway",
  "poland",
  "egypt",
  "nigeria",
  "pakistan",
  "vietnam",
] as const;

function phaseModifier(countryId: string, year: number): number {
  const config = worldCountryConfigs.find((item) => item.id === countryId);
  return config?.phases.find(
    (phase) => year >= phase.startYear && year <= phase.endYear,
  )?.growthModifier ?? 0;
}

function populationGrowthBase(
  config: WorldCountryConfig,
  year: number,
): number {
  const phases = config.populationPhases;
  if (phases && phases.length > 0) {
    const phase = phases.find(
      (item) => year >= item.startYear && year <= item.endYear,
    );
    if (phase) return phase.populationGrowth;
  }
  return config.populationGrowth;
}

/** 由游戏种子、国家 ID 与年月派生，供后加入的世界国家使用。 */
export function countryMonthRandomSeed(
  gameSeed: number,
  countryId: string,
  year: number,
  month: number,
): number {
  let hash = (gameSeed >>> 0) ^ 0x9e3779b9;
  hash = Math.imul(hash ^ Math.imul(year, 0x85ebca6b), 0xc2b2ae35) >>> 0;
  hash = Math.imul(hash ^ Math.imul(month, 0x27d4eb2d), 0x165667b1) >>> 0;
  for (let index = 0; index < countryId.length; index += 1) {
    hash = Math.imul(hash ^ countryId.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function simulateOneCountry(
  state: GameState,
  countryId: string,
  random: RandomGenerator,
  frontierTechnology: number,
): void {
  const country = state.world.countries.find((item) => item.id === countryId);
  const config = worldCountryConfigs.find((item) => item.id === countryId);
  if (!country || !config) return;
  const year = state.nation.date.year;
  const technologyGap = clamp(
    (frontierTechnology - country.technologyIndex) / 100,
    0,
    1,
  );
  const absorptionCapacity =
    country.educationIndex / 100 *
    (country.developmentStage === "低收入" ? 0.65 : 1);
  const catchUpGrowth = technologyGap * absorptionCapacity * 0.035;
  const matureSlowdown =
    country.developmentStage === "高收入" ? 0.009 : 0;
  const annualGrowth = clamp(
    country.baseGrowthPotential +
      phaseModifier(country.id, year) +
      catchUpGrowth -
      matureSlowdown +
      random.nextNormal(0, 0.004),
    -0.12,
    0.14,
  );
  const populationGrowth = clamp(
    populationGrowthBase(config, year) -
      country.educationIndex / 100 * 0.008 +
      random.nextNormal(0, 0.001),
    -0.02,
    0.035,
  );
  country.realGDP *= (1 + annualGrowth) ** (1 / 12);
  country.realGDP = applyWorldCountryCalibration(
    country.id,
    year,
    country.realGDP,
  );
  country.population *= (1 + populationGrowth) ** (1 / 12);
  country.priceLevelIndex *= 1.02 ** (1 / 12);
  country.nominalGDP = country.realGDP * country.priceLevelIndex;

  const technologyGain =
    (0.15 + technologyGap * absorptionCapacity * 1.8) / 12 *
    technologyDiminishingFactor(country.technologyIndex);
  country.technologyIndex = Math.max(
    0,
    country.technologyIndex + technologyGain,
  );
  country.educationIndex = clamp(
    country.educationIndex +
      (0.12 + country.baseGrowthPotential * 2) / 12 *
        (1 - country.educationIndex / 100),
    0,
    100,
  );
  country.lifeExpectancy = clamp(
    country.lifeExpectancy +
      (0.1 + country.educationIndex / 500) / 12 *
        (1 - country.lifeExpectancy / 100),
    20,
    100,
  );
  const prosperity = clamp(
    Math.log1p(country.realGDP / country.population) / Math.log(60_001),
    0,
    1,
  );
  country.happinessIndex = clamp(
    country.happinessIndex +
      (prosperity * 75 + country.lifeExpectancy * 0.25 -
        country.happinessIndex) *
        0.002,
    0,
    100,
  );
}

export function simulateWorldCountries(
  state: GameState,
  random: RandomGenerator,
): void {
  const year = state.nation.date.year;
  const month = state.nation.date.month;
  const frontierTechnology = Math.max(
    85,
    state.nation.technology.index,
    ...state.world.countries.map((country) => country.technologyIndex),
  );
  const presentIds = new Set(state.world.countries.map((country) => country.id));

  for (const countryId of legacySharedWorldCountryIds) {
    if (!presentIds.has(countryId)) continue;
    simulateOneCountry(state, countryId, random, frontierTechnology);
  }

  for (const country of state.world.countries) {
    if (
      (legacySharedWorldCountryIds as readonly string[]).includes(country.id)
    ) {
      continue;
    }
    const isolated = new Mulberry32(
      countryMonthRandomSeed(state.seed, country.id, year, month),
    );
    simulateOneCountry(state, country.id, isolated, frontierTechnology);
  }

  updateForeignMarketIndices(state);
  state.world.worldPriceLevel *= 1.02 ** (1 / 12);
}
