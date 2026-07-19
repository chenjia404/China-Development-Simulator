import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import {
  technologyDiminishingFactor,
  technologyNormalizedEffect,
  technologyProductiveAbsorption,
} from "./technology-growth";
import { updateTechnology } from "./research";
import { simulateWorldCountries } from "../world/world-simulation";
import { Mulberry32 } from "../core/random";

describe("科技指数增长", () => {
  it("递减与前沿吸收在阈值前为 1，超过后递减且始终为正", () => {
    expect(technologyDiminishingFactor(0)).toBe(1);
    expect(technologyDiminishingFactor(100)).toBe(1);
    expect(technologyDiminishingFactor(140)).toBeCloseTo(0.5, 10);
    expect(technologyProductiveAbsorption(99.9)).toBe(1);
    expect(technologyProductiveAbsorption(100)).toBeCloseTo(0.02, 10);
    expect(technologyProductiveAbsorption(140)).toBeCloseTo(0.01, 10);
    expect(technologyDiminishingFactor(400)).toBeGreaterThan(0);
    expect(technologyProductiveAbsorption(400)).toBeGreaterThan(0);
    expect(technologyDiminishingFactor(400)).toBeLessThan(
      technologyDiminishingFactor(140),
    );
  });

  it("下游效果映射在 100 以内与 index/100 一致，超过后饱和", () => {
    expect(technologyNormalizedEffect(50)).toBeCloseTo(0.5, 10);
    expect(technologyNormalizedEffect(100)).toBe(1);
    expect(technologyNormalizedEffect(160)).toBeCloseTo(1 + 0.12 * (60 / 140), 10);
    expect(technologyNormalizedEffect(1_000)).toBeLessThan(1.13);
    expect(technologyNormalizedEffect(1_000)).toBeGreaterThan(
      technologyNormalizedEffect(160),
    );
  });

  it("科技指数可以超过 100，且高位增速慢于同等条件下低位", () => {
    const low = createInitialGameState(1949).nation;
    const high = createInitialGameState(1949).nation;
    for (const nation of [low, high]) {
      nation.education.index = 80;
      nation.education.researchTalent = 2_000_000;
      nation.education.universityCoverage = 0.35;
      nation.education.literacyRate = 0.9;
      nation.education.academicContinuity = 0.9;
      nation.education.researchCohortGap = 0.1;
      nation.economy.institutionalEfficiency = 0.7;
      nation.economy.infrastructureIndex = 70;
      nation.trade.openness = 0.45;
      nation.fiscal.budget.research = 0.08;
      nation.technology.adoptionRate = 0.55;
    }
    low.technology.index = 50;
    high.technology.index = 120;

    updateTechnology(low);
    updateTechnology(high);

    const lowGain = low.technology.index - 50;
    const highGain = high.technology.index - 120;
    expect(high.technology.index).toBeGreaterThan(120);
    expect(lowGain).toBeGreaterThan(highGain);
    expect(highGain).toBeGreaterThan(0);
  });

  it("接近原硬顶后仍可继续上涨并保持有限", () => {
    const state = createInitialGameState(1949);
    const nation = state.nation;
    nation.technology.index = 99.5;
    nation.education.index = 75;
    nation.education.researchTalent = 1_500_000;
    nation.education.universityCoverage = 0.3;
    nation.education.literacyRate = 0.85;
    nation.education.academicContinuity = 0.85;
    nation.education.researchCohortGap = 0.15;
    nation.economy.institutionalEfficiency = 0.65;
    nation.economy.infrastructureIndex = 65;
    nation.trade.openness = 0.4;
    nation.fiscal.budget.research = 0.07;
    nation.technology.adoptionRate = 0.5;

    for (let month = 0; month < 120; month += 1) {
      updateTechnology(nation);
    }

    expect(nation.technology.index).toBeGreaterThan(100);
    expect(Number.isFinite(nation.technology.index)).toBe(true);
    expect(nation.technology.index).toBeLessThan(250);
  });

  it("世界国家科技不再锁死在 100，且会追赶更高的中国前沿", () => {
    const state = createInitialGameState(1949);
    state.nation.technology.index = 140;
    const usa = state.world.countries.find((country) => country.id === "usa")!;
    usa.technologyIndex = 100;
    const before = usa.technologyIndex;
    simulateWorldCountries(state, new Mulberry32(1));
    expect(usa.technologyIndex).toBeGreaterThan(before);
    expect(usa.technologyIndex).toBeGreaterThan(100);
  });
});
