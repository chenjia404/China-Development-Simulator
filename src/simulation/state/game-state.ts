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

export type AgeBandId =
  | "age_0_4" | "age_5_9" | "age_10_14" | "age_15_19"
  | "age_20_24" | "age_25_29" | "age_30_34" | "age_35_39"
  | "age_40_44" | "age_45_49" | "age_50_54" | "age_55_59"
  | "age_60_64" | "age_65_69" | "age_70_74" | "age_75_79"
  | "age_80_84" | "age_85_plus";

export interface SexPopulationCohort {
  id: AgeBandId;
  male: number;
  female: number;
}

export interface HouseholdDemographyState {
  householdCount: number;
  urbanHouseholds: number;
  ruralHouseholds: number;
  averageHouseholdSize: number;
  childDependencyRatio: number;
  elderlyDependencyRatio: number;
  totalDependencyRatio: number;
}

export interface MigrationAccountState {
  monthlyRuralToUrban: number;
  monthlyUrbanToRural: number;
  cumulativeRuralToUrban: number;
  lastUrbanPopulation: number;
  lastTotalPopulation: number;
}

export interface DemographicDetailState {
  cohorts: Record<AgeBandId, SexPopulationCohort>;
  households: HouseholdDemographyState;
  migration: MigrationAccountState;
  malePopulation: number;
  femalePopulation: number;
  sexRatio: number;
  workingAgeFemalePopulation: number;
  reconciliationError: number;
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
  demographicDetail: DemographicDetailState;
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
  federalism: FiscalFederalismState;
}

export interface GovernmentLevelAccount {
  revenue: number;
  expenditure: number;
  balance: number;
  debt: number;
}

export interface SocialProtectionProgramAccount {
  contributionRevenue: number;
  benefitExpenditure: number;
  balance: number;
  beneficiaries: number;
  averageBenefit: number;
}

export interface FiscalFederalismState {
  central: GovernmentLevelAccount;
  local: GovernmentLevelAccount;
  centralToLocalTransfers: number;
  centralRevenueShare: number;
  centralSpendingShare: number;
  socialProtection: {
    pension: SocialProtectionProgramAccount;
    medical: SocialProtectionProgramAccount;
    unemployment: SocialProtectionProgramAccount;
    minimumLiving: SocialProtectionProgramAccount;
    family: SocialProtectionProgramAccount;
    reserve: number;
    totalContributions: number;
    totalBenefits: number;
  };
  consolidatedRevenueError: number;
  consolidatedExpenditureError: number;
  consolidatedDebtError: number;
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

export type EducationStageId = "primary" | "secondary" | "vocational" | "higher";
export interface EducationStageAccount {
  id: EducationStageId;
  eligiblePopulation: number;
  enrolledStudents: number;
  enrollmentRate: number;
  completionRate: number;
  graduates: number;
}
export type LaborSkillId = "basic" | "skilled" | "advanced" | "research";
export interface LaborSkillAccount {
  id: LaborSkillId;
  laborForce: number;
  employed: number;
  unemploymentRate: number;
  relativeWage: number;
}
/** 学段、技能就业与疾病负担的统一人力发展细账。 */
export interface HumanDevelopmentState {
  educationStages: Record<EducationStageId, EducationStageAccount>;
  laborSkills: Record<LaborSkillId, LaborSkillAccount>;
  skillMismatchRate: number;
  vocationalCapacity: number;
  lifelongLearningRate: number;
  primaryCareCoverage: number;
  preventiveCareCoverage: number;
  hospitalBedsPerThousand: number;
  healthWorkersPerThousand: number;
  communicableDiseaseBurden: number;
  nonCommunicableDiseaseBurden: number;
  injuryBurden: number;
  healthyLifeExpectancy: number;
  outOfPocketHealthShare: number;
  healthRelatedLaborLoss: number;
  educationPopulationError: number;
  laborForceError: number;
  employmentError: number;
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
  agriculture: AgricultureSystemState;
  infrastructureResources: InfrastructureResourceState;
  energySupply: number;
  energyDemand: number;
  energySupplyRatio: number;
}

export type EnergySourceId =
  | "coal" | "oil" | "gas" | "hydro" | "nuclear" | "renewables";

export interface EnergySourceAccount {
  id: EnergySourceId;
  share: number;
  supply: number;
  importShare: number;
  emissionFactor: number;
}

/** 能源结构、运输网络与环境资源压力账户。 */
export interface InfrastructureResourceState {
  energyMix: Record<EnergySourceId, EnergySourceAccount>;
  totalPrimaryEnergy: number;
  electricityGeneration: number;
  gridLossRate: number;
  energyImportDependence: number;
  railNetworkKm: number;
  highwayNetworkKm: number;
  portThroughputTonnes: number;
  freightDemand: number;
  freightCapacity: number;
  freightCapacityUtilization: number;
  logisticsEfficiencyIndex: number;
  carbonEmissions: number;
  carbonIntensity: number;
  annualEmissionChange: number;
  airPollutionIndex: number;
  waterStressIndex: number;
  resourceDepletionIndex: number;
  energyShareError: number;
}

/** 农业生产、粮食库存、农村收入和营养安全的实物账户。 */
export interface AgricultureSystemState {
  cultivatedLandHectares: number;
  irrigatedLandRate: number;
  mechanizationRate: number;
  fertilizerInputKgPerHectare: number;
  grainYieldKgPerHectare: number;
  grossHarvest: number;
  postHarvestLoss: number;
  netDomesticProduction: number;
  foodImports: number;
  foodExports: number;
  strategicReserveStock: number;
  monthlyReserveChange: number;
  reserveCoverageMonths: number;
  availableFoodSupply: number;
  selfSufficiencyRate: number;
  foodSecurityCoverage: number;
  rationCoverageRate: number;
  ruralIncomePerWorker: number;
  dailyCaloriesPerCapita: number;
  nutritionStressIndex: number;
  massBalanceError: number;
}

export interface SocietyState {
  happinessIndex: number;
  stabilityIndex: number;
  povertyRate: number;
  giniCoefficient: number;
  urbanizationRate: number;
  medianDisposableIncome: number;
  housingIndex: number;
  urbanHousing: UrbanHousingState;
}

/** 城镇住房存量、家庭需求、土地转用与公共服务承载账户。 */
export interface UrbanHousingState {
  urbanHousingUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  annualNewCompletions: number;
  monthlyDemolitions: number;
  housingDemandHouseholds: number;
  housingShortageUnits: number;
  vacancyRate: number;
  homePriceIndex: number;
  rentIndex: number;
  priceToIncomeRatio: number;
  rentBurdenRate: number;
  mortgageDebt: number;
  annualLandConversionHectares: number;
  annualLandLeaseRevenue: number;
  informalHousingShare: number;
  urbanServiceCapacity: number;
  urbanServiceCoverage: number;
  housingStockError: number;
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

/** 货币、银行与国际收支账户；境内金额使用当期人民币口径，跨境项目使用美元等值。 */
export interface FinancialSystemState {
  monetary: {
    monetaryBase: number;
    broadMoney: number;
    currencyInCirculation: number;
    deposits: number;
    bankReserves: number;
    requiredReserveRatio: number;
    policyRate: number;
    depositRate: number;
    lendingRate: number;
    annualBroadMoneyGrowth: number;
  };
  banking: {
    totalAssets: number;
    totalLoans: number;
    enterpriseLoans: number;
    householdLoans: number;
    governmentClaims: number;
    bankCapital: number;
    capitalAdequacyRatio: number;
    nonPerformingLoans: number;
    nonPerformingLoanRatio: number;
    loanLossProvisions: number;
    aggregateFinancingAccess: number;
    balanceSheetError: number;
  };
  balanceOfPayments: {
    goodsExports: number;
    goodsImports: number;
    servicesBalance: number;
    primaryIncomeBalance: number;
    secondaryIncomeBalance: number;
    currentAccountBalance: number;
    directInvestmentBalance: number;
    otherInvestmentBalance: number;
    financialAccountBalance: number;
    reserveAssetChange: number;
    errorsAndOmissions: number;
    identityError: number;
  };
  officialExchangeRate: number;
  realEffectiveExchangeRateIndex: number;
  foreignCurrencyLiquidityMonths: number;
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

export type EnterpriseOwnershipId =
  | "state_owned"
  | "collective"
  | "private_domestic"
  | "foreign_invested"
  | "mixed_ownership";

export interface EnterpriseOwnershipAccount {
  id: EnterpriseOwnershipId;
  valueAddedShare: number;
  enterpriseCount: number;
  output: number;
  valueAdded: number;
  employment: number;
  investment: number;
  exports: number;
  averageWage: number;
  operatingSurplus: number;
  productivityIndex: number;
  financingAccess: number;
}

export interface EnterpriseSectorState {
  ownership: Record<EnterpriseOwnershipId, EnterpriseOwnershipAccount>;
  totalEnterpriseCount: number;
  aggregateProductivityIndex: number;
  stateControlledShare: number;
  privateAndMixedShare: number;
  foreignInvestedShare: number;
  monthlyEntryRate: number;
  monthlyExitRate: number;
  valueAddedReconciliationError: number;
  employmentReconciliationError: number;
  investmentReconciliationError: number;
  exportReconciliationError: number;
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

export type EconomicRegionId =
  | "northeast" | "north_coast" | "east_coast"
  | "south_coast" | "central" | "west";
export interface EconomicRegionAccount {
  id: EconomicRegionId;
  population: number;
  realGDP: number;
  employment: number;
  investment: number;
  exports: number;
  disposableIncomePerCapita: number;
  urbanizationRate: number;
  infrastructureIndex: number;
  productivityIndex: number;
  netInterregionalMigration: number;
  netCapitalFlow: number;
  netFiscalTransfer: number;
}
/** 六大经济区域及跨区域人口、资本和财政流动账户。 */
export interface RegionalEconomyState {
  regions: Record<EconomicRegionId, EconomicRegionAccount>;
  regionalGDPPerCapitaRatio: number;
  coastalGDPShare: number;
  westernDevelopmentIndex: number;
  populationError: number;
  gdpError: number;
  employmentError: number;
  investmentError: number;
  exportError: number;
  migrationFlowError: number;
  capitalFlowError: number;
  fiscalTransferError: number;
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

/** 国防预算、军力库存、战争消耗和国家安全风险账户。 */
export interface SecurityDefenseState {
  annualDefenseBudget: number;
  personnelExpenditure: number;
  equipmentInvestment: number;
  logisticsExpenditure: number;
  researchExpenditure: number;
  activePersonnel: number;
  reservePersonnel: number;
  defenseCapitalStock: number;
  equipmentModernizationRate: number;
  domesticProcurementShare: number;
  militaryImportRequirement: number;
  militaryImportCoverage: number;
  readinessIndex: number;
  logisticsReadinessIndex: number;
  strategicDepthIndex: number;
  civilDefenseCapacity: number;
  externalThreatIndex: number;
  activeConflictId: string | null;
  conflictIntensity: number;
  cumulativeConflictMonths: number;
  monthlyConflictCasualties: number;
  cumulativeConflictCasualties: number;
  cumulativeWarCost: number;
  civilianInvestmentOpportunityCost: number;
  wartimeExternalDebtExposure: number;
}

export type EndogenousRiskId =
  | "food_crisis" | "financial_crisis" | "fiscal_crisis"
  | "environmental_health_crisis" | "social_unrest" | "external_isolation";
export interface EndogenousRiskSignal {
  id: EndogenousRiskId;
  pressure: number;
  threshold: number;
  active: boolean;
  consecutiveMonths: number;
  primaryDriver: string;
  secondaryDriver: string;
}
/** 制度执行能力及六类内生风险因果信号。 */
export interface InstitutionCausalityState {
  stateCapacity: number;
  localImplementationCapacity: number;
  administrativeCapacity: number;
  legalPredictability: number;
  statisticalDataQuality: number;
  policyCredibility: number;
  corruptionRisk: number;
  reformFatigue: number;
  policyOverload: number;
  effectivePolicyExecutionRate: number;
  risks: Record<EndogenousRiskId, EndogenousRiskSignal>;
  activeRiskIds: EndogenousRiskId[];
  highestRiskId: EndogenousRiskId;
  highestRiskPressure: number;
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
  humanDevelopment: HumanDevelopmentState;
  technology: TechnologyState;
  resources: ResourceState;
  society: SocietyState;
  trade: TradeState;
  privateEconomy: PrivateEconomyState;
  enterprises: EnterpriseSectorState;
  nationalAccounts: NationalAccountsState;
  marketDynamics: MarketDynamicsState;
  financialSystem: FinancialSystemState;
  regionalEconomy: RegionalEconomyState;
  diplomacy: DiplomacyState;
  securityDefense: SecurityDefenseState;
  institutions: InstitutionCausalityState;
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
