import { safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";
import {
  calculateCurrentPriceGDPPerCapita,
  calculateCurrentUSDGDPPerCapita,
} from "./historical-accounting";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { remittanceDomesticIncome } from "./foreign-exchange";

export function calculateGDP(nation: NationState): void {
  const previousRealGDP = nation.economy.realGDP;
  const realGDP = Object.values(nation.sectors).reduce(
    (total, sector) => total + sector.valueAdded,
    0,
  );
  const nominalGDP = realGDP * nation.economy.priceLevelIndex;

  nation.economy.realGDP = Math.max(0, realGDP);
  nation.economy.nominalGDP = Math.max(0, nominalGDP);
  nation.economy.realGDPIndex = realGDP / 1_230_000_000;
  nation.economy.realGDPPerCapita = safeDivide(
    realGDP,
    nation.population.total,
  );
  nation.economy.currentPriceGDPPerCapita =
    calculateCurrentPriceGDPPerCapita(
      nation.economy.realGDPPerCapita,
      nation.date.year,
    );
  nation.economy.currentUSDGDPPerCapita =
    calculateCurrentUSDGDPPerCapita(
      nation.economy.realGDPPerCapita,
      nation.date.year,
    );
  nation.economy.nominalGDPPerCapita = safeDivide(
    nominalGDP,
    nation.population.total,
  );
  nation.economy.pppGDPPerCapita =
    nation.economy.nominalGDPPerCapita /
    Math.max(0.25, nation.economy.priceLevelIndex * 0.6);
  const monthlyGrowth = safeDivide(realGDP, previousRealGDP, 1) - 1;
  nation.economy.annualRealGDPGrowth = (1 + monthlyGrowth) ** 12 - 1;

  nation.economy.householdIncome =
    realGDP * 0.52 + remittanceDomesticIncome(nation);
  const disposableIncome = nation.economy.householdIncome *
    (1 - nation.fiscal.effectiveTaxRate);
  const consumptionPropensity = Math.max(
    0.52,
    applyPolicyModifiers(
      nation,
      "economy.consumptionPropensity",
      0.9 - Math.log1p(nation.economy.realGDPPerCapita) / 40,
    ),
  );
  nation.economy.householdConsumption = disposableIncome * consumptionPropensity;
  nation.economy.nationalSavings = Math.max(
    0,
    disposableIncome - nation.economy.householdConsumption,
  );
}
