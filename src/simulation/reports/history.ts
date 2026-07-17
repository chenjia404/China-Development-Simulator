import { clamp, safeDivide } from "../core/math";
import { isEndOfYear } from "../core/time";
import type { GameState } from "../state/game-state";
import type { AnnualSnapshot, MonthlySnapshot } from "../state/history-state";

const MAX_MONTHLY_HISTORY = 120;

function calculateScore(state: GameState): number {
  const nation = state.nation;
  const incomeScore = clamp(
    Math.log1p(nation.economy.realGDPPerCapita) / Math.log(60_001),
    0,
    1,
  ) * 100;
  const scaleScore = clamp(
    Math.log1p(nation.economy.realGDP) / Math.log(30_000_000_000_001),
    0,
    1,
  ) * 100;
  const distributionScore =
    (1 - clamp((nation.society.giniCoefficient - 0.2) / 0.5, 0, 1)) * 100;
  const fiscalScore =
    (1 - clamp(nation.fiscal.debtToGDP / 1.5, 0, 1)) * 100;

  return clamp(
    incomeScore * 0.2 +
      scaleScore * 0.1 +
      incomeScore * 0.1 +
      nation.technology.index * 0.1 +
      nation.education.index * 0.1 +
      nation.health.lifeExpectancy * 0.1 +
      nation.society.happinessIndex * 0.1 +
      (1 - nation.society.povertyRate) * 100 * 0.05 +
      distributionScore * 0.05 +
      fiscalScore * 0.05 +
      nation.internationalInfluence * 0.05,
    0,
    100,
  );
}

export function recordHistory(state: GameState): void {
  const { nation } = state;
  const monthly: MonthlySnapshot = {
    year: nation.date.year,
    month: nation.date.month,
    population: nation.population.total,
    realGDP: nation.economy.realGDP,
    nominalGDP: nation.economy.nominalGDP,
    inflationRate: nation.economy.inflationRate,
    unemploymentRate: nation.labor.unemploymentRate,
  };
  nation.history.monthly.push(monthly);
  if (nation.history.monthly.length > MAX_MONTHLY_HISTORY) {
    nation.history.monthly.splice(
      0,
      nation.history.monthly.length - MAX_MONTHLY_HISTORY,
    );
  }

  if (!isEndOfYear(nation.date)) return;
  const previous = nation.history.annual.at(-1);
  const gdpRank = state.world.rankings.nominalGDP.china ??
    state.world.countries.length + 1;
  const annual: AnnualSnapshot = {
    ...monthly,
    realGDPPerCapita: nation.economy.realGDPPerCapita,
    fiscalBalance: nation.fiscal.balance,
    debtToGDP: nation.fiscal.debtToGDP,
    educationIndex: nation.education.index,
    technologyIndex: nation.technology.index,
    lifeExpectancy: nation.health.lifeExpectancy,
    happinessIndex: nation.society.happinessIndex,
    povertyRate: nation.society.povertyRate,
    urbanizationRate: nation.society.urbanizationRate,
    literacyRate: nation.education.literacyRate,
    primarySectorShare: safeDivide(
      nation.sectors.primary.valueAdded,
      nation.economy.realGDP,
    ),
    secondarySectorShare: safeDivide(
      nation.sectors.secondary.valueAdded,
      nation.economy.realGDP,
    ),
    tertiarySectorShare: safeDivide(
      nation.sectors.tertiary.valueAdded,
      nation.economy.realGDP,
    ),
    gdpRank,
    score: calculateScore(state),
  };
  nation.history.annual.push(annual);
  nation.history.reports.push({
    year: nation.date.year,
    realGDPGrowth: previous
      ? safeDivide(annual.realGDP, previous.realGDP, 1) - 1
      : nation.economy.annualRealGDPGrowth,
    populationGrowth: previous
      ? safeDivide(annual.population, previous.population, 1) - 1
      : 0,
    fiscalBalance: nation.fiscal.balance,
    rankingChange: previous ? previous.gdpRank - annual.gdpRank : 0,
    majorEvents: [],
    completedProjects: [],
  });
}
