import type { SimulationCommand } from "./commands";
import { simulateMonth } from "./month-pipeline";
import { Mulberry32 } from "./random";
import type { AnnualReport, MonthlySnapshot } from "../state/history-state";
import type { GameState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import { validatePolicySelection } from "../policies/policy-engine";
import {
  checkAutomaticInternationalOrganizations,
  ensureDiplomacyState,
  executeDiplomaticAction,
  joinInternationalOrganization,
} from "../diplomacy/diplomacy";
import {
  ensureHistoricalEventState,
  resolveHistoricalEvent,
  setHistoricalEventDecisionMode,
} from "../events/historical-event-engine";
import { ensureHistoricalAccountingState } from "../economy/historical-accounting";
import { ensureForeignExchangeState } from "../economy/foreign-exchange";
import { enactHistoricalInitiative } from "../events/historical-initiatives";
import { setDiplomaticStrategy } from "../diplomacy/diplomatic-strategy";
import {
  ensureTechnologyTreeState,
  selectTechnologyResearch,
} from "../technology/technology-tree";
import { ensurePrivateEconomyState } from "../economy/private-economy";
import { setForeignPolicyDoctrine } from "../diplomacy/foreign-policy-doctrine";

export interface SimulationResult {
  state: GameState;
  latestMonth: MonthlySnapshot | null;
  annualReport: AnnualReport | null;
}

export interface SimulationEngine {
  getState(): Readonly<GameState>;
  dispatch(command: SimulationCommand): SimulationResult;
  exportState(): GameState;
}

export type SimulationEngineFactory = (
  initialState?: GameState,
) => SimulationEngine;

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

class DeterministicSimulationEngine implements SimulationEngine {
  private state: GameState;

  constructor(initialState?: GameState) {
    this.state = cloneState(initialState ?? createInitialGameState(1));
    if (!Number.isFinite(this.state.eventRandomState)) {
      this.state.eventRandomState = (this.state.seed ^ 0x9e3779b9) >>> 0;
    }
    this.state.nation.policyProgress ??= {};
    ensureDiplomacyState(this.state);
    ensureHistoricalEventState(this.state.nation);
    ensureHistoricalAccountingState(this.state);
    ensureForeignExchangeState(this.state);
    ensureTechnologyTreeState(this.state.nation);
    ensurePrivateEconomyState(this.state.nation);
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  dispatch(command: SimulationCommand): SimulationResult {
    switch (command.type) {
      case "CREATE_GAME":
        this.state = createInitialGameState(
          command.seed,
          command.startYear,
          command.historicalEventDecisionMode,
        );
        break;
      case "IMPORT_GAME":
        this.state = cloneState(command.state);
        this.state.nation.policyProgress ??= {};
        ensureDiplomacyState(this.state);
        ensureHistoricalEventState(this.state.nation);
        ensureHistoricalAccountingState(this.state);
        ensureForeignExchangeState(this.state);
        ensureTechnologyTreeState(this.state.nation);
        ensurePrivateEconomyState(this.state.nation);
        break;
      case "UPDATE_BUDGET":
        this.state.nation.fiscal.budget = {
          ...this.state.nation.fiscal.budget,
          ...command.budget,
        };
        break;
      case "SET_POLICIES":
        validatePolicySelection(command.policyIds);
        this.state.nation.policies = [...command.policyIds];
        break;
      case "DIPLOMATIC_ACTION":
        executeDiplomaticAction(this.state, command.actionId, command.countryId);
        break;
      case "JOIN_ORGANIZATION":
        joinInternationalOrganization(this.state, command.organizationId);
        break;
      case "SET_DIPLOMATIC_STRATEGY":
        setDiplomaticStrategy(this.state, command.strategyId);
        break;
      case "SET_FOREIGN_POLICY_DOCTRINE":
        setForeignPolicyDoctrine(this.state, command.doctrineId);
        break;
      case "SET_HISTORICAL_EVENT_MODE":
        setHistoricalEventDecisionMode(this.state.nation, command.mode);
        break;
      case "RESOLVE_HISTORICAL_EVENT":
        resolveHistoricalEvent(
          this.state.nation,
          command.eventId,
          command.choiceId,
        );
        break;
      case "ENACT_HISTORICAL_INITIATIVE":
        enactHistoricalInitiative(this.state, command.initiativeId);
        break;
      case "SELECT_TECH_RESEARCH":
        selectTechnologyResearch(this.state.nation, command.technologyId);
        break;
      case "ADVANCE_MONTHS":
        this.advanceMonths(command.months);
        break;
    }
    checkAutomaticInternationalOrganizations(this.state);

    return {
      state: this.exportState(),
      latestMonth: this.state.nation.history.monthly.at(-1) ?? null,
      annualReport: this.state.nation.history.reports.at(-1) ?? null,
    };
  }

  exportState(): GameState {
    return cloneState(this.state);
  }

  private advanceMonths(months: number): void {
    if (!Number.isInteger(months) || months < 1 || months > 12_000) {
      throw new Error("推进月数必须是 1 至 12000 的整数");
    }
    const random = new Mulberry32(this.state.randomState);
    const eventRandom = new Mulberry32(this.state.eventRandomState);
    for (let index = 0; index < months; index += 1) {
      if (!simulateMonth(this.state, random, eventRandom)) break;
    }
    this.state.randomState = random.getState();
    this.state.eventRandomState = eventRandom.getState();
  }

}

export const createSimulationEngine: SimulationEngineFactory = (initialState) =>
  new DeterministicSimulationEngine(initialState);
