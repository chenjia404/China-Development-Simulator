import networkData from "../../data/config/international-network.json";
import { clamp, safeDivide } from "../core/math";
import type { GameState } from "../state/game-state";
import type {
  TradePartnerAccount,
  WorldCountryState,
  WorldTradeNetworkState,
} from "../state/world-state";
import { technologyNormalizedEffect } from "../technology/technology-growth";
import { applyPolicyModifiers } from "../policies/policy-engine";
import {
  createEmptyTradeStructureState,
  ensureTradeStructureState,
  updateTradeStructure,
} from "./trade-structure";

interface NetworkConfig {
  relationWeight: number;
  tradeAgreementBonus: number;
  sanctionPenalty: number;
  baseShippingRisk: number;
  maximumRenminbiSettlementShare: number;
  financialCenterCountries: string[];
}
const config = networkData as NetworkConfig;
function emptyPartner(countryId: string): TradePartnerAccount {
  return { countryId, exports: 0, imports: 0, foreignDirectInvestment: 0,
    externalDebtClaims: 0, tradeBalance: 0, marketAccessIndex: 0,
    shippingRiskIndex: 0, sanctionExposure: 0, usdSettlementShare: 0.7,
    renminbiSettlementShare: 0, otherCurrencySettlementShare: 0.3 };
}
export function createEmptyWorldTradeNetworkState(): WorldTradeNetworkState {
  return {
    partners: {},
    exportConcentrationIndex: 0,
    importConcentrationIndex: 0,
    topExportPartnerId: null,
    topImportPartnerId: null,
    averageShippingRisk: 0,
    sanctionExposure: 0,
    renminbiSettlementShare: 0,
    exportError: 0,
    importError: 0,
    investmentError: 0,
    externalDebtError: 0,
    ...createEmptyTradeStructureState(),
  };
}
export function ensureWorldTradeNetworkState(state: GameState): void {
  const network = state.world.tradeNetwork as Partial<WorldTradeNetworkState> | undefined;
  if (network?.partners && state.world.countries.every((country) =>
    network.partners?.[country.id] &&
    Number.isFinite(network.partners[country.id].exports)
  )) {
    ensureTradeStructureState(state);
    return;
  }
  state.world.tradeNetwork = createEmptyWorldTradeNetworkState();
  for (const country of state.world.countries) {
    state.world.tradeNetwork.partners[country.id] = emptyPartner(country.id);
  }
  updateWorldTradeNetwork(state);
}
function access(country: WorldCountryState): number {
  const relation = clamp((country.relationWithChina + 100) / 200, 0, 1);
  return Math.max(0.001, (1 + relation * config.relationWeight +
    (country.tradeAgreement ? config.tradeAgreementBonus : 0)) *
    (1 - country.sanctionLevel * config.sanctionPenalty));
}
function allocate(
  total: number,
  countries: WorldCountryState[],
  weight: (country: WorldCountryState) => number,
): Record<string, number> {
  const sum = countries.reduce((value, country) => value + Math.max(0, weight(country)), 0);
  return Object.fromEntries(countries.map((country) => [
    country.id,
    total * safeDivide(Math.max(0, weight(country)), sum),
  ]));
}
/** 分配中国既有跨境总量，网络本身不重复创造贸易、投资或外债。 */
export function updateWorldTradeNetwork(state: GameState): void {
  if (!state.world.tradeNetwork?.partners) {
    state.world.tradeNetwork = createEmptyWorldTradeNetworkState();
  }
  const network = state.world.tradeNetwork;
  for (const country of state.world.countries) {
    network.partners[country.id] ??= emptyPartner(country.id);
  }
  const totalExports = state.nation.trade.exports;
  const diversification = applyPolicyModifiers(
    state.nation,
    "trade.partnerDiversification",
    0,
  );
  const exports = allocate(state.nation.trade.exports, state.world.countries,
    (country) => {
      let weight = country.nominalGDP ** 0.58 * access(country);
      if (diversification > 0 && totalExports > 0) {
        const previousShare = safeDivide(
          network.partners[country.id]?.exports ?? 0,
          totalExports,
        );
        weight *= clamp(
          1 -
            clamp(previousShare * 2.4, 0, 1) * diversification * 0.28 +
            0.08 * diversification,
          0.55,
          1.35,
        );
      }
      return weight;
    });
  const imports = allocate(state.nation.trade.imports, state.world.countries,
    (country) => country.nominalGDP ** 0.55 *
      (0.75 + technologyNormalizedEffect(country.technologyIndex) * 0.25) * access(country));
  const investment = allocate(state.nation.trade.foreignInvestment, state.world.countries,
    (country) => country.nominalGDP ** 0.5 * access(country) *
      (config.financialCenterCountries.includes(country.id) ? 1.45 : 1));
  const debt = allocate(state.nation.trade.externalDebt, state.world.countries,
    (country) => country.nominalGDP ** 0.48 * access(country) *
      (config.financialCenterCountries.includes(country.id) ? 1.7 : 0.75));
  let shippingWeighted = 0;
  let sanctionWeighted = 0;
  let renminbiWeighted = 0;
  for (const country of state.world.countries) {
    const account = network.partners[country.id];
    account.exports = exports[country.id] ?? 0;
    account.imports = imports[country.id] ?? 0;
    account.foreignDirectInvestment = investment[country.id] ?? 0;
    account.externalDebtClaims = debt[country.id] ?? 0;
    account.tradeBalance = account.exports - account.imports;
    account.marketAccessIndex = clamp(access(country) / 1.6, 0, 1);
    const relationRisk = clamp((20 - country.relationWithChina) / 180, 0, 0.7);
    account.shippingRiskIndex = clamp(
      config.baseShippingRisk + relationRisk + country.sanctionLevel * 0.5,
      0, 1,
    );
    account.sanctionExposure = country.sanctionLevel;
    account.renminbiSettlementShare = clamp(
      (state.nation.date.year < 1990 ? 0 : (state.nation.date.year - 1990) / 100) *
        (0.45 + account.marketAccessIndex * 0.55) *
        (country.tradeAgreement ? 1.2 : 1),
      0,
      config.maximumRenminbiSettlementShare,
    );
    account.usdSettlementShare = clamp(
      0.72 - account.renminbiSettlementShare * 0.65 +
        (config.financialCenterCountries.includes(country.id) ? 0.08 : 0),
      0.35, 0.85,
    );
    account.otherCurrencySettlementShare = Math.max(
      0,
      1 - account.renminbiSettlementShare - account.usdSettlementShare,
    );
    const settlementTotal = account.renminbiSettlementShare +
      account.usdSettlementShare + account.otherCurrencySettlementShare;
    account.renminbiSettlementShare /= settlementTotal;
    account.usdSettlementShare /= settlementTotal;
    account.otherCurrencySettlementShare /= settlementTotal;
    const exportShare = safeDivide(account.exports, state.nation.trade.exports);
    shippingWeighted += exportShare * account.shippingRiskIndex;
    sanctionWeighted += exportShare * account.sanctionExposure;
    renminbiWeighted += exportShare * account.renminbiSettlementShare;
  }
  const accounts = Object.values(network.partners);
  network.exportConcentrationIndex = accounts.reduce((sum, item) =>
    sum + safeDivide(item.exports, state.nation.trade.exports) ** 2, 0);
  network.importConcentrationIndex = accounts.reduce((sum, item) =>
    sum + safeDivide(item.imports, state.nation.trade.imports) ** 2, 0);
  network.topExportPartnerId = accounts.toSorted((a, b) => b.exports - a.exports)[0]?.countryId ?? null;
  network.topImportPartnerId = accounts.toSorted((a, b) => b.imports - a.imports)[0]?.countryId ?? null;
  network.averageShippingRisk = shippingWeighted;
  network.sanctionExposure = sanctionWeighted;
  network.renminbiSettlementShare = renminbiWeighted;
  const sum = (key: "exports" | "imports" | "foreignDirectInvestment" | "externalDebtClaims") =>
    accounts.reduce((total, item) => total + item[key], 0);
  network.exportError = Math.abs(sum("exports") - state.nation.trade.exports);
  network.importError = Math.abs(sum("imports") - state.nation.trade.imports);
  network.investmentError = Math.abs(sum("foreignDirectInvestment") - state.nation.trade.foreignInvestment);
  network.externalDebtError = Math.abs(sum("externalDebtClaims") - state.nation.trade.externalDebt);
  ensureTradeStructureState(state);
  updateTradeStructure(state);
}
