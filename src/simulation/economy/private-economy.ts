import privateEconomyConfig from "../../data/config/private-economy.json";
import { clamp } from "../core/math";
import { applyModifiers } from "../events/modifiers";
import type {
  IndustrialCategoryId,
  NationState,
  PrivateEconomyState,
} from "../state/game-state";
import { capitalMarketCapabilityGains } from "./monetary-financial";
import { economicCoordinationPrivateEconomyBias } from "./economic-coordination";

interface PrivateEconomyCapabilityMultipliers {
  investment: number;
  researchCommercialization: number;
  technologyDiffusion: number;
  exports: number;
  industrialDynamismRatio: number;
}

const initialState = privateEconomyConfig.initialState;

function finiteRatio(value: number, baseline: number): number {
  return Number.isFinite(value) && baseline > 0 ? Math.max(0, value) / baseline : 0;
}

export function createInitialPrivateEconomyState(): PrivateEconomyState {
  return { ...initialState };
}

/** 旧存档缺少字段时按开局能力确定性补齐；已有字段只做数值边界修复。 */
export function ensurePrivateEconomyState(nation: NationState): void {
  const existing = nation.privateEconomy as Partial<PrivateEconomyState> | undefined;
  nation.privateEconomy = {
    operatingSpace: clamp(
      Number.isFinite(existing?.operatingSpace)
        ? existing?.operatingSpace ?? initialState.operatingSpace
        : initialState.operatingSpace,
      0,
      1,
    ),
    entrepreneurialCapacity: clamp(
      Number.isFinite(existing?.entrepreneurialCapacity)
        ? existing?.entrepreneurialCapacity ?? initialState.entrepreneurialCapacity
        : initialState.entrepreneurialCapacity,
      0,
      1,
    ),
    technologyCommercialization: clamp(
      Number.isFinite(existing?.technologyCommercialization)
        ? existing?.technologyCommercialization ?? initialState.technologyCommercialization
        : initialState.technologyCommercialization,
      0,
      1,
    ),
    exportNetworkStrength: clamp(
      Number.isFinite(existing?.exportNetworkStrength)
        ? existing?.exportNetworkStrength ?? initialState.exportNetworkStrength
        : initialState.exportNetworkStrength,
      0,
      1,
    ),
  };
}

function monthlyChange(nation: NationState, target: string): number {
  return clamp(
    applyModifiers(nation, target, 0),
    -privateEconomyConfig.maximumMonthlyChange,
    privateEconomyConfig.maximumMonthlyChange,
  );
}

/**
 * 先结算制度变化形成的能力库存，再由投资、科研、工业和贸易模块读取。
 * 使用增量而非目标值，确保提前改革、保留混合所有制等路线能从自身基数继续发展。
 */
export function updatePrivateEconomy(nation: NationState): void {
  ensurePrivateEconomyState(nation);
  const capitalMarketGains = capitalMarketCapabilityGains(nation);
  const coordinationBias = economicCoordinationPrivateEconomyBias(nation);
  nation.privateEconomy.operatingSpace = clamp(
    nation.privateEconomy.operatingSpace + monthlyChange(
      nation,
      "privateEconomy.operatingSpaceChange",
    ) + coordinationBias.operatingSpace,
    0,
    1,
  );
  nation.privateEconomy.entrepreneurialCapacity = clamp(
    nation.privateEconomy.entrepreneurialCapacity + monthlyChange(
      nation,
      "privateEconomy.entrepreneurialCapacityChange",
    ) + capitalMarketGains.entrepreneurship +
      coordinationBias.entrepreneurialCapacity,
    0,
    1,
  );
  nation.privateEconomy.technologyCommercialization = clamp(
    nation.privateEconomy.technologyCommercialization + monthlyChange(
      nation,
      "privateEconomy.technologyCommercializationChange",
    ) + capitalMarketGains.commercialization,
    0,
    1,
  );
  nation.privateEconomy.exportNetworkStrength = clamp(
    nation.privateEconomy.exportNetworkStrength + monthlyChange(
      nation,
      "privateEconomy.exportNetworkChange",
    ),
    0,
    1,
  );
}

export function calculatePrivateEconomyMultipliers(
  nation: NationState,
): PrivateEconomyCapabilityMultipliers {
  ensurePrivateEconomyState(nation);
  const operatingRatio = finiteRatio(
    nation.privateEconomy.operatingSpace,
    initialState.operatingSpace,
  );
  const entrepreneurialRatio = finiteRatio(
    nation.privateEconomy.entrepreneurialCapacity,
    initialState.entrepreneurialCapacity,
  );
  const commercializationRatio = finiteRatio(
    nation.privateEconomy.technologyCommercialization,
    initialState.technologyCommercialization,
  );
  const exportNetworkRatio = finiteRatio(
    nation.privateEconomy.exportNetworkStrength,
    initialState.exportNetworkStrength,
  );
  const investmentCapability = Math.sqrt(operatingRatio * entrepreneurialRatio);
  const weights = privateEconomyConfig.industrialDynamismWeight;
  return {
    investment: clamp(
      privateEconomyConfig.investment.floorMultiplier +
        investmentCapability * privateEconomyConfig.investment.capabilityWeight,
      privateEconomyConfig.investment.floorMultiplier,
      privateEconomyConfig.investment.maximumMultiplier,
    ),
    researchCommercialization: clamp(
      privateEconomyConfig.technology.researchFloorMultiplier +
        commercializationRatio * privateEconomyConfig.technology.researchCapabilityWeight,
      privateEconomyConfig.technology.researchFloorMultiplier,
      privateEconomyConfig.technology.maximumResearchMultiplier,
    ),
    technologyDiffusion: clamp(
      privateEconomyConfig.technology.diffusionFloorMultiplier +
        commercializationRatio * privateEconomyConfig.technology.diffusionCapabilityWeight,
      privateEconomyConfig.technology.diffusionFloorMultiplier,
      privateEconomyConfig.technology.maximumDiffusionMultiplier,
    ),
    exports: clamp(
      privateEconomyConfig.exports.floorMultiplier +
        exportNetworkRatio * privateEconomyConfig.exports.networkWeight,
      privateEconomyConfig.exports.floorMultiplier,
      privateEconomyConfig.exports.maximumMultiplier,
    ),
    industrialDynamismRatio:
      operatingRatio * weights.operatingSpace +
      entrepreneurialRatio * weights.entrepreneurialCapacity +
      commercializationRatio * weights.technologyCommercialization,
  };
}

export function privateEconomyIndustryMultipliers(
  nation: NationState,
  industryId: IndustrialCategoryId,
): { output: number; productivity: number; exports: number } {
  const capabilities = calculatePrivateEconomyMultipliers(nation);
  const sensitivity = privateEconomyConfig.industrySensitivity[industryId];
  const dynamismDifference = capabilities.industrialDynamismRatio - 1;
  return {
    output: clamp(
      1 + dynamismDifference * sensitivity * privateEconomyConfig.industryOutputResponse,
      0.72,
      1.25,
    ),
    productivity: clamp(
      1 + dynamismDifference * sensitivity *
        privateEconomyConfig.industryProductivityResponse,
      0.76,
      1.22,
    ),
    exports: clamp(
      capabilities.exports *
        (1 + dynamismDifference * sensitivity * privateEconomyConfig.industryExportResponse),
      0.45,
      1.5,
    ),
  };
}
