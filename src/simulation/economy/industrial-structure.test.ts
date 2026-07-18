import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { updateInternationalTrade } from "./trade";
import { calculateIndustryOutputs } from "./production";
import {
  calculateIndustrialStructureMetrics,
  ensureIndustrialStructureState,
  industrialCategoryDefinitions,
  updateIndustrialStructure,
  validateIndustrialCategoryDefinitions,
} from "./industrial-structure";
import { technologyTreeDefinitions } from "../technology/technology-tree";

describe("工业细分结构", () => {
  it("十一类工业配置完整且基准份额之和为1", () => {
    expect(() => validateIndustrialCategoryDefinitions()).not.toThrow();
    expect(industrialCategoryDefinitions).toHaveLength(11);
    expect(
      industrialCategoryDefinitions.reduce((sum, item) => sum + item.baselineShare, 0),
    ).toBeCloseTo(1, 10);
  });

  it("工业类别产出与增加值完整汇总到第二产业", () => {
    const nation = createInitialGameState(1949).nation;
    calculateIndustryOutputs(nation);
    const categories = Object.values(nation.industries);
    expect(categories.reduce((sum, item) => sum + item.outputShare, 0)).toBeCloseTo(1, 10);
    expect(categories.reduce((sum, item) => sum + item.output, 0)).toBeCloseTo(
      nation.sectors.secondary.output,
      4,
    );
    expect(categories.reduce((sum, item) => sum + item.valueAdded, 0)).toBeCloseTo(
      nation.sectors.secondary.valueAdded,
      4,
    );
  });

  it("教育和科技节点积累会提高工业复杂度、高技术占比与出口能力", () => {
    const constrained = createInitialGameState(1949).nation;
    const capable = structuredClone(constrained);
    capable.education.index = 90;
    capable.technology.index = 95;
    capable.trade.openness = 0.75;
    capable.technology.completedTechnologyIds = technologyTreeDefinitions.map(
      (node) => node.id,
    );
    for (let month = 0; month < 240; month += 1) {
      updateIndustrialStructure(constrained);
      updateIndustrialStructure(capable);
    }
    const constrainedMetrics = calculateIndustrialStructureMetrics(constrained);
    const capableMetrics = calculateIndustrialStructureMetrics(capable);
    expect(capableMetrics.complexityIndex).toBeGreaterThan(
      constrainedMetrics.complexityIndex,
    );
    expect(capableMetrics.highTechnologyShare).toBeGreaterThan(
      constrainedMetrics.highTechnologyShare,
    );
    expect(capableMetrics.exportCapability).toBeGreaterThan(
      constrainedMetrics.exportCapability,
    );
    expect(capableMetrics.outputMultiplier).toBeGreaterThan(
      constrainedMetrics.outputMultiplier,
    );
  });

  it("工业类别能力会显著改变出口规模和类别出口构成", () => {
    const constrained = createInitialGameState(1949);
    const capable = structuredClone(constrained);
    for (const state of [constrained, capable]) {
      state.nation.education.index = 80;
      state.nation.technology.index = 85;
      state.nation.trade.openness = 0.7;
    }
    capable.nation.technology.completedTechnologyIds = technologyTreeDefinitions.map(
      (node) => node.id,
    );
    for (let month = 0; month < 180; month += 1) {
      updateIndustrialStructure(constrained.nation);
      updateIndustrialStructure(capable.nation);
    }
    calculateIndustryOutputs(constrained.nation);
    calculateIndustryOutputs(capable.nation);
    updateInternationalTrade(constrained);
    updateInternationalTrade(capable);
    const capableIndustrialExports = Object.values(capable.nation.industries).reduce(
      (sum, item) => sum + item.exportValue,
      0,
    );
    expect(capable.nation.trade.exports).toBeGreaterThan(
      constrained.nation.trade.exports,
    );
    expect(capableIndustrialExports).toBeGreaterThan(0);
    expect(capableIndustrialExports).toBeLessThanOrEqual(capable.nation.trade.exports);
    expect(capable.nation.industries.electronics_communications.exportValue).toBeGreaterThan(
      constrained.nation.industries.electronics_communications.exportValue,
    );
  });

  it("旧存档缺失工业细分结构时按第二产业总量确定性重建", () => {
    const nation = createInitialGameState(1949).nation;
    const legacyNation = nation as Partial<typeof nation>;
    delete legacyNation.industries;
    ensureIndustrialStructureState(nation);
    expect(Object.values(nation.industries)).toHaveLength(11);
    expect(
      Object.values(nation.industries).reduce((sum, item) => sum + item.output, 0),
    ).toBeCloseTo(nation.sectors.secondary.output, 4);
  });
});
