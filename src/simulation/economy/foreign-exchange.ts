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

/** 将美元等值侨汇折回游戏内部不变价口径，进入居民收入和储蓄。 */
export function remittanceDomesticIncome(nation: NationState): number {
  return Math.max(
    0,
    nation.trade.remittanceInflows *
      safeDivide(
        nation.economy.realGDP,
        nation.economy.internationalComparableGDP,
      ) *
      foreignExchangeConfig.remittanceHouseholdIncomePassThrough,
  );
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
  }
}

/** 更新年度化侨汇流量、外汇储备存量和进口覆盖能力。 */
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
  nation.trade.remittanceReserveContribution =
    nation.trade.remittanceInflows *
    foreignExchangeConfig.remittanceSettlementRetentionRate;

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
  const annualReserveFlow =
    balanceContribution +
    nation.trade.remittanceReserveContribution +
    comparableForeignInvestment *
      foreignExchangeConfig.foreignInvestmentRetentionRate +
    nation.trade.foreignExchangeReserves *
      foreignExchangeConfig.annualReserveInvestmentReturn +
    (reserveAnchor - nation.trade.foreignExchangeReserves) *
      foreignExchangeConfig.reserveAnchorAdjustmentRate;
  const nextReserves = clamp(
    nation.trade.foreignExchangeReserves + annualReserveFlow / 12,
    0,
    comparable * foreignExchangeConfig.maximumReserveToComparableGDP,
  );
  nation.trade.monthlyReserveChange =
    nextReserves - nation.trade.foreignExchangeReserves;
  nation.trade.foreignExchangeReserves = nextReserves;
  nation.trade.importCoverageMonths = calculateImportCoverageMonths(state);
}
