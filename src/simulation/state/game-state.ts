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
  currentPriceGDPPerCapita: number;
  currentUSDGDPPerCapita: number;
  globalGDPPerCapitaRank: number;
  globalGDPPerCapitaParticipants: number;
  internationalComparableGDP: number;
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
  householdDisposableIncome: number;
  householdConsumption: number;
  consumptionPropensity: number;
  socialProtectionIncome: number;
  domesticDemand: number;
  domesticDemandShare: number;
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

export type IndustrialCategoryId =
  | "mining_energy"
  | "basic_materials"
  | "consumer_goods"
  | "construction"
  | "general_machinery"
  | "transport_equipment"
  | "chemicals_pharmaceuticals"
  | "electrical_equipment"
  | "electronics_communications"
  | "precision_medical"
  | "aerospace_advanced";

export interface IndustrialCategoryState {
  id: IndustrialCategoryId;
  output: number;
  valueAdded: number;
  outputShare: number;
  exportValue: number;
  technologyReadiness: number;
  productivityIndex: number;
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
  /** 高等教育正常招生与培养能力，1 表示制度完整运行。 */
  higherEducationAdmissionCapacity: number;
  /** 学校、研究机构和专业评价体系的连续性。 */
  academicContinuity: number;
  /** 因长期停招形成、需要跨代修复的科研人才培养缺口。 */
  researchCohortGap: number;
  /** 招生或学术体系严重中断的累计月数。 */
  educationDisruptionMonths: number;
  /** 迫害、死亡或永久离开科研岗位造成的累计人才存量损失。 */
  permanentResearchTalentLosses: number;
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
  /** 已完成的科技树节点；顺序即完成顺序，保证存档与回放确定。 */
  completedTechnologyIds: string[];
  activeResearchId: string | null;
  activeResearchProgress: number;
  developmentPathId:
    | "balanced_foundation"
    | "light_industry_exports"
    | "heavy_equipment"
    | "electronics_information"
    | "chemicals_health"
    | "green_electrification"
    | "aerospace_advanced";
  previousDevelopmentPathId: TechnologyState["developmentPathId"] | null;
  developmentPathProgress: number;
  lastDevelopmentPathChangeMonth: number | null;
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
  foreignExchangeReserves: number;
  monthlyReserveChange: number;
  remittanceInflows: number;
  remittanceReserveContribution: number;
  importCoverageMonths: number;
  /** 全口径外债存量，采用美元等值口径。 */
  externalDebt: number;
  externalDebtToGDP: number;
  externalDebtInterestRate: number;
  annualExternalDebtService: number;
  externalDebtServiceRatio: number;
  monthlyExternalBorrowing: number;
  /** 资本品进口的年度化外汇需求及实际满足程度。 */
  capitalGoodsForeignExchangeNeed: number;
  capitalGoodsImportShare: number;
  capitalGoodsImportCoverage: number;
}

/**
 * 民营与混合所有制经济的路径依赖能力。
 *
 * 四项均为 0—1 的库存，不代表民营经济占 GDP 的统计份额。历史事件和改革
 * 改变的是每月形成或损失的流量，已经保存下来的企业家经验、技术转化能力和
 * 客户网络不会因临时修正到期而自动复原。
 */
export interface PrivateEconomyState {
  operatingSpace: number;
  entrepreneurialCapacity: number;
  technologyCommercialization: number;
  exportNetworkStrength: number;
}

export interface DiplomacyState {
  diplomaticPoints: number;
  monthlyPointGain: number;
  globalReputation: number;
  securityIndex: number;
  organizationIds: string[];
  strategyId: "pro_soviet" | "balanced" | "pro_western";
  strategyAlignment: number;
  lastStrategyChangeMonth: number | null;
  foreignPolicyDoctrineId:
    | "status_quo"
    | "revolutionary_internationalism"
    | "peaceful_coexistence"
    | "non_aligned_autonomy"
    | "economic_diplomacy"
    | "multilateral_institutionalism"
    | "regional_good_neighborhood";
  previousForeignPolicyDoctrineId: DiplomacyState["foreignPolicyDoctrineId"] | null;
  foreignPolicyDoctrineProgress: number;
  lastForeignPolicyDoctrineChangeMonth: number | null;
}

export interface ModifierState {
  id: string;
  sourceId: string;
  target: string;
  operation: "add" | "multiply" | "override";
  value: number;
  /** 生效前等待月数；旧存档缺失时按 0 处理。 */
  delayMonths?: number;
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
  /** 第二产业细分结构；各类别之和与第二产业总量保持一致。 */
  industries: Record<IndustrialCategoryId, IndustrialCategoryState>;
  fiscal: FiscalState;
  education: EducationState;
  health: HealthState;
  technology: TechnologyState;
  resources: ResourceState;
  society: SocietyState;
  trade: TradeState;
  privateEconomy: PrivateEconomyState;
  diplomacy: DiplomacyState;
  policies: string[];
  policyProgress: Record<string, number>;
  projects: ProjectState[];
  modifiers: ModifierState[];
  historicalEventDecisionMode: "automatic" | "interactive";
  pendingHistoricalEventId: string | null;
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
