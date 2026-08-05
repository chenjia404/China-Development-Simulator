import type { NationHistory } from "./history-state";
import type { WorldState } from "./world-state";
import type { FamineMortalityAccount } from "../population/famine-mortality-account";

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

export type IndustrialPolicyStance = "support" | "neutral" | "suppress";

export interface IndustrialPolicyCategoryState {
  industryId: IndustrialCategoryId;
  /** 玩家当前要求的政策方向；实际强度按月渐进接近目标。 */
  stance: IndustrialPolicyStance;
  /** -1 表示完全限制，0 表示中性，1 表示完全扶持。 */
  effectiveIntensity: number;
  lastChangedElapsedMonth: number | null;
}

export interface IndustrialPolicyState {
  categories: Record<IndustrialCategoryId, IndustrialPolicyCategoryState>;
  annualFiscalCost: number;
  creditAllocationBias: number;
  distortionIndex: number;
  laborDisplacementPressure: number;
  /** 优先扶持配额份额（0–1）；由扶持强度之和与制度容量结算，限制不占用。存档字段名保持兼容。 */
  administrativeEffectiveness: number;
  supplyChainConstraint: number;
}

/** 土地制度姿态；槽外命令，不占用常驻国策槽。 */
export type LandInstitutionStance =
  | "household_farming"
  | "cooperative"
  | "collective";

/** 企业制度姿态；只通过民营流量间接影响所有制展示份额。 */
export type EnterpriseInstitutionStance =
  | "private_led"
  | "mixed"
  | "soe_led";

/** 价格制度姿态；影响对内市场化目标与价格调整弹性。 */
export type PriceInstitutionStance = "free" | "guided" | "planned";

/**
 * 经济协调体制：计划强度与对内市场化为慢变库存。
 * 公有份额派生自 enterprises.stateControlledShare；对外开放引用 trade.openness。
 * 与 institutionalEfficiency（行政执行效率）、institutions（内生风险）语义分离，
 * 禁止再驱动 enterprise targetShares 或直接乘 GDP。
 */
export interface EconomicCoordinationState {
  planningIntensity: number;
  planningTarget: number;
  domesticMarketFreedom: number;
  domesticMarketFreedomTarget: number;
  /** 当月快照：国有+集体增加值份额，只读派生。 */
  publicOwnershipShare: number;
  landStance: LandInstitutionStance;
  enterpriseStance: EnterpriseInstitutionStance;
  priceStance: PriceInstitutionStance;
  landStanceChangedElapsedMonth: number | null;
  enterpriseStanceChangedElapsedMonth: number | null;
  priceStanceChangedElapsedMonth: number | null;
}

export interface FiscalBudget {
  education: number;
  health: number;
  agriculture: number;
  industry: number;
  infrastructure: number;
  transport: number;
  research: number;
  housing: number;
  welfare: number;
  defense: number;
  administration: number;
}

/** 公共交通与运输网络库存、流量与物流效率账户。 */
export interface PublicTransportState {
  railNetworkKm: number;
  highwayNetworkKm: number;
  expresswayKm: number;
  urbanTransitKm: number;
  metroKm: number;
  transportCapitalStock: number;
  maintenanceBacklog: number;
  monthlyTransportInvestment: number;
  monthlyMaintenanceSpend: number;
  freightTonKm: number;
  passengerKm: number;
  freightCapacity: number;
  freightDemand: number;
  freightCapacityUtilization: number;
  logisticsEfficiencyIndex: number;
  logisticsCostMultiplier: number;
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
  /** 农业税潜在份额（相对未乘外层 modifier 的合并税基）。 */
  agriculturalTaxShare: number;
  /** 当期实收农业税。 */
  agriculturalTaxRevenue: number;
  /** 农业税是否已永久废除（不可逆）。 */
  agriculturalTaxAbolished: boolean;
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

export type ElectricityBreakdown = Record<EnergySourceId, number>;

/** 发电装机、分部门用电与电力供需平衡账户。 */
export interface ElectricitySystemState {
  capacity: ElectricityBreakdown;
  generation: ElectricityBreakdown;
  consumption: {
    residential: number;
    industrial: number;
    commercial: number;
    agriculture: number;
  };
  grossGeneration: number;
  gridLosses: number;
  netGeneration: number;
  totalConsumption: number;
  electricityDemand: number;
  electricitySupplyRatio: number;
  capacityUtilization: number;
  reserveMargin: number;
  perCapitaConsumption: number;
  unmetDemand: number;
  balanceError: number;
}

export interface ResourceState {
  foodProduction: number;
  foodDemand: number;
  foodSupplyRatio: number;
  agriculture: AgricultureSystemState;
  infrastructureResources: InfrastructureResourceState;
  electricity: ElectricitySystemState;
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

/** 电力、电视、手机与互联网普及率（0–1，手机可略高于 1 表示多终端）。 */
export interface InfrastructurePenetrationState {
  electricityPenetration: number;
  televisionPenetration: number;
  mobilePenetration: number;
  internetPenetration: number;
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
  infrastructurePenetration: InfrastructurePenetrationState;
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
  /**
   * 北戴河对苏还债计划。unset 保持史实校准提前还债；
   * 亲苏交恶后由还债事件写入五年/折中/十年路径。
   */
  sovietDebtRepaymentPlan: "unset" | "five_year_early" | "moderate" | "ten_year";
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
  /**
   * 证券交易所与直接融资账户。股权融资只是既有投资的融资来源，
   * 不会在国民账户中重复计为新增投资或 GDP。
   */
  capitalMarket: {
    /** 交易、登记、清算、信息披露与一线监管的综合运行能力，0—1。 */
    exchangeOperationalCapacity: number;
    /** 股东权利、信息披露与违法处置形成的投资者保护水平，0—1。 */
    investorProtectionIndex: number;
    /** 股票总市值相对名义 GDP 的比例。 */
    equityMarketDepth: number;
    /** 市场承接发行与交易的流动性，0—1。 */
    marketLiquidity: number;
    /** 由银行可得性和直接融资共同形成的社会融资能力，0—1。 */
    socialFinancingCapacity: number;
    /** 从当年既有投资中识别出的年度化股权融资流量。 */
    annualEquityFinancing: number;
    /** 股权融资中面向研发、成长企业和技术商业化的份额。 */
    innovationFinancingShare: number;
    listedCompanyCount: number;
    /** 资产价格波动和制度缺口形成的市场风险，0—1。 */
    marketVolatilityIndex: number;
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
  /**
   * 历史事件相对史实援外基线的年化差额（当年价人民币）。
   * 正数表示额外援助，负数表示削减或拒绝对已计入基线的份额。
   */
  foreignAidEventAnnualRmbAdjustment: number;
  /** 历史事件专属外汇强度（人民币等值年化），直接进入外汇流出账户。 */
  foreignAidEventAnnualFxRmbAdjustment: number;
  /**
   * 该事件史实路线的专属外汇强度。外储只结算相对该基线的差额，
   * 避免史实路径把已校准的外汇成本再扣一遍。
   */
  foreignAidEventHistoricalFxBaselineRmb: number;
  foreignAidEventAdjustmentRemainingMonths: number;
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

export interface AchievementUnlockRecord {
  id: string;
  name: string;
  year: number;
  month: number;
  scoreAtUnlock: number;
  mode: "natural" | "breakthrough";
}

export interface AchievementBreakthroughState {
  achievementId: string;
  startedYear: number;
  startedMonth: number;
  progressMonths: number;
  requiredMonths: number;
  scoreAtStart: number;
}

export interface AchievementsState {
  unlocked: AchievementUnlockRecord[];
  activeBreakthroughs: AchievementBreakthroughState[];
}

/** 新建游戏时选定的开局路线；局中仍可按现有命令调整，本字段仅作记录。 */
export interface OpeningChoices {
  economicMechanism: "planned" | "market";
  diplomaticStrategyId: "pro_soviet" | "balanced" | "pro_western";
  foreignPolicyDoctrineId: DiplomacyState["foreignPolicyDoctrineId"];
  developmentBlueprintId: string;
  /** 省略时按完整战役迁移。 */
  scenarioId?: ScenarioId;
  /** 省略时按标准难度迁移。 */
  difficultyId?: DifficultyId;
}

export type ScenarioId = "full_campaign" | "recovery_1962" | "reform_1978" | "wto_2001";
export type DifficultyId = "relaxed" | "standard" | "challenge";
export type ScenarioRating = "gold" | "silver" | "bronze" | "failed";

export interface ScenarioObjectiveResult {
  id: string;
  label: string;
  value: number;
  target: number;
  met: boolean;
}

/** 战役或短剧本的时间范围、难度与终局目标。 */
export interface ScenarioState {
  scenarioId: ScenarioId;
  difficultyId: DifficultyId;
  startYear: number;
  endYear: number;
  short: boolean;
  completedYear: number | null;
  rating: ScenarioRating | null;
  objectiveResults: ScenarioObjectiveResult[];
  lastEvaluatedYear: number | null;
}

export interface StrategicPlanningState {
  /** 当前五年规划的起止年份，均为包含端点。 */
  planStartYear: number;
  planEndYear: number;
  /** 当前五年规划最多三个长期重点。 */
  priorityIds: string[];
  /** 本年度额外聚焦的一项重点，效果弱于五年规划。 */
  annualFocusId: string | null;
  /** 最近一次已确认的年度复盘年份。 */
  lastReviewYear: number | null;
  /** 交互模式下等待玩家确认的年度报告年份。 */
  pendingReviewYear: number | null;
}

export type VictoryPathId =
  | "economic_leadership"
  | "common_prosperity"
  | "technology_civilization";

export type VictoryStage = "building" | "candidate" | "sustaining" | "achieved";

export interface VictoryPathProgress {
  pathId: VictoryPathId;
  stage: VictoryStage;
  consecutiveQualifiedYears: number;
  bestConsecutiveYears: number;
  firstQualifiedYear: number | null;
  lastEvaluatedYear: number | null;
  qualifiedLastEvaluation: boolean;
}

/** 多路线胜利进度；所有路线并行评估，最先连续达标的路线完成本局。 */
export interface VictoryState {
  requiredConsecutiveYears: number;
  achievedPathId: VictoryPathId | null;
  achievedYear: number | null;
  paths: Record<VictoryPathId, VictoryPathProgress>;
}

export interface BlueprintMissionCompletionRecord {
  stageId: string;
  stageName: string;
  year: number;
}

/** 开局发展蓝图对应的三阶段长期任务。 */
export interface BlueprintMissionState {
  blueprintId: string | null;
  currentStageIndex: number;
  completedStages: BlueprintMissionCompletionRecord[];
  lastEvaluatedYear: number | null;
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
  /** 可按工业类别分别扶持或限制的产业政策账户。 */
  industrialPolicy: IndustrialPolicyState;
  /** 计划/对内市场协调体制；槽外姿态，不占用国策槽。 */
  economicCoordination: EconomicCoordinationState;
  fiscal: FiscalState;
  education: EducationState;
  health: HealthState;
  humanDevelopment: HumanDevelopmentState;
  technology: TechnologyState;
  resources: ResourceState;
  transport: PublicTransportState;
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
  /** 本局开局时选定的路线；旧存档或未走开局向导时为 undefined。 */
  openingChoices?: OpeningChoices;
  /** 当前完整战役或短剧本状态。 */
  scenario: ScenarioState;
  /** 年度复盘、年度重点与五年规划状态。 */
  strategicPlanning: StrategicPlanningState;
  /** 开局蓝图三阶段任务链进度。 */
  blueprintMission: BlueprintMissionState;
  projects: ProjectState[];
  modifiers: ModifierState[];
  /** 国家成就：能力分解锁与集中突破进度。 */
  achievements: AchievementsState;
  historicalEventDecisionMode: "automatic" | "interactive";
  /** 玩家手动调整预算后为 true，停止自动对齐史实参考结构。 */
  budgetManuallyAdjusted: boolean;
  pendingHistoricalEventId: string | null;
  /** 多路线、持续保持型胜利状态。 */
  victory: VictoryState;
  /** 兼容旧存档和既有分享接口的胜利年份镜像；未达成时为 null。 */
  victoryYear: number | null;
  /** 三年困难（1959–1961）超额死亡账户与待确认报告。 */
  famineMortality: FamineMortalityAccount;
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
