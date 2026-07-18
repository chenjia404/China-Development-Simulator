import type { RandomGenerator } from "./random";
import { advanceMonth } from "./time";
import type { GameState } from "../state/game-state";
import { updateDemographics } from "../population/demographics";
import { updateLaborForce } from "../population/labor-force";
import { updateCapitalAndInvestment } from "../economy/capital";
import {
  allocateLabor,
  calculateIndustryOutputs,
  updateResourceSupply,
} from "../economy/production";
import { calculateGDP } from "../economy/gdp";
import { calculateFiscalRevenue } from "../fiscal/revenue";
import { calculateFiscalSpending } from "../fiscal/spending";
import { updateDebt } from "../fiscal/debt";
import { updateInflation } from "../economy/inflation";
import { updateEducation } from "../society/education";
import { updateHealth } from "../society/health";
import { updateTechnology } from "../technology/research";
import { updateWellbeing } from "../society/wellbeing";
import { simulateWorldCountries } from "../world/world-simulation";
import { calculateWorldRankings } from "../world/rankings";
import { isEndOfYear } from "./time";
import { recordHistory } from "../reports/history";
import { updatePolicyEnvironment } from "../policies/policy-engine";
import { checkRandomEvents } from "../events/event-engine";
import { advanceModifiers } from "../events/modifiers";
import {
  checkAutomaticInternationalOrganizations,
  updateDiplomacy,
} from "../diplomacy/diplomacy";
import { updateInternationalTrade } from "../economy/trade";
import { updateForeignExchange } from "../economy/foreign-exchange";
import { checkHistoricalEvents } from "../events/historical-event-engine";
import { updatePrivateEconomy } from "../economy/private-economy";
import { updateDemandDrivenCapacityUtilization } from "../economy/domestic-demand";
import { updateNationalAccounts } from "../economy/national-accounts";
import { updateMarketDynamics } from "../economy/market-dynamics";

/** 固定的月度管线入口；后续系统按设计文档顺序接入此处。 */
export function simulateMonth(
  state: GameState,
  _random: RandomGenerator,
  eventRandom: RandomGenerator,
): boolean {
  checkHistoricalEvents(state.nation);
  if (state.nation.pendingHistoricalEventId) return false;
  checkRandomEvents(state.nation, eventRandom);
  updatePolicyEnvironment(state.nation);
  updateDiplomacy(state);
  checkAutomaticInternationalOrganizations(state);
  updatePrivateEconomy(state.nation);
  updateDemographics(state.nation, _random);
  updateEducation(state.nation);
  updateHealth(state.nation);
  updateLaborForce(state.nation);
  updateTechnology(state.nation);
  updateCapitalAndInvestment(state.nation);
  allocateLabor(state.nation);
  updateResourceSupply(state.nation);
  updateDemandDrivenCapacityUtilization(state.nation);
  calculateIndustryOutputs(state.nation);
  calculateGDP(state.nation);
  updateInternationalTrade(state);
  updateForeignExchange(state);
  calculateFiscalRevenue(state.nation);
  calculateFiscalSpending(state.nation);
  updateNationalAccounts(state.nation);
  updateDebt(state.nation);
  updateInflation(state.nation);
  updateMarketDynamics(state.nation);
  updateWellbeing(state.nation);
  simulateWorldCountries(state, _random);
  if (isEndOfYear(state.nation.date)) {
    calculateWorldRankings(state);
  }
  recordHistory(state);
  advanceModifiers(state.nation);
  advanceMonth(state.nation.date);
  return true;
}
