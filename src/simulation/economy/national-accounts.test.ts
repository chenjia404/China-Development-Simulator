import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { calculateSectorOutput } from "./production";
import { createInitialGameState } from "../state/initial-state";
import {
  ensureNationalAccountsState,
  inputOutputConstraintForSector,
  NATIONAL_ACCOUNTS_PRODUCT_IDS,
  updateNationalAccounts,
  validateInputOutputDefinitions,
} from "./national-accounts";

describe("国民经济账户与投入产出表", () => {
  it("14类产品配置完整，生产法、收入法、支出法和供给使用表保持守恒", () => {
    expect(validateInputOutputDefinitions()).toEqual([]);
    const engine = createSimulationEngine(createInitialGameState(1949, 1949));
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 24 });
    const accounts = engine.getState().nation.nationalAccounts;

    expect(Object.keys(accounts.products)).toHaveLength(14);
    expect(accounts.productionGDP).toBeGreaterThan(0);
    expect(accounts.incomeGDP).toBeCloseTo(accounts.productionGDP, 4);
    expect(accounts.expenditureGDP).toBeCloseTo(accounts.productionGDP, 4);
    expect(accounts.gdpIdentityError / accounts.productionGDP).toBeLessThan(1e-12);
    expect(accounts.maximumProductBalanceError / accounts.productionGDP).toBeLessThan(1e-12);
    expect(
      NATIONAL_ACCOUNTS_PRODUCT_IDS.every(
        (id) => Number.isFinite(accounts.products[id].inputAvailability),
      ),
    ).toBe(true);
  });

  it("广泛中间品短缺会压低下一月产业产出，而不是直接扣减GDP", () => {
    const state = createInitialGameState(1949, 1949);
    state.nation.trade.imports = 0;
    state.nation.trade.exports = 0;
    state.nation.sectors.primary.output = 1;
    state.nation.sectors.tertiary.output = 1;
    for (const category of Object.values(state.nation.industries)) {
      category.output = 1;
    }
    state.nation.industries.consumer_goods.output = 10_000_000_000;
    updateNationalAccounts(state.nation);

    const constrainedMultiplier = inputOutputConstraintForSector(
      state.nation,
      "secondary",
    );
    const constrainedOutput = calculateSectorOutput(
      "secondary",
      state.nation.sectors.secondary,
      state.nation,
    );
    for (const product of Object.values(state.nation.nationalAccounts.products)) {
      product.inputAvailability = 1;
    }
    const unconstrainedOutput = calculateSectorOutput(
      "secondary",
      state.nation.sectors.secondary,
      state.nation,
    );

    expect(constrainedMultiplier).toBeLessThan(1);
    expect(constrainedOutput).toBeLessThan(unconstrainedOutput);
    expect(state.nation.economy.realGDP).toBe(123_000_000_000);
  });

  it("旧存档缺少国民账户时按当前部门和贸易状态确定性重建", () => {
    const nation = createInitialGameState(1949).nation;
    delete (nation as Partial<typeof nation>).nationalAccounts;
    ensureNationalAccountsState(nation);

    expect(Object.keys(nation.nationalAccounts.products)).toHaveLength(14);
    expect(nation.nationalAccounts.productionGDP).toBe(nation.economy.realGDP);
    expect(nation.nationalAccounts.gdpIdentityError / nation.economy.realGDP)
      .toBeLessThan(1e-12);
  });
});
