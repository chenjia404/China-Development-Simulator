import electricityConfig from "../../data/config/electricity-system.json";
import resourceData from "../../data/config/energy-transport-environment.json";
import industryConfigs from "../../data/config/industries.json";
import { clamp, safeDivide } from "../core/math";
import type {
  ElectricityBreakdown,
  ElectricitySystemState,
  EnergySourceId,
  NationState,
} from "../state/game-state";
import { normalizedEnergyShares } from "./energy-transport-environment";
import { calculateIndustrialPolicyAggregateEffects } from "../policies/industrial-policy";
import { technologyIndustryEnergyDemandMultiplier } from "../technology/technology-industry-path";

interface ElectricitySystemConfig {
  demandPerEnergyUnit: number;
  initialTotalCapacity: number;
  monthlyCapacityDepreciationRate: number;
  capacityPerInfrastructureBillion: number;
  capacityPerMiningBillion: number;
  capacityPerElectricalEquipmentBillion: number;
  powerSectorFuelShare: number;
  minimumSupplyRatio: number;
  maximumSupplyRatio: number;
  shortageProductionSensitivity: number;
  shortageInflationWeight: number;
  shortageWellbeingWeight: number;
  capacityFactors: Record<EnergySourceId, number>;
  consumptionSectorWeights: Record<string, number>;
  residentialDemandFactors: Record<string, number>;
  industrialDemandFactors: Record<string, number>;
  commercialDemandFactors: Record<string, number>;
  agriculturalDemandFactors: Record<string, number>;
}

interface ResourceConfig {
  electricityPerEnergyUnit: number;
  baseGridLossRate: number;
  minimumGridLossRate: number;
}

const config = electricityConfig as ElectricitySystemConfig;
const resourceConfig = resourceData as ResourceConfig;
const SOURCE_IDS = [
  "coal", "oil", "gas", "hydro", "nuclear", "renewables",
] as const satisfies readonly EnergySourceId[];

function emptyBreakdown(): ElectricityBreakdown {
  return {
    coal: 0,
    oil: 0,
    gas: 0,
    hydro: 0,
    nuclear: 0,
    renewables: 0,
  };
}

export function createEmptyElectricitySystemState(): ElectricitySystemState {
  return {
    capacity: emptyBreakdown(),
    generation: emptyBreakdown(),
    consumption: {
      residential: 0,
      industrial: 0,
      commercial: 0,
      agriculture: 0,
    },
    grossGeneration: 0,
    gridLosses: 0,
    netGeneration: 0,
    totalConsumption: 0,
    electricityDemand: 0,
    electricitySupplyRatio: 1,
    capacityUtilization: 0,
    reserveMargin: 0,
    perCapitaConsumption: 0,
    unmetDemand: 0,
    balanceError: 0,
  };
}

function incomeDevelopment(nation: NationState): number {
  return clamp(
    Math.log1p(Math.max(nation.economy.realGDPPerCapita, 0)) / Math.log(60_001),
    0,
    1,
  );
}

function gridLossRate(nation: NationState): number {
  return clamp(
    resourceConfig.baseGridLossRate -
      nation.economy.infrastructureIndex / 100 * 0.085,
    resourceConfig.minimumGridLossRate,
    resourceConfig.baseGridLossRate,
  );
}

function distributeByShares(
  total: number,
  shares: Record<EnergySourceId, number>,
): ElectricityBreakdown {
  const breakdown = emptyBreakdown();
  for (const id of SOURCE_IDS) {
    breakdown[id] = total * shares[id];
  }
  return breakdown;
}

function capacityLimitedGeneration(
  capacity: ElectricityBreakdown,
  infrastructureIndex: number,
): number {
  const maintenanceFactor = clamp(0.82 + infrastructureIndex / 100 * 0.16, 0.7, 0.98);
  return SOURCE_IDS.reduce((sum, id) => {
    return sum + capacity[id] * config.capacityFactors[id] * maintenanceFactor;
  }, 0);
}

function updateCapacityStock(nation: NationState, shares: Record<EnergySourceId, number>): void {
  const state = nation.resources.electricity;
  const infrastructureSpend =
    nation.fiscal.expenditure * nation.fiscal.budget.infrastructure;
  const miningOutput = nation.industries.mining_energy.valueAdded;
  const electricalOutput = nation.industries.electrical_equipment.valueAdded;
  const monthlyAddition =
    infrastructureSpend / 1_000_000_000 * config.capacityPerInfrastructureBillion +
    miningOutput / 1_000_000_000 * config.capacityPerMiningBillion +
    electricalOutput / 1_000_000_000 * config.capacityPerElectricalEquipmentBillion;

  for (const id of SOURCE_IDS) {
    const opening = state.capacity[id];
    state.capacity[id] = Math.max(
      0,
      opening * (1 - config.monthlyCapacityDepreciationRate) +
        monthlyAddition * shares[id],
    );
  }
}

function computeConsumption(nation: NationState): ElectricitySystemState["consumption"] {
  const structuralDemand = Math.max(
    0,
    nation.resources.energyDemand * config.demandPerEnergyUnit,
  );
  const weights = config.consumptionSectorWeights;
  const residentialFactors = config.residentialDemandFactors;
  const industrialFactors = config.industrialDemandFactors;
  const commercialFactors = config.commercialDemandFactors;
  const agriculturalFactors = config.agriculturalDemandFactors;
  const urbanization = nation.society.urbanizationRate;
  const income = incomeDevelopment(nation);
  const penetration = nation.society.infrastructurePenetration.electricityPenetration;
  const secondaryScale = safeDivide(
    nation.sectors.secondary.output,
    industryConfigs.secondary.baselineOutput,
    1,
  );
  const tertiaryScale = safeDivide(
    nation.sectors.tertiary.output,
    industryConfigs.tertiary.baselineOutput,
    1,
  );
  const primaryScale = safeDivide(
    nation.sectors.primary.output,
    industryConfigs.primary.baselineOutput,
    1,
  );
  const industrialPolicy = calculateIndustrialPolicyAggregateEffects(nation);
  const technologyEnergy = technologyIndustryEnergyDemandMultiplier(nation);
  const digitalization = clamp(
    nation.society.infrastructurePenetration.internetPenetration * 0.55 +
      nation.society.infrastructurePenetration.mobilePenetration * 0.45,
    0,
    1.15,
  );

  const residentialFactor = clamp(
    residentialFactors.baseLevel +
      urbanization * residentialFactors.urbanization +
      income * residentialFactors.incomeDevelopment +
      penetration * residentialFactors.electricityPenetration,
    0.25,
    1.45,
  );
  const industrialFactor = clamp(
    0.55 +
      (secondaryScale - 1) * industrialFactors.secondaryOutputElasticity +
      Math.max(0, technologyEnergy - 1) * industrialFactors.energyIntensityElasticity +
      Math.max(0, industrialPolicy.energyDemandMultiplier - 1) *
        industrialFactors.policyElasticity,
    0.35,
    1.8,
  );
  const commercialFactor = clamp(
    0.55 +
      (tertiaryScale - 1) * commercialFactors.tertiaryOutputElasticity +
      urbanization * commercialFactors.urbanization +
      digitalization * commercialFactors.digitalization,
    0.35,
    1.7,
  );
  const agriculturalFactor = clamp(
    0.45 +
      (primaryScale - 1) * agriculturalFactors.primaryOutputElasticity +
      nation.resources.agriculture.mechanizationRate *
        agriculturalFactors.mechanization +
      nation.resources.agriculture.irrigatedLandRate * agriculturalFactors.irrigation,
    0.3,
    1.5,
  );

  return {
    residential: structuralDemand * weights.residential * residentialFactor,
    industrial: structuralDemand * weights.industrial * industrialFactor,
    commercial: structuralDemand * weights.commercial * commercialFactor,
    agriculture: structuralDemand * weights.agriculture * agriculturalFactor,
  };
}

export function ensureElectricitySystemState(nation: NationState): void {
  const existing = nation.resources.electricity as Partial<ElectricitySystemState> | undefined;
  if (
    existing &&
    existing.capacity &&
    SOURCE_IDS.every((id) => Number.isFinite(existing.capacity?.[id])) &&
    Number.isFinite(existing.balanceError)
  ) {
    return;
  }
  nation.resources.electricity = createEmptyElectricitySystemState();
  updateElectricitySystem(nation, true);
}

/** 按月结算发电装机、分部门用电与电力供需平衡，并反馈宏观能源约束。 */
export function updateElectricitySystem(nation: NationState, initialize = false): void {
  if (!nation.resources.electricity?.capacity) {
    nation.resources.electricity = createEmptyElectricitySystemState();
    initialize = true;
  }
  const state = nation.resources.electricity;
  const shares = normalizedEnergyShares(nation);

  if (initialize || SOURCE_IDS.reduce((sum, id) => sum + state.capacity[id], 0) <= 0) {
    state.capacity = distributeByShares(config.initialTotalCapacity, shares);
  } else if (!initialize) {
    updateCapacityStock(nation, shares);
  }

  const capacityGeneration = capacityLimitedGeneration(
    state.capacity,
    nation.economy.infrastructureIndex,
  );
  const fuelLimitedGeneration = Math.max(
    0,
    nation.resources.energySupply *
      resourceConfig.electricityPerEnergyUnit *
      config.powerSectorFuelShare,
  );
  const grossGeneration = Math.min(capacityGeneration, fuelLimitedGeneration);
  state.generation = distributeByShares(grossGeneration, shares);
  state.grossGeneration = grossGeneration;

  const lossRate = gridLossRate(nation);
  state.gridLosses = grossGeneration * lossRate;
  state.netGeneration = Math.max(0, grossGeneration - state.gridLosses);

  state.consumption = computeConsumption(nation);
  state.totalConsumption =
    state.consumption.residential +
    state.consumption.industrial +
    state.consumption.commercial +
    state.consumption.agriculture;
  state.electricityDemand = Math.max(1, state.totalConsumption);
  state.electricitySupplyRatio = clamp(
    safeDivide(state.netGeneration, state.electricityDemand),
    config.minimumSupplyRatio,
    config.maximumSupplyRatio,
  );
  state.unmetDemand = Math.max(
    0,
    state.totalConsumption - state.netGeneration,
  );
  state.reserveMargin = clamp(
    safeDivide(state.netGeneration, state.totalConsumption) - 1,
    -0.95,
    0.5,
  );
  state.capacityUtilization = clamp(
    safeDivide(grossGeneration, Math.max(capacityGeneration, 1)),
    0,
    1.2,
  );
  state.perCapitaConsumption = safeDivide(
    state.totalConsumption,
    nation.population.total,
  );
  state.balanceError = Math.abs(
    SOURCE_IDS.reduce((sum, id) => sum + state.generation[id], 0) - grossGeneration,
  ) / Math.max(grossGeneration, 1);
}

export function effectiveEnergySupplyRatio(nation: NationState): number {
  const electricityRatio = nation.resources.electricity?.electricitySupplyRatio;
  if (!Number.isFinite(electricityRatio) || electricityRatio >= 0.85) {
    return nation.resources.energySupplyRatio;
  }
  return clamp(
    nation.resources.energySupplyRatio * 0.85 + electricityRatio * 0.15,
    config.minimumSupplyRatio,
    config.maximumSupplyRatio,
  );
}

export function electricityProductionModifier(nation: NationState): number {
  const ratio = nation.resources.electricity?.electricitySupplyRatio ??
    nation.resources.energySupplyRatio;
  if (ratio >= 0.85) {
    return 1;
  }
  return clamp(
    1 - Math.max(0, 1 - ratio) * config.shortageProductionSensitivity,
    0.45,
    1.02,
  );
}

export function electricityInflationPressure(nation: NationState): number {
  const ratio = nation.resources.electricity?.electricitySupplyRatio ?? 1;
  return Math.max(0, 1 - ratio) * config.shortageInflationWeight;
}

export function electricityWellbeingPenalty(nation: NationState): number {
  const ratio = nation.resources.electricity?.electricitySupplyRatio ?? 1;
  return Math.max(0, 1 - ratio) * config.shortageWellbeingWeight;
}
