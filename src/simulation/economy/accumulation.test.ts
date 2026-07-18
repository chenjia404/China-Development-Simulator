import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../state/initial-state";
import { updateTechnology } from "../technology/research";
import { updateCapitalAndInvestment } from "./capital";

describe("韩国式追赶积累机制", () => {
  it("发展型金融与出口顺差再投资提高资本形成但不直接改写 GDP", () => {
    const baseline = createInitialGameState(1949).nation;
    const catchUp = structuredClone(baseline);
    for (const nation of [baseline, catchUp]) {
      nation.economy.nationalSavings = nation.economy.realGDP * 0.5;
      nation.trade.balance = nation.economy.nominalGDP * 0.2;
    }
    catchUp.policyProgress.developmental_finance = 1;
    catchUp.policyProgress.export_industrial_zones = 1;

    updateCapitalAndInvestment(baseline);
    updateCapitalAndInvestment(catchUp);

    expect(catchUp.economy.capitalStock).toBeGreaterThan(
      baseline.economy.capitalStock,
    );
    expect(catchUp.economy.investment).toBeGreaterThan(
      baseline.economy.investment,
    );
    expect(catchUp.economy.realGDP).toBe(baseline.economy.realGDP);
  });

  it("出口学习必须同时具备真实出口、制造业能力和人力资本", () => {
    const noExports = createInitialGameState(1949).nation;
    const exporting = structuredClone(noExports);
    for (const nation of [noExports, exporting]) {
      nation.technology.index = 100;
      nation.policyProgress.export_industrial_zones = 1;
      nation.sectors.secondary.valueAdded = nation.economy.realGDP * 0.4;
    }
    noExports.trade.exports = 0;
    exporting.trade.exports = exporting.economy.nominalGDP * 0.4;

    updateTechnology(noExports);
    updateTechnology(exporting);

    expect(exporting.economy.totalFactorProductivity).toBeGreaterThan(
      noExports.economy.totalFactorProductivity,
    );
    expect(exporting.sectors.secondary.productivity).toBeGreaterThan(
      noExports.sectors.secondary.productivity,
    );
  });
});
