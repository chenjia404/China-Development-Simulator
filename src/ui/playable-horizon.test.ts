import { describe, expect, it } from "vitest";
import { getPlayableEndYear, isPastPlayableHorizon } from "./playable-horizon";

describe("可玩年份上限", () => {
  it("取当前公历年份作为截止年", () => {
    expect(getPlayableEndYear(new Date("2026-07-31T00:00:00.000Z"))).toBe(2026);
    expect(getPlayableEndYear(new Date("2027-01-01T00:00:00.000Z"))).toBe(2027);
  });

  it("截止年当月仍可继续，越过截止年才算出界", () => {
    expect(isPastPlayableHorizon({ year: 2026, month: 12 }, 2026)).toBe(false);
    expect(isPastPlayableHorizon({ year: 2027, month: 1 }, 2026)).toBe(true);
    expect(isPastPlayableHorizon({ year: 2025, month: 6 }, 2026)).toBe(false);
  });
});
