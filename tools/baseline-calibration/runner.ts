import { performance } from "node:perf_hooks";
import {
  createInitialGameState,
  createSimulationEngine,
  type AnnualSnapshot,
  type GameState,
} from "../../src/simulation/index";
import {
  getAnnualDecision,
  getHistoricalEventChoice,
  type StrategyId,
} from "./strategies";
import { validateGameState } from "./validation";

export interface SimulationRunOptions {
  strategy: StrategyId;
  seed: number;
  startYear: number;
  endYear: number;
}

export interface SimulationRunResult {
  options: SimulationRunOptions;
  durationMs: number;
  annual: AnnualSnapshot[];
  finalState: GameState;
}

export function runSimulation(options: SimulationRunOptions): SimulationRunResult {
  if (options.endYear < options.startYear) {
    throw new Error("结束年份不得早于开始年份");
  }
  const engine = createSimulationEngine(
    createInitialGameState(
      options.seed,
      options.startYear,
      options.strategy === "korean_catch_up" ? "interactive" : "automatic",
    ),
  );
  const startedAt = performance.now();

  for (let year = options.startYear; year <= options.endYear; year += 1) {
    const decision = getAnnualDecision(options.strategy, year);
    if (decision.budget) {
      engine.dispatch({ type: "UPDATE_BUDGET", budget: decision.budget });
    }
    engine.dispatch({ type: "SET_POLICIES", policyIds: decision.policyIds });
    for (let month = 0; month < 12; month += 1) {
      const elapsedMonths = engine.getState().nation.date.elapsedMonths;
      while (engine.getState().nation.date.elapsedMonths === elapsedMonths) {
        engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
        const pendingEventId =
          engine.getState().nation.pendingHistoricalEventId;
        if (pendingEventId) {
          engine.dispatch({
            type: "RESOLVE_HISTORICAL_EVENT",
            eventId: pendingEventId,
            choiceId: getHistoricalEventChoice(
              options.strategy,
              pendingEventId,
            ),
          });
        }
      }
    }
    validateGameState(engine.exportState());
  }

  const finalState = engine.exportState();
  return {
    options,
    durationMs: performance.now() - startedAt,
    annual: structuredClone(finalState.nation.history.annual),
    finalState,
  };
}

export function runBatch(
  options: Omit<SimulationRunOptions, "seed">,
  seeds: number[],
): SimulationRunResult[] {
  return seeds.map((seed) => runSimulation({ ...options, seed }));
}
