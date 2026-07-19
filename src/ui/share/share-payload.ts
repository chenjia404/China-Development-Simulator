import type { ComparisonTargetId } from "../../simulation/reports/historical-comparison";
import {
  compareSimulationWithTarget,
  comparisonTargetOptions,
} from "../../simulation/reports/historical-comparison";
import type { GameState } from "../../simulation/state/game-state";
import { formatLarge, formatPercent, formatUsd, formatUsdLarge } from "../format";
import {
  findUnlockedMilestone,
  listUnlockedMilestones,
  type UnlockedShareMilestone,
} from "./milestones";
import { SHARE_BRAND } from "./share-brand";

export type ShareCardType = "score" | "milestone" | "compare";

export {
  SHARE_BRAND,
  SHARE_POSTER_HEIGHT,
  SHARE_POSTER_WIDTH,
  SHARE_SLOGAN,
} from "./share-brand";

export interface ShareMetricRow {
  label: string;
  value: string;
  detail?: string;
}

export interface ShareScoreCard {
  type: "score";
  title: string;
  subtitle: string;
  /** 手机上优先放大的主指标。 */
  hero: ShareMetricRow;
  metrics: ShareMetricRow[];
}

export interface ShareMilestoneCard {
  type: "milestone";
  title: string;
  subtitle: string;
  milestone: UnlockedShareMilestone;
  hero: ShareMetricRow;
  metrics: ShareMetricRow[];
}

export interface ShareCompareCard {
  type: "compare";
  title: string;
  subtitle: string;
  targetId: ComparisonTargetId;
  targetLabel: string;
  year: number;
  usesUSD: boolean;
  hero: ShareMetricRow;
  metrics: ShareMetricRow[];
}

export type ShareCardPayload =
  | ShareScoreCard
  | ShareMilestoneCard
  | ShareCompareCard;

export interface ShareBuildOptions {
  cardType: ShareCardType;
  comparisonTargetId?: ComparisonTargetId;
  milestoneId?: string | null;
  pageUrl?: string;
}

export interface SharePayload {
  card: ShareCardPayload;
  /** 实际用于海报的类型；里程碑无可展示时回退成绩卡。 */
  effectiveType: ShareCardType;
  /** 剪贴板文案（含页面链接）。 */
  copyText: string;
  /** 系统分享文案（不含链接，链接走 url 字段）。 */
  shareText: string;
  fileName: string;
}

function differenceLabel(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatPercent(value)}`;
}

function scoreCaption(game: GameState): string {
  const rank = game.world.rankings.nominalGDP.china;
  const score = game.nation.history.annual.at(-1)?.score;
  const rankText = typeof rank === "number" ? `GDP世界第${rank}` : "GDP排名待定";
  const scoreText = typeof score === "number" ? `评分${score.toFixed(1)}` : "评分待定";
  return `${rankText}，${scoreText}`;
}

export function buildScoreCard(game: GameState): ShareScoreCard {
  const { year, month } = game.nation.date;
  const lastAnnual = game.nation.history.annual.at(-1);
  const rank = game.world.rankings.nominalGDP.china;
  return {
    type: "score",
    title: "本局成绩",
    subtitle: `${year}年${month}月`,
    hero: {
      label: "GDP 世界排名",
      value: typeof rank === "number" ? `第 ${rank} 名` : "—",
    },
    metrics: [
      { label: "实际 GDP", value: formatLarge(game.nation.economy.realGDP) },
      {
        label: "人均美元",
        value: formatUsd(game.nation.economy.currentUSDGDPPerCapita),
      },
      {
        label: "总人口",
        value: formatLarge(game.nation.population.total),
        detail: `城镇化 ${formatPercent(game.nation.society.urbanizationRate)}`,
      },
      {
        label: "综合评分",
        value: typeof lastAnnual?.score === "number"
          ? lastAnnual.score.toFixed(1)
          : "—",
      },
    ],
  };
}

export function buildMilestoneCard(
  game: GameState,
  milestoneId?: string | null,
): ShareMilestoneCard | null {
  const milestone = findUnlockedMilestone(game, milestoneId);
  if (!milestone) return null;
  const [first, ...rest] = milestone.metrics;
  const hero = first ?? { label: "里程碑", value: milestone.title };
  return {
    type: "milestone",
    title: milestone.title,
    subtitle: `${milestone.reachedYear}年达成`,
    milestone,
    hero,
    metrics: rest.slice(0, 2).map((metric) => ({
      label: metric.label,
      value: metric.value,
    })),
  };
}

export function buildCompareCard(
  game: GameState,
  targetId: ComparisonTargetId = "history",
): ShareCompareCard | null {
  const comparison = compareSimulationWithTarget(
    game.nation.history.annual,
    targetId,
  );
  const latest = comparison.rows.at(-1);
  if (!latest) return null;

  const usesUSD = comparison.valueBasis === "current_usd";
  const shortTarget = comparison.targetLabel.replace(/^中国真实/, "");

  return {
    type: "compare",
    title: "发展对比",
    subtitle: `${latest.year}年 · ${shortTarget}`,
    targetId: comparison.targetId,
    targetLabel: comparison.targetLabel,
    year: latest.year,
    usesUSD,
    hero: {
      label: usesUSD ? "GDP（美元）" : "实际 GDP",
      value: usesUSD
        ? formatUsdLarge(latest.gdp.simulated)
        : formatLarge(latest.gdp.simulated),
      detail: `对标 ${differenceLabel(latest.gdp.relativeDifference)}`,
    },
    metrics: [
      {
        label: usesUSD ? "人均美元" : "人均 GDP",
        value: usesUSD
          ? formatUsd(latest.gdpPerCapita.simulated)
          : formatLarge(latest.gdpPerCapita.simulated),
        detail: `对标 ${differenceLabel(latest.gdpPerCapita.relativeDifference)}`,
      },
      {
        label: "总人口",
        value: formatLarge(latest.population.simulated),
        detail: `对标 ${differenceLabel(latest.population.relativeDifference)}`,
      },
      {
        label: "世界排名",
        value: latest.gdpRank ? `第 ${latest.gdpRank.simulated} 名` : "—",
        detail: latest.gdpRank
          ? `对标第 ${latest.gdpRank.target} 名 · ${
            latest.gdpRank.difference === 0
              ? "持平"
              : latest.gdpRank.difference < 0
                ? `领先${Math.abs(latest.gdpRank.difference)}位`
                : `落后${latest.gdpRank.difference}位`
          }`
          : "暂无排名",
      },
    ],
  };
}

function buildCopyText(
  game: GameState,
  card: ShareCardPayload,
  pageUrl?: string,
): string {
  const { year, month } = game.nation.date;
  // 手机剪贴板优先短句，方便微信等多行粘贴
  if (card.type === "milestone") {
    const body = `【${SHARE_BRAND}】${card.milestone.reachedYear}年达成「${card.milestone.title}」：${card.hero.label} ${card.hero.value}`;
    return pageUrl ? `${body}\n${pageUrl}` : body;
  }
  if (card.type === "compare") {
    const body = `【${SHARE_BRAND}】${card.year}年对标${card.targetLabel} ${card.hero.value}（${card.hero.detail ?? ""}）·当前${year}.${month}`;
    return pageUrl ? `${body}\n${pageUrl}` : body;
  }
  const body = `【${SHARE_BRAND}】玩到${year}年${month}月：${scoreCaption(game)}`;
  return pageUrl ? `${body}\n${pageUrl}` : body;
}

/** 系统分享用文案：不附带 URL，由 Web Share 的 url 字段单独传递，避免重复。 */
export function buildShareTextWithoutUrl(
  game: GameState,
  card: ShareCardPayload,
): string {
  return buildCopyText(game, card);
}

function buildFileName(game: GameState, card: ShareCardPayload): string {
  const { year, month } = game.nation.date;
  const stamp = `${year}-${String(month).padStart(2, "0")}`;
  if (card.type === "milestone") return `china-dev-sim-milestone-${card.milestone.id}-${stamp}.png`;
  if (card.type === "compare") return `china-dev-sim-compare-${card.targetId}-${stamp}.png`;
  return `china-dev-sim-score-${stamp}.png`;
}

/**
 * 从局内状态构建社交分享海报数据与文案。
 * 里程碑无可展示或对比尚无比对行时，回退到成绩卡。
 */
export function buildSharePayload(
  game: GameState,
  options: ShareBuildOptions,
): SharePayload {
  let card: ShareCardPayload | null = null;
  let effectiveType: ShareCardType = options.cardType;

  if (options.cardType === "milestone") {
    card = buildMilestoneCard(game, options.milestoneId);
    if (!card) {
      card = buildScoreCard(game);
      effectiveType = "score";
    }
  } else if (options.cardType === "compare") {
    card = buildCompareCard(game, options.comparisonTargetId ?? "history");
    if (!card) {
      card = buildScoreCard(game);
      effectiveType = "score";
    }
  } else {
    card = buildScoreCard(game);
  }

  return {
    card,
    effectiveType,
    copyText: buildCopyText(game, card, options.pageUrl),
    shareText: buildShareTextWithoutUrl(game, card),
    fileName: buildFileName(game, card),
  };
}

export function availableShareMilestones(game: GameState): UnlockedShareMilestone[] {
  return listUnlockedMilestones(game);
}

export function availableComparisonTargets() {
  return comparisonTargetOptions;
}
