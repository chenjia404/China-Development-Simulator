import scenarioConfig from "../../data/config/game-scenarios.json";
import { addModifier } from "../events/modifiers";
import {
  readBlueprintMissionMetric,
  type BlueprintMissionMetricId,
} from "../policies/blueprint-missions";
import type {
  DifficultyId,
  GameState,
  ModifierState,
  OpeningChoices,
  ScenarioId,
  ScenarioRating,
  ScenarioState,
} from "../state/game-state";

export interface ScenarioObjectiveDefinition {
  id: BlueprintMissionMetricId;
  label: string;
  comparison: "at_least" | "at_most";
  target: number;
  format: "percent" | "index" | "usd";
}

export interface GameScenarioDefinition {
  id: ScenarioId;
  name: string;
  summary: string;
  startYear: number;
  endYear: number;
  short: boolean;
  objectives: ScenarioObjectiveDefinition[];
}

interface DifficultyModifierDefinition {
  target: string;
  operation: ModifierState["operation"];
  value: number;
}

export interface GameDifficultyDefinition {
  id: DifficultyId;
  name: string;
  summary: string;
  modifiers: DifficultyModifierDefinition[];
}

export const gameScenarioDefinitions = scenarioConfig.scenarios as GameScenarioDefinition[];
export const gameDifficultyDefinitions = scenarioConfig.difficulties as GameDifficultyDefinition[];

export function getGameScenario(scenarioId: string | undefined): GameScenarioDefinition {
  return gameScenarioDefinitions.find((scenario) => scenario.id === scenarioId) ??
    gameScenarioDefinitions[0];
}

export function getGameDifficulty(difficultyId: string | undefined): GameDifficultyDefinition {
  return gameDifficultyDefinitions.find((difficulty) => difficulty.id === difficultyId) ??
    gameDifficultyDefinitions.find((difficulty) => difficulty.id === "standard") ??
    gameDifficultyDefinitions[0];
}

export function createInitialScenarioState(
  openingChoices?: Pick<OpeningChoices, "scenarioId" | "difficultyId">,
): ScenarioState {
  const scenario = getGameScenario(openingChoices?.scenarioId);
  const difficulty = getGameDifficulty(openingChoices?.difficultyId);
  return {
    scenarioId: scenario.id,
    difficultyId: difficulty.id,
    startYear: scenario.startYear,
    endYear: scenario.endYear,
    short: scenario.short,
    completedYear: null,
    rating: null,
    objectiveResults: [],
    lastEvaluatedYear: null,
  };
}

const DIFFICULTY_SOURCE_PREFIX = "difficulty:";

function applyDifficulty(state: GameState, difficulty: GameDifficultyDefinition): void {
  state.nation.modifiers = state.nation.modifiers.filter(
    (modifier) => !modifier.sourceId.startsWith(DIFFICULTY_SOURCE_PREFIX),
  );
  difficulty.modifiers.forEach((modifier, index) => {
    addModifier(state.nation, {
      id: `${DIFFICULTY_SOURCE_PREFIX}${difficulty.id}:${index}`,
      sourceId: `${DIFFICULTY_SOURCE_PREFIX}${difficulty.id}`,
      target: modifier.target,
      operation: modifier.operation,
      value: modifier.value,
      remainingMonths: null,
      stackRule: "replace",
    });
  });
}

export function configureScenario(
  state: GameState,
  scenarioId?: string,
  difficultyId?: string,
): void {
  const scenario = getGameScenario(scenarioId);
  const difficulty = getGameDifficulty(difficultyId);
  state.nation.scenario = createInitialScenarioState({
    scenarioId: scenario.id,
    difficultyId: difficulty.id,
  });
  applyDifficulty(state, difficulty);
}

export function ensureScenarioState(state: GameState): void {
  if (!state.nation.scenario) {
    configureScenario(
      state,
      state.nation.openingChoices?.scenarioId,
      state.nation.openingChoices?.difficultyId,
    );
    return;
  }
  const scenario = getGameScenario(state.nation.scenario.scenarioId);
  const difficulty = getGameDifficulty(state.nation.scenario.difficultyId);
  const scenarioState = state.nation.scenario;
  scenarioState.scenarioId = scenario.id;
  scenarioState.difficultyId = difficulty.id;
  scenarioState.startYear = scenario.startYear;
  scenarioState.endYear = scenario.endYear;
  scenarioState.short = scenario.short;
  scenarioState.completedYear ??= null;
  scenarioState.rating ??= null;
  scenarioState.objectiveResults ??= [];
  scenarioState.lastEvaluatedYear ??= null;
  const hasDifficultyModifiers = difficulty.modifiers.length === 0 ||
    state.nation.modifiers.some((modifier) =>
      modifier.sourceId === `${DIFFICULTY_SOURCE_PREFIX}${difficulty.id}`
    );
  if (!hasDifficultyModifiers) applyDifficulty(state, difficulty);
}

function evaluateObjectives(state: GameState, scenario: GameScenarioDefinition) {
  return scenario.objectives.map((objective) => {
    const value = readBlueprintMissionMetric(state, objective.id);
    const met = objective.comparison === "at_least"
      ? value >= objective.target
      : value <= objective.target;
    return {
      id: objective.id,
      label: objective.label,
      value,
      target: objective.target,
      met,
    };
  });
}

export function getScenarioObjectiveStatus(state: GameState) {
  const scenario = getGameScenario(state.nation.scenario.scenarioId);
  return {
    scenario,
    difficulty: getGameDifficulty(state.nation.scenario.difficultyId),
    objectives: evaluateObjectives(state, scenario),
    completedYear: state.nation.scenario.completedYear,
    rating: state.nation.scenario.rating,
  };
}

function ratingForObjectives(met: number, total: number): ScenarioRating {
  if (total === 0 || met === total) return "gold";
  if (met >= Math.ceil(total * 2 / 3)) return "silver";
  if (met >= Math.ceil(total / 3)) return "bronze";
  return "failed";
}

/** 年末更新剧本目标；到期后固定结局，继续执政不会改写首次评级。 */
export function updateScenarioProgress(state: GameState): void {
  ensureScenarioState(state);
  const scenarioState = state.nation.scenario;
  if (scenarioState.lastEvaluatedYear === state.nation.date.year) return;
  scenarioState.lastEvaluatedYear = state.nation.date.year;
  const scenario = getGameScenario(scenarioState.scenarioId);
  scenarioState.objectiveResults = evaluateObjectives(state, scenario);
  if (scenarioState.completedYear !== null || state.nation.date.year < scenario.endYear) return;
  scenarioState.completedYear = state.nation.date.year;
  scenarioState.rating = ratingForObjectives(
    scenarioState.objectiveResults.filter((objective) => objective.met).length,
    scenarioState.objectiveResults.length,
  );
}

export const scenarioRatingNames: Record<ScenarioRating, string> = {
  gold: "金级完成",
  silver: "银级完成",
  bronze: "铜级完成",
  failed: "目标未完成",
};
