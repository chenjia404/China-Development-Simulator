import type { GameState } from "../state/game-state";
import {
  assertCompatibleSave,
  SAVE_SCHEMA_VERSION,
  type SaveEnvelope,
} from "./schema";

function checksum(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function serializeGameState(
  state: GameState,
  exportedAt = new Date().toISOString(),
): string {
  const stateJson = JSON.stringify(state);
  const envelope: SaveEnvelope = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    simulationVersion: state.simulationVersion,
    exportedAt,
    checksum: checksum(stateJson),
    state,
  };
  return JSON.stringify(envelope);
}

export function deserializeGameState(serialized: string): GameState {
  const save = JSON.parse(serialized) as SaveEnvelope;
  assertCompatibleSave(save);
  const actualChecksum = checksum(JSON.stringify(save.state));
  if (actualChecksum !== save.checksum) {
    throw new Error("存档校验失败，数据可能已损坏");
  }
  return structuredClone(save.state);
}
