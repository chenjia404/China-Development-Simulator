import type { GameState } from "../../simulation/state/game-state";
import type { AnnualSnapshot } from "../../simulation/state/history-state";
import { hasRecordedVictory } from "../../simulation/victory/victory";
import { formatLarge, formatPercent, formatUsd } from "../format";

export interface ShareMilestoneMetric {
  label: string;
  value: string;
}

export interface ShareMilestoneDefinition {
  id: string;
  title: string;
  description: string;
  /** 达成时的模拟年份；无法精确回溯时用当前年份。 */
  resolveReachedYear: (game: GameState) => number | null;
  /** 展示达成年份当时的数据，不得用当前局内最新值顶替。 */
  metrics: (game: GameState, reachedYear: number) => ShareMilestoneMetric[];
}

export interface UnlockedShareMilestone {
  id: string;
  title: string;
  description: string;
  reachedYear: number;
  metrics: ShareMilestoneMetric[];
}

/** 到达某年 12 月及之后即视为达成该年节点。 */
function hasReachedYearEnd(game: GameState, year: number): boolean {
  const { year: currentYear, month } = game.nation.date;
  return currentYear > year || (currentYear === year && month >= 12);
}

function firstYearWhen(
  game: GameState,
  predicate: (snapshot: AnnualSnapshot) => boolean,
): number | null {
  let earliest: number | null = null;
  for (const snapshot of game.nation.history.annual) {
    if (!predicate(snapshot)) continue;
    if (earliest === null || snapshot.year < earliest) {
      earliest = snapshot.year;
    }
  }
  return earliest;
}

function annualAt(game: GameState, year: number): AnnualSnapshot | null {
  return game.nation.history.annual.find((snapshot) => snapshot.year === year) ?? null;
}

/**
 * 取达成年对应年度快照；没有该年快照时，若到达年就是当前年则退回当前值。
 * 绝不使用“后来的当前值”冒充过去年份的指标。
 */
function snapshotOrCurrentLive(
  game: GameState,
  reachedYear: number,
): {
  realGDP: number;
  population: number;
  currentUSDGDPPerCapita: number;
  urbanizationRate: number;
  gdpRank: number | null;
  score: number | null;
  technologyIndex: number;
  happinessIndex: number;
} {
  const snapshot = annualAt(game, reachedYear);
  if (snapshot) {
    return {
      realGDP: snapshot.realGDP,
      population: snapshot.population,
      currentUSDGDPPerCapita: snapshot.currentUSDGDPPerCapita,
      urbanizationRate: snapshot.urbanizationRate,
      gdpRank: snapshot.gdpRank,
      score: snapshot.score,
      technologyIndex: snapshot.technologyIndex,
      happinessIndex: snapshot.happinessIndex,
    };
  }

  const isCurrentYear = game.nation.date.year === reachedYear;
  if (!isCurrentYear) {
    // 缺历史快照时用破折号，避免把“现在的 9996 美元”贴到 1977 年里程碑上
    return {
      realGDP: Number.NaN,
      population: Number.NaN,
      currentUSDGDPPerCapita: Number.NaN,
      urbanizationRate: Number.NaN,
      gdpRank: null,
      score: null,
      technologyIndex: Number.NaN,
      happinessIndex: Number.NaN,
    };
  }

  const liveRank = game.world.rankings.nominalGDP.china;
  return {
    realGDP: game.nation.economy.realGDP,
    population: game.nation.population.total,
    currentUSDGDPPerCapita: game.nation.economy.currentUSDGDPPerCapita,
    urbanizationRate: game.nation.society.urbanizationRate,
    gdpRank: typeof liveRank === "number" ? liveRank : null,
    score: game.nation.history.annual.at(-1)?.score ?? null,
    technologyIndex: game.nation.technology.index,
    happinessIndex: game.nation.society.happinessIndex,
  };
}

function formatOrDash(value: number, formatter: (value: number) => string): string {
  return Number.isFinite(value) ? formatter(value) : "—";
}

function resolveRankMilestoneYear(
  game: GameState,
  maxRank: number,
): number | null {
  const fromHistory = firstYearWhen(game, (snapshot) => snapshot.gdpRank <= maxRank);
  if (fromHistory !== null) return fromHistory;
  // 尚无年度结算时不按实时排名“瞬时达成”，避免开局即弹出庆祝节点
  if (game.nation.history.annual.length === 0) return null;
  const live = game.world.rankings.nominalGDP.china;
  return typeof live === "number" && live <= maxRank ? game.nation.date.year : null;
}

function resolveYearNode(game: GameState, year: number): number | null {
  if (!hasReachedYearEnd(game, year)) return null;
  // 有该年快照，或当前正停留在该年，才展示；跳开局越过且无快照则不生成空壳里程碑
  if (annualAt(game, year)) return year;
  if (game.nation.date.year === year) return year;
  return null;
}

function yearNodeMetrics(game: GameState, reachedYear: number): ShareMilestoneMetric[] {
  const data = snapshotOrCurrentLive(game, reachedYear);
  return [
    {
      label: "实际 GDP",
      value: formatOrDash(data.realGDP, formatLarge),
    },
    {
      label: "人均美元",
      value: formatOrDash(data.currentUSDGDPPerCapita, formatUsd),
    },
  ];
}

export const shareMilestoneDefinitions: readonly ShareMilestoneDefinition[] = [
  {
    id: "year_1978",
    title: "抵达 1978 年",
    description: "改革开放前夜，发展道路即将分岔。",
    resolveReachedYear: (game) => resolveYearNode(game, 1978),
    metrics: yearNodeMetrics,
  },
  {
    id: "year_1992",
    title: "抵达 1992 年",
    description: "市场经济方向更明确，增长动能开始加速。",
    resolveReachedYear: (game) => resolveYearNode(game, 1992),
    metrics: yearNodeMetrics,
  },
  {
    id: "year_2001",
    title: "抵达 2001 年",
    description: "深度融入全球贸易体系的关键节点。",
    resolveReachedYear: (game) => resolveYearNode(game, 2001),
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "人均美元",
          value: formatOrDash(data.currentUSDGDPPerCapita, formatUsd),
        },
        {
          label: "城市化",
          value: formatOrDash(data.urbanizationRate, formatPercent),
        },
      ];
    },
  },
  {
    id: "year_2008",
    title: "抵达 2008 年",
    description: "国际舞台与国内产业升级同步加压的一年。",
    resolveReachedYear: (game) => resolveYearNode(game, 2008),
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "GDP 世界排名",
          value: data.gdpRank === null ? "—" : `第 ${data.gdpRank} 名`,
        },
        {
          label: "科技指数",
          value: formatOrDash(data.technologyIndex, (value) => value.toFixed(1)),
        },
      ];
    },
  },
  {
    id: "year_2020",
    title: "抵达 2020 年",
    description: "长期国力积累进入当代窗口。",
    resolveReachedYear: (game) => resolveYearNode(game, 2020),
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "综合评分",
          value: data.score === null ? "—" : data.score.toFixed(1),
        },
        {
          label: "人均美元",
          value: formatOrDash(data.currentUSDGDPPerCapita, formatUsd),
        },
      ];
    },
  },
  {
    id: "gdp_rank_10",
    title: "GDP 进入世界前十",
    description: "名义 GDP 跻身全球前十经济体。",
    resolveReachedYear: (game) => resolveRankMilestoneYear(game, 10),
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "GDP 世界排名",
          value: data.gdpRank === null ? "—" : `第 ${data.gdpRank} 名`,
        },
        {
          label: "实际 GDP",
          value: formatOrDash(data.realGDP, formatLarge),
        },
      ];
    },
  },
  {
    id: "gdp_rank_5",
    title: "GDP 进入世界前五",
    description: "名义 GDP 进入全球五强。",
    resolveReachedYear: (game) => resolveRankMilestoneYear(game, 5),
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "GDP 世界排名",
          value: data.gdpRank === null ? "—" : `第 ${data.gdpRank} 名`,
        },
        {
          label: "人均美元",
          value: formatOrDash(data.currentUSDGDPPerCapita, formatUsd),
        },
      ];
    },
  },
  {
    id: "gdp_rank_2",
    title: "GDP 进入世界前二",
    description: "名义 GDP 站上全球前二。",
    resolveReachedYear: (game) => resolveRankMilestoneYear(game, 2),
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "GDP 世界排名",
          value: data.gdpRank === null ? "—" : `第 ${data.gdpRank} 名`,
        },
        {
          label: "综合评分",
          value: data.score === null ? "—" : data.score.toFixed(1),
        },
      ];
    },
  },
  {
    id: "gdp_rank_1",
    title: "GDP 全球第一",
    description: "名义 GDP 登顶世界第一，达成游戏胜利目标。",
    resolveReachedYear: (game) => {
      if (hasRecordedVictory(game)) return game.nation.victoryYear;
      return resolveRankMilestoneYear(game, 1);
    },
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "GDP 世界排名",
          value: data.gdpRank === null ? "—" : `第 ${data.gdpRank} 名`,
        },
        {
          label: "实际 GDP",
          value: formatOrDash(data.realGDP, formatLarge),
        },
        {
          label: "人均美元",
          value: formatOrDash(data.currentUSDGDPPerCapita, formatUsd),
        },
      ];
    },
  },
  {
    id: "urbanization_50",
    title: "城市化率过半",
    description: "城镇人口比重跨过 50%。",
    resolveReachedYear: (game) => {
      const fromHistory = firstYearWhen(
        game,
        (snapshot) => snapshot.urbanizationRate >= 0.5,
      );
      if (fromHistory !== null) return fromHistory;
      return game.nation.society.urbanizationRate >= 0.5
        ? game.nation.date.year
        : null;
    },
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "城市化",
          value: formatOrDash(data.urbanizationRate, formatPercent),
        },
        {
          label: "总人口",
          value: formatOrDash(data.population, formatLarge),
        },
      ];
    },
  },
  {
    id: "usd_pc_1000",
    title: "人均 GDP 破 1000 美元",
    description: "现价美元人均 GDP 跨过一千美元门槛。",
    resolveReachedYear: (game) => {
      const fromHistory = firstYearWhen(
        game,
        (snapshot) => snapshot.currentUSDGDPPerCapita >= 1000,
      );
      if (fromHistory !== null) return fromHistory;
      return game.nation.economy.currentUSDGDPPerCapita >= 1000
        ? game.nation.date.year
        : null;
    },
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "人均美元",
          value: formatOrDash(data.currentUSDGDPPerCapita, formatUsd),
        },
        {
          label: "实际 GDP",
          value: formatOrDash(data.realGDP, formatLarge),
        },
      ];
    },
  },
  {
    id: "usd_pc_10000",
    title: "人均 GDP 破 1 万美元",
    description: "现价美元人均 GDP 跨过一万美元门槛。",
    resolveReachedYear: (game) => {
      const fromHistory = firstYearWhen(
        game,
        (snapshot) => snapshot.currentUSDGDPPerCapita >= 10_000,
      );
      if (fromHistory !== null) return fromHistory;
      return game.nation.economy.currentUSDGDPPerCapita >= 10_000
        ? game.nation.date.year
        : null;
    },
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "人均美元",
          value: formatOrDash(data.currentUSDGDPPerCapita, formatUsd),
        },
        {
          label: "幸福度",
          value: formatOrDash(data.happinessIndex, (value) => value.toFixed(1)),
        },
      ];
    },
  },
  {
    id: "score_70",
    title: "综合评分达到 70",
    description: "年度综合评分迈入更高档位。",
    resolveReachedYear: (game) => {
      const fromHistory = firstYearWhen(game, (snapshot) => snapshot.score >= 70);
      if (fromHistory !== null) return fromHistory;
      const latest = game.nation.history.annual.at(-1)?.score;
      return typeof latest === "number" && latest >= 70 ? game.nation.date.year : null;
    },
    metrics: (game, reachedYear) => {
      const data = snapshotOrCurrentLive(game, reachedYear);
      return [
        {
          label: "综合评分",
          value: data.score === null ? "—" : data.score.toFixed(1),
        },
        {
          label: "科技指数",
          value: formatOrDash(data.technologyIndex, (value) => value.toFixed(1)),
        },
      ];
    },
  },
];

/** 列出本局已解锁里程碑，最近达成的排在前面。 */
export function listUnlockedMilestones(game: GameState): UnlockedShareMilestone[] {
  const unlocked: UnlockedShareMilestone[] = [];
  for (const definition of shareMilestoneDefinitions) {
    const reachedYear = definition.resolveReachedYear(game);
    if (reachedYear === null) continue;
    unlocked.push({
      id: definition.id,
      title: definition.title,
      description: definition.description,
      reachedYear,
      metrics: definition.metrics(game, reachedYear),
    });
  }
  unlocked.sort((left, right) => {
    if (right.reachedYear !== left.reachedYear) {
      return right.reachedYear - left.reachedYear;
    }
    return left.id.localeCompare(right.id, "zh-CN");
  });
  return unlocked;
}

export function findUnlockedMilestone(
  game: GameState,
  milestoneId: string | null | undefined,
): UnlockedShareMilestone | null {
  const unlocked = listUnlockedMilestones(game);
  if (unlocked.length === 0) return null;
  if (milestoneId) {
    const matched = unlocked.find((item) => item.id === milestoneId);
    if (matched) return matched;
  }
  return unlocked[0] ?? null;
}
