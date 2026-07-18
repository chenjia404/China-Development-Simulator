import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  EDUCATION_STAGE_IDS,
  LABOR_SKILL_IDS,
  ensureHumanDevelopmentState,
  updateHumanDevelopment,
} from "./human-development";

describe("教育劳动力与医疗深化", () => {
  it("学段人口、劳动力和就业细账守恒", () => {
    const state = createInitialGameState(8801);
    updateHumanDevelopment(state.nation);
    const detail = state.nation.humanDevelopment;
    expect(EDUCATION_STAGE_IDS.reduce((sum, id) => sum + detail.educationStages[id].eligiblePopulation, 0)).toBeCloseTo(state.nation.population.ageGroups.children, 4);
    expect(LABOR_SKILL_IDS.reduce((sum, id) => sum + detail.laborSkills[id].laborForce, 0)).toBeCloseTo(state.nation.labor.laborForce, 4);
    expect(LABOR_SKILL_IDS.reduce((sum, id) => sum + detail.laborSkills[id].employed, 0)).toBeCloseTo(state.nation.labor.employed, 4);
  });

  it("教育科技提高高级技能份额并改善技能匹配", () => {
    const low = createInitialGameState(8802);
    const high = structuredClone(low);
    high.nation.education.index = 95;
    high.nation.technology.index = 90;
    high.nation.labor.skillMatchRate = 0.92;
    updateHumanDevelopment(low.nation);
    updateHumanDevelopment(high.nation);
    expect(high.nation.humanDevelopment.laborSkills.advanced.laborForce)
      .toBeGreaterThan(low.nation.humanDevelopment.laborSkills.advanced.laborForce);
    expect(high.nation.humanDevelopment.skillMismatchRate)
      .toBeLessThan(low.nation.humanDevelopment.skillMismatchRate);
  });

  it("医疗覆盖降低传染病和个人支付负担", () => {
    const weak = createInitialGameState(8803);
    const covered = structuredClone(weak);
    covered.nation.health.coverageRate = 0.98;
    covered.nation.fiscal.budget.health = 0.22;
    updateHumanDevelopment(weak.nation);
    updateHumanDevelopment(covered.nation);
    expect(covered.nation.humanDevelopment.communicableDiseaseBurden)
      .toBeLessThan(weak.nation.humanDevelopment.communicableDiseaseBurden);
    expect(covered.nation.humanDevelopment.outOfPocketHealthShare)
      .toBeLessThan(weak.nation.humanDevelopment.outOfPocketHealthShare);
  });

  it("旧存档缺失人力发展细账时确定性重建", () => {
    const legacy = createInitialGameState(8804);
    delete (legacy.nation as Partial<NationState>).humanDevelopment;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureHumanDevelopmentState(first.nation);
    ensureHumanDevelopmentState(second.nation);
    expect(first.nation.humanDevelopment).toEqual(second.nation.humanDevelopment);
  });
});
