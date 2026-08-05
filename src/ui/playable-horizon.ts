import type { GameState } from "../simulation/state/game-state";

/** 交互游玩的可玩截止年份，与「一键模拟至当前年」一致。 */
export function getPlayableEndYear(now = new Date()): number {
  return now.getFullYear();
}

/** 短剧本使用自身终局年；完整战役使用全局可玩年份。 */
export function getGamePlayableEndYear(
  game: GameState,
  now = new Date(),
): number {
  return game.nation.scenario.short
    ? game.nation.scenario.endYear
    : getPlayableEndYear(now);
}

/** 已越过可玩截止年（进入截止年的下一年及以后）。 */
export function isPastPlayableHorizon(
  date: { year: number; month?: number },
  endYear = getPlayableEndYear(),
): boolean {
  return date.year > endYear;
}
