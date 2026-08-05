import { performance } from "node:perf_hooks";
import {
  createInitialGameState,
  createSimulationEngine,
  getDiplomaticStrategy,
  type AnnualSnapshot,
  type GameState,
} from "../../src/simulation/index";
import {
  getAnnualDecision,
  getHistoricalEventChoice,
  optimizedHistoricalStrategyIds,
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

/** 仅史实校准路线施加亲苏开局，以保证中苏交恶→三线建设链条。 */
function applyHistoricalDiplomaticBaseline(
  state: GameState,
  strategy: StrategyId,
): void {
  if (strategy !== "historical") return;
  const proSoviet = getDiplomaticStrategy("pro_soviet");
  if (!proSoviet) throw new Error("缺少亲苏外交战略定义");
  state.nation.diplomacy.strategyId = "pro_soviet";
  state.nation.diplomacy.strategyAlignment = proSoviet.targetAlignment;
}

export function runSimulation(options: SimulationRunOptions): SimulationRunResult {
  if (options.endYear < options.startYear) {
    throw new Error("结束年份不得早于开始年份");
  }
  const initialState = createInitialGameState(
    options.seed,
    options.startYear,
    optimizedHistoricalStrategyIds.includes(options.strategy)
      ? "interactive"
      : "automatic",
  );
  applyHistoricalDiplomaticBaseline(initialState, options.strategy);
  const engine = createSimulationEngine(initialState);
  const startedAt = performance.now();
  let switchedToBalancedAfterSplit = false;

  for (let year = options.startYear; year <= options.endYear; year += 1) {
    const decision = getAnnualDecision(options.strategy, year);
    if (decision.budget) {
      engine.dispatchHeadless({ type: "UPDATE_BUDGET", budget: decision.budget });
    }
    engine.dispatchHeadless({ type: "SET_POLICIES", policyIds: decision.policyIds });
    for (let month = 0; month < 12; month += 1) {
      const elapsedMonths = engine.getState().nation.date.elapsedMonths;
      while (engine.getState().nation.date.elapsedMonths === elapsedMonths) {
        engine.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 1 });
        const pendingEventId =
          engine.getState().nation.pendingHistoricalEventId;
        if (pendingEventId) {
          engine.dispatchHeadless({
            type: "RESOLVE_HISTORICAL_EVENT",
            eventId: pendingEventId,
            choiceId: getHistoricalEventChoice(
              options.strategy,
              pendingEventId,
            ),
          });
        }
        // 自动模式下交恶在 ADVANCE 内即时结算；检测历史记录后切回平衡。
        if (
          options.strategy === "historical" &&
          !switchedToBalancedAfterSplit &&
          engine.getState().nation.history.historicalEvents.some(
            (event) => event.id === "sino_soviet_split_1960",
          )
        ) {
          engine.getState().nation.diplomacy.strategyId = "balanced";
          switchedToBalancedAfterSplit = true;
        }
        if (engine.getState().nation.famineMortality?.pendingReport) {
          engine.dispatchHeadless({ type: "DISMISS_FAMINE_MORTALITY_REPORT" });
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
