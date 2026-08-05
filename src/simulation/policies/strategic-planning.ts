import planningConfig from "../../data/config/strategic-planning.json";
import type {
  ModifierState,
  NationState,
  StrategicPlanningState,
} from "../state/game-state";
import { addModifier } from "../events/modifiers";

export type StrategicPriorityId =
  | "industrialization"
  | "food_security"
  | "education"
  | "technology"
  | "livelihood"
  | "fiscal_stability"
  | "opening";

interface StrategicPriorityEffect {
  target: string;
  operation: ModifierState["operation"];
  value: number;
}

export interface StrategicPriorityDefinition {
  id: StrategicPriorityId;
  name: string;
  summary: string;
  effects: StrategicPriorityEffect[];
}

export const strategicPriorityDefinitions =
  planningConfig.definitions as StrategicPriorityDefinition[];
export const maximumFiveYearPriorities =
  planningConfig.maximumFiveYearPriorities;

const PLAN_SOURCE_PREFIX = "five_year_plan:";
const ANNUAL_FOCUS_SOURCE_PREFIX = "annual_focus:";

function defaultPriorities(nation: Pick<NationState, "openingChoices">): StrategicPriorityId[] {
  switch (nation.openingChoices?.developmentBlueprintId) {
    case "agriculture_foundation":
      return ["food_security", "livelihood", "education"];
    case "education_technology":
      return ["education", "technology", "fiscal_stability"];
    case "light_industry_export":
      return ["opening", "industrialization", "livelihood"];
    case "heavy_industry_priority":
      return ["industrialization", "fiscal_stability", "education"];
    default:
      return [];
  }
}

export function createInitialStrategicPlanningState(
  nation: Pick<NationState, "date" | "openingChoices">,
): StrategicPlanningState {
  return {
    planStartYear: nation.date.year,
    planEndYear: nation.date.year + 4,
    priorityIds: defaultPriorities(nation),
    annualFocusId: defaultPriorities(nation)[0] ?? null,
    lastReviewYear: null,
    pendingReviewYear: null,
  };
}

export function isStrategicPriorityId(value: string): value is StrategicPriorityId {
  return strategicPriorityDefinitions.some((item) => item.id === value);
}

function removePlanningModifiers(nation: NationState, sourcePrefix: string): void {
  nation.modifiers = nation.modifiers.filter(
    (modifier) => !modifier.sourceId.startsWith(sourcePrefix),
  );
}

function scaledValue(effect: StrategicPriorityEffect, scale: number): number {
  if (effect.operation === "multiply") {
    return 1 + (effect.value - 1) * scale;
  }
  if (effect.operation === "add") return effect.value * scale;
  return effect.value;
}

function applyPriorityModifiers(
  nation: NationState,
  priorityId: StrategicPriorityId,
  sourcePrefix: string,
  remainingMonths: number,
  scale: number,
): void {
  const definition = strategicPriorityDefinitions.find(
    (item) => item.id === priorityId,
  );
  if (!definition) throw new Error(`未知战略重点：${priorityId}`);
  for (const [index, effect] of definition.effects.entries()) {
    addModifier(nation, {
      id: `${sourcePrefix}${priorityId}:${index}`,
      sourceId: `${sourcePrefix}${priorityId}`,
      target: effect.target,
      operation: effect.operation,
      value: scaledValue(effect, scale),
      remainingMonths,
      stackRule: "replace",
    });
  }
}

function monthsThroughYear(nation: NationState, endYear: number): number {
  return Math.max(1, (endYear - nation.date.year) * 12 + (13 - nation.date.month));
}

function reapplyPlanModifiers(nation: NationState): void {
  removePlanningModifiers(nation, PLAN_SOURCE_PREFIX);
  const months = monthsThroughYear(nation, nation.strategicPlanning.planEndYear);
  for (const priorityId of nation.strategicPlanning.priorityIds) {
    if (isStrategicPriorityId(priorityId)) {
      applyPriorityModifiers(nation, priorityId, PLAN_SOURCE_PREFIX, months, 1);
    }
  }
}

function reapplyAnnualFocusModifier(nation: NationState): void {
  removePlanningModifiers(nation, ANNUAL_FOCUS_SOURCE_PREFIX);
  const priorityId = nation.strategicPlanning.annualFocusId;
  if (!priorityId || !isStrategicPriorityId(priorityId)) return;
  applyPriorityModifiers(nation, priorityId, ANNUAL_FOCUS_SOURCE_PREFIX, 12, 0.5);
}

export function ensureStrategicPlanningState(nation: NationState): void {
  const candidate = nation.strategicPlanning;
  let rebuildPlan = false;
  let rebuildAnnualFocus = false;
  if (!candidate) {
    nation.strategicPlanning = createInitialStrategicPlanningState(nation);
    rebuildPlan = true;
    rebuildAnnualFocus = true;
  } else {
    const validPriorities = candidate.priorityIds.filter(isStrategicPriorityId);
    rebuildPlan = validPriorities.length !== candidate.priorityIds.length;
    candidate.priorityIds = validPriorities;
    if (candidate.priorityIds.length === 0 && nation.openingChoices) {
      candidate.priorityIds = defaultPriorities(nation);
      rebuildPlan = true;
    }
    if (candidate.annualFocusId && !isStrategicPriorityId(candidate.annualFocusId)) {
      candidate.annualFocusId = candidate.priorityIds[0] ?? null;
      rebuildAnnualFocus = true;
    }
    if (!Number.isFinite(candidate.planStartYear)) {
      candidate.planStartYear = nation.date.year;
    }
    if (!Number.isFinite(candidate.planEndYear) || candidate.planEndYear < candidate.planStartYear) {
      candidate.planEndYear = candidate.planStartYear + 4;
    }
    candidate.lastReviewYear ??= null;
    candidate.pendingReviewYear ??= null;
  }
  const hasPlanModifiers = nation.modifiers.some((modifier) =>
    modifier.sourceId.startsWith(PLAN_SOURCE_PREFIX)
  );
  const hasAnnualFocusModifiers = nation.modifiers.some((modifier) =>
    modifier.sourceId.startsWith(ANNUAL_FOCUS_SOURCE_PREFIX)
  );
  if (rebuildPlan || (nation.strategicPlanning.priorityIds.length > 0 && !hasPlanModifiers)) {
    reapplyPlanModifiers(nation);
  }
  if (rebuildAnnualFocus || (nation.strategicPlanning.annualFocusId && !hasAnnualFocusModifiers)) {
    reapplyAnnualFocusModifier(nation);
  }
}

export function hasPendingAnnualReview(nation: NationState): boolean {
  return typeof nation.strategicPlanning.pendingReviewYear === "number";
}

export function openAnnualReviewIfNeeded(nation: NationState): void {
  if (nation.historicalEventDecisionMode !== "interactive") return;
  if (nation.strategicPlanning.lastReviewYear === nation.date.year) return;
  nation.strategicPlanning.pendingReviewYear = nation.date.year;
}

export function clearPendingAnnualReview(nation: NationState): void {
  nation.strategicPlanning.pendingReviewYear = null;
}

export function annualReviewRequiresNewPlan(nation: NationState): boolean {
  const reviewYear = nation.strategicPlanning.pendingReviewYear;
  return reviewYear !== null && reviewYear >= nation.strategicPlanning.planEndYear;
}

export function resolveAnnualReview(
  nation: NationState,
  annualFocusId: StrategicPriorityId,
  nextPlanPriorityIds?: StrategicPriorityId[],
): void {
  const reviewYear = nation.strategicPlanning.pendingReviewYear;
  if (reviewYear === null) throw new Error("当前没有待确认的年度复盘");
  if (!isStrategicPriorityId(annualFocusId)) throw new Error(`未知年度重点：${annualFocusId}`);

  if (annualReviewRequiresNewPlan(nation)) {
    const priorities = [...new Set(nextPlanPriorityIds ?? [])];
    if (priorities.length < 1 || priorities.length > maximumFiveYearPriorities) {
      throw new Error(`五年规划必须选择 1 至 ${maximumFiveYearPriorities} 项战略重点`);
    }
    if (!priorities.every(isStrategicPriorityId)) throw new Error("五年规划包含未知战略重点");
    nation.strategicPlanning.planStartYear = reviewYear + 1;
    nation.strategicPlanning.planEndYear = reviewYear + 5;
    nation.strategicPlanning.priorityIds = priorities;
    reapplyPlanModifiers(nation);
  }

  nation.strategicPlanning.annualFocusId = annualFocusId;
  nation.strategicPlanning.lastReviewYear = reviewYear;
  nation.strategicPlanning.pendingReviewYear = null;
  reapplyAnnualFocusModifier(nation);
}

export function strategicPriorityName(priorityId: string): string {
  return strategicPriorityDefinitions.find((item) => item.id === priorityId)?.name ?? priorityId;
}
