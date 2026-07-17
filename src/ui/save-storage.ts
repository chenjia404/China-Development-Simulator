import { openDB } from "idb";
import type { GameState } from "../simulation";

const DATABASE_NAME = "china-development-simulator";
const STORE_NAME = "saves";
const AUTO_SAVE_KEY = "autosave";

async function database() {
  return openDB(DATABASE_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function loadAutoSave(): Promise<GameState | undefined> {
  const db = await database();
  return db.get(STORE_NAME, AUTO_SAVE_KEY);
}

export async function saveAutoSave(state: GameState): Promise<void> {
  const db = await database();
  await db.put(STORE_NAME, state, AUTO_SAVE_KEY);
}

export async function clearAutoSave(): Promise<void> {
  const db = await database();
  await db.delete(STORE_NAME, AUTO_SAVE_KEY);
}
