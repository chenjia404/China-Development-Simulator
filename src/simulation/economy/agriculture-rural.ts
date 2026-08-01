import agricultureData from "../../data/config/agriculture-rural.json";
import { approach, clamp, safeDivide } from "../core/math";
import type {
  AgricultureSystemState,
  NationState,
} from "../state/game-state";
import { applyPolicyModifiers } from "../policies/policy-engine";

interface AgricultureConfig {
  initialCultivatedLandHectares: number;
  minimumCultivatedLandHectares: number;
  initialStrategicReserveStock: number;
  targetReserveCoverageMonths: number;
  maximumMonthlyReserveReleaseShare: number;
  maximumMonthlyReserveAccumulationShare: number;
  basePostHarvestLossRate: number;
  minimumPostHarvestLossRate: number;
  baseDailyCalories: number;
  maximumDailyCalories: number;
  annualLandUrbanizationLossRate: number;
  annualLandProtectionRecoveryRate: number;
}

const config = agricultureData as AgricultureConfig;

export function createEmptyAgricultureSystemState(): AgricultureSystemState {
  return {
    cultivatedLandHectares: config.initialCultivatedLandHectares,
    irrigatedLandRate: 0.18,
    mechanizationRate: 0.02,
    fertilizerInputKgPerHectare: 4,
    grainYieldKgPerHectare: 1_050,
    grossHarvest: 0,
    postHarvestLoss: 0,
    netDomesticProduction: 0,
    foodImports: 0,
    foodExports: 0,
    strategicReserveStock: config.initialStrategicReserveStock,
    monthlyReserveChange: 0,
    reserveCoverageMonths: 0,
    availableFoodSupply: 0,
    selfSufficiencyRate: 0,
    foodSecurityCoverage: 0,
    rationCoverageRate: 0,
    ruralIncomePerWorker: 0,
    dailyCaloriesPerCapita: config.baseDailyCalories,
    nutritionStressIndex: 0,
    massBalanceError: 0,
  };
}

/** 旧存档缺少农业细账时按当前粮食总量确定性重建。 */
export function ensureAgricultureSystemState(nation: NationState): void {
  const existing = nation.resources.agriculture as
    | Partial<AgricultureSystemState>
    | undefined;
  if (existing && Number.isFinite(existing.cultivatedLandHectares) &&
    Number.isFinite(existing.strategicReserveStock) &&
    Number.isFinite(existing.massBalanceError)) return;
  nation.resources.agriculture = createEmptyAgricultureSystemState();
  updateAgricultureSystem(nation, true);
}

/** 调和实物粮食流量；既有农业产出是净国内产量，本账户不重复创造产出。 */
export function updateAgricultureSystem(nation: NationState, initialize = false): void {
  if (!nation.resources.agriculture) {
    nation.resources.agriculture = createEmptyAgricultureSystemState();
    initialize = true;
  }
  const state = nation.resources.agriculture;
  const landPressure = Math.max(0, nation.society.urbanizationRate - 0.2);
  const protection = nation.fiscal.budget.agriculture *
    nation.economy.institutionalEfficiency;
  const monthlyLandChange = state.cultivatedLandHectares *
    (-landPressure * config.annualLandUrbanizationLossRate +
      protection * config.annualLandProtectionRecoveryRate) / 12;
  if (!initialize) {
    state.cultivatedLandHectares = clamp(
      state.cultivatedLandHectares + monthlyLandChange,
      config.minimumCultivatedLandHectares,
      config.initialCultivatedLandHectares * 1.06,
    );
  }
  const development = clamp(
    Math.log1p(nation.economy.realGDPPerCapita) / Math.log(60_001),
    0,
    1,
  );
  const hasMechanization = nation.technology.completedTechnologyIds.includes(
    "mechanized_agriculture",
  );
  const hasModernAgronomy = nation.technology.completedTechnologyIds.includes(
    "modern_agronomy",
  );
  state.irrigatedLandRate = approach(
    state.irrigatedLandRate,
    clamp(0.18 + development * 0.38 + protection * 0.35, 0.18, 0.82),
    initialize ? 1 : 0.012,
  );
  state.mechanizationRate = approach(
    state.mechanizationRate,
    clamp(0.02 + development * 0.52 + (hasMechanization ? 0.28 : 0), 0.02, 0.96),
    initialize ? 1 : 0.016,
  );
  state.fertilizerInputKgPerHectare = approach(
    state.fertilizerInputKgPerHectare,
    4 + development * 260 + (hasModernAgronomy ? 70 : 0),
    initialize ? 1 : 0.015,
  );
  const marketAccess = applyPolicyModifiers(nation, "agriculture.marketAccess", 1);
  const lossRate = clamp(
    config.basePostHarvestLossRate - state.mechanizationRate * 0.035 -
      nation.economy.infrastructureIndex / 100 * 0.018 -
      nation.transport.logisticsEfficiencyIndex / 100 * 0.012 * marketAccess,
    config.minimumPostHarvestLossRate,
    config.basePostHarvestLossRate,
  );
  state.netDomesticProduction = Math.max(0, nation.resources.foodProduction);
  state.grossHarvest = safeDivide(state.netDomesticProduction, 1 - lossRate);
  state.postHarvestLoss = state.grossHarvest - state.netDomesticProduction;
  state.grainYieldKgPerHectare = safeDivide(
    state.grossHarvest * 1_000,
    state.cultivatedLandHectares,
  );

  const annualDemand = Math.max(1, nation.resources.foodDemand);
  const domesticGap = Math.max(0, annualDemand - state.netDomesticProduction);
  state.foodImports = domesticGap * clamp(
    nation.trade.openness * 0.16 + nation.trade.capitalGoodsImportCoverage * 0.015,
    0,
    0.35,
  );
  state.foodExports = Math.max(0, state.netDomesticProduction - annualDemand) *
    clamp(nation.trade.openness * 0.08, 0, 0.2);
  const openingReserve = state.strategicReserveStock;
  const annualSupplyBeforeReserve = state.netDomesticProduction +
    state.foodImports - state.foodExports;
  const annualShortage = Math.max(0, annualDemand - annualSupplyBeforeReserve);
  const annualSurplus = Math.max(0, annualSupplyBeforeReserve - annualDemand);
  const monthlyRelease = Math.min(
    openingReserve * config.maximumMonthlyReserveReleaseShare,
    annualShortage / 12,
  );
  const targetReserve = annualDemand / 12 * config.targetReserveCoverageMonths;
  const monthlyAccumulation = Math.min(
    annualSurplus / 12,
    Math.max(0, targetReserve - openingReserve) *
      config.maximumMonthlyReserveAccumulationShare,
  );
  state.monthlyReserveChange = monthlyAccumulation - monthlyRelease;
  state.strategicReserveStock = Math.max(
    0,
    openingReserve + state.monthlyReserveChange,
  );
  const annualizedReserveRelease = monthlyRelease * 12;
  state.availableFoodSupply = annualSupplyBeforeReserve + annualizedReserveRelease;
  state.selfSufficiencyRate = clamp(
    safeDivide(state.netDomesticProduction, annualDemand),
    0,
    1.5,
  );
  state.foodSecurityCoverage = clamp(
    safeDivide(state.availableFoodSupply, annualDemand),
    0.1,
    1.3,
  );
  state.reserveCoverageMonths = safeDivide(
    state.strategicReserveStock,
    annualDemand / 12,
  );
  state.rationCoverageRate = clamp(
    state.foodSecurityCoverage * (0.82 + nation.economy.institutionalEfficiency * 0.18),
    0,
    1,
  );
  state.ruralIncomePerWorker = safeDivide(
    nation.sectors.primary.valueAdded * 0.52,
    nation.sectors.primary.employment,
  );
  state.dailyCaloriesPerCapita = clamp(
    config.baseDailyCalories * state.foodSecurityCoverage *
      (0.88 + development * 0.45),
    700,
    config.maximumDailyCalories,
  );
  state.nutritionStressIndex = clamp(
    1 - state.dailyCaloriesPerCapita / 2_100,
    0,
    1,
  );
  state.massBalanceError = Math.abs(
    state.availableFoodSupply -
      (state.netDomesticProduction + state.foodImports - state.foodExports +
        annualizedReserveRelease),
  );
}
