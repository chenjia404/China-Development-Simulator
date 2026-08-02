import { describe, expect, it } from "vitest";
import { nominalToUsd, usdToNominal } from "./currency-conversion";
import { createInitialGameState } from "../state/initial-state";

describe("货币口径换算", () => {
  it("名义人民币与美元等值可逆换算", () => {
    const state = createInitialGameState(9201);
    const nominal = state.nation.economy.nominalGDP * 0.02;
    const usd = nominalToUsd(state.nation, nominal);
    expect(usdToNominal(state.nation, usd)).toBeCloseTo(nominal, 4);
  });
});
