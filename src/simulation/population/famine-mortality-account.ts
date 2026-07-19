import type { NationState } from "../state/game-state";
import populationConfig from "../../data/config/population.json";

export const FAMINE_MORTALITY_WINDOW = {
  baselineStartYear: 1955,
  baselineEndYear: 1957,
  windowStartYear: 1959,
  windowEndYear: 1961,
} as const;

export interface FamineMortalityReport {
  /** 1959–1961 累计死亡 */
  totalDeaths: number;
  /** 按 1955–1957 年均折算的三年常态死亡 */
  expectedBaselineDeaths: number;
  /** 超额死亡 = 累计 − 常态；可为负（表示低于常态） */
  excessDeaths: number;
  baselineAnnualAverage: number;
  windowStartYear: number;
  windowEndYear: number;
  baselineSource: "recorded" | "partial" | "synthetic";
  /** 是否收齐完整 36 个月基线与 36 个月危机窗 */
  accountComplete: boolean;
  choiceId: string | null;
  choiceName: string | null;
}

export interface FamineMortalityAccount {
  baselineDeaths: number;
  baselineMonths: number;
  windowDeaths: number;
  windowMonths: number;
  finalized: boolean;
  /** 交互模式下待确认的报告；确认后清空，report 仍保留 */
  pendingReport: FamineMortalityReport | null;
  report: FamineMortalityReport | null;
}

export function createEmptyFamineMortalityAccount(): FamineMortalityAccount {
  return {
    baselineDeaths: 0,
    baselineMonths: 0,
    windowDeaths: 0,
    windowMonths: 0,
    finalized: false,
    pendingReport: null,
    report: null,
  };
}

export function ensureFamineMortalityAccount(nation: NationState): void {
  if (!nation.famineMortality) {
    nation.famineMortality = createEmptyFamineMortalityAccount();
    return;
  }
  const account = nation.famineMortality;
  account.baselineDeaths ??= 0;
  account.baselineMonths ??= 0;
  account.windowDeaths ??= 0;
  account.windowMonths ??= 0;
  account.finalized ??= false;
  account.pendingReport ??= null;
  account.report ??= null;
}

function inInclusiveYearRange(
  year: number,
  start: number,
  end: number,
): boolean {
  return year >= start && year <= end;
}

function resolveCrisisChoice(nation: NationState): {
  choiceId: string | null;
  choiceName: string | null;
} {
  const record = nation.history.historicalEvents.find(
    (event) => event.id === "three_year_difficulties_1959",
  );
  return {
    choiceId: record?.choiceId ?? null,
    choiceName: record?.choiceName ?? null,
  };
}

function buildReport(nation: NationState): FamineMortalityReport {
  const account = nation.famineMortality;
  const { choiceId, choiceName } = resolveCrisisChoice(nation);
  const windowYears =
    FAMINE_MORTALITY_WINDOW.windowEndYear -
    FAMINE_MORTALITY_WINDOW.windowStartYear +
    1;
  const expectedBaselineMonths = windowYears * 12;
  const expectedWindowMonths = windowYears * 12;
  const accountComplete =
    account.baselineMonths >= expectedBaselineMonths &&
    account.windowMonths >= expectedWindowMonths;

  let baselineAnnualAverage: number;
  let baselineSource: "recorded" | "partial" | "synthetic";
  if (account.baselineMonths >= expectedBaselineMonths) {
    baselineAnnualAverage =
      (account.baselineDeaths / account.baselineMonths) * 12;
    baselineSource = "recorded";
  } else if (account.baselineMonths >= 12) {
    baselineAnnualAverage =
      (account.baselineDeaths / account.baselineMonths) * 12;
    baselineSource = "partial";
  } else {
    // 缺基线月时：用配置基准死亡率×当前人口的合成常态，并在报告中标记不可靠。
    baselineAnnualAverage =
      nation.population.total *
      (populationConfig.baseAnnualDeathRate as number);
    baselineSource = "synthetic";
  }

  const expectedBaselineDeaths = baselineAnnualAverage * windowYears;
  const totalDeaths = account.windowDeaths;
  return {
    totalDeaths,
    expectedBaselineDeaths,
    excessDeaths: totalDeaths - expectedBaselineDeaths,
    baselineAnnualAverage,
    windowStartYear: FAMINE_MORTALITY_WINDOW.windowStartYear,
    windowEndYear: FAMINE_MORTALITY_WINDOW.windowEndYear,
    baselineSource,
    accountComplete,
    choiceId,
    choiceName,
  };
}

/** 在人口死亡结算后调用：累计基线/危机窗，并于 1961-12 生成报告。 */
export function tickFamineMortalityAccount(nation: NationState): void {
  ensureFamineMortalityAccount(nation);
  const account = nation.famineMortality;
  if (account.finalized) return;

  const { year } = nation.date;
  const deaths = nation.population.monthlyDeaths;
  if (
    inInclusiveYearRange(
      year,
      FAMINE_MORTALITY_WINDOW.baselineStartYear,
      FAMINE_MORTALITY_WINDOW.baselineEndYear,
    )
  ) {
    account.baselineDeaths += deaths;
    account.baselineMonths += 1;
  }
  if (
    inInclusiveYearRange(
      year,
      FAMINE_MORTALITY_WINDOW.windowStartYear,
      FAMINE_MORTALITY_WINDOW.windowEndYear,
    )
  ) {
    account.windowDeaths += deaths;
    account.windowMonths += 1;
  }

  const closing =
    year === FAMINE_MORTALITY_WINDOW.windowEndYear &&
    nation.date.month === 12;
  if (!closing) return;

  const report = buildReport(nation);
  account.report = report;
  account.finalized = true;
  // 交互模式弹窗确认；批量/自动模式只写入报告不阻断推进。
  account.pendingReport =
    nation.historicalEventDecisionMode === "interactive" ? report : null;
}

export function dismissFamineMortalityReport(nation: NationState): void {
  ensureFamineMortalityAccount(nation);
  if (!nation.famineMortality.pendingReport) {
    throw new Error("当前没有待确认的三年困难死亡报告");
  }
  nation.famineMortality.pendingReport = null;
}

/** 批处理/自动模式切换时清除待确认报告，避免推进死锁。 */
export function clearPendingFamineMortalityReport(nation: NationState): void {
  ensureFamineMortalityAccount(nation);
  nation.famineMortality.pendingReport = null;
}

export function hasPendingFamineMortalityReport(nation: NationState): boolean {
  return nation.famineMortality?.pendingReport != null;
}
