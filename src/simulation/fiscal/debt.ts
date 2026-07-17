import fiscalConfig from "../../data/config/fiscal.json";
import { clamp, safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";

export function updateDebt(nation: NationState): void {
  const { fiscal, economy, policies } = nation;
  const previousDebtRatio = safeDivide(
    fiscal.governmentDebt,
    economy.nominalGDP,
  );
  const riskPremium =
    Math.max(0, previousDebtRatio - fiscalConfig.debtRiskThreshold) * 0.09;
  const inflationPremium = Math.max(0, economy.inflationRate - 0.03) * 0.35;
  fiscal.debtInterestRate = clamp(
    fiscalConfig.baseDebtInterestRate + riskPremium + inflationPremium,
    0.005,
    1.5,
  );
  fiscal.interestExpense = fiscal.governmentDebt * fiscal.debtInterestRate;

  const annualDeficit = Math.max(0, -fiscal.balance);
  const annualSurplus = Math.max(0, fiscal.balance);
  const forcedMonetization = Math.max(
    0,
    previousDebtRatio - fiscalConfig.monetizationThreshold,
  ) * 0.35;
  const monetizationShare = clamp(
    forcedMonetization + (policies.includes("monetary_financing") ? 0.35 : 0),
    0,
    fiscalConfig.maximumMonetizationShare,
  );
  fiscal.monetaryFinancing = annualDeficit * monetizationShare;
  fiscal.governmentDebt = Math.max(
    0,
    fiscal.governmentDebt +
      annualDeficit * (1 - monetizationShare) / 12 -
      annualSurplus / 12,
  );
  fiscal.debtToGDP = safeDivide(
    fiscal.governmentDebt,
    economy.nominalGDP,
  );
}
