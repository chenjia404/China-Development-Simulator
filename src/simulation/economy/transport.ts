import transportConfig from "../../data/config/transport.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState, PublicTransportState } from "../state/game-state";
import { applyModifiers } from "../events/modifiers";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { technologyNormalizedEffect } from "../technology/technology-growth";

interface TransportConfig {
  initialRailNetworkKm: number;
  initialHighwayNetworkKm: number;
  initialExpresswayKm: number;
  initialUrbanTransitKm: number;
  initialMetroKm: number;
  transportCapitalMonthlyConvergence: number;
  capitalToNetworkScale: number;
  annualNetworkDrift: number;
  highwayScaleExponent: number;
  expresswayAvailableFromYear: number;
  metroAvailableFromYear: number;
  railFreightCapacityPerKm: number;
  highwayFreightCapacityPerKm: number;
  expresswayFreightCapacityPerKm: number;
  utilizationEfficiencyPenalty: number;
  utilizationThreshold: number;
  baseLogisticsEfficiency: number;
  capitalEfficiencyWeight: number;
  institutionalEfficiencyWeight: number;
  maintenanceBacklogPenalty: number;
  logisticsCostBaselineEfficiency: number;
  logisticsCostSensitivity: number;
  minimumLogisticsCostMultiplier: number;
  maximumLogisticsCostMultiplier: number;
  maintenanceShareOfBudget: number;
  maintenanceDeficitRecovery: number;
  maintenanceDeficitRepair: number;
  defaultRailInvestmentShare: number;
  defaultHighwayInvestmentShare: number;
  defaultUrbanInvestmentShare: number;
}

const config = transportConfig as TransportConfig;

export function createEmptyPublicTransportState(): PublicTransportState {
  return {
    railNetworkKm: config.initialRailNetworkKm,
    highwayNetworkKm: config.initialHighwayNetworkKm,
    expresswayKm: config.initialExpresswayKm,
    urbanTransitKm: config.initialUrbanTransitKm,
    metroKm: config.initialMetroKm,
    transportCapitalStock: 8,
    maintenanceBacklog: 0,
    monthlyTransportInvestment: 0,
    monthlyMaintenanceSpend: 0,
    freightTonKm: 0,
    passengerKm: 0,
    freightCapacity: 0,
    freightDemand: 0,
    freightCapacityUtilization: 0,
    logisticsEfficiencyIndex: 10,
    logisticsCostMultiplier: 1,
  };
}

/** 旧存档缺少交通细账时，从既有基建指数与资源账户确定性重建。 */
export function ensureTransportState(nation: NationState): void {
  if (!nation.fiscal.budget.transport) {
    nation.fiscal.budget.transport = 0.08;
    nation.fiscal.budget.infrastructure = Math.max(
      0.05,
      nation.fiscal.budget.infrastructure,
    );
  }
  const existing = nation.transport as Partial<PublicTransportState> | undefined;
  if (
    existing &&
    Number.isFinite(existing.railNetworkKm) &&
    Number.isFinite(existing.logisticsCostMultiplier)
  ) {
    return;
  }
  const infra = nation.resources.infrastructureResources;
  nation.transport = createEmptyPublicTransportState();
  if (infra) {
    nation.transport.railNetworkKm = infra.railNetworkKm || config.initialRailNetworkKm;
    nation.transport.highwayNetworkKm =
      infra.highwayNetworkKm || config.initialHighwayNetworkKm;
    nation.transport.logisticsEfficiencyIndex = infra.logisticsEfficiencyIndex || 10;
  }
  nation.transport.transportCapitalStock = clamp(nation.economy.infrastructureIndex, 0, 100);
  updatePublicTransport(nation, true);
}

function investmentShares(nation: NationState): {
  rail: number;
  highway: number;
  urban: number;
} {
  const railEfficiency = applyPolicyModifiers(
    nation,
    "transport.railInvestmentEfficiency",
    1,
  );
  const highwayEfficiency = applyPolicyModifiers(
    nation,
    "transport.highwayInvestmentEfficiency",
    1,
  );
  const urbanEfficiency = applyPolicyModifiers(
    nation,
    "transport.urbanInvestmentEfficiency",
    1,
  );
  const rawRail = config.defaultRailInvestmentShare * Math.max(0.2, railEfficiency);
  const rawHighway = config.defaultHighwayInvestmentShare * Math.max(0.2, highwayEfficiency);
  const rawUrban = config.defaultUrbanInvestmentShare * Math.max(0.2, urbanEfficiency);
  const total = rawRail + rawHighway + rawUrban;
  return {
    rail: rawRail / total,
    highway: rawHighway / total,
    urban: rawUrban / total,
  };
}

/** 结算交通投资、路网库存、货运能力与物流成本乘数。 */
export function updatePublicTransport(nation: NationState, initialize = false): void {
  if (!nation.transport) {
    nation.transport = createEmptyPublicTransportState();
    initialize = true;
  }
  const transport = nation.transport;
  const { fiscal, economy } = nation;

  transport.monthlyTransportInvestment = Math.max(
    0,
    fiscal.expenditure * fiscal.budget.transport,
  );
  transport.monthlyMaintenanceSpend =
    transport.monthlyTransportInvestment * config.maintenanceShareOfBudget;

  const transportBudgetEffort = applyModifiers(
    nation,
    "transport.investmentEfficiency",
    applyPolicyModifiers(
      nation,
      "transport.investmentEfficiency",
      fiscal.budget.transport *
        safeDivide(fiscal.expenditure, economy.nominalGDP, 0),
    ),
  );

  if (!initialize) {
    transport.transportCapitalStock = clamp(
      transport.transportCapitalStock +
        transportBudgetEffort * config.transportCapitalMonthlyConvergence,
      0,
      100,
    );
  }

  const elapsedYears = nation.date.elapsedMonths / 12;
  const legacyInfrastructureScale =
    1 +
    economy.infrastructureIndex / 100 * 8 +
    elapsedYears * config.annualNetworkDrift;
  const transportBudgetBonus = clamp(
    fiscal.budget.transport / 0.08,
    0.35,
    1.8,
  );
  const networkScale =
    legacyInfrastructureScale *
    (1 + (transport.transportCapitalStock / 100) * 0.08 * (transportBudgetBonus - 1));
  const technologyMultiplier =
    1 + technologyNormalizedEffect(nation.technology.index) * 0.08;

  transport.railNetworkKm = Math.max(
    config.initialRailNetworkKm,
    config.initialRailNetworkKm * networkScale * technologyMultiplier,
  );
  transport.highwayNetworkKm = Math.max(
    config.initialHighwayNetworkKm,
    config.initialHighwayNetworkKm *
      networkScale ** config.highwayScaleExponent *
      technologyMultiplier,
  );

  if (nation.date.year >= config.expresswayAvailableFromYear) {
    const expresswayProgress = clamp(
      (nation.date.year - config.expresswayAvailableFromYear) / 36 +
        transport.transportCapitalStock / 120,
      0,
      1,
    );
    transport.expresswayKm = Math.max(
      transport.expresswayKm,
      transport.highwayNetworkKm * 0.14 * expresswayProgress,
    );
  }

  if (nation.date.year >= config.metroAvailableFromYear) {
    transport.metroKm = Math.max(
      transport.metroKm,
      nation.society.urbanizationRate * 3200 * (transport.transportCapitalStock / 100),
    );
    transport.urbanTransitKm = Math.max(
      config.initialUrbanTransitKm,
      config.initialUrbanTransitKm +
        nation.society.urbanizationRate * 14000,
    );
  }

  const requiredMaintenance = economy.nominalGDP * 0.00000008 * transport.transportCapitalStock;
  const maintenanceGap = Math.max(
    0,
    requiredMaintenance - transport.monthlyMaintenanceSpend,
  );
  if (!initialize) {
    transport.maintenanceBacklog = approach(
      transport.maintenanceBacklog,
      maintenanceGap > 0 ? 1 : 0,
      maintenanceGap > 0
        ? config.maintenanceDeficitRecovery
        : config.maintenanceDeficitRepair,
    );
  }

  const shares = investmentShares(nation);
  transport.freightDemand = Math.max(
    1,
    nation.sectors.primary.output * 0.35 +
      nation.sectors.secondary.output * 0.7 +
      (nation.trade.exports + nation.trade.imports) / 1_000,
  );
  transport.freightCapacity = Math.max(
    1,
    transport.railNetworkKm * config.railFreightCapacityPerKm * shares.rail +
      transport.highwayNetworkKm * config.highwayFreightCapacityPerKm * shares.highway +
      transport.expresswayKm * config.expresswayFreightCapacityPerKm +
      transport.transportCapitalStock * 18_000,
  );
  transport.freightCapacityUtilization = clamp(
    safeDivide(transport.freightDemand, transport.freightCapacity),
    0,
    1.5,
  );

  transport.freightTonKm =
    transport.freightDemand * (0.55 + transport.freightCapacityUtilization * 0.35);
  transport.passengerKm =
    nation.population.urbanPopulation * 0.42 *
    (1 + transport.urbanTransitKm / 12_000 + transport.metroKm / 8_000);

  transport.logisticsEfficiencyIndex = clamp(
    config.baseLogisticsEfficiency +
      economy.infrastructureIndex * 0.62 +
      economy.institutionalEfficiency * config.institutionalEfficiencyWeight +
      (transport.transportCapitalStock / 100) * 6 * transportBudgetBonus -
      Math.max(0, transport.freightCapacityUtilization - config.utilizationThreshold) *
        config.utilizationEfficiencyPenalty -
      transport.maintenanceBacklog * config.maintenanceBacklogPenalty,
    0,
    100,
  );

  transport.logisticsCostMultiplier = clamp(
    1.08 -
      (transport.logisticsEfficiencyIndex - config.logisticsCostBaselineEfficiency) *
        config.logisticsCostSensitivity,
    config.minimumLogisticsCostMultiplier,
    config.maximumLogisticsCostMultiplier,
  );
}

export function logisticsProductionModifier(nation: NationState): number {
  const marginalEfficiency = Math.max(
    0,
    nation.transport.logisticsEfficiencyIndex - 24,
  );
  return clamp(
    applyModifiers(
      nation,
      "production.logisticsEfficiency",
      applyPolicyModifiers(
        nation,
        "production.logisticsEfficiency",
        0.992 + marginalEfficiency / 100 * 0.018,
      ),
    ),
    0.97,
    1.03,
  );
}

export function logisticsTradeModifier(nation: NationState): number {
  return clamp(
    applyModifiers(
      nation,
      "trade.logisticsEfficiency",
      applyPolicyModifiers(
        nation,
        "trade.logisticsEfficiency",
        0.98 + nation.transport.logisticsEfficiencyIndex / 320,
      ),
    ),
    0.95,
    1.05,
  );
}
