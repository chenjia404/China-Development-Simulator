export interface MonthlySnapshot {
  year: number;
  month: number;
  population: number;
  realGDP: number;
  nominalGDP: number;
  inflationRate: number;
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
  outcome: "occurred" | "prevented" | "enacted_early";
}

export interface NationHistory {
  monthly: MonthlySnapshot[];
  annual: AnnualSnapshot[];
  reports: AnnualReport[];
  historicalEvents: HistoricalEventRecord[];
}
