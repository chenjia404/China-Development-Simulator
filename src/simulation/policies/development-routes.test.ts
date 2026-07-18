import { describe, expect, it } from "vitest";
import {
  developmentRouteBlueprints,
  getDevelopmentRouteBlueprint,
  validateDevelopmentRouteBlueprints,
} from "./development-routes";

describe("多元发展路线蓝图", () => {
  it("五组蓝图均引用合法可组合国策，并同时说明收益和代价", () => {
    expect(validateDevelopmentRouteBlueprints).not.toThrow();
    expect(developmentRouteBlueprints).toHaveLength(5);
    expect(
      developmentRouteBlueprints.map((blueprint) => blueprint.referenceEconomy),
    ).toEqual(["台湾", "香港", "新加坡", "美国", "日本"]);
    for (const blueprint of developmentRouteBlueprints) {
      expect(blueprint.policyIds).toHaveLength(5);
      expect(blueprint.strengths.length).toBeGreaterThan(0);
      expect(blueprint.tradeoffs.length).toBeGreaterThan(0);
    }
  });

  it("蓝图只是推荐组合，国策仍可跨路线自由混搭", () => {
    expect(getDevelopmentRouteBlueprint("us_innovation_market")?.policyIds)
      .toContain("venture_capital_markets");
    expect(getDevelopmentRouteBlueprint("japan_quality_industry")?.policyIds)
      .toContain("quality_manufacturing_system");
    expect(getDevelopmentRouteBlueprint("unknown")).toBeUndefined();
  });
});
