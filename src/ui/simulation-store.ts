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
  type IndustrialCategoryId,
  type IndustrialPolicyStance,
  type SimulationCommand,
  type TechnologyIndustryPathId,
} from "../simulation";
import { clearAutoSave, loadAutoSave, saveAutoSave } from "./save-storage";
import { getSimulationClient } from "./simulation-client";

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
  | "policies"
  | "achievements"
  | "diplomacy"
  | "history"
  | "international"
  | "statistics"
  | "settings";

interface SimulationStore {
  game: GameState | null;
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
  enactHistoricalInitiative(initiativeId: string): Promise<void>;
  startAchievementBreakthrough(achievementId: string): Promise<void>;
  selectTechnologyResearch(technologyId: string): Promise<void>;
  setTechnologyIndustryPath(pathId: TechnologyIndustryPathId): Promise<void>;
  setIndustrialPolicy(
    industryId: IndustrialCategoryId,
    stance: IndustrialPolicyStance,
  ): Promise<void>;
  newGame(seed?: number): Promise<void>;
  importSave(serialized: string): Promise<void>;
  exportSave(): string | null;
  setActiveSection(section: SectionId): void;
  setDarkMode(enabled: boolean): void;
  setSpeed(speed: 1 | 5 | 10): void;
  setAutoRunning(running: boolean): void;
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
  activeSection: "nation",
  darkMode: false,
  speed: 1,
  autoRunning: false,
  busy: false,
  error: null,

  async initialize() {
    if (get().game || get().busy) return;
    set({ busy: true, error: null });
    try {
      const saved = await loadAutoSave().catch(() => undefined);
      const client = getSimulationClient();
      let result = await client.dispatch(saved
        ? { type: "IMPORT_GAME", state: saved }
        : {
            type: "CREATE_GAME",
            seed: 1949,
            startYear: 1949,
            historicalEventDecisionMode: "interactive",
          });
      if (saved) {
        result = await client.dispatch({
          type: "SET_HISTORICAL_EVENT_MODE",
          mode: "interactive",
        });
      }
      set({ game: result.state, busy: false });
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
      const result = await getSimulationClient().dispatch(command);
      set({
        game: result.state,
        busy: false,
        autoRunning:
          result.state.nation.pendingHistoricalEventId ||
          result.state.nation.famineMortality?.pendingReport
            ? false
            : get().autoRunning,
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
    await get().dispatch({ type: "ADVANCE_MONTHS", months: 12 });
  },

  async runToCurrentYear() {
    const game = get().game;
    if (!game) return;
    const currentYear = new Date().getFullYear();
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

  async newGame(seed = 1949) {
    set({ autoRunning: false });
    await clearAutoSave().catch(() => undefined);
    await get().dispatch({
      type: "CREATE_GAME",
      seed,
      startYear: 1949,
      historicalEventDecisionMode: "interactive",
    });
  },

  async importSave(serialized) {
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
    set({
      autoRunning:
        get().game?.nation.pendingHistoricalEventId ||
        get().game?.nation.famineMortality?.pendingReport
          ? false
          : autoRunning,
    });
  },
}));
