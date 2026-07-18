import resourceData from "../../data/config/energy-transport-environment.json";
import { clamp, safeDivide } from "../core/math";
import type {
  EnergySourceAccount,
  EnergySourceId,
  InfrastructureResourceState,
  NationState,
} from "../state/game-state";

interface ResourceConfig {
  electricityPerEnergyUnit: number;
  baseGridLossRate: number;
  minimumGridLossRate: number;
  initialRailNetworkKm: number;
  initialHighwayNetworkKm: number;
  emissionFactors: Record<EnergySourceId, number>;
}
const config = resourceData as ResourceConfig;
export const ENERGY_SOURCE_IDS = [
  "coal", "oil", "gas", "hydro", "nuclear", "renewables",
] as const satisfies readonly EnergySourceId[];

function source(id: EnergySourceId, share: number): EnergySourceAccount {
  return { id, share, supply: 0, importShare: 0, emissionFactor: config.emissionFactors[id] };
}

export function createEmptyInfrastructureResourceState(): InfrastructureResourceState {
  return {
    energyMix: {
      coal: source("coal", 0.78), oil: source("oil", 0.07),
      gas: source("gas", 0.01), hydro: source("hydro", 0.13),
      nuclear: source("nuclear", 0), renewables: source("renewables", 0.01),
    },
    totalPrimaryEnergy: 0, electricityGeneration: 0, gridLossRate: 0.14,
    energyImportDependence: 0, railNetworkKm: config.initialRailNetworkKm,
    highwayNetworkKm: config.initialHighwayNetworkKm, portThroughputTonnes: 0,
    freightDemand: 0, freightCapacity: 0, freightCapacityUtilization: 0,
    logisticsEfficiencyIndex: 10, carbonEmissions: 0, carbonIntensity: 0,
    annualEmissionChange: 0, airPollutionIndex: 0, waterStressIndex: 0,
    resourceDepletionIndex: 0, energyShareError: 0,
  };
}

export function ensureInfrastructureResourceState(nation: NationState): void {
  const existing = nation.resources.infrastructureResources as
    | Partial<InfrastructureResourceState> | undefined;
  if (existing?.energyMix && ENERGY_SOURCE_IDS.every((id) => existing.energyMix?.[id]) &&
    Number.isFinite(existing.energyShareError)) return;
  nation.resources.infrastructureResources = createEmptyInfrastructureResourceState();
  updateInfrastructureResources(nation, true);
}

function normalizedShares(nation: NationState): Record<EnergySourceId, number> {
  const development = clamp(
    Math.log1p(nation.economy.realGDPPerCapita) / Math.log(60_001), 0, 1,
  );
  const technology = nation.technology.index / 100;
  const greenPath = nation.technology.developmentPathId === "green_electrification";
  const scores: Record<EnergySourceId, number> = {
    coal: Math.max(0.12, 0.82 - development * 0.52 - (greenPath ? 0.18 : 0)),
    oil: 0.06 + development * 0.1,
    gas: 0.008 + development * 0.09,
    hydro: 0.12 + technology * 0.03,
    nuclear: Math.max(0, technology - 0.35) * 0.12,
    renewables: 0.01 + technology * 0.12 + (greenPath ? 0.22 : 0),
  };
  const total = ENERGY_SOURCE_IDS.reduce((sum, id) => sum + scores[id], 0);
  return Object.fromEntries(ENERGY_SOURCE_IDS.map((id) => [id, scores[id] / total])) as
    Record<EnergySourceId, number>;
}

/** 细分既有能源供需并核算运输与环境压力，不重复修改宏观能源总量。 */
export function updateInfrastructureResources(nation: NationState, initialize = false): void {
  if (!nation.resources.infrastructureResources?.energyMix) {
    nation.resources.infrastructureResources = createEmptyInfrastructureResourceState();
    initialize = true;
  }
  const state = nation.resources.infrastructureResources;
  const shares = normalizedShares(nation);
  const development = clamp(
    Math.log1p(nation.economy.realGDPPerCapita) / Math.log(60_001), 0, 1,
  );
  state.totalPrimaryEnergy = Math.max(0, nation.resources.energySupply);
  let weightedEmissions = 0;
  for (const id of ENERGY_SOURCE_IDS) {
    const account = state.energyMix[id];
    account.share = shares[id];
    account.supply = state.totalPrimaryEnergy * account.share;
    account.importShare = id === "oil" || id === "gas"
      ? clamp(development * 0.45 + nation.trade.openness * 0.12, 0, 0.75)
      : id === "coal" ? clamp(development * 0.08, 0, 0.12) : 0;
    weightedEmissions += account.supply * account.emissionFactor;
  }
  state.energyShareError = Math.abs(
    ENERGY_SOURCE_IDS.reduce((sum, id) => sum + state.energyMix[id].share, 0) - 1,
  );
  state.energyImportDependence = safeDivide(
    ENERGY_SOURCE_IDS.reduce(
      (sum, id) => sum + state.energyMix[id].supply * state.energyMix[id].importShare,
      0,
    ),
    state.totalPrimaryEnergy,
  );
  state.gridLossRate = clamp(
    config.baseGridLossRate - nation.economy.infrastructureIndex / 100 * 0.085,
    config.minimumGridLossRate,
    config.baseGridLossRate,
  );
  state.electricityGeneration = state.totalPrimaryEnergy *
    config.electricityPerEnergyUnit * (1 - state.gridLossRate);
  const infrastructureScale = 1 + nation.economy.infrastructureIndex / 100 * 8 +
    nation.date.elapsedMonths / 12 * 0.025;
  state.railNetworkKm = config.initialRailNetworkKm * infrastructureScale;
  state.highwayNetworkKm = config.initialHighwayNetworkKm * infrastructureScale ** 1.25;
  state.portThroughputTonnes = Math.max(0, nation.trade.exports + nation.trade.imports) /
    1_000 * (0.8 + nation.trade.openness);
  state.freightDemand = Math.max(1, nation.sectors.primary.output * 0.35 +
    nation.sectors.secondary.output * 0.7 + state.portThroughputTonnes);
  state.freightCapacity = Math.max(1, (state.railNetworkKm * 22_000 +
    state.highwayNetworkKm * 7_500) *
    (0.55 + nation.economy.infrastructureIndex / 100));
  state.freightCapacityUtilization = clamp(
    safeDivide(state.freightDemand, state.freightCapacity), 0, 1.5,
  );
  state.logisticsEfficiencyIndex = clamp(
    18 + nation.economy.infrastructureIndex * 0.62 +
      nation.economy.institutionalEfficiency * 18 -
      Math.max(0, state.freightCapacityUtilization - 0.85) * 25,
    0, 100,
  );
  const previousEmissions = state.carbonEmissions;
  state.carbonEmissions = weightedEmissions;
  state.carbonIntensity = safeDivide(state.carbonEmissions, nation.economy.realGDP);
  state.annualEmissionChange = initialize || previousEmissions <= 0
    ? 0 : (state.carbonEmissions / previousEmissions - 1) * 12;
  const fossilShare = shares.coal + shares.oil + shares.gas;
  state.airPollutionIndex = clamp(
    fossilShare * 78 + state.freightCapacityUtilization * 10 - development * 12,
    0, 100,
  );
  state.waterStressIndex = clamp(
    nation.population.total / 1_500_000_000 * 0.35 +
      nation.sectors.secondary.output / Math.max(nation.economy.realGDP, 1) * 0.4 +
      nation.resources.agriculture.irrigatedLandRate * 0.25,
    0, 1,
  );
  state.resourceDepletionIndex = clamp(
    shares.coal * 0.42 + shares.oil * 0.36 + shares.gas * 0.18 +
      nation.resources.energyDemand / Math.max(state.totalPrimaryEnergy, 1) * 0.08,
    0, 1,
  );
}
