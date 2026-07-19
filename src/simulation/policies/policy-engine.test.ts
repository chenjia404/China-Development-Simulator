import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "../core/engine";
import { calculateSectorOutput } from "../economy/production";
import { calculateFiscalRevenue } from "../fiscal/revenue";
import { calculateFiscalSpending } from "../fiscal/spending";
import { createInitialGameState } from "../state/initial-state";
import { updateTechnology } from "../technology/research";
import {
  applyPolicyModifiers,
  getNationalPolicy,
  maximumActivePolicies,
  nationalPolicyRequirementBlockers,
  nationalPolicyImplementationRate,
  updatePolicyEnvironment,
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

  it("义务教育可从建国初期筹备，但必须具备预算和执行门槛", () => {
    const definition = getNationalPolicy("compulsory_education");
    expect(definition).toMatchObject({
      name: "普及九年义务教育",
      transitionMonths: 84,
      requirements: {
        availableFromYear: 1949,
        minimumEducationBudgetShare: 0.12,
        minimumStateCapacity: 0.3,
        minimumLocalImplementationCapacity: 0.25,
        minimumStabilityIndex: 40,
      },
    });
    expect(definition?.modifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: "education.secondaryCoverageFormation",
        operation: "multiply",
        value: 1.35,
      }),
      expect.objectContaining({
        target: "education.humanCapitalFormation",
        value: 1.12,
      }),
      expect.objectContaining({ target: "fiscal.spending", value: 1.06 }),
    ]));

    const engine = createSimulationEngine(createInitialGameState(1949));
    expect(() => engine.dispatch({
      type: "SET_POLICIES",
      policyIds: ["compulsory_education"],
    })).toThrow("教育预算占比需达到 12%");
    engine.dispatch({ type: "UPDATE_BUDGET", budget: { education: 0.12 } });
    expect(() => engine.dispatch({
      type: "SET_POLICIES",
      policyIds: ["compulsory_education"],
    })).not.toThrow();
  });

  it("义务教育以更高财政成本逐步提高基础教育、人力资本和科技", () => {
    const baselineCost = createInitialGameState(1949).nation;
    const compulsoryCost = structuredClone(baselineCost);
    baselineCost.fiscal.budget.education = 0.12;
    compulsoryCost.fiscal.budget.education = 0.12;
    compulsoryCost.policyProgress.compulsory_education = 1;
    calculateFiscalSpending(baselineCost);
    calculateFiscalSpending(compulsoryCost);
    expect(compulsoryCost.fiscal.expenditure).toBeGreaterThan(
      baselineCost.fiscal.expenditure,
    );
    expect(compulsoryCost.fiscal.balance).toBeLessThan(baselineCost.fiscal.balance);

    const underfunded = structuredClone(compulsoryCost);
    underfunded.fiscal.budget.education = 0.06;
    expect(nationalPolicyImplementationRate(compulsoryCost, "compulsory_education"))
      .toBe(1);
    expect(nationalPolicyImplementationRate(underfunded, "compulsory_education"))
      .toBeCloseTo(0.5, 8);
    expect(
      applyPolicyModifiers(underfunded, "education.secondaryCoverageFormation", 1),
    ).toBeLessThan(
      applyPolicyModifiers(compulsoryCost, "education.secondaryCoverageFormation", 1),
    );
    expect(applyPolicyModifiers(underfunded, "fiscal.spending", 1)).toBeCloseTo(
      applyPolicyModifiers(compulsoryCost, "fiscal.spending", 1),
      8,
    );

    const baselineEngine = createSimulationEngine(createInitialGameState(1949));
    const compulsoryEngine = createSimulationEngine(createInitialGameState(1949));
    for (const engine of [baselineEngine, compulsoryEngine]) {
      engine.dispatch({ type: "UPDATE_BUDGET", budget: { education: 0.12 } });
    }
    compulsoryEngine.dispatch({
      type: "SET_POLICIES",
      policyIds: ["compulsory_education"],
    });
    baselineEngine.dispatch({ type: "ADVANCE_MONTHS", months: 180 });
    compulsoryEngine.dispatch({ type: "ADVANCE_MONTHS", months: 180 });
    const baseline = baselineEngine.getState().nation;
    const compulsory = compulsoryEngine.getState().nation;

    expect(compulsory.fiscal.expenditure).toBeGreaterThan(baseline.fiscal.expenditure);
    expect(compulsory.education.primaryCoverage).toBeGreaterThan(
      baseline.education.primaryCoverage,
    );
    expect(compulsory.education.secondaryCoverage).toBeGreaterThan(
      baseline.education.secondaryCoverage,
    );
    expect(compulsory.economy.humanCapitalIndex).toBeGreaterThan(
      baseline.economy.humanCapitalIndex,
    );
    expect(compulsory.technology.index).toBeGreaterThan(baseline.technology.index);
  });

  it("证券交易所可提前建立，但必须具备制度、法治和市场基础", () => {
    const definition = getNationalPolicy("securities_exchange");
    expect(definition).toMatchObject({
      name: "设立证券交易所",
      transitionMonths: 60,
      requirements: {
        availableFromYear: 1949,
        minimumStateCapacity: 0.35,
        minimumInstitutionalEfficiency: 0.4,
        minimumLegalPredictability: 0.35,
        minimumPrivateOperatingSpace: 0.45,
      },
    });
    expect(definition?.modifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: "finance.exchangeInfrastructureTarget",
        operation: "add",
        value: 1,
      }),
      expect.objectContaining({ target: "fiscal.spending", value: 1.01 }),
      expect.objectContaining({ target: "wellbeing.welfare", value: 0.98 }),
    ]));

    const nation = createInitialGameState(1949).nation;
    nation.institutions.legalPredictability = 0.2;
    expect(nationalPolicyRequirementBlockers(nation, "securities_exchange"))
      .toEqual(expect.arrayContaining([
        expect.stringContaining("制度效率"),
        expect.stringContaining("法律可预期性"),
      ]));
    nation.economy.institutionalEfficiency = 0.4;
    nation.institutions.legalPredictability = 0.35;
    nation.institutions.stateCapacity = 0.35;
    expect(() => validatePolicySelection(
      ["securities_exchange"],
      nation,
    )).not.toThrow();
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

  it("台湾、香港和新加坡国策可以跨路线组合且均包含现实代价", () => {
    expect(() =>
      validatePolicySelection([
        "sme_export_networks",
        "free_port_trade",
        "international_finance_logistics",
        "investment_promotion_agency",
        "public_housing_skills",
      ]),
    ).not.toThrow();

    expect(getNationalPolicy("sme_export_networks")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "capital.privateInvestment", value: 1.14 }),
        expect.objectContaining({ target: "resources.energyDemand", value: 1.025 }),
      ]),
    );
    expect(getNationalPolicy("electronics_science_parks")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "technology.researchOutput", value: 1.18 }),
        expect.objectContaining({ target: "fiscal.spending", value: 1.03 }),
      ]),
    );
    expect(getNationalPolicy("free_port_trade")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "trade.opennessTarget", value: 0.18 }),
        expect.objectContaining({ target: "fiscal.revenue", value: 0.96 }),
      ]),
    );
    expect(getNationalPolicy("international_finance_logistics")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "sector.tertiary.output", value: 1.16 }),
        expect.objectContaining({ target: "capital.secondaryAllocation", value: -0.06 }),
      ]),
    );
    expect(getNationalPolicy("investment_promotion_agency")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "trade.foreignInvestment", value: 1.3 }),
        expect.objectContaining({ target: "fiscal.spending", value: 1.025 }),
      ]),
    );
    expect(getNationalPolicy("public_housing_skills")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "education.humanCapitalFormation", value: 1.22 }),
        expect.objectContaining({ target: "fiscal.spending", value: 1.05 }),
      ]),
    );
  });

  it("自由港提高开放与外资但压低财政收入，金融物流提高服务业产出", () => {
    const baseline = createInitialGameState(1949).nation;
    const route = structuredClone(baseline);
    route.policyProgress.free_port_trade = 1;
    route.policyProgress.international_finance_logistics = 1;

    updatePolicyEnvironment(baseline);
    updatePolicyEnvironment(route);
    expect(route.trade.openness).toBeGreaterThan(baseline.trade.openness);
    expect(route.trade.foreignInvestment).toBeGreaterThan(
      baseline.trade.foreignInvestment,
    );
    expect(
      calculateSectorOutput("tertiary", route.sectors.tertiary, route),
    ).toBeGreaterThan(
      calculateSectorOutput("tertiary", baseline.sectors.tertiary, baseline),
    );

    calculateFiscalRevenue(baseline);
    calculateFiscalRevenue(route);
    expect(route.fiscal.revenue).toBeLessThan(baseline.fiscal.revenue);
  });

  it("美国和日本国策可混合选择，并同时保留创新、消费、资源和分配代价", () => {
    expect(() =>
      validatePolicySelection([
        "research_university_network",
        "venture_capital_markets",
        "main_bank_industrial_coordination",
        "quality_manufacturing_system",
        "expand_opening",
      ]),
    ).not.toThrow();
    expect(getNationalPolicy("research_university_network")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "technology.researchOutput", value: 1.28 }),
        expect.objectContaining({ target: "fiscal.spending", value: 1.05 }),
      ]),
    );
    expect(getNationalPolicy("venture_capital_markets")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "technology.researchCommercialization", value: 1.28 }),
        expect.objectContaining({ target: "capital.investmentEfficiency", value: 0.96 }),
        expect.objectContaining({ target: "wellbeing.welfare", value: 0.94 }),
      ]),
    );
    expect(getNationalPolicy("main_bank_industrial_coordination")?.modifiers)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ target: "capital.privateInvestment", value: 1.2 }),
        expect.objectContaining({ target: "economy.consumptionPropensity", value: -0.045 }),
        expect.objectContaining({ target: "technology.researchCommercialization", value: 0.95 }),
      ]));
    expect(getNationalPolicy("quality_manufacturing_system")?.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "sector.secondary.output", value: 1.08 }),
        expect.objectContaining({ target: "resources.energyDemand", value: 1.055 }),
      ]),
    );
  });

  it("研究大学与风险资本提高科研商业化，精益制造提高工业产出", () => {
    const baseline = createInitialGameState(1949).nation;
    const innovation = structuredClone(baseline);
    innovation.policyProgress.research_university_network = 1;
    innovation.policyProgress.venture_capital_markets = 1;
    updateTechnology(baseline);
    updateTechnology(innovation);
    expect(innovation.technology.monthlyResearchOutput).toBeGreaterThan(
      baseline.technology.monthlyResearchOutput,
    );
    expect(innovation.technology.index).toBeGreaterThan(
      baseline.technology.index,
    );
    expect(
      applyPolicyModifiers(innovation, "capital.investmentEfficiency", 1),
    ).toBeLessThan(1);

    const manufacturing = structuredClone(baseline);
    manufacturing.policyProgress.quality_manufacturing_system = 1;
    expect(
      calculateSectorOutput(
        "secondary",
        manufacturing.sectors.secondary,
        manufacturing,
      ),
    ).toBeGreaterThan(
      calculateSectorOutput("secondary", baseline.sectors.secondary, baseline),
    );
    expect(
      applyPolicyModifiers(manufacturing, "resources.energyDemand", 1),
    ).toBeGreaterThan(1);
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
