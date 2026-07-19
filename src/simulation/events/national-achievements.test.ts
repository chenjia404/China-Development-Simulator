import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { applyModifiers } from "./modifiers";
import {
  calculateAchievementScore,
  getNationalAchievement,
  getNationalAchievementStatus,
  nationalAchievementDefinitions,
  startAchievementBreakthrough,
  updateNationalAchievements,
} from "./national-achievements";

describe("国家成就", () => {
  it("配置项唯一且都有基准指标", () => {
    expect(nationalAchievementDefinitions.length).toBeGreaterThanOrEqual(10);
    const ids = nationalAchievementDefinitions.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const achievement of nationalAchievementDefinitions) {
      expect(achievement.metrics.length).toBeGreaterThan(0);
      for (const metric of achievement.metrics) {
        expect(achievement.baseline[metric.id]).toBeGreaterThan(0);
      }
    }
  });

  it("初始状态能力分低于解锁阈值", () => {
    const state = createInitialGameState(1949, 1949);
    const atomic = getNationalAchievement("atomic_bomb");
    expect(atomic).toBeDefined();
    const { score } = calculateAchievementScore(state.nation, atomic!);
    expect(score).toBeLessThan(1);
    expect(state.nation.achievements.unlocked).toEqual([]);
  });

  it("能力占优时自然解锁，并写入软反馈 Modifier", () => {
    const state = createInitialGameState(1949, 1964);
    const atomic = getNationalAchievement("atomic_bomb")!;
    for (const metric of atomic.metrics) {
      const baseline = atomic.baseline[metric.id]!;
      switch (metric.id) {
        case "technologyIndex":
          state.nation.technology.index = baseline * 1.05;
          break;
        case "educationIndex":
          state.nation.education.index = baseline * 1.05;
          break;
        case "infrastructureIndex":
          state.nation.economy.infrastructureIndex = baseline * 1.05;
          break;
        case "defenseReadinessIndex":
          state.nation.securityDefense.readinessIndex = baseline * 1.05;
          break;
        case "defenseCapitalStock":
          state.nation.securityDefense.defenseCapitalStock = baseline * 1.05;
          break;
        case "equipmentModernizationRate":
          state.nation.securityDefense.equipmentModernizationRate = baseline * 1.05;
          break;
        case "aerospaceReadiness":
          state.nation.industries.aerospace_advanced.technologyReadiness =
            baseline * 1.05;
          break;
        default:
          break;
      }
    }

    const unlocked = updateNationalAchievements(state.nation);
    expect(unlocked).toContain("atomic_bomb");
    expect(state.nation.achievements.unlocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "atomic_bomb",
          mode: "natural",
        }),
      ]),
    );
    expect(
      applyModifiers(state.nation, "diplomacy.securityTarget", 0),
    ).toBeGreaterThan(0);
  });

  it("更高能力分可更早具备冲刺条件，且提高相关能力不会降低能力分", () => {
    const low = createInitialGameState(1949, 1960);
    const high = createInitialGameState(1949, 1960);
    const atomic = getNationalAchievement("atomic_bomb")!;
    high.nation.technology.index = low.nation.technology.index * 1.5;
    high.nation.securityDefense.defenseCapitalStock =
      low.nation.securityDefense.defenseCapitalStock * 1.5;
    high.nation.securityDefense.readinessIndex =
      low.nation.securityDefense.readinessIndex * 1.2;
    const lowScore = calculateAchievementScore(low.nation, atomic).score;
    const highScore = calculateAchievementScore(high.nation, atomic).score;
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it("达到冲刺线后可启动集中突破并在工期后解锁", () => {
    const state = createInitialGameState(1949, 1963);
    const atomic = getNationalAchievement("atomic_bomb")!;
    for (const metric of atomic.metrics) {
      const baseline = atomic.baseline[metric.id]!;
      const target = baseline * 0.8;
      switch (metric.id) {
        case "technologyIndex":
          state.nation.technology.index = target;
          break;
        case "educationIndex":
          state.nation.education.index = target;
          break;
        case "infrastructureIndex":
          state.nation.economy.infrastructureIndex = target;
          break;
        case "defenseReadinessIndex":
          state.nation.securityDefense.readinessIndex = target;
          break;
        case "defenseCapitalStock":
          state.nation.securityDefense.defenseCapitalStock = target;
          break;
        case "equipmentModernizationRate":
          state.nation.securityDefense.equipmentModernizationRate = target;
          break;
        case "aerospaceReadiness":
          state.nation.industries.aerospace_advanced.technologyReadiness = target;
          break;
        default:
          break;
      }
    }

    const engine = createSimulationEngine(state);
    const before = getNationalAchievementStatus(engine.exportState(), "atomic_bomb");
    expect(before.score).toBeGreaterThanOrEqual(0.75);
    expect(before.score).toBeLessThan(1);
    expect(before.canBreakthrough).toBe(true);

    engine.dispatch({
      type: "START_ACHIEVEMENT_BREAKTHROUGH",
      achievementId: "atomic_bomb",
    });
    const started = getNationalAchievementStatus(engine.exportState(), "atomic_bomb");
    expect(started.breakthrough).not.toBeNull();
    expect(started.breakthrough?.requiredMonths).toBeGreaterThan(0);

    const months = started.breakthrough!.requiredMonths;
    for (let index = 0; index < months; index += 1) {
      // 保持能力在冲刺线以上，避免推进月份把指标冲淡
      const live = engine.getState().nation;
      for (const metric of atomic.metrics) {
        const baseline = atomic.baseline[metric.id]!;
        const floor = baseline * 0.8;
        switch (metric.id) {
          case "technologyIndex":
            live.technology.index = Math.max(live.technology.index, floor);
            break;
          case "educationIndex":
            live.education.index = Math.max(live.education.index, floor);
            break;
          case "infrastructureIndex":
            live.economy.infrastructureIndex = Math.max(
              live.economy.infrastructureIndex,
              floor,
            );
            break;
          case "defenseReadinessIndex":
            live.securityDefense.readinessIndex = Math.max(
              live.securityDefense.readinessIndex,
              floor,
            );
            break;
          case "defenseCapitalStock":
            live.securityDefense.defenseCapitalStock = Math.max(
              live.securityDefense.defenseCapitalStock,
              floor,
            );
            break;
          case "equipmentModernizationRate":
            live.securityDefense.equipmentModernizationRate = Math.max(
              live.securityDefense.equipmentModernizationRate,
              floor,
            );
            break;
          case "aerospaceReadiness":
            live.industries.aerospace_advanced.technologyReadiness = Math.max(
              live.industries.aerospace_advanced.technologyReadiness,
              floor,
            );
            break;
          default:
            break;
        }
      }
      engine.dispatchHeadless({ type: "ADVANCE_MONTHS", months: 1 });
      if (
        engine.getState().nation.achievements.unlocked.some(
          (item) => item.id === "atomic_bomb",
        )
      ) {
        break;
      }
    }

    expect(
      engine.getState().nation.achievements.unlocked.some(
        (item) => item.id === "atomic_bomb" && item.mode === "breakthrough",
      ),
    ).toBe(true);
  });

  it("氢弹需要先解锁原子弹", () => {
    const state = createInitialGameState(1949, 1967);
    const hydrogen = getNationalAchievement("hydrogen_bomb")!;
    for (const metric of hydrogen.metrics) {
      const baseline = hydrogen.baseline[metric.id]!;
      switch (metric.id) {
        case "technologyIndex":
          state.nation.technology.index = baseline * 1.1;
          break;
        case "educationIndex":
          state.nation.education.index = baseline * 1.1;
          break;
        case "infrastructureIndex":
          state.nation.economy.infrastructureIndex = baseline * 1.1;
          break;
        case "defenseReadinessIndex":
          state.nation.securityDefense.readinessIndex = baseline * 1.1;
          break;
        case "defenseCapitalStock":
          state.nation.securityDefense.defenseCapitalStock = baseline * 1.1;
          break;
        case "equipmentModernizationRate":
          state.nation.securityDefense.equipmentModernizationRate = baseline * 1.1;
          break;
        case "aerospaceReadiness":
          state.nation.industries.aerospace_advanced.technologyReadiness =
            baseline * 1.1;
          break;
        default:
          break;
      }
    }
    const blocked = getNationalAchievementStatus(
      { nation: state.nation } as ReturnType<typeof createInitialGameState>,
      "hydrogen_bomb",
    );
    expect(blocked.prerequisitesMet).toBe(false);
    expect(blocked.score).toBeGreaterThanOrEqual(1);
    expect(blocked.blockers.some((item) => item.includes("原子弹"))).toBe(true);

    state.nation.achievements.unlocked.push({
      id: "atomic_bomb",
      name: "第一颗原子弹",
      year: 1964,
      month: 10,
      scoreAtUnlock: 1,
      mode: "natural",
    });
    expect(updateNationalAchievements(state.nation)).toContain("hydrogen_bomb");
  });

  it("重复启动集中突破会抛错", () => {
    const state = createInitialGameState(1949, 1963);
    const atomic = getNationalAchievement("atomic_bomb")!;
    for (const metric of atomic.metrics) {
      const baseline = atomic.baseline[metric.id]!;
      const target = baseline * 0.85;
      switch (metric.id) {
        case "technologyIndex":
          state.nation.technology.index = target;
          break;
        case "educationIndex":
          state.nation.education.index = target;
          break;
        case "infrastructureIndex":
          state.nation.economy.infrastructureIndex = target;
          break;
        case "defenseReadinessIndex":
          state.nation.securityDefense.readinessIndex = target;
          break;
        case "defenseCapitalStock":
          state.nation.securityDefense.defenseCapitalStock = target;
          break;
        case "equipmentModernizationRate":
          state.nation.securityDefense.equipmentModernizationRate = target;
          break;
        case "aerospaceReadiness":
          state.nation.industries.aerospace_advanced.technologyReadiness = target;
          break;
        default:
          break;
      }
    }
    startAchievementBreakthrough(state, "atomic_bomb");
    expect(() => startAchievementBreakthrough(state, "atomic_bomb")).toThrow(
      /已在集中突破/,
    );
  });
});
