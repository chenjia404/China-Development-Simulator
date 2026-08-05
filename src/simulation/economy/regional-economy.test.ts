import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ECONOMIC_REGION_IDS,
  ensureRegionalEconomyState,
  updateRegionalEconomy,
} from "./regional-economy";

describe("区域经济与跨区域流动", () => {
  it("六大区域完整分配全国人口、GDP、就业、投资和出口", () => {
    const state = createInitialGameState(9001);
    updateRegionalEconomy(state.nation);
    const regional = state.nation.regionalEconomy;
    const sum = (key: "population" | "realGDP" | "employment" | "investment" | "exports") =>
      ECONOMIC_REGION_IDS.reduce((total, id) => total + regional.regions[id][key], 0);
    expect(sum("population")).toBeCloseTo(state.nation.population.total, 2);
    expect(sum("realGDP")).toBeCloseTo(state.nation.economy.realGDP, 2);
    expect(sum("employment")).toBeCloseTo(state.nation.labor.employed, 2);
    expect(sum("investment")).toBeCloseTo(state.nation.economy.investment, 2);
    expect(sum("exports")).toBeCloseTo(state.nation.trade.exports, 2);
  });

  it("跨区人口、资本与财政净流动分别归零", () => {
    const state = createInitialGameState(9002);
    updateRegionalEconomy(state.nation);
    const regions = state.nation.regionalEconomy.regions;
    for (const key of ["netInterregionalMigration", "netCapitalFlow", "netFiscalTransfer"] as const) {
      const total = ECONOMIC_REGION_IDS.reduce((sum, id) => sum + regions[id][key], 0);
      expect(Math.abs(total)).toBeLessThan(0.01);
    }
    expect(state.nation.regionalEconomy.regionalGDPPerCapitaRatio).toBeGreaterThan(1);
  });

  it("旧存档缺失区域账户时确定性重建", () => {
    const legacy = createInitialGameState(9003);
    delete (legacy.nation as Partial<NationState>).regionalEconomy;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureRegionalEconomyState(first.nation);
    ensureRegionalEconomyState(second.nation);
    expect(first.nation.regionalEconomy).toEqual(second.nation.regionalEconomy);
  });

  it("仅史实/集中建设抬高中西部份额，取消三线不触发 inland 加成", () => {
    const inlandShare = (nation: NationState) => {
      const regions = nation.regionalEconomy.regions;
      return (
        (regions.central.population + regions.west.population) /
        nation.population.total
      );
    };
    const base = createInitialGameState(9004);
    updateRegionalEconomy(base.nation);
    const baselineShare = inlandShare(base.nation);

    const built = structuredClone(base);
    built.nation.history.historicalEvents.push({
      id: "third_front_construction_1964",
      name: "三线建设展开",
      year: 1964,
      month: 5,
      scheduledYear: 1964,
      scheduledMonth: 5,
      category: "工业化",
      impact: "mixed",
      description: "测试",
      effects: [],
      durationMonths: 192,
      choiceId: "historical_path",
      choiceName: "史实",
      choiceDescription: "测试",
      outcome: "occurred",
    });
    // 旧逻辑会误用同 sourceId 的取消修正触发 inland；此处故意写入以确认已改为看 outcome。
    built.nation.modifiers.push({
      id: "test-third-front",
      sourceId: "third_front_construction_1964",
      target: "capital.investmentEfficiency",
      operation: "multiply",
      value: 0.94,
      remainingMonths: 180,
      stackRule: "stack",
    });
    updateRegionalEconomy(built.nation);

    const canceled = structuredClone(base);
    canceled.nation.history.historicalEvents.push({
      id: "third_front_construction_1964",
      name: "三线建设展开",
      year: 1964,
      month: 5,
      scheduledYear: 1964,
      scheduledMonth: 5,
      category: "工业化",
      impact: "mixed",
      description: "测试",
      effects: [],
      durationMonths: 192,
      choiceId: "cancel_third_front",
      choiceName: "取消",
      choiceDescription: "测试",
      outcome: "prevented",
    });
    canceled.nation.modifiers.push({
      id: "test-cancel-third-front",
      sourceId: "third_front_construction_1964",
      target: "capital.investmentEfficiency",
      operation: "multiply",
      value: 1.06,
      remainingMonths: 180,
      stackRule: "stack",
    });
    updateRegionalEconomy(canceled.nation);

    expect(inlandShare(built.nation)).toBeGreaterThan(baselineShare);
    expect(inlandShare(canceled.nation)).toBeCloseTo(baselineShare, 6);
  });
});
