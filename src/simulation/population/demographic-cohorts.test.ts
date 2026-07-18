import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { Mulberry32 } from "../core/random";
import type { PopulationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import { updateDemographics } from "./demographics";
import {
  AGE_BAND_IDS,
  ensureDemographicDetailState,
  updateDemographicCohorts,
  validateDemographicCohortDefinitions,
} from "./demographic-cohorts";

describe("年龄性别队列、家庭与城乡迁移", () => {
  it("18个年龄组按性别汇总后与总人口严格一致", () => {
    expect(validateDemographicCohortDefinitions()).toEqual([]);
    const engine = createSimulationEngine(createInitialGameState(8201));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 240 });
    const population = engine.getState().nation.population;
    const detail = population.demographicDetail;
    const cohortTotal = AGE_BAND_IDS.reduce(
      (sum, id) => sum + detail.cohorts[id].male + detail.cohorts[id].female,
      0,
    );
    expect(Object.keys(detail.cohorts)).toHaveLength(18);
    expect(cohortTotal).toBeCloseTo(population.total, 4);
    expect(detail.reconciliationError).toBeLessThan(1);
    expect(detail.malePopulation + detail.femalePopulation).toBeCloseTo(
      population.total,
      4,
    );
    expect(detail.sexRatio).toBeGreaterThan(0.8);
    expect(detail.sexRatio).toBeLessThan(1.2);
  });

  it("家庭户、抚养比和城乡迁移形成非负可追踪账户", () => {
    const state = createInitialGameState(8202);
    const random = new Mulberry32(8202);
    for (let month = 0; month < 120; month += 1) {
      updateDemographics(state.nation, random);
      updateDemographicCohorts(state.nation);
    }
    const { households, migration } = state.nation.population.demographicDetail;
    expect(households.householdCount).toBeGreaterThan(0);
    expect(households.averageHouseholdSize).toBeGreaterThanOrEqual(2.35);
    expect(households.averageHouseholdSize).toBeLessThanOrEqual(5.2);
    expect(households.totalDependencyRatio).toBeCloseTo(
      households.childDependencyRatio + households.elderlyDependencyRatio,
      10,
    );
    expect(migration.monthlyRuralToUrban).toBeGreaterThanOrEqual(0);
    expect(migration.monthlyUrbanToRural).toBeGreaterThanOrEqual(0);
    expect(migration.cumulativeRuralToUrban).toBeGreaterThan(0);
  });

  it("旧存档缺失详细人口账户时可以确定性重建", () => {
    const legacy = createInitialGameState(8203);
    delete (legacy.nation.population as Partial<PopulationState>).demographicDetail;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureDemographicDetailState(first.nation);
    ensureDemographicDetailState(second.nation);
    expect(first.nation.population.demographicDetail).toEqual(
      second.nation.population.demographicDetail,
    );
    expect(first.nation.population.demographicDetail.reconciliationError).toBeLessThan(1);
  });
});
