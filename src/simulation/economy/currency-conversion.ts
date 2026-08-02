import { safeDivide } from "../core/math";
import type { NationState } from "../state/game-state";

/** 将游戏内部名义人民币流量折算为美元等值，与国际收支和外汇账户同口径。 */
export function nominalToUsd(nation: NationState, nominal: number): number {
  if (!Number.isFinite(nominal)) return 0;
  return nominal * safeDivide(
    nation.economy.internationalComparableGDP,
    nation.economy.nominalGDP,
    1,
  );
}

/** 将美元等值折算回游戏内部名义人民币口径。 */
export function usdToNominal(nation: NationState, usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  return usd * safeDivide(
    nation.economy.nominalGDP,
    nation.economy.internationalComparableGDP,
    1,
  );
}
