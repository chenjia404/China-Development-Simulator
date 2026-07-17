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

/** 固定的月度管线入口；后续系统按设计文档顺序接入此处。 */
export function simulateMonth(
  state: GameState,
  _random: RandomGenerator,
): void {
  updateDemographics(state.nation, _random);
  updateEducation(state.nation);
  updateHealth(state.nation);
  updateLaborForce(state.nation);
  updateTechnology(state.nation);
  updateCapitalAndInvestment(state.nation);
  allocateLabor(state.nation);
  updateResourceSupply(state.nation);
  calculateIndustryOutputs(state.nation);
  calculateGDP(state.nation);
  calculateFiscalRevenue(state.nation);
  calculateFiscalSpending(state.nation);
  updateDebt(state.nation);
  updateInflation(state.nation);
  updateWellbeing(state.nation);
  simulateWorldCountries(state, _random);
  if (isEndOfYear(state.nation.date)) {
    calculateWorldRankings(state);
  }
  recordHistory(state);
  advanceMonth(state.nation.date);
}
