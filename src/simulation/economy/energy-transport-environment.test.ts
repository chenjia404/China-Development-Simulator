import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ENERGY_SOURCE_IDS,
  ensureInfrastructureResourceState,
  updateInfrastructureResources,
} from "./energy-transport-environment";

describe("能源运输与资源环境", () => {
  it("六类能源份额与总供给保持守恒", () => {
    const state = createInitialGameState(8701);
    updateInfrastructureResources(state.nation);
    const resources = state.nation.resources.infrastructureResources;
    expect(ENERGY_SOURCE_IDS.reduce((sum, id) => sum + resources.energyMix[id].share, 0)).toBeCloseTo(1, 12);
    expect(ENERGY_SOURCE_IDS.reduce((sum, id) => sum + resources.energyMix[id].supply, 0)).toBeCloseTo(resources.totalPrimaryEnergy, 10);
    expect(resources.energyShareError).toBeLessThan(1e-12);
  });

  it("绿色电气化降低煤炭份额、污染和碳排放", () => {
    const conventional = createInitialGameState(8702);
    const green = structuredClone(conventional);
    green.nation.technology.index = 90;
    green.nation.technology.developmentPathId = "green_electrification";
    updateInfrastructureResources(conventional.nation);
    updateInfrastructureResources(green.nation);
    expect(green.nation.resources.infrastructureResources.energyMix.coal.share)
      .toBeLessThan(conventional.nation.resources.infrastructureResources.energyMix.coal.share);
    expect(green.nation.resources.infrastructureResources.airPollutionIndex)
      .toBeLessThan(conventional.nation.resources.infrastructureResources.airPollutionIndex);
    expect(green.nation.resources.infrastructureResources.carbonEmissions)
      .toBeLessThan(conventional.nation.resources.infrastructureResources.carbonEmissions);
  });

  it("旧存档缺失资源细账时确定性重建", () => {
    const legacy = createInitialGameState(8703);
    delete (legacy.nation.resources as Partial<NationState["resources"]>).infrastructureResources;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureInfrastructureResourceState(first.nation);
    ensureInfrastructureResourceState(second.nation);
    expect(first.nation.resources.infrastructureResources).toEqual(second.nation.resources.infrastructureResources);
  });
});
