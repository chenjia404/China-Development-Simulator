import type { GameState } from "../state/game-state";

/** 全球名义 GDP 排名第一即视为达成游戏胜利目标。 */
export function isWorldGdpLeader(state: GameState): boolean {
  return state.world.rankings.nominalGDP.china === 1;
}

/** 是否已记录胜利年份（排除 null / undefined）。 */
export function hasRecordedVictory(state: GameState): boolean {
  return typeof state.nation.victoryYear === "number";
}

/**
 * 在年度世界排名结算后调用；首次登顶时记录胜利年份。
 * 已记录胜利年份后不再改写，保证存档连续性。
 */
export function checkVictoryCondition(state: GameState): void {
  if (hasRecordedVictory(state)) return;
  if (!isWorldGdpLeader(state)) return;
  state.nation.victoryYear = state.nation.date.year;
}

/** 从年度历史回填胜利年份，供旧存档迁移使用。 */
export function inferVictoryYearFromHistory(state: GameState): number | null {
  let earliest: number | null = null;
  for (const snapshot of state.nation.history.annual) {
    if (snapshot.gdpRank !== 1) continue;
    if (earliest === null || snapshot.year < earliest) {
      earliest = snapshot.year;
    }
  }
  return earliest;
}

/** 补齐缺失字段，并从年度历史回填已达成但未写入的胜利年份。 */
export function ensureVictoryState(state: GameState): void {
  if (hasRecordedVictory(state)) return;
  state.nation.victoryYear = inferVictoryYearFromHistory(state);
}
