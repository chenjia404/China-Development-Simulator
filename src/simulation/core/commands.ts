import type { FiscalBudget, GameState } from "../state/game-state";
import type { DiplomaticActionId } from "../diplomacy/diplomacy";
import type { DiplomaticStrategyId } from "../diplomacy/diplomatic-strategy";
import type { ForeignPolicyDoctrineId } from "../diplomacy/foreign-policy-doctrine";
import type { TechnologyIndustryPathId } from "../technology/technology-industry-path";
import type { ForeignAidProgramId } from "../diplomacy/foreign-aid";

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

export interface SetDiplomaticStrategyCommand {
  type: "SET_DIPLOMATIC_STRATEGY";
  strategyId: DiplomaticStrategyId;
}

export interface SetForeignPolicyDoctrineCommand {
  type: "SET_FOREIGN_POLICY_DOCTRINE";
  doctrineId: ForeignPolicyDoctrineId;
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

export interface SelectTechnologyResearchCommand {
  type: "SELECT_TECH_RESEARCH";
  technologyId: string;
}

export interface SetTechnologyIndustryPathCommand {
  type: "SET_TECHNOLOGY_INDUSTRY_PATH";
  pathId: TechnologyIndustryPathId;
}

export interface SetForeignAidProgramCommand {
  type: "SET_FOREIGN_AID_PROGRAM";
  programId: ForeignAidProgramId;
}

export interface StartSinoUSNormalizationCommand {
  type: "START_SINO_US_NORMALIZATION";
}

export type SimulationCommand =
  | CreateGameCommand
  | AdvanceMonthsCommand
  | UpdateBudgetCommand
  | SetPoliciesCommand
  | DiplomaticActionCommand
  | JoinOrganizationCommand
  | SetDiplomaticStrategyCommand
  | SetForeignPolicyDoctrineCommand
  | SetHistoricalEventModeCommand
  | ResolveHistoricalEventCommand
  | EnactHistoricalInitiativeCommand
  | SelectTechnologyResearchCommand
  | SetTechnologyIndustryPathCommand
  | SetForeignAidProgramCommand
  | StartSinoUSNormalizationCommand
  | ImportGameCommand;
