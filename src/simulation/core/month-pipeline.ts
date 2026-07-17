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

/** 固定的月度管线入口；后续系统按设计文档顺序接入此处。 */
export function simulateMonth(
  state: GameState,
  _random: RandomGenerator,
): void {
  updateDemographics(state.nation, _random);
  updateLaborForce(state.nation);
  updateCapitalAndInvestment(state.nation);
  allocateLabor(state.nation);
  updateResourceSupply(state.nation);
  calculateIndustryOutputs(state.nation);
  calculateGDP(state.nation);
  calculateFiscalRevenue(state.nation);
  calculateFiscalSpending(state.nation);
  updateDebt(state.nation);
  updateInflation(state.nation);
  advanceMonth(state.nation.date);
}
