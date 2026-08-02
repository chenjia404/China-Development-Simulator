import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { worldCountryConfigs } from "./countries";
import {
  cityStateImportAbsorptionMultiplier,
  cityStateRelationForCountry,
  cityStateRelationLabels,
  validateCityStateRelations,
} from "./city-state-relations";
import {
  calculateCountryImportDemand,
  calculateForeignImportPool,
} from "./foreign-market-demand";

describe("城邦关系标签", () => {
  it("64 国配置完整且倍率为正", () => {
    expect(() => validateCityStateRelations()).not.toThrow();
    expect(worldCountryConfigs).toHaveLength(64);
    expect(Object.keys(cityStateRelationLabels)).toHaveLength(3);
  });

  it("贸易伙伴进口吸收高于竞争对手", () => {
    expect(cityStateImportAbsorptionMultiplier("trade_partner"))
      .toBeGreaterThan(cityStateImportAbsorptionMultiplier("competitor"));
    expect(cityStateImportAbsorptionMultiplier("aid_recipient"))
      .toBeGreaterThan(cityStateImportAbsorptionMultiplier("competitor"));
  });

  it("开局各国带有城邦关系标签", () => {
    const state = createInitialGameState(9401);
    for (const config of worldCountryConfigs) {
      const country = state.world.countries.find((item) => item.id === config.id);
      expect(country?.cityStateRelation).toBe(cityStateRelationForCountry(config.id));
    }
  });

  it("城邦关系倍率直接影响单国进口吸收", () => {
    const state = createInitialGameState(9402);
    const japan = state.world.countries.find((item) => item.id === "japan");
    if (!japan) throw new Error("日本不存在");
    japan.cityStateRelation = "competitor";
    const competitorDemand = calculateCountryImportDemand(japan);
    japan.cityStateRelation = "trade_partner";
    const partnerDemand = calculateCountryImportDemand(japan);
    expect(partnerDemand).toBeGreaterThan(competitorDemand);
  });

  it("同类国家切换城邦关系会改变外国进口池", () => {
    const state = createInitialGameState(9402);
    const japan = state.world.countries.find((item) => item.id === "japan");
    if (!japan) throw new Error("日本不存在");
    const competitorPool = calculateForeignImportPool(state);
    japan.cityStateRelation = "trade_partner";
    const partnerPool = calculateForeignImportPool(state);
    expect(partnerPool).toBeGreaterThan(competitorPool);
  });
});
