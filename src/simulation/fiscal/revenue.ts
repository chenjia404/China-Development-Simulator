import fiscalConfig from "../../data/config/fiscal.json";
import { approach, clamp } from "../core/math";
import type { NationState } from "../state/game-state";
import { applyModifiers } from "../events/modifiers";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { applyAgriculturalTaxAttribution } from "./agricultural-tax";

export function calculateEffectiveTaxRate(
  statutoryTaxRate: number,
  institutionalEfficiency: number,
): number {
  const rate = clamp(
    statutoryTaxRate,
    fiscalConfig.minimumTaxRate,
    fiscalConfig.maximumTaxRate,
  );
  const excessRate = Math.max(0, rate - fiscalConfig.taxDistortionThreshold);
  const compliance = clamp(
    1 - excessRate ** 2 * fiscalConfig.taxDistortionCoefficient,
    fiscalConfig.minimumTaxCompliance,
    1,
  );
  const collectionCapacity = clamp(
    0.55 + institutionalEfficiency * 0.4,
    0.4,
    0.98,
  );
  return rate * compliance * collectionCapacity;
}

export function calculateFiscalRevenue(nation: NationState): void {
  const { fiscal, economy, trade, sectors, policies } = nation;
  let targetTaxRate = fiscalConfig.normalTaxRate;
  if (policies.includes("high_tax")) targetTaxRate = 0.42;
  if (policies.includes("low_tax")) targetTaxRate = 0.12;
  fiscal.statutoryTaxRate = approach(
    fiscal.statutoryTaxRate,
    targetTaxRate,
    0.08,
  );
  fiscal.effectiveTaxRate = calculateEffectiveTaxRate(
    fiscal.statutoryTaxRate,
    economy.institutionalEfficiency,
  );

  const generalTax =
    economy.nominalGDP *
    fiscalConfig.taxableGDPShare *
    fiscal.effectiveTaxRate;
  const stateOwnedProfit = sectors.secondary.valueAdded * 0.055;
  const tariffRevenue =
    (trade.exports + trade.imports) * trade.openness * 0.035;
  const base = generalTax + stateOwnedProfit + tariffRevenue;
  const netBase = applyAgriculturalTaxAttribution(nation, base);
  fiscal.revenue = Math.max(
    0,
    applyModifiers(
      nation,
      "fiscal.revenue",
      applyPolicyModifiers(nation, "fiscal.revenue", netBase),
    ),
  );
}
