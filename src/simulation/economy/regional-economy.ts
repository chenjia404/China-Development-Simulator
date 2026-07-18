import regionalData from "../../data/config/regional-economy.json";
import { clamp, safeDivide } from "../core/math";
import type {
  EconomicRegionAccount,
  EconomicRegionId,
  NationState,
  RegionalEconomyState,
} from "../state/game-state";

interface RegionDefinition {
  id: EconomicRegionId; name: string; populationShare: number;
  productivity: number; openness: number; infrastructure: number;
}
const definitions = regionalData.regions as RegionDefinition[];
export const ECONOMIC_REGION_IDS = [
  "northeast", "north_coast", "east_coast", "south_coast", "central", "west",
] as const satisfies readonly EconomicRegionId[];
export const economicRegionDefinitions = definitions.map(({ id, name }) => ({ id, name }));
const byId = new Map(definitions.map((item) => [item.id, item]));
function definition(id: EconomicRegionId): RegionDefinition {
  const found = byId.get(id);
  if (!found) throw new Error(`区域配置缺少：${id}`);
  return found;
}
function emptyRegion(id: EconomicRegionId): EconomicRegionAccount {
  return { id, population: 0, realGDP: 0, employment: 0, investment: 0,
    exports: 0, disposableIncomePerCapita: 0, urbanizationRate: 0,
    infrastructureIndex: 0, productivityIndex: 0,
    netInterregionalMigration: 0, netCapitalFlow: 0, netFiscalTransfer: 0 };
}
export function createEmptyRegionalEconomyState(): RegionalEconomyState {
  return {
    regions: {
      northeast: emptyRegion("northeast"), north_coast: emptyRegion("north_coast"),
      east_coast: emptyRegion("east_coast"), south_coast: emptyRegion("south_coast"),
      central: emptyRegion("central"), west: emptyRegion("west"),
    },
    regionalGDPPerCapitaRatio: 1, coastalGDPShare: 0,
    westernDevelopmentIndex: 0, populationError: 0, gdpError: 0,
    employmentError: 0, investmentError: 0, exportError: 0,
    migrationFlowError: 0, capitalFlowError: 0, fiscalTransferError: 0,
  };
}
export function ensureRegionalEconomyState(nation: NationState): void {
  const existing = nation.regionalEconomy as Partial<RegionalEconomyState> | undefined;
  if (existing?.regions && ECONOMIC_REGION_IDS.every((id) => existing.regions?.[id]) &&
    Number.isFinite(existing.gdpError)) return;
  nation.regionalEconomy = createEmptyRegionalEconomyState();
  updateRegionalEconomy(nation);
}
function allocate(
  total: number,
  weights: Record<EconomicRegionId, number>,
): Record<EconomicRegionId, number> {
  const weightTotal = ECONOMIC_REGION_IDS.reduce((sum, id) => sum + weights[id], 0);
  return Object.fromEntries(ECONOMIC_REGION_IDS.map(
    (id) => [id, total * safeDivide(weights[id], weightTotal)],
  )) as Record<EconomicRegionId, number>;
}

/** 守恒分配全国总量，并令跨区域人口、资本与财政流动净额分别为零。 */
export function updateRegionalEconomy(nation: NationState): void {
  if (!nation.regionalEconomy?.regions) {
    nation.regionalEconomy = createEmptyRegionalEconomyState();
  }
  const state = nation.regionalEconomy;
  const thirdFrontActive = nation.modifiers.some((item) =>
    item.sourceId === "third_front_construction_1964"
  );
  const populationWeights = Object.fromEntries(ECONOMIC_REGION_IDS.map((id) => {
    const item = definition(id);
    const inlandBonus = thirdFrontActive && (id === "west" || id === "central") ? 0.08 : 0;
    return [id, item.populationShare * (1 + inlandBonus)];
  })) as Record<EconomicRegionId, number>;
  const populations = allocate(nation.population.total, populationWeights);
  const gdpWeights = Object.fromEntries(ECONOMIC_REGION_IDS.map((id) => {
    const item = definition(id);
    const coastalLearning = ["north_coast", "east_coast", "south_coast"].includes(id)
      ? nation.trade.openness * item.openness * 0.22 : 0;
    const inlandInfrastructure = (id === "west" || id === "central") && thirdFrontActive ? 0.16 : 0;
    return [id, populations[id] * item.productivity *
      (0.7 + nation.economy.infrastructureIndex / 100 * item.infrastructure * 0.3 +
        coastalLearning + inlandInfrastructure)];
  })) as Record<EconomicRegionId, number>;
  const gdps = allocate(nation.economy.realGDP, gdpWeights);
  const employmentWeights = Object.fromEntries(ECONOMIC_REGION_IDS.map(
    (id) => [id, populations[id] * (0.9 + definition(id).productivity * 0.1)],
  )) as Record<EconomicRegionId, number>;
  const employments = allocate(nation.labor.employed, employmentWeights);
  const investmentWeights = Object.fromEntries(ECONOMIC_REGION_IDS.map(
    (id) => [id, gdps[id] * (0.75 + definition(id).infrastructure * 0.25)],
  )) as Record<EconomicRegionId, number>;
  const investments = allocate(nation.economy.investment, investmentWeights);
  const exportWeights = Object.fromEntries(ECONOMIC_REGION_IDS.map(
    (id) => [id, gdps[id] * definition(id).openness],
  )) as Record<EconomicRegionId, number>;
  const exports = allocate(nation.trade.exports, exportWeights);
  const nationalIncomePerCapita = safeDivide(
    nation.economy.householdDisposableIncome, nation.population.total,
  );
  let rawMigrationTotal = 0;
  let rawCapitalTotal = 0;
  let rawFiscalTotal = 0;
  for (const id of ECONOMIC_REGION_IDS) {
    const account = state.regions[id];
    const item = definition(id);
    account.population = populations[id];
    account.realGDP = gdps[id];
    account.employment = employments[id];
    account.investment = investments[id];
    account.exports = exports[id];
    account.productivityIndex = safeDivide(gdps[id] / populations[id], nation.economy.realGDPPerCapita, 1);
    account.disposableIncomePerCapita = nationalIncomePerCapita *
      (0.72 + account.productivityIndex * 0.28);
    account.infrastructureIndex = clamp(
      nation.economy.infrastructureIndex * item.infrastructure, 0, 100,
    );
    account.urbanizationRate = clamp(
      nation.society.urbanizationRate * (0.78 + item.productivity * 0.22), 0, 1,
    );
    account.netInterregionalMigration = populations[id] *
      (account.productivityIndex - 1) * 0.004;
    account.netCapitalFlow = nation.economy.investment *
      (safeDivide(investments[id], nation.economy.investment) -
        safeDivide(gdps[id], nation.economy.realGDP));
    account.netFiscalTransfer = nation.fiscal.federalism.centralToLocalTransfers *
      (safeDivide(populations[id], nation.population.total) -
        safeDivide(gdps[id], nation.economy.realGDP));
    rawMigrationTotal += account.netInterregionalMigration;
    rawCapitalTotal += account.netCapitalFlow;
    rawFiscalTotal += account.netFiscalTransfer;
  }
  for (const id of ECONOMIC_REGION_IDS) {
    const populationShare = safeDivide(state.regions[id].population, nation.population.total);
    state.regions[id].netInterregionalMigration -= rawMigrationTotal * populationShare;
    state.regions[id].netCapitalFlow -= rawCapitalTotal * populationShare;
    state.regions[id].netFiscalTransfer -= rawFiscalTotal * populationShare;
  }
  const sum = (key: "population" | "realGDP" | "employment" | "investment" | "exports" | "netInterregionalMigration" | "netCapitalFlow" | "netFiscalTransfer") =>
    ECONOMIC_REGION_IDS.reduce((total, id) => total + state.regions[id][key], 0);
  state.populationError = Math.abs(sum("population") - nation.population.total);
  state.gdpError = Math.abs(sum("realGDP") - nation.economy.realGDP);
  state.employmentError = Math.abs(sum("employment") - nation.labor.employed);
  state.investmentError = Math.abs(sum("investment") - nation.economy.investment);
  state.exportError = Math.abs(sum("exports") - nation.trade.exports);
  state.migrationFlowError = Math.abs(sum("netInterregionalMigration"));
  state.capitalFlowError = Math.abs(sum("netCapitalFlow"));
  state.fiscalTransferError = Math.abs(sum("netFiscalTransfer"));
  const perCapita = ECONOMIC_REGION_IDS.map((id) => safeDivide(
    state.regions[id].realGDP, state.regions[id].population,
  ));
  state.regionalGDPPerCapitaRatio = Math.max(...perCapita) /
    Math.max(1, Math.min(...perCapita));
  state.coastalGDPShare = safeDivide(
    state.regions.north_coast.realGDP + state.regions.east_coast.realGDP +
      state.regions.south_coast.realGDP,
    nation.economy.realGDP,
  );
  state.westernDevelopmentIndex = (
    state.regions.west.productivityIndex +
    state.regions.west.infrastructureIndex / 100 +
    state.regions.west.urbanizationRate
  ) / 3;
}
