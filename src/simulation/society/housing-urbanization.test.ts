import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ensureUrbanHousingState,
  updateUrbanHousing,
} from "./housing-urbanization";

describe("住房土地与城市化", () => {
  it("住房库存严格分为在住与空置", () => {
    const state = createInitialGameState(8901);
    for (let month = 0; month < 24; month += 1) updateUrbanHousing(state.nation);
    const housing = state.nation.society.urbanHousing;
    expect(housing.occupiedUnits + housing.vacantUnits).toBeCloseTo(housing.urbanHousingUnits, 4);
    expect(housing.housingStockError).toBeLessThan(0.001);
    expect(housing.annualNewCompletions).toBeGreaterThanOrEqual(0);
  });

  it("住房短缺推升房价租金并扩大非正规住房", () => {
    const balanced = createInitialGameState(8902);
    const shortage = structuredClone(balanced);
    shortage.nation.society.urbanHousing.urbanHousingUnits = 1_000_000;
    for (let month = 0; month < 24; month += 1) {
      updateUrbanHousing(balanced.nation);
      updateUrbanHousing(shortage.nation);
    }
    expect(shortage.nation.society.urbanHousing.homePriceIndex)
      .toBeGreaterThan(balanced.nation.society.urbanHousing.homePriceIndex);
    expect(shortage.nation.society.urbanHousing.informalHousingShare)
      .toBeGreaterThan(balanced.nation.society.urbanHousing.informalHousingShare);
  });

  it("长期推进后住房短缺不会失控累积", () => {
    const engine = createSimulationEngine(createInitialGameState(8904));
    for (let month = 0; month < (2026 - 1949) * 12; month += 1) {
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    }
    const housing = engine.exportState().nation.society.urbanHousing;
    const shortageRate = housing.housingShortageUnits /
      Math.max(housing.housingDemandHouseholds, 1);
    expect(shortageRate).toBeLessThan(0.35);
    expect(housing.urbanHousingUnits).toBeGreaterThan(
      housing.housingDemandHouseholds * 0.5,
    );
  }, 30_000);

  it("旧存档缺失住房细账时确定性重建", () => {
    const legacy = createInitialGameState(8903);
    delete (legacy.nation.society as Partial<NationState["society"]>).urbanHousing;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureUrbanHousingState(first.nation);
    ensureUrbanHousingState(second.nation);
    expect(first.nation.society.urbanHousing).toEqual(second.nation.society.urbanHousing);
  });
});
