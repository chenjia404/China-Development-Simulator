import type { FiscalBudget, GameState } from "../state/game-state";
import type { DiplomaticActionId } from "../diplomacy/diplomacy";

export interface CreateGameCommand {
  type: "CREATE_GAME";
  seed: number;
  startYear?: number;
  historicalEventDecisionMode?: "automatic" | "interactive";
}

export interface AdvanceMonthsCommand {
  type: "ADVANCE_MONTHS";
  months: number;
}

export interface UpdateBudgetCommand {
  type: "UPDATE_BUDGET";
  budget: Partial<FiscalBudget>;
}

export interface SetPoliciesCommand {
  type: "SET_POLICIES";
  policyIds: string[];
}

export interface ImportGameCommand {
  type: "IMPORT_GAME";
  state: GameState;
}

export interface DiplomaticActionCommand {
  type: "DIPLOMATIC_ACTION";
  actionId: DiplomaticActionId;
  countryId: string;
}

export interface JoinOrganizationCommand {
  type: "JOIN_ORGANIZATION";
  organizationId: string;
}

export interface SetHistoricalEventModeCommand {
  type: "SET_HISTORICAL_EVENT_MODE";
  mode: "automatic" | "interactive";
}

export interface ResolveHistoricalEventCommand {
  type: "RESOLVE_HISTORICAL_EVENT";
  eventId: string;
  choiceId: string;
}

export interface EnactHistoricalInitiativeCommand {
  type: "ENACT_HISTORICAL_INITIATIVE";
  initiativeId: string;
}

export type SimulationCommand =
  | CreateGameCommand
  | AdvanceMonthsCommand
  | UpdateBudgetCommand
  | SetPoliciesCommand
  | DiplomaticActionCommand
  | JoinOrganizationCommand
  | SetHistoricalEventModeCommand
  | ResolveHistoricalEventCommand
  | EnactHistoricalInitiativeCommand
  | ImportGameCommand;
