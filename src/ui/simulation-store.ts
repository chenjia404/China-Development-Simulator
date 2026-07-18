"use client";

import { create } from "zustand";
import {
  deserializeGameState,
  serializeGameState,
  type FiscalBudget,
  type GameState,
  type SimulationCommand,
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
      const command: SimulationCommand = saved
        ? { type: "IMPORT_GAME", state: saved }
        : { type: "CREATE_GAME", seed: 1949, startYear: 1949 };
      const result = await getSimulationClient().dispatch(command);
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
      set({ game: result.state, busy: false });
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

  async newGame(seed = 1949) {
    set({ autoRunning: false });
    await clearAutoSave().catch(() => undefined);
    await get().dispatch({ type: "CREATE_GAME", seed, startYear: 1949 });
  },

  async importSave(serialized) {
    const state = deserializeGameState(serialized);
    await get().dispatch({ type: "IMPORT_GAME", state });
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
    set({ autoRunning });
  },
}));
