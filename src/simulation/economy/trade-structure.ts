import structureData from "../../data/config/world-trade-structure.json";
import { clamp, safeDivide } from "../core/math";
import type { GameState } from "../state/game-state";
import type { WorldTradeNetworkState } from "../state/world-state";
import {
  ensureIndustrialStructureState,
  industrialCategoryDefinitions,
} from "./industrial-structure";

interface StructureConfig {
  gdpWeightExponent: number;
  sanctionTariffPenalty: number;
  tradeBarrierExportPenalty: number;
  diversificationWeightFloor: number;
  partnerGroups: Record<string, string[]>;
  categoryGroupAffinity: Record<string, Record<string, number>>;
  categoryTariffSensitivity: Record<string, number>;
}

const structureConfig = structureData as StructureConfig;
const INDUSTRIAL_CATEGORY_IDS = industrialCategoryDefinitions.map((item) => item.id);
const OTHER_EXPORTS_KEY = "other_exports";

function emptyCategoryPartnerExports(): WorldTradeNetworkState["categoryPartnerExports"] {
  return { industrial: {}, other: {} };
}

export function createEmptyTradeStructureState(): Pick<
  WorldTradeNetworkState,
  | "categoryPartnerExports"
  | "categoryExportError"
  | "otherExportError"
  | "tradeBarrierExposure"
  | "categoryConcentrationIndex"
> {
  return {
    categoryPartnerExports: emptyCategoryPartnerExports(),
    categoryExportError: 0,
    otherExportError: 0,
    tradeBarrierExposure: 0,
    categoryConcentrationIndex: 0,
  };
}

export function ensureTradeStructureState(state: GameState): void {
  const network = state.world.tradeNetwork;
  const defaults = createEmptyTradeStructureState();
  if (!network.categoryPartnerExports?.industrial) {
    network.categoryPartnerExports = defaults.categoryPartnerExports;
  }
  if (!network.categoryPartnerExports.other) {
    network.categoryPartnerExports.other = {};
  }
  if (!Number.isFinite(network.categoryExportError)) {
    network.categoryExportError = 0;
  }
  if (!Number.isFinite(network.otherExportError)) {
    network.otherExportError = 0;
  }
  if (!Number.isFinite(network.tradeBarrierExposure)) {
    network.tradeBarrierExposure = 0;
  }
  if (!Number.isFinite(network.categoryConcentrationIndex)) {
    network.categoryConcentrationIndex = 0;
  }
}

function buildCategoryPartnerMatrix(
  state: GameState,
  categoryTotals: Record<string, number>,
  categoryIds: string[],
): Record<string, Record<string, number>> {
  const { nation, world } = state;
  const network = world.tradeNetwork;
  const countries = world.countries;
  const totalExports = nation.trade.exports;
  const matrix: Record<string, Record<string, number>> = Object.fromEntries(
    categoryIds.map((categoryId) => [categoryId, {}]),
  );
  for (const country of countries) {
    const partnerExport = network.partners[country.id]?.exports ?? 0;
    for (const categoryId of categoryIds) {
      matrix[categoryId][country.id] = totalExports > 0
        ? partnerExport * safeDivide(categoryTotals[categoryId] ?? 0, totalExports)
        : 0;
    }
  }
  return matrix;
}

/** 按品类与伙伴分解出口结构，并在伙伴层面对齐既有跨境总量。 */
export function updateTradeStructure(state: GameState): void {
  ensureTradeStructureState(state);
  const { nation, world } = state;
  const network = world.tradeNetwork;
  const totalExports = nation.trade.exports;
  ensureIndustrialStructureState(nation);
  const categoryTotals = Object.fromEntries(
    INDUSTRIAL_CATEGORY_IDS.map((id) => [id, nation.industries[id].exportValue]),
  );
  const industrialTotal = INDUSTRIAL_CATEGORY_IDS.reduce(
    (sum, id) => sum + nation.industries[id].exportValue,
    0,
  );
  const otherTotal = Math.max(0, totalExports - industrialTotal);
  categoryTotals[OTHER_EXPORTS_KEY] = otherTotal;
  const categoryIds = [...INDUSTRIAL_CATEGORY_IDS, OTHER_EXPORTS_KEY];
  const combinedMatrix = buildCategoryPartnerMatrix(state, categoryTotals, categoryIds);
  const industrialMatrix = Object.fromEntries(
    INDUSTRIAL_CATEGORY_IDS.map((id) => [id, combinedMatrix[id] ?? {}]),
  );
  const otherMatrix = combinedMatrix[OTHER_EXPORTS_KEY] ?? {};
  network.categoryPartnerExports = {
    industrial: industrialMatrix,
    other: otherMatrix,
  };
  network.categoryExportError = INDUSTRIAL_CATEGORY_IDS.reduce((max, id) => {
    const allocated = Object.values(industrialMatrix[id] ?? {}).reduce(
      (sum, value) => sum + value,
      0,
    );
    return Math.max(
      max,
      Math.abs(allocated - nation.industries[id].exportValue),
    );
  }, 0);
  network.otherExportError = Math.abs(
    Object.values(otherMatrix).reduce((sum, value) => sum + value, 0) - otherTotal,
  );
  const categoryValues = [
    ...INDUSTRIAL_CATEGORY_IDS.map((id) => nation.industries[id].exportValue),
    otherTotal,
  ];
  const categorySum = categoryValues.reduce((sum, value) => sum + value, 0);
  network.categoryConcentrationIndex = categorySum > 0
    ? categoryValues.reduce(
        (sum, value) => sum + safeDivide(value, categorySum) ** 2,
        0,
      )
    : 0;
  network.tradeBarrierExposure = calculateTradeBarrierExposure(state);
}

/** 品类关税敏感度与伙伴制裁共同形成出口壁垒暴露，反馈到出口竞争力。 */
export function calculateTradeBarrierExposure(state: GameState): number {
  ensureIndustrialStructureState(state.nation);
  const { nation, world } = state;
  const totalExports = nation.trade.exports;
  if (totalExports <= 0) return 0;
  const industrialTotal = INDUSTRIAL_CATEGORY_IDS.reduce(
    (sum, id) => sum + nation.industries[id].exportValue,
    0,
  );
  const otherTotal = Math.max(0, totalExports - industrialTotal);
  const categoryWeights = [
    ...INDUSTRIAL_CATEGORY_IDS.map((id) => ({
      id,
      share: nation.industries[id].exportValue / totalExports,
    })),
    { id: OTHER_EXPORTS_KEY, share: otherTotal / totalExports },
  ];
  let exposure = 0;
  for (const category of categoryWeights) {
    if (category.share <= 0) continue;
    const tariffSensitivity =
      structureConfig.categoryTariffSensitivity[category.id] ?? 0.5;
    let partnerBarrier = 0;
    for (const country of world.countries) {
      const partnerShare = safeDivide(
        world.tradeNetwork.partners[country.id]?.exports ?? 0,
        totalExports,
      );
      partnerBarrier += partnerShare * country.sanctionLevel * tariffSensitivity;
    }
    exposure += category.share * partnerBarrier;
  }
  return clamp(exposure, 0, 1);
}

/** 贸易壁垒经中间变量削弱出口竞争力，不直接改写 GDP。 */
export function calculateTradeBarrierExportMultiplier(state: GameState): number {
  ensureTradeStructureState(state);
  const exposure = Number.isFinite(state.world.tradeNetwork.tradeBarrierExposure)
    ? state.world.tradeNetwork.tradeBarrierExposure
    : calculateTradeBarrierExposure(state);
  return clamp(
    1 - exposure * structureConfig.tradeBarrierExportPenalty,
    0.55,
    1,
  );
}

export function categoryExportByPartner(
  network: WorldTradeNetworkState,
  categoryId: string,
  partnerId: string,
): number {
  if (categoryId === OTHER_EXPORTS_KEY) {
    return network.categoryPartnerExports.other[partnerId] ?? 0;
  }
  return network.categoryPartnerExports.industrial[categoryId]?.[partnerId] ?? 0;
}

export { INDUSTRIAL_CATEGORY_IDS, OTHER_EXPORTS_KEY };
