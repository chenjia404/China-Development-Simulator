import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../simulation/state/initial-state";
import { buildPolicyPresentationGroups } from "./policy-presentation";

const educationOpening = {
  economicMechanism: "planned" as const,
  diplomaticStrategyId: "balanced" as const,
  foreignPolicyDoctrineId: "status_quo" as const,
  developmentBlueprintId: "education_science",
};

describe("国策中心信息分层", () => {
  it("把在施、推荐、接近解锁与完整目录分开", () => {
    const game = createInitialGameState(1, 1949, "interactive", educationOpening);
    const groups = buildPolicyPresentationGroups(game);
    expect(groups.active.map((policy) => policy.id)).toEqual(game.nation.policies);
    expect(groups.recommended.length).toBeGreaterThan(0);
    expect(groups.recommended.length).toBeLessThanOrEqual(4);
    expect(groups.nearUnlock.length).toBeLessThanOrEqual(6);
    expect(groups.catalog.length).toBeGreaterThan(40);
  });

  it("推荐项不重复正在实施的国策并说明原因", () => {
    const game = createInitialGameState(1, 1949, "interactive", educationOpening);
    const groups = buildPolicyPresentationGroups(game);
    for (const item of groups.recommended) {
      expect(game.nation.policies).not.toContain(item.policy.id);
      expect(item.reasons.length).toBeGreaterThan(0);
    }
  });

  it("缺少开局蓝图时仍可根据风险和可用性提供推荐", () => {
    const game = createInitialGameState(1949);
    game.nation.strategicPlanning.priorityIds = [];
    const groups = buildPolicyPresentationGroups(game);
    expect(groups.recommended).toHaveLength(4);
    expect(groups.recommended.every((item) => item.reasons.length > 0)).toBe(true);
  });
});
