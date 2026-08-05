import type {
  EnterpriseInstitutionStance,
  FiscalBudget,
  GameState,
  IndustrialCategoryId,
  IndustrialPolicyStance,
  LandInstitutionStance,
  OpeningChoices,
  PriceInstitutionStance,
} from "../state/game-state";
import type { DiplomaticActionId } from "../diplomacy/diplomacy";
import type { DiplomaticStrategyId } from "../diplomacy/diplomatic-strategy";
import type { ForeignPolicyDoctrineId } from "../diplomacy/foreign-policy-doctrine";
import type { TechnologyIndustryPathId } from "../technology/technology-industry-path";
import type { ForeignAidProgramId } from "../diplomacy/foreign-aid";
import type { StrategicPriorityId } from "../policies/strategic-planning";

export interface CreateGameCommand {
  type: "CREATE_GAME";
  seed: number;
  startYear?: number;
  historicalEventDecisionMode?: "automatic" | "interactive";
  /** 新建游戏时的开局路线选择；省略则保持校准默认初值。 */
  openingChoices?: OpeningChoices;
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

export interface SetIndustrialPolicyCommand {
  type: "SET_INDUSTRIAL_POLICY";
  industryId: IndustrialCategoryId;
  stance: IndustrialPolicyStance;
}

export interface SetEconomicCoordinationStanceCommand {
  type: "SET_ECONOMIC_COORDINATION_STANCE";
  axis: "land" | "enterprise" | "price";
  stance:
    | LandInstitutionStance
    | EnterpriseInstitutionStance
    | PriceInstitutionStance;
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

export interface StartAchievementBreakthroughCommand {
  type: "START_ACHIEVEMENT_BREAKTHROUGH";
  achievementId: string;
}

export interface DismissFamineMortalityReportCommand {
  type: "DISMISS_FAMINE_MORTALITY_REPORT";
}

export interface ResolveAnnualReviewCommand {
  type: "RESOLVE_ANNUAL_REVIEW";
  annualFocusId: StrategicPriorityId;
  /** 仅当前五年规划到期时需要提供。 */
  nextPlanPriorityIds?: StrategicPriorityId[];
}

export interface ResolveFutureDecisionCommand {
  type: "RESOLVE_FUTURE_DECISION";
  decisionId: string;
  choiceId: string;
}

export type SimulationCommand =
  | CreateGameCommand
  | AdvanceMonthsCommand
  | UpdateBudgetCommand
  | SetPoliciesCommand
  | SetIndustrialPolicyCommand
  | SetEconomicCoordinationStanceCommand
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
  | StartAchievementBreakthroughCommand
  | DismissFamineMortalityReportCommand
  | ResolveAnnualReviewCommand
  | ResolveFutureDecisionCommand
  | ImportGameCommand;
