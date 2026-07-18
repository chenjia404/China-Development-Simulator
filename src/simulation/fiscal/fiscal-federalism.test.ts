import { describe, expect, it } from "vitest";
import type { FiscalState } from "../state/game-state";
import { createInitialGameState } from "../state/initial-state";
import {
  ensureFiscalFederalismState,
  updateFiscalFederalism,
  validateFiscalFederalismConfig,
} from "./fiscal-federalism";

describe("中央地方财政与社会保障账户", () => {
  it("中央地方合并收入、支出和债务与原财政总量守恒", () => {
    expect(validateFiscalFederalismConfig()).toEqual([]);
    const state = createInitialGameState(8401);
    updateFiscalFederalism(state.nation);
    const account = state.nation.fiscal.federalism;
    expect(account.central.revenue + account.local.revenue).toBeCloseTo(
      state.nation.fiscal.revenue,
      4,
    );
    expect(account.central.expenditure + account.local.expenditure).toBeCloseTo(
      state.nation.fiscal.expenditure,
      4,
    );
    expect(account.central.debt + account.local.debt).toBeCloseTo(
      state.nation.fiscal.governmentDebt,
      4,
    );
  });

  it("分税制后中央收入份额提高且五项社会保障逐项列账", () => {
    const before = createInitialGameState(8402, 1980);
    const after = createInitialGameState(8402, 2000);
    updateFiscalFederalism(before.nation);
    updateFiscalFederalism(after.nation);
    expect(after.nation.fiscal.federalism.centralRevenueShare).toBeGreaterThan(
      before.nation.fiscal.federalism.centralRevenueShare,
    );
    const protection = after.nation.fiscal.federalism.socialProtection;
    expect(protection.pension.beneficiaries).toBeGreaterThan(0);
    expect(protection.medical.beneficiaries).toBeGreaterThan(0);
    expect(protection.unemployment.benefitExpenditure).toBeGreaterThan(0);
    expect(protection.minimumLiving.averageBenefit).toBeGreaterThan(0);
    expect(protection.family.beneficiaries).toBeGreaterThan(0);
  });

  it("旧存档缺失分级财政账户时确定性重建", () => {
    const legacy = createInitialGameState(8403);
    delete (legacy.nation.fiscal as Partial<FiscalState>).federalism;
    const first = structuredClone(legacy);
    const second = structuredClone(legacy);
    ensureFiscalFederalismState(first.nation);
    ensureFiscalFederalismState(second.nation);
    expect(first.nation.fiscal.federalism).toEqual(second.nation.fiscal.federalism);
  });
});
