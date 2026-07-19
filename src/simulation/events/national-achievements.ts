import achievementData from "../../data/config/national-achievements.json";
import type {
  AchievementBreakthroughState,
  AchievementsState,
  AchievementUnlockRecord,
  GameState,
  ModifierState,
  NationState,
} from "../state/game-state";
import { addModifier } from "./modifiers";

export type AchievementMetricId =
  | "technologyIndex"
  | "educationIndex"
  | "infrastructureIndex"
  | "defenseReadinessIndex"
  | "defenseCapitalStock"
  | "equipmentModernizationRate"
  | "aerospaceReadiness"
  | "urbanizationRate"
  | "povertyRate"
  | "happinessIndex"
  | "stabilityIndex"
  | "globalReputation"
  | "foreignExchangeReserves"
  | "openness"
  | "logisticsEfficiencyIndex"
  | "railNetworkKm"
  | "institutionalEfficiency";

export interface AchievementMetricDefinition {
  id: AchievementMetricId;
  weight: number;
  invert?: boolean;
}

export interface AchievementModifierDefinition {
  target: string;
  operation: ModifierState["operation"];
  value: number;
  durationMonths?: number;
  delayMonths?: number;
}

export interface NationalAchievementDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  historicalHint: { year: number; month: number };
  prerequisiteIds: string[];
  allowsBreakthrough: boolean;
  breakthroughDurationMonths: number;
  metrics: AchievementMetricDefinition[];
  baseline: Partial<Record<AchievementMetricId, number>>;
  effects: string[];
  completionModifiers: AchievementModifierDefinition[];
  breakthroughModifiers: AchievementModifierDefinition[];
}

export type {
  AchievementBreakthroughState,
  AchievementsState,
  AchievementUnlockRecord,
};

export interface AchievementMetricStatus {
  id: AchievementMetricId;
  weight: number;
  invert: boolean;
  current: number;
  baseline: number;
  ratio: number;
  contribution: number;
}

export interface NationalAchievementStatus {
  definition: NationalAchievementDefinition;
  unlocked: boolean;
  unlockRecord: AchievementUnlockRecord | null;
  score: number;
  metrics: AchievementMetricStatus[];
  prerequisitesMet: boolean;
  canBreakthrough: boolean;
  breakthrough: AchievementBreakthroughState | null;
  blockers: string[];
}

interface AchievementSettings {
  unlockScore: number;
  rushScore: number;
  maxActiveBreakthroughs: number;
  metricRatioCap: number;
  minBreakthroughMonths: number;
}

const catalog = achievementData as {
  settings: AchievementSettings;
  achievements: NationalAchievementDefinition[];
};

export const achievementSettings = catalog.settings;
export const nationalAchievementDefinitions = catalog.achievements;

export function createEmptyAchievementsState(): AchievementsState {
  return {
    unlocked: [],
    activeBreakthroughs: [],
  };
}

export function ensureAchievementsState(nation: NationState): void {
  if (!nation.achievements) {
    nation.achievements = createEmptyAchievementsState();
    return;
  }
  nation.achievements.unlocked ??= [];
  nation.achievements.activeBreakthroughs ??= [];
}

export function getNationalAchievement(
  achievementId: string,
): NationalAchievementDefinition | undefined {
  return nationalAchievementDefinitions.find((item) => item.id === achievementId);
}

export function readAchievementMetric(
  nation: NationState,
  metricId: AchievementMetricId,
): number {
  switch (metricId) {
    case "technologyIndex":
      return nation.technology.index;
    case "educationIndex":
      return nation.education.index;
    case "infrastructureIndex":
      return nation.economy.infrastructureIndex;
    case "defenseReadinessIndex":
      return nation.securityDefense.readinessIndex;
    case "defenseCapitalStock":
      return nation.securityDefense.defenseCapitalStock;
    case "equipmentModernizationRate":
      return nation.securityDefense.equipmentModernizationRate;
    case "aerospaceReadiness":
      return nation.industries.aerospace_advanced.technologyReadiness;
    case "urbanizationRate":
      return nation.society.urbanizationRate;
    case "povertyRate":
      return nation.society.povertyRate;
    case "happinessIndex":
      return nation.society.happinessIndex;
    case "stabilityIndex":
      return nation.society.stabilityIndex;
    case "globalReputation":
      return nation.diplomacy.globalReputation;
    case "foreignExchangeReserves":
      return nation.trade.foreignExchangeReserves;
    case "openness":
      return nation.trade.openness;
    case "logisticsEfficiencyIndex":
      return nation.resources.infrastructureResources.logisticsEfficiencyIndex;
    case "railNetworkKm":
      return nation.resources.infrastructureResources.railNetworkKm;
    case "institutionalEfficiency":
      return nation.economy.institutionalEfficiency;
    default: {
      const exhaustive: never = metricId;
      return exhaustive;
    }
  }
}

function metricRatio(
  current: number,
  baseline: number,
  invert: boolean,
  cap: number,
): number {
  if (!(baseline > 0) || !Number.isFinite(baseline)) return 0;
  if (!(current >= 0) || !Number.isFinite(current)) return 0;
  const raw = invert
    ? baseline / Math.max(current, baseline * 1e-9)
    : current / baseline;
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(raw, cap);
}

export function calculateAchievementScore(
  nation: NationState,
  definition: NationalAchievementDefinition,
): { score: number; metrics: AchievementMetricStatus[] } {
  const cap = achievementSettings.metricRatioCap;
  const metrics: AchievementMetricStatus[] = [];
  let weighted = 0;
  let totalWeight = 0;
  for (const metric of definition.metrics) {
    const baseline = definition.baseline[metric.id];
    if (baseline === undefined) continue;
    const invert = metric.invert === true;
    const current = readAchievementMetric(nation, metric.id);
    const ratio = metricRatio(current, baseline, invert, cap);
    const contribution = ratio * metric.weight;
    metrics.push({
      id: metric.id,
      weight: metric.weight,
      invert,
      current,
      baseline,
      ratio,
      contribution,
    });
    weighted += contribution;
    totalWeight += metric.weight;
  }
  const score = totalWeight > 0 ? weighted / totalWeight : 0;
  return { score, metrics };
}

function hasUnlocked(nation: NationState, achievementId: string): boolean {
  return nation.achievements.unlocked.some((item) => item.id === achievementId);
}

function prerequisitesMet(
  nation: NationState,
  definition: NationalAchievementDefinition,
): boolean {
  return definition.prerequisiteIds.every((id) => hasUnlocked(nation, id));
}

function applyAchievementModifiers(
  nation: NationState,
  sourceId: string,
  modifiers: AchievementModifierDefinition[],
  fallbackDurationMonths: number | null,
): void {
  modifiers.forEach((modifier, index) => {
    addModifier(nation, {
      id: `${sourceId}:${index}`,
      sourceId,
      target: modifier.target,
      operation: modifier.operation,
      value: modifier.value,
      delayMonths: modifier.delayMonths ?? 0,
      remainingMonths: modifier.durationMonths ?? fallbackDurationMonths,
      stackRule: "replace",
    });
  });
}

function clearBreakthroughModifiers(nation: NationState, achievementId: string): void {
  const sourceId = `achievement-breakthrough:${achievementId}`;
  nation.modifiers = nation.modifiers.filter(
    (modifier) => modifier.sourceId !== sourceId,
  );
}

function unlockAchievement(
  nation: NationState,
  definition: NationalAchievementDefinition,
  score: number,
  mode: AchievementUnlockRecord["mode"],
): AchievementUnlockRecord {
  const record: AchievementUnlockRecord = {
    id: definition.id,
    name: definition.name,
    year: nation.date.year,
    month: nation.date.month,
    scoreAtUnlock: Number(score.toFixed(4)),
    mode,
  };
  nation.achievements.unlocked.push(record);
  nation.achievements.activeBreakthroughs =
    nation.achievements.activeBreakthroughs.filter(
      (item) => item.achievementId !== definition.id,
    );
  clearBreakthroughModifiers(nation, definition.id);
  applyAchievementModifiers(
    nation,
    `achievement:${definition.id}`,
    definition.completionModifiers,
    60,
  );
  return record;
}

export function getNationalAchievementStatus(
  state: GameState,
  achievementOrId: NationalAchievementDefinition | string,
): NationalAchievementStatus {
  ensureAchievementsState(state.nation);
  const definition = typeof achievementOrId === "string"
    ? getNationalAchievement(achievementOrId)
    : achievementOrId;
  if (!definition) {
    throw new Error(`未知国家成就：${achievementOrId}`);
  }
  const unlockRecord = state.nation.achievements.unlocked.find(
    (item) => item.id === definition.id,
  ) ?? null;
  const { score, metrics } = calculateAchievementScore(state.nation, definition);
  const prerequisites = prerequisitesMet(state.nation, definition);
  const breakthrough = state.nation.achievements.activeBreakthroughs.find(
    (item) => item.achievementId === definition.id,
  ) ?? null;
  const blockers: string[] = [];
  if (unlockRecord) {
    return {
      definition,
      unlocked: true,
      unlockRecord,
      score,
      metrics,
      prerequisitesMet: true,
      canBreakthrough: false,
      breakthrough,
      blockers: [],
    };
  }
  if (!prerequisites) {
    for (const prerequisiteId of definition.prerequisiteIds) {
      if (!hasUnlocked(state.nation, prerequisiteId)) {
        const prerequisite = getNationalAchievement(prerequisiteId);
        blockers.push(`需要先完成：${prerequisite?.name ?? prerequisiteId}`);
      }
    }
  }
  if (
    definition.allowsBreakthrough &&
    prerequisites &&
    score < achievementSettings.rushScore
  ) {
    blockers.push(
      `集中突破需能力分达到 ${(achievementSettings.rushScore * 100).toFixed(0)}%（当前 ${(score * 100).toFixed(1)}%）`,
    );
  }
  if (
    definition.allowsBreakthrough &&
    !breakthrough &&
    state.nation.achievements.activeBreakthroughs.length >=
      achievementSettings.maxActiveBreakthroughs
  ) {
    blockers.push("已有进行中的集中突破工程");
  }
  const canBreakthrough = definition.allowsBreakthrough &&
    prerequisites &&
    score >= achievementSettings.rushScore &&
    breakthrough === null &&
    state.nation.achievements.activeBreakthroughs.length <
      achievementSettings.maxActiveBreakthroughs;
  return {
    definition,
    unlocked: false,
    unlockRecord: null,
    score,
    metrics,
    prerequisitesMet: prerequisites,
    canBreakthrough,
    breakthrough,
    blockers,
  };
}

function requiredBreakthroughMonths(
  definition: NationalAchievementDefinition,
  score: number,
): number {
  const remaining = Math.max(0, achievementSettings.unlockScore - score);
  const span = Math.max(
    1e-6,
    achievementSettings.unlockScore - achievementSettings.rushScore,
  );
  const scaled = Math.round(
    definition.breakthroughDurationMonths * (remaining / span),
  );
  return Math.max(achievementSettings.minBreakthroughMonths, scaled);
}

export function startAchievementBreakthrough(
  state: GameState,
  achievementId: string,
): AchievementBreakthroughState {
  ensureAchievementsState(state.nation);
  const status = getNationalAchievementStatus(state, achievementId);
  if (status.unlocked) {
    throw new Error(`成就「${status.definition.name}」已解锁`);
  }
  if (!status.definition.allowsBreakthrough) {
    throw new Error(`成就「${status.definition.name}」不支持集中突破`);
  }
  if (!status.prerequisitesMet) {
    throw new Error(status.blockers[0] ?? "前置成就尚未完成");
  }
  if (status.breakthrough) {
    throw new Error(`成就「${status.definition.name}」已在集中突破中`);
  }
  if (status.score < achievementSettings.rushScore) {
    throw new Error(
      `能力分不足，需达到 ${(achievementSettings.rushScore * 100).toFixed(0)}% 才能集中突破`,
    );
  }
  if (
    state.nation.achievements.activeBreakthroughs.length >=
      achievementSettings.maxActiveBreakthroughs
  ) {
    throw new Error("同时只能进行一项集中突破工程");
  }

  const requiredMonths = requiredBreakthroughMonths(
    status.definition,
    status.score,
  );
  const project: AchievementBreakthroughState = {
    achievementId,
    startedYear: state.nation.date.year,
    startedMonth: state.nation.date.month,
    progressMonths: 0,
    requiredMonths,
    scoreAtStart: Number(status.score.toFixed(4)),
  };
  state.nation.achievements.activeBreakthroughs.push(project);
  applyAchievementModifiers(
    state.nation,
    `achievement-breakthrough:${achievementId}`,
    status.definition.breakthroughModifiers,
    requiredMonths,
  );
  return project;
}

/**
 * 月度结算：推进集中突破，并在能力分达阈时解锁成就。
 * 应放在国防、民生等库存指标已更新之后。
 */
export function updateNationalAchievements(nation: NationState): string[] {
  ensureAchievementsState(nation);
  const unlockedIds: string[] = [];

  for (const project of [...nation.achievements.activeBreakthroughs]) {
    const definition = getNationalAchievement(project.achievementId);
    if (!definition || hasUnlocked(nation, definition.id)) {
      nation.achievements.activeBreakthroughs =
        nation.achievements.activeBreakthroughs.filter(
          (item) => item.achievementId !== project.achievementId,
        );
      clearBreakthroughModifiers(nation, project.achievementId);
      continue;
    }
    project.progressMonths += 1;
    const { score } = calculateAchievementScore(nation, definition);
    if (
      project.progressMonths >= project.requiredMonths &&
      score >= achievementSettings.rushScore &&
      prerequisitesMet(nation, definition)
    ) {
      unlockAchievement(nation, definition, score, "breakthrough");
      unlockedIds.push(definition.id);
    }
  }

  for (const definition of nationalAchievementDefinitions) {
    if (hasUnlocked(nation, definition.id)) continue;
    if (!prerequisitesMet(nation, definition)) continue;
    const { score } = calculateAchievementScore(nation, definition);
    if (score >= achievementSettings.unlockScore) {
      unlockAchievement(nation, definition, score, "natural");
      unlockedIds.push(definition.id);
    }
  }

  return unlockedIds;
}
