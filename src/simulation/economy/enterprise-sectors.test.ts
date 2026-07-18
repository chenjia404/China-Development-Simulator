import { describe, expect, it } from "vitest";
import type { NationState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ENTERPRISE_OWNERSHIP_IDS,
  ensureEnterpriseSectorState,
  updateEnterpriseSectors,
  validateEnterpriseSectorDefinitions,
} from "./enterprise-sectors";

describe("企业与所有制部门", () => {
  it("五类企业账户完整分配增加值、就业、投资和出口", () => {
    expect(validateEnterpriseSectorDefinitions()).toEqual([]);
    const state = createInitialGameState(8301);
    for (let month = 0; month < 24; month += 1) updateEnterpriseSectors(state.nation);
    const enterprises = state.nation.enterprises;
    const sum = (key: "valueAdded" | "employment" | "investment" | "exports") =>
      ENTERPRISE_OWNERSHIP_IDS.reduce(
        (total, id) => total + enterprises.ownership[id][key],
        0,
      );
    expect(Object.keys(enterprises.ownership)).toHaveLength(5);
    expect(ENTERPRISE_OWNERSHIP_IDS.reduce(
      (total, id) => total + enterprises.ownership[id].valueAddedShare,
      0,
    )).toBeCloseTo(1, 12);
    expect(sum("valueAdded")).toBeCloseTo(
      state.nation.nationalAccounts.productionGDP * 0.88,
      2,
    );
    expect(sum("employment")).toBeCloseTo(state.nation.labor.employed, 2);
    expect(sum("investment")).toBeCloseTo(state.nation.economy.investment, 2);
    expect(sum("exports")).toBeCloseTo(state.nation.trade.exports, 2);
  });

  it("民营能力和开放条件提高民营、混合与外商投资企业份额", () => {
    const constrained = createInitialGameState(8302);
    const open = structuredClone(constrained);
    constrained.nation.privateEconomy = {
      operatingSpace: 0,
      entrepreneurialCapacity: 0,
      technologyCommercialization: 0,
      exportNetworkStrength: 0,
    };
    open.nation.privateEconomy = {
      operatingSpace: 1,
      entrepreneurialCapacity: 1,
      technologyCommercialization: 1,
      exportNetworkStrength: 1,
    };
    open.nation.trade.openness = 1;
    open.nation.trade.foreignInvestment = open.nation.economy.nominalGDP * 0.08;
    for (let month = 0; month < 120; month += 1) {
      updateEnterpriseSectors(constrained.nation);
      updateEnterpriseSectors(open.nation);
    }
    expect(open.nation.enterprises.privateAndMixedShare).toBeGreaterThan(
      constrained.nation.enterprises.privateAndMixedShare,
    );
    expect(open.nation.enterprises.foreignInvestedShare).toBeGreaterThan(
      constrained.nation.enterprises.foreignInvestedShare,
    );
  });

  it("旧存档缺失企业账户时确定性重建", () => {
    const legacy = createInitialGameState(8303);
    delete (legacy.nation as Partial<NationState>).enterprises;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureEnterpriseSectorState(first.nation);
    ensureEnterpriseSectorState(second.nation);
    expect(first.nation.enterprises).toEqual(second.nation.enterprises);
    expect(first.nation.enterprises.valueAddedReconciliationError).toBeLessThan(1);
  });
});
