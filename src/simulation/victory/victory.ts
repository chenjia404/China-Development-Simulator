import victoryConfig from "../../data/config/victory-paths.json";
import type {
  GameState,
  VictoryPathId,
  VictoryPathProgress,
  VictoryStage,
  VictoryState,
} from "../state/game-state";
import type { AnnualSnapshot } from "../state/history-state";

export type VictoryMetricId =
  | "gdp_rank"
  | "gdp_per_capita_rank"
  | "gdp_per_capita_usd"
  | "poverty_rate"
  | "gini"
  | "happiness"
  | "life_expectancy"
  | "technology_rank"
  | "education_rank"
  | "completed_technologies"
  | "influence_rank"
  | "technology_index"
  | "debt_to_gdp";

export interface VictoryMetricDefinition {
  id: VictoryMetricId;
  label: string;
  comparison: "at_least" | "at_most";
  target: number;
  format: "rank" | "percent" | "usd" | "decimal" | "index" | "years" | "count";
}

export interface VictoryPathDefinition {
  id: VictoryPathId;
  name: string;
  summary: string;
  metrics: VictoryMetricDefinition[];
}

export interface VictoryMetricEvaluation extends VictoryMetricDefinition {
  value: number;
  met: boolean;
}

export interface VictoryPathEvaluation {
  definition: VictoryPathDefinition;
  progress: VictoryPathProgress;
  metrics: VictoryMetricEvaluation[];
  qualified: boolean;
}

export const requiredVictoryYears = victoryConfig.requiredConsecutiveYears;
export const victoryPathDefinitions = victoryConfig.paths as VictoryPathDefinition[];

function createPathProgress(pathId: VictoryPathId): VictoryPathProgress {
  return {
    pathId,
    stage: "building",
    consecutiveQualifiedYears: 0,
    bestConsecutiveYears: 0,
    firstQualifiedYear: null,
    lastEvaluatedYear: null,
    qualifiedLastEvaluation: false,
  };
}

export function createInitialVictoryState(): VictoryState {
  return {
    requiredConsecutiveYears: requiredVictoryYears,
    achievedPathId: null,
    achievedYear: null,
    paths: {
      economic_leadership: createPathProgress("economic_leadership"),
      common_prosperity: createPathProgress("common_prosperity"),
      technology_civilization: createPathProgress("technology_civilization"),
    },
  };
}

function liveMetricValue(state: GameState, metricId: VictoryMetricId): number {
  switch (metricId) {
    case "gdp_rank": return state.world.rankings.nominalGDP.china ?? Number.POSITIVE_INFINITY;
    case "gdp_per_capita_rank": return state.world.rankings.nominalGDPPerCapita.china ?? Number.POSITIVE_INFINITY;
    case "gdp_per_capita_usd": return state.nation.economy.currentUSDGDPPerCapita;
    case "poverty_rate": return state.nation.society.povertyRate;
    case "gini": return state.nation.society.giniCoefficient;
    case "happiness": return state.nation.society.happinessIndex;
    case "life_expectancy": return state.nation.health.lifeExpectancy;
    case "technology_rank": return state.world.rankings.technology.china ?? Number.POSITIVE_INFINITY;
    case "education_rank": return state.world.rankings.education.china ?? Number.POSITIVE_INFINITY;
    case "completed_technologies": return state.nation.technology.completedTechnologyIds.length;
    case "influence_rank": return state.world.rankings.influence.china ?? Number.POSITIVE_INFINITY;
    case "technology_index": return state.nation.technology.index;
    case "debt_to_gdp": return state.nation.fiscal.debtToGDP;
  }
}

function metricMet(definition: VictoryMetricDefinition, value: number): boolean {
  return definition.comparison === "at_least"
    ? value >= definition.target
    : value <= definition.target;
}

export function evaluateVictoryPaths(state: GameState): VictoryPathEvaluation[] {
  return victoryPathDefinitions.map((definition) => {
    const metrics = definition.metrics.map((metric) => {
      const value = liveMetricValue(state, metric.id);
      return { ...metric, value, met: metricMet(metric, value) };
    });
    return {
      definition,
      progress: state.nation.victory.paths[definition.id],
      metrics,
      qualified: metrics.every((metric) => metric.met),
    };
  });
}

function stageForYears(years: number, achieved: boolean): VictoryStage {
  if (achieved) return "achieved";
  if (years >= 2) return "sustaining";
  if (years === 1) return "candidate";
  return "building";
}

/** 在年度世界排名结算后评估全部路线，同一年重复调用不会重复累计。 */
export function checkVictoryCondition(state: GameState): void {
  ensureVictoryState(state);
  const year = state.nation.date.year;
  const evaluations = evaluateVictoryPaths(state);

  for (const evaluation of evaluations) {
    const progress = evaluation.progress;
    if (progress.lastEvaluatedYear === year || progress.stage === "achieved") continue;
    progress.lastEvaluatedYear = year;
    progress.qualifiedLastEvaluation = evaluation.qualified;
    progress.consecutiveQualifiedYears = evaluation.qualified
      ? progress.consecutiveQualifiedYears + 1
      : 0;
    progress.bestConsecutiveYears = Math.max(
      progress.bestConsecutiveYears,
      progress.consecutiveQualifiedYears,
    );
    if (evaluation.qualified && progress.firstQualifiedYear === null) {
      progress.firstQualifiedYear = year;
    }
    const achieved = progress.consecutiveQualifiedYears >= requiredVictoryYears;
    progress.stage = stageForYears(progress.consecutiveQualifiedYears, achieved);

    if (achieved && state.nation.victory.achievedPathId === null) {
      state.nation.victory.achievedPathId = evaluation.definition.id;
      state.nation.victory.achievedYear = year;
      state.nation.victoryYear = year;
    }
  }
}

/** 是否已完成任意一条持续保持型胜利路线。 */
export function hasRecordedVictory(state: GameState): boolean {
  return typeof state.nation.victory?.achievedYear === "number" ||
    typeof state.nation.victoryYear === "number";
}

/** 旧接口保留为经济领航路线的第一项门槛，不再单独代表胜利。 */
export function isWorldGdpLeader(state: GameState): boolean {
  return state.world.rankings.nominalGDP.china === 1;
}

function snapshotQualifiesForLegacyEconomicPath(snapshot: AnnualSnapshot): boolean {
  return snapshot.gdpRank === 1 &&
    snapshot.gdpPerCapitaRank <= 50 &&
    snapshot.happinessIndex >= 60 &&
    snapshot.debtToGDP <= 1;
}

/** 从具备完整字段的年度历史识别连续五年经济领航，供缺失胜利字段的存档迁移。 */
export function inferVictoryYearFromHistory(state: GameState): number | null {
  let consecutive = 0;
  let previousYear: number | null = null;
  for (const snapshot of [...state.nation.history.annual].sort((a, b) => a.year - b.year)) {
    const qualified = snapshotQualifiesForLegacyEconomicPath(snapshot);
    consecutive = previousYear === snapshot.year - 1 && qualified
      ? consecutive + 1
      : qualified ? 1 : 0;
    previousYear = snapshot.year;
    if (consecutive >= requiredVictoryYears) return snapshot.year;
  }
  return null;
}

function isVictoryPathId(value: string | null | undefined): value is VictoryPathId {
  return victoryPathDefinitions.some((path) => path.id === value);
}

/** 补齐旧存档；已经按旧规则获胜的存档会保留胜利，不追溯取消玩家成就。 */
export function ensureVictoryState(state: GameState): void {
  const legacyVictoryYear = typeof state.nation.victoryYear === "number"
    ? state.nation.victoryYear
    : inferVictoryYearFromHistory(state);
  if (!state.nation.victory) {
    state.nation.victory = createInitialVictoryState();
  }
  const victory = state.nation.victory;
  victory.paths ??= createInitialVictoryState().paths;
  victory.requiredConsecutiveYears = requiredVictoryYears;
  for (const definition of victoryPathDefinitions) {
    victory.paths[definition.id] ??= createPathProgress(definition.id);
  }
  if (!isVictoryPathId(victory.achievedPathId)) victory.achievedPathId = null;
  if (typeof victory.achievedYear !== "number") victory.achievedYear = null;

  if (victory.achievedYear === null && legacyVictoryYear !== null) {
    const progress = victory.paths.economic_leadership;
    progress.stage = "achieved";
    progress.consecutiveQualifiedYears = requiredVictoryYears;
    progress.bestConsecutiveYears = Math.max(progress.bestConsecutiveYears, requiredVictoryYears);
    progress.firstQualifiedYear ??= legacyVictoryYear - requiredVictoryYears + 1;
    progress.lastEvaluatedYear = legacyVictoryYear;
    progress.qualifiedLastEvaluation = true;
    victory.achievedPathId = "economic_leadership";
    victory.achievedYear = legacyVictoryYear;
  }
  state.nation.victoryYear = victory.achievedYear;
}

export function victoryPathName(pathId: VictoryPathId | null): string {
  return victoryPathDefinitions.find((path) => path.id === pathId)?.name ?? "国家复兴";
}
