import penetrationConfig from "../../data/config/infrastructure-penetration.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { InfrastructurePenetrationState, NationState } from "../state/game-state";
import { ensureInfrastructureResourceState } from "../economy/energy-transport-environment";

interface PenetrationConfig {
  electricityAdjustmentSpeed: number;
  televisionAdjustmentSpeed: number;
  mobileAdjustmentSpeed: number;
  internetAdjustmentSpeed: number;
  electricityPerCapitaSaturation: number;
  electrificationStartYear: number;
  electrificationMaturityYears: number;
  televisionBroadcastStartYear: number;
  mobileCommercialStartYear: number;
  internetCommercialStartYear: number;
  electricityTargetWeights: Record<string, number>;
  televisionTargetWeights: Record<string, number>;
  mobileTargetWeights: Record<string, number>;
  internetTargetWeights: Record<string, number>;
}

const config = penetrationConfig as PenetrationConfig;

export function createEmptyInfrastructurePenetrationState(): InfrastructurePenetrationState {
  return {
    electricityPenetration: 0,
    televisionPenetration: 0,
    mobilePenetration: 0,
    internetPenetration: 0,
  };
}

function eraFactor(year: number, startYear: number): number {
  if (year < startYear) return 0;
  return clamp((year - startYear) / 12, 0, 1);
}

function incomeDevelopment(nation: NationState): number {
  return clamp(
    Math.log1p(Math.max(nation.economy.realGDPPerCapita, 0)) / Math.log(60_001),
    0,
    1,
  );
}

function hasDigitalNetworks(nation: NationState): number {
  return nation.technology.completedTechnologyIds.includes("digital_networks") ? 1 : 0.35;
}

export function calculateInfrastructurePenetrationTargets(
  nation: NationState,
): InfrastructurePenetrationState {
  ensureInfrastructureResourceState(nation);
  const { population, society, economy, education, technology, resources } = nation;
  const year = nation.date.year;
  const urbanization = society.urbanizationRate;
  const infrastructure = economy.infrastructureIndex / 100;
  const income = incomeDevelopment(nation);
  const perCapitaElectricity = safeDivide(
    resources.infrastructureResources.electricityGeneration,
    population.total,
  );
  const electricityRatio = clamp(
    nation.resources.electricity?.electricitySupplyRatio ??
      resources.energySupplyRatio,
    0,
    1.25,
  );
  const perCapitaComponent = clamp(
    perCapitaElectricity / config.electricityPerCapitaSaturation,
    0,
    1,
  );
  const supplyComponent = clamp(electricityRatio, 0, 1);
  const normalizedElectricity = perCapitaComponent * 0.62 + supplyComponent * 0.38;
  const electrificationEra = clamp(
    (year - config.electrificationStartYear) / config.electrificationMaturityYears,
    0.04,
    1,
  );
  const electricityTarget = clamp(
    (
      resources.energySupplyRatio * config.electricityTargetWeights.energySupplyRatio +
      normalizedElectricity * config.electricityTargetWeights.perCapitaElectricity +
      urbanization * config.electricityTargetWeights.urbanization +
      infrastructure * config.electricityTargetWeights.infrastructureIndex
    ) * electrificationEra,
    0,
    1,
  );
  const televisionEra = eraFactor(year, config.televisionBroadcastStartYear);
  const televisionTarget = clamp(
    (
      electricityTarget * config.televisionTargetWeights.electricity +
      urbanization * config.televisionTargetWeights.urbanization +
      income * config.televisionTargetWeights.incomeDevelopment +
      infrastructure * config.televisionTargetWeights.infrastructureIndex
    ) * televisionEra,
    0,
    1,
  );
  const mobileEra = eraFactor(year, config.mobileCommercialStartYear);
  const mobileTarget = clamp(
    (
      technology.adoptionRate * config.mobileTargetWeights.technologyAdoption +
      electricityTarget * config.mobileTargetWeights.electricity +
      income * config.mobileTargetWeights.incomeDevelopment +
      urbanization * config.mobileTargetWeights.urbanization +
      infrastructure * config.mobileTargetWeights.infrastructureIndex
    ) * mobileEra,
    0,
    1.15,
  );
  const internetEra = eraFactor(year, config.internetCommercialStartYear);
  const internetTarget = clamp(
    (
      mobileTarget * config.internetTargetWeights.mobile +
      technology.adoptionRate * config.internetTargetWeights.technologyAdoption +
      (education.index / 100) * config.internetTargetWeights.educationIndex +
      urbanization * config.internetTargetWeights.urbanization +
      income * config.internetTargetWeights.incomeDevelopment
    ) * internetEra * hasDigitalNetworks(nation),
    0,
    1,
  );
  return {
    electricityPenetration: electricityTarget,
    televisionPenetration: televisionTarget,
    mobilePenetration: mobileTarget,
    internetPenetration: internetTarget,
  };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function ensureInfrastructurePenetrationState(nation: NationState): void {
  const existing = nation.society.infrastructurePenetration as
    | Partial<InfrastructurePenetrationState> | undefined;
  const isComplete = Boolean(
    existing &&
      Number.isFinite(existing.electricityPenetration) &&
      Number.isFinite(existing.televisionPenetration) &&
      Number.isFinite(existing.mobilePenetration) &&
      Number.isFinite(existing.internetPenetration),
  );
  if (isComplete) {
    return;
  }

  const baseline = createEmptyInfrastructurePenetrationState();
  nation.society.infrastructurePenetration = {
    electricityPenetration: finiteOr(existing?.electricityPenetration, baseline.electricityPenetration),
    televisionPenetration: finiteOr(existing?.televisionPenetration, baseline.televisionPenetration),
    mobilePenetration: finiteOr(existing?.mobilePenetration, baseline.mobilePenetration),
    internetPenetration: finiteOr(existing?.internetPenetration, baseline.internetPenetration),
  };

  if (!existing) {
    updateInfrastructurePenetration(nation, true);
    return;
  }

  const targets = calculateInfrastructurePenetrationTargets(nation);
  const state = nation.society.infrastructurePenetration;
  if (!Number.isFinite(existing.electricityPenetration)) {
    state.electricityPenetration = targets.electricityPenetration * 0.85;
  }
  if (!Number.isFinite(existing.televisionPenetration)) {
    state.televisionPenetration = targets.televisionPenetration * 0.8;
  }
  if (!Number.isFinite(existing.mobilePenetration)) {
    state.mobilePenetration = targets.mobilePenetration * 0.75;
  }
  if (!Number.isFinite(existing.internetPenetration)) {
    state.internetPenetration = targets.internetPenetration * 0.7;
  }
}

/** 基础设施普及率是慢变量，按月向由能源、收入、教育与科技决定的目标收敛。 */
export function updateInfrastructurePenetration(
  nation: NationState,
  initialize = false,
): void {
  ensureInfrastructurePenetrationState(nation);
  const state = nation.society.infrastructurePenetration;
  const targets = calculateInfrastructurePenetrationTargets(nation);
  if (initialize) {
    state.electricityPenetration = targets.electricityPenetration * 0.85;
    state.televisionPenetration = targets.televisionPenetration * 0.8;
    state.mobilePenetration = targets.mobilePenetration * 0.75;
    state.internetPenetration = targets.internetPenetration * 0.7;
    return;
  }
  state.electricityPenetration = approach(
    state.electricityPenetration,
    targets.electricityPenetration,
    config.electricityAdjustmentSpeed,
  );
  state.televisionPenetration = approach(
    state.televisionPenetration,
    targets.televisionPenetration,
    config.televisionAdjustmentSpeed,
  );
  state.mobilePenetration = approach(
    state.mobilePenetration,
    targets.mobilePenetration,
    config.mobileAdjustmentSpeed,
  );
  state.internetPenetration = approach(
    state.internetPenetration,
    targets.internetPenetration,
    config.internetAdjustmentSpeed,
  );
}
