import foreignExchangeConfig from "../../data/config/foreign-exchange.json";
import { approach, clamp, safeDivide } from "../core/math";
import { applyModifiers } from "../events/modifiers";
import { applyPolicyModifiers } from "../policies/policy-engine";
import type { GameState, NationState } from "../state/game-state";
import type { MonthlySnapshot } from "../state/history-state";
import { calculateWorldComparableGDP } from "./historical-accounting";

interface ShareAnchor {
  year: number;
  share: number;
}

const remittanceShareAnchors =
  foreignExchangeConfig.remittanceGDPShareAnchors as ShareAnchor[];
const reserveShareAnchors =
  foreignExchangeConfig.reserveGDPShareAnchors as ShareAnchor[];

function interpolateShare(anchors: ShareAnchor[], year: number): number {
  const first = anchors[0];
  const last = anchors.at(-1);
  if (!first || !last) throw new Error("外汇历史锚点不能为空");
  if (year <= first.year) return first.share;
  if (year >= last.year) return last.share;
  const upperIndex = anchors.findIndex((anchor) => anchor.year >= year);
  const lower = anchors[upperIndex - 1];
  const upper = anchors[upperIndex];
  if (!lower || !upper) return first.share;
  const progress = (year - lower.year) / (upper.year - lower.year);
  return lower.share + (upper.share - lower.share) * progress;
}

function comparableGDP(state: GameState): number {
  return calculateWorldComparableGDP(
    state.nation.economy.realGDP,
    state.world.worldPriceLevel,
    state.nation.date.year,
  );
}

function remittanceAccessMultiplier(state: GameState): number {
  const { nation } = state;
  const averageRelation = safeDivide(
    state.world.countries.reduce(
      (total, country) => total + country.relationWithChina,
      0,
    ),
    state.world.countries.length,
  );
  const sanctionedShare = safeDivide(
    state.world.countries.filter(
      (country) => country.diplomaticStatus === "sanctioned",
    ).length,
    state.world.countries.length,
  );
  return clamp(
    0.78 +
      nation.trade.openness * 0.2 +
      nation.economy.institutionalEfficiency * 0.12 +
      nation.diplomacy.globalReputation / 1_000 +
      averageRelation / 500 -
      sanctionedShare * 0.35,
    0.45,
    1.25,
  );
}

function calculateImportCoverageMonths(state: GameState): number {
  const comparable = comparableGDP(state);
  const comparableImports = state.nation.trade.imports * safeDivide(
    comparable,
    state.nation.economy.nominalGDP,
  );
  return clamp(
    safeDivide(
      state.nation.trade.foreignExchangeReserves,
      comparableImports / 12,
    ),
    0,
    120,
  );
}

/** 外汇充足度影响必要进口的结算能力，但不会凭空创造供给。 */
export function reserveImportCapacityMultiplier(nation: NationState): number {
  return clamp(
    0.72 + nation.trade.importCoverageMonths / 12 * 0.28,
    0.7,
    1.08,
  );
}

/** 只有投资中的进口资本品部分受外汇满足率约束。 */
export function foreignExchangeInvestmentMultiplier(
  nation: NationState,
): number {
  const importShare = clamp(
    nation.trade.capitalGoodsImportShare,
    foreignExchangeConfig.capitalGoodsImportShareMinimum,
    foreignExchangeConfig.capitalGoodsImportShareMaximum,
  );
  const coverage = clamp(nation.trade.capitalGoodsImportCoverage, 0, 1);
  return clamp(
    1 -
      importShare *
        (1 - coverage) *
        foreignExchangeConfig.capitalGoodsInvestmentConstraintWeight,
    0.9,
    1,
  );
}

/** 将美元等值侨汇折回游戏内部不变价口径，进入居民收入和储蓄。 */
function domesticRemittanceValue(nation: NationState): number {
  return Math.max(0, nation.trade.remittanceInflows * safeDivide(
    nation.economy.realGDP,
    nation.economy.internationalComparableGDP,
  ));
}

export function remittanceInvestmentRate(nation: NationState): number {
  return clamp(
    applyPolicyModifiers(
      nation,
      "capital.remittanceInvestmentRate",
      foreignExchangeConfig.baseRemittanceInvestmentRate,
    ),
    0,
    0.65,
  );
}

export function remittanceDomesticIncome(nation: NationState): number {
  const transferEfficiency = clamp(
    applyPolicyModifiers(
      nation,
      "trade.remittanceTransferEfficiency",
      foreignExchangeConfig.remittanceHouseholdIncomePassThrough,
    ),
    0.5,
    1,
  );
  return domesticRemittanceValue(nation) *
    (1 - remittanceInvestmentRate(nation)) * transferEfficiency;
}

export function remittanceDirectedInvestment(nation: NationState): number {
  return domesticRemittanceValue(nation) * remittanceInvestmentRate(nation);
}

export function ensureForeignExchangeState(state: GameState): void {
  const comparable = comparableGDP(state);
  const reserveShare = interpolateShare(
    reserveShareAnchors,
    state.nation.date.year,
  );
  const remittanceShare = interpolateShare(
    remittanceShareAnchors,
    state.nation.date.year,
  );
  const trade = state.nation.trade;
  trade.foreignExchangeReserves = Number.isFinite(
    trade.foreignExchangeReserves,
  )
    ? Math.max(0, trade.foreignExchangeReserves)
    : Math.max(
        foreignExchangeConfig.initialForeignExchangeReserves,
        comparable * reserveShare,
      );
  trade.monthlyReserveChange = Number.isFinite(trade.monthlyReserveChange)
    ? trade.monthlyReserveChange
    : 0;
  trade.remittanceInflows = Number.isFinite(trade.remittanceInflows)
    ? Math.max(0, trade.remittanceInflows)
    : Math.max(
        foreignExchangeConfig.initialRemittanceInflows,
        comparable * remittanceShare,
      );
  trade.remittanceReserveContribution = Number.isFinite(
    trade.remittanceReserveContribution,
  )
    ? Math.max(0, trade.remittanceReserveContribution)
    : trade.remittanceInflows *
      foreignExchangeConfig.remittanceSettlementRetentionRate;
  trade.importCoverageMonths = Number.isFinite(trade.importCoverageMonths)
    ? Math.max(0, trade.importCoverageMonths)
    : calculateImportCoverageMonths(state);
  trade.externalDebt = Number.isFinite(trade.externalDebt)
    ? Math.max(0, trade.externalDebt)
    : foreignExchangeConfig.initialExternalDebt;
  trade.externalDebtToGDP = Number.isFinite(trade.externalDebtToGDP)
    ? Math.max(0, trade.externalDebtToGDP)
    : safeDivide(trade.externalDebt, comparable);
  trade.externalDebtInterestRate = Number.isFinite(
    trade.externalDebtInterestRate,
  )
    ? clamp(trade.externalDebtInterestRate, 0, 0.3)
    : foreignExchangeConfig.baseExternalDebtInterestRate;
  trade.annualExternalDebtService = Number.isFinite(
    trade.annualExternalDebtService,
  )
    ? Math.max(0, trade.annualExternalDebtService)
    : 0;
  trade.externalDebtServiceRatio = Number.isFinite(
    trade.externalDebtServiceRatio,
  )
    ? Math.max(0, trade.externalDebtServiceRatio)
    : 0;
  trade.monthlyExternalBorrowing = Number.isFinite(
    trade.monthlyExternalBorrowing,
  )
    ? Math.max(0, trade.monthlyExternalBorrowing)
    : 0;
  trade.capitalGoodsForeignExchangeNeed = Number.isFinite(
    trade.capitalGoodsForeignExchangeNeed,
  )
    ? Math.max(0, trade.capitalGoodsForeignExchangeNeed)
    : 0;
  trade.capitalGoodsImportShare = Number.isFinite(
    trade.capitalGoodsImportShare,
  )
    ? clamp(
        trade.capitalGoodsImportShare,
        foreignExchangeConfig.capitalGoodsImportShareMinimum,
        foreignExchangeConfig.capitalGoodsImportShareMaximum,
      )
    : foreignExchangeConfig.capitalGoodsImportShareMaximum;
  trade.capitalGoodsImportCoverage = Number.isFinite(
    trade.capitalGoodsImportCoverage,
  )
    ? clamp(trade.capitalGoodsImportCoverage, 0, 1)
    : 0.65;

  for (const snapshot of state.nation.history.monthly as Array<
    Partial<MonthlySnapshot>
  >) {
    snapshot.foreignExchangeReserves = Number.isFinite(
      snapshot.foreignExchangeReserves,
    )
      ? snapshot.foreignExchangeReserves
      : 0;
    snapshot.remittanceInflows = Number.isFinite(snapshot.remittanceInflows)
      ? snapshot.remittanceInflows
      : 0;
    snapshot.externalDebt = Number.isFinite(snapshot.externalDebt)
      ? snapshot.externalDebt
      : 0;
    snapshot.externalDebtToGDP = Number.isFinite(snapshot.externalDebtToGDP)
      ? snapshot.externalDebtToGDP
      : 0;
    snapshot.annualExternalDebtService = Number.isFinite(
      snapshot.annualExternalDebtService,
    )
      ? snapshot.annualExternalDebtService
      : 0;
    snapshot.capitalGoodsImportCoverage = Number.isFinite(
      snapshot.capitalGoodsImportCoverage,
    )
      ? snapshot.capitalGoodsImportCoverage
      : 0;
  }
  for (const snapshot of state.nation.history.annual as Array<
    Partial<MonthlySnapshot>
  >) {
    snapshot.foreignExchangeReserves = Number.isFinite(
      snapshot.foreignExchangeReserves,
    )
      ? snapshot.foreignExchangeReserves
      : 0;
    snapshot.remittanceInflows = Number.isFinite(snapshot.remittanceInflows)
      ? snapshot.remittanceInflows
      : 0;
    snapshot.externalDebt = Number.isFinite(snapshot.externalDebt)
      ? snapshot.externalDebt
      : 0;
    snapshot.externalDebtToGDP = Number.isFinite(snapshot.externalDebtToGDP)
      ? snapshot.externalDebtToGDP
      : 0;
    snapshot.annualExternalDebtService = Number.isFinite(
      snapshot.annualExternalDebtService,
    )
      ? snapshot.annualExternalDebtService
      : 0;
    snapshot.capitalGoodsImportCoverage = Number.isFinite(
      snapshot.capitalGoodsImportCoverage,
    )
      ? snapshot.capitalGoodsImportCoverage
      : 0;
  }
}

/** 更新年度化侨汇、外储、资本品用汇与外债融资偿付闭环。 */
export function updateForeignExchange(state: GameState): void {
  ensureForeignExchangeState(state);
  const { nation } = state;
  const comparable = comparableGDP(state);
  const remittanceShare = interpolateShare(
    remittanceShareAnchors,
    nation.date.year,
  );
  const baseRemittanceTarget =
    comparable * remittanceShare * remittanceAccessMultiplier(state);
  const remittanceTarget = Math.max(
    0,
    applyModifiers(
      nation,
      "trade.remittanceInflows",
      applyPolicyModifiers(
        nation,
        "trade.remittanceInflows",
        baseRemittanceTarget,
      ),
    ),
  );
  nation.trade.remittanceInflows = approach(
    nation.trade.remittanceInflows,
    remittanceTarget,
    foreignExchangeConfig.remittanceAdjustmentSpeed,
  );
  const remittanceRetentionRate = clamp(
    applyPolicyModifiers(
      nation,
      "trade.remittanceReserveRetention",
      foreignExchangeConfig.remittanceSettlementRetentionRate,
    ),
    0,
    1,
  );
  nation.trade.remittanceReserveContribution =
    nation.trade.remittanceInflows * remittanceRetentionRate;

  const comparableConversion = safeDivide(
    comparable,
    nation.economy.nominalGDP,
  );
  const comparableTradeBalance = nation.trade.balance * comparableConversion;
  const comparableForeignInvestment =
    nation.trade.foreignInvestment * comparableConversion;
  const balanceContribution = comparableTradeBalance >= 0
    ? comparableTradeBalance * foreignExchangeConfig.tradeSurplusRetentionRate
    : comparableTradeBalance * foreignExchangeConfig.tradeDeficitCoverageRate;
  const reserveAnchor = comparable * interpolateShare(
    reserveShareAnchors,
    nation.date.year,
  );
  const annualReserveFlowBeforeDebt =
    balanceContribution +
    nation.trade.remittanceReserveContribution +
    comparableForeignInvestment *
      foreignExchangeConfig.foreignInvestmentRetentionRate +
    nation.trade.foreignExchangeReserves *
      foreignExchangeConfig.annualReserveInvestmentReturn +
    (reserveAnchor - nation.trade.foreignExchangeReserves) *
      foreignExchangeConfig.reserveAnchorAdjustmentRate;

  const capitalGoodsImportShare = clamp(
    foreignExchangeConfig.capitalGoodsImportShareMaximum -
      nation.technology.index / 500 +
      nation.trade.openness * 0.05,
    foreignExchangeConfig.capitalGoodsImportShareMinimum,
    foreignExchangeConfig.capitalGoodsImportShareMaximum,
  );
  const capitalGoodsNeed = Math.max(
    0,
    nation.economy.investment * comparableConversion * capitalGoodsImportShare,
  );
  const comparableExports = Math.max(
    0,
    nation.trade.exports * comparableConversion,
  );
  const baseCapitalGoodsForeignExchange =
    comparableExports *
      foreignExchangeConfig.capitalGoodsExportAllocationRate +
    nation.trade.foreignExchangeReserves *
      foreignExchangeConfig.capitalGoodsReserveDrawRate +
    comparableForeignInvestment *
      foreignExchangeConfig.capitalGoodsFDIAllocationRate +
    nation.trade.remittanceReserveContribution *
      foreignExchangeConfig.capitalGoodsRemittanceAllocationRate;
  const capitalGoodsFundingGap = Math.max(
    0,
    capitalGoodsNeed - baseCapitalGoodsForeignExchange,
  );
  const externalFinancingAccess = nation.date.year <
      foreignExchangeConfig.marketBorrowingStartYear
    ? 0
    : clamp(
        0.05 +
          nation.trade.openness * 0.5 +
          nation.economy.institutionalEfficiency * 0.3 +
          nation.diplomacy.globalReputation / 300,
        0,
        0.85,
      );
  const debtCapacity = Math.max(
    0,
    comparable * foreignExchangeConfig.maximumExternalDebtToComparableGDP -
      nation.trade.externalDebt,
  );
  const marketBorrowing = Math.min(
    capitalGoodsFundingGap * externalFinancingAccess,
    comparable * foreignExchangeConfig.maximumAnnualMarketBorrowingToGDP,
    debtCapacity * 12,
  );
  const annualExternalBorrowing = clamp(
    applyModifiers(
      nation,
      "trade.externalBorrowing",
      applyPolicyModifiers(
        nation,
        "trade.externalBorrowing",
        marketBorrowing,
      ),
    ),
    0,
    debtCapacity * 12,
  );
  const annualNonReserveBorrowingUse = clamp(
    applyModifiers(
      nation,
      "trade.externalBorrowingNonReserveUse",
      0,
    ),
    0,
    annualExternalBorrowing,
  );
  const annualProductiveBorrowing =
    annualExternalBorrowing - annualNonReserveBorrowingUse;

  const openingExternalDebt = nation.trade.externalDebt;
  const openingDebtRatio = safeDivide(openingExternalDebt, comparable);
  const externalDebtInterestRate = clamp(
    applyModifiers(
      nation,
      "trade.externalDebtInterestRate",
      foreignExchangeConfig.baseExternalDebtInterestRate +
        openingDebtRatio * foreignExchangeConfig.externalDebtRiskPremium +
        (1 - nation.economy.institutionalEfficiency) * 0.01,
    ),
    0.01,
    0.18,
  );
  const annualPrincipalRepaymentRate = clamp(
    applyModifiers(
      nation,
      "trade.externalDebtPrincipalRepaymentRate",
      nation.date.year <= foreignExchangeConfig.earlyRepaymentEndYear
        ? foreignExchangeConfig.earlyAnnualPrincipalRepaymentRate
        : foreignExchangeConfig.baseAnnualPrincipalRepaymentRate,
    ),
    0,
    1,
  );
  const plannedMonthlyInterest =
    openingExternalDebt * externalDebtInterestRate / 12;
  const plannedMonthlyPrincipal = nation.date.year ===
      foreignExchangeConfig.historicalExternalDebtClearanceYear &&
      nation.date.month === 1
    ? openingExternalDebt
    : openingExternalDebt * annualPrincipalRepaymentRate / 12;
  const reservesBeforeDebtService = Math.max(
    0,
    nation.trade.foreignExchangeReserves +
      annualReserveFlowBeforeDebt / 12,
  );
  const paidMonthlyInterest = Math.min(
    plannedMonthlyInterest,
    reservesBeforeDebtService,
  );
  const paidMonthlyPrincipal = Math.min(
    plannedMonthlyPrincipal,
    reservesBeforeDebtService - paidMonthlyInterest,
  );
  const unpaidMonthlyInterest =
    plannedMonthlyInterest - paidMonthlyInterest;
  const nextExternalDebt = clamp(
    openingExternalDebt +
      annualExternalBorrowing / 12 -
      paidMonthlyPrincipal +
      unpaidMonthlyInterest,
    0,
    comparable * foreignExchangeConfig.maximumExternalDebtToComparableGDP,
  );
  const nextReserves = clamp(
    reservesBeforeDebtService - paidMonthlyInterest - paidMonthlyPrincipal,
    0,
    comparable * foreignExchangeConfig.maximumReserveToComparableGDP,
  );
  nation.trade.monthlyReserveChange =
    nextReserves - nation.trade.foreignExchangeReserves;
  nation.trade.foreignExchangeReserves = nextReserves;
  nation.trade.importCoverageMonths = calculateImportCoverageMonths(state);
  nation.trade.externalDebt = nextExternalDebt;
  nation.trade.externalDebtToGDP = safeDivide(nextExternalDebt, comparable);
  nation.trade.externalDebtInterestRate = externalDebtInterestRate;
  nation.trade.annualExternalDebtService =
    (paidMonthlyInterest + paidMonthlyPrincipal) * 12;
  nation.trade.externalDebtServiceRatio = safeDivide(
    nation.trade.annualExternalDebtService,
    comparableExports,
  );
  nation.trade.monthlyExternalBorrowing = annualExternalBorrowing / 12;
  nation.trade.capitalGoodsForeignExchangeNeed = capitalGoodsNeed;
  nation.trade.capitalGoodsImportShare = capitalGoodsImportShare;
  nation.trade.capitalGoodsImportCoverage = clamp(
    applyModifiers(
      nation,
      "trade.capitalGoodsImportCoverage",
      applyPolicyModifiers(
        nation,
        "trade.capitalGoodsImportCoverage",
        safeDivide(
          baseCapitalGoodsForeignExchange + annualProductiveBorrowing,
          capitalGoodsNeed,
          1,
        ),
      ),
    ),
    0,
    1,
  );
}
