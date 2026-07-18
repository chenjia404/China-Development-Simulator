import type { NationHistory } from "./history-state";
import type { WorldState } from "./world-state";

export interface GameDate {
  year: number;
  month: number;
  elapsedMonths: number;
}

export interface AgeGroupState {
  children: number;
  workingAge: number;
  elderly: number;
}

export interface PopulationState {
  total: number;
  ageGroups: AgeGroupState;
  urbanPopulation: number;
  ruralPopulation: number;
  annualBirthRate: number;
  annualDeathRate: number;
  monthlyBirths: number;
  monthlyDeaths: number;
  netMigration: number;
}

export interface LaborState {
  laborForce: number;
  employed: number;
  unemployed: number;
  participationRate: number;
  unemploymentRate: number;
  effectiveLabor: number;
  skillMatchRate: number;
}

export interface EconomyState {
  nominalGDP: number;
  realGDP: number;
  realGDPIndex: number;
  nominalGDPPerCapita: number;
  realGDPPerCapita: number;
  pppGDPPerCapita: number;
  annualRealGDPGrowth: number;
  annualNominalGDPGrowth: number;
  capitalStock: number;
  totalFactorProductivity: number;
  humanCapitalIndex: number;
  infrastructureIndex: number;
  institutionalEfficiency: number;
  inflationRate: number;
  householdIncome: number;
  householdConsumption: number;
  nationalSavings: number;
  investment: number;
  priceLevelIndex: number;
}

export type SectorId = "primary" | "secondary" | "tertiary";

export interface SectorState {
  id: SectorId;
  output: number;
  valueAdded: number;
  capitalStock: number;
  laborForce: number;
  productivity: number;
  capacityUtilization: number;
  averageWage: number;
  employment: number;
  technologyLevel: number;
}

export interface FiscalBudget {
  education: number;
  health: number;
  agriculture: number;
  industry: number;
  infrastructure: number;
  research: number;
  housing: number;
  welfare: number;
  defense: number;
  administration: number;
}

export interface FiscalState {
  revenue: number;
  expenditure: number;
  balance: number;
  governmentDebt: number;
  debtToGDP: number;
  debtInterestRate: number;
  interestExpense: number;
  statutoryTaxRate: number;
  effectiveTaxRate: number;
  monetaryFinancing: number;
  budget: FiscalBudget;
}

export interface EducationState {
  literacyRate: number;
  primaryCoverage: number;
  secondaryCoverage: number;
  universityCoverage: number;
  averageYearsOfSchooling: number;
  index: number;
  researchTalent: number;
  delayedInvestment: number[];
}

export interface HealthState {
  coverageRate: number;
  hospitalCapacity: number;
  doctorsPerThousand: number;
  lifeExpectancy: number;
  index: number;
}

export interface TechnologyState {
  index: number;
  researchPoints: number;
  adoptionRate: number;
  monthlyResearchOutput: number;
}

export interface ResourceState {
  foodProduction: number;
  foodDemand: number;
  foodSupplyRatio: number;
  energySupply: number;
  energyDemand: number;
  energySupplyRatio: number;
}

export interface SocietyState {
  happinessIndex: number;
  stabilityIndex: number;
  povertyRate: number;
  giniCoefficient: number;
  urbanizationRate: number;
  medianDisposableIncome: number;
  housingIndex: number;
}

export interface TradeState {
  exports: number;
  imports: number;
  balance: number;
  openness: number;
  foreignInvestment: number;
}

export interface DiplomacyState {
  diplomaticPoints: number;
  monthlyPointGain: number;
  globalReputation: number;
  securityIndex: number;
  organizationIds: string[];
}

export interface ModifierState {
  id: string;
  sourceId: string;
  target: string;
  operation: "add" | "multiply" | "override";
  value: number;
  remainingMonths: number | null;
  stackRule: "stack" | "replace" | "max" | "min";
}

export interface ProjectState {
  id: string;
  type: string;
  remainingMonths: number;
  totalCost: number;
  progress: number;
}

export interface NationState {
  id: "china";
  name: "中国";
  internationalInfluence: number;
  date: GameDate;
  population: PopulationState;
  labor: LaborState;
  economy: EconomyState;
  sectors: Record<SectorId, SectorState>;
  fiscal: FiscalState;
  education: EducationState;
  health: HealthState;
  technology: TechnologyState;
  resources: ResourceState;
  society: SocietyState;
  trade: TradeState;
  diplomacy: DiplomacyState;
  policies: string[];
  policyProgress: Record<string, number>;
  projects: ProjectState[];
  modifiers: ModifierState[];
  history: NationHistory;
}

export interface GameState {
  schemaVersion: number;
  simulationVersion: string;
  seed: number;
  randomState: number;
  eventRandomState: number;
  nation: NationState;
  world: WorldState;
}
