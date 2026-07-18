import industrialCategoryConfig from "../../data/config/industrial-categories.json";
import { approach, clamp, safeDivide } from "../core/math";
import type {
  IndustrialCategoryId,
  IndustrialCategoryState,
  NationState,
} from "../state/game-state";

export interface IndustrialCategoryDefinition {
  id: IndustrialCategoryId;
  name: string;
  description: string;
  baselineShare: number;
  productivityPotential: number;
  energyIntensity: number;
  skillIntensity: number;
  exportPropensity: number;
  requiredEducationIndex: number;
  requiredTechnologyIndex: number;
  requiredTechnologyIds: string[];
}

export interface IndustrialStructureMetrics {
  complexityIndex: number;
  outputMultiplier: number;
  exportCapability: number;
  industrialExportShare: number;
  highTechnologyShare: number;
}

export const industrialCategoryDefinitions =
  industrialCategoryConfig.categories as IndustrialCategoryDefinition[];

const INDUSTRIAL_CATEGORY_IDS: IndustrialCategoryId[] = [
  "mining_energy",
  "basic_materials",
  "consumer_goods",
  "construction",
  "general_machinery",
  "transport_equipment",
  "chemicals_pharmaceuticals",
  "electrical_equipment",
  "electronics_communications",
  "precision_medical",
  "aerospace_advanced",
];

const HIGH_TECHNOLOGY_IDS = new Set<IndustrialCategoryId>([
  "chemicals_pharmaceuticals",
  "electrical_equipment",
  "electronics_communications",
  "precision_medical",
  "aerospace_advanced",
]);

function definitionFor(id: IndustrialCategoryId): IndustrialCategoryDefinition {
  const definition = industrialCategoryDefinitions.find((item) => item.id === id);
  if (!definition) throw new Error(`缺少工业类别配置：${id}`);
  return definition;
}

export function validateIndustrialCategoryDefinitions(): void {
  const ids = new Set(industrialCategoryDefinitions.map((item) => item.id));
  if (ids.size !== INDUSTRIAL_CATEGORY_IDS.length) {
    throw new Error("工业类别配置存在缺失或重复标识");
  }
  for (const id of INDUSTRIAL_CATEGORY_IDS) {
    if (!ids.has(id)) throw new Error(`工业类别配置缺少：${id}`);
  }
  const baselineShare = industrialCategoryDefinitions.reduce(
    (sum, item) => sum + item.baselineShare,
    0,
  );
  if (Math.abs(baselineShare - 1) > 1e-9) {
    throw new Error(`工业类别基准份额之和必须为1，当前为${baselineShare}`);
  }
}

function createCategoryState(
  id: IndustrialCategoryId,
  secondaryOutput: number,
): IndustrialCategoryState {
  const definition = definitionFor(id);
  return {
    id,
    output: secondaryOutput * definition.baselineShare,
    valueAdded: secondaryOutput * definition.baselineShare,
    outputShare: definition.baselineShare,
    exportValue: 0,
    technologyReadiness: 0,
    productivityIndex: definition.productivityPotential * 62,
  };
}

export function createInitialIndustrialCategories(
  secondaryOutput: number,
): Record<IndustrialCategoryId, IndustrialCategoryState> {
  return {
    mining_energy: createCategoryState("mining_energy", secondaryOutput),
    basic_materials: createCategoryState("basic_materials", secondaryOutput),
    consumer_goods: createCategoryState("consumer_goods", secondaryOutput),
    construction: createCategoryState("construction", secondaryOutput),
    general_machinery: createCategoryState("general_machinery", secondaryOutput),
    transport_equipment: createCategoryState("transport_equipment", secondaryOutput),
    chemicals_pharmaceuticals: createCategoryState(
      "chemicals_pharmaceuticals",
      secondaryOutput,
    ),
    electrical_equipment: createCategoryState("electrical_equipment", secondaryOutput),
    electronics_communications: createCategoryState(
      "electronics_communications",
      secondaryOutput,
    ),
    precision_medical: createCategoryState("precision_medical", secondaryOutput),
    aerospace_advanced: createCategoryState("aerospace_advanced", secondaryOutput),
  };
}

/** 为旧存档确定性重建工业细分结构，不改变第二产业总量。 */
export function ensureIndustrialStructureState(nation: NationState): void {
  const existing = nation.industries as Partial<
    Record<IndustrialCategoryId, Partial<IndustrialCategoryState>>
  > | undefined;
  const existingShareTotal = existing
    ? INDUSTRIAL_CATEGORY_IDS.reduce(
        (sum, id) => sum + (existing[id]?.outputShare ?? 0),
        0,
      )
    : 0;
  const existingIsComplete = existing !== undefined &&
    Math.abs(existingShareTotal - 1) < 1e-9 &&
    INDUSTRIAL_CATEGORY_IDS.every((id) => {
      const category = existing[id];
      return category?.id === id &&
        Number.isFinite(category.output) &&
        Number.isFinite(category.valueAdded) &&
        Number.isFinite(category.outputShare) &&
        Number.isFinite(category.exportValue) &&
        Number.isFinite(category.technologyReadiness) &&
        Number.isFinite(category.productivityIndex);
    });
  if (existingIsComplete) return;
  const fallback = createInitialIndustrialCategories(
    Math.max(0, nation.sectors.secondary.output),
  );
  nation.industries = createInitialIndustrialCategories(0);
  for (const id of INDUSTRIAL_CATEGORY_IDS) {
    const source = existing?.[id];
    const base = fallback[id];
    nation.industries[id] = {
      id,
      output: Number.isFinite(source?.output) ? Math.max(0, source?.output ?? 0) : base.output,
      valueAdded: Number.isFinite(source?.valueAdded)
        ? Math.max(0, source?.valueAdded ?? 0)
        : base.valueAdded,
      outputShare: Number.isFinite(source?.outputShare)
        ? clamp(source?.outputShare ?? 0, 0, 1)
        : base.outputShare,
      exportValue: Number.isFinite(source?.exportValue)
        ? Math.max(0, source?.exportValue ?? 0)
        : 0,
      technologyReadiness: Number.isFinite(source?.technologyReadiness)
        ? clamp(source?.technologyReadiness ?? 0, 0, 1)
        : 0,
      productivityIndex: Number.isFinite(source?.productivityIndex)
        ? Math.max(0, source?.productivityIndex ?? 0)
        : base.productivityIndex,
    };
  }
  normalizeIndustrialShares(nation);
}

function normalizeIndustrialShares(nation: NationState): void {
  const totalShare = INDUSTRIAL_CATEGORY_IDS.reduce(
    (sum, id) => sum + nation.industries[id].outputShare,
    0,
  );
  if (totalShare <= 0) {
    for (const id of INDUSTRIAL_CATEGORY_IDS) {
      nation.industries[id].outputShare = definitionFor(id).baselineShare;
    }
    return;
  }
  for (const id of INDUSTRIAL_CATEGORY_IDS) {
    nation.industries[id].outputShare /= totalShare;
  }
}

function technologyReadiness(
  nation: NationState,
  definition: IndustrialCategoryDefinition,
): number {
  const educationGate = clamp(
    nation.education.index / Math.max(1, definition.requiredEducationIndex),
    0,
    1,
  );
  const technologyGate = clamp(
    nation.technology.index / Math.max(1, definition.requiredTechnologyIndex),
    0,
    1,
  );
  const capabilityGate = Math.min(educationGate, technologyGate);
  if (definition.requiredTechnologyIds.length === 0) return capabilityGate;
  const completedCount = definition.requiredTechnologyIds.filter((id) =>
    nation.technology.completedTechnologyIds.includes(id)
  ).length;
  const nodeCoverage = completedCount / definition.requiredTechnologyIds.length;
  return clamp(nodeCoverage * 0.68 + capabilityGate * 0.32, 0, 1);
}

function demandFactor(
  nation: NationState,
  definition: IndustrialCategoryDefinition,
): number {
  const consumptionShare = clamp(
    safeDivide(nation.economy.householdConsumption, nation.economy.nominalGDP),
    0.2,
    0.8,
  );
  const investmentShare = clamp(
    safeDivide(nation.economy.investment, nation.economy.nominalGDP),
    0.05,
    0.65,
  );
  if (definition.id === "consumer_goods") return 0.75 + consumptionShare * 0.55;
  if (definition.id === "construction") {
    return 0.72 + investmentShare * 0.55 + nation.society.urbanizationRate * 0.25;
  }
  if (definition.id === "mining_energy" || definition.id === "basic_materials") {
    return 0.86 + investmentShare * 0.35;
  }
  return 0.82 + nation.trade.openness * definition.exportPropensity * 0.6;
}

/** 更新各工业类别的能力与份额目标；份额调整缓慢，避免科技完成当月结构瞬跳。 */
export function updateIndustrialStructure(nation: NationState): void {
  ensureIndustrialStructureState(nation);
  const targetWeights = new Map<IndustrialCategoryId, number>();
  let totalWeight = 0;
  for (const definition of industrialCategoryDefinitions) {
    const category = nation.industries[definition.id];
    const readiness = technologyReadiness(nation, definition);
    const skillFactor = clamp(
      1 - definition.skillIntensity * (1 - nation.education.index / 100) * 0.55,
      0.45,
      1,
    );
    const energyFactor = clamp(
      1 - definition.energyIntensity * Math.max(0, 1 - nation.resources.energySupplyRatio) * 0.7,
      0.35,
      1.04,
    );
    const weight = definition.baselineShare *
      (0.66 + readiness * 0.72) *
      skillFactor *
      energyFactor *
      demandFactor(nation, definition);
    targetWeights.set(definition.id, weight);
    totalWeight += weight;
    category.technologyReadiness = readiness;
    category.productivityIndex = definition.productivityPotential *
      (62 + readiness * 38) *
      skillFactor *
      energyFactor;
  }
  for (const id of INDUSTRIAL_CATEGORY_IDS) {
    nation.industries[id].outputShare = approach(
      nation.industries[id].outputShare,
      safeDivide(targetWeights.get(id) ?? 0, totalWeight),
      industrialCategoryConfig.shareAdjustmentSpeed,
    );
  }
  normalizeIndustrialShares(nation);
}

export function calculateIndustrialStructureMetrics(
  nation: NationState,
): IndustrialStructureMetrics {
  ensureIndustrialStructureState(nation);
  const complexityIndex = INDUSTRIAL_CATEGORY_IDS.reduce((sum, id) => {
    const category = nation.industries[id];
    return sum + category.outputShare * category.productivityIndex;
  }, 0);
  const exportCapability = clamp(
    INDUSTRIAL_CATEGORY_IDS.reduce((sum, id) => {
      const definition = definitionFor(id);
      const category = nation.industries[id];
      return sum + category.outputShare * definition.exportPropensity *
        (0.35 + category.technologyReadiness * 0.65);
    }, 0),
    0,
    1,
  );
  const highTechnologyShare = INDUSTRIAL_CATEGORY_IDS.reduce(
    (sum, id) => sum + (HIGH_TECHNOLOGY_IDS.has(id)
      ? nation.industries[id].outputShare
      : 0),
    0,
  );
  const secondaryShare = safeDivide(
    nation.sectors.secondary.valueAdded,
    nation.economy.realGDP,
  );
  return {
    complexityIndex,
    outputMultiplier: clamp(
      1 + (complexityIndex - industrialCategoryConfig.baselineComplexityIndex) * 0.0018,
      0.94,
      1.16,
    ),
    exportCapability,
    industrialExportShare: clamp(
      0.34 + secondaryShare * 0.72 + exportCapability * 0.28,
      0.35,
      0.86,
    ),
    highTechnologyShare,
  };
}

/** 将第二产业总产出完整分配到细分类别，不重复计入GDP。 */
export function allocateIndustrialProduction(nation: NationState): void {
  ensureIndustrialStructureState(nation);
  for (const id of INDUSTRIAL_CATEGORY_IDS) {
    const category = nation.industries[id];
    category.output = nation.sectors.secondary.output * category.outputShare;
    category.valueAdded = nation.sectors.secondary.valueAdded * category.outputShare;
  }
}

/** 将工业品出口分配到细分类别，其余出口保留为农业和服务贸易。 */
export function allocateIndustrialExports(nation: NationState): void {
  ensureIndustrialStructureState(nation);
  const metrics = calculateIndustrialStructureMetrics(nation);
  const industrialExports = nation.trade.exports * metrics.industrialExportShare;
  const weights = new Map<IndustrialCategoryId, number>();
  let totalWeight = 0;
  for (const id of INDUSTRIAL_CATEGORY_IDS) {
    const definition = definitionFor(id);
    const category = nation.industries[id];
    const weight = category.output * definition.exportPropensity *
      (0.3 + category.technologyReadiness * 0.7);
    weights.set(id, weight);
    totalWeight += weight;
  }
  for (const id of INDUSTRIAL_CATEGORY_IDS) {
    nation.industries[id].exportValue = totalWeight > 0
      ? industrialExports * safeDivide(weights.get(id) ?? 0, totalWeight)
      : 0;
  }
}
