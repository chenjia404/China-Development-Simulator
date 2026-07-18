import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { calculateGDP } from "../economy/gdp";
import {
  calculateIndustrialStructureMetrics,
  updateIndustrialStructure,
} from "../economy/industrial-structure";
import { calculateIndustryOutputs } from "../economy/production";
import { updateInternationalTrade } from "../economy/trade";
import {
  setTechnologyIndustryPath,
  technologyIndustryEffect,
  technologyIndustryPathCooldownRemaining,
  technologyIndustryPathDefinitions,
  validateTechnologyIndustryPaths,
} from "./technology-industry-path";
import {
  ensureTechnologyTreeState,
  technologyTreeDefinitions,
  updateTechnologyTree,
} from "./technology-tree";

function maturePath(
  nation: ReturnType<typeof createInitialGameState>["nation"],
): void {
  nation.technology.previousDevelopmentPathId = null;
  nation.technology.developmentPathProgress = 1;
}

describe("科技工业发展路线", () => {
  it("提供七条配置完整且重点不同的发展路线", () => {
    expect(() => validateTechnologyIndustryPaths()).not.toThrow();
    expect(technologyIndustryPathDefinitions).toHaveLength(7);
    expect(new Set(technologyIndustryPathDefinitions.map((path) => path.id)).size)
      .toBe(7);
    expect(
      technologyIndustryPathDefinitions.map((path) =>
        path.preferredTechnologyIds.join(","),
      ),
    ).toEqual(expect.arrayContaining([
      expect.stringContaining("textile_mass_production"),
      expect.stringContaining("semiconductor_manufacturing"),
      expect.stringContaining("pharmaceutical_synthesis"),
      expect.stringContaining("aerospace_systems"),
    ]));
  });

  it("自动研究会在满足前置条件的节点中优先选择路线科技", () => {
    const lightIndustry = createInitialGameState(1949).nation;
    const heavyIndustry = structuredClone(lightIndustry);
    for (const nation of [lightIndustry, heavyIndustry]) {
      nation.education.index = 100;
      nation.technology.index = 100;
      nation.technology.monthlyResearchOutput = 1;
    }
    setTechnologyIndustryPath(lightIndustry, "light_industry_exports");
    setTechnologyIndustryPath(heavyIndustry, "heavy_equipment");
    updateTechnologyTree(lightIndustry, 1);
    updateTechnologyTree(heavyIndustry, 1);

    expect(lightIndustry.technology.activeResearchId).toBe("mechanized_agriculture");
    expect(heavyIndustry.technology.activeResearchId).toBe("basic_machine_tools");
  });

  it("电子路线和轻工路线形成不同工业结构、技术收益与出口", () => {
    const lightIndustry = createInitialGameState(1949);
    const electronics = structuredClone(lightIndustry);
    for (const state of [lightIndustry, electronics]) {
      state.nation.education.index = 95;
      state.nation.technology.index = 100;
      state.nation.technology.completedTechnologyIds = technologyTreeDefinitions.map(
        (node) => node.id,
      );
      state.nation.trade.openness = 0.8;
      state.nation.resources.energySupplyRatio = 1;
    }
    setTechnologyIndustryPath(lightIndustry.nation, "light_industry_exports");
    setTechnologyIndustryPath(electronics.nation, "electronics_information");
    maturePath(lightIndustry.nation);
    maturePath(electronics.nation);
    for (let month = 0; month < 240; month += 1) {
      updateIndustrialStructure(lightIndustry.nation);
      updateIndustrialStructure(electronics.nation);
    }
    calculateIndustryOutputs(lightIndustry.nation);
    calculateIndustryOutputs(electronics.nation);
    calculateGDP(lightIndustry.nation);
    calculateGDP(electronics.nation);
    updateInternationalTrade(lightIndustry);
    updateInternationalTrade(electronics);

    expect(lightIndustry.nation.industries.consumer_goods.outputShare).toBeGreaterThan(
      electronics.nation.industries.consumer_goods.outputShare,
    );
    expect(
      electronics.nation.industries.electronics_communications.outputShare,
    ).toBeGreaterThan(
      lightIndustry.nation.industries.electronics_communications.outputShare,
    );
    expect(
      technologyIndustryEffect(
        electronics.nation,
        "electronics_communications",
      ).exportMultiplier,
    ).toBeGreaterThan(
      technologyIndustryEffect(
        lightIndustry.nation,
        "electronics_communications",
      ).exportMultiplier,
    );
    expect(calculateIndustrialStructureMetrics(electronics.nation).highTechnologyShare)
      .toBeGreaterThan(
        calculateIndustrialStructureMetrics(lightIndustry.nation).highTechnologyShare,
      );
    expect(
      electronics.nation.industries.electronics_communications.exportValue,
    ).toBeGreaterThan(
      lightIndustry.nation.industries.electronics_communications.exportValue,
    );
  });

  it("改变路线损失部分在研进度并触发三年冷却", () => {
    const nation = createInitialGameState(1949).nation;
    nation.technology.activeResearchId = "basic_machine_tools";
    nation.technology.activeResearchProgress = 4;
    setTechnologyIndustryPath(nation, "heavy_equipment");

    expect(nation.technology.activeResearchProgress).toBeCloseTo(2.6, 10);
    expect(technologyIndustryPathCooldownRemaining(nation)).toBe(36);
    expect(() => setTechnologyIndustryPath(nation, "electronics_information"))
      .toThrow(/冷却/);
  });

  it("旧存档缺少路线字段时迁移为综合基础体系", () => {
    const nation = createInitialGameState(1949).nation;
    const legacyTechnology = nation.technology as Partial<typeof nation.technology>;
    delete legacyTechnology.developmentPathId;
    delete legacyTechnology.previousDevelopmentPathId;
    delete legacyTechnology.developmentPathProgress;
    delete legacyTechnology.lastDevelopmentPathChangeMonth;

    ensureTechnologyTreeState(nation);

    expect(nation.technology.developmentPathId).toBe("balanced_foundation");
    expect(nation.technology.developmentPathProgress).toBe(1);
    expect(nation.technology.lastDevelopmentPathChangeMonth).toBeNull();
  });
});
