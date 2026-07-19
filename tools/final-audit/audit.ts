import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  calculateGDP,
  calculateIndustryOutputs,
  calculateTradeAccess,
  calculateTechnologyTreeMetrics,
  calculateIndustrialStructureMetrics,
  compareSimulationWithHistory,
  compareSimulationWithTarget,
  comparisonTargetOptions,
  createSimulationEngine,
  createInitialGameState,
  developmentRouteBlueprints,
  historicalEventDefinitions,
  historicalInitiativeDefinitions,
  enactHistoricalEventEarly,
  getHistoricalEventChoices,
  remittanceDirectedInvestment,
  deserializeGameState,
  diplomaticStrategyEffects,
  foreignPolicyDoctrineDefinitions,
  foreignPolicyDoctrineEffects,
  foreignPolicyDoctrineRelationAdjustment,
  foreignAidProgramDefinitions,
  historicalForeignAidTotalsThrough1980,
  getSinoUSNormalizationStatus,
  sinoUSNormalizationEffects,
  serializeGameState,
  updateForeignExchange,
  updateInternationalTrade,
  updateDemandDrivenCapacityUtilization,
  applyPolicyModifiers,
  technologyTreeDefinitions,
  technologyIndustryPathDefinitions,
  technologyIndustryEffect,
  technologyIndustryEnergyDemandMultiplier,
  setTechnologyIndustryPath,
  industrialCategoryDefinitions,
  updateIndustrialStructure,
  validateIndustrialCategoryDefinitions,
  validateIndustrialPolicyConfiguration,
  validateMarketDynamicsDefinitions,
  validateDemographicCohortDefinitions,
  AGE_BAND_IDS,
  ENTERPRISE_OWNERSHIP_IDS,
  validateEnterpriseSectorDefinitions,
  validateFiscalFederalismConfig,
  validateTechnologyTreeDefinitions,
  validateDevelopmentRouteBlueprints,
  evaluateModelIntegrity,
  searchCalibrationCandidates,
  summarizeUncertainty,
  type GameState,
  type UncertaintySample,
  type UncertaintySummary,
} from "../../src/simulation/index";
import { compareWithTargets, summarizeCalibration } from "../baseline-calibration/calibration";
import { runSimulation, type SimulationRunResult } from "../baseline-calibration/runner";
import {
  getAnnualDecision,
  strategyIds,
  type StrategyId,
} from "../baseline-calibration/strategies";
import koreanCatchUpTargets from "../../src/data/config/korean-catch-up-targets.json";
import culturalRevolutionTargets from "../../src/data/config/cultural-revolution-impact-targets.json";

export interface AuditCheck {
  id: string;
  name: string;
  passed: boolean;
  evidence: string;
}

export interface StrategyAuditSummary {
  strategy: StrategyId;
  durationMs: number;
  years: number;
  finalGDP: number;
  finalGDPPerCapita: number;
  inflationRate: number;
  debtToGDP: number;
  debtInterestRate: number;
  externalDebt: number;
  externalDebtToGDP: number;
  capitalGoodsImportCoverage: number;
  educationIndex: number;
  technologyIndex: number;
  completedTechnologyCount: number;
  industryTechnologyTier: number;
  industrialUpgradeReadiness: number;
  lifeExpectancy: number;
  happinessIndex: number;
  secondarySectorShare: number;
  finalScore: number;
  eventYears: number;
}

export interface FinalAuditReport {
  status: "通过" | "失败";
  generatedAt: string;
  seed: number;
  period: string;
  checks: AuditCheck[];
  strategies: StrategyAuditSummary[];
  uncertainty: UncertaintySummary;
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

function summary(result: SimulationRunResult): StrategyAuditSummary {
  const nation = result.finalState.nation;
  const final = result.annual.at(-1);
  if (!final) throw new Error("策略没有生成年度快照");
  return {
    strategy: result.options.strategy,
    durationMs: Number(result.durationMs.toFixed(2)),
    years: result.annual.length,
    finalGDP: nation.economy.realGDP,
    finalGDPPerCapita: nation.economy.realGDPPerCapita,
    inflationRate: nation.economy.inflationRate,
    debtToGDP: nation.fiscal.debtToGDP,
    debtInterestRate: nation.fiscal.debtInterestRate,
    externalDebt: nation.trade.externalDebt,
    externalDebtToGDP: nation.trade.externalDebtToGDP,
    capitalGoodsImportCoverage: nation.trade.capitalGoodsImportCoverage,
    educationIndex: nation.education.index,
    technologyIndex: nation.technology.index,
    completedTechnologyCount: nation.technology.completedTechnologyIds.length,
    industryTechnologyTier: calculateTechnologyTreeMetrics(nation).industryTier,
    industrialUpgradeReadiness: calculateTechnologyTreeMetrics(nation)
      .industrialUpgradeReadiness,
    lifeExpectancy: nation.health.lifeExpectancy,
    happinessIndex: nation.society.happinessIndex,
    secondarySectorShare: final.secondarySectorShare,
    finalScore: final.score,
    eventYears: nation.history.reports.filter((report) => report.majorEvents.length > 0).length,
  };
}

function makeCheck(id: string, name: string, passed: boolean, evidence: string): AuditCheck {
  return { id, name, passed, evidence };
}

export async function runFinalAudit(): Promise<FinalAuditReport> {
  const seed = 1949;
  const runs = new Map<StrategyId, SimulationRunResult>();
  for (const strategy of strategyIds) {
    runs.set(strategy, runSimulation({ strategy, seed, startYear: 1949, endYear: 2026 }));
  }
  const historical = runs.get("historical")!;
  const education = runs.get("education_technology")!;
  const koreanCatchUp = runs.get("korean_catch_up")!;
  const taiwanRoute = runs.get("taiwan_sme_export")!;
  const hongKongRoute = runs.get("hong_kong_free_port")!;
  const singaporeRoute = runs.get("singapore_fdi_city")!;
  const usRoute = runs.get("us_innovation_market")!;
  const japanRoute = runs.get("japan_quality_industry")!;
  const summaries = strategyIds.map((strategy) => summary(runs.get(strategy)!));
  const byStrategy = new Map(summaries.map((item) => [item.strategy, item]));
  const historicalSummary = byStrategy.get("historical")!;
  const industrialSummary = byStrategy.get("industrial")!;
  const livelihoodSummary = byStrategy.get("livelihood")!;
  const debtSummary = byStrategy.get("debt")!;
  const noneSummary = byStrategy.get("none")!;
  const koreanCatchUp2000 = koreanCatchUp.annual.find(
    (snapshot) => snapshot.year === 2000,
  )!;
  const koreanTarget2000 = koreanCatchUpTargets.years.find(
    (target) => target.year === 2000,
  )!;
  const koreaModel2000 = koreanCatchUp.finalState.world.countries.find(
    (country) => country.id === "south_korea",
  );
  const koreaModelRealGDPPerCapita = koreaModel2000 &&
      koreaModel2000.population > 0
    ? koreaModel2000.realGDP / koreaModel2000.population
    : 0;
  // 中国史实美元折算只服务 NBS/世行中国口径；追赶路线改按世界模型韩国不变价人均锚定世行韩国美元人均。
  const koreanCatchUpComparableUSD = koreaModelRealGDPPerCapita > 0
    ? koreanCatchUp2000.realGDPPerCapita / koreaModelRealGDPPerCapita *
      koreanTarget2000.currentUSDGDPPerCapita
    : koreanCatchUp2000.currentUSDGDPPerCapita;
  const taiwanRoute2000 = taiwanRoute.annual.find(
    (snapshot) => snapshot.year === 2000,
  )!;
  const hongKongRoute2000 = hongKongRoute.annual.find(
    (snapshot) => snapshot.year === 2000,
  )!;
  const singaporeRoute2000 = singaporeRoute.annual.find(
    (snapshot) => snapshot.year === 2000,
  )!;
  const japanRoute2000 = japanRoute.annual.find(
    (snapshot) => snapshot.year === 2000,
  )!;
  let developmentBlueprintValidationError: string | null = null;
  try {
    validateDevelopmentRouteBlueprints();
  } catch (error) {
    developmentBlueprintValidationError = error instanceof Error
      ? error.message
      : String(error);
  }
  let technologyTreeValidationError: string | null = null;
  try {
    validateTechnologyTreeDefinitions();
  } catch (error) {
    technologyTreeValidationError = error instanceof Error
      ? error.message
      : String(error);
  }
  let industrialCategoryValidationError: string | null = null;
  try {
    validateIndustrialCategoryDefinitions();
  } catch (error) {
    industrialCategoryValidationError = error instanceof Error
      ? error.message
      : String(error);
  }

  const duplicate = runSimulation({ strategy: "historical", seed, startYear: 1949, endYear: 2026 });
  const uncertaintyRuns = [
    historical,
    runSimulation({ strategy: "historical", seed: 1950, startYear: 1949, endYear: 2026 }),
    runSimulation({ strategy: "historical", seed: 1951, startYear: 1949, endYear: 2026 }),
    runSimulation({ strategy: "historical", seed: 1952, startYear: 1949, endYear: 2026 }),
  ];
  const uncertaintySamples: UncertaintySample[] = uncertaintyRuns.map((run) => {
    const final = run.annual.at(-1)!;
    return {
      seed: run.options.seed,
      metrics: {
        realGDP: final.realGDP,
        realGDPPerCapita: final.realGDPPerCapita,
        population: final.population,
        inflationRate: final.inflationRate,
        debtToGDP: final.debtToGDP,
        technologyIndex: final.technologyIndex,
        score: final.score,
      },
    };
  });
  const uncertainty = summarizeUncertainty(uncertaintySamples);
  const reversedUncertainty = summarizeUncertainty([...uncertaintySamples].reverse());
  const calibrationSearchAudit = searchCalibrationCandidates(
    [
      { id: "outputScale", initial: 1, minimum: 0.9, maximum: 1.1, step: 0.01 },
      { id: "populationScale", initial: 1, minimum: 0.9, maximum: 1.1, step: 0.01 },
    ],
    (parameters) =>
      (parameters.outputScale - 1.04) ** 2 +
      (parameters.populationScale - 0.97) ** 2,
  );
  const integrityReports = [...runs.values()].map((run) =>
    evaluateModelIntegrity(run.finalState)
  );
  const calibration = summarizeCalibration(compareWithTargets(historical.annual));
  const historicalComparisons = compareSimulationWithHistory(historical.annual);
  const historicalRankComparisons = historicalComparisons.filter(
    (comparison) => comparison.gdpRank !== null,
  );
  const targetComparisons = comparisonTargetOptions.map((target) =>
    compareSimulationWithTarget(historical.annual, target.id)
  );
  const historicalCurrentPriceComparison = targetComparisons.find(
    (comparison) => comparison.targetId === "history",
  );
  const internationalTargetComparisons = targetComparisons.filter(
    (comparison) => comparison.targetId !== "history",
  );
  const restored = deserializeGameState(
    serializeGameState(historical.finalState, "2027-01-01T00:00:00.000Z"),
  );
  const continued = createSimulationEngine(restored);
  const direct = createSimulationEngine(historical.finalState);
  continued.dispatch({ type: "ADVANCE_MONTHS", months: 24 });
  direct.dispatch({ type: "ADVANCE_MONTHS", months: 24 });

  const files = await sourceFiles(join(process.cwd(), "src", "simulation"));
  const contents = await Promise.all(files.map(async (file) => ({
    file,
    content: await readFile(file, "utf8"),
  })));
  const forbiddenRandom = contents.filter(({ content }) => /Math\.random\s*\(/.test(content));
  const uiDependencies = contents.filter(({ content }) =>
    /from\s+["']react["']|\bdocument\.|\bwindow\./.test(content),
  );

  const education1970 = education.annual.find((snapshot) => snapshot.year === 1970)!;
  const education1990 = education.annual.find((snapshot) => snapshot.year === 1990)!;
  const historical1970 = historical.annual.find((snapshot) => snapshot.year === 1970)!;
  const historical1990 = historical.annual.find((snapshot) => snapshot.year === 1990)!;
  const educationAcceleration = education1990.realGDP / education1970.realGDP;
  const historicalAcceleration = historical1990.realGDP / historical1970.realGDP;
  const distinctRanks = new Set(historical.annual.map((snapshot) => snapshot.gdpRank));
  const distinctGDP = new Set(summaries.map((item) => Math.round(item.finalGDP / 1_000_000_000)));
  const historicalRecords = historical.finalState.nation.history.historicalEvents;
  const historicalRecordIds = new Set(historicalRecords.map((event) => event.id));
  const scheduledHistoricalEvents = historicalEventDefinitions.filter(
    (event) => event.triggerMode !== "conditional",
  );
  const recordedScheduledEvents = historicalRecords.filter((record) =>
    scheduledHistoricalEvents.some((event) => event.id === record.id)
  );
  const historicalMilestoneTargets = new Map([
    [1978, { currentPriceGDPPerCapita: 381, currentUSDGDPPerCapita: 156.7, gdpRank: 10, gdpPerCapitaRank: 134, participants: 146 }],
    [1990, { currentPriceGDPPerCapita: 1644, currentUSDGDPPerCapita: 318.5, gdpRank: 11, gdpPerCapitaRank: null, participants: null }],
    [2000, { currentPriceGDPPerCapita: 7858, currentUSDGDPPerCapita: 969.2, gdpRank: 6, gdpPerCapitaRank: 135, participants: null }],
  ]);
  const historicalMilestones = historical.annual.filter((snapshot) =>
    historicalMilestoneTargets.has(snapshot.year),
  );

  const decisionEngine = createSimulationEngine(
    createInitialGameState(seed, 1956, "interactive"),
  );
  decisionEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  const pendingDecisionId =
    decisionEngine.getState().nation.pendingHistoricalEventId;
  const decisionChoices = pendingDecisionId
    ? getHistoricalEventChoices(pendingDecisionId)
    : [];
  const foreignAssetChoices = getHistoricalEventChoices(
    "foreign_assets_reorganization",
  );
  const foreignInvestmentMultipliers = foreignAssetChoices.map(
    (choice) => choice.modifiers.find(
      (modifier) => modifier.target === "trade.foreignInvestment",
    )?.value ?? Number.NaN,
  );
  if (pendingDecisionId) {
    decisionEngine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: pendingDecisionId,
      choiceId: "preserve_mixed_ownership",
    });
  }
  const decisionRecord =
    decisionEngine.getState().nation.history.historicalEvents.at(-1);

  const causalState = createInitialGameState(seed, 1958, "interactive");
  causalState.nation.date.month = 5;
  const causalEngine = createSimulationEngine(causalState);
  causalEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  causalEngine.dispatch({
    type: "RESOLVE_HISTORICAL_EVENT",
    eventId: "great_leap_forward_1958",
    choiceId: "avoid_great_leap",
  });
  causalEngine.dispatch({ type: "ADVANCE_MONTHS", months: 4 });
  causalEngine.dispatch({
    type: "RESOLVE_HISTORICAL_EVENT",
    eventId: "peoples_communes_1958",
    choiceId: "avoid_communes",
  });
  causalEngine.dispatch({ type: "ADVANCE_MONTHS", months: 6 });
  const causalChoices = getHistoricalEventChoices(
    "three_year_difficulties_1959",
    causalEngine.getState().nation,
  );
  const preventedEvents = causalEngine.getState().nation.history.historicalEvents
    .filter((event) => event.outcome === "prevented");

  const runHistoricalCounterfactual = (
    choices: Readonly<Record<string, string>>,
  ) => {
    const engine = createSimulationEngine(
      createInitialGameState(seed, 1949, "interactive"),
    );
    for (let year = 1949; year <= 2000; year += 1) {
      const decision = getAnnualDecision("historical", year);
      if (decision.budget) {
        engine.dispatch({ type: "UPDATE_BUDGET", budget: decision.budget });
      }
      engine.dispatch({ type: "SET_POLICIES", policyIds: decision.policyIds });
      for (let month = 0; month < 12; month += 1) {
        const elapsedMonths = engine.getState().nation.date.elapsedMonths;
        while (engine.getState().nation.date.elapsedMonths === elapsedMonths) {
          const current = engine.getState().nation;
          const settleHistoricalNormalization =
            current.date.year === 1979 &&
            current.date.month === 1 &&
            current.diplomacy.sinoUSNormalizationStatus === "not_started";
          if (settleHistoricalNormalization) {
            engine.dispatch({
              type: "SET_HISTORICAL_EVENT_MODE",
              mode: "automatic",
            });
          }
          engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
          if (settleHistoricalNormalization) {
            engine.dispatch({
              type: "SET_HISTORICAL_EVENT_MODE",
              mode: "interactive",
            });
          }
          const pendingEventId = engine.getState().nation.pendingHistoricalEventId;
          if (pendingEventId) {
            engine.dispatch({
              type: "RESOLVE_HISTORICAL_EVENT",
              eventId: pendingEventId,
              choiceId: choices[pendingEventId] ?? "historical_path",
            });
          }
          if (engine.getState().nation.famineMortality?.pendingReport) {
            engine.dispatch({ type: "DISMISS_FAMINE_MORTALITY_REPORT" });
          }
        }
      }
    }
    return engine.getState().nation.history.annual;
  };
  const campaignChoices = {
    great_leap_forward_1958: "avoid_great_leap",
    peoples_communes_1958: "avoid_communes",
  };
  const culturalRevolutionChoices = {
    cultural_revolution_disruption_1966: "protect_institutions",
  };
  const strictCounterfactual = runHistoricalCounterfactual({});
  const avoidedCampaigns = runHistoricalCounterfactual(campaignChoices);
  const avoidedCulturalRevolution = runHistoricalCounterfactual(
    culturalRevolutionChoices,
  );
  const optimizedHistoricalRoute = runHistoricalCounterfactual({
    foreign_assets_reorganization: "regulated_foreign_business",
    korean_war_1950: "oppose_korean_war",
    industry_wide_joint_ownership_1956: "preserve_mixed_ownership",
    ...campaignChoices,
    three_year_difficulties_1959:
      "ban_grain_exports_and_import+accept_foreign_aid",
    third_front_construction_1964: "cancel_third_front",
    ...culturalRevolutionChoices,
  });
  const counterfactualSnapshot = (
    snapshots: typeof optimizedHistoricalRoute,
    year: number,
  ) => {
    const snapshot = snapshots.find((candidate) => candidate.year === year);
    if (!snapshot) throw new Error(`反事实路线缺少 ${year} 年快照`);
    return snapshot;
  };
  const strictHistorical1978 = counterfactualSnapshot(strictCounterfactual, 1978);
  const avoidedCampaigns1978 = counterfactualSnapshot(avoidedCampaigns, 1978);
  const avoidedCulturalRevolution1978 = counterfactualSnapshot(
    avoidedCulturalRevolution,
    1978,
  );
  const optimized1978 = counterfactualSnapshot(optimizedHistoricalRoute, 1978);
  const strictHistorical1990 = counterfactualSnapshot(strictCounterfactual, 1990);
  const avoidedCulturalRevolution1990 = counterfactualSnapshot(
    avoidedCulturalRevolution,
    1990,
  );
  const optimized1990 = counterfactualSnapshot(optimizedHistoricalRoute, 1990);
  const strictHistorical2000 = counterfactualSnapshot(strictCounterfactual, 2000);
  const optimized2000 = counterfactualSnapshot(optimizedHistoricalRoute, 2000);
  const optimizedTransitionSnapshots = [1977, 1978, 1979, 1980, 1981].map(
    (year) => counterfactualSnapshot(optimizedHistoricalRoute, year),
  );
  const optimizedTransitionGrowth = optimizedTransitionSnapshots.slice(1).map(
    (snapshot, index) => ({
      year: snapshot.year,
      growth:
        snapshot.realGDP / optimizedTransitionSnapshots[index].realGDP - 1,
    }),
  );
  const culturalRevolutionGrowthResults =
    culturalRevolutionTargets.annualRealGDPGrowthAnchors.map((target) => {
      const current = historical.annual.find(
        (snapshot) => snapshot.year === target.year,
      );
      const previous = historical.annual.find(
        (snapshot) => snapshot.year === target.year - 1,
      );
      if (!current || !previous) {
        throw new Error(`文化大革命审计缺少 ${target.year} 年相邻快照`);
      }
      return {
        ...target,
        simulatedGrowth: current.realGDP / previous.realGDP - 1,
      };
    });

  const runCulturalEducationChoice = (choiceId: string) => {
    const state = createInitialGameState(seed, 1966, "interactive");
    state.nation.date.month = 5;
    state.nation.date.elapsedMonths = (1966 - 1949) * 12 + 4;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "cultural_revolution_disruption_1966",
      choiceId,
    });
    engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 180 });
    return engine.getState().nation.education;
  };
  const disruptedCulturalEducation = runCulturalEducationChoice(
    "historical_path",
  );
  const protectedCulturalEducation = runCulturalEducationChoice(
    "protect_institutions",
  );

  const runCrisisChoice = (choiceId: string) => {
    const engine = createSimulationEngine(
      createInitialGameState(seed, 1959, "interactive"),
    );
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "three_year_difficulties_1959",
      choiceId,
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    return engine.getState();
  };
  const historicalCrisis = runCrisisChoice("historical_path");
  const foreignAidCrisis = runCrisisChoice("accept_foreign_aid");
  const limitedGrainCrisis = runCrisisChoice("limit_grain_exports");
  const banGrainCrisis = runCrisisChoice("ban_grain_exports_and_import");
  const banGrainWithAidCrisis = runCrisisChoice(
    "ban_grain_exports_and_import+accept_foreign_aid",
  );
  const domesticReliefCrisis = runCrisisChoice("domestic_emergency_relief");
  const crisisRelation = (
    state: typeof foreignAidCrisis,
    countryId: string,
  ) => state.world.countries.find((country) => country.id === countryId)
    ?.relationWithChina ?? Number.NaN;
  const foreignAidProviders = ["russia", "canada", "australia", "usa"];
  const foreignAidContinuation = createSimulationEngine(
    createInitialGameState(seed, 1959, "interactive"),
  );
  foreignAidContinuation.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  foreignAidContinuation.dispatch({
    type: "RESOLVE_HISTORICAL_EVENT",
    eventId: "three_year_difficulties_1959",
    choiceId: "accept_foreign_aid",
  });
  foreignAidContinuation.dispatch({
    type: "SET_HISTORICAL_EVENT_MODE",
    mode: "automatic",
  });
  foreignAidContinuation.dispatch({ type: "ADVANCE_MONTHS", months: 816 });
  const foreignAidFinalState = foreignAidContinuation.getState();

  const prepareKoreanWarChoice = (choiceId: string) => {
    const state = createInitialGameState(seed, 1950, "interactive");
    state.nation.date.month = 6;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "land_reform_1950",
      choiceId: "historical_path",
    });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "korean_war_1950",
      choiceId,
    });
    return engine;
  };
  const koreanWarEngine = prepareKoreanWarChoice("historical_path");
  koreanWarEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  const koreanWarState = koreanWarEngine.getState();
  const preventedWarEngine = prepareKoreanWarChoice("oppose_korean_war");
  preventedWarEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  const preventedWarState = preventedWarEngine.getState();
  const koreanWarDiplomacyEngine = prepareKoreanWarChoice("historical_path");
  koreanWarDiplomacyEngine.dispatch({
    type: "SET_HISTORICAL_EVENT_MODE",
    mode: "automatic",
  });
  koreanWarDiplomacyEngine.dispatch({ type: "ADVANCE_MONTHS", months: 84 });
  const koreanWarDiplomacyState = koreanWarDiplomacyEngine.getState();
  const preventedWarDiplomacyEngine = prepareKoreanWarChoice(
    "oppose_korean_war",
  );
  preventedWarDiplomacyEngine.dispatch({
    type: "SET_HISTORICAL_EVENT_MODE",
    mode: "automatic",
  });
  preventedWarDiplomacyEngine.dispatch({ type: "ADVANCE_MONTHS", months: 84 });
  const preventedWarDiplomacyState = preventedWarDiplomacyEngine.getState();
  const koreanWarDebtEngine = prepareKoreanWarChoice("historical_path");
  koreanWarDebtEngine.dispatch({
    type: "SET_HISTORICAL_EVENT_MODE",
    mode: "automatic",
  });
  koreanWarDebtEngine.dispatch({ type: "ADVANCE_MONTHS", months: 37 });
  const koreanWarDebtState = koreanWarDebtEngine.getState();
  const preventedWarDevelopmentEngine = prepareKoreanWarChoice(
    "oppose_korean_war",
  );
  preventedWarDevelopmentEngine.dispatch({
    type: "SET_HISTORICAL_EVENT_MODE",
    mode: "automatic",
  });
  preventedWarDevelopmentEngine.dispatch({ type: "ADVANCE_MONTHS", months: 60 });
  const preventedWarDevelopmentState = preventedWarDevelopmentEngine
    .getState();
  const koreanWarDevelopmentEngine = prepareKoreanWarChoice("historical_path");
  koreanWarDevelopmentEngine.dispatch({
    type: "SET_HISTORICAL_EVENT_MODE",
    mode: "automatic",
  });
  koreanWarDevelopmentEngine.dispatch({ type: "ADVANCE_MONTHS", months: 60 });
  const koreanWarDevelopmentState = koreanWarDevelopmentEngine.getState();
  const preventedWarContinuation = prepareKoreanWarChoice(
    "oppose_korean_war",
  );
  preventedWarContinuation.dispatch({
    type: "SET_HISTORICAL_EVENT_MODE",
    mode: "automatic",
  });
  preventedWarContinuation.dispatch({ type: "ADVANCE_MONTHS", months: 919 });
  const preventedWarFinalState = preventedWarContinuation.getState();
  const preventedWarRecord = preventedWarFinalState.nation.history
    .historicalEvents.find((event) => event.id === "korean_war_1950");
  const koreanWarUsRelation = koreanWarState.world.countries.find(
    (country) => country.id === "usa",
  )?.relationWithChina ?? 0;
  const preventedWarUsRelation = preventedWarState.world.countries.find(
    (country) => country.id === "usa",
  )?.relationWithChina ?? 0;
  const koreanWarRussiaRelation = koreanWarState.world.countries.find(
    (country) => country.id === "russia",
  )?.relationWithChina ?? 0;
  const preventedWarRussiaRelation = preventedWarState.world.countries.find(
    (country) => country.id === "russia",
  )?.relationWithChina ?? 0;
  const koreanWarSouthKoreaRelation = koreanWarState.world.countries.find(
    (country) => country.id === "south_korea",
  )?.relationWithChina ?? 0;
  const preventedWarSouthKoreaRelation = preventedWarState.world.countries.find(
    (country) => country.id === "south_korea",
  )?.relationWithChina ?? 0;
  const koreanWarWesternCountryIds = [
    "usa",
    "united_kingdom",
    "france",
    "canada",
    "australia",
    "japan",
  ];
  const relationFor = (state: GameState, countryId: string) =>
    state.world.countries.find((country) => country.id === countryId)
      ?.relationWithChina ?? 0;
  const koreanWarWesternAverage = koreanWarWesternCountryIds.reduce(
    (sum, countryId) => sum + relationFor(koreanWarDiplomacyState, countryId),
    0,
  ) / koreanWarWesternCountryIds.length;
  const preventedWarWesternAverage = koreanWarWesternCountryIds.reduce(
    (sum, countryId) =>
      sum + relationFor(preventedWarDiplomacyState, countryId),
    0,
  ) / koreanWarWesternCountryIds.length;

  const runThirdFrontChoice = (choiceId: string) => {
    const state = createInitialGameState(seed, 1964, "interactive");
    state.nation.date.month = 5;
    const engine = createSimulationEngine(state);
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
    engine.dispatch({
      type: "RESOLVE_HISTORICAL_EVENT",
      eventId: "third_front_construction_1964",
      choiceId,
    });
    engine.dispatch({ type: "SET_HISTORICAL_EVENT_MODE", mode: "automatic" });
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    return engine.getState();
  };
  const historicalThirdFront = runThirdFrontChoice("historical_path");
  const focusedThirdFront = runThirdFrontChoice("focused_third_front");
  const canceledThirdFront = runThirdFrontChoice("cancel_third_front");
  const canceledThirdFrontRecord = canceledThirdFront.nation.history
    .historicalEvents.find((event) => event.id === "third_front_construction_1964");

  const initiativeState = createInitialGameState(seed, 1949);
  const initiativePreparation = createSimulationEngine(initiativeState);
  initiativePreparation.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_unified_finance",
  });
  initiativePreparation.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_land_reform",
  });
  initiativePreparation.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_reform_and_opening",
  });
  initiativePreparation.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_joint_venture_law",
  });
  initiativePreparation.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_special_economic_zones",
  });
  initiativePreparation.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_private_economy_legal_recognition",
  });
  const industrializationState = initiativePreparation.exportState();
  industrializationState.nation.date.month = 7;
  industrializationState.nation.date.elapsedMonths = 6;
  const industrializationEngine = createSimulationEngine(industrializationState);
  industrializationEngine.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_first_five_year_plan",
  });
  const observerState = industrializationEngine.exportState();
  observerState.nation.date.year = 1950;
  observerState.nation.date.month = 1;
  observerState.nation.date.elapsedMonths = (1950 - 1949) * 12;
  observerState.nation.economy.institutionalEfficiency = 0.5;
  observerState.nation.institutions.stateCapacity = 0.5;
  observerState.nation.institutions.localImplementationCapacity = 0.5;
  observerState.nation.institutions.legalPredictability = 0.5;
  observerState.nation.society.stabilityIndex = 60;
  observerState.nation.trade.openness = 0.22;
  observerState.nation.diplomacy.globalReputation = 60;
  observerState.nation.diplomacy.diplomaticPoints = 100;
  observerState.nation.internationalInfluence = 30;
  for (const country of observerState.world.countries) country.relationWithChina = 15;
  observerState.world.countries[0].tradeAgreement = true;
  const observerEngine = createSimulationEngine(observerState);
  observerEngine.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_gatt_observer",
  });
  const applicationState = observerEngine.exportState();
  applicationState.nation.date.year = 1952;
  applicationState.nation.date.month = 1;
  applicationState.nation.date.elapsedMonths = (1952 - 1949) * 12;
  applicationState.world.countries[1].tradeAgreement = true;
  const applicationEngine = createSimulationEngine(applicationState);
  applicationEngine.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_gatt_accession_application",
  });
  const earlyRecords = applicationEngine.getState().nation.history.historicalEvents
    .filter((event) => event.outcome === "enacted_early");
  const auditedEarlyInitiativeEvents = [
    "unified_finance_1950",
    "land_reform_1950",
    "first_five_year_plan",
    "reform_and_opening_1978",
    "joint_venture_law_1979",
    "special_economic_zones_1980",
    "private_economy_legal_recognition_1988",
    "gatt_observer_1982",
    "gatt_accession_application_1986",
  ];
  const initiativeEventIds = historicalInitiativeDefinitions.map(
    (definition) => definition.eventId,
  );
  const excludedInitiativeEvents = [
    "korean_war_1950",
    "great_leap_forward_1958",
    "cultural_revolution_disruption_1966",
    "asian_financial_crisis_1997",
    "covid_19_2020",
    "un_seat_restored_1971",
    "wto_accession_2001",
  ];

  const unSupportState = createInitialGameState(seed, 1965);
  unSupportState.nation.diplomacy.diplomaticPoints = 100;
  for (const country of unSupportState.world.countries) {
    country.relationWithChina = 25;
  }
  const unSupportEngine = createSimulationEngine(unSupportState);
  unSupportEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  const wtoSupportState = createInitialGameState(seed, 1952);
  enactHistoricalEventEarly(
    wtoSupportState.nation,
    "gatt_accession_application_1986",
    "audit:gatt-application",
    "审计复关进程前置条件",
    [],
  );
  wtoSupportState.nation.date.year = 1957;
  wtoSupportState.nation.date.month = 1;
  wtoSupportState.nation.date.elapsedMonths = (1957 - 1949) * 12;
  wtoSupportState.nation.internationalInfluence = 50;
  wtoSupportState.nation.trade.openness = 0.5;
  wtoSupportState.nation.diplomacy.diplomaticPoints = 100;
  for (const country of wtoSupportState.world.countries) {
    country.relationWithChina = 30;
  }
  for (const country of wtoSupportState.world.countries.slice(0, 3)) {
    country.tradeAgreement = true;
  }
  const wtoSupportEngine = createSimulationEngine(wtoSupportState);
  wtoSupportEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  const supportTriggeredRecords = [
    unSupportEngine.getState().nation.history.historicalEvents.at(-1),
    wtoSupportEngine.getState().nation.history.historicalEvents.at(-1),
  ];

  const policyEngine = createSimulationEngine(createInitialGameState(seed));
  policyEngine.dispatch({ type: "SET_POLICIES", policyIds: ["technology_priority"] });
  policyEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  const initialPolicyProgress =
    policyEngine.getState().nation.policyProgress.technology_priority;
  policyEngine.dispatch({ type: "ADVANCE_MONTHS", months: 59 });
  const maturePolicyProgress =
    policyEngine.getState().nation.policyProgress.technology_priority;

  const compulsoryEducationInitial = createInitialGameState(seed);
  enactHistoricalEventEarly(
    compulsoryEducationInitial.nation,
    "compulsory_education_law_1986",
    "audit:compulsory-education-law",
    "审计提前颁布义务教育法",
  );
  const compulsoryEducationBaselineEngine = createSimulationEngine(
    structuredClone(compulsoryEducationInitial),
  );
  const compulsoryEducationEngine = createSimulationEngine(
    structuredClone(compulsoryEducationInitial),
  );
  for (const engine of [
    compulsoryEducationBaselineEngine,
    compulsoryEducationEngine,
  ]) {
    engine.dispatch({ type: "UPDATE_BUDGET", budget: { education: 0.12 } });
  }
  compulsoryEducationEngine.dispatch({
    type: "SET_POLICIES",
    policyIds: ["compulsory_education_implementation"],
  });
  compulsoryEducationBaselineEngine.dispatch({
    type: "ADVANCE_MONTHS",
    months: 180,
  });
  compulsoryEducationEngine.dispatch({ type: "ADVANCE_MONTHS", months: 180 });
  const compulsoryEducationBaseline = compulsoryEducationBaselineEngine
    .getState().nation;
  const compulsoryEducation = compulsoryEducationEngine.getState().nation;

  const capitalMarketInitial = createInitialGameState(seed, 1980);
  capitalMarketInitial.nation.economy.institutionalEfficiency = 0.72;
  capitalMarketInitial.nation.institutions.legalPredictability = 0.7;
  capitalMarketInitial.nation.institutions.stateCapacity = 0.68;
  capitalMarketInitial.nation.society.stabilityIndex = 70;
  const capitalMarketEarlyInitial = structuredClone(capitalMarketInitial);
  enactHistoricalEventEarly(
    capitalMarketEarlyInitial.nation,
    "securities_exchange_1990",
    "audit:securities-exchange",
    "审计提前设立证券交易所",
  );
  const capitalMarketBaselineEngine = createSimulationEngine(capitalMarketInitial);
  const capitalMarketEarlyEngine = createSimulationEngine(capitalMarketEarlyInitial);
  capitalMarketBaselineEngine.dispatch({ type: "ADVANCE_MONTHS", months: 120 });
  capitalMarketEarlyEngine.dispatch({ type: "ADVANCE_MONTHS", months: 120 });
  const capitalMarketBaseline = capitalMarketBaselineEngine.getState().nation;
  const capitalMarketEarly = capitalMarketEarlyEngine.getState().nation;

  const industrialPolicyInitial = createInitialGameState(seed, 2005);
  industrialPolicyInitial.nation.economy.institutionalEfficiency = 0.8;
  industrialPolicyInitial.nation.institutions.stateCapacity = 0.8;
  industrialPolicyInitial.nation.institutions.localImplementationCapacity = 0.8;
  industrialPolicyInitial.nation.education.index = 65;
  industrialPolicyInitial.nation.technology.index = 60;
  const industrialPolicyBaselineEngine = createSimulationEngine(
    structuredClone(industrialPolicyInitial),
  );
  const industrialPolicySupportEngine = createSimulationEngine(
    structuredClone(industrialPolicyInitial),
  );
  const industrialPolicySuppressEngine = createSimulationEngine(
    structuredClone(industrialPolicyInitial),
  );
  industrialPolicySupportEngine.dispatch({
    type: "SET_INDUSTRIAL_POLICY",
    industryId: "electronics_communications",
    stance: "support",
  });
  industrialPolicySuppressEngine.dispatch({
    type: "SET_INDUSTRIAL_POLICY",
    industryId: "basic_materials",
    stance: "suppress",
  });
  for (const engine of [
    industrialPolicyBaselineEngine,
    industrialPolicySupportEngine,
    industrialPolicySuppressEngine,
  ]) {
    engine.dispatch({ type: "ADVANCE_MONTHS", months: 36 });
  }
  const industrialPolicyBaseline = industrialPolicyBaselineEngine.getState().nation;
  const industrialPolicySupport = industrialPolicySupportEngine.getState().nation;
  const industrialPolicySuppress = industrialPolicySuppressEngine.getState().nation;

  const neutralTrade = createInitialGameState(seed);
  const agreementTrade = structuredClone(neutralTrade);
  const sanctionedTrade = structuredClone(neutralTrade);
  const neutralCountry = neutralTrade.world.countries.find((country) => country.id === "usa")!;
  const agreementCountry = agreementTrade.world.countries.find((country) => country.id === "usa")!;
  const sanctionedCountry = sanctionedTrade.world.countries.find((country) => country.id === "usa")!;
  neutralCountry.relationWithChina = 40;
  agreementCountry.relationWithChina = 40;
  sanctionedCountry.relationWithChina = 40;
  agreementCountry.tradeAgreement = true;
  agreementCountry.diplomaticStatus = "partner";
  sanctionedCountry.sanctionLevel = 0.8;
  sanctionedCountry.diplomaticStatus = "sanctioned";
  const neutralAccess = calculateTradeAccess(neutralTrade).marketAccessMultiplier;
  const agreementAccess = calculateTradeAccess(agreementTrade).marketAccessMultiplier;
  const sanctionedAccess = calculateTradeAccess(sanctionedTrade).marketAccessMultiplier;
  const proSovietStrategy = structuredClone(neutralTrade);
  const proWesternStrategy = structuredClone(neutralTrade);
  proSovietStrategy.nation.diplomacy.strategyId = "pro_soviet";
  proSovietStrategy.nation.diplomacy.strategyAlignment = -1;
  proWesternStrategy.nation.diplomacy.strategyId = "pro_western";
  proWesternStrategy.nation.diplomacy.strategyAlignment = 1;
  const balancedStrategyEffects = diplomaticStrategyEffects(neutralTrade.nation);
  const proSovietStrategyEffects = diplomaticStrategyEffects(proSovietStrategy.nation);
  const proWesternStrategyEffects = diplomaticStrategyEffects(proWesternStrategy.nation);
  const proSovietAccess = calculateTradeAccess(proSovietStrategy).marketAccessMultiplier;
  const proWesternAccess = calculateTradeAccess(proWesternStrategy).marketAccessMultiplier;

  const revolutionaryDoctrine = structuredClone(neutralTrade);
  const peacefulDoctrine = structuredClone(neutralTrade);
  const economicDoctrine = structuredClone(neutralTrade);
  const multilateralDoctrine = structuredClone(neutralTrade);
  revolutionaryDoctrine.nation.diplomacy.foreignPolicyDoctrineId =
    "revolutionary_internationalism";
  peacefulDoctrine.nation.diplomacy.foreignPolicyDoctrineId =
    "peaceful_coexistence";
  economicDoctrine.nation.diplomacy.foreignPolicyDoctrineId =
    "economic_diplomacy";
  multilateralDoctrine.nation.diplomacy.foreignPolicyDoctrineId =
    "multilateral_institutionalism";
  for (const state of [
    revolutionaryDoctrine,
    peacefulDoctrine,
    economicDoctrine,
    multilateralDoctrine,
  ]) {
    state.nation.diplomacy.previousForeignPolicyDoctrineId = null;
    state.nation.diplomacy.foreignPolicyDoctrineProgress = 1;
  }
  const revolutionaryDoctrineEffects = foreignPolicyDoctrineEffects(
    revolutionaryDoctrine.nation,
  );
  const peacefulDoctrineEffects = foreignPolicyDoctrineEffects(
    peacefulDoctrine.nation,
  );
  const economicDoctrineEffects = foreignPolicyDoctrineEffects(
    economicDoctrine.nation,
  );
  const multilateralDoctrineEffects = foreignPolicyDoctrineEffects(
    multilateralDoctrine.nation,
  );

  const technologyConstrainedTrade = createInitialGameState(seed);
  const technologyCapableTrade = structuredClone(technologyConstrainedTrade);
  for (const state of [technologyConstrainedTrade, technologyCapableTrade]) {
    state.nation.technology.index = 80;
    state.nation.education.index = 70;
    state.nation.trade.openness = 0.7;
    state.nation.policyProgress.industrial_upgrading = 1;
  }
  technologyCapableTrade.nation.technology.completedTechnologyIds =
    technologyTreeDefinitions
      .filter((node) => node.industryTier <= 4)
      .map((node) => node.id);
  for (let month = 0; month < 120; month += 1) {
    updateIndustrialStructure(technologyConstrainedTrade.nation);
    updateIndustrialStructure(technologyCapableTrade.nation);
  }
  updateInternationalTrade(technologyConstrainedTrade);
  updateInternationalTrade(technologyCapableTrade);
  const constrainedUpgradeBenefit = applyPolicyModifiers(
    technologyConstrainedTrade.nation,
    "trade.exportCompetitiveness",
    1,
  );
  const capableUpgradeBenefit = applyPolicyModifiers(
    technologyCapableTrade.nation,
    "trade.exportCompetitiveness",
    1,
  );
  const historicalTechnologyTree = calculateTechnologyTreeMetrics(
    historical.finalState.nation,
  );
  const historicalIndustrialStructure = calculateIndustrialStructureMetrics(
    historical.finalState.nation,
  );
  const constrainedIndustrialStructure = calculateIndustrialStructureMetrics(
    technologyConstrainedTrade.nation,
  );
  const capableIndustrialStructure = calculateIndustrialStructureMetrics(
    technologyCapableTrade.nation,
  );
  const industrialOutputTotal = Object.values(
    historical.finalState.nation.industries,
  ).reduce((sum, category) => sum + category.valueAdded, 0);
  const industrialExportTotal = Object.values(
    historical.finalState.nation.industries,
  ).reduce((sum, category) => sum + category.exportValue, 0);

  const remittanceBaseline = createInitialGameState(seed);
  const remittanceProtection = structuredClone(remittanceBaseline);
  const remittanceInvestment = structuredClone(remittanceBaseline);
  const centralizedSettlement = structuredClone(remittanceBaseline);
  remittanceProtection.nation.policyProgress.remittance_protection = 1;
  remittanceInvestment.nation.policyProgress.overseas_chinese_investment = 1;
  centralizedSettlement.nation.policyProgress.centralized_fx_settlement = 1;
  for (const state of [
    remittanceBaseline,
    remittanceProtection,
    remittanceInvestment,
    centralizedSettlement,
  ]) {
    updateForeignExchange(state);
    calculateGDP(state.nation);
  }
  const finalTrade = historical.finalState.nation.trade;
  const allFinalTradeStates = [...runs.values()].map(
    (run) => run.finalState.nation.trade,
  );
  const lightIndustryPath = createInitialGameState(seed).nation;
  const electronicsPath = structuredClone(lightIndustryPath);
  const heavyEquipmentPath = structuredClone(lightIndustryPath);
  const greenElectrificationPath = structuredClone(lightIndustryPath);
  setTechnologyIndustryPath(lightIndustryPath, "light_industry_exports");
  setTechnologyIndustryPath(electronicsPath, "electronics_information");
  setTechnologyIndustryPath(heavyEquipmentPath, "heavy_equipment");
  setTechnologyIndustryPath(greenElectrificationPath, "green_electrification");
  for (const nation of [
    lightIndustryPath,
    electronicsPath,
    heavyEquipmentPath,
    greenElectrificationPath,
  ]) {
    nation.technology.previousDevelopmentPathId = null;
    nation.technology.developmentPathProgress = 1;
  }
  const weakSocialProtection = createInitialGameState(seed).nation;
  const strongSocialProtection = structuredClone(weakSocialProtection);
  weakSocialProtection.fiscal.budget.welfare = 0.01;
  strongSocialProtection.fiscal.budget.welfare = 0.24;
  for (const nation of [weakSocialProtection, strongSocialProtection]) {
    nation.fiscal.expenditure = nation.economy.nominalGDP * 0.18;
    calculateGDP(nation);
  }
  const lowExternalDemand = createInitialGameState(seed).nation;
  const highExternalDemand = structuredClone(lowExternalDemand);
  lowExternalDemand.trade.exports = 0;
  highExternalDemand.trade.exports = highExternalDemand.economy.nominalGDP * 0.45;
  for (let month = 0; month < 24; month += 1) {
    updateDemandDrivenCapacityUtilization(lowExternalDemand);
    updateDemandDrivenCapacityUtilization(highExternalDemand);
  }
  calculateIndustryOutputs(lowExternalDemand);
  calculateIndustryOutputs(highExternalDemand);
  calculateGDP(lowExternalDemand);
  calculateGDP(highExternalDemand);

  const historicalAidEngine = createSimulationEngine(
    createInitialGameState(seed, 1949, "automatic"),
  );
  const suspendedAidEngine = createSimulationEngine(
    createInitialGameState(seed, 1949, "automatic"),
  );
  const expandedAidEngine = createSimulationEngine(
    createInitialGameState(seed, 1949, "automatic"),
  );
  const economicAidEngine = createSimulationEngine(
    createInitialGameState(seed, 1949, "automatic"),
  );
  suspendedAidEngine.dispatch({
    type: "SET_FOREIGN_AID_PROGRAM",
    programId: "suspended",
  });
  expandedAidEngine.dispatch({
    type: "SET_FOREIGN_AID_PROGRAM",
    programId: "expanded_internationalist",
  });
  economicAidEngine.dispatch({
    type: "SET_FOREIGN_AID_PROGRAM",
    programId: "economic_technical_cooperation",
  });
  historicalAidEngine.dispatch({ type: "ADVANCE_MONTHS", months: 384 });
  suspendedAidEngine.dispatch({ type: "ADVANCE_MONTHS", months: 384 });
  expandedAidEngine.dispatch({ type: "ADVANCE_MONTHS", months: 384 });
  economicAidEngine.dispatch({ type: "ADVANCE_MONTHS", months: 384 });
  const historicalAidState = historicalAidEngine.getState();
  const suspendedAidState = suspendedAidEngine.getState();
  const expandedAidState = expandedAidEngine.getState();
  const economicAidState = economicAidEngine.getState();
  const historicalAidTotals = historicalForeignAidTotalsThrough1980();
  const historicalAidNorthKorea = historicalAidState.world.countries.find(
    (country) => country.id === "north_korea",
  );
  const suspendedAidNorthKorea = suspendedAidState.world.countries.find(
    (country) => country.id === "north_korea",
  );
  const expandedAidNorthKorea = expandedAidState.world.countries.find(
    (country) => country.id === "north_korea",
  );
  const economicAidNorthKorea = economicAidState.world.countries.find(
    (country) => country.id === "north_korea",
  );

  const prepareNormalizationState = () => {
    const state = createInitialGameState(seed, 1970, "automatic");
    state.nation.diplomacy.diplomaticPoints = 100;
    state.nation.diplomacy.globalReputation = 60;
    state.nation.society.stabilityIndex = 60;
    state.nation.economy.institutionalEfficiency = 0.55;
    const usa = state.world.countries.find((country) => country.id === "usa");
    if (usa) usa.relationWithChina = 50;
    return state;
  };
  const earlyNormalizationEngine = createSimulationEngine(prepareNormalizationState());
  const delayedNormalizationEngine = createSimulationEngine(prepareNormalizationState());
  const normalizationStatus = getSinoUSNormalizationStatus(
    earlyNormalizationEngine.exportState(),
  );
  earlyNormalizationEngine.dispatch({ type: "START_SINO_US_NORMALIZATION" });
  earlyNormalizationEngine.dispatch({ type: "ADVANCE_MONTHS", months: 96 });
  delayedNormalizationEngine.dispatch({ type: "ADVANCE_MONTHS", months: 96 });
  const earlyNormalization = earlyNormalizationEngine.getState();
  const delayedNormalization = delayedNormalizationEngine.getState();
  const earlyNormalizationEffects = sinoUSNormalizationEffects(
    earlyNormalization.nation,
  );
  const normalizationRelation = (state: GameState, countryId: string) =>
    state.world.countries.find((country) => country.id === countryId)
      ?.relationWithChina ?? -100;

  const checks: AuditCheck[] = [
    makeCheck(
      "continuous-run",
      `${strategyIds.length} 种策略均连续运行 1949—2026`,
      summaries.every((item) => item.years === 78),
      `年度快照长度：${summaries.map((item) => `${item.strategy}=${item.years}`).join("，")}`,
    ),
    makeCheck(
      "performance",
      "无界面模拟性能满足预算",
      summaries.every((item) => item.durationMs < 5_000),
      `单路线最慢 ${Math.max(...summaries.map((item) => item.durationMs)).toFixed(2)} ms`,
    ),
    makeCheck(
      "determinism",
      "相同种子、策略及事件流完全确定",
      JSON.stringify(duplicate.annual) === JSON.stringify(historical.annual) &&
        duplicate.finalState.randomState === historical.finalState.randomState &&
        duplicate.finalState.eventRandomState === historical.finalState.eventRandomState,
      "年度序列及两个随机流状态逐值一致",
    ),
    makeCheck(
      "calibration",
      "历史参考策略保持校准通过",
      calibration.passed === calibration.total,
      `${calibration.passed}/${calibration.total} 个校准项通过`,
    ),
    makeCheck(
      "national-accounts-identity",
      "14类投入产出账户与生产法、收入法、支出法GDP保持守恒",
      [...runs.values()].every((run) => {
        const accounts = run.finalState.nation.nationalAccounts;
        return Object.keys(accounts.products).length === 14 &&
          accounts.productionGDP > 0 &&
          accounts.gdpIdentityError / accounts.productionGDP < 1e-10 &&
          accounts.maximumProductBalanceError / accounts.productionGDP < 1e-10 &&
          accounts.aggregateInputAvailability > 0 &&
          accounts.aggregateInputAvailability <= 1;
      }),
      `史实路线三种GDP ${historical.finalState.nation.nationalAccounts.productionGDP.toFixed(0)}/${historical.finalState.nation.nationalAccounts.incomeGDP.toFixed(0)}/${historical.finalState.nation.nationalAccounts.expenditureGDP.toFixed(0)}；投入可得率 ${(historical.finalState.nation.nationalAccounts.aggregateInputAvailability * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "market-dynamics-accounts",
      "14类产品价格、库存、工资与经济周期账户保持有限且形成库存反馈",
      validateMarketDynamicsDefinitions().length === 0 &&
        [...runs.values()].every((run) => {
          const market = run.finalState.nation.marketDynamics;
          return Object.keys(market.products).length === 14 &&
            market.consumerPriceIndex > 0 &&
            market.producerPriceIndex > 0 &&
            market.realWageIndex > 0 &&
            market.aggregateInventoryMonths >= 0 &&
            Object.values(market.products).every(
              (product) => product.priceIndex > 0 && product.inventoryStock >= 0,
            );
        }),
      `史实路线 CPI/PPI ${historical.finalState.nation.marketDynamics.consumerPriceIndex.toFixed(3)}/${historical.finalState.nation.marketDynamics.producerPriceIndex.toFixed(3)}，实际工资指数 ${historical.finalState.nation.marketDynamics.realWageIndex.toFixed(3)}，库存 ${historical.finalState.nation.marketDynamics.aggregateInventoryMonths.toFixed(2)} 个月`,
    ),
    makeCheck(
      "demographic-cohort-accounts",
      "18个年龄性别队列、家庭户、抚养比与城乡迁移账户保持守恒",
      validateDemographicCohortDefinitions().length === 0 &&
        [...runs.values()].every((run) => {
          const nation = run.finalState.nation;
          const detail = nation.population.demographicDetail;
          const cohortTotal = AGE_BAND_IDS.reduce(
            (sum, id) => sum + detail.cohorts[id].male + detail.cohorts[id].female,
            0,
          );
          return Object.keys(detail.cohorts).length === 18 &&
            Math.abs(cohortTotal - nation.population.total) < 1 &&
            detail.households.householdCount > 0 &&
            detail.households.totalDependencyRatio >= 0 &&
            detail.migration.cumulativeRuralToUrban >= 0;
        }),
      `史实路线家庭 ${historical.finalState.nation.population.demographicDetail.households.householdCount.toFixed(0)} 户、户均 ${historical.finalState.nation.population.demographicDetail.households.averageHouseholdSize.toFixed(2)} 人、总抚养比 ${(historical.finalState.nation.population.demographicDetail.households.totalDependencyRatio * 100).toFixed(1)}%、累计农村转城市 ${(historical.finalState.nation.population.demographicDetail.migration.cumulativeRuralToUrban / 100_000_000).toFixed(2)} 亿人次`,
    ),
    makeCheck(
      "enterprise-ownership-accounts",
      "五类所有制企业完整分配增加值、就业、投资、出口与利润",
      validateEnterpriseSectorDefinitions().length === 0 &&
        [...runs.values()].every((run) => {
          const enterprises = run.finalState.nation.enterprises;
          const share = ENTERPRISE_OWNERSHIP_IDS.reduce(
            (sum, id) => sum + enterprises.ownership[id].valueAddedShare,
            0,
          );
          return Object.keys(enterprises.ownership).length === 5 &&
            Math.abs(share - 1) < 1e-10 &&
            enterprises.valueAddedReconciliationError /
              Math.max(1, run.finalState.nation.nationalAccounts.productionGDP * 0.88) < 1e-10 &&
            enterprises.employmentReconciliationError /
              Math.max(1, run.finalState.nation.labor.employed) < 1e-10 &&
            enterprises.investmentReconciliationError /
              Math.max(1, run.finalState.nation.economy.investment) < 1e-10 &&
            enterprises.exportReconciliationError /
              Math.max(1, run.finalState.nation.trade.exports) < 1e-10;
        }),
      `史实路线国有与集体 ${(historical.finalState.nation.enterprises.stateControlledShare * 100).toFixed(1)}%、民营与混合 ${(historical.finalState.nation.enterprises.privateAndMixedShare * 100).toFixed(1)}%、外商投资 ${(historical.finalState.nation.enterprises.foreignInvestedShare * 100).toFixed(1)}%，企业数 ${historical.finalState.nation.enterprises.totalEnterpriseCount.toFixed(0)}`,
    ),
    makeCheck(
      "fiscal-federalism-accounts",
      "中央地方财政与五项社会保障在合并口径内守恒",
      validateFiscalFederalismConfig().length === 0 &&
        [...runs.values()].every((run) => {
          const nation = run.finalState.nation;
          const account = nation.fiscal.federalism;
          return account.consolidatedRevenueError / Math.max(1, nation.fiscal.revenue) < 1e-10 &&
            account.consolidatedExpenditureError / Math.max(1, nation.fiscal.expenditure) < 1e-10 &&
            account.consolidatedDebtError / Math.max(1, nation.fiscal.governmentDebt) < 1e-10 &&
            account.socialProtection.reserve >= 0;
        }),
      `史实路线中央收入份额 ${(historical.finalState.nation.fiscal.federalism.centralRevenueShare * 100).toFixed(1)}%、中央对地方转移 ${historical.finalState.nation.fiscal.federalism.centralToLocalTransfers.toFixed(0)}、社保储备 ${historical.finalState.nation.fiscal.federalism.socialProtection.reserve.toFixed(0)}`,
    ),
    makeCheck(
      "historical-comparison",
      "界面可选择历史、韩国、日本和台湾比较 GDP、人均 GDP、人口与世界排名",
      historicalComparisons.length === 8 &&
        historicalRankComparisons.length === 5 &&
        targetComparisons.length === 4 &&
        historicalCurrentPriceComparison?.valueBasis === "current_cny" &&
        historicalCurrentPriceComparison.rows.length === 5 &&
        historicalCurrentPriceComparison.rows.every(
          (row) =>
            Number.isFinite(row.gdp.relativeDifference) &&
            Number.isFinite(row.gdpPerCapita.relativeDifference) &&
            Number.isFinite(row.gdpUSD?.relativeDifference) &&
            Number.isFinite(row.gdpPerCapitaUSD?.relativeDifference),
        ) &&
        internationalTargetComparisons.every(
          (comparison) =>
            comparison.valueBasis === "current_usd" &&
            comparison.rows.length === 9 &&
            comparison.rows.every(
              (row) =>
                Number.isFinite(row.gdp.relativeDifference) &&
                Number.isFinite(row.gdpPerCapita.relativeDifference) &&
                Number.isFinite(row.population.relativeDifference) &&
                Number.isFinite(row.gdpRank?.difference) &&
                (row.gdpRank?.targetParticipants ?? 0) > 100,
            ),
        ) &&
        historicalComparisons.every(
          (comparison) =>
            comparison.year <= 2020 &&
            Number.isFinite(comparison.realGDP.relativeDifference) &&
            Number.isFinite(comparison.realGDPPerCapita.relativeDifference) &&
            Number.isFinite(comparison.population.relativeDifference),
        ) &&
        historicalRankComparisons.every(
          (comparison) => Number.isFinite(comparison.gdpRank?.difference),
        ),
      `内部不变价历史 ${historicalComparisons.length} 个锚点；用户界面当年价历史 ${historicalCurrentPriceComparison?.rows.length ?? 0} 个锚点；韩国、日本、台湾各 ${internationalTargetComparisons.map((comparison) => comparison.rows.length).join("/")} 个现价美元锚点；2026 年预测目标已排除`,
    ),
    makeCheck(
      "distinct-routes",
      "不同政策路线产生明显不同结果",
      distinctGDP.size === strategyIds.length,
      `${strategyIds.length} 条路线产生 ${distinctGDP.size} 个不同的最终 GDP 数量级结果`,
    ),
    makeCheck(
      "policy-transition",
      "重要国策按过渡期渐进生效",
      initialPolicyProgress > 0 &&
        initialPolicyProgress < 1 &&
        Math.abs(maturePolicyProgress - 1) < 1e-9,
      `科技强国首月生效 ${(initialPolicyProgress * 100).toFixed(1)}%，60 个月后 ${(maturePolicyProgress * 100).toFixed(0)}%`,
    ),
    makeCheck(
      "compulsory-education-policy",
      "义务教育承担财政成本并通过基础教育和人力资本滞后提高科技",
      compulsoryEducation.history.historicalEvents.some(
        (record) => record.id === "compulsory_education_law_1986",
      ) &&
        compulsoryEducation.policyProgress.compulsory_education_implementation === 1 &&
        applyPolicyModifiers(compulsoryEducation, "fiscal.spending", 1) >= 1.06 &&
        compulsoryEducation.fiscal.expenditure >
          compulsoryEducationBaseline.fiscal.expenditure &&
        compulsoryEducation.education.primaryCoverage >
          compulsoryEducationBaseline.education.primaryCoverage &&
        compulsoryEducation.education.secondaryCoverage >
          compulsoryEducationBaseline.education.secondaryCoverage &&
        compulsoryEducation.economy.humanCapitalIndex >
          compulsoryEducationBaseline.economy.humanCapitalIndex &&
        compulsoryEducation.technology.index >
          compulsoryEducationBaseline.technology.index,
      `实施 15 年后基线/义务教育路线：财政支出 ${compulsoryEducationBaseline.fiscal.expenditure.toFixed(0)}/${compulsoryEducation.fiscal.expenditure.toFixed(0)}，小学覆盖率 ${(compulsoryEducationBaseline.education.primaryCoverage * 100).toFixed(1)}%/${(compulsoryEducation.education.primaryCoverage * 100).toFixed(1)}%，初中覆盖率 ${(compulsoryEducationBaseline.education.secondaryCoverage * 100).toFixed(1)}%/${(compulsoryEducation.education.secondaryCoverage * 100).toFixed(1)}%，人力资本 ${compulsoryEducationBaseline.economy.humanCapitalIndex.toFixed(2)}/${compulsoryEducation.economy.humanCapitalIndex.toFixed(2)}，科技 ${compulsoryEducationBaseline.technology.index.toFixed(2)}/${compulsoryEducation.technology.index.toFixed(2)}`,
    ),
    makeCheck(
      "securities-exchange-policy",
      "证券交易所作为永久历史转折，通过受监管的直接融资改善社会融资与创新并保留波动风险",
      capitalMarketEarly.history.historicalEvents.some(
        (record) =>
          record.id === "securities_exchange_1990" &&
          record.outcome === "enacted_early",
      ) &&
        capitalMarketEarly.financialSystem.capitalMarket.equityMarketDepth > 0 &&
        capitalMarketEarly.financialSystem.capitalMarket.annualEquityFinancing > 0 &&
        capitalMarketEarly.financialSystem.capitalMarket.annualEquityFinancing <=
          capitalMarketEarly.economy.investment &&
        capitalMarketEarly.financialSystem.capitalMarket.socialFinancingCapacity >
          capitalMarketBaseline.financialSystem.capitalMarket.socialFinancingCapacity &&
        capitalMarketEarly.privateEconomy.technologyCommercialization >
          capitalMarketBaseline.privateEconomy.technologyCommercialization &&
        capitalMarketEarly.financialSystem.capitalMarket.marketVolatilityIndex > 0,
      `提前设立 10 年后基线/交易所路线：社会融资能力 ${(capitalMarketBaseline.financialSystem.capitalMarket.socialFinancingCapacity * 100).toFixed(1)}%/${(capitalMarketEarly.financialSystem.capitalMarket.socialFinancingCapacity * 100).toFixed(1)}%，股权市场深度 ${(capitalMarketEarly.financialSystem.capitalMarket.equityMarketDepth * 100).toFixed(1)}%，年度股权融资 ${capitalMarketEarly.financialSystem.capitalMarket.annualEquityFinancing.toFixed(0)}，技术商业化 ${(capitalMarketBaseline.privateEconomy.technologyCommercialization * 100).toFixed(1)}%/${(capitalMarketEarly.privateEconomy.technologyCommercialization * 100).toFixed(1)}%，市场风险 ${(capitalMarketEarly.financialSystem.capitalMarket.marketVolatilityIndex * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "technology-industry-paths",
      "七条科技工业路线形成不同研究、产业、出口与能源取舍",
      technologyIndustryPathDefinitions.length === 7 &&
        technologyIndustryEffect(
          lightIndustryPath,
          "consumer_goods",
        ).outputWeightMultiplier >
          technologyIndustryEffect(
            electronicsPath,
            "consumer_goods",
          ).outputWeightMultiplier &&
        technologyIndustryEffect(
          electronicsPath,
          "electronics_communications",
        ).exportMultiplier >
          technologyIndustryEffect(
            lightIndustryPath,
            "electronics_communications",
          ).exportMultiplier &&
        technologyIndustryEnergyDemandMultiplier(heavyEquipmentPath) >
          technologyIndustryEnergyDemandMultiplier(greenElectrificationPath),
      `轻工/电子路线消费品权重 ${technologyIndustryEffect(lightIndustryPath, "consumer_goods").outputWeightMultiplier.toFixed(2)}/${technologyIndustryEffect(electronicsPath, "consumer_goods").outputWeightMultiplier.toFixed(2)}；电子出口倍率 ${technologyIndustryEffect(electronicsPath, "electronics_communications").exportMultiplier.toFixed(2)}；重工/绿色能源需求倍率 ${technologyIndustryEnergyDemandMultiplier(heavyEquipmentPath).toFixed(2)}/${technologyIndustryEnergyDemandMultiplier(greenElectrificationPath).toFixed(2)}`,
    ),
    makeCheck(
      "technology-tree-capability",
      "科技树由教育、科研和前置节点推进，并约束产业升级与出口竞争力",
      technologyTreeValidationError === null &&
        technologyTreeDefinitions.length === 34 &&
        historicalTechnologyTree.completedCount >= 8 &&
        historicalTechnologyTree.effectiveIndustrialTechnology <=
          historical.finalState.nation.technology.index &&
        constrainedUpgradeBenefit === 1 &&
        capableUpgradeBenefit > 1.07 &&
        technologyCapableTrade.nation.trade.exports >
          technologyConstrainedTrade.nation.trade.exports,
      technologyTreeValidationError ??
        `史实路线完成 ${historicalTechnologyTree.completedCount}/${historicalTechnologyTree.totalCount} 个节点、产业科技第 ${historicalTechnologyTree.industryTier} 层、升级准备度 ${(historicalTechnologyTree.industrialUpgradeReadiness * 100).toFixed(1)}%；同为科技指数 80 时，无节点/具备第四层节点的产业升级出口倍率 ${constrainedUpgradeBenefit.toFixed(3)}/${capableUpgradeBenefit.toFixed(3)}，月度出口 ${technologyConstrainedTrade.nation.trade.exports.toFixed(0)}/${technologyCapableTrade.nation.trade.exports.toFixed(0)}`,
    ),
    makeCheck(
      "industrial-category-structure",
      "十一类工业通过教育、科技、能源与开放条件影响产出结构和出口",
      industrialCategoryValidationError === null &&
        industrialCategoryDefinitions.length === 11 &&
        Math.abs(
          industrialOutputTotal - historical.finalState.nation.sectors.secondary.valueAdded,
        ) < 1 &&
        industrialExportTotal <= historical.finalState.nation.trade.exports &&
        capableIndustrialStructure.complexityIndex >
          constrainedIndustrialStructure.complexityIndex &&
        capableIndustrialStructure.highTechnologyShare >
          constrainedIndustrialStructure.highTechnologyShare &&
        capableIndustrialStructure.exportCapability >
          constrainedIndustrialStructure.exportCapability,
      industrialCategoryValidationError ??
        `史实路线工业复杂度 ${historicalIndustrialStructure.complexityIndex.toFixed(1)}、高技术工业占比 ${(historicalIndustrialStructure.highTechnologyShare * 100).toFixed(1)}%、工业品出口 ${(industrialExportTotal / 100_000_000).toFixed(1)} 亿美元；能力完备/受限出口能力 ${capableIndustrialStructure.exportCapability.toFixed(3)}/${constrainedIndustrialStructure.exportCapability.toFixed(3)}`,
    ),
    makeCheck(
      "targeted-industrial-policy",
      "产业政策可定向扶持或限制十一类工业，并形成财政、错配、就业与供应链代价",
      validateIndustrialPolicyConfiguration().length === 0 &&
        industrialPolicySupport.industries.electronics_communications.outputShare >
          industrialPolicyBaseline.industries.electronics_communications.outputShare &&
        industrialPolicySupport.industries.electronics_communications.exportValue >
          industrialPolicyBaseline.industries.electronics_communications.exportValue &&
        industrialPolicySupport.industrialPolicy.annualFiscalCost > 0 &&
        industrialPolicySupport.industrialPolicy.distortionIndex > 0 &&
        industrialPolicySuppress.industries.basic_materials.outputShare <
          industrialPolicyBaseline.industries.basic_materials.outputShare &&
        industrialPolicySuppress.industrialPolicy.supplyChainConstraint < 1 &&
        industrialPolicySuppress.industrialPolicy.laborDisplacementPressure > 0 &&
        industrialPolicySuppress.labor.unemploymentRate >
          industrialPolicyBaseline.labor.unemploymentRate,
      `36个月后电子通信业基线/扶持份额 ${(industrialPolicyBaseline.industries.electronics_communications.outputShare * 100).toFixed(2)}%/${(industrialPolicySupport.industries.electronics_communications.outputShare * 100).toFixed(2)}%，出口 ${industrialPolicyBaseline.industries.electronics_communications.exportValue.toFixed(0)}/${industrialPolicySupport.industries.electronics_communications.exportValue.toFixed(0)}；基础材料基线/限制份额 ${(industrialPolicyBaseline.industries.basic_materials.outputShare * 100).toFixed(2)}%/${(industrialPolicySuppress.industries.basic_materials.outputShare * 100).toFixed(2)}%，供应链约束 ${(industrialPolicySuppress.industrialPolicy.supplyChainConstraint * 100).toFixed(1)}%，失业率 ${(industrialPolicyBaseline.labor.unemploymentRate * 100).toFixed(2)}%/${(industrialPolicySuppress.labor.unemploymentRate * 100).toFixed(2)}%`,
    ),
    makeCheck(
      "korean-catch-up",
      "韩国式追赶路线通过资本、技能、出口学习和产业升级进入韩国收入数量级",
      koreanCatchUpComparableUSD >=
          koreanTarget2000.currentUSDGDPPerCapita * 0.85 &&
        koreanCatchUpComparableUSD <=
          koreanTarget2000.currentUSDGDPPerCapita * 3 &&
        koreanCatchUp2000.educationIndex > 75 &&
        koreanCatchUp2000.secondarySectorShare > 0.4 &&
        koreanCatchUp.finalState.nation.trade.exports /
            koreanCatchUp.finalState.nation.economy.nominalGDP <=
          0.551,
      `2000 年追赶可比收入 $${koreanCatchUpComparableUSD.toFixed(1)}（不变价相对模型韩国 × 世行韩国人均），展示口径 $${koreanCatchUp2000.currentUSDGDPPerCapita.toFixed(1)}，韩国参考 $${koreanTarget2000.currentUSDGDPPerCapita.toFixed(1)}；教育指数 ${koreanCatchUp2000.educationIndex.toFixed(1)}，二产占比 ${(koreanCatchUp2000.secondarySectorShare * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "development-route-blueprints",
      "六组发展蓝图只提供可自由调整的合法推荐组合",
      developmentBlueprintValidationError === null &&
        developmentRouteBlueprints.length === 6 &&
        developmentRouteBlueprints.every((blueprint) => {
          const decision = getAnnualDecision(
            blueprint.id as StrategyId,
            1950,
          );
          return JSON.stringify(decision.policyIds) ===
            JSON.stringify(blueprint.policyIds);
        }),
      developmentBlueprintValidationError ??
        developmentRouteBlueprints.map((blueprint) =>
          `${blueprint.referenceEconomy}=${blueprint.policyIds.length} 项`,
        ).join("；"),
    ),
    makeCheck(
      "development-route-differences",
      "韩台港新美日参考路线形成可辨识的产业、开放、教育和财政取舍",
      koreanCatchUp2000.secondarySectorShare >
          singaporeRoute2000.secondarySectorShare &&
        hongKongRoute.finalState.nation.trade.openness >
          taiwanRoute.finalState.nation.trade.openness &&
        hongKongRoute2000.tertiarySectorShare >
          taiwanRoute2000.tertiarySectorShare &&
        singaporeRoute2000.educationIndex > hongKongRoute2000.educationIndex &&
        usRoute.finalState.nation.fiscal.debtToGDP >
          taiwanRoute.finalState.nation.fiscal.debtToGDP &&
        japanRoute2000.secondarySectorShare >
          singaporeRoute2000.secondarySectorShare,
      `2000 年二产占比：韩国 ${(koreanCatchUp2000.secondarySectorShare * 100).toFixed(1)}%/新加坡 ${(singaporeRoute2000.secondarySectorShare * 100).toFixed(1)}%；2026 年开放度：香港 ${(hongKongRoute.finalState.nation.trade.openness * 100).toFixed(1)}%/台湾 ${(taiwanRoute.finalState.nation.trade.openness * 100).toFixed(1)}%；2000 年教育指数：新加坡 ${singaporeRoute2000.educationIndex.toFixed(1)}/香港 ${hongKongRoute2000.educationIndex.toFixed(1)}；2026 年债务率：美国 ${(usRoute.finalState.nation.fiscal.debtToGDP * 100).toFixed(1)}%；2000 年二产占比：日本 ${(japanRoute2000.secondarySectorShare * 100).toFixed(1)}%/新加坡 ${(singaporeRoute2000.secondarySectorShare * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "domestic-external-demand-link",
      "出口与内需通过产能利用影响经济，社会保障通过居民收入和消费支持内需",
      highExternalDemand.sectors.secondary.capacityUtilization >
          lowExternalDemand.sectors.secondary.capacityUtilization &&
        highExternalDemand.economy.realGDP > lowExternalDemand.economy.realGDP &&
        strongSocialProtection.economy.socialProtectionIncome >
          weakSocialProtection.economy.socialProtectionIncome &&
        strongSocialProtection.economy.householdConsumption >
          weakSocialProtection.economy.householdConsumption,
      `高/低出口工业产能利用率 ${(highExternalDemand.sectors.secondary.capacityUtilization * 100).toFixed(2)}%/${(lowExternalDemand.sectors.secondary.capacityUtilization * 100).toFixed(2)}%，GDP ${highExternalDemand.economy.realGDP.toFixed(0)}/${lowExternalDemand.economy.realGDP.toFixed(0)}；强/弱社保居民消费 ${strongSocialProtection.economy.householdConsumption.toFixed(0)}/${weakSocialProtection.economy.householdConsumption.toFixed(0)}`,
    ),
    makeCheck(
      "diplomacy-trade-link",
      "协定和制裁对国际贸易形成双向反馈",
      agreementAccess > neutralAccess && sanctionedAccess < neutralAccess,
      `中性 ${neutralAccess.toFixed(3)}，贸易协定 ${agreementAccess.toFixed(3)}，制裁 ${sanctionedAccess.toFixed(3)}`,
    ),
    makeCheck(
      "diplomatic-strategies",
      "亲苏、平衡和亲西方路线对贸易、外资、科技与安全形成不同取舍",
      proWesternAccess > neutralAccess &&
        neutralAccess > proSovietAccess &&
        proWesternStrategyEffects.foreignInvestmentMultiplier >
          balancedStrategyEffects.foreignInvestmentMultiplier &&
        proSovietStrategyEffects.foreignInvestmentMultiplier <
          balancedStrategyEffects.foreignInvestmentMultiplier &&
        proWesternStrategyEffects.technologyDiffusionMultiplier >
          balancedStrategyEffects.technologyDiffusionMultiplier &&
        proSovietStrategyEffects.researchOutputMultiplier >
          balancedStrategyEffects.researchOutputMultiplier &&
        proSovietStrategyEffects.securityTargetAdjustment > 0 &&
        proWesternStrategyEffects.securityTargetAdjustment < 0,
      `市场准入：亲苏 ${proSovietAccess.toFixed(3)}、平衡 ${neutralAccess.toFixed(3)}、亲西方 ${proWesternAccess.toFixed(3)}；外资倍率 ${proSovietStrategyEffects.foreignInvestmentMultiplier.toFixed(2)}/${balancedStrategyEffects.foreignInvestmentMultiplier.toFixed(2)}/${proWesternStrategyEffects.foreignInvestmentMultiplier.toFixed(2)}`,
    ),
    makeCheck(
      "foreign-policy-doctrines",
      "七种外交学说可与阵营倾向组合，并对关系、经贸、科技、安全和声誉形成取舍",
      foreignPolicyDoctrineDefinitions.length === 7 &&
        foreignPolicyDoctrineRelationAdjustment(peacefulDoctrine.nation, "usa") >
          foreignPolicyDoctrineRelationAdjustment(revolutionaryDoctrine.nation, "usa") &&
        foreignPolicyDoctrineRelationAdjustment(peacefulDoctrine.nation, "south_korea") >
          foreignPolicyDoctrineRelationAdjustment(revolutionaryDoctrine.nation, "south_korea") &&
        foreignPolicyDoctrineRelationAdjustment(peacefulDoctrine.nation, "russia") <
          foreignPolicyDoctrineRelationAdjustment(revolutionaryDoctrine.nation, "russia") &&
        foreignPolicyDoctrineRelationAdjustment(peacefulDoctrine.nation, "north_korea") <
          foreignPolicyDoctrineRelationAdjustment(revolutionaryDoctrine.nation, "north_korea") &&
        peacefulDoctrineEffects.marketAccessMultiplier >
          revolutionaryDoctrineEffects.marketAccessMultiplier &&
        peacefulDoctrineEffects.foreignInvestmentMultiplier >
          revolutionaryDoctrineEffects.foreignInvestmentMultiplier &&
        economicDoctrineEffects.marketAccessMultiplier >
          peacefulDoctrineEffects.marketAccessMultiplier &&
        economicDoctrineEffects.securityTargetAdjustment < 0 &&
        multilateralDoctrineEffects.reputationTargetAdjustment >
          economicDoctrineEffects.reputationTargetAdjustment,
      `和平共处/革命援助对美关系目标 ${foreignPolicyDoctrineRelationAdjustment(peacefulDoctrine.nation, "usa").toFixed(0)}/${foreignPolicyDoctrineRelationAdjustment(revolutionaryDoctrine.nation, "usa").toFixed(0)}，对朝 ${foreignPolicyDoctrineRelationAdjustment(peacefulDoctrine.nation, "north_korea").toFixed(0)}/${foreignPolicyDoctrineRelationAdjustment(revolutionaryDoctrine.nation, "north_korea").toFixed(0)}；经贸外交市场倍率 ${economicDoctrineEffects.marketAccessMultiplier.toFixed(2)}、安全调整 ${economicDoctrineEffects.securityTargetAdjustment.toFixed(0)}；多边声誉调整 ${multilateralDoctrineEffects.reputationTargetAdjustment.toFixed(0)}`,
    ),
    makeCheck(
      "foreign-aid-programs",
      "玩家可选择七种对外援助方案，并在关系、国内资源、科技、出口和外汇之间取舍",
      foreignAidProgramDefinitions.length === 7 &&
        Math.abs(historicalAidTotals.rmb - 36_500_000_000) < 1 &&
        historicalAidTotals.usd >= 15_000_000_000 &&
        historicalAidTotals.usd <= 18_000_000_000 &&
        suspendedAidState.nation.diplomacy.cumulativeForeignAidRMBThrough1980 === 0 &&
        suspendedAidState.nation.economy.realGDP >
          historicalAidState.nation.economy.realGDP &&
        suspendedAidState.nation.economy.capitalStock >
          historicalAidState.nation.economy.capitalStock &&
        suspendedAidState.nation.technology.index >
          historicalAidState.nation.technology.index &&
        suspendedAidState.nation.trade.foreignExchangeReserves >
          historicalAidState.nation.trade.foreignExchangeReserves &&
        (historicalAidNorthKorea?.relationWithChina ?? -100) >
          (suspendedAidNorthKorea?.relationWithChina ?? 100) &&
        expandedAidState.nation.economy.capitalStock <
          historicalAidState.nation.economy.capitalStock &&
        expandedAidState.nation.trade.foreignExchangeReserves <
          historicalAidState.nation.trade.foreignExchangeReserves &&
        (expandedAidNorthKorea?.relationWithChina ?? -100) >
          (historicalAidNorthKorea?.relationWithChina ?? 100) &&
        economicAidState.nation.economy.capitalStock <
          historicalAidState.nation.economy.capitalStock &&
        economicAidState.nation.trade.exports >
          historicalAidState.nation.trade.exports &&
        (economicAidNorthKorea?.relationWithChina ?? 100) <
          (historicalAidNorthKorea?.relationWithChina ?? -100),
      `史实累计 ${(historicalAidTotals.rmb / 100_000_000).toFixed(1)} 亿元、${(historicalAidTotals.usd / 100_000_000).toFixed(1)} 亿美元；1980 年暂停/史实 GDP ${(suspendedAidState.nation.economy.realGDP / 100_000_000).toFixed(1)}/${(historicalAidState.nation.economy.realGDP / 100_000_000).toFixed(1)} 亿元，科技 ${suspendedAidState.nation.technology.index.toFixed(1)}/${historicalAidState.nation.technology.index.toFixed(1)}，对朝关系 ${(suspendedAidNorthKorea?.relationWithChina ?? 0).toFixed(1)}/${(historicalAidNorthKorea?.relationWithChina ?? 0).toFixed(1)}；扩大援助资本低于史实且对朝更高；经贸合作出口更高但对朝关系与资本低于史实`,
    ),
    makeCheck(
      "sino-us-normalization",
      "中美建交可提前或延迟，并通过教育、科技、出口、贸易协定和双边关系形成路径差异",
      normalizationStatus.available &&
        earlyNormalization.nation.diplomacy.sinoUSNormalizationEstablishedYear === 1971 &&
        earlyNormalizationEffects.relativeTimingAdvantage > 0 &&
        earlyNormalization.nation.education.researchTalent >
          delayedNormalization.nation.education.researchTalent &&
        earlyNormalization.nation.technology.index >
          delayedNormalization.nation.technology.index &&
        earlyNormalization.nation.trade.exports > delayedNormalization.nation.trade.exports &&
        normalizationRelation(earlyNormalization as GameState, "usa") >
          normalizationRelation(delayedNormalization as GameState, "usa") &&
        normalizationRelation(earlyNormalization as GameState, "russia") <
          normalizationRelation(delayedNormalization as GameState, "russia"),
      `提前/未提前：科研人才 ${earlyNormalization.nation.education.researchTalent.toFixed(0)}/${delayedNormalization.nation.education.researchTalent.toFixed(0)}，科技 ${earlyNormalization.nation.technology.index.toFixed(2)}/${delayedNormalization.nation.technology.index.toFixed(2)}，出口 ${(earlyNormalization.nation.trade.exports / 100_000_000).toFixed(1)}/${(delayedNormalization.nation.trade.exports / 100_000_000).toFixed(1)} 亿元，对美关系 ${normalizationRelation(earlyNormalization as GameState, "usa").toFixed(1)}/${normalizationRelation(delayedNormalization as GameState, "usa").toFixed(1)}`,
    ),
    makeCheck(
      "foreign-exchange-remittances",
      "外汇储备、侨汇及三类侨汇国策形成可追踪的经济传导",
      finalTrade.foreignExchangeReserves >= 2_500_000_000_000 &&
        finalTrade.foreignExchangeReserves <= 4_500_000_000_000 &&
        finalTrade.remittanceInflows >= 35_000_000_000 &&
        finalTrade.remittanceInflows <= 70_000_000_000 &&
        finalTrade.importCoverageMonths > 6 &&
        remittanceProtection.nation.trade.remittanceInflows >
          remittanceBaseline.nation.trade.remittanceInflows &&
        remittanceProtection.nation.economy.householdIncome >
          centralizedSettlement.nation.economy.householdIncome &&
        remittanceDirectedInvestment(remittanceInvestment.nation) >
          remittanceDirectedInvestment(remittanceBaseline.nation) &&
        centralizedSettlement.nation.trade.remittanceInflows <
          remittanceBaseline.nation.trade.remittanceInflows &&
        centralizedSettlement.nation.trade.remittanceReserveContribution >
          remittanceBaseline.nation.trade.remittanceReserveContribution,
      `2026 年末外储 ${(finalTrade.foreignExchangeReserves / 1_000_000_000_000).toFixed(2)} 万亿美元、年度侨汇 ${(finalTrade.remittanceInflows / 100_000_000).toFixed(1)} 亿美元、进口覆盖 ${finalTrade.importCoverageMonths.toFixed(1)} 个月；保护权益提高流入，侨资创业提高定向投资，集中结汇提高储备贡献但压低家庭收入`,
    ),
    makeCheck(
      "foreign-exchange-external-debt",
      "经济发展受资本品外汇约束，外债借入、专款使用与还本付息形成闭环",
      allFinalTradeStates.every((trade) =>
        [
          trade.externalDebt,
          trade.externalDebtToGDP,
          trade.externalDebtInterestRate,
          trade.annualExternalDebtService,
          trade.externalDebtServiceRatio,
          trade.monthlyExternalBorrowing,
          trade.capitalGoodsForeignExchangeNeed,
          trade.capitalGoodsImportShare,
          trade.capitalGoodsImportCoverage,
        ].every((value) => Number.isFinite(value) && value >= 0) &&
        trade.capitalGoodsImportCoverage <= 1
      ) &&
        finalTrade.externalDebtToGDP <= 0.2 &&
        finalTrade.externalDebtServiceRatio <= 0.2,
      `12 条路线外债与资本品用汇指标均为有限非负数；史实路线 2026 年外债 ${(finalTrade.externalDebt / 100_000_000).toFixed(1)} 亿美元、负债率 ${(finalTrade.externalDebtToGDP * 100).toFixed(3)}%、偿债率 ${(finalTrade.externalDebtServiceRatio * 100).toFixed(3)}%、资本品用汇满足率 ${(finalTrade.capitalGoodsImportCoverage * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "monetary-banking-balance-of-payments",
      "货币、银行资产负债表与国际收支恒等式可逐月核对",
      historical.finalState.nation.financialSystem.monetary.broadMoney > 0 &&
        historical.finalState.nation.financialSystem.banking.totalLoans > 0 &&
        historical.finalState.nation.financialSystem.banking.balanceSheetError /
          historical.finalState.nation.financialSystem.banking.totalAssets < 1e-10 &&
        historical.finalState.nation.financialSystem.balanceOfPayments.identityError < 0.01,
      `2026 年 M2 ${historical.finalState.nation.financialSystem.monetary.broadMoney.toFixed(0)}、贷款 ${historical.finalState.nation.financialSystem.banking.totalLoans.toFixed(0)}、不良率 ${(historical.finalState.nation.financialSystem.banking.nonPerformingLoanRatio * 100).toFixed(2)}%、国际收支误差 ${historical.finalState.nation.financialSystem.balanceOfPayments.identityError.toFixed(4)}`,
    ),
    makeCheck(
      "agriculture-rural-food-security",
      "农业土地、单产、粮食库存、农村收入与营养账户保持实物守恒",
      historical.finalState.nation.resources.agriculture.cultivatedLandHectares > 90_000_000 &&
        historical.finalState.nation.resources.agriculture.grainYieldKgPerHectare > 0 &&
        historical.finalState.nation.resources.agriculture.strategicReserveStock >= 0 &&
        historical.finalState.nation.resources.agriculture.massBalanceError < 0.01,
      `2026 年耕地 ${(historical.finalState.nation.resources.agriculture.cultivatedLandHectares / 10_000).toFixed(0)} 万公顷、单产 ${historical.finalState.nation.resources.agriculture.grainYieldKgPerHectare.toFixed(0)} 千克/公顷、储备覆盖 ${historical.finalState.nation.resources.agriculture.reserveCoverageMonths.toFixed(1)} 个月、每日 ${historical.finalState.nation.resources.agriculture.dailyCaloriesPerCapita.toFixed(0)} 千卡`,
    ),
    makeCheck(
      "energy-transport-environment",
      "六类能源、运输能力、物流效率与环境资源压力保持可核对",
      historical.finalState.nation.resources.infrastructureResources.energyShareError < 1e-10 &&
        historical.finalState.nation.resources.infrastructureResources.freightCapacity > 0 &&
        historical.finalState.nation.resources.infrastructureResources.logisticsEfficiencyIndex >= 0 &&
        historical.finalState.nation.resources.infrastructureResources.airPollutionIndex <= 100,
      `2026 年煤炭占比 ${(historical.finalState.nation.resources.infrastructureResources.energyMix.coal.share * 100).toFixed(1)}%、能源进口依赖 ${(historical.finalState.nation.resources.infrastructureResources.energyImportDependence * 100).toFixed(1)}%、物流效率 ${historical.finalState.nation.resources.infrastructureResources.logisticsEfficiencyIndex.toFixed(1)}、空气污染 ${historical.finalState.nation.resources.infrastructureResources.airPollutionIndex.toFixed(1)}`,
    ),
    makeCheck(
      "human-development-accounts",
      "学段人口、技能就业、基层医疗和疾病负担形成守恒细账",
      historical.finalState.nation.humanDevelopment.educationPopulationError < 1 &&
        historical.finalState.nation.humanDevelopment.laborForceError /
          historical.finalState.nation.labor.laborForce < 1e-10 &&
        historical.finalState.nation.humanDevelopment.employmentError /
          historical.finalState.nation.labor.employed < 1e-10 &&
        historical.finalState.nation.humanDevelopment.healthyLifeExpectancy <=
          historical.finalState.nation.health.lifeExpectancy,
      `2026 年高等教育入学率 ${(historical.finalState.nation.humanDevelopment.educationStages.higher.enrollmentRate * 100).toFixed(1)}%、高级技能与科研占比 ${((historical.finalState.nation.humanDevelopment.laborSkills.advanced.laborForce + historical.finalState.nation.humanDevelopment.laborSkills.research.laborForce) / historical.finalState.nation.labor.laborForce * 100).toFixed(1)}%、健康预期寿命 ${historical.finalState.nation.humanDevelopment.healthyLifeExpectancy.toFixed(1)} 岁`,
    ),
    makeCheck(
      "housing-land-urbanization",
      "住房建设拆除、家庭需求、土地转用和城市服务承载形成库存账户",
      historical.finalState.nation.society.urbanHousing.urbanHousingUnits > 0 &&
        historical.finalState.nation.society.urbanHousing.housingStockError /
          historical.finalState.nation.society.urbanHousing.urbanHousingUnits < 1e-10 &&
        historical.finalState.nation.society.urbanHousing.homePriceIndex > 0 &&
        historical.finalState.nation.society.urbanHousing.urbanServiceCoverage >= 0,
      `2026 年城镇住房 ${historical.finalState.nation.society.urbanHousing.urbanHousingUnits.toFixed(0)} 套、短缺 ${historical.finalState.nation.society.urbanHousing.housingShortageUnits.toFixed(0)} 套、房价收入比 ${historical.finalState.nation.society.urbanHousing.priceToIncomeRatio.toFixed(1)}、服务覆盖 ${(historical.finalState.nation.society.urbanHousing.urbanServiceCoverage * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "regional-economy-flows",
      "六大区域守恒分配全国总量，跨区人口、资本和财政流动净额为零",
      historical.finalState.nation.regionalEconomy.populationError /
          historical.finalState.nation.population.total < 1e-10 &&
        historical.finalState.nation.regionalEconomy.gdpError /
          historical.finalState.nation.economy.realGDP < 1e-10 &&
        historical.finalState.nation.regionalEconomy.migrationFlowError < 0.01 &&
        historical.finalState.nation.regionalEconomy.capitalFlowError < 0.01 &&
        historical.finalState.nation.regionalEconomy.fiscalTransferError < 0.01,
      `2026 年沿海 GDP 占 ${(historical.finalState.nation.regionalEconomy.coastalGDPShare * 100).toFixed(1)}%、区域人均差 ${historical.finalState.nation.regionalEconomy.regionalGDPPerCapitaRatio.toFixed(2)} 倍、西部发展指数 ${(historical.finalState.nation.regionalEconomy.westernDevelopmentIndex * 100).toFixed(1)}`,
    ),
    makeCheck(
      "world-trade-financial-network",
      "逐国贸易、外资、外债和结算网络与中国跨境总量保持守恒",
      historical.finalState.world.tradeNetwork.exportError /
          historical.finalState.nation.trade.exports < 1e-10 &&
        historical.finalState.world.tradeNetwork.importError /
          historical.finalState.nation.trade.imports < 1e-10 &&
        historical.finalState.world.tradeNetwork.investmentError /
          Math.max(1, historical.finalState.nation.trade.foreignInvestment) < 1e-10 &&
        historical.finalState.world.tradeNetwork.externalDebtError /
          Math.max(1, historical.finalState.nation.trade.externalDebt) < 1e-10,
      `2026 年出口 HHI ${historical.finalState.world.tradeNetwork.exportConcentrationIndex.toFixed(3)}、进口 HHI ${historical.finalState.world.tradeNetwork.importConcentrationIndex.toFixed(3)}、航运风险 ${(historical.finalState.world.tradeNetwork.averageShippingRisk * 100).toFixed(1)}%、人民币结算 ${(historical.finalState.world.tradeNetwork.renminbiSettlementShare * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "defense-war-security",
      "国防预算、装备库存、动员战备与战争损耗形成跨期安全账户",
      historical.finalState.nation.securityDefense.defenseCapitalStock > 0 &&
        historical.finalState.nation.securityDefense.readinessIndex >= 0 &&
        historical.finalState.nation.securityDefense.readinessIndex <= 100 &&
        historical.finalState.nation.securityDefense.cumulativeWarCost >= 0 &&
        historical.finalState.nation.securityDefense.cumulativeConflictCasualties >= 0,
      `2026 年国防资本 ${historical.finalState.nation.securityDefense.defenseCapitalStock.toFixed(0)}、战备 ${historical.finalState.nation.securityDefense.readinessIndex.toFixed(1)}、朝鲜战争累计月数 ${historical.finalState.nation.securityDefense.cumulativeConflictMonths}、账户伤亡 ${historical.finalState.nation.securityDefense.cumulativeConflictCasualties.toFixed(0)}`,
    ),
    makeCheck(
      "institution-causality-graph",
      "制度执行库存与六类内生风险信号可解释、有限且不直接改写宏观总量",
      historical.finalState.nation.institutions.stateCapacity >= 0 &&
        historical.finalState.nation.institutions.stateCapacity <= 1 &&
        historical.finalState.nation.institutions.effectivePolicyExecutionRate >= 0 &&
        historical.finalState.nation.institutions.effectivePolicyExecutionRate <= 1 &&
        Object.values(historical.finalState.nation.institutions.risks).every((risk) =>
          risk.pressure >= 0 && risk.pressure <= 1
        ),
      `2026 年国家能力 ${(historical.finalState.nation.institutions.stateCapacity * 100).toFixed(1)}%、政策有效执行 ${(historical.finalState.nation.institutions.effectivePolicyExecutionRate * 100).toFixed(1)}%、最高风险 ${historical.finalState.nation.institutions.highestRiskId} ${(historical.finalState.nation.institutions.highestRiskPressure * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "historical-timeline",
      "固定日期历史事件按年月唯一触发，条件型资格不绕过门槛",
      recordedScheduledEvents.length === scheduledHistoricalEvents.length &&
        scheduledHistoricalEvents.every((event) => historicalRecordIds.has(event.id)) &&
        historicalRecordIds.size === historicalRecords.length &&
        historicalRecordIds.has("foreign_assets_reorganization") &&
        historicalRecordIds.has("industry_wide_joint_ownership_1956"),
      `${recordedScheduledEvents.length}/${scheduledHistoricalEvents.length} 个固定日期事件已记录；联合国席位与世贸资格另按条件审计`,
    ),
    makeCheck(
      "historical-decisions",
      "历史事件可暂停并由玩家选择不同传导路线",
      pendingDecisionId === "industry_wide_joint_ownership_1956" &&
        decisionChoices.length === 3 &&
        decisionRecord?.choiceId === "preserve_mixed_ownership" &&
        decisionEngine.getState().nation.date.month === 1 &&
        foreignInvestmentMultipliers[0] === 0 &&
        foreignInvestmentMultipliers[1] === 0.65 &&
        foreignInvestmentMultipliers[2] === 0.9,
      `待决策事件 ${pendingDecisionId ?? "无"}，可选 ${decisionChoices.length} 个方案，记录方案 ${decisionRecord?.choiceName ?? "无"}；外资清理史实/渐进/监管保留比例 ${(foreignInvestmentMultipliers[0] * 100).toFixed(0)}%/${(foreignInvestmentMultipliers[1] * 100).toFixed(0)}%/${(foreignInvestmentMultipliers[2] * 100).toFixed(0)}%`,
    ),
    makeCheck(
      "historical-economic-milestones",
      "1978、1990、2000 年人民币、美元人均 GDP 与两类世界位次符合史实锚点",
      historicalMilestones.length === historicalMilestoneTargets.size &&
        historicalMilestones.every((snapshot) => {
          const target = historicalMilestoneTargets.get(snapshot.year);
          if (!target) return false;
          return Math.abs(
            snapshot.currentPriceGDPPerCapita -
              target.currentPriceGDPPerCapita,
          ) / target.currentPriceGDPPerCapita <= 0.03 &&
          Math.abs(
            snapshot.currentUSDGDPPerCapita -
              target.currentUSDGDPPerCapita,
          ) / target.currentUSDGDPPerCapita <= 0.03 &&
          snapshot.gdpRank === target.gdpRank &&
          (target.gdpPerCapitaRank === null ||
            snapshot.gdpPerCapitaRank === target.gdpPerCapitaRank) &&
          (target.participants === null ||
            snapshot.gdpPerCapitaRankParticipants === target.participants);
        }),
      historicalMilestones.map((snapshot) =>
        `${snapshot.year} 年 ${snapshot.currentPriceGDPPerCapita.toFixed(0)} 元/$${snapshot.currentUSDGDPPerCapita.toFixed(1)}，总量第 ${snapshot.gdpRank} 名、人均第 ${snapshot.gdpPerCapitaRank}/${snapshot.gdpPerCapitaRankParticipants}`
      ).join("；"),
    ),
    makeCheck(
      "historical-event-income-impact",
      "史实选择严格匹配现实锚点，更优历史决策按传导链产生显著累计收益",
      [1978, 1990, 2000].every((year) => {
        const strict = counterfactualSnapshot(strictCounterfactual, year);
        const baseline = historical.annual.find((snapshot) => snapshot.year === year);
        return baseline &&
          Math.abs(strict.currentUSDGDPPerCapita - baseline.currentUSDGDPPerCapita) <
            1e-6 &&
          strict.gdpPerCapitaRank === baseline.gdpPerCapitaRank;
      }) &&
        avoidedCampaigns1978.currentUSDGDPPerCapita >=
          strictHistorical1978.currentUSDGDPPerCapita * 1.22 &&
        avoidedCampaigns1978.gdpPerCapitaRank <=
          strictHistorical1978.gdpPerCapitaRank - 3 &&
        avoidedCulturalRevolution1978.currentUSDGDPPerCapita >=
          strictHistorical1978.currentUSDGDPPerCapita * 1.18 &&
        optimized1978.currentUSDGDPPerCapita >=
          strictHistorical1978.currentUSDGDPPerCapita * 1.55 &&
        optimized1990.currentUSDGDPPerCapita >=
          strictHistorical1990.currentUSDGDPPerCapita * 1.85 &&
        optimized2000.currentUSDGDPPerCapita >=
          strictHistorical2000.currentUSDGDPPerCapita * 1.55 &&
        optimized1978.educationIndex > strictHistorical1978.educationIndex &&
        optimized1990.technologyIndex > strictHistorical1990.technologyIndex,
      `1978 年史实/避免大跃进与公社化/避免文革/全部优化：$${strictHistorical1978.currentUSDGDPPerCapita.toFixed(1)}/$${avoidedCampaigns1978.currentUSDGDPPerCapita.toFixed(1)}/$${avoidedCulturalRevolution1978.currentUSDGDPPerCapita.toFixed(1)}/$${optimized1978.currentUSDGDPPerCapita.toFixed(1)}；全部优化路线 1990/2000 年为 $${optimized1990.currentUSDGDPPerCapita.toFixed(1)}/$${optimized2000.currentUSDGDPPerCapita.toFixed(1)}，分别为史实的 ${(optimized1990.currentUSDGDPPerCapita / strictHistorical1990.currentUSDGDPPerCapita).toFixed(2)} 倍/${(optimized2000.currentUSDGDPPerCapita / strictHistorical2000.currentUSDGDPPerCapita).toFixed(2)} 倍`,
    ),
    makeCheck(
      "counterfactual-growth-continuity",
      "避免重大人为冲击后，既有资本、人才与生产率存量跨越修正到期点继续增长",
      optimizedTransitionGrowth.every((item) => item.growth > 0),
      optimizedTransitionGrowth
        .map((item) => `${item.year} 年同比 ${(item.growth * 100).toFixed(1)}%`)
        .join("；"),
    ),
    makeCheck(
      "cultural-revolution-economic-impact",
      "文化大革命史实路线重现两年收缩、阶段恢复与长期教育创新损失",
      culturalRevolutionGrowthResults.every(
        (result) =>
          Math.abs(result.simulatedGrowth - result.growth) <=
          result.absoluteTolerance,
      ) &&
        avoidedCulturalRevolution1978.educationIndex >
          strictHistorical1978.educationIndex &&
        avoidedCulturalRevolution1990.technologyIndex >
          strictHistorical1990.technologyIndex &&
        avoidedCulturalRevolution1990.completedTechnologyCount >
          strictHistorical1990.completedTechnologyCount &&
        avoidedCulturalRevolution1990.industryTechnologyTier >=
          strictHistorical1990.industryTechnologyTier &&
        disruptedCulturalEducation.educationDisruptionMonths >= 120 &&
        disruptedCulturalEducation.researchCohortGap > 0.5 &&
        disruptedCulturalEducation.permanentResearchTalentLosses > 3_000 &&
        protectedCulturalEducation.educationDisruptionMonths === 0 &&
        protectedCulturalEducation.permanentResearchTalentLosses === 0,
      `${culturalRevolutionGrowthResults.map((result) => `${result.year} 年 ${(result.simulatedGrowth * 100).toFixed(1)}%（参考 ${(result.growth * 100).toFixed(1)}%）`).join("；")}；史实方案累计严重停招 ${disruptedCulturalEducation.educationDisruptionMonths} 个月、科研人才永久损失 ${disruptedCulturalEducation.permanentResearchTalentLosses.toFixed(0)}、15 年后人才代际缺口 ${(disruptedCulturalEducation.researchCohortGap * 100).toFixed(1)}%；保护制度路线对应为 ${protectedCulturalEducation.educationDisruptionMonths} 个月/${protectedCulturalEducation.permanentResearchTalentLosses.toFixed(0)}；避免文革后 1978 年教育指数 ${avoidedCulturalRevolution1978.educationIndex.toFixed(1)}，史实 ${strictHistorical1978.educationIndex.toFixed(1)}；1990 年科技指数 ${avoidedCulturalRevolution1990.technologyIndex.toFixed(1)}/${strictHistorical1990.technologyIndex.toFixed(1)}，完成科技节点 ${avoidedCulturalRevolution1990.completedTechnologyCount}/${strictHistorical1990.completedTechnologyCount}`,
    ),
    makeCheck(
      "historical-causality",
      "可阻止历史事件且前置决策会改变后续危机",
      preventedEvents.length === 2 &&
        causalEngine.getState().nation.pendingHistoricalEventId ===
          "three_year_difficulties_1959" &&
        causalChoices[0]?.durationMonths === 33 &&
        causalEngine.getState().nation.modifiers.some(
          (modifier) =>
            modifier.sourceId === "great_leap_forward_1958" &&
            modifier.target === "economy.structuralProductivityGrowth" &&
            modifier.operation === "add" &&
            modifier.value > 0,
        ),
      `已避免 ${preventedEvents.map((event) => event.name).join("、")}，三年经济困难由 48 个月降至 ${causalChoices[0]?.durationMonths ?? "未知"} 个月`,
    ),
    makeCheck(
      "foreign-aid-relief",
      "三年经济困难可接受外国援助以降低死亡与经济冲击",
      foreignAidCrisis.nation.population.monthlyDeaths <
          historicalCrisis.nation.population.monthlyDeaths &&
        foreignAidCrisis.nation.resources.foodSupplyRatio >
          historicalCrisis.nation.resources.foodSupplyRatio &&
        foreignAidCrisis.nation.economy.realGDP >
          historicalCrisis.nation.economy.realGDP &&
        foreignAidProviders.every((countryId) =>
          crisisRelation(foreignAidCrisis, countryId) >
            crisisRelation(historicalCrisis, countryId)
        ) &&
        Math.abs(
          crisisRelation(foreignAidCrisis, "japan") -
            crisisRelation(historicalCrisis, "japan"),
        ) < 1e-9 &&
        foreignAidFinalState.nation.date.year === 2027 &&
        foreignAidFinalState.nation.history.reports.length === 68 &&
        Number.isFinite(foreignAidFinalState.nation.economy.realGDP),
      `首月死亡人数由 ${historicalCrisis.nation.population.monthlyDeaths.toFixed(0)} 降至 ${foreignAidCrisis.nation.population.monthlyDeaths.toFixed(0)}，粮食供给率由 ${(historicalCrisis.nation.resources.foodSupplyRatio * 100).toFixed(1)}% 升至 ${(foreignAidCrisis.nation.resources.foodSupplyRatio * 100).toFixed(1)}%；苏联、加拿大、澳大利亚和美国关系均改善，无关的日本关系不变；援助路线生成 1959—2026 年 ${foreignAidFinalState.nation.history.reports.length} 个年度报告`,
    ),
    makeCheck(
      "grain-export-crisis-choices",
      "三年困难粮食贸易与救济两轴可组合，禁止出口与外援叠乘后粮食更优并保留用汇代价",
      limitedGrainCrisis.nation.resources.foodSupplyRatio >
          historicalCrisis.nation.resources.foodSupplyRatio &&
        domesticReliefCrisis.nation.resources.foodSupplyRatio >
          limitedGrainCrisis.nation.resources.foodSupplyRatio &&
        banGrainCrisis.nation.resources.foodSupplyRatio >
          domesticReliefCrisis.nation.resources.foodSupplyRatio &&
        foreignAidCrisis.nation.resources.foodSupplyRatio >
          banGrainCrisis.nation.resources.foodSupplyRatio &&
        banGrainWithAidCrisis.nation.resources.foodSupplyRatio >
          foreignAidCrisis.nation.resources.foodSupplyRatio &&
        banGrainWithAidCrisis.nation.population.monthlyDeaths <
          foreignAidCrisis.nation.population.monthlyDeaths &&
        banGrainWithAidCrisis.nation.trade.capitalGoodsImportCoverage <
          foreignAidCrisis.nation.trade.capitalGoodsImportCoverage &&
        crisisRelation(banGrainWithAidCrisis, "russia") >
          crisisRelation(banGrainCrisis, "russia") &&
        crisisRelation(banGrainWithAidCrisis, "canada") >
          crisisRelation(foreignAidCrisis, "canada") &&
        banGrainCrisis.nation.population.monthlyDeaths <
          limitedGrainCrisis.nation.population.monthlyDeaths &&
        limitedGrainCrisis.nation.population.monthlyDeaths <
          historicalCrisis.nation.population.monthlyDeaths &&
        banGrainCrisis.nation.trade.capitalGoodsImportCoverage <
          historicalCrisis.nation.trade.capitalGoodsImportCoverage &&
        crisisRelation(banGrainCrisis, "canada") >
          crisisRelation(historicalCrisis, "canada") &&
        crisisRelation(banGrainCrisis, "australia") >
          crisisRelation(historicalCrisis, "australia"),
      `粮食供给率 史实/限制出口/国内赈济/禁止并进口/外援/禁出口+外援 ${(historicalCrisis.nation.resources.foodSupplyRatio * 100).toFixed(1)}%/${(limitedGrainCrisis.nation.resources.foodSupplyRatio * 100).toFixed(1)}%/${(domesticReliefCrisis.nation.resources.foodSupplyRatio * 100).toFixed(1)}%/${(banGrainCrisis.nation.resources.foodSupplyRatio * 100).toFixed(1)}%/${(foreignAidCrisis.nation.resources.foodSupplyRatio * 100).toFixed(1)}%/${(banGrainWithAidCrisis.nation.resources.foodSupplyRatio * 100).toFixed(1)}%；禁出口+外援仍保留资本品用汇代价 ${(banGrainWithAidCrisis.nation.trade.capitalGoodsImportCoverage * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "korean-war-branching",
      "朝鲜战争形成约十四点五亿美元军事外债；事前劝阻开战释放外汇与民用资本并改善外交",
      koreanWarState.nation.population.monthlyDeaths >
          preventedWarState.nation.population.monthlyDeaths &&
        koreanWarState.nation.fiscal.expenditure >
          preventedWarState.nation.fiscal.expenditure &&
        koreanWarState.nation.sectors.secondary.output >
          preventedWarState.nation.sectors.secondary.output &&
        koreanWarUsRelation < preventedWarUsRelation &&
        koreanWarRussiaRelation > preventedWarRussiaRelation &&
        koreanWarSouthKoreaRelation < -30 &&
        preventedWarSouthKoreaRelation > -28 &&
        preventedWarSouthKoreaRelation > koreanWarSouthKoreaRelation &&
        koreanWarWesternCountryIds.every(
          (countryId) =>
            relationFor(preventedWarDiplomacyState, countryId) >
            relationFor(koreanWarDiplomacyState, countryId),
        ) &&
        preventedWarWesternAverage >= 25 &&
        preventedWarWesternAverage - koreanWarWesternAverage >= 35 &&
        relationFor(preventedWarDiplomacyState, "south_korea") >= 40 &&
        relationFor(preventedWarDiplomacyState, "south_korea") -
          relationFor(koreanWarDiplomacyState, "south_korea") >= 100 &&
        koreanWarDebtState.nation.trade.externalDebt >= 14_000_000_000 &&
        koreanWarDebtState.nation.trade.externalDebt <= 15_000_000_000 &&
        preventedWarState.nation.trade.externalDebt === 0 &&
        preventedWarState.nation.trade.capitalGoodsImportCoverage >
          koreanWarState.nation.trade.capitalGoodsImportCoverage &&
        preventedWarDevelopmentState.nation.economy.capitalStock >
          koreanWarDevelopmentState.nation.economy.capitalStock &&
        preventedWarRecord?.outcome === "prevented" &&
        preventedWarFinalState.nation.date.year === 2027 &&
        preventedWarFinalState.nation.history.reports.length === 77,
      `参战 37 个月后军事外债 ${(koreanWarDebtState.nation.trade.externalDebt / 100_000_000).toFixed(2)} 亿美元，阻止路线为 0；参战/阻止首月资本品用汇满足率 ${(koreanWarState.nation.trade.capitalGoodsImportCoverage * 100).toFixed(1)}%/${(preventedWarState.nation.trade.capitalGoodsImportCoverage * 100).toFixed(1)}%，五年后资本存量 ${koreanWarDevelopmentState.nation.economy.capitalStock.toFixed(0)}/${preventedWarDevelopmentState.nation.economy.capitalStock.toFixed(0)}；首月对韩关系 ${koreanWarSouthKoreaRelation.toFixed(2)}/${preventedWarSouthKoreaRelation.toFixed(2)}，七年后对韩关系 ${relationFor(koreanWarDiplomacyState, "south_korea").toFixed(2)}/${relationFor(preventedWarDiplomacyState, "south_korea").toFixed(2)}、西方六国平均 ${koreanWarWesternAverage.toFixed(2)}/${preventedWarWesternAverage.toFixed(2)}`,
    ),
    makeCheck(
      "third-front-branching",
      "三线建设可选择史实、集中建设或取消，并形成安全与经济效率取舍",
      historicalThirdFront.nation.diplomacy.securityIndex >
          focusedThirdFront.nation.diplomacy.securityIndex &&
        focusedThirdFront.nation.diplomacy.securityIndex >
          canceledThirdFront.nation.diplomacy.securityIndex &&
        canceledThirdFront.nation.economy.infrastructureIndex >
          historicalThirdFront.nation.economy.infrastructureIndex &&
        historicalThirdFront.nation.fiscal.expenditure /
            historicalThirdFront.nation.economy.nominalGDP >
          canceledThirdFront.nation.fiscal.expenditure /
            canceledThirdFront.nation.economy.nominalGDP &&
        historicalThirdFront.nation.sectors.tertiary.output <
          canceledThirdFront.nation.sectors.tertiary.output &&
        historicalThirdFront.nation.economy.institutionalEfficiency <
          canceledThirdFront.nation.economy.institutionalEfficiency &&
        canceledThirdFrontRecord?.outcome === "prevented",
      `史实/集中/取消安全指数 ${historicalThirdFront.nation.diplomacy.securityIndex.toFixed(1)}/${focusedThirdFront.nation.diplomacy.securityIndex.toFixed(1)}/${canceledThirdFront.nation.diplomacy.securityIndex.toFixed(1)}；史实/取消基建指数 ${historicalThirdFront.nation.economy.infrastructureIndex.toFixed(2)}/${canceledThirdFront.nation.economy.infrastructureIndex.toFixed(2)}，服务业产出 ${historicalThirdFront.nation.sectors.tertiary.output.toFixed(0)}/${canceledThirdFront.nation.sectors.tertiary.output.toFixed(0)}`,
    ),
    makeCheck(
      "historical-initiatives",
      "适合主动推动的历史转折可提前实施，战争危机与组织资格保持事件化",
      historicalInitiativeDefinitions.length === 17 &&
        new Set(initiativeEventIds).size === historicalInitiativeDefinitions.length &&
        excludedInitiativeEvents.every((eventId) => !initiativeEventIds.includes(eventId)) &&
        auditedEarlyInitiativeEvents.every((eventId) =>
          earlyRecords.some((record) => record.id === eventId)
        ) &&
        earlyRecords.every((record) =>
          record.year < record.scheduledYear && record.outcome === "enacted_early"
        ),
      `共${historicalInitiativeDefinitions.length}项主动国策；审计链路：${earlyRecords.map((record) =>
        `${record.name}提前至${record.year}年（史实${record.scheduledYear}年）`
      ).join("；")}`,
    ),
    makeCheck(
      "relationship-triggered-organizations",
      "联合国席位和世界贸易组织在历史进程与国际关系条件达成后自动触发",
      unSupportEngine.getState().nation.diplomacy.organizationIds.includes(
        "united_nations",
      ) &&
        wtoSupportEngine.getState().nation.diplomacy.organizationIds.includes(
          "world_trade_organization",
        ) &&
        supportTriggeredRecords.every(
          (record) => record?.outcome === "enacted_early" &&
            record.year < record.scheduledYear,
        ),
      supportTriggeredRecords.map((record) =>
        `${record?.name ?? "未知"}于${record?.year ?? "未知"}年提前触发`
      ).join("；"),
    ),
    makeCheck(
      "industrial-tradeoff",
      "工业优先存在产业与民生取舍",
      industrialSummary.secondarySectorShare > historicalSummary.secondarySectorShare + 0.1 &&
        industrialSummary.happinessIndex < historicalSummary.happinessIndex &&
        industrialSummary.lifeExpectancy < historicalSummary.lifeExpectancy,
      `二产占比 ${(industrialSummary.secondarySectorShare * 100).toFixed(1)}%，幸福度 ${industrialSummary.happinessIndex.toFixed(1)}`,
    ),
    makeCheck(
      "livelihood-tradeoff",
      "民生优先改善健康幸福但牺牲增长",
      livelihoodSummary.lifeExpectancy > historicalSummary.lifeExpectancy &&
        livelihoodSummary.happinessIndex > historicalSummary.happinessIndex &&
        livelihoodSummary.finalGDP < historicalSummary.finalGDP,
      `寿命 ${livelihoodSummary.lifeExpectancy.toFixed(1)}，幸福度 ${livelihoodSummary.happinessIndex.toFixed(1)}`,
    ),
    makeCheck(
      "education-lag",
      "教育科技路线体现前期投入与中后期加速",
      education1970.realGDP < historical1970.realGDP &&
        education1990.technologyIndex > historical1990.technologyIndex &&
        educationAcceleration > historicalAcceleration,
      `1970 GDP 为历史路线的 ${(education1970.realGDP / historical1970.realGDP * 100).toFixed(1)}%，1970—1990 增长倍数 ${educationAcceleration.toFixed(2)}`,
    ),
    makeCheck(
      "debt-feedback",
      "极端举债形成债务、通胀和利率负反馈",
      debtSummary.debtToGDP > 0.8 &&
        debtSummary.inflationRate > 0.2 &&
        debtSummary.debtInterestRate > 0.1 &&
        debtSummary.finalScore < historicalSummary.finalScore,
      `债务率 ${(debtSummary.debtToGDP * 100).toFixed(1)}%，通胀 ${(debtSummary.inflationRate * 100).toFixed(1)}%，利率 ${(debtSummary.debtInterestRate * 100).toFixed(1)}%`,
    ),
    makeCheck(
      "no-operation",
      "无操作路线可运行但不是最优",
      noneSummary.finalScore < Math.max(...summaries.map((item) => item.finalScore)),
      `无操作评分 ${noneSummary.finalScore.toFixed(2)}，最高 ${Math.max(...summaries.map((item) => item.finalScore)).toFixed(2)}`,
    ),
    makeCheck(
      "random-events",
      "状态相关随机事件进入年度报告",
      historicalSummary.eventYears > 0,
      `历史路线共有 ${historicalSummary.eventYears} 个年份记录重大事件`,
    ),
    makeCheck(
      "dynamic-ranking",
      "世界排名随发展动态变化",
      distinctRanks.size > 1,
      `历史路线经过 ${[...distinctRanks].sort((a, b) => b - a).join("→")} 名`,
    ),
    makeCheck(
      "save-continuity",
      "存档导入后继续运行与不中断运行一致",
      JSON.stringify(continued.exportState()) === JSON.stringify(direct.exportState()),
      "导入后继续 24 个月的完整状态逐值一致",
    ),
    makeCheck(
      "multi-seed-uncertainty",
      "多种子区间按固定分位算法汇总且不受批次顺序影响",
      uncertainty.sampleCount === 4 &&
        JSON.stringify(uncertainty) === JSON.stringify(reversedUncertainty) &&
        Object.values(uncertainty.metrics).every((metric) =>
          metric.minimum <= metric.p10 &&
          metric.p10 <= metric.median &&
          metric.median <= metric.p90 &&
          metric.p90 <= metric.maximum &&
          Number.isFinite(metric.coefficientOfVariation)
        ),
      `种子 ${uncertainty.seeds.join("、")}；2026 年实际 GDP P10/P50/P90=${uncertainty.metrics.realGDP.p10.toFixed(0)}/${uncertainty.metrics.realGDP.median.toFixed(0)}/${uncertainty.metrics.realGDP.p90.toFixed(0)}`,
    ),
    makeCheck(
      "automatic-calibration-guardrail",
      "有界自动校准候选搜索可重复且不恶化目标函数",
      calibrationSearchAudit.bestLoss <= calibrationSearchAudit.initialLoss &&
        calibrationSearchAudit.parameters.outputScale === 1.04 &&
        calibrationSearchAudit.parameters.populationScale === 0.97,
      `目标损失 ${calibrationSearchAudit.initialLoss.toExponential(3)}→${calibrationSearchAudit.bestLoss.toExponential(3)}，共评估 ${calibrationSearchAudit.evaluations} 个候选`,
    ),
    makeCheck(
      "full-model-integrity",
      "全部策略通过统一的细分账户完整性检查",
      integrityReports.every((report) => report.status === "通过"),
      `${integrityReports.reduce((sum, report) => sum + report.passed, 0)}/${integrityReports.reduce((sum, report) => sum + report.total, 0)} 个策略账户检查通过；最大相对误差 ${Math.max(...integrityReports.map((report) => report.maximumRelativeError)).toExponential(2)}`,
    ),
    makeCheck(
      "core-isolation",
      "模拟核心不依赖 React 或 DOM",
      uiDependencies.length === 0,
      uiDependencies.length === 0 ? "未发现 UI 依赖" : `发现 ${uiDependencies.length} 个依赖文件`,
    ),
    makeCheck(
      "seeded-random-only",
      "模拟核心未使用 Math.random",
      forbiddenRandom.length === 0,
      forbiddenRandom.length === 0 ? "仅使用可序列化确定性随机数" : `发现 ${forbiddenRandom.length} 个违规文件`,
    ),
  ];

  return {
    status: checks.every((check) => check.passed) ? "通过" : "失败",
    generatedAt: new Date().toISOString(),
    seed,
    period: "1949—2026",
    checks,
    strategies: summaries,
    uncertainty,
  };
}
