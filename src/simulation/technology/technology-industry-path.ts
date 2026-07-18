import pathConfig from "../../data/config/technology-industry-paths.json";
import { clamp } from "../core/math";
import type {
  IndustrialCategoryId,
  NationState,
} from "../state/game-state";

export type TechnologyIndustryPathId =
  NationState["technology"]["developmentPathId"];

export interface TechnologyIndustryPathEffect {
  outputWeightMultiplier: number;
  productivityMultiplier: number;
  exportMultiplier: number;
}

export interface TechnologyIndustryPathDefinition {
  id: TechnologyIndustryPathId;
  name: string;
  shortName: string;
  description: string;
  effects: string[];
  preferredTechnologyIds: string[];
  preferredCategories: string[];
  focusedResearchMultiplier: number;
  unfocusedResearchMultiplier: number;
  energyDemandMultiplier: number;
  industryEffects: Partial<Record<IndustrialCategoryId, TechnologyIndustryPathEffect>>;
}

export const technologyIndustryPathDefinitions =
  pathConfig.definitions as TechnologyIndustryPathDefinition[];
export const technologyIndustryPathCooldownMonths = pathConfig.cooldownMonths;

export function getTechnologyIndustryPath(
  pathId: string,
): TechnologyIndustryPathDefinition | undefined {
  return technologyIndustryPathDefinitions.find((path) => path.id === pathId);
}

export function validateTechnologyIndustryPaths(): void {
  const ids = new Set<string>();
  for (const path of technologyIndustryPathDefinitions) {
    if (ids.has(path.id)) throw new Error(`科技工业路线重复：${path.id}`);
    if (
      path.focusedResearchMultiplier <= 0 ||
      path.unfocusedResearchMultiplier <= 0 ||
      path.energyDemandMultiplier <= 0
    ) {
      throw new Error(`${path.name}包含无效倍率`);
    }
    ids.add(path.id);
  }
}

function pathPair(nation: NationState): {
  previous: TechnologyIndustryPathDefinition;
  current: TechnologyIndustryPathDefinition;
  progress: number;
} {
  const current = getTechnologyIndustryPath(nation.technology.developmentPathId);
  const previous = nation.technology.previousDevelopmentPathId
    ? getTechnologyIndustryPath(nation.technology.previousDevelopmentPathId)
    : current;
  if (!current || !previous) throw new Error("科技工业路线配置不完整");
  return {
    previous,
    current,
    progress: clamp(nation.technology.developmentPathProgress, 0, 1),
  };
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function isFocused(
  path: TechnologyIndustryPathDefinition,
  node: { id: string; category: string },
): boolean {
  return path.preferredTechnologyIds.includes(node.id) ||
    path.preferredCategories.includes(node.category);
}

export function technologyIndustryResearchMultiplier(
  nation: NationState,
  node: { id: string; category: string },
): number {
  const { previous, current, progress } = pathPair(nation);
  const multiplier = (path: TechnologyIndustryPathDefinition): number =>
    isFocused(path, node)
      ? path.focusedResearchMultiplier
      : path.unfocusedResearchMultiplier;
  return interpolate(multiplier(previous), multiplier(current), progress);
}

export function technologyIndustryAutomaticPriority(
  nation: NationState,
  node: { id: string; category: string },
): number {
  const path = getTechnologyIndustryPath(nation.technology.developmentPathId);
  if (!path) return 0;
  return (path.preferredTechnologyIds.includes(node.id) ? 100 : 0) +
    (path.preferredCategories.includes(node.category) ? 20 : 0);
}

function industryEffect(
  path: TechnologyIndustryPathDefinition,
  industryId: IndustrialCategoryId,
): TechnologyIndustryPathEffect {
  return path.industryEffects[industryId] ?? {
    outputWeightMultiplier: 1,
    productivityMultiplier: 1,
    exportMultiplier: 1,
  };
}

export function technologyIndustryEffect(
  nation: NationState,
  industryId: IndustrialCategoryId,
): TechnologyIndustryPathEffect {
  const { previous, current, progress } = pathPair(nation);
  const previousEffect = industryEffect(previous, industryId);
  const currentEffect = industryEffect(current, industryId);
  return {
    outputWeightMultiplier: interpolate(
      previousEffect.outputWeightMultiplier,
      currentEffect.outputWeightMultiplier,
      progress,
    ),
    productivityMultiplier: interpolate(
      previousEffect.productivityMultiplier,
      currentEffect.productivityMultiplier,
      progress,
    ),
    exportMultiplier: interpolate(
      previousEffect.exportMultiplier,
      currentEffect.exportMultiplier,
      progress,
    ),
  };
}

export function technologyIndustryEnergyDemandMultiplier(
  nation: NationState,
): number {
  const { previous, current, progress } = pathPair(nation);
  return interpolate(
    previous.energyDemandMultiplier,
    current.energyDemandMultiplier,
    progress,
  );
}

export function updateTechnologyIndustryPath(nation: NationState): void {
  if (nation.technology.developmentPathProgress >= 1) {
    nation.technology.developmentPathProgress = 1;
    nation.technology.previousDevelopmentPathId = null;
    return;
  }
  nation.technology.developmentPathProgress = clamp(
    nation.technology.developmentPathProgress + 1 / pathConfig.transitionMonths,
    0,
    1,
  );
  if (nation.technology.developmentPathProgress >= 1) {
    nation.technology.previousDevelopmentPathId = null;
  }
}

export function technologyIndustryPathCooldownRemaining(
  nation: NationState,
): number {
  const changedAt = nation.technology.lastDevelopmentPathChangeMonth;
  if (changedAt === null) return 0;
  return Math.max(
    0,
    technologyIndustryPathCooldownMonths -
      (nation.date.elapsedMonths - changedAt),
  );
}

export function setTechnologyIndustryPath(
  nation: NationState,
  pathId: TechnologyIndustryPathId,
): void {
  const path = getTechnologyIndustryPath(pathId);
  if (!path) throw new Error(`未知科技工业路线：${pathId}`);
  if (nation.technology.developmentPathId === pathId) {
    throw new Error(`当前已经采用${path.name}`);
  }
  const cooldown = technologyIndustryPathCooldownRemaining(nation);
  if (cooldown > 0) throw new Error(`科技工业路线调整还需冷却 ${cooldown} 个月`);
  nation.technology.activeResearchProgress *=
    1 - pathConfig.researchReorientationLossRate;
  nation.technology.previousDevelopmentPathId =
    nation.technology.developmentPathId;
  nation.technology.developmentPathId = pathId;
  nation.technology.developmentPathProgress = 0;
  nation.technology.lastDevelopmentPathChangeMonth = nation.date.elapsedMonths;
}
