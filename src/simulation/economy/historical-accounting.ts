import historicalEconomicAnchors from "../../data/config/historical-economic-anchors.json";
import type { GameState } from "../state/game-state";

interface ConversionAnchor {
  year: number;
  factor: number;
}

interface GlobalRankAnchor {
  year: number;
  referenceUSD: number;
  rank: number;
  participants: number;
}

export interface GlobalGDPPerCapitaStanding {
  rank: number;
  participants: number;
}

const currentPriceAnchors =
  historicalEconomicAnchors.currentPriceGDPPerCapitaFactors as ConversionAnchor[];
const currentUSDAnchors =
  historicalEconomicAnchors.currentUSDGDPPerCapitaFactors as ConversionAnchor[];
const worldComparisonAnchors =
  historicalEconomicAnchors.worldGDPComparisonFactors as ConversionAnchor[];
const worldPeerNominalGDPScaleAnchors =
  (historicalEconomicAnchors as {
    worldPeerNominalGDPScaleFactors?: ConversionAnchor[];
  }).worldPeerNominalGDPScaleFactors ?? [
    { year: 1949, factor: 1 },
    { year: 2026, factor: 1 },
  ];
const globalRankAnchors =
  historicalEconomicAnchors.globalGDPPerCapitaRankAnchors as GlobalRankAnchor[];

function interpolateFactor(anchors: ConversionAnchor[], year: number): number {
  const sorted = anchors.toSorted((left, right) => left.year - right.year);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) throw new Error("历史经济折算锚点不能为空");
  if (year <= first.year) return first.factor;
  if (year >= last.year) return last.factor;

  const upperIndex = sorted.findIndex((anchor) => anchor.year >= year);
  const lower = sorted[upperIndex - 1];
  const upper = sorted[upperIndex];
  if (!lower || !upper) return first.factor;
  const progress = (year - lower.year) / (upper.year - lower.year);
  return lower.factor + (upper.factor - lower.factor) * progress;
}

export function calculateCurrentPriceGDPPerCapita(
  realGDPPerCapita: number,
  year: number,
): number {
  return Math.max(0, realGDPPerCapita) * interpolateFactor(
    currentPriceAnchors,
    year,
  );
}

export function calculateCurrentUSDGDPPerCapita(
  realGDPPerCapita: number,
  year: number,
): number {
  return Math.max(0, realGDPPerCapita) * interpolateFactor(
    currentUSDAnchors,
    year,
  );
}

function interpolateGlobalRankAnchor(year: number): GlobalRankAnchor {
  const sorted = globalRankAnchors.toSorted((left, right) => left.year - right.year);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) throw new Error("全球人均 GDP 排名锚点不能为空");
  if (year <= first.year) return first;
  if (year >= last.year) return last;

  const upperIndex = sorted.findIndex((anchor) => anchor.year >= year);
  const lower = sorted[upperIndex - 1];
  const upper = sorted[upperIndex];
  if (!lower || !upper) return first;
  const progress = (year - lower.year) / (upper.year - lower.year);
  return {
    year,
    referenceUSD: lower.referenceUSD +
      (upper.referenceUSD - lower.referenceUSD) * progress,
    rank: lower.rank + (upper.rank - lower.rank) * progress,
    participants: lower.participants +
      (upper.participants - lower.participants) * progress,
  };
}

/**
 * 用公开排名锚点恢复完整全球口径，并让非史实路线按收入偏离连续移动。
 * 轻量世界系统只模拟主要经济体，不能直接代表全部参评国家和地区。
 */
export function calculateGlobalGDPPerCapitaStanding(
  currentUSDGDPPerCapita: number,
  year: number,
): GlobalGDPPerCapitaStanding {
  const anchor = interpolateGlobalRankAnchor(year);
  const participants = Math.max(1, Math.round(anchor.participants));
  const relativeIncome = Math.max(currentUSDGDPPerCapita, 1) /
    Math.max(anchor.referenceUSD, 1);
  const rankAdjustment = Math.log2(relativeIncome) *
    historicalEconomicAnchors.rankSensitivityPerIncomeDoubling;
  return {
    rank: Math.min(
      participants,
      Math.max(1, Math.round(anchor.rank - rankAdjustment)),
    ),
    participants,
  };
}

/** 将中国游戏内不变价 GDP 折算到与世界银行名义美元口径一致的国际比较尺度。 */
export function calculateWorldComparableGDP(
  realGDP: number,
  worldPriceLevel: number,
  year: number,
): number {
  return Math.max(0, realGDP) * Math.max(0, worldPriceLevel) *
    interpolateFactor(worldComparisonAnchors, year);
}

/**
 * 轻量世界国家名义 GDP 相对世界银行中国名义口径的统一缩放。
 * 用于排名与影响力份额，不改写各国内部产出状态。
 */
export function calculateWorldPeerNominalGDPScale(year: number): number {
  return Math.max(0, interpolateFactor(worldPeerNominalGDPScaleAnchors, year));
}

export function ensureHistoricalAccountingState(state: GameState): void {
  const { nation } = state;
  nation.economy.currentPriceGDPPerCapita =
    Number.isFinite(nation.economy.currentPriceGDPPerCapita)
      ? nation.economy.currentPriceGDPPerCapita
      : calculateCurrentPriceGDPPerCapita(
          nation.economy.realGDPPerCapita,
          nation.date.year,
        );
  nation.economy.currentUSDGDPPerCapita =
    Number.isFinite(nation.economy.currentUSDGDPPerCapita)
      ? nation.economy.currentUSDGDPPerCapita
      : calculateCurrentUSDGDPPerCapita(
          nation.economy.realGDPPerCapita,
          nation.date.year,
        );
  const currentStanding = calculateGlobalGDPPerCapitaStanding(
    nation.economy.currentUSDGDPPerCapita,
    nation.date.year,
  );
  nation.economy.globalGDPPerCapitaRank =
    Number.isFinite(nation.economy.globalGDPPerCapitaRank)
      ? nation.economy.globalGDPPerCapitaRank
      : currentStanding.rank;
  nation.economy.globalGDPPerCapitaParticipants =
    Number.isFinite(nation.economy.globalGDPPerCapitaParticipants)
      ? nation.economy.globalGDPPerCapitaParticipants
      : currentStanding.participants;
  for (const snapshot of nation.history.annual) {
    snapshot.currentPriceGDPPerCapita =
      Number.isFinite(snapshot.currentPriceGDPPerCapita)
        ? snapshot.currentPriceGDPPerCapita
        : calculateCurrentPriceGDPPerCapita(
            snapshot.realGDPPerCapita,
            snapshot.year,
          );
    snapshot.currentUSDGDPPerCapita =
      Number.isFinite(snapshot.currentUSDGDPPerCapita)
        ? snapshot.currentUSDGDPPerCapita
        : calculateCurrentUSDGDPPerCapita(
            snapshot.realGDPPerCapita,
            snapshot.year,
          );
    const snapshotStanding = calculateGlobalGDPPerCapitaStanding(
      snapshot.currentUSDGDPPerCapita,
      snapshot.year,
    );
    snapshot.gdpPerCapitaRank = Number.isFinite(snapshot.gdpPerCapitaRank)
      ? snapshot.gdpPerCapitaRank
      : snapshotStanding.rank;
    snapshot.gdpPerCapitaRankParticipants = Number.isFinite(
      snapshot.gdpPerCapitaRankParticipants,
    )
      ? snapshot.gdpPerCapitaRankParticipants
      : snapshotStanding.participants;
  }
  nation.economy.internationalComparableGDP =
    Number.isFinite(nation.economy.internationalComparableGDP)
      ? nation.economy.internationalComparableGDP
      : calculateWorldComparableGDP(
          nation.economy.realGDP,
          state.world.worldPriceLevel,
          nation.date.year,
        );
}
