import type { SimulationCommand } from "./commands";
import { simulateMonth } from "./month-pipeline";
import { Mulberry32 } from "./random";
import type { AnnualReport, MonthlySnapshot } from "../state/history-state";
import type { GameState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import { validatePolicySelection } from "../policies/policy-engine";
import {
  ensureDiplomacyState,
  executeDiplomaticAction,
  getInternationalOrganizationStatus,
  joinInternationalOrganization,
} from "../diplomacy/diplomacy";
import {
  ensureHistoricalEventState,
  enactHistoricalEventEarly,
  getHistoricalEvent,
  resolveHistoricalEvent,
  setHistoricalEventDecisionMode,
} from "../events/historical-event-engine";
import { ensureHistoricalAccountingState } from "../economy/historical-accounting";
import { ensureForeignExchangeState } from "../economy/foreign-exchange";
import { enactHistoricalInitiative } from "../events/historical-initiatives";
import { setDiplomaticStrategy } from "../diplomacy/diplomatic-strategy";

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
        this.triggerOrganizationHistoricalEvent(command.organizationId);
        joinInternationalOrganization(this.state, command.organizationId);
        break;
      case "SET_DIPLOMATIC_STRATEGY":
        setDiplomaticStrategy(this.state, command.strategyId);
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
      case "ADVANCE_MONTHS":
        this.advanceMonths(command.months);
        break;
    }

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

  private triggerOrganizationHistoricalEvent(organizationId: string): void {
    const status = getInternationalOrganizationStatus(this.state, organizationId);
    const eventId = status.definition.historicalEventId;
    if (!status.available || !eventId) return;
    const event = getHistoricalEvent(eventId);
    if (!event) throw new Error(`国际组织关联了未知历史事件：${eventId}`);
    const alreadyProcessed = this.state.nation.history.historicalEvents.some(
      (record) => record.id === eventId,
    );
    const isBeforeSchedule = this.state.nation.date.year < event.year ||
      (this.state.nation.date.year === event.year &&
        this.state.nation.date.month < event.month);
    if (alreadyProcessed || !isBeforeSchedule) return;
    enactHistoricalEventEarly(
      this.state.nation,
      eventId,
      `organization:${organizationId}`,
      `国际支持下提前实现${status.definition.name}`,
      [
        `平均国际关系达到 ${status.averageRelation.toFixed(1)}`,
        `${status.supportingCountries} 个国家达到支持门槛`,
      ],
    );
  }
}

export const createSimulationEngine: SimulationEngineFactory = (initialState) =>
  new DeterministicSimulationEngine(initialState);
