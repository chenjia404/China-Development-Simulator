import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { createInitialGameState } from "../state/initial-state";
import { ensureEducationState, updateEducation } from "./education";
import { updateHealth } from "./health";
import { updateTechnology } from "../technology/research";

describe("教育、医疗和科技", () => {
  it("教育投入不会在首月释放全部收益", () => {
    const state = createInitialGameState(1);
    const before = state.nation.education.index;
    state.nation.fiscal.budget.education = 0.5;
    updateEducation(state.nation);

    expect(state.nation.education.index - before).toBeLessThan(5);
    expect(state.nation.education.delayedInvestment.at(-1)).toBeGreaterThan(0);
  });

  it("长期教育投入通过毕业队列显著提高教育水平", () => {
    const invested = createSimulationEngine(createInitialGameState(11));
    const neglectedState = createInitialGameState(11);
    neglectedState.nation.fiscal.budget.education = 0;
    neglectedState.nation.budgetManuallyAdjusted = true;
    const neglected = createSimulationEngine(neglectedState);

    invested.dispatch({ type: "ADVANCE_MONTHS", months: 240 });
    neglected.dispatch({ type: "ADVANCE_MONTHS", months: 240 });

    expect(invested.getState().nation.education.index).toBeGreaterThan(
      neglected.getState().nation.education.index,
    );
    expect(invested.getState().nation.economy.humanCapitalIndex).toBeGreaterThan(
      neglected.getState().nation.economy.humanCapitalIndex,
    );
  });

  it("持续医疗投入改善覆盖和预期寿命", () => {
    const supported = createInitialGameState(2);
    const neglected = createInitialGameState(2);
    neglected.nation.fiscal.budget.health = 0;
    neglected.nation.budgetManuallyAdjusted = true;

    for (let month = 0; month < 240; month += 1) {
      updateHealth(supported.nation);
      updateHealth(neglected.nation);
    }

    expect(supported.nation.health.coverageRate).toBeGreaterThan(
      neglected.nation.health.coverageRate,
    );
    expect(supported.nation.health.lifeExpectancy).toBeGreaterThan(
      neglected.nation.health.lifeExpectancy,
    );
  });

  it("科研人才不足会限制相同预算的科研产出", () => {
    const weak = createInitialGameState(3);
    const strong = createInitialGameState(3);
    weak.nation.education.researchTalent = 100;
    strong.nation.education.researchTalent = 5_000_000;

    updateTechnology(weak.nation);
    updateTechnology(strong.nation);

    expect(strong.nation.technology.monthlyResearchOutput).toBeGreaterThan(
      weak.nation.technology.monthlyResearchOutput,
    );
  });

  it("旧存档会确定性补齐教育中断和科研人才损失字段", () => {
    const nation = createInitialGameState(9).nation;
    const oldEducation = nation.education as Partial<typeof nation.education>;
    delete oldEducation.higherEducationAdmissionCapacity;
    delete oldEducation.academicContinuity;
    delete oldEducation.researchCohortGap;
    delete oldEducation.educationDisruptionMonths;
    delete oldEducation.permanentResearchTalentLosses;

    ensureEducationState(nation);

    expect(nation.education).toMatchObject({
      higherEducationAdmissionCapacity: 1,
      academicContinuity: 1,
      researchCohortGap: 0,
      educationDisruptionMonths: 0,
      permanentResearchTalentLosses: 0,
    });
  });

  it("连续一百年所有社会发展指数仍在边界内", () => {
    const engine = createSimulationEngine(createInitialGameState(88));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1_200 });
    const nation = engine.getState().nation;

    expect(nation.education.index).toBeGreaterThanOrEqual(0);
    expect(nation.education.index).toBeLessThanOrEqual(100);
    expect(nation.health.index).toBeGreaterThanOrEqual(0);
    expect(nation.health.index).toBeLessThanOrEqual(100);
    expect(nation.health.lifeExpectancy).toBeGreaterThanOrEqual(20);
    expect(nation.health.lifeExpectancy).toBeLessThanOrEqual(100);
    expect(nation.technology.index).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(nation.technology.index)).toBe(true);
    expect(nation.technology.index).toBeLessThan(2_000);
    expect(nation.society.happinessIndex).toBeGreaterThanOrEqual(0);
    expect(nation.society.happinessIndex).toBeLessThanOrEqual(100);
  }, 20_000);
});
