import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import {
  applyPolicyModifiers,
  getNationalPolicy,
  maximumActivePolicies,
  validatePolicySelection,
} from "./policy-engine";

describe("国策系统", () => {
  it("拒绝未知、重复、超额和相互冲突的国策组合", () => {
    expect(() => validatePolicySelection(["unknown_policy"])).toThrow("未知国策");
    expect(() =>
      validatePolicySelection(["education_priority", "education_priority"]),
    ).toThrow("不得重复");
    expect(() =>
      validatePolicySelection(
        Array.from({ length: maximumActivePolicies + 1 }, (_, index) =>
          [
            "education_priority",
            "technology_priority",
            "expand_opening",
            "livelihood_priority",
            "family_support",
          ][index],
        ),
      ),
    ).toThrow("不得超过");
    expect(() =>
      validatePolicySelection(["agriculture_priority", "industry_priority"]),
    ).toThrow("冲突");
    expect(() =>
      validatePolicySelection([
        "remittance_protection",
        "centralized_fx_settlement",
      ]),
    ).toThrow("冲突");
  });

  it("国策效果按过渡期逐月生效，而不是瞬间达到满值", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    engine.dispatch({ type: "SET_POLICIES", policyIds: ["technology_priority"] });

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    const firstMonth = engine.getState().nation;
    expect(firstMonth.policyProgress.technology_priority).toBeCloseTo(1 / 60, 8);
    expect(
      applyPolicyModifiers(firstMonth, "technology.researchOutput", 1),
    ).toBeGreaterThan(1);
    expect(
      applyPolicyModifiers(firstMonth, "technology.researchOutput", 1),
    ).toBeLessThan(1.12);

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 59 });
    const maturePolicy = engine.getState().nation;
    expect(maturePolicy.policyProgress.technology_priority).toBeCloseTo(1, 8);
    expect(
      applyPolicyModifiers(maturePolicy, "technology.researchOutput", 1),
    ).toBeCloseTo(1.12, 8);
  });

  it("韩国式追赶国策同时包含资本、技能、出口学习和现实代价", () => {
    expect(maximumActivePolicies).toBe(5);
    expect(getNationalPolicy("developmental_finance")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "capital.privateInvestment",
          operation: "multiply",
          value: 1.22,
        }),
        expect.objectContaining({
          target: "economy.consumptionPropensity",
          operation: "add",
          value: -0.04,
        }),
      ]),
    );
    expect(getNationalPolicy("vocational_technical_education")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "education.humanCapitalFormation",
          value: 1.3,
        }),
      ]),
    );
    expect(getNationalPolicy("export_industrial_zones")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "capital.exportSurplusReinvestmentRate",
          value: 0.55,
        }),
        expect.objectContaining({
          target: "resources.energyDemand",
          value: 1.08,
        }),
      ]),
    );
    expect(getNationalPolicy("industrial_upgrading")?.transitionMonths).toBe(72);
  });

  it("取消国策后效果按相同过渡期逐步退出", () => {
    const engine = createSimulationEngine(createInitialGameState(1949));
    engine.dispatch({ type: "SET_POLICIES", policyIds: ["family_support"] });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 60 });
    engine.dispatch({ type: "SET_POLICIES", policyIds: [] });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });

    expect(engine.getState().nation.policyProgress.family_support).toBeCloseTo(
      59 / 60,
      8,
    );
  });

  it("旧存档缺少国策进度时可由引擎自动迁移", () => {
    const state = createInitialGameState(1949);
    delete (state.nation as Partial<typeof state.nation>).policyProgress;

    const engine = createSimulationEngine(state);
    expect(engine.getState().nation.policyProgress).toEqual({});
  });
});
