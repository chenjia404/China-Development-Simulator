import technologyTreeConfig from "../../data/config/technology-tree.json";
import { clamp } from "../core/math";
import type { NationState } from "../state/game-state";

export type TechnologyCategory = "农业" | "工业" | "能源" | "信息";

export interface TechnologyNodeDefinition {
  id: string;
  name: string;
  category: TechnologyCategory;
  description: string;
  researchCost: number;
  requiredEducationIndex: number;
  requiredTechnologyIndex: number;
  prerequisiteIds: string[];
  industryTier: number;
  effects: string[];
}

export interface TechnologyTreeMetrics {
  completedCount: number;
  totalCount: number;
  industryTier: number;
  industrialCapabilityCeiling: number;
  industrialUpgradeReadiness: number;
  effectiveIndustrialTechnology: number;
}

export const technologyTreeDefinitions =
  technologyTreeConfig.definitions as TechnologyNodeDefinition[];

export function validateTechnologyTreeDefinitions(): void {
  const ids = new Set<string>();
  for (const node of technologyTreeDefinitions) {
    if (ids.has(node.id)) throw new Error(`科技树节点重复：${node.id}`);
    if (node.researchCost <= 0) throw new Error(`${node.name}科研成本必须为正数`);
    ids.add(node.id);
  }
  for (const node of technologyTreeDefinitions) {
    for (const prerequisiteId of node.prerequisiteIds) {
      if (!ids.has(prerequisiteId)) {
        throw new Error(`${node.name}引用未知前置科技：${prerequisiteId}`);
      }
      if (prerequisiteId === node.id) {
        throw new Error(`${node.name}不能以自身作为前置科技`);
      }
    }
  }
}

export function getTechnologyNode(
  technologyId: string,
): TechnologyNodeDefinition | undefined {
  return technologyTreeDefinitions.find((node) => node.id === technologyId);
}

export function ensureTechnologyTreeState(nation: NationState): void {
  const knownIds = new Set(technologyTreeDefinitions.map((node) => node.id));
  nation.technology.completedTechnologyIds = Array.isArray(
    nation.technology.completedTechnologyIds,
  )
    ? [...new Set(nation.technology.completedTechnologyIds)].filter((id) =>
        knownIds.has(id),
      )
    : [];
  nation.technology.activeResearchId =
    typeof nation.technology.activeResearchId === "string" &&
      knownIds.has(nation.technology.activeResearchId) &&
      !nation.technology.completedTechnologyIds.includes(
        nation.technology.activeResearchId,
      )
      ? nation.technology.activeResearchId
      : null;
  nation.technology.activeResearchProgress = Number.isFinite(
    nation.technology.activeResearchProgress,
  )
    ? Math.max(0, nation.technology.activeResearchProgress)
    : 0;
  if (!nation.technology.activeResearchId) {
    nation.technology.activeResearchProgress = 0;
  }
}

export function technologyResearchRequirements(
  nation: NationState,
  node: TechnologyNodeDefinition,
): string[] {
  const completed = new Set(nation.technology.completedTechnologyIds);
  const requirements = node.prerequisiteIds
    .filter((id) => !completed.has(id))
    .map((id) => `需要先完成前置科技${getTechnologyNode(id)?.name ?? id}`);
  if (nation.education.index < node.requiredEducationIndex) {
    requirements.push(`教育指数需要达到 ${node.requiredEducationIndex}`);
  }
  if (nation.technology.index < node.requiredTechnologyIndex) {
    requirements.push(`科技能力需要达到 ${node.requiredTechnologyIndex}`);
  }
  return requirements;
}

export function selectTechnologyResearch(
  nation: NationState,
  technologyId: string,
): void {
  ensureTechnologyTreeState(nation);
  const node = getTechnologyNode(technologyId);
  if (!node) throw new Error(`未知科技树节点：${technologyId}`);
  if (nation.technology.completedTechnologyIds.includes(technologyId)) {
    throw new Error(`${node.name}已经完成`);
  }
  const requirements = technologyResearchRequirements(nation, node);
  if (requirements.length > 0) {
    throw new Error(`${node.name}尚不可研究：${requirements.join("；")}`);
  }
  if (nation.technology.activeResearchId !== technologyId) {
    nation.technology.activeResearchId = technologyId;
    nation.technology.activeResearchProgress = 0;
  }
}

function selectAutomaticResearch(nation: NationState): void {
  const next = technologyTreeDefinitions.find((node) =>
    !nation.technology.completedTechnologyIds.includes(node.id) &&
    technologyResearchRequirements(nation, node).length === 0
  );
  if (next) {
    nation.technology.activeResearchId = next.id;
    nation.technology.activeResearchProgress = 0;
  }
}

export function updateTechnologyTree(
  nation: NationState,
  monthlyResearchOutput: number,
): void {
  ensureTechnologyTreeState(nation);
  if (!nation.technology.activeResearchId) selectAutomaticResearch(nation);
  const active = nation.technology.activeResearchId
    ? getTechnologyNode(nation.technology.activeResearchId)
    : undefined;
  if (!active || technologyResearchRequirements(nation, active).length > 0) {
    return;
  }
  nation.technology.activeResearchProgress +=
    Math.max(0, monthlyResearchOutput) *
    technologyTreeConfig.researchAllocationRate;
  if (nation.technology.activeResearchProgress >= active.researchCost) {
    nation.technology.completedTechnologyIds.push(active.id);
    nation.technology.activeResearchId = null;
    nation.technology.activeResearchProgress = 0;
  }
}

export function calculateTechnologyTreeMetrics(
  nation: NationState,
): TechnologyTreeMetrics {
  ensureTechnologyTreeState(nation);
  const completed = technologyTreeDefinitions.filter((node) =>
    nation.technology.completedTechnologyIds.includes(node.id)
  );
  const industryTier = completed.reduce(
    (highest, node) => Math.max(highest, node.industryTier),
    0,
  );
  const industrialCapabilityCeiling = clamp(
    (industryTier + 1) /
      (technologyTreeConfig.industryTierCount + 1) *
      100,
    0,
    100,
  );
  const effectiveIndustrialTechnology = Math.min(
    nation.technology.index,
    industrialCapabilityCeiling,
  );
  const educationAbsorption = clamp(
    nation.education.index / Math.max(35, nation.technology.index * 0.85),
    0,
    1,
  );
  return {
    completedCount: completed.length,
    totalCount: technologyTreeDefinitions.length,
    industryTier,
    industrialCapabilityCeiling,
    industrialUpgradeReadiness: clamp(
      effectiveIndustrialTechnology / 100 * 0.7 +
        educationAbsorption * 0.3,
      0,
      1,
    ),
    effectiveIndustrialTechnology,
  };
}
