import type { GameState } from "../../simulation/state/game-state";
import type { AnnualSnapshot } from "../../simulation/state/history-state";
import { hasRecordedVictory } from "../../simulation/victory/victory";
import { formatLarge, formatPercent, formatUsd } from "../format";

export interface VictoryStatRow {
  label: string;
  value: string;
  detail?: string;
}

export interface VictorySummary {
  victoryYear: number;
  yearsPlayed: number;
  seed: number;
  hero: VictoryStatRow;
  metrics: VictoryStatRow[];
}

function annualAt(game: GameState, year: number): AnnualSnapshot | null {
  return game.nation.history.annual.find((snapshot) => snapshot.year === year) ?? null;
}

function resolveVictorySnapshot(
  game: GameState,
  victoryYear: number,
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
  const snapshot = annualAt(game, victoryYear);
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

  return {
    realGDP: game.nation.economy.realGDP,
    population: game.nation.population.total,
    currentUSDGDPPerCapita: game.nation.economy.currentUSDGDPPerCapita,
    urbanizationRate: game.nation.society.urbanizationRate,
    gdpRank: game.world.rankings.nominalGDP.china ?? null,
    score: game.nation.history.annual.at(-1)?.score ?? null,
    technologyIndex: game.nation.technology.index,
    happinessIndex: game.nation.society.happinessIndex,
  };
}

/** 构建胜利页面展示数据，优先使用达成年度的年度快照。 */
export function buildVictorySummary(game: GameState): VictorySummary | null {
  if (!hasRecordedVictory(game)) return null;

  const victoryYear = game.nation.victoryYear as number;

  const data = resolveVictorySnapshot(game, victoryYear);
  const startYear = 1949;

  return {
    victoryYear,
    yearsPlayed: victoryYear - startYear,
    seed: game.seed,
    hero: {
      label: "名义 GDP 世界排名",
      value: "第 1 名",
      detail: `${victoryYear} 年登顶全球经济体`,
    },
    metrics: [
      {
        label: "实际 GDP",
        value: formatLarge(data.realGDP),
      },
      {
        label: "人均 GDP（美元）",
        value: formatUsd(data.currentUSDGDPPerCapita),
      },
      {
        label: "总人口",
        value: formatLarge(data.population),
        detail: `城镇化 ${formatPercent(data.urbanizationRate)}`,
      },
      {
        label: "综合评分",
        value: data.score === null ? "—" : data.score.toFixed(1),
      },
      {
        label: "科技指数",
        value: data.technologyIndex.toFixed(1),
      },
      {
        label: "幸福度",
        value: data.happinessIndex.toFixed(1),
      },
      {
        label: "历时",
        value: `${victoryYear - startYear} 年`,
        detail: `${startYear} 年起局 · 种子 ${game.seed}`,
      },
    ],
  };
}
