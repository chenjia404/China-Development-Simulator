import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { Mulberry32 } from "../core/random";
import { createInitialGameState } from "../state/initial-state";
import {
  calculateInfrastructurePenetrationTargets,
  updateInfrastructurePenetration,
} from "../society/infrastructure-penetration";
import { updateDemographics } from "../population/demographics";
import { updateDemographicCohorts } from "../population/demographic-cohorts";

describe("基础设施普及率", () => {
  it("1949 年初始普及率接近零且非负", () => {
    const state = createInitialGameState(1949);
    updateInfrastructurePenetration(state.nation, true);
    const penetration = state.nation.society.infrastructurePenetration;

    expect(penetration.electricityPenetration).toBeGreaterThanOrEqual(0);
    expect(penetration.televisionPenetration).toBe(0);
    expect(penetration.mobilePenetration).toBe(0);
    expect(penetration.internetPenetration).toBe(0);
    expect(penetration.electricityPenetration).toBeLessThan(0.12);
  });

  it("收入、能源与城市化提升后普及率单调上升", () => {
    const state = createInitialGameState(1, 2000);
    state.nation.economy.realGDPPerCapita = 8_000;
    state.nation.economy.infrastructureIndex = 55;
    state.nation.society.urbanizationRate = 0.42;
    state.nation.resources.energySupplyRatio = 0.95;
    state.nation.technology.adoptionRate = 0.55;
    state.nation.education.index = 68;
    updateInfrastructurePenetration(state.nation, true);

    const before = { ...state.nation.society.infrastructurePenetration };
    for (let month = 0; month < 240; month += 1) {
      updateInfrastructurePenetration(state.nation);
    }
    const after = state.nation.society.infrastructurePenetration;

    expect(after.electricityPenetration).toBeGreaterThan(before.electricityPenetration);
    expect(after.televisionPenetration).toBeGreaterThan(before.televisionPenetration);
    expect(after.mobilePenetration).toBeGreaterThan(before.mobilePenetration);
    expect(after.internetPenetration).toBeGreaterThan(before.internetPenetration);
    expect(after.internetPenetration).toBeLessThanOrEqual(1);
  });

  it("目标普及率受教育与科技约束", () => {
    const low = createInitialGameState(1, 2010);
    const high = createInitialGameState(1, 2010);
    low.nation.economy.realGDPPerCapita = 6_000;
    high.nation.economy.realGDPPerCapita = 12_000;
    low.nation.education.index = 40;
    high.nation.education.index = 82;
    low.nation.technology.adoptionRate = 0.25;
    high.nation.technology.adoptionRate = 0.72;
    low.nation.technology.completedTechnologyIds = [];
    high.nation.technology.completedTechnologyIds = ["digital_networks"];
    for (const state of [low, high]) {
      state.nation.society.urbanizationRate = 0.55;
      state.nation.resources.energySupplyRatio = 0.98;
      state.nation.economy.infrastructureIndex = 60;
    }

    const lowTargets = calculateInfrastructurePenetrationTargets(low.nation);
    const highTargets = calculateInfrastructurePenetrationTargets(high.nation);

    expect(highTargets.internetPenetration).toBeGreaterThan(lowTargets.internetPenetration);
    expect(highTargets.mobilePenetration).toBeGreaterThan(lowTargets.mobilePenetration);
  });
});

describe("人口模型与普及率联动", () => {
  it("高教育、高城市化与信息化会压低出生率并降低死亡率", () => {
    const baseline = createInitialGameState(1, 2010);
    const modern = createInitialGameState(1, 2010);
    const random = new Mulberry32(2010);

    for (const state of [baseline, modern]) {
      state.nation.economy.realGDPPerCapita = 8_000;
      state.nation.resources.foodSupplyRatio = 1;
      state.nation.health.index = 75;
      updateInfrastructurePenetration(state.nation, true);
      updateDemographicCohorts(state.nation);
    }

    modern.nation.society.urbanizationRate = 0.68;
    modern.nation.population.urbanPopulation = modern.nation.population.total * 0.68;
    modern.nation.population.ruralPopulation = modern.nation.population.total * 0.32;
    modern.nation.education.index = 85;
    modern.nation.education.secondaryCoverage = 0.9;
    modern.nation.education.universityCoverage = 0.28;
    modern.nation.society.infrastructurePenetration = {
      electricityPenetration: 0.98,
      televisionPenetration: 0.95,
      mobilePenetration: 0.88,
      internetPenetration: 0.55,
    };
    modern.nation.population.demographicDetail.households.childDependencyRatio = 0.22;
    modern.nation.population.ageGroups.elderly = modern.nation.population.total * 0.12;
    modern.nation.population.ageGroups.children = modern.nation.population.total * 0.18;
    modern.nation.population.ageGroups.workingAge =
      modern.nation.population.total * 0.7;

    baseline.nation.society.urbanizationRate = 0.35;
    baseline.nation.population.urbanPopulation = baseline.nation.population.total * 0.35;
    baseline.nation.population.ruralPopulation = baseline.nation.population.total * 0.65;
    baseline.nation.education.index = 45;
    baseline.nation.education.secondaryCoverage = 0.4;
    baseline.nation.education.universityCoverage = 0.05;
    baseline.nation.society.infrastructurePenetration = {
      electricityPenetration: 0.55,
      televisionPenetration: 0.4,
      mobilePenetration: 0.2,
      internetPenetration: 0.08,
    };
    baseline.nation.population.demographicDetail.households.childDependencyRatio = 0.35;
    baseline.nation.population.ageGroups.elderly = baseline.nation.population.total * 0.08;
    baseline.nation.population.ageGroups.children = baseline.nation.population.total * 0.28;
    baseline.nation.population.ageGroups.workingAge =
      baseline.nation.population.total * 0.64;

    updateDemographics(baseline.nation, random);
    updateDemographics(modern.nation, random);

    expect(modern.nation.population.annualBirthRate).toBeLessThan(
      baseline.nation.population.annualBirthRate,
    );
    expect(modern.nation.population.annualDeathRate).toBeLessThan(
      baseline.nation.population.annualDeathRate,
    );
  });

  it("相同种子和命令序列在引入普及率后仍保持确定性", () => {
    const first = createSimulationEngine(createInitialGameState(2026));
    const second = createSimulationEngine(createInitialGameState(2026));

    first.dispatch({ type: "ADVANCE_MONTHS", months: 120 });
    second.dispatch({ type: "ADVANCE_MONTHS", months: 120 });

    expect(second.exportState()).toEqual(first.exportState());
  });
});
