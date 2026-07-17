import economyConfig from "../../data/config/economy.json";
import industryConfigs from "../../data/config/industries.json";
import { approach, clamp, safeDivide } from "../core/math";
import type {
  NationState,
  SectorId,
  SectorState,
} from "../state/game-state";
import { applyModifiers } from "../events/modifiers";

export interface ProductionInput {
  productivity: number;
  capital: number;
  labor: number;
  humanCapital: number;
  capitalElasticity: number;
  laborElasticity: number;
  humanCapitalElasticity: number;
}

export function calculateBaseOutput(input: ProductionInput): number {
  if (
    input.productivity <= 0 ||
    input.capital <= 0 ||
    input.labor <= 0 ||
    input.humanCapital <= 0
  ) {
    return 0;
  }
  return (
    input.productivity *
    input.capital ** input.capitalElasticity *
    input.labor ** input.laborElasticity *
    input.humanCapital ** input.humanCapitalElasticity
  );
}

function normalizedBaseOutput(id: SectorId, sector: SectorState, humanCapital: number): number {
  const config = industryConfigs[id];
  return (
    config.baselineOutput *
    (sector.productivity / config.baselineProductivity) *
    (sector.capitalStock / config.baselineCapital) ** config.capitalElasticity *
    (sector.laborForce / config.baselineLabor) ** config.laborElasticity *
    (Math.max(humanCapital, 0.1) / config.baselineHumanCapital) **
      config.humanCapitalElasticity
  );
}

function resourceModifier(supplyRatio: number, sensitivity: number): number {
  return clamp(1 - Math.max(0, 1 - supplyRatio) * sensitivity, 0.3, 1.03);
}

export function calculateSectorOutput(
  id: SectorId,
  sector: SectorState,
  nation: NationState,
): number {
  const config = industryConfigs[id];
  const infrastructureModifier = clamp(
    0.96 +
      (nation.economy.infrastructureIndex / 100) *
        config.infrastructureSensitivity * 0.5,
    0.45,
    1.2,
  );
  const energyModifier = resourceModifier(
    nation.resources.energySupplyRatio,
    config.energySensitivity,
  );
  const foodModifier =
    id === "primary"
      ? resourceModifier(nation.resources.foodSupplyRatio, 0.45)
      : 1;
  const institutionModifier = clamp(
    0.9 + nation.economy.institutionalEfficiency * 0.3,
    0.5,
    1.2,
  );
  const stabilityModifier = clamp(
    0.85 + nation.society.stabilityIndex / 320,
    0.4,
    1.05,
  );
  const output =
    normalizedBaseOutput(id, sector, nation.economy.humanCapitalIndex) *
    energyModifier *
    foodModifier *
    infrastructureModifier *
    institutionModifier *
    stabilityModifier *
    clamp(
      sector.capacityUtilization / 0.75,
      economyConfig.minimumCapacityUtilization,
      economyConfig.maximumCapacityUtilization,
    );

  return Math.max(
    0,
    applyModifiers(nation, `sector.${id}.output`, output),
  );
}

export function allocateLabor(nation: NationState): void {
  const urbanization = nation.society.urbanizationRate;
  const education = nation.education.index / 100;
  const industrialShift = nation.policies.includes("industry_priority") ? 0.2 : 0;
  const primaryShare = clamp(
    0.82 - urbanization * 0.88 - industrialShift * 0.15,
    0.08,
    0.78,
  );
  const tertiaryShare = clamp(
    0.08 +
      urbanization * 0.46 +
      education * 0.18 -
      industrialShift * 0.85,
    0.08,
    0.68,
  );
  const secondaryShare = Math.max(0.08, 1 - primaryShare - tertiaryShare);
  const totalShares = primaryShare + secondaryShare + tertiaryShare;
  const targets: Record<SectorId, number> = {
    primary: nation.labor.employed * primaryShare / totalShares,
    secondary: nation.labor.employed * secondaryShare / totalShares,
    tertiary: nation.labor.employed * tertiaryShare / totalShares,
  };

  for (const id of Object.keys(targets) as SectorId[]) {
    const sector = nation.sectors[id];
    sector.laborForce = approach(
      sector.laborForce,
      targets[id],
      economyConfig.laborAllocationSpeed,
    );
    sector.employment = sector.laborForce;
  }
}

export function updateResourceSupply(nation: NationState): void {
  const primaryScale = safeDivide(
    nation.sectors.primary.output,
    industryConfigs.primary.baselineOutput,
    1,
  );
  const secondaryCapitalScale =
    nation.sectors.secondary.capitalStock /
    industryConfigs.secondary.baselineCapital;
  nation.resources.foodProduction = applyModifiers(
    nation,
    "resources.foodSupply",
    113_000_000 * Math.max(0.2, primaryScale),
  );
  nation.resources.foodDemand = nation.population.total * 0.225;
  nation.resources.foodSupplyRatio = clamp(
    safeDivide(nation.resources.foodProduction, nation.resources.foodDemand),
    0.1,
    1.3,
  );
  nation.resources.energySupply = applyModifiers(
    nation,
    "resources.energySupply",
    24 *
      secondaryCapitalScale ** 0.72 *
      (0.88 + nation.technology.index / 100 * 0.8),
  );
  nation.resources.energyDemand = Math.max(
    1,
    8 + nation.sectors.secondary.output / 2_000_000_000,
  );
  nation.resources.energySupplyRatio = clamp(
    safeDivide(nation.resources.energySupply, nation.resources.energyDemand),
    0.1,
    1.25,
  );
}

export function calculateIndustryOutputs(nation: NationState): void {
  for (const id of Object.keys(nation.sectors) as SectorId[]) {
    const sector = nation.sectors[id];
    sector.output = calculateSectorOutput(id, sector, nation);
    sector.valueAdded = sector.output * industryConfigs[id].valueAddedRatio;
    sector.averageWage = safeDivide(sector.valueAdded * 0.45, sector.employment);
  }
}
