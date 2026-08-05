import { describe, expect, it } from "vitest";
import {
  getGamePlayableEndYear,
  getPlayableEndYear,
  isPastPlayableHorizon,
} from "./playable-horizon";
import { createInitialGameState } from "../simulation/state/initial-state";
import { configureScenario } from "../simulation/scenarios/game-scenarios";

describe("可玩年份上限", () => {
  it("完整战役固定延伸至 2050 年", () => {
    expect(getPlayableEndYear()).toBe(2050);
  });

  it("截止年当月仍可继续，越过截止年才算出界", () => {
    expect(isPastPlayableHorizon({ year: 2026, month: 12 }, 2026)).toBe(false);
    expect(isPastPlayableHorizon({ year: 2027, month: 1 }, 2026)).toBe(true);
    expect(isPastPlayableHorizon({ year: 2025, month: 6 }, 2026)).toBe(false);
  });

  it("短剧本使用自身终局年而不是当前公历年", () => {
    const game = createInitialGameState(1949);
    configureScenario(game, "reform_1978", "standard");
    expect(getGamePlayableEndYear(game)).toBe(1992);
  });
});
