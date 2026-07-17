import { clamp } from "../core/math";
import type { RandomGenerator } from "../core/random";
import type { GameState } from "../state/game-state";
import { worldCountryConfigs } from "./countries";

function phaseModifier(countryId: string, year: number): number {
  const config = worldCountryConfigs.find((item) => item.id === countryId);
  return config?.phases.find(
    (phase) => year >= phase.startYear && year <= phase.endYear,
  )?.growthModifier ?? 0;
}

export function simulateWorldCountries(
  state: GameState,
  random: RandomGenerator,
): void {
  const year = state.nation.date.year;
  const frontierTechnology = Math.max(
    85,
    ...state.world.countries.map((country) => country.technologyIndex),
  );

  for (const country of state.world.countries) {
    const config = worldCountryConfigs.find((item) => item.id === country.id);
    if (!config) continue;
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
      config.populationGrowth -
        country.educationIndex / 100 * 0.008 +
        random.nextNormal(0, 0.001),
      -0.015,
      0.035,
    );
    country.realGDP *= (1 + annualGrowth) ** (1 / 12);
    country.population *= (1 + populationGrowth) ** (1 / 12);
    country.priceLevelIndex *= 1.02 ** (1 / 12);
    country.nominalGDP = country.realGDP * country.priceLevelIndex;

    const technologyGain =
      (0.15 + technologyGap * absorptionCapacity * 1.8) / 12;
    country.technologyIndex = clamp(
      country.technologyIndex + technologyGain,
      0,
      100,
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

  const averageGrowth = state.world.countries.reduce(
    (total, country) => total + country.baseGrowthPotential,
    0,
  ) / Math.max(state.world.countries.length, 1);
  state.world.globalDemandIndex *= (1 + averageGrowth) ** (1 / 12);
  state.world.worldPriceLevel *= 1.02 ** (1 / 12);
}
