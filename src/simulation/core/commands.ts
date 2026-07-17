import type { FiscalBudget, GameState } from "../state/game-state";

export interface CreateGameCommand {
  type: "CREATE_GAME";
  seed: number;
  startYear?: number;
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

export type SimulationCommand =
  | CreateGameCommand
  | AdvanceMonthsCommand
  | UpdateBudgetCommand
  | SetPoliciesCommand
  | ImportGameCommand;
