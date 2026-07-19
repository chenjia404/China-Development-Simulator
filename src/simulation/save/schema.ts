import type { GameState } from "../state/game-state";

export const SAVE_SCHEMA_VERSION = 2;
export const SIMULATION_VERSION = "0.1.0";

export interface SaveEnvelope {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  simulationVersion: string;
  exportedAt: string;
  checksum: string;
  state: GameState;
}

export function assertCompatibleSave(save: SaveEnvelope): void {
  if (save.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error(`不支持的存档版本：${save.schemaVersion}`);
  }
}
