import { clamp, safeDivide } from "../core/math";
import { isEndOfYear } from "../core/time";
import type { GameState } from "../state/game-state";
import type { AnnualSnapshot, MonthlySnapshot } from "../state/history-state";
import { eventName } from "../events/event-engine";
import { calculateTechnologyTreeMetrics } from "../technology/technology-tree";
import { technologyNormalizedEffect } from "../technology/technology-growth";
import { ensureAchievementsState } from "../events/national-achievements";

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
  const priceStabilityScore =
    (1 - clamp(Math.abs(nation.economy.inflationRate - 0.02) / 0.18, 0, 1)) * 100;

  return clamp(
    incomeScore * 0.2 +
      scaleScore * 0.1 +
      priceStabilityScore * 0.1 +
      technologyNormalizedEffect(nation.technology.index) * 100 * 0.1 +
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
  ensureAchievementsState(nation);
  const monthly: MonthlySnapshot = {
    year: nation.date.year,
    month: nation.date.month,
    population: nation.population.total,
    realGDP: nation.economy.realGDP,
    nominalGDP: nation.economy.nominalGDP,
    inflationRate: nation.economy.inflationRate,
    consumerPriceIndex: nation.marketDynamics.consumerPriceIndex,
    producerPriceIndex: nation.marketDynamics.producerPriceIndex,
    realWageIndex: nation.marketDynamics.realWageIndex,
    aggregateInventoryMonths: nation.marketDynamics.aggregateInventoryMonths,
    outputGap: nation.marketDynamics.outputGap,
    averageHouseholdSize:
      nation.population.demographicDetail.households.averageHouseholdSize,
    totalDependencyRatio:
      nation.population.demographicDetail.households.totalDependencyRatio,
    monthlyRuralToUrbanMigration:
      nation.population.demographicDetail.migration.monthlyRuralToUrban,
    stateControlledEnterpriseShare: nation.enterprises.stateControlledShare,
    privateAndMixedEnterpriseShare: nation.enterprises.privateAndMixedShare,
    foreignInvestedEnterpriseShare: nation.enterprises.foreignInvestedShare,
    enterpriseProductivityIndex: nation.enterprises.aggregateProductivityIndex,
    centralRevenueShare: nation.fiscal.federalism.centralRevenueShare,
    centralToLocalTransfers: nation.fiscal.federalism.centralToLocalTransfers,
    socialProtectionReserve: nation.fiscal.federalism.socialProtection.reserve,
    broadMoney: nation.financialSystem.monetary.broadMoney,
    totalBankLoans: nation.financialSystem.banking.totalLoans,
    nonPerformingLoanRatio:
      nation.financialSystem.banking.nonPerformingLoanRatio,
    currentAccountBalance:
      nation.financialSystem.balanceOfPayments.currentAccountBalance,
    officialExchangeRate: nation.financialSystem.officialExchangeRate,
    cultivatedLandHectares:
      nation.resources.agriculture.cultivatedLandHectares,
    grainYieldKgPerHectare:
      nation.resources.agriculture.grainYieldKgPerHectare,
    strategicFoodReserve:
      nation.resources.agriculture.strategicReserveStock,
    foodSelfSufficiencyRate:
      nation.resources.agriculture.selfSufficiencyRate,
    dailyCaloriesPerCapita:
      nation.resources.agriculture.dailyCaloriesPerCapita,
    energyImportDependence:
      nation.resources.infrastructureResources.energyImportDependence,
    logisticsEfficiencyIndex:
      nation.resources.infrastructureResources.logisticsEfficiencyIndex,
    carbonEmissions:
      nation.resources.infrastructureResources.carbonEmissions,
    airPollutionIndex:
      nation.resources.infrastructureResources.airPollutionIndex,
    higherEducationEnrollmentRate:
      nation.humanDevelopment.educationStages.higher.enrollmentRate,
    advancedSkillShare:
      (nation.humanDevelopment.laborSkills.advanced.laborForce +
        nation.humanDevelopment.laborSkills.research.laborForce) /
      Math.max(nation.labor.laborForce, 1),
    skillMismatchRate: nation.humanDevelopment.skillMismatchRate,
    healthyLifeExpectancy: nation.humanDevelopment.healthyLifeExpectancy,
    healthRelatedLaborLoss: nation.humanDevelopment.healthRelatedLaborLoss,
    urbanHousingUnits: nation.society.urbanHousing.urbanHousingUnits,
    housingShortageUnits: nation.society.urbanHousing.housingShortageUnits,
    homePriceIndex: nation.society.urbanHousing.homePriceIndex,
    priceToIncomeRatio: nation.society.urbanHousing.priceToIncomeRatio,
    urbanServiceCoverage: nation.society.urbanHousing.urbanServiceCoverage,
    regionalGDPPerCapitaRatio:
      nation.regionalEconomy.regionalGDPPerCapitaRatio,
    coastalGDPShare: nation.regionalEconomy.coastalGDPShare,
    westernDevelopmentIndex:
      nation.regionalEconomy.westernDevelopmentIndex,
    exportConcentrationIndex: state.world.tradeNetwork.exportConcentrationIndex,
    tradeSanctionExposure: state.world.tradeNetwork.sanctionExposure,
    renminbiSettlementShare: state.world.tradeNetwork.renminbiSettlementShare,
    defenseCapitalStock: nation.securityDefense.defenseCapitalStock,
    defenseReadinessIndex: nation.securityDefense.readinessIndex,
    activeConflictIntensity: nation.securityDefense.conflictIntensity,
    cumulativeConflictCasualties:
      nation.securityDefense.cumulativeConflictCasualties,
    stateCapacity: nation.institutions.stateCapacity,
    effectivePolicyExecutionRate:
      nation.institutions.effectivePolicyExecutionRate,
    highestEndogenousRiskPressure:
      nation.institutions.highestRiskPressure,
    activeEndogenousRiskCount: nation.institutions.activeRiskIds.length,
    unemploymentRate: nation.labor.unemploymentRate,
    foreignExchangeReserves: nation.trade.foreignExchangeReserves,
    remittanceInflows: nation.trade.remittanceInflows,
    externalDebt: nation.trade.externalDebt,
    externalDebtToGDP: nation.trade.externalDebtToGDP,
    annualExternalDebtService: nation.trade.annualExternalDebtService,
    capitalGoodsImportCoverage: nation.trade.capitalGoodsImportCoverage,
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
  const technologyTree = calculateTechnologyTreeMetrics(nation);
  const gdpRank = state.world.rankings.nominalGDP.china ??
    state.world.countries.length + 1;
  const annual: AnnualSnapshot = {
    ...monthly,
    realGDPPerCapita: nation.economy.realGDPPerCapita,
    currentPriceGDPPerCapita: nation.economy.currentPriceGDPPerCapita,
    currentUSDGDPPerCapita: nation.economy.currentUSDGDPPerCapita,
    gdpPerCapitaRank: nation.economy.globalGDPPerCapitaRank,
    gdpPerCapitaRankParticipants:
      nation.economy.globalGDPPerCapitaParticipants,
    fiscalBalance: nation.fiscal.balance,
    debtToGDP: nation.fiscal.debtToGDP,
    educationIndex: nation.education.index,
    technologyIndex: nation.technology.index,
    completedTechnologyCount: technologyTree.completedCount,
    industryTechnologyTier: technologyTree.industryTier,
    industrialUpgradeReadiness: technologyTree.industrialUpgradeReadiness,
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
    foreignAidAnnualRMB: nation.diplomacy.annualForeignAidRMB,
    cumulativeForeignAidRMB: nation.diplomacy.cumulativeForeignAidRMB,
    cumulativeForeignAidUSD: nation.diplomacy.cumulativeForeignAidUSD,
    sinoUSNormalizationStatus: nation.diplomacy.sinoUSNormalizationStatus,
    sinoUSNormalizationYear:
      nation.diplomacy.sinoUSNormalizationEstablishedYear,
    sinoUSNormalizationDelayMonths:
      nation.diplomacy.sinoUSNormalizationDelayMonths,
    productionGDP: nation.nationalAccounts.productionGDP,
    incomeGDP: nation.nationalAccounts.incomeGDP,
    expenditureGDP: nation.nationalAccounts.expenditureGDP,
    nationalAccountsIdentityError: nation.nationalAccounts.gdpIdentityError,
    inputOutputAvailability: nation.nationalAccounts.aggregateInputAvailability,
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
    majorEvents: [...new Set([
      ...nation.history.historicalEvents
        .filter((event) => event.year === nation.date.year)
        .map((event) => {
          if (event.outcome === "prevented") return `避免：${event.name}`;
          if (event.outcome === "enacted_early") return `提前实施：${event.name}`;
          if (event.outcome === "enacted_late") return `延后实施：${event.name}`;
          return event.name;
        }),
      ...nation.achievements.unlocked
        .filter((achievement) => achievement.year === nation.date.year)
        .map((achievement) => `成就解锁：${achievement.name}`),
      ...nation.modifiers
        .filter(
          (modifier) => !nation.history.historicalEvents.some(
            (event) => event.id === modifier.sourceId,
          ),
        )
        .map((modifier) => eventName(modifier.sourceId)),
    ])],
    completedProjects: [],
  });
}
