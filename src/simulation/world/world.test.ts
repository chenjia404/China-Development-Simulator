import { describe, expect, it } from "vitest";
import { Mulberry32 } from "../core/random";
import { createInitialGameState } from "../state/initial-state";
import { calculateRank, calculateWorldRankings } from "./rankings";
import { simulateWorldCountries } from "./world-simulation";

describe("世界国家和排名", () => {
  it("初始化三十个外国经济体并包含需求文档指定国家", () => {
    const state = createInitialGameState(1);
    const ids = new Set(state.world.countries.map((country) => country.id));

    expect(state.world.countries).toHaveLength(30);
    for (const id of [
      "usa",
      "japan",
      "south_korea",
      "germany",
      "france",
      "united_kingdom",
      "russia",
      "india",
      "brazil",
      "singapore",
      "canada",
      "australia",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("顺序排名正确且相同数值不会异常", () => {
    const rankings = calculateRank(
      [
        { id: "c", value: 5 },
        { id: "a", value: 10 },
        { id: "b", value: 10 },
      ],
      (country) => country.value,
    );

    expect(rankings.a).toBe(1);
    expect(rankings.b).toBe(2);
    expect(rankings.c).toBe(3);
  });

  it("中国参与所有世界排名且人均指标计算正确", () => {
    const state = createInitialGameState(1);
    calculateWorldRankings(state);

    expect(state.world.rankings.nominalGDP.china).toBeGreaterThan(0);
    expect(state.world.rankings.nominalGDPPerCapita.china).toBeGreaterThan(0);
    expect(state.world.rankings.technology.china).toBeGreaterThan(0);
  });

  it("世界模拟在同一种子下可复现并保持正值", () => {
    const first = createInitialGameState(8);
    const second = createInitialGameState(8);
    const firstRandom = new Mulberry32(8);
    const secondRandom = new Mulberry32(8);

    for (let month = 0; month < 120; month += 1) {
      simulateWorldCountries(first, firstRandom);
      simulateWorldCountries(second, secondRandom);
    }

    expect(second.world).toEqual(first.world);
    expect(first.world.countries.every((country) => country.realGDP > 0)).toBe(true);
  });
});
