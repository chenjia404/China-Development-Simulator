import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import { updateResourceSupply } from "./production";
import { updateInfrastructureResources } from "./energy-transport-environment";
import {
  createEmptyElectricitySystemState,
  electricityProductionModifier,
  ensureElectricitySystemState,
  updateElectricitySystem,
} from "./electricity-system";

describe("电力发电与用电系统", () => {
  it("分部门用电与发电来源守恒", () => {
    const state = createInitialGameState(9101);
    updateResourceSupply(state.nation);
    updateElectricitySystem(state.nation);
    updateInfrastructureResources(state.nation);
    const electricity = state.nation.resources.electricity;
    const consumptionTotal =
      electricity.consumption.residential +
      electricity.consumption.industrial +
      electricity.consumption.commercial +
      electricity.consumption.agriculture;
    const generationTotal = Object.values(electricity.generation).reduce(
      (sum, value) => sum + value,
      0,
    );

    expect(consumptionTotal).toBeCloseTo(electricity.totalConsumption, 6);
    expect(generationTotal).toBeCloseTo(electricity.grossGeneration, 6);
    expect(electricity.netGeneration).toBeCloseTo(
      electricity.grossGeneration - electricity.gridLosses,
      6,
    );
    expect(electricity.balanceError).toBeLessThan(1e-10);
    expect(electricity.electricitySupplyRatio).toBeGreaterThan(0);
    expect(electricity.perCapitaConsumption).toBeGreaterThan(0);
  });

  it("工业化与城市化提升后用电需求上升", () => {
    const rural = createInitialGameState(9102);
    const urban = createInitialGameState(9102);
    for (const item of [rural, urban]) {
      updateResourceSupply(item.nation);
      updateElectricitySystem(item.nation);
    }
    urban.nation.society.urbanizationRate = 0.72;
    urban.nation.sectors.secondary.output *= 2.4;
    urban.nation.sectors.tertiary.output *= 2.1;
    urban.nation.economy.realGDPPerCapita = 12_000;
    updateResourceSupply(urban.nation);
    updateElectricitySystem(urban.nation);

    expect(urban.nation.resources.electricity.totalConsumption).toBeGreaterThan(
      rural.nation.resources.electricity.totalConsumption * 1.4,
    );
    expect(urban.nation.resources.electricity.consumption.industrial).toBeGreaterThan(
      rural.nation.resources.electricity.consumption.industrial,
    );
  });

  it("电力短缺会降低工业与服务产出修饰系数", () => {
    const normal = createInitialGameState(9103);
    const shortage = createInitialGameState(9103);
    updateElectricitySystem(normal.nation, true);
    normal.nation.resources.electricity.electricitySupplyRatio = 0.95;
    shortage.nation.resources.electricity.electricitySupplyRatio = 0.45;

    expect(electricityProductionModifier(normal.nation)).toBeGreaterThan(
      electricityProductionModifier(shortage.nation),
    );
  });

  it("旧存档缺失电力账户时确定性重建", () => {
    const legacy = createInitialGameState(9104);
    delete (legacy.nation.resources as Partial<NationState["resources"]>).electricity;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureElectricitySystemState(first.nation);
    ensureElectricitySystemState(second.nation);
    expect(first.nation.resources.electricity).toEqual(second.nation.resources.electricity);
    expect(first.nation.resources.electricity.totalConsumption).toBeGreaterThan(0);
  });
});
