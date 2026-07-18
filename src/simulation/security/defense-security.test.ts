import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ensureSecurityDefenseState,
  updateSecurityDefense,
} from "./defense-security";

describe("国防战争与国家安全", () => {
  it("国防预算分配和装备库存保持有限非负", () => {
    const state = createInitialGameState(9201);
    for (let month = 0; month < 24; month += 1) updateSecurityDefense(state.nation);
    const defense = state.nation.securityDefense;
    expect(defense.personnelExpenditure + defense.equipmentInvestment +
      defense.logisticsExpenditure + defense.researchExpenditure)
      .toBeCloseTo(defense.annualDefenseBudget, 2);
    expect(defense.defenseCapitalStock).toBeGreaterThan(0);
    expect(defense.readinessIndex).toBeGreaterThanOrEqual(0);
  });

  it("战争动员提高预算、人员和成本并累计伤亡", () => {
    const peace = createInitialGameState(9202);
    const war = structuredClone(peace);
    war.nation.modifiers.push({ id: "war-test", sourceId: "korean_war_1950",
      target: "fiscal.spending", operation: "multiply", value: 1.06,
      remainingMonths: 37, stackRule: "stack" });
    for (let month = 0; month < 12; month += 1) {
      updateSecurityDefense(peace.nation);
      updateSecurityDefense(war.nation);
    }
    expect(war.nation.securityDefense.annualDefenseBudget)
      .toBeGreaterThan(peace.nation.securityDefense.annualDefenseBudget);
    expect(war.nation.securityDefense.activePersonnel)
      .toBeGreaterThan(peace.nation.securityDefense.activePersonnel);
    expect(war.nation.securityDefense.cumulativeWarCost).toBeGreaterThan(0);
    expect(war.nation.securityDefense.cumulativeConflictCasualties).toBeGreaterThan(0);
  });

  it("旧存档缺失国防账户时确定性重建", () => {
    const legacy = createInitialGameState(9203);
    delete (legacy.nation as Partial<NationState>).securityDefense;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureSecurityDefenseState(first.nation);
    ensureSecurityDefenseState(second.nation);
    expect(first.nation.securityDefense).toEqual(second.nation.securityDefense);
  });
});
