import type { GameDate } from "../state/game-state";

export const MONTHS_PER_YEAR = 12;
export const DEFAULT_START_YEAR = 1949;

export function createGameDate(year = DEFAULT_START_YEAR): GameDate {
  if (!Number.isInteger(year) || year < 1) {
    throw new Error("起始年份必须是正整数");
  }
  return { year, month: 1, elapsedMonths: 0 };
}

export function isEndOfYear(date: GameDate): boolean {
  return date.month === MONTHS_PER_YEAR;
}

export function advanceMonth(date: GameDate): void {
  if (!Number.isInteger(date.month) || date.month < 1 || date.month > 12) {
    throw new Error(`月份超出范围：${date.month}`);
  }

  date.elapsedMonths += 1;
  if (date.month === MONTHS_PER_YEAR) {
    date.year += 1;
    date.month = 1;
  } else {
    date.month += 1;
  }
}

export function monthsUntilYear(date: GameDate, targetYear: number): number {
  if (!Number.isInteger(targetYear) || targetYear < date.year) {
    throw new Error("目标年份不得早于当前年份");
  }
  return (targetYear - date.year) * MONTHS_PER_YEAR - (date.month - 1);
}
