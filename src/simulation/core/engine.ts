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
import { setTechnologyIndustryPath } from "../technology/technology-industry-path";
import { ensureDomesticDemandState } from "../economy/domestic-demand";
import { setForeignAidProgram } from "../diplomacy/foreign-aid";
import { startSinoUSNormalization } from "../diplomacy/sino-us-normalization";
import {
  ensureAchievementsState,
  startAchievementBreakthrough,
} from "../events/national-achievements";
import {
  clearPendingFamineMortalityReport,
  dismissFamineMortalityReport,
  ensureFamineMortalityAccount,
} from "../population/famine-mortality-account";
import { ensureNationalAccountsState } from "../economy/national-accounts";
import { ensureMarketDynamicsState } from "../economy/market-dynamics";
import { ensureDemographicDetailState } from "../population/demographic-cohorts";
import { ensureEnterpriseSectorState } from "../economy/enterprise-sectors";
import { ensureFiscalAgricultureTaxState } from "../fiscal/agricultural-tax";
import { ensureFiscalFederalismState } from "../fiscal/fiscal-federalism";
import { ensureFinancialSystemState } from "../economy/monetary-financial";
import { ensureAgricultureSystemState } from "../economy/agriculture-rural";
import { ensureInfrastructureResourceState } from "../economy/energy-transport-environment";
import { ensureElectricitySystemState } from "../economy/electricity-system";
import { ensureTransportState } from "../economy/transport";
import {
  ensureHistoricalBudgetState,
} from "../fiscal/historical-budget";
import { ensureHumanDevelopmentState } from "../society/human-development";
import { ensureUrbanHousingState } from "../society/housing-urbanization";
import { ensureInfrastructurePenetrationState } from "../society/infrastructure-penetration";
import { ensureRegionalEconomyState } from "../economy/regional-economy";
import { ensureWorldTradeNetworkState } from "../economy/international-network";
import { ensureWorldCountriesState } from "../world/countries";
import { ensureForeignMarketState } from "../world/foreign-market-demand";
import { ensureSecurityDefenseState } from "../security/defense-security";
import { ensureInstitutionCausalityState } from "../institutions/institution-causality";
import {
  ensureIndustrialPolicyState,
  setIndustrialPolicyStance,
} from "../policies/industrial-policy";
import {
  ensureEconomicCoordinationState,
  refreshEconomicCoordinationDerivedShares,
  setEconomicCoordinationStance,
} from "../economy/economic-coordination";
import {
  createInitialVictoryState,
  ensureVictoryState,
} from "../victory/victory";
import {
  createInitialBlueprintMissionState,
  ensureBlueprintMissionState,
} from "../policies/blueprint-missions";
import {
  configureScenario,
  ensureScenarioState,
  getGameScenario,
} from "../scenarios/game-scenarios";
import {
  clearPendingAnnualReview,
  createInitialStrategicPlanningState,
  ensureStrategicPlanningState,
  resolveAnnualReview,
} from "../policies/strategic-planning";
import {
  ensureFutureEraState,
  getFutureDecision,
  resolveFutureDecision,
} from "../future/future-era";

export interface SimulationResult {
  state: GameState;
  latestMonth: MonthlySnapshot | null;
  annualReport: AnnualReport | null;
}

export interface SimulationEngine {
  getState(): Readonly<GameState>;
  dispatch(command: SimulationCommand): SimulationResult;
  /** 无界面批量模拟专用：执行命令但不为未使用的返回值深拷贝完整状态。 */
  dispatchHeadless(command: SimulationCommand): void;
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
    ensureFamineMortalityAccount(this.state.nation);
    ensureHistoricalAccountingState(this.state);
    ensureForeignExchangeState(this.state);
    ensureTechnologyTreeState(this.state.nation);
    ensurePrivateEconomyState(this.state.nation);
    ensureDomesticDemandState(this.state.nation);
    ensureNationalAccountsState(this.state.nation);
    ensureMarketDynamicsState(this.state.nation);
    ensureDemographicDetailState(this.state.nation);
    ensureEnterpriseSectorState(this.state.nation);
    ensureFiscalFederalismState(this.state.nation);
    ensureFiscalAgricultureTaxState(this.state.nation);
    ensureIndustrialPolicyState(this.state.nation);
    ensureEconomicCoordinationState(this.state.nation);
    refreshEconomicCoordinationDerivedShares(this.state.nation);
    ensureFinancialSystemState(this.state);
    ensureAgricultureSystemState(this.state.nation);
    ensureElectricitySystemState(this.state.nation);
    ensureInfrastructureResourceState(this.state.nation);
    ensureTransportState(this.state.nation);
    ensureHumanDevelopmentState(this.state.nation);
    ensureUrbanHousingState(this.state.nation);
    ensureInfrastructurePenetrationState(this.state.nation);
    ensureRegionalEconomyState(this.state.nation);
    ensureWorldCountriesState(this.state.world);
    ensureForeignMarketState(this.state);
    ensureWorldTradeNetworkState(this.state);
    ensureSecurityDefenseState(this.state.nation);
    ensureInstitutionCausalityState(this.state.nation);
    ensureAchievementsState(this.state.nation);
    ensureHistoricalBudgetState(this.state.nation);
    ensureStrategicPlanningState(this.state.nation);
    ensureBlueprintMissionState(this.state);
    ensureScenarioState(this.state);
    ensureFutureEraState(this.state);
    ensureVictoryState(this.state);
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  dispatch(command: SimulationCommand): SimulationResult {
    this.dispatchHeadless(command);
    return {
      state: this.exportState(),
      latestMonth: this.state.nation.history.monthly.at(-1) ?? null,
      annualReport: this.state.nation.history.reports.at(-1) ?? null,
    };
  }

  dispatchHeadless(command: SimulationCommand): void {
    switch (command.type) {
      case "CREATE_GAME":
        {
          const scenario = getGameScenario(command.openingChoices?.scenarioId);
          const scenarioSelected = command.openingChoices?.scenarioId !== undefined;
          const targetStartYear = scenarioSelected
            ? scenario.startYear
            : command.startYear ?? 1949;
          const requiresBackgroundSimulation = targetStartYear > 1949;
          const backgroundChoices = command.openingChoices
            ? {
                ...command.openingChoices,
                scenarioId: "full_campaign" as const,
                difficultyId: "standard" as const,
              }
            : undefined;
          this.state = createInitialGameState(
            command.seed,
            requiresBackgroundSimulation ? 1949 : targetStartYear,
            requiresBackgroundSimulation
              ? "automatic"
              : command.historicalEventDecisionMode,
            requiresBackgroundSimulation ? backgroundChoices : command.openingChoices,
          );
          if (requiresBackgroundSimulation) {
            this.advanceMonths((targetStartYear - 1949) * 12);
            this.state.nation.historicalEventDecisionMode =
              command.historicalEventDecisionMode ?? "interactive";
            this.state.nation.openingChoices = command.openingChoices
              ? { ...command.openingChoices }
              : undefined;
            this.state.nation.strategicPlanning = createInitialStrategicPlanningState(
              this.state.nation,
            );
            this.state.nation.modifiers = this.state.nation.modifiers.filter(
              (modifier) =>
                !modifier.sourceId.startsWith("five_year_plan:") &&
                !modifier.sourceId.startsWith("annual_focus:") &&
                !modifier.sourceId.startsWith("blueprint_mission:"),
            );
            ensureStrategicPlanningState(this.state.nation);
            this.state.nation.blueprintMission = createInitialBlueprintMissionState(
              command.openingChoices?.developmentBlueprintId,
            );
            this.state.nation.victory = createInitialVictoryState();
            this.state.nation.victoryYear = null;
            configureScenario(
              this.state,
              command.openingChoices?.scenarioId,
              command.openingChoices?.difficultyId,
            );
          }
        }
        break;
      case "IMPORT_GAME":
        this.state = cloneState(command.state);
        this.state.nation.policyProgress ??= {};
        ensureDiplomacyState(this.state);
        ensureHistoricalEventState(this.state.nation);
        ensureFamineMortalityAccount(this.state.nation);
        ensureHistoricalAccountingState(this.state);
        ensureForeignExchangeState(this.state);
        ensureTechnologyTreeState(this.state.nation);
        ensurePrivateEconomyState(this.state.nation);
        ensureDomesticDemandState(this.state.nation);
        ensureNationalAccountsState(this.state.nation);
        ensureMarketDynamicsState(this.state.nation);
        ensureDemographicDetailState(this.state.nation);
        ensureEnterpriseSectorState(this.state.nation);
        ensureFiscalFederalismState(this.state.nation);
        ensureFiscalAgricultureTaxState(this.state.nation);
        ensureIndustrialPolicyState(this.state.nation);
        ensureEconomicCoordinationState(this.state.nation);
        refreshEconomicCoordinationDerivedShares(this.state.nation);
        ensureFinancialSystemState(this.state);
        ensureAgricultureSystemState(this.state.nation);
        ensureElectricitySystemState(this.state.nation);
        ensureInfrastructureResourceState(this.state.nation);
        ensureTransportState(this.state.nation);
        ensureHumanDevelopmentState(this.state.nation);
        ensureUrbanHousingState(this.state.nation);
        ensureInfrastructurePenetrationState(this.state.nation);
        ensureRegionalEconomyState(this.state.nation);
        ensureWorldCountriesState(this.state.world);
        ensureForeignMarketState(this.state);
        ensureWorldTradeNetworkState(this.state);
        ensureSecurityDefenseState(this.state.nation);
        ensureInstitutionCausalityState(this.state.nation);
        ensureAchievementsState(this.state.nation);
        ensureHistoricalBudgetState(this.state.nation);
        ensureStrategicPlanningState(this.state.nation);
        ensureBlueprintMissionState(this.state);
        ensureScenarioState(this.state);
        ensureFutureEraState(this.state);
        ensureVictoryState(this.state);
        break;
      case "UPDATE_BUDGET":
        ensureHistoricalBudgetState(this.state.nation);
        this.state.nation.budgetManuallyAdjusted = true;
        this.state.nation.fiscal.budget = {
          ...this.state.nation.fiscal.budget,
          ...command.budget,
        };
        break;
      case "SET_POLICIES":
        validatePolicySelection(
          command.policyIds,
          this.state.nation,
          this.state.nation.policies,
        );
        this.state.nation.policies = [...command.policyIds];
        break;
      case "SET_INDUSTRIAL_POLICY":
        setIndustrialPolicyStance(
          this.state.nation,
          command.industryId,
          command.stance,
        );
        break;
      case "SET_ECONOMIC_COORDINATION_STANCE":
        setEconomicCoordinationStance(
          this.state.nation,
          command.axis,
          command.stance,
        );
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
        {
          const pendingFutureDecisionId = this.state.nation.futureEra.pendingDecisionId;
          setHistoricalEventDecisionMode(this.state.nation, command.mode);
          if (command.mode === "automatic") {
            clearPendingFamineMortalityReport(this.state.nation);
            clearPendingAnnualReview(this.state.nation);
            if (pendingFutureDecisionId) {
              const decision = getFutureDecision(pendingFutureDecisionId);
              if (decision) {
                resolveFutureDecision(
                  this.state,
                  decision.id,
                  decision.defaultChoiceId,
                );
              }
            }
          }
        }
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
      case "SET_TECHNOLOGY_INDUSTRY_PATH":
        setTechnologyIndustryPath(this.state.nation, command.pathId);
        break;
      case "SET_FOREIGN_AID_PROGRAM":
        setForeignAidProgram(this.state, command.programId);
        break;
      case "START_SINO_US_NORMALIZATION":
        startSinoUSNormalization(this.state);
        break;
      case "START_ACHIEVEMENT_BREAKTHROUGH":
        startAchievementBreakthrough(this.state, command.achievementId);
        break;
      case "DISMISS_FAMINE_MORTALITY_REPORT":
        dismissFamineMortalityReport(this.state.nation);
        break;
      case "RESOLVE_ANNUAL_REVIEW":
        resolveAnnualReview(
          this.state.nation,
          command.annualFocusId,
          command.nextPlanPriorityIds,
        );
        break;
      case "RESOLVE_FUTURE_DECISION":
        resolveFutureDecision(this.state, command.decisionId, command.choiceId);
        break;
      case "ADVANCE_MONTHS":
        this.advanceMonths(command.months);
        break;
    }
    checkAutomaticInternationalOrganizations(this.state);

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
