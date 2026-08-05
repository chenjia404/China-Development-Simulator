"use client";

import { create } from "zustand";
import {
  deserializeGameState,
  serializeGameState,
  type FiscalBudget,
  type DiplomaticActionId,
  type DiplomaticStrategyId,
  type ForeignPolicyDoctrineId,
  type ForeignAidProgramId,
  type GameState,
  type EnterpriseInstitutionStance,
  type IndustrialCategoryId,
  type IndustrialPolicyStance,
  type LandInstitutionStance,
  type OpeningChoices,
  type PriceInstitutionStance,
  type SimulationCommand,
  type TechnologyIndustryPathId,
  type StrategicPriorityId,
} from "../simulation";
import { getGamePlayableEndYear, isPastPlayableHorizon } from "./playable-horizon";
import { clearAutoSave, loadAutoSave, saveAutoSave } from "./save-storage";
import { getSimulationClient } from "./simulation-client";
import { hasRecordedVictory } from "../simulation/victory/victory";

function shouldCelebrateVictory(
  command: SimulationCommand,
  previousGame: GameState | null,
  nextGame: GameState,
): boolean {
  if (command.type === "IMPORT_GAME" || command.type === "CREATE_GAME") {
    return false;
  }
  const hadVictory = previousGame ? hasRecordedVictory(previousGame) : false;
  return !hadVictory && hasRecordedVictory(nextGame);
}

export type SectionId =
  | "nation"
  | "economy"
  | "fiscal"
  | "population"
  | "education"
  | "technology"
  | "agriculture"
  | "industry"
  | "infrastructure"
  | "transport"
  | "policies"
  | "achievements"
  | "diplomacy"
  | "history"
  | "international"
  | "statistics"
  | "settings";

interface SimulationStore {
  game: GameState | null;
  /** 新开局时为 true，展示开局路线向导。 */
  showOpeningSetupPrompt: boolean;
  /** 待开局使用的随机种子（重新开始时保留原种子）。 */
  pendingOpeningSeed: number;
  /** 新开局（非自动存档恢复）时为 true，用于决定是否展示游戏目标提示。 */
  showGameGoalPrompt: boolean;
  /** 用户已确认游戏目标说明。 */
  gameGoalAcknowledged: boolean;
  /** 本局推进过程中首次达成胜利，用于弹出庆祝界面。 */
  pendingVictoryCelebration: boolean;
  activeSection: SectionId;
  darkMode: boolean;
  speed: 1 | 5 | 10;
  autoRunning: boolean;
  busy: boolean;
  error: string | null;
  initialize(): Promise<void>;
  dispatch(command: SimulationCommand): Promise<void>;
  advanceYear(): Promise<void>;
  runToCurrentYear(): Promise<void>;
  updateBudget(key: keyof FiscalBudget, value: number): Promise<void>;
  setPolicies(policyIds: string[]): Promise<void>;
  diplomaticAction(actionId: DiplomaticActionId, countryId: string): Promise<void>;
  joinOrganization(organizationId: string): Promise<void>;
  setDiplomaticStrategy(strategyId: DiplomaticStrategyId): Promise<void>;
  setForeignPolicyDoctrine(doctrineId: ForeignPolicyDoctrineId): Promise<void>;
  setForeignAidProgram(programId: ForeignAidProgramId): Promise<void>;
  startSinoUSNormalization(): Promise<void>;
  resolveHistoricalEvent(eventId: string, choiceId: string): Promise<void>;
  dismissFamineMortalityReport(): Promise<void>;
  resolveAnnualReview(
    annualFocusId: StrategicPriorityId,
    nextPlanPriorityIds?: StrategicPriorityId[],
  ): Promise<void>;
  enactHistoricalInitiative(initiativeId: string): Promise<void>;
  startAchievementBreakthrough(achievementId: string): Promise<void>;
  selectTechnologyResearch(technologyId: string): Promise<void>;
  setTechnologyIndustryPath(pathId: TechnologyIndustryPathId): Promise<void>;
  setIndustrialPolicy(
    industryId: IndustrialCategoryId,
    stance: IndustrialPolicyStance,
  ): Promise<void>;
  setEconomicCoordinationStance(
    axis: "land" | "enterprise" | "price",
    stance:
      | LandInstitutionStance
      | EnterpriseInstitutionStance
      | PriceInstitutionStance,
  ): Promise<void>;
  /** 打开开局向导；确认后由 confirmOpeningSetup 真正建局。 */
  newGame(seed?: number): Promise<void>;
  confirmOpeningSetup(choices: OpeningChoices): Promise<void>;
  importSave(serialized: string): Promise<void>;
  exportSave(): string | null;
  setActiveSection(section: SectionId): void;
  setDarkMode(enabled: boolean): void;
  setSpeed(speed: 1 | 5 | 10): void;
  setAutoRunning(running: boolean): void;
  acknowledgeGameGoal(): void;
  clearVictoryCelebration(): void;
}

async function persist(state: GameState): Promise<void> {
  try {
    await saveAutoSave(state);
  } catch {
    // 浏览器禁用 IndexedDB 时仍允许继续游戏。
  }
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  game: null,
  showOpeningSetupPrompt: false,
  pendingOpeningSeed: 1949,
  showGameGoalPrompt: false,
  gameGoalAcknowledged: true,
  pendingVictoryCelebration: false,
  activeSection: "nation",
  darkMode: false,
  speed: 1,
  autoRunning: false,
  busy: false,
  error: null,

  async initialize() {
    if (get().game || get().busy || get().showOpeningSetupPrompt) return;
    set({ busy: true, error: null });
    try {
      const saved = await loadAutoSave().catch(() => undefined);
      if (!saved) {
        set({
          busy: false,
          showOpeningSetupPrompt: true,
          pendingOpeningSeed: 1949,
          showGameGoalPrompt: false,
          gameGoalAcknowledged: false,
          pendingVictoryCelebration: false,
        });
        return;
      }
      const client = getSimulationClient();
      let result = await client.dispatch({ type: "IMPORT_GAME", state: saved });
      result = await client.dispatch({
        type: "SET_HISTORICAL_EVENT_MODE",
        mode: "interactive",
      });
      set({
        game: result.state,
        busy: false,
        showOpeningSetupPrompt: false,
        showGameGoalPrompt: false,
        gameGoalAcknowledged: true,
        pendingVictoryCelebration: false,
      });
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "初始化失败",
      });
    }
  },

  async dispatch(command) {
    if (get().busy) return;
    set({ busy: true, error: null });
    try {
      const previousGame = get().game;
      const result = await getSimulationClient().dispatch(command);
      const shouldStopAuto =
        Boolean(result.state.nation.pendingHistoricalEventId) ||
        Boolean(result.state.nation.famineMortality?.pendingReport) ||
        result.state.nation.strategicPlanning.pendingReviewYear !== null ||
        isPastPlayableHorizon(
          result.state.nation.date,
          getGamePlayableEndYear(result.state),
        );
      const newlyCelebrating = shouldCelebrateVictory(
        command,
        previousGame,
        result.state,
      );
      const pendingVictoryCelebration =
        newlyCelebrating || get().pendingVictoryCelebration;
      set({
        game: result.state,
        busy: false,
        autoRunning: pendingVictoryCelebration
          ? false
          : shouldStopAuto
            ? false
            : get().autoRunning,
        pendingVictoryCelebration,
      });
      await persist(result.state);
    } catch (error) {
      set({
        busy: false,
        autoRunning: false,
        error: error instanceof Error ? error.message : "模拟失败",
      });
    }
  },

  async advanceYear() {
    const game = get().game;
    if (!game) return;
    // 自动运行到达可玩截止年后停止；手动「推进一年」仍允许继续探索。
    if (isPastPlayableHorizon(game.nation.date, getGamePlayableEndYear(game)) && get().autoRunning) {
      set({ autoRunning: false });
      return;
    }
    await get().dispatch({ type: "ADVANCE_MONTHS", months: 12 });
  },

  async runToCurrentYear() {
    const game = get().game;
    if (!game || isPastPlayableHorizon(game.nation.date, getGamePlayableEndYear(game))) {
      if (get().autoRunning) set({ autoRunning: false });
      return;
    }
    const currentYear = getGamePlayableEndYear(game);
    const { year, month } = game.nation.date;
    const months = (currentYear - year) * 12 + (13 - month);
    if (months > 0) {
      await get().dispatch({ type: "ADVANCE_MONTHS", months });
    }
  },

  async updateBudget(key, value) {
    await get().dispatch({
      type: "UPDATE_BUDGET",
      budget: { [key]: value },
    });
  },

  async setPolicies(policyIds) {
    await get().dispatch({ type: "SET_POLICIES", policyIds });
  },

  async diplomaticAction(actionId, countryId) {
    await get().dispatch({ type: "DIPLOMATIC_ACTION", actionId, countryId });
  },

  async joinOrganization(organizationId) {
    await get().dispatch({ type: "JOIN_ORGANIZATION", organizationId });
  },

  async setDiplomaticStrategy(strategyId) {
    await get().dispatch({ type: "SET_DIPLOMATIC_STRATEGY", strategyId });
  },

  async setForeignPolicyDoctrine(doctrineId) {
    await get().dispatch({ type: "SET_FOREIGN_POLICY_DOCTRINE", doctrineId });
  },

  async setForeignAidProgram(programId) {
    await get().dispatch({ type: "SET_FOREIGN_AID_PROGRAM", programId });
  },

  async startSinoUSNormalization() {
    await get().dispatch({ type: "START_SINO_US_NORMALIZATION" });
  },

  async resolveHistoricalEvent(eventId, choiceId) {
    await get().dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId,
      choiceId,
    });
  },

  async dismissFamineMortalityReport() {
    await get().dispatch({ type: "DISMISS_FAMINE_MORTALITY_REPORT" });
  },

  async resolveAnnualReview(annualFocusId, nextPlanPriorityIds) {
    await get().dispatch({
      type: "RESOLVE_ANNUAL_REVIEW",
      annualFocusId,
      nextPlanPriorityIds,
    });
  },

  async enactHistoricalInitiative(initiativeId) {
    await get().dispatch({
      type: "ENACT_HISTORICAL_INITIATIVE",
      initiativeId,
    });
  },

  async startAchievementBreakthrough(achievementId) {
    await get().dispatch({
      type: "START_ACHIEVEMENT_BREAKTHROUGH",
      achievementId,
    });
  },

  async selectTechnologyResearch(technologyId) {
    await get().dispatch({
      type: "SELECT_TECH_RESEARCH",
      technologyId,
    });
  },

  async setTechnologyIndustryPath(pathId) {
    await get().dispatch({
      type: "SET_TECHNOLOGY_INDUSTRY_PATH",
      pathId,
    });
  },

  async setIndustrialPolicy(industryId, stance) {
    await get().dispatch({
      type: "SET_INDUSTRIAL_POLICY",
      industryId,
      stance,
    });
  },

  async setEconomicCoordinationStance(axis, stance) {
    await get().dispatch({
      type: "SET_ECONOMIC_COORDINATION_STANCE",
      axis,
      stance,
    });
  },

  async newGame(seed = 1949) {
    set({
      autoRunning: false,
      showOpeningSetupPrompt: true,
      pendingOpeningSeed: seed,
      showGameGoalPrompt: false,
      gameGoalAcknowledged: false,
      pendingVictoryCelebration: false,
      error: null,
    });
    await clearAutoSave().catch(() => undefined);
  },

  async confirmOpeningSetup(choices) {
    if (get().busy) return;
    const seed = get().pendingOpeningSeed;
    set({
      autoRunning: false,
      showOpeningSetupPrompt: false,
      showGameGoalPrompt: false,
      gameGoalAcknowledged: false,
      pendingVictoryCelebration: false,
      error: null,
    });
    await clearAutoSave().catch(() => undefined);
    await get().dispatch({
      type: "CREATE_GAME",
      seed,
      startYear: 1949,
      historicalEventDecisionMode: "interactive",
      openingChoices: choices,
    });
    if (get().error || !get().game) {
      set({ showOpeningSetupPrompt: true });
      return;
    }
    set({
      showGameGoalPrompt: true,
      gameGoalAcknowledged: false,
    });
  },

  async importSave(serialized) {
    set({
      showOpeningSetupPrompt: false,
      showGameGoalPrompt: false,
      gameGoalAcknowledged: true,
      pendingVictoryCelebration: false,
    });
    const state = deserializeGameState(serialized);
    await get().dispatch({ type: "IMPORT_GAME", state });
    await get().dispatch({
      type: "SET_HISTORICAL_EVENT_MODE",
      mode: "interactive",
    });
  },

  exportSave() {
    const game = get().game;
    return game ? serializeGameState(game) : null;
  },

  setActiveSection(activeSection) {
    set({ activeSection });
  },
  setDarkMode(darkMode) {
    set({ darkMode });
  },
  setSpeed(speed) {
    set({ speed });
  },
  setAutoRunning(autoRunning) {
    const game = get().game;
    const blockedByPopup =
      Boolean(game?.nation.pendingHistoricalEventId) ||
      Boolean(game?.nation.famineMortality?.pendingReport) ||
      game?.nation.strategicPlanning.pendingReviewYear !== null;
    const pastHorizon = game
      ? isPastPlayableHorizon(game.nation.date, getGamePlayableEndYear(game))
      : false;
    // 暂停请求始终生效；只有在未越界且无阻塞弹窗时才允许启动自动运行。
    if (!autoRunning) {
      set({ autoRunning: false });
      return;
    }
    set({ autoRunning: !blockedByPopup && !pastHorizon });
  },
  clearVictoryCelebration() {
    set({ pendingVictoryCelebration: false });
  },
  acknowledgeGameGoal() {
    set({ gameGoalAcknowledged: true });
  },
}));
