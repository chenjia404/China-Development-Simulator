import demandConfig from "../../data/config/world-trade-demand.json";
import { clamp, safeDivide } from "../core/math";
import type { GameState } from "../state/game-state";
import type { DevelopmentStage, WorldCountryState } from "../state/world-state";
import { cityStateImportAbsorptionMultiplier } from "./city-state-relations";

interface WorldTradeDemandConfig {
  importOpennessByStage: Record<DevelopmentStage, number>;
  defaultImportPropensity: number;
  relationAccessWeight: number;
  tradeAgreementAccessBonus: number;
  sanctionAccessPenalty: number;
  tradeDemandElasticity: number;
  globalDemandElasticity: number;
  foreignDemandMultiplierRange: [number, number];
  foreignDemandLogBase: number;
  foreignDemandLogScale: number;
  globalDemandLogBase: number;
  globalDemandLogScale: number;
}

const config = demandConfig as unknown as WorldTradeDemandConfig;

function countryMarketAccess(country: WorldCountryState): number {
  const relation = clamp((country.relationWithChina + 100) / 200, 0, 1);
  return Math.max(
    0.05,
    (1 + relation * config.relationAccessWeight +
      (country.tradeAgreement ? config.tradeAgreementAccessBonus : 0)) *
      (1 - country.sanctionLevel * config.sanctionAccessPenalty),
  );
}

/** 单个国家可吸收的进口需求池，受 GDP、开放度、贸易通道与制裁影响。 */
export function calculateCountryImportDemand(
  country: WorldCountryState,
): number {
  const openness = config.importOpennessByStage[country.developmentStage] ?? 0.16;
  const propensity = country.importPropensity ?? config.defaultImportPropensity;
  const cityStateWeight = cityStateImportAbsorptionMultiplier(country.cityStateRelation);
  return country.nominalGDP * openness * propensity * cityStateWeight * countryMarketAccess(country);
}

/** 全部可及外国市场的进口吸收总量。 */
export function calculateForeignImportPool(state: GameState): number {
  return state.world.countries.reduce(
    (total, country) => total + calculateCountryImportDemand(country),
    0,
  );
}

/** 由外国进口池与全球需求指数共同决定的对华出口需求乘数；指数均为 1 时返回 1。 */
export function calculateForeignExportDemandMultiplier(state: GameState): number {
  const { world } = state;
  const foreignGrowth =
    Math.log(Math.max(1, world.foreignImportDemandIndex)) /
    Math.log(config.foreignDemandLogBase) *
    config.foreignDemandLogScale;
  const globalGrowth =
    Math.log(Math.max(1, world.globalDemandIndex)) /
    Math.log(config.globalDemandLogBase) *
    config.globalDemandLogScale;
  return clamp(
    config.foreignDemandMultiplierRange[0],
    config.foreignDemandMultiplierRange[1],
    1 + foreignGrowth * 0.58 + globalGrowth * 0.42,
  );
}

/** 根据外国经济体实际增长更新全球需求与进口吸收指数。 */
export function updateForeignMarketIndices(state: GameState): void {
  const { world } = state;
  const totalForeignGDP = world.countries.reduce(
    (sum, country) => sum + country.nominalGDP,
    0,
  );
  const weightedGrowth = safeDivide(
    world.countries.reduce((sum, country) => {
      const previous = world.lastForeignNominalGDP[country.id] ?? country.nominalGDP;
      const monthlyGrowth = safeDivide(country.nominalGDP, previous, 1) - 1;
      return sum + country.nominalGDP * monthlyGrowth;
    }, 0),
    totalForeignGDP,
  );
  world.globalDemandIndex *=
    (1 + weightedGrowth * config.globalDemandElasticity) ** 1;

  const importPool = calculateForeignImportPool(state);
  const previousPool = world.foreignImportPool > 0
    ? world.foreignImportPool
    : importPool;
  const poolGrowth = safeDivide(importPool, previousPool, 1);
  world.foreignImportPool = importPool;
  world.foreignImportDemandIndex *= poolGrowth ** config.tradeDemandElasticity;

  for (const country of world.countries) {
    world.lastForeignNominalGDP[country.id] = country.nominalGDP;
  }
}

export function ensureForeignMarketState(state: GameState): void {
  const { world } = state;
  if (!Number.isFinite(world.foreignImportDemandIndex)) {
    world.foreignImportDemandIndex = 1;
  }
  if (!Number.isFinite(world.foreignImportPool) || world.foreignImportPool <= 0) {
    world.foreignImportPool = calculateForeignImportPool(state);
  }
  if (!world.lastForeignNominalGDP) {
    world.lastForeignNominalGDP = Object.fromEntries(
      world.countries.map((country) => [country.id, country.nominalGDP] as const),
    );
    return;
  }
  for (const country of world.countries) {
    world.lastForeignNominalGDP[country.id] ??= country.nominalGDP;
  }
}
