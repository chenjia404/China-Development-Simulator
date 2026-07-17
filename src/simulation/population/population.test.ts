import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { Mulberry32 } from "../core/random";
import { createInitialGameState } from "../state/initial-state";
import { updateDemographics } from "./demographics";
import { updateLaborForce } from "./labor-force";

describe("人口与劳动力", () => {
  it("年龄组总和与总人口守恒", () => {
    const state = createInitialGameState(1949);
    updateDemographics(state.nation, new Mulberry32(1949));
    const { ageGroups, total } = state.nation.population;

    expect(ageGroups.children + ageGroups.workingAge + ageGroups.elderly).toBeCloseTo(
      total,
      6,
    );
    expect(state.nation.population.urbanPopulation).toBeLessThanOrEqual(total);
    expect(state.nation.population.ruralPopulation).toBeGreaterThanOrEqual(0);
  });

  it("出生与死亡按月改变人口且劳动力不超过劳动年龄人口", () => {
    const state = createInitialGameState(7);
    const before = state.nation.population.total;
    updateDemographics(state.nation, new Mulberry32(7));
    updateLaborForce(state.nation);

    expect(state.nation.population.monthlyBirths).toBeGreaterThan(0);
    expect(state.nation.population.monthlyDeaths).toBeGreaterThan(0);
    expect(state.nation.population.total).not.toBe(before);
    expect(state.nation.labor.laborForce).toBeLessThanOrEqual(
      state.nation.population.ageGroups.workingAge,
    );
  });

  it("严重粮食短缺时仍保持全部人口指标非负", () => {
    const state = createInitialGameState(99);
    state.nation.resources.foodSupplyRatio = 0.2;
    state.nation.health.index = 0;
    const random = new Mulberry32(99);

    for (let month = 0; month < 1_200; month += 1) {
      updateDemographics(state.nation, random);
      updateLaborForce(state.nation);
    }

    expect(state.nation.population.total).toBeGreaterThan(0);
    expect(state.nation.population.urbanPopulation).toBeLessThanOrEqual(
      state.nation.population.total,
    );
    expect(state.nation.labor.unemploymentRate).toBeGreaterThanOrEqual(0);
    expect(state.nation.labor.unemploymentRate).toBeLessThanOrEqual(0.6);
  });

  it("相同种子和命令序列产生相同人口结果", () => {
    const first = createSimulationEngine(createInitialGameState(2026));
    const second = createSimulationEngine(createInitialGameState(2026));

    first.dispatch({ type: "ADVANCE_MONTHS", months: 120 });
    second.dispatch({ type: "ADVANCE_MONTHS", months: 120 });

    expect(second.exportState()).toEqual(first.exportState());
  });
});
