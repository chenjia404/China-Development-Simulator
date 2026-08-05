import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { deserializeGameState, serializeGameState } from "../save/serialization";
import {
  ensureInfrastructurePenetrationState,
  updateInfrastructurePenetration,
} from "./infrastructure-penetration";
import { updateDemographics } from "../population/demographics";
import { Mulberry32 } from "../core/random";

describe("基础设施普及率存档迁移", () => {
  it("反序列化旧存档时自动补齐普及率状态", () => {
    const state = createInitialGameState(2020);
    delete (state.nation.society as { infrastructurePenetration?: unknown })
      .infrastructurePenetration;

    const restored = deserializeGameState(serializeGameState(state));
    const penetration = restored.nation.society.infrastructurePenetration;

    expect(penetration.electricityPenetration).toBeGreaterThanOrEqual(0);
    expect(penetration.televisionPenetration).toBeGreaterThanOrEqual(0);
    expect(penetration.mobilePenetration).toBeGreaterThanOrEqual(0);
    expect(penetration.internetPenetration).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(penetration.electricityPenetration)).toBe(true);
    expect(Number.isFinite(penetration.televisionPenetration)).toBe(true);
    expect(Number.isFinite(penetration.mobilePenetration)).toBe(true);
    expect(Number.isFinite(penetration.internetPenetration)).toBe(true);
  });

  it("IMPORT_GAME 路径在首次推进月前即可访问普及率", () => {
    const legacy = createInitialGameState(2010);
    delete (legacy.nation.society as { infrastructurePenetration?: unknown })
      .infrastructurePenetration;
    delete (legacy.nation.resources as { electricity?: unknown }).electricity;

    const engine = createSimulationEngine(createInitialGameState(1));
    engine.dispatch({ type: "IMPORT_GAME", state: legacy });

    const penetration = engine.getState().nation.society.infrastructurePenetration;
    expect(penetration).toBeDefined();
    expect(Number.isFinite(penetration.electricityPenetration)).toBe(true);
    expect(Number.isFinite(penetration.televisionPenetration)).toBe(true);
    expect(Number.isFinite(penetration.mobilePenetration)).toBe(true);
    expect(Number.isFinite(penetration.internetPenetration)).toBe(true);
  });

  it("直接构造引擎时缺失电力与普及率字段不会崩溃", () => {
    const legacy = createInitialGameState(2010);
    delete (legacy.nation.society as { infrastructurePenetration?: unknown })
      .infrastructurePenetration;
    delete (legacy.nation.resources as { electricity?: unknown }).electricity;

    const engine = createSimulationEngine(legacy);
    const penetration = engine.getState().nation.society.infrastructurePenetration;

    expect(penetration).toBeDefined();
    expect(Number.isFinite(penetration.electricityPenetration)).toBe(true);
    expect(Number.isFinite(engine.getState().nation.resources.electricity.grossGeneration)).toBe(true);
  });

  it("部分字段缺失时保留已有值并仅修复缺失项", () => {
    const state = createInitialGameState(2015);
    state.nation.society.infrastructurePenetration = {
      electricityPenetration: 0.42,
      televisionPenetration: Number.NaN,
      mobilePenetration: 0.18,
      internetPenetration: Number.NaN,
    };

    ensureInfrastructurePenetrationState(state.nation);
    const penetration = state.nation.society.infrastructurePenetration;

    expect(penetration.electricityPenetration).toBe(0.42);
    expect(penetration.mobilePenetration).toBe(0.18);
    expect(Number.isFinite(penetration.televisionPenetration)).toBe(true);
    expect(Number.isFinite(penetration.internetPenetration)).toBe(true);
    expect(penetration.televisionPenetration).toBeGreaterThanOrEqual(0);
    expect(penetration.internetPenetration).toBeGreaterThanOrEqual(0);
  });

  it("修复后的普及率不会让人口结算产生 NaN", () => {
    const state = createInitialGameState(2015);
    state.nation.society.infrastructurePenetration = {
      electricityPenetration: 0.55,
      televisionPenetration: Number.NaN,
      mobilePenetration: Number.NaN,
      internetPenetration: 0.12,
    };
    ensureInfrastructurePenetrationState(state.nation);
    updateInfrastructurePenetration(state.nation);
    updateDemographics(state.nation, new Mulberry32(2015));

    expect(Number.isFinite(state.nation.population.total)).toBe(true);
    expect(Number.isFinite(state.nation.population.annualBirthRate)).toBe(true);
    expect(Number.isFinite(state.nation.population.annualDeathRate)).toBe(true);
    expect(state.nation.population.total).toBeGreaterThan(0);
  });
});
