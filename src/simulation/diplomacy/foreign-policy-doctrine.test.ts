import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { updateInternationalTrade, calculateTradeAccess } from "../economy/trade";
import { createInitialGameState } from "../state/initial-state";
import { updateTechnology } from "../technology/research";
import { updateDiplomacy } from "./diplomacy";
import {
  foreignPolicyDoctrineDefinitions,
  foreignPolicyDoctrineEffects,
} from "./foreign-policy-doctrine";

function selectDoctrine(
  state: ReturnType<typeof createInitialGameState>,
  doctrineId: typeof state.nation.diplomacy.foreignPolicyDoctrineId,
): void {
  state.nation.diplomacy.foreignPolicyDoctrineId = doctrineId;
  state.nation.diplomacy.previousForeignPolicyDoctrineId = null;
  state.nation.diplomacy.foreignPolicyDoctrineProgress = 1;
}

function relation(
  state: ReturnType<typeof createInitialGameState>,
  countryId: string,
): number {
  return state.world.countries.find((country) => country.id === countryId)
    ?.relationWithChina ?? Number.NaN;
}

describe("外交学说", () => {
  it("提供现行、革命援助、和平共处、战略自主、经贸、多边和周边七种路线", () => {
    expect(foreignPolicyDoctrineDefinitions.map((doctrine) => doctrine.id)).toEqual([
      "status_quo",
      "revolutionary_internationalism",
      "peaceful_coexistence",
      "non_aligned_autonomy",
      "economic_diplomacy",
      "multilateral_institutionalism",
      "regional_good_neighborhood",
    ]);
    expect(new Set(foreignPolicyDoctrineDefinitions.map((item) => item.id)).size).toBe(7);
    for (const doctrine of foreignPolicyDoctrineDefinitions) {
      expect(doctrine.description.length).toBeGreaterThan(40);
      expect(doctrine.effects.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("学说与亲苏、平衡、亲西方阵营倾向可以自由组合", () => {
    const state = createInitialGameState(1949);
    state.nation.diplomacy.diplomaticPoints = 100;
    state.nation.diplomacy.strategyId = "pro_soviet";
    state.nation.diplomacy.strategyAlignment = -1;
    const engine = createSimulationEngine(state);
    engine.dispatch({
      type: "SET_FOREIGN_POLICY_DOCTRINE",
      doctrineId: "peaceful_coexistence",
    });

    expect(engine.getState().nation.diplomacy).toMatchObject({
      strategyId: "pro_soviet",
      strategyAlignment: -1,
      foreignPolicyDoctrineId: "peaceful_coexistence",
      previousForeignPolicyDoctrineId: "status_quo",
      foreignPolicyDoctrineProgress: 0,
      diplomaticPoints: 88,
      lastForeignPolicyDoctrineChangeMonth: 0,
    });
    expect(() =>
      engine.dispatch({
        type: "SET_FOREIGN_POLICY_DOCTRINE",
        doctrineId: "economic_diplomacy",
      }),
    ).toThrow("冷却 60 个月");

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 36 });
    expect(
      engine.getState().nation.diplomacy.foreignPolicyDoctrineProgress,
    ).toBeCloseTo(1);
    expect(
      engine.getState().nation.diplomacy.previousForeignPolicyDoctrineId,
    ).toBeNull();
  });

  it("放弃对外革命会改善非苏系关系并降低苏系伙伴关系", () => {
    const peaceful = createInitialGameState(1);
    const revolutionary = structuredClone(peaceful);
    selectDoctrine(peaceful, "peaceful_coexistence");
    selectDoctrine(revolutionary, "revolutionary_internationalism");

    for (let month = 0; month < 120; month += 1) {
      updateDiplomacy(peaceful);
      updateDiplomacy(revolutionary);
    }

    for (const countryId of ["usa", "japan", "south_korea", "india", "brazil"]) {
      expect(relation(peaceful, countryId)).toBeGreaterThan(
        relation(revolutionary, countryId),
      );
    }
    for (const countryId of ["russia", "north_korea", "vietnam", "poland", "albania"]) {
      expect(relation(peaceful, countryId)).toBeLessThan(
        relation(revolutionary, countryId),
      );
    }
    expect(relation(peaceful, "south_korea")).toBeGreaterThan(-30);
    expect(relation(peaceful, "north_korea")).toBeLessThan(50);
  });

  it("经贸外交提高市场、外资和技术扩散，但牺牲安全与外交点恢复", () => {
    const statusQuo = createInitialGameState(2);
    const economic = structuredClone(statusQuo);
    selectDoctrine(economic, "economic_diplomacy");
    for (const state of [statusQuo, economic]) {
      state.nation.trade.foreignInvestment = 1_000_000_000;
      state.nation.trade.openness = 0.5;
      state.nation.education.literacyRate = 0.8;
      state.nation.technology.index = 20;
    }

    updateDiplomacy(statusQuo);
    updateDiplomacy(economic);
    expect(economic.nation.diplomacy.securityIndex).toBeLessThan(
      statusQuo.nation.diplomacy.securityIndex,
    );
    expect(economic.nation.diplomacy.monthlyPointGain).toBeLessThan(
      statusQuo.nation.diplomacy.monthlyPointGain,
    );
    expect(calculateTradeAccess(economic).marketAccessMultiplier).toBeGreaterThan(
      calculateTradeAccess(statusQuo).marketAccessMultiplier,
    );

    updateInternationalTrade(statusQuo);
    updateInternationalTrade(economic);
    expect(economic.nation.trade.foreignInvestment).toBeGreaterThan(
      statusQuo.nation.trade.foreignInvestment,
    );
    updateTechnology(statusQuo.nation);
    updateTechnology(economic.nation);
    expect(economic.nation.technology.index).toBeGreaterThan(
      statusQuo.nation.technology.index,
    );
    expect(
      foreignPolicyDoctrineEffects(economic.nation).technologyDiffusionMultiplier,
    ).toBeGreaterThan(1);
  });

  it("多边合作提高广泛关系和声誉，周边合作更集中改善邻国", () => {
    const multilateral = createInitialGameState(3);
    const regional = structuredClone(multilateral);
    selectDoctrine(multilateral, "multilateral_institutionalism");
    selectDoctrine(regional, "regional_good_neighborhood");
    for (let month = 0; month < 120; month += 1) {
      updateDiplomacy(multilateral);
      updateDiplomacy(regional);
    }

    expect(multilateral.nation.diplomacy.globalReputation).toBeGreaterThan(
      regional.nation.diplomacy.globalReputation,
    );
    expect(relation(regional, "north_korea")).toBeGreaterThan(
      relation(multilateral, "north_korea"),
    );
    expect(relation(regional, "south_korea")).toBeGreaterThan(
      relation(multilateral, "south_korea"),
    );
    expect(relation(multilateral, "brazil")).toBeGreaterThan(
      relation(regional, "brazil"),
    );
  });

  it("旧存档缺少外交学说字段时确定性迁移为现行方针", () => {
    const state = createInitialGameState(1949);
    const legacy = state.nation.diplomacy as Partial<typeof state.nation.diplomacy>;
    delete legacy.foreignPolicyDoctrineId;
    delete legacy.previousForeignPolicyDoctrineId;
    delete legacy.foreignPolicyDoctrineProgress;
    delete legacy.lastForeignPolicyDoctrineChangeMonth;

    const engine = createSimulationEngine(state);
    expect(engine.getState().nation.diplomacy).toMatchObject({
      foreignPolicyDoctrineId: "status_quo",
      previousForeignPolicyDoctrineId: null,
      foreignPolicyDoctrineProgress: 1,
      lastForeignPolicyDoctrineChangeMonth: null,
    });
    expect(() => engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 })).not.toThrow();
  });
});
