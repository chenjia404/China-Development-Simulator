import { describe, expect, it } from "vitest";
import { addModifier } from "../events/modifiers";
import { createInitialGameState } from "../state/initial-state";
import { technologyTreeDefinitions } from "../technology/technology-tree";
import {
  ensureDomesticDemandState,
  updateDemandDrivenCapacityUtilization,
  updateHouseholdAndDomesticDemand,
} from "./domestic-demand";
import { calculateGDP } from "./gdp";
import { updateIndustrialStructure } from "./industrial-structure";
import { calculateIndustryOutputs } from "./production";
import { updateInternationalTrade } from "./trade";

describe("内外需求与经济产出的传导", () => {
  it("历史事件 modifier 可降低民生福利支出并压制消费倾向", () => {
    const baseline = createInitialGameState(1956).nation;
    baseline.fiscal.budget.welfare = 0.12;
    baseline.fiscal.expenditure = baseline.economy.nominalGDP * 0.2;
    const modified = structuredClone(baseline);
    addModifier(modified, {
      id: "test:wellbeing.welfare",
      sourceId: "test",
      target: "wellbeing.welfare",
      operation: "multiply",
      value: 0.5,
      remainingMonths: 12,
      stackRule: "stack",
    });
    addModifier(modified, {
      id: "test:economy.consumptionPropensity",
      sourceId: "test",
      target: "economy.consumptionPropensity",
      operation: "add",
      value: -0.08,
      remainingMonths: 12,
      stackRule: "stack",
    });

    updateHouseholdAndDomesticDemand(baseline);
    updateHouseholdAndDomesticDemand(modified);

    expect(modified.economy.socialProtectionIncome).toBeCloseTo(
      baseline.economy.socialProtectionIncome * 0.5,
      6,
    );
    expect(modified.economy.consumptionPropensity).toBeLessThan(
      baseline.economy.consumptionPropensity - 0.05,
    );
  });

  it("社会保障通过转移收入和降低预防性储蓄扩大内需，但不直接改写GDP", () => {
    const weakProtection = createInitialGameState(1949).nation;
    const strongProtection = structuredClone(weakProtection);
    weakProtection.fiscal.budget.welfare = 0.01;
    strongProtection.fiscal.budget.welfare = 0.24;
    for (const nation of [weakProtection, strongProtection]) {
      nation.fiscal.expenditure = nation.economy.nominalGDP * 0.18;
      calculateGDP(nation);
    }

    expect(strongProtection.economy.realGDP).toBe(weakProtection.economy.realGDP);
    expect(strongProtection.economy.socialProtectionIncome).toBeGreaterThan(
      weakProtection.economy.socialProtectionIncome,
    );
    expect(strongProtection.economy.consumptionPropensity).toBeGreaterThan(
      weakProtection.economy.consumptionPropensity,
    );
    expect(strongProtection.economy.householdConsumption).toBeGreaterThan(
      weakProtection.economy.householdConsumption,
    );
    expect(strongProtection.economy.domesticDemand).toBeGreaterThan(
      weakProtection.economy.domesticDemand,
    );
  });

  it("已经实现的出口订单提高下一阶段工业产能利用率和GDP", () => {
    const domesticOnly = createInitialGameState(1949).nation;
    const exportLed = structuredClone(domesticOnly);
    domesticOnly.trade.exports = 0;
    exportLed.trade.exports = exportLed.economy.nominalGDP * 0.45;
    for (let month = 0; month < 24; month += 1) {
      updateDemandDrivenCapacityUtilization(domesticOnly);
      updateDemandDrivenCapacityUtilization(exportLed);
    }
    calculateIndustryOutputs(domesticOnly);
    calculateIndustryOutputs(exportLed);
    calculateGDP(domesticOnly);
    calculateGDP(exportLed);

    expect(exportLed.sectors.secondary.capacityUtilization).toBeGreaterThan(
      domesticOnly.sectors.secondary.capacityUtilization,
    );
    expect(exportLed.sectors.secondary.valueAdded).toBeGreaterThan(
      domesticOnly.sectors.secondary.valueAdded,
    );
    expect(exportLed.economy.realGDP).toBeGreaterThan(domesticOnly.economy.realGDP);
  });

  it("科技树、工业能力和外交市场共同决定出口上限", () => {
    const constrained = createInitialGameState(1949);
    const capable = structuredClone(constrained);
    for (const state of [constrained, capable]) {
      state.nation.trade.openness = 0.72;
      state.nation.education.index = 88;
    }
    capable.nation.technology.index = 95;
    capable.nation.technology.completedTechnologyIds = technologyTreeDefinitions.map(
      (node) => node.id,
    );
    for (const country of capable.world.countries) {
      country.relationWithChina = 70;
      country.tradeAgreement = true;
    }
    for (const country of constrained.world.countries) {
      country.relationWithChina = -35;
    }
    for (let month = 0; month < 180; month += 1) {
      updateIndustrialStructure(constrained.nation);
      updateIndustrialStructure(capable.nation);
    }
    calculateIndustryOutputs(constrained.nation);
    calculateIndustryOutputs(capable.nation);
    calculateGDP(constrained.nation);
    calculateGDP(capable.nation);
    updateInternationalTrade(constrained);
    updateInternationalTrade(capable);

    expect(capable.nation.trade.exports).toBeGreaterThan(
      constrained.nation.trade.exports,
    );
  });

  it("旧存档缺少内需统计时可以确定性补齐", () => {
    const nation = createInitialGameState(1949).nation;
    const legacyEconomy = nation.economy as Partial<typeof nation.economy>;
    delete legacyEconomy.householdDisposableIncome;
    delete legacyEconomy.consumptionPropensity;
    delete legacyEconomy.socialProtectionIncome;
    delete legacyEconomy.domesticDemand;
    delete legacyEconomy.domesticDemandShare;

    ensureDomesticDemandState(nation);

    expect(nation.economy.householdDisposableIncome).toBeGreaterThan(0);
    expect(nation.economy.consumptionPropensity).toBeGreaterThan(0);
    expect(nation.economy.domesticDemand).toBeGreaterThan(0);
    expect(Number.isFinite(nation.economy.domesticDemandShare)).toBe(true);
  });
});
