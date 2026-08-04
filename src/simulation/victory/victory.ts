import type { GameState } from "../state/game-state";

/** 全球名义 GDP 排名第一即视为达成游戏胜利目标。 */
export function isWorldGdpLeader(state: GameState): boolean {
  return state.world.rankings.nominalGDP.china === 1;
}

/**
 * 在年度世界排名结算后调用；首次登顶时记录胜利年份。
 * 已记录胜利年份后不再改写，保证存档连续性。
 */
export function checkVictoryCondition(state: GameState): void {
  if (state.nation.victoryYear !== null) return;
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

export function ensureVictoryState(state: GameState): void {
  if (state.nation.victoryYear === undefined) {
    state.nation.victoryYear = inferVictoryYearFromHistory(state);
  }
}
