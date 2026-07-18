import historicalEconomicAnchors from "../../data/config/historical-economic-anchors.json";
import type { GameState } from "../state/game-state";

interface ConversionAnchor {
  year: number;
  factor: number;
}

const currentPriceAnchors =
  historicalEconomicAnchors.currentPriceGDPPerCapitaFactors as ConversionAnchor[];
const worldComparisonAnchors =
  historicalEconomicAnchors.worldGDPComparisonFactors as ConversionAnchor[];

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

/** 将中国游戏内不变价 GDP 折算到与世界轻量模型一致的比较尺度。 */
export function calculateWorldComparableGDP(
  realGDP: number,
  worldPriceLevel: number,
  year: number,
): number {
  return Math.max(0, realGDP) * Math.max(0, worldPriceLevel) *
    interpolateFactor(worldComparisonAnchors, year);
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
  for (const snapshot of nation.history.annual) {
    snapshot.currentPriceGDPPerCapita =
      Number.isFinite(snapshot.currentPriceGDPPerCapita)
        ? snapshot.currentPriceGDPPerCapita
        : calculateCurrentPriceGDPPerCapita(
            snapshot.realGDPPerCapita,
            snapshot.year,
          );
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
