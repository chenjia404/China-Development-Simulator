import defenseData from "../../data/config/security-defense.json";
import { clamp, safeDivide } from "../core/math";
import type { NationState, SecurityDefenseState } from "../state/game-state";

interface DefenseConfig {
  budgetShares: { personnel: number; equipment: number; logistics: number; research: number };
  annualCapitalDepreciationRate: number;
  baseActivePersonnelShare: number;
  baseReserveMultiplier: number;
  koreanWarIntensity: number;
  annualCasualtyRateAtFullIntensity: number;
  wartimeBudgetMultiplier: number;
}
const config = defenseData as DefenseConfig;
export function createEmptySecurityDefenseState(): SecurityDefenseState {
  return {
    annualDefenseBudget: 0, personnelExpenditure: 0, equipmentInvestment: 0,
    logisticsExpenditure: 0, researchExpenditure: 0, activePersonnel: 0,
    reservePersonnel: 0, defenseCapitalStock: 0, equipmentModernizationRate: 0,
    domesticProcurementShare: 0, militaryImportRequirement: 0,
    militaryImportCoverage: 0, readinessIndex: 0, logisticsReadinessIndex: 0,
    strategicDepthIndex: 0, civilDefenseCapacity: 0, externalThreatIndex: 0,
    activeConflictId: null, conflictIntensity: 0, cumulativeConflictMonths: 0,
    monthlyConflictCasualties: 0, cumulativeConflictCasualties: 0,
    cumulativeWarCost: 0, civilianInvestmentOpportunityCost: 0,
    wartimeExternalDebtExposure: 0,
  };
}
export function ensureSecurityDefenseState(nation: NationState): void {
  const existing = nation.securityDefense as Partial<SecurityDefenseState> | undefined;
  if (existing && Number.isFinite(existing.defenseCapitalStock) &&
    Number.isFinite(existing.cumulativeWarCost)) return;
  nation.securityDefense = createEmptySecurityDefenseState();
  updateSecurityDefense(nation, true);
}
function koreanWarIntensity(nation: NationState): number {
  const active = nation.modifiers.some((item) =>
    item.sourceId === "korean_war_1950" &&
    (item.remainingMonths === null || item.remainingMonths > 0)
  );
  if (!active) return 0;
  const limited = nation.history.historicalEvents.find((item) =>
    item.id === "korean_war_1950"
  )?.choiceId === "limited_intervention";
  return config.koreanWarIntensity * (limited ? 0.42 : 1);
}
/** 形成国防库存和战争备忘账户；宏观战争冲击仍由历史修正器唯一执行。 */
export function updateSecurityDefense(nation: NationState, initialize = false): void {
  if (!nation.securityDefense) {
    nation.securityDefense = createEmptySecurityDefenseState();
    initialize = true;
  }
  const state = nation.securityDefense;
  const conflictIntensity = koreanWarIntensity(nation);
  state.activeConflictId = conflictIntensity > 0 ? "korean_war_1950" : null;
  state.conflictIntensity = conflictIntensity;
  const baseBudget = nation.fiscal.expenditure * nation.fiscal.budget.defense;
  state.annualDefenseBudget = baseBudget *
    (1 + conflictIntensity * (config.wartimeBudgetMultiplier - 1));
  state.personnelExpenditure = state.annualDefenseBudget * config.budgetShares.personnel;
  state.equipmentInvestment = state.annualDefenseBudget * config.budgetShares.equipment;
  state.logisticsExpenditure = state.annualDefenseBudget * config.budgetShares.logistics;
  state.researchExpenditure = state.annualDefenseBudget * config.budgetShares.research;
  state.activePersonnel = nation.labor.laborForce *
    config.baseActivePersonnelShare * (1 + conflictIntensity * 1.8);
  state.reservePersonnel = state.activePersonnel * config.baseReserveMultiplier;
  if (initialize || state.defenseCapitalStock <= 0) {
    state.defenseCapitalStock = state.equipmentInvestment * 4;
  } else {
    state.defenseCapitalStock = Math.max(0,
      state.defenseCapitalStock * (1 - config.annualCapitalDepreciationRate / 12) +
      state.equipmentInvestment / 12);
  }
  state.equipmentModernizationRate = clamp(
    nation.technology.index / 100 * 0.55 +
      nation.industries.aerospace_advanced.technologyReadiness * 0.25 +
      nation.industries.electronics_communications.technologyReadiness * 0.2,
    0, 1,
  );
  state.domesticProcurementShare = clamp(
    0.35 + nation.sectors.secondary.technologyLevel / 100 * 0.35 +
      nation.economy.institutionalEfficiency * 0.2,
    0.25, 0.95,
  );
  state.militaryImportRequirement = state.equipmentInvestment *
    (1 - state.domesticProcurementShare) /
    Math.max(nation.financialSystem.officialExchangeRate, 0.5);
  state.militaryImportCoverage = clamp(
    safeDivide(nation.trade.foreignExchangeReserves * 0.03 +
      nation.trade.monthlyExternalBorrowing * 12, state.militaryImportRequirement, 1),
    0, 1,
  );
  state.logisticsReadinessIndex = clamp(
    nation.resources.infrastructureResources.logisticsEfficiencyIndex * 0.55 +
      safeDivide(state.logisticsExpenditure, state.annualDefenseBudget, 0) * 100 * 0.45,
    0, 100,
  );
  state.strategicDepthIndex = clamp(
    nation.regionalEconomy.westernDevelopmentIndex * 55 +
      nation.diplomacy.securityIndex * 0.45,
    0, 100,
  );
  state.civilDefenseCapacity = clamp(
    nation.economy.infrastructureIndex * 0.45 +
      nation.health.coverageRate * 25 + nation.diplomacy.securityIndex * 0.3,
    0, 100,
  );
  const hostileWeight = nation.modifiers.filter((item) =>
    item.target.startsWith("diplomacy.relationTarget.") && item.value < 0
  ).length;
  state.externalThreatIndex = clamp(
    22 + hostileWeight * 4 + conflictIntensity * 45 -
      nation.diplomacy.globalReputation * 0.08,
    0, 100,
  );
  state.readinessIndex = clamp(
    state.equipmentModernizationRate * 35 +
      state.logisticsReadinessIndex * 0.25 +
      state.strategicDepthIndex * 0.2 +
      nation.diplomacy.securityIndex * 0.2,
    0, 100,
  );
  state.monthlyConflictCasualties = conflictIntensity > 0
    ? nation.population.total * config.annualCasualtyRateAtFullIntensity *
      conflictIntensity / 12
    : 0;
  if (conflictIntensity > 0 && !initialize) {
    state.cumulativeConflictMonths += 1;
    state.cumulativeConflictCasualties += state.monthlyConflictCasualties;
    state.cumulativeWarCost += state.annualDefenseBudget * conflictIntensity / 12;
  }
  state.civilianInvestmentOpportunityCost = Math.max(
    0,
    state.annualDefenseBudget - nation.fiscal.expenditure * 0.08,
  );
  state.wartimeExternalDebtExposure = conflictIntensity > 0
    ? nation.trade.externalDebt
    : Math.min(state.wartimeExternalDebtExposure, nation.trade.externalDebt);
}
