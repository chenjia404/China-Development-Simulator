import type { GameState } from "../simulation/state/game-state";

/** 完整战役进入不确定未来时代后的统一截止年份。 */
export const FULL_CAMPAIGN_END_YEAR = 2050;

export function getPlayableEndYear(): number {
  return FULL_CAMPAIGN_END_YEAR;
}

/** 短剧本使用自身终局年；完整战役使用全局可玩年份。 */
export function getGamePlayableEndYear(
  game: GameState,
): number {
  return game.nation.scenario.short
    ? game.nation.scenario.endYear
    : getPlayableEndYear();
}

/** 已越过可玩截止年（进入截止年的下一年及以后）。 */
export function isPastPlayableHorizon(
  date: { year: number; month?: number },
  endYear = getPlayableEndYear(),
): boolean {
  return date.year > endYear;
}
