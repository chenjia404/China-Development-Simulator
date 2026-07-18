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
  /** 已包含在财政总支出中的年度化对外援助支出。 */
  foreignAidExpenditure: number;
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

export type NationalAccountsProductId =
  | "agriculture"
  | IndustrialCategoryId
  | "market_services"
  | "public_services";

/** 单类产品的年度化供给使用账户；所有金额均使用模拟内部实际价值口径。 */
export interface NationalAccountsProductState {
  id: NationalAccountsProductId;
  grossOutput: number;
  domesticSupply: number;
  imports: number;
  exports: number;
  intermediateDemand: number;
  householdConsumption: number;
  capitalFormation: number;
  governmentConsumption: number;
  inventoryChange: number;
  valueAdded: number;
  inputSupplyCoverage: number;
  inputAvailability: number;
  supplyUseGap: number;
}

/** 生产法、收入法和支出法相互调和的国民经济账户。 */
export interface NationalAccountsState {
  products: Record<NationalAccountsProductId, NationalAccountsProductState>;
  productionGDP: number;
  incomeGDP: number;
  expenditureGDP: number;
  compensationOfEmployees: number;
  consumptionOfFixedCapital: number;
  taxesLessSubsidies: number;
  operatingSurplus: number;
  householdConsumption: number;
  governmentConsumption: number;
  grossCapitalFormation: number;
  inventoryChange: number;
  exports: number;
  imports: number;
  statisticalDiscrepancyBeforeReconciliation: number;
  expenditureReconciliationFactor: number;
  gdpIdentityError: number;
  maximumProductBalanceError: number;
  aggregateInputAvailability: number;
}

/** 单类产品的价格与库存状态；价格指数以开局月为 1，库存使用实际价值口径。 */
export interface ProductMarketState {
  id: NationalAccountsProductId;
  priceIndex: number;
  annualPriceInflation: number;
  inventoryStock: number;
  targetInventoryStock: number;
  inventoryMonths: number;
  inventoryGapRatio: number;
  demandPressure: number;
  inputCostPressure: number;
}

/** 部门价格、工资与库存共同形成的月度经济周期状态。 */
export interface MarketDynamicsState {
  products: Record<NationalAccountsProductId, ProductMarketState>;
  consumerPriceIndex: number;
  producerPriceIndex: number;
  gdpDeflator: number;
  nominalWageIndex: number;
  realWageIndex: number;
  annualNominalWageGrowth: number;
  annualRealWageGrowth: number;
  aggregateNominalWage: number;
  laborIncomeShare: number;
  outputGap: number;
  aggregateInventoryMonths: number;
  inventoryCycleIndex: number;
  aggregateDemandPressure: number;
  aggregateCostPressure: number;
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
  foreignAidProgramId:
    | "suspended"
    | "limited_humanitarian"
    | "socialist_solidarity"
    | "south_south_development"
    | "historical_comprehensive"
    | "economic_technical_cooperation"
    | "expanded_internationalist";
  previousForeignAidProgramId: DiplomacyState["foreignAidProgramId"] | null;
  foreignAidProgramProgress: number;
  lastForeignAidProgramChangeMonth: number | null;
  /** 当前年度援外承诺，按当年价人民币和官方汇率美元等值记录。 */
  annualForeignAidRMB: number;
  annualForeignAidUSD: number;
  annualForeignAidForeignExchangeOutflow: number;
  cumulativeForeignAidRMB: number;
  cumulativeForeignAidUSD: number;
  cumulativeForeignAidRMBThrough1980: number;
  cumulativeForeignAidUSDThrough1980: number;
  /** 中美建交是可提前启动、也可延迟完成的一次性外交进程。 */
  sinoUSNormalizationStatus: "not_started" | "negotiating" | "established";
  sinoUSNormalizationStartedYear: number | null;
  sinoUSNormalizationStartedMonth: number | null;
  sinoUSNormalizationEstablishedYear: number | null;
  sinoUSNormalizationEstablishedMonth: number | null;
  sinoUSNormalizationNegotiationProgress: number;
  sinoUSNormalizationNegotiationMonths: number;
  sinoUSCooperationProgress: number;
  /** 相对1979年1月史实节点推迟的月数；提前完成时为0。 */
  sinoUSNormalizationDelayMonths: number;
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
  nationalAccounts: NationalAccountsState;
  marketDynamics: MarketDynamicsState;
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
