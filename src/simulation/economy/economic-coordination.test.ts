import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { addModifier } from "../events/modifiers";
import { createInitialGameState } from "../state/initial-state";
import {
  applyHistoricalEconomicCoordinationStance,
  classifyEconomicSystem,
  economicCoordinationDistortionBias,
  economicCoordinationPrivateEconomyBias,
  economicCoordinationSecondaryAllocationBias,
  economicCoordinationStanceCooldownRemaining,
  ensureEconomicCoordinationState,
  setEconomicCoordinationStance,
  updateEconomicCoordination,
} from "./economic-coordination";

describe("经济协调体制", () => {
  it("旧存档缺失字段时可确定性补齐", () => {
    const nation = createInitialGameState(1949).nation;
    delete (nation as { economicCoordination?: unknown }).economicCoordination;
    ensureEconomicCoordinationState(nation);
    expect(nation.economicCoordination.planningIntensity).toBeGreaterThan(0.6);
    expect(nation.economicCoordination.domesticMarketFreedom).toBeLessThan(0.35);
    expect(nation.economicCoordination.landStance).toBe("household_farming");
  });

  it("开局目标与库存一致，不会首月系统性漂移", () => {
    const nation = createInitialGameState(1949).nation;
    const before = {
      planning: nation.economicCoordination.planningIntensity,
      market: nation.economicCoordination.domesticMarketFreedom,
    };
    updateEconomicCoordination(nation);
    expect(nation.economicCoordination.planningTarget).toBeCloseTo(before.planning, 8);
    expect(nation.economicCoordination.domesticMarketFreedomTarget).toBeCloseTo(
      before.market,
      8,
    );
    expect(nation.economicCoordination.planningIntensity).toBeCloseTo(
      before.planning,
      8,
    );
  });

  it("旧存档迁移会回放历史事件姿态并派生公有份额", () => {
    const nation = createInitialGameState(1960, 1960).nation;
    nation.history.historicalEvents = [
      {
        id: "industry_wide_joint_ownership_1956",
        name: "全行业公私合营",
        year: 1956,
        month: 1,
        scheduledYear: 1956,
        scheduledMonth: 1,
        category: "经济制度",
        impact: "mixed",
        description: "测试",
        effects: [],
        durationMonths: 60,
        choiceId: "historical_path",
        choiceName: "史实路径",
        choiceDescription: "测试",
        outcome: "occurred",
      },
      {
        id: "peoples_communes_1958",
        name: "人民公社化运动",
        year: 1958,
        month: 8,
        scheduledYear: 1958,
        scheduledMonth: 8,
        category: "农业农村",
        impact: "negative",
        description: "测试",
        effects: [],
        durationMonths: 36,
        choiceId: "historical_path",
        choiceName: "史实路径",
        choiceDescription: "测试",
        outcome: "occurred",
      },
    ];
    nation.enterprises.stateControlledShare = 0.77;
    delete (nation as { economicCoordination?: unknown }).economicCoordination;
    ensureEconomicCoordinationState(nation);
    expect(nation.economicCoordination.enterpriseStance).toBe("soe_led");
    expect(nation.economicCoordination.landStance).toBe("collective");
    expect(nation.economicCoordination.priceStance).toBe("planned");
    expect(nation.economicCoordination.publicOwnershipShare).toBeCloseTo(0.77, 8);
    expect(nation.economicCoordination.planningIntensity).toBeGreaterThan(0.85);
  });

  it("高计划姿态提高二次产业配置偏置并压低民营经营流量", () => {
    const planned = createInitialGameState(1949).nation;
    const market = createInitialGameState(1949).nation;

    setEconomicCoordinationStance(planned, "land", "collective");
    setEconomicCoordinationStance(planned, "enterprise", "soe_led");
    setEconomicCoordinationStance(planned, "price", "planned");
    for (let month = 0; month < 36; month += 1) {
      updateEconomicCoordination(planned);
    }

    setEconomicCoordinationStance(market, "land", "household_farming");
    setEconomicCoordinationStance(market, "enterprise", "private_led");
    setEconomicCoordinationStance(market, "price", "free");
    for (let month = 0; month < 36; month += 1) {
      updateEconomicCoordination(market);
    }

    expect(planned.economicCoordination.planningIntensity).toBeGreaterThan(
      market.economicCoordination.planningIntensity,
    );
    expect(market.economicCoordination.domesticMarketFreedom).toBeGreaterThan(
      planned.economicCoordination.domesticMarketFreedom,
    );
    expect(economicCoordinationSecondaryAllocationBias(planned)).toBeGreaterThan(
      economicCoordinationSecondaryAllocationBias(market),
    );
    expect(economicCoordinationDistortionBias(planned)).toBeGreaterThan(
      economicCoordinationDistortionBias(market),
    );
    expect(
      economicCoordinationPrivateEconomyBias(market).operatingSpace,
    ).toBeGreaterThan(
      economicCoordinationPrivateEconomyBias(planned).operatingSpace,
    );
  });

  it("历史事件目标修正推动计划强度上升而不改写所有制公式", () => {
    const nation = createInitialGameState(1949).nation;
    const control = createInitialGameState(1949).nation;
    nation.economicCoordination.planningIntensity = 0.5;
    control.economicCoordination.planningIntensity = 0.5;
    const beforeShares = { ...nation.enterprises.ownership };
    addModifier(nation, {
      id: "test_planning_push",
      sourceId: "test",
      target: "economicCoordination.planningTarget",
      operation: "add",
      value: 0.2,
      remainingMonths: 24,
      stackRule: "stack",
    });
    for (let month = 0; month < 24; month += 1) {
      updateEconomicCoordination(nation);
      updateEconomicCoordination(control);
    }
    expect(nation.economicCoordination.planningIntensity).toBeGreaterThan(
      control.economicCoordination.planningIntensity + 0.08,
    );
    expect(nation.enterprises.ownership.state_owned.valueAddedShare).toBe(
      beforeShares.state_owned.valueAddedShare,
    );
  });

  it("槽外姿态命令可切换且受冷却约束", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    engine.dispatch({
      type: "SET_ECONOMIC_COORDINATION_STANCE",
      axis: "enterprise",
      stance: "soe_led",
    });
    expect(engine.getState().nation.economicCoordination.enterpriseStance).toBe(
      "soe_led",
    );
    expect(() =>
      engine.dispatch({
        type: "SET_ECONOMIC_COORDINATION_STANCE",
        axis: "enterprise",
        stance: "private_led",
      })
    ).toThrow(/等待/);
  });

  it("历史事件写入姿态后当月不可立即改回", () => {
    const nation = createInitialGameState(1958, 1958).nation;
    nation.date.month = 8;
    nation.date.elapsedMonths = 12;
    applyHistoricalEconomicCoordinationStance(nation, "peoples_communes_1958", {
      outcome: "occurred",
      choiceId: "historical_path",
      recordCooldown: true,
    });
    expect(nation.economicCoordination.landStance).toBe("collective");
    expect(economicCoordinationStanceCooldownRemaining(nation, "land")).toBe(6);
    expect(() =>
      setEconomicCoordinationStance(nation, "land", "household_farming")
    ).toThrow(/等待/);
  });

  it("阻止或反事实选择不写入史实制度姿态", () => {
    const nation = createInitialGameState(1958, 1958).nation;
    applyHistoricalEconomicCoordinationStance(nation, "peoples_communes_1958", {
      outcome: "prevented",
      choiceId: "avoid_communes",
    });
    expect(nation.economicCoordination.landStance).toBe("household_farming");
    applyHistoricalEconomicCoordinationStance(
      nation,
      "industry_wide_joint_ownership_1956",
      { outcome: "occurred", choiceId: "preserve_mixed_ownership" },
    );
    expect(nation.economicCoordination.enterpriseStance).toBe("mixed");
  });

  it("拒绝非法制度姿态轴", () => {
    const nation = createInitialGameState(1949).nation;
    expect(() =>
      setEconomicCoordinationStance(
        nation,
        "unknown" as "land",
        "collective",
      )
    ).toThrow(/未知制度姿态轴/);
  });

  it("公有份额只读派生自企业账户，并参与类型判定", () => {
    const nation = createInitialGameState(1949).nation;
    nation.enterprises.stateControlledShare = 0.85;
    nation.economicCoordination.planningIntensity = 0.86;
    nation.economicCoordination.domesticMarketFreedom = 0.15;
    updateEconomicCoordination(nation);
    expect(nation.economicCoordination.publicOwnershipShare).toBeCloseTo(0.85, 8);
    expect(classifyEconomicSystem(nation).id).toBe("highly_planned");
  });

  it("同种子连续运行结果确定", () => {
    const run = () => {
      const engine = createSimulationEngine(createInitialGameState(1949));
      engine.dispatch({ type: "ADVANCE_MONTHS", months: 24 });
      const nation = engine.getState().nation;
      return {
        planning: nation.economicCoordination.planningIntensity,
        market: nation.economicCoordination.domesticMarketFreedom,
        publicShare: nation.economicCoordination.publicOwnershipShare,
        gdp: nation.economy.realGDP,
      };
    };
    expect(run()).toEqual(run());
  });
});
