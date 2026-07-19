import financialData from "../../data/config/monetary-financial.json";
import { approach, clamp, safeDivide } from "../core/math";
import type {
  FinancialSystemState,
  GameState,
  NationState,
} from "../state/game-state";

interface RatioAnchor { year: number; value: number }
interface FinancialConfig {
  monthlyDepthAdjustmentSpeed: number;
  minimumCapitalAdequacyRatio: number;
  baseCapitalAdequacyRatio: number;
  baseProvisionCoverageRatio: number;
  baseNonPerformingLoanRatio: number;
  enterpriseLoanShare: number;
  householdLoanShareMinimum: number;
  householdLoanShareMaximum: number;
  governmentClaimShareMinimum: number;
  serviceExportShareOfGoods: number;
  serviceImportShareOfGoods: number;
  capitalMarket: {
    monthlyCapacityAdjustmentSpeed: number;
    monthlyDepthAdjustmentSpeed: number;
    monthlyLiquidityAdjustmentSpeed: number;
    maximumEquityMarketDepth: number;
    maximumEquityFinancingShareOfInvestment: number;
    maximumListedCompanyShare: number;
    maximumInnovationFinancingShare: number;
    privateInvestmentResponse: number;
    investmentEfficiencyBenefit: number;
    volatilityEfficiencyPenalty: number;
    commercializationMonthlyGain: number;
    entrepreneurialCapacityMonthlyGain: number;
  };
  m2ToGDPAnchors: RatioAnchor[];
  baseMoneyToGDPAnchors: RatioAnchor[];
}

const config = financialData as FinancialConfig;

function interpolate(anchors: RatioAnchor[], year: number): number {
  const first = anchors[0];
  const last = anchors.at(-1);
  if (!first || !last) throw new Error("货币金融锚点不能为空");
  if (year <= first.year) return first.value;
  if (year >= last.year) return last.value;
  const upperIndex = anchors.findIndex((item) => item.year >= year);
  const lower = anchors[upperIndex - 1];
  const upper = anchors[upperIndex];
  if (!lower || !upper) return first.value;
  return lower.value + (upper.value - lower.value) *
    (year - lower.year) / (upper.year - lower.year);
}

export function createEmptyFinancialSystemState(): FinancialSystemState {
  return {
    monetary: {
      monetaryBase: 0,
      broadMoney: 0,
      currencyInCirculation: 0,
      deposits: 0,
      bankReserves: 0,
      requiredReserveRatio: 0.12,
      policyRate: 0.04,
      depositRate: 0.025,
      lendingRate: 0.055,
      annualBroadMoneyGrowth: 0,
    },
    banking: {
      totalAssets: 0,
      totalLoans: 0,
      enterpriseLoans: 0,
      householdLoans: 0,
      governmentClaims: 0,
      bankCapital: 0,
      capitalAdequacyRatio: config.baseCapitalAdequacyRatio,
      nonPerformingLoans: 0,
      nonPerformingLoanRatio: config.baseNonPerformingLoanRatio,
      loanLossProvisions: 0,
      aggregateFinancingAccess: 0.2,
      balanceSheetError: 0,
    },
    capitalMarket: createEmptyCapitalMarketState(),
    balanceOfPayments: {
      goodsExports: 0,
      goodsImports: 0,
      servicesBalance: 0,
      primaryIncomeBalance: 0,
      secondaryIncomeBalance: 0,
      currentAccountBalance: 0,
      directInvestmentBalance: 0,
      otherInvestmentBalance: 0,
      financialAccountBalance: 0,
      reserveAssetChange: 0,
      errorsAndOmissions: 0,
      identityError: 0,
    },
    officialExchangeRate: 2.46,
    realEffectiveExchangeRateIndex: 100,
    foreignCurrencyLiquidityMonths: 0,
  };
}

function createEmptyCapitalMarketState(): FinancialSystemState["capitalMarket"] {
  return {
    exchangeOperationalCapacity: 0,
    investorProtectionIndex: 0,
    equityMarketDepth: 0,
    marketLiquidity: 0,
    socialFinancingCapacity: 0.13,
    annualEquityFinancing: 0,
    innovationFinancingShare: 0,
    listedCompanyCount: 0,
    marketVolatilityIndex: 0,
  };
}

function complete(value: FinancialSystemState | undefined): boolean {
  return Boolean(value?.monetary && value.banking && value.capitalMarket &&
    value.balanceOfPayments &&
    Number.isFinite(value.monetary.broadMoney) &&
    Number.isFinite(value.banking.totalAssets) &&
    Number.isFinite(value.capitalMarket.equityMarketDepth) &&
    Number.isFinite(value.balanceOfPayments.identityError));
}

/** 旧存档缺失金融账户时从当前宏观存量确定性重建。 */
export function ensureFinancialSystemState(state: GameState): void {
  if (complete(state.nation.financialSystem)) return;
  const existing = state.nation.financialSystem as
    | (Partial<FinancialSystemState> & {
      capitalMarket?: Partial<FinancialSystemState["capitalMarket"]>;
    })
    | undefined;
  if (existing?.monetary && existing.banking && existing.balanceOfPayments) {
    state.nation.financialSystem = {
      ...existing,
      monetary: existing.monetary,
      banking: existing.banking,
      balanceOfPayments: existing.balanceOfPayments,
      officialExchangeRate: existing.officialExchangeRate ?? 2.46,
      realEffectiveExchangeRateIndex:
        existing.realEffectiveExchangeRateIndex ?? 100,
      foreignCurrencyLiquidityMonths:
        existing.foreignCurrencyLiquidityMonths ?? 0,
      capitalMarket: {
        ...createEmptyCapitalMarketState(),
        ...existing.capitalMarket,
      },
    };
    updateFinancialSystem(state);
    return;
  }
  state.nation.financialSystem = createEmptyFinancialSystemState();
  updateFinancialSystem(state, true);
}

function comparableConversion(nation: NationState): number {
  return safeDivide(
    nation.economy.internationalComparableGDP,
    nation.economy.nominalGDP,
    1,
  );
}

/**
 * 调和货币、银行和国际收支账户。银行只分配既有融资规模；
 * 国际收支把现有储备变动作为最终观测量，并用误差遗漏项闭合恒等式。
 */
export function updateFinancialSystem(state: GameState, initialize = false): void {
  if (!state.nation.financialSystem?.monetary) {
    state.nation.financialSystem = createEmptyFinancialSystemState();
    initialize = true;
  }
  const { nation } = state;
  const system = nation.financialSystem;
  const monetary = system.monetary;
  const banking = system.banking;
  const previousBroadMoney = monetary.broadMoney;
  const depthTarget = nation.economy.nominalGDP * interpolate(
    config.m2ToGDPAnchors,
    nation.date.year,
  ) * (0.82 + nation.economy.institutionalEfficiency * 0.18);
  const baseTarget = nation.economy.nominalGDP * interpolate(
    config.baseMoneyToGDPAnchors,
    nation.date.year,
  );
  monetary.broadMoney = initialize || previousBroadMoney <= 0
    ? depthTarget
    : approach(previousBroadMoney, depthTarget, config.monthlyDepthAdjustmentSpeed);
  monetary.monetaryBase = initialize || monetary.monetaryBase <= 0
    ? baseTarget
    : approach(monetary.monetaryBase, baseTarget, config.monthlyDepthAdjustmentSpeed);
  const cashShare = clamp(
    0.42 - nation.society.urbanizationRate * 0.3 - nation.trade.openness * 0.04,
    0.055,
    0.38,
  );
  monetary.currencyInCirculation = monetary.broadMoney * cashShare;
  monetary.deposits = Math.max(0, monetary.broadMoney - monetary.currencyInCirculation);
  monetary.bankReserves = Math.max(
    0,
    monetary.monetaryBase - monetary.currencyInCirculation,
  );
  monetary.requiredReserveRatio = clamp(
    safeDivide(monetary.bankReserves, monetary.deposits),
    0.05,
    0.28,
  );
  monetary.policyRate = clamp(
    0.025 + Math.max(0, nation.economy.inflationRate - 0.025) * 0.65 +
      nation.fiscal.debtToGDP * 0.012,
    0.01,
    0.22,
  );
  monetary.depositRate = clamp(monetary.policyRate - 0.012, 0.002, 0.2);
  const riskPremium = (1 - nation.economy.institutionalEfficiency) * 0.025 +
    Math.max(0, nation.labor.unemploymentRate - 0.05) * 0.08;
  monetary.lendingRate = clamp(monetary.policyRate + 0.018 + riskPremium, 0.02, 0.3);
  monetary.annualBroadMoneyGrowth = initialize || previousBroadMoney <= 0
    ? 0
    : (monetary.broadMoney / previousBroadMoney - 1) * 12;

  banking.capitalAdequacyRatio = clamp(
    config.baseCapitalAdequacyRatio + nation.economy.institutionalEfficiency * 0.025 -
      Math.max(0, nation.economy.inflationRate - 0.08) * 0.1,
    config.minimumCapitalAdequacyRatio,
    0.16,
  );
  banking.totalAssets = safeDivide(
    monetary.deposits,
    1 - banking.capitalAdequacyRatio,
  );
  banking.bankCapital = banking.totalAssets - monetary.deposits;
  const creditAssets = Math.max(0, banking.totalAssets - monetary.bankReserves);
  const governmentShare = clamp(
    config.governmentClaimShareMinimum + nation.fiscal.debtToGDP * 0.15,
    config.governmentClaimShareMinimum,
    0.32,
  );
  banking.governmentClaims = creditAssets * governmentShare;
  banking.totalLoans = Math.max(0, creditAssets - banking.governmentClaims);
  const householdShare = clamp(
    config.householdLoanShareMinimum + nation.society.urbanizationRate * 0.3,
    config.householdLoanShareMinimum,
    config.householdLoanShareMaximum,
  );
  banking.householdLoans = banking.totalLoans * householdShare;
  banking.enterpriseLoans = banking.totalLoans - banking.householdLoans;
  banking.aggregateFinancingAccess = clamp(
    safeDivide(banking.totalLoans, nation.economy.investment, 0) * 0.12 +
      nation.economy.institutionalEfficiency * 0.55 +
      Math.max(0, nation.industrialPolicy.creditAllocationBias) * 0.08,
    0,
    1,
  );
  banking.nonPerformingLoanRatio = clamp(
    config.baseNonPerformingLoanRatio +
      (1 - nation.economy.institutionalEfficiency) * 0.045 +
      Math.max(0, nation.labor.unemploymentRate - 0.04) * 0.25 +
      Math.max(0, -nation.economy.annualRealGDPGrowth) * 0.35 +
      nation.industrialPolicy.distortionIndex * 0.18,
    0.005,
    0.35,
  );
  banking.nonPerformingLoans = banking.totalLoans * banking.nonPerformingLoanRatio;
  banking.loanLossProvisions = Math.min(
    banking.bankCapital,
    banking.nonPerformingLoans * config.baseProvisionCoverageRatio,
  );
  banking.balanceSheetError = Math.abs(
    banking.totalAssets -
      (monetary.bankReserves + banking.totalLoans + banking.governmentClaims),
  );

  updateCapitalMarket(nation, initialize);

  const conversion = comparableConversion(nation);
  const bop = system.balanceOfPayments;
  bop.goodsExports = Math.max(0, nation.trade.exports * conversion);
  bop.goodsImports = Math.max(0, nation.trade.imports * conversion);
  bop.servicesBalance = bop.goodsExports * config.serviceExportShareOfGoods -
    bop.goodsImports * config.serviceImportShareOfGoods;
  bop.primaryIncomeBalance =
    nation.trade.foreignExchangeReserves * 0.018 -
    nation.trade.externalDebt * nation.trade.externalDebtInterestRate;
  bop.secondaryIncomeBalance = nation.trade.remittanceInflows -
    nation.diplomacy.annualForeignAidForeignExchangeOutflow;
  bop.currentAccountBalance = bop.goodsExports - bop.goodsImports +
    bop.servicesBalance + bop.primaryIncomeBalance + bop.secondaryIncomeBalance;
  bop.directInvestmentBalance = Math.max(0, nation.trade.foreignInvestment * conversion);
  bop.otherInvestmentBalance = nation.trade.monthlyExternalBorrowing * 12 -
    nation.trade.annualExternalDebtService;
  bop.financialAccountBalance = bop.directInvestmentBalance + bop.otherInvestmentBalance;
  bop.reserveAssetChange = nation.trade.monthlyReserveChange * 12;
  bop.errorsAndOmissions = bop.reserveAssetChange -
    bop.currentAccountBalance - bop.financialAccountBalance;
  bop.identityError = Math.abs(
    bop.currentAccountBalance + bop.financialAccountBalance +
      bop.errorsAndOmissions - bop.reserveAssetChange,
  );

  system.officialExchangeRate = clamp(
    safeDivide(
      nation.economy.currentPriceGDPPerCapita,
      nation.economy.currentUSDGDPPerCapita,
      system.officialExchangeRate,
    ),
    0.5,
    20,
  );
  system.realEffectiveExchangeRateIndex = clamp(
    100 * nation.economy.priceLevelIndex / Math.max(state.world.worldPriceLevel, 0.1) *
      system.officialExchangeRate / 6.5,
    20,
    400,
  );
  system.foreignCurrencyLiquidityMonths = nation.trade.importCoverageMonths;
}

function updateCapitalMarket(nation: NationState, initialize: boolean): void {
  const market = nation.financialSystem.capitalMarket;
  const exchangeRecord = nation.history.historicalEvents.find(
    (record) =>
      record.id === "securities_exchange_1990" && record.outcome !== "prevented",
  );
  const monthsSinceEstablishment = exchangeRecord
    ? Math.max(
      0,
      (nation.date.year - exchangeRecord.year) * 12 +
        nation.date.month - exchangeRecord.month,
    )
    : 0;
  const establishmentProgress = exchangeRecord
    ? clamp((monthsSinceEstablishment + 1) / 60, 0, 1)
    : 0;
  const institutionalFoundation = clamp(
    nation.economy.institutionalEfficiency * 0.3 +
      nation.institutions.legalPredictability * 0.3 +
      nation.institutions.stateCapacity * 0.2 +
      nation.privateEconomy.operatingSpace * 0.2,
    0,
    1,
  );
  const capacityTarget = establishmentProgress *
    (0.35 + institutionalFoundation * 0.65);
  market.exchangeOperationalCapacity = initialize
    ? capacityTarget
    : approach(
      market.exchangeOperationalCapacity,
      capacityTarget,
      config.capitalMarket.monthlyCapacityAdjustmentSpeed,
    );

  const investorProtectionTarget = market.exchangeOperationalCapacity * clamp(
    0.08 + nation.institutions.legalPredictability * 0.46 +
      nation.institutions.stateCapacity * 0.18 +
      nation.economy.institutionalEfficiency * 0.2 +
      establishmentProgress * 0.1,
    0,
    1,
  );
  market.investorProtectionIndex = initialize
    ? investorProtectionTarget
    : approach(
      market.investorProtectionIndex,
      investorProtectionTarget,
      config.capitalMarket.monthlyCapacityAdjustmentSpeed,
    );

  const savingsRate = clamp(
    safeDivide(nation.economy.nationalSavings, nation.economy.nominalGDP),
    0,
    0.65,
  );
  const depthTarget = clamp(
    market.exchangeOperationalCapacity * (
      0.12 + nation.privateEconomy.operatingSpace * 0.38 +
      nation.privateEconomy.technologyCommercialization * 0.24 +
      savingsRate * 0.5
    ),
    0,
    config.capitalMarket.maximumEquityMarketDepth,
  );
  market.equityMarketDepth = initialize
    ? depthTarget
    : approach(
      market.equityMarketDepth,
      depthTarget,
      config.capitalMarket.monthlyDepthAdjustmentSpeed,
    );

  const liquidityTarget = clamp(
    market.exchangeOperationalCapacity * (
      0.16 + market.investorProtectionIndex * 0.3 +
      nation.society.urbanizationRate * 0.18 +
      nation.economy.institutionalEfficiency * 0.22 +
      nation.financialSystem.banking.aggregateFinancingAccess * 0.14
    ),
    0,
    1,
  );
  market.marketLiquidity = initialize
    ? liquidityTarget
    : approach(
      market.marketLiquidity,
      liquidityTarget,
      config.capitalMarket.monthlyLiquidityAdjustmentSpeed,
    );

  market.marketVolatilityIndex = market.exchangeOperationalCapacity <= 0.001
    ? 0
    : clamp(
      0.14 + (1 - market.investorProtectionIndex) * 0.28 +
        Math.max(0, nation.economy.inflationRate - 0.04) * 0.9 +
        Math.max(0, -nation.economy.annualRealGDPGrowth) * 0.5 -
        market.marketLiquidity * 0.08,
      0.08,
      0.75,
    );
  const equityFinancingShare = clamp(
    market.equityMarketDepth * market.marketLiquidity *
      (0.45 + market.investorProtectionIndex * 0.55),
    0,
    config.capitalMarket.maximumEquityFinancingShareOfInvestment,
  );
  market.annualEquityFinancing = Math.max(
    0,
    nation.economy.investment * equityFinancingShare,
  );
  market.innovationFinancingShare = clamp(
    market.exchangeOperationalCapacity * (
      market.investorProtectionIndex * 0.16 +
      nation.privateEconomy.technologyCommercialization * 0.18 +
      nation.technology.index / 100 * 0.14
    ),
    0,
    config.capitalMarket.maximumInnovationFinancingShare,
  );
  market.listedCompanyCount = Math.max(
    0,
    Math.round(
      nation.enterprises.totalEnterpriseCount *
      config.capitalMarket.maximumListedCompanyShare *
      market.exchangeOperationalCapacity * market.marketLiquidity,
    ),
  );
  market.socialFinancingCapacity = clamp(
    nation.financialSystem.banking.aggregateFinancingAccess * 0.7 +
      market.exchangeOperationalCapacity * 0.1 +
      market.equityMarketDepth * 0.12 +
      market.marketLiquidity * 0.08,
    0,
    1,
  );
}

/** 资本形成模块读取上一结算月的融资条件，避免金融账户重复创造投资。 */
export function capitalMarketInvestmentMultipliers(nation: NationState): {
  privateInvestment: number;
  investmentEfficiency: number;
} {
  const market = nation.financialSystem.capitalMarket;
  const productiveDepth = market.equityMarketDepth * market.marketLiquidity *
    (0.4 + market.investorProtectionIndex * 0.6);
  return {
    privateInvestment: 1 + productiveDepth *
      config.capitalMarket.privateInvestmentResponse,
    investmentEfficiency: clamp(
      1 + productiveDepth * config.capitalMarket.investmentEfficiencyBenefit -
        market.equityMarketDepth * market.marketVolatilityIndex *
          config.capitalMarket.volatilityEfficiencyPenalty,
      0.96,
      1.06,
    ),
  };
}

/** 证券市场为创新企业提供无需抵押的风险资本，但收益受保护制度约束。 */
export function capitalMarketInnovationMultiplier(nation: NationState): number {
  const market = nation.financialSystem.capitalMarket;
  return clamp(
    1 + market.equityMarketDepth * market.innovationFinancingShare *
      market.investorProtectionIndex * 0.45,
    1,
    1.08,
  );
}

export function capitalMarketCapabilityGains(nation: NationState): {
  commercialization: number;
  entrepreneurship: number;
} {
  const market = nation.financialSystem.capitalMarket;
  const effectiveMarket = market.equityMarketDepth * market.marketLiquidity *
    market.investorProtectionIndex;
  return {
    commercialization: effectiveMarket *
      config.capitalMarket.commercializationMonthlyGain,
    entrepreneurship: effectiveMarket *
      config.capitalMarket.entrepreneurialCapacityMonthlyGain,
  };
}

export function validateFinancialConfiguration(): string[] {
  const errors: string[] = [];
  for (const [name, anchors] of Object.entries({
    广义货币: config.m2ToGDPAnchors,
    基础货币: config.baseMoneyToGDPAnchors,
  })) {
    if (anchors.length < 2) errors.push(`${name}锚点至少需要两项`);
    if (anchors.some((item, index) => item.value <= 0 ||
      (index > 0 && item.year <= (anchors[index - 1]?.year ?? 0)))) {
      errors.push(`${name}锚点必须按年份递增且数值为正`);
    }
  }
  if (
    config.capitalMarket.maximumEquityMarketDepth <= 0 ||
    config.capitalMarket.maximumEquityFinancingShareOfInvestment <= 0 ||
    config.capitalMarket.maximumEquityFinancingShareOfInvestment > 1 ||
    config.capitalMarket.maximumListedCompanyShare <= 0
  ) {
    errors.push("资本市场深度、股权融资和上市公司参数必须处于有效范围");
  }
  return errors;
}
