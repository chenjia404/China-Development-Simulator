import housingData from "../../data/config/housing-urbanization.json";
import { approach, clamp, safeDivide } from "../core/math";
import type { NationState, UrbanHousingState } from "../state/game-state";

interface HousingConfig {
  initialHousingCoverage: number;
  annualDemolitionRate: number;
  constructionUnitsPerBillion: number;
  averageFloorAreaPerUnit: number;
  floorAreaPerLandHectare: number;
  baseVacancyTarget: number;
  maximumPriceToIncomeRatio: number;
}
const config = housingData as HousingConfig;

export function createEmptyUrbanHousingState(): UrbanHousingState {
  return {
    urbanHousingUnits: 0, occupiedUnits: 0, vacantUnits: 0,
    annualNewCompletions: 0, monthlyDemolitions: 0,
    housingDemandHouseholds: 0, housingShortageUnits: 0, vacancyRate: 0,
    homePriceIndex: 1, rentIndex: 1, priceToIncomeRatio: 3,
    rentBurdenRate: 0.12, mortgageDebt: 0, annualLandConversionHectares: 0,
    annualLandLeaseRevenue: 0, informalHousingShare: 0.15,
    urbanServiceCapacity: 0, urbanServiceCoverage: 0, housingStockError: 0,
  };
}

export function ensureUrbanHousingState(nation: NationState): void {
  const existing = nation.society.urbanHousing as Partial<UrbanHousingState> | undefined;
  if (existing && Number.isFinite(existing.urbanHousingUnits) &&
    Number.isFinite(existing.housingStockError)) return;
  nation.society.urbanHousing = createEmptyUrbanHousingState();
  updateUrbanHousing(nation, true);
}

/** 住房是跨期库存；建设、拆除、家庭形成和土地转用均按月结算。 */
export function updateUrbanHousing(nation: NationState, initialize = false): void {
  if (!nation.society.urbanHousing) {
    nation.society.urbanHousing = createEmptyUrbanHousingState();
    initialize = true;
  }
  const state = nation.society.urbanHousing;
  const households = nation.population.demographicDetail.households;
  state.housingDemandHouseholds = Math.max(1, households.urbanHouseholds);
  if (initialize || state.urbanHousingUnits <= 0) {
    state.urbanHousingUnits = state.housingDemandHouseholds *
      config.initialHousingCoverage;
  }
  const constructionValue = nation.industries.construction.valueAdded;
  state.annualNewCompletions = Math.max(
    0,
    constructionValue / 1_000_000_000 * config.constructionUnitsPerBillion *
      (0.72 + nation.fiscal.budget.housing * 1.8),
  );
  state.monthlyDemolitions = state.urbanHousingUnits *
    config.annualDemolitionRate / 12;
  const openingUnits = state.urbanHousingUnits;
  if (!initialize) {
    state.urbanHousingUnits = Math.max(
      1,
      openingUnits + state.annualNewCompletions / 12 - state.monthlyDemolitions,
    );
  }
  state.occupiedUnits = Math.min(state.urbanHousingUnits, state.housingDemandHouseholds);
  state.vacantUnits = Math.max(0, state.urbanHousingUnits - state.occupiedUnits);
  state.housingShortageUnits = Math.max(
    0,
    state.housingDemandHouseholds - state.urbanHousingUnits,
  );
  state.vacancyRate = clamp(
    safeDivide(state.vacantUnits, state.urbanHousingUnits), 0, 1,
  );
  const shortageRate = safeDivide(
    state.housingShortageUnits,
    state.housingDemandHouseholds,
  );
  const pricePressure = shortageRate * 0.16 -
    Math.max(0, state.vacancyRate - config.baseVacancyTarget) * 0.08 +
    nation.economy.inflationRate / 12;
  state.homePriceIndex = clamp(
    state.homePriceIndex * (1 + clamp(pricePressure, -0.03, 0.05)),
    0.1, 10_000,
  );
  state.rentIndex = approach(
    state.rentIndex,
    state.homePriceIndex * (0.72 + shortageRate * 0.28),
    0.025,
  );
  const annualHouseholdIncome = Math.max(
    1,
    nation.economy.householdDisposableIncome /
      Math.max(households.householdCount, 1),
  );
  const referenceHouseValue = annualHouseholdIncome * 3 * state.homePriceIndex;
  state.priceToIncomeRatio = clamp(
    safeDivide(referenceHouseValue, annualHouseholdIncome),
    0,
    config.maximumPriceToIncomeRatio,
  );
  state.rentBurdenRate = clamp(
    0.1 * state.rentIndex / Math.max(nation.marketDynamics.nominalWageIndex, 0.1),
    0.04, 0.65,
  );
  state.mortgageDebt = nation.financialSystem.banking.householdLoans *
    clamp(0.18 + nation.society.urbanizationRate * 0.62, 0.18, 0.8);
  const annualFloorArea = state.annualNewCompletions *
    config.averageFloorAreaPerUnit;
  state.annualLandConversionHectares = annualFloorArea /
    config.floorAreaPerLandHectare;
  state.annualLandLeaseRevenue = state.annualLandConversionHectares *
    annualHouseholdIncome * (18 + state.homePriceIndex * 2);
  state.informalHousingShare = clamp(
    shortageRate * 0.72 + (1 - nation.economy.institutionalEfficiency) * 0.08,
    0, 0.5,
  );
  state.urbanServiceCapacity = Math.max(
    1,
    state.urbanHousingUnits * (0.78 + nation.economy.infrastructureIndex / 100 * 0.35),
  );
  state.urbanServiceCoverage = clamp(
    safeDivide(state.urbanServiceCapacity, state.housingDemandHouseholds),
    0, 1.2,
  );
  state.housingStockError = Math.abs(
    state.urbanHousingUnits - state.occupiedUnits - state.vacantUnits,
  );
}
