import historicalBudgetConfig from "../../data/config/historical-budget-trajectory.json";
import type { FiscalBudget, NationState } from "../state/game-state";

interface HistoricalBudgetPeriod {
  untilYear: number;
  overrides: Partial<FiscalBudget>;
}

interface HistoricalBudgetConfig {
  baseline: FiscalBudget;
  periods: HistoricalBudgetPeriod[];
}

const config = historicalBudgetConfig as HistoricalBudgetConfig;

/** 按年份返回史实参考财政预算结构。 */
export function getHistoricalReferenceBudget(year: number): FiscalBudget {
  const period =
    config.periods.find((item) => year < item.untilYear) ??
    config.periods[config.periods.length - 1];
  return {
    ...config.baseline,
    ...period.overrides,
  };
}

/** 旧存档缺少预算跟踪字段时，默认视为已手动调整，避免加载后突变。 */
export function ensureHistoricalBudgetState(nation: NationState): void {
  if (nation.budgetManuallyAdjusted === undefined) {
    nation.budgetManuallyAdjusted = true;
  }
}

/** 交互路线在未手动调整时，于进入每年 1 月时对齐史实参考预算。 */
export function applyHistoricalReferenceBudgetIfNeeded(nation: NationState): void {
  ensureHistoricalBudgetState(nation);
  if (nation.budgetManuallyAdjusted || nation.date.month !== 1) {
    return;
  }
  nation.fiscal.budget = getHistoricalReferenceBudget(nation.date.year);
}
