import { clamp, safeDivide } from "../core/math";
import type { GameState } from "../state/game-state";
import { calculateWorldComparableGDP } from "../economy/historical-accounting";

export function calculateRank<T extends { id: string }>(
  countries: T[],
  getValue: (country: T) => number,
): Record<string, number> {
  return Object.fromEntries(
    [...countries]
      .sort((first, second) => {
        const difference = getValue(second) - getValue(first);
        return difference === 0
          ? first.id.localeCompare(second.id)
          : difference;
      })
      .map((country, index) => [country.id, index + 1]),
  );
}

interface RankingCountry {
  id: string;
  nominalGDP: number;
  nominalGDPPerCapita: number;
  technology: number;
  education: number;
  lifeExpectancy: number;
  happiness: number;
  influence: number;
}

export function calculateWorldRankings(state: GameState): void {
  const chinaComparableGDP = calculateWorldComparableGDP(
    state.nation.economy.realGDP,
    state.world.worldPriceLevel,
    state.nation.date.year,
  );
  state.nation.economy.internationalComparableGDP = chinaComparableGDP;
  const foreignCountries: RankingCountry[] = state.world.countries.map((country) => ({
    id: country.id,
    nominalGDP: country.nominalGDP,
    nominalGDPPerCapita: safeDivide(country.nominalGDP, country.population),
    technology: country.technologyIndex,
    education: country.educationIndex,
    lifeExpectancy: country.lifeExpectancy,
    happiness: country.happinessIndex,
    influence: country.internationalInfluence,
  }));
  const worldNominalGDP = foreignCountries.reduce(
    (sum, country) => sum + country.nominalGDP,
    chinaComparableGDP,
  );
  state.nation.internationalInfluence = clamp(
    state.nation.internationalInfluence * 0.85 +
      safeDivide(chinaComparableGDP, worldNominalGDP) * 500 +
      state.nation.technology.index * 0.08 +
      state.nation.diplomacy.globalReputation * 0.02 +
      state.nation.diplomacy.securityIndex * 0.01 +
      state.nation.diplomacy.organizationIds.length * 0.75,
    0,
    100,
  );
  const countries: RankingCountry[] = [
    ...foreignCountries,
    {
      id: state.nation.id,
      nominalGDP: chinaComparableGDP,
      nominalGDPPerCapita: safeDivide(
        chinaComparableGDP,
        state.nation.population.total,
      ),
      technology: state.nation.technology.index,
      education: state.nation.education.index,
      lifeExpectancy: state.nation.health.lifeExpectancy,
      happiness: state.nation.society.happinessIndex,
      influence: state.nation.internationalInfluence,
    },
  ];

  state.world.rankings = {
    nominalGDP: calculateRank(countries, (country) => country.nominalGDP),
    nominalGDPPerCapita: calculateRank(
      countries,
      (country) => country.nominalGDPPerCapita,
    ),
    technology: calculateRank(countries, (country) => country.technology),
    education: calculateRank(countries, (country) => country.education),
    lifeExpectancy: calculateRank(
      countries,
      (country) => country.lifeExpectancy,
    ),
    happiness: calculateRank(countries, (country) => country.happiness),
    influence: calculateRank(countries, (country) => country.influence),
  };
}
