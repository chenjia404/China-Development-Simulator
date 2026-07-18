export interface MonthlySnapshot {
  year: number;
  month: number;
  population: number;
  realGDP: number;
  nominalGDP: number;
  inflationRate: number;
  consumerPriceIndex: number;
  producerPriceIndex: number;
  realWageIndex: number;
  aggregateInventoryMonths: number;
  outputGap: number;
  averageHouseholdSize: number;
  totalDependencyRatio: number;
  monthlyRuralToUrbanMigration: number;
  stateControlledEnterpriseShare: number;
  privateAndMixedEnterpriseShare: number;
  foreignInvestedEnterpriseShare: number;
  enterpriseProductivityIndex: number;
  centralRevenueShare: number;
  centralToLocalTransfers: number;
  socialProtectionReserve: number;
  broadMoney: number;
  totalBankLoans: number;
  nonPerformingLoanRatio: number;
  currentAccountBalance: number;
  officialExchangeRate: number;
  cultivatedLandHectares: number;
  grainYieldKgPerHectare: number;
  strategicFoodReserve: number;
  foodSelfSufficiencyRate: number;
  dailyCaloriesPerCapita: number;
  energyImportDependence: number;
  logisticsEfficiencyIndex: number;
  carbonEmissions: number;
  airPollutionIndex: number;
  higherEducationEnrollmentRate: number;
  advancedSkillShare: number;
  skillMismatchRate: number;
  healthyLifeExpectancy: number;
  healthRelatedLaborLoss: number;
  urbanHousingUnits: number;
  housingShortageUnits: number;
  homePriceIndex: number;
  priceToIncomeRatio: number;
  urbanServiceCoverage: number;
  regionalGDPPerCapitaRatio: number;
  coastalGDPShare: number;
  westernDevelopmentIndex: number;
  unemploymentRate: number;
  foreignExchangeReserves: number;
  remittanceInflows: number;
  externalDebt: number;
  externalDebtToGDP: number;
  annualExternalDebtService: number;
  capitalGoodsImportCoverage: number;
}

export interface AnnualSnapshot extends MonthlySnapshot {
  realGDPPerCapita: number;
  currentPriceGDPPerCapita: number;
  currentUSDGDPPerCapita: number;
  gdpPerCapitaRank: number;
  gdpPerCapitaRankParticipants: number;
  fiscalBalance: number;
  debtToGDP: number;
  educationIndex: number;
  technologyIndex: number;
  completedTechnologyCount: number;
  industryTechnologyTier: number;
  industrialUpgradeReadiness: number;
  lifeExpectancy: number;
  happinessIndex: number;
  povertyRate: number;
  urbanizationRate: number;
  literacyRate: number;
  primarySectorShare: number;
  secondarySectorShare: number;
  tertiarySectorShare: number;
  gdpRank: number;
  score: number;
  foreignAidAnnualRMB?: number;
  cumulativeForeignAidRMB?: number;
  cumulativeForeignAidUSD?: number;
  sinoUSNormalizationStatus?: "not_started" | "negotiating" | "established";
  sinoUSNormalizationYear?: number | null;
  sinoUSNormalizationDelayMonths?: number;
  productionGDP?: number;
  incomeGDP?: number;
  expenditureGDP?: number;
  nationalAccountsIdentityError?: number;
  inputOutputAvailability?: number;
}

export interface AnnualReport {
  year: number;
  realGDPGrowth: number;
  populationGrowth: number;
  fiscalBalance: number;
  rankingChange: number;
  majorEvents: string[];
  completedProjects: string[];
}

export interface HistoricalEventRecord {
  id: string;
  name: string;
  year: number;
  month: number;
  scheduledYear: number;
  scheduledMonth: number;
  category: string;
  impact: "positive" | "negative" | "mixed";
  description: string;
  effects: string[];
  durationMonths: number;
  choiceId: string;
  choiceName: string;
  choiceDescription: string;
  outcome: "occurred" | "prevented" | "enacted_early" | "enacted_late";
}

export interface NationHistory {
  monthly: MonthlySnapshot[];
  annual: AnnualSnapshot[];
  reports: AnnualReport[];
  historicalEvents: HistoricalEventRecord[];
}
