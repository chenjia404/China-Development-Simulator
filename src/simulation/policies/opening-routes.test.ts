import { describe, expect, it } from "vitest";
import {
  getOpeningDevelopmentBlueprint,
  openingDevelopmentBlueprints,
  validateOpeningDevelopmentBlueprints,
} from "./opening-routes";

describe("开局发展蓝图", () => {
  it("四条中国语境蓝图均可组合，并同时说明收益和代价", () => {
    expect(validateOpeningDevelopmentBlueprints).not.toThrow();
    expect(openingDevelopmentBlueprints).toHaveLength(4);
    expect(openingDevelopmentBlueprints.map((blueprint) => blueprint.id)).toEqual([
      "heavy_industry_priority",
      "agriculture_first",
      "education_science",
      "light_export_earning",
    ]);
    for (const blueprint of openingDevelopmentBlueprints) {
      expect(blueprint.policyIds.length).toBeGreaterThan(0);
      expect(blueprint.policyIds.length).toBeLessThanOrEqual(5);
      expect(blueprint.strengths.length).toBeGreaterThan(0);
      expect(blueprint.tradeoffs.length).toBeGreaterThan(0);
    }
  });

  it("可按 id 读取已知蓝图", () => {
    expect(getOpeningDevelopmentBlueprint("heavy_industry_priority")?.name).toBe(
      "重工业优先",
    );
    expect(getOpeningDevelopmentBlueprint("unknown")).toBeUndefined();
  });
});
