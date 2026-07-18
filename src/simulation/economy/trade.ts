import economyConfig from "../../data/config/economy.json";
import { approach, clamp, safeDivide } from "../core/math";
import { organizationTradeMultiplier } from "../diplomacy/diplomacy";
import { applyPolicyModifiers } from "../policies/policy-engine";
import type { GameState } from "../state/game-state";
import { applyModifiers } from "../events/modifiers";
import { diplomaticStrategyEffects } from "../diplomacy/diplomatic-strategy";
import { reserveImportCapacityMultiplier } from "./foreign-exchange";
import { calculateTechnologyTreeMetrics } from "../technology/technology-tree";
import {
  allocateIndustrialExports,
  calculateIndustrialStructureMetrics,
} from "./industrial-structure";
import { calculatePrivateEconomyMultipliers } from "./private-economy";

export interface TradeAccessMetrics {
  weightedRelation: number;
  agreementExposure: number;
  strategicExposure: number;
  sanctionExposure: number;
  marketAccessMultiplier: number;
}

export function calculateTradeAccess(state: GameState): TradeAccessMetrics {
  const strategyEffects = diplomaticStrategyEffects(state.nation);
  const totalForeignGDP = state.world.countries.reduce(
    (sum, country) => sum + country.nominalGDP,
    0,
  );
  const weighted = (getValue: (country: GameState["world"]["countries"][number]) => number) =>
    safeDivide(
      state.world.countries.reduce(
        (sum, country) => sum + country.nominalGDP * getValue(country),
        0,
      ),
      totalForeignGDP,
    );
  const weightedRelation = weighted((country) => country.relationWithChina);
  const agreementExposure = weighted((country) => country.tradeAgreement ? 1 : 0);
  const strategicExposure = weighted((country) =>
    country.diplomaticStatus === "strategic_partner" ? 1 : 0,
  );
  const sanctionExposure = weighted((country) => country.sanctionLevel);
  const marketAccessMultiplier = clamp(
    (1 + weightedRelation / 250 + agreementExposure * 0.2 + strategicExposure * 0.12) *
      (1 - sanctionExposure * 0.75) *
      organizationTradeMultiplier(state) *
      strategyEffects.marketAccessMultiplier,
    0.15,
    1.8,
  );
  return {
    weightedRelation,
    agreementExposure,
    strategicExposure,
    sanctionExposure,
    marketAccessMultiplier,
  };
}

export function updateInternationalTrade(state: GameState): void {
  const { nation, world } = state;
  const access = calculateTradeAccess(state);
  const strategyEffects = diplomaticStrategyEffects(nation);
  const privateEconomy = calculatePrivateEconomyMultipliers(nation);
  const secondaryShare = safeDivide(
    nation.sectors.secondary.valueAdded,
    nation.economy.realGDP,
  );
  const tertiaryShare = safeDivide(
    nation.sectors.tertiary.valueAdded,
    nation.economy.realGDP,
  );
  const exportCapacityShare = clamp(
    secondaryShare *
      (0.32 + calculateIndustrialStructureMetrics(nation).exportCapability * 0.62) +
      tertiaryShare * 0.15,
    0.1,
    0.4,
  );
  const basicMarketAccess = 0.15 + nation.trade.openness * 0.85;
  const effectiveIndustrialTechnology = calculateTechnologyTreeMetrics(nation)
    .effectiveIndustrialTechnology;
  const competitiveness = clamp(
    0.42 +
      effectiveIndustrialTechnology / 180 +
      nation.economy.infrastructureIndex / 250,
    0.4,
    1.35,
  ) * privateEconomy.exports;
  const globalDemand = clamp(
    0.9 + Math.log(Math.max(1, world.globalDemandIndex)) / Math.log(8) * 0.25,
    0.85,
    1.2,
  );
  const policyCompetitiveness = applyModifiers(
    nation,
    "trade.exportCompetitiveness",
    applyPolicyModifiers(
      nation,
      "trade.exportCompetitiveness",
      competitiveness,
    ),
  );
  const unconstrainedTargetExports = Math.max(
    0,
    nation.economy.nominalGDP *
      exportCapacityShare *
      basicMarketAccess *
      policyCompetitiveness *
      globalDemand *
      access.marketAccessMultiplier,
  );
  const targetExports = Math.min(
    unconstrainedTargetExports,
    nation.economy.nominalGDP * economyConfig.maximumExportShareOfGDP,
  );

  const foodGap = Math.max(0, 1 - nation.resources.foodSupplyRatio);
  const energyGap = Math.max(0, 1 - nation.resources.energySupplyRatio);
  const resourceImportPressure = 1 + (foodGap + energyGap) * 0.5;
  const targetImports = Math.max(
    0,
    nation.economy.nominalGDP *
      (0.012 + nation.trade.openness * 0.11) *
      resourceImportPressure *
      clamp(access.marketAccessMultiplier, 0.35, 1.35) *
      reserveImportCapacityMultiplier(nation),
  );

  nation.trade.exports = approach(nation.trade.exports, targetExports, 0.04);
  nation.trade.imports = approach(nation.trade.imports, targetImports, 0.04);
  nation.trade.balance = nation.trade.exports - nation.trade.imports;
  allocateIndustrialExports(nation);

  const investmentConfidence = clamp(
    1 +
      access.weightedRelation / 300 +
      access.agreementExposure * 0.12 +
      access.strategicExposure * 0.08 -
      access.sanctionExposure * 0.7,
    0.15,
    1.45,
  );
  nation.trade.foreignInvestment *=
    investmentConfidence *
    organizationTradeMultiplier(state) *
    strategyEffects.foreignInvestmentMultiplier;
}
