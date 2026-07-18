import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  calculateGDP,
  calculateTradeAccess,
  createSimulationEngine,
  createInitialGameState,
  historicalEventDefinitions,
  historicalInitiativeDefinitions,
  enactHistoricalEventEarly,
  getHistoricalEventChoices,
  remittanceDirectedInvestment,
  deserializeGameState,
  diplomaticStrategyEffects,
  serializeGameState,
  updateForeignExchange,
} from "../../src/simulation/index";
import { compareWithTargets, summarizeCalibration } from "../baseline-calibration/calibration";
import { runSimulation, type SimulationRunResult } from "../baseline-calibration/runner";
import {
  getAnnualDecision,
  strategyIds,
  type StrategyId,
} from "../baseline-calibration/strategies";
import koreanCatchUpTargets from "../../src/data/config/korean-catch-up-targets.json";

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
  educationIndex: number;
  technologyIndex: number;
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
    educationIndex: nation.education.index,
    technologyIndex: nation.technology.index,
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

  const duplicate = runSimulation({ strategy: "historical", seed, startYear: 1949, endYear: 2026 });
  const calibration = summarizeCalibration(compareWithTargets(historical.annual));
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
          engine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
          const pendingEventId = engine.getState().nation.pendingHistoricalEventId;
          if (pendingEventId) {
            engine.dispatch({
              type: "RESOLVE_HISTORICAL_EVENT",
              eventId: pendingEventId,
              choiceId: choices[pendingEventId] ?? "historical_path",
            });
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
    ...campaignChoices,
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
  const optimized1990 = counterfactualSnapshot(optimizedHistoricalRoute, 1990);
  const strictHistorical2000 = counterfactualSnapshot(strictCounterfactual, 2000);
  const optimized2000 = counterfactualSnapshot(optimizedHistoricalRoute, 2000);

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
    initiativeId: "early_reform_and_opening",
  });
  initiativePreparation.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_joint_venture_law",
  });
  const observerState = initiativePreparation.exportState();
  observerState.nation.date.year = 1979;
  observerState.nation.date.month = 1;
  observerState.nation.date.elapsedMonths = (1979 - 1949) * 12;
  observerState.nation.economy.institutionalEfficiency = 0.5;
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
  applicationState.nation.date.year = 1982;
  applicationState.nation.date.month = 1;
  applicationState.nation.date.elapsedMonths = (1982 - 1949) * 12;
  applicationState.world.countries[1].tradeAgreement = true;
  const applicationEngine = createSimulationEngine(applicationState);
  applicationEngine.dispatch({
    type: "ENACT_HISTORICAL_INITIATIVE",
    initiativeId: "early_gatt_accession_application",
  });
  const earlyRecords = applicationEngine.getState().nation.history.historicalEvents
    .filter((event) => event.outcome === "enacted_early");

  const unSupportState = createInitialGameState(seed, 1965);
  unSupportState.nation.diplomacy.diplomaticPoints = 100;
  for (const country of unSupportState.world.countries) {
    country.relationWithChina = 25;
  }
  const unSupportEngine = createSimulationEngine(unSupportState);
  unSupportEngine.dispatch({ type: "ADVANCE_MONTHS", months: 1 });
  const wtoSupportState = createInitialGameState(seed, 1986);
  enactHistoricalEventEarly(
    wtoSupportState.nation,
    "gatt_accession_application_1986",
    "audit:gatt-application",
    "审计复关进程前置条件",
    [],
  );
  wtoSupportState.nation.date.year = 1995;
  wtoSupportState.nation.date.month = 1;
  wtoSupportState.nation.date.elapsedMonths = (1995 - 1949) * 12;
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

  const checks: AuditCheck[] = [
    makeCheck(
      "continuous-run",
      "七种策略均连续运行 1949—2026",
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
      "korean-catch-up",
      "韩国式追赶路线通过资本、技能、出口学习和产业升级进入韩国收入数量级",
      koreanCatchUp2000.currentUSDGDPPerCapita >=
          koreanTarget2000.currentUSDGDPPerCapita * 0.85 &&
        koreanCatchUp2000.currentUSDGDPPerCapita <=
          koreanTarget2000.currentUSDGDPPerCapita * 1.15 &&
        koreanCatchUp2000.educationIndex > 75 &&
        koreanCatchUp2000.secondarySectorShare > 0.4 &&
        koreanCatchUp.finalState.nation.trade.exports /
            koreanCatchUp.finalState.nation.economy.nominalGDP <=
          0.551,
      `2000 年中国追赶路线 $${koreanCatchUp2000.currentUSDGDPPerCapita.toFixed(1)}，韩国参考 $${koreanTarget2000.currentUSDGDPPerCapita.toFixed(1)}；教育指数 ${koreanCatchUp2000.educationIndex.toFixed(1)}，二产占比 ${(koreanCatchUp2000.secondarySectorShare * 100).toFixed(1)}%`,
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
        decisionEngine.getState().nation.date.month === 1,
      `待决策事件 ${pendingDecisionId ?? "无"}，可选 ${decisionChoices.length} 个方案，记录方案 ${decisionRecord?.choiceName ?? "无"}`,
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
            1e-9 &&
          strict.gdpPerCapitaRank === baseline.gdpPerCapitaRank;
      }) &&
        avoidedCampaigns1978.currentUSDGDPPerCapita >=
          strictHistorical1978.currentUSDGDPPerCapita * 1.4 &&
        avoidedCampaigns1978.gdpPerCapitaRank <=
          strictHistorical1978.gdpPerCapitaRank - 5 &&
        avoidedCulturalRevolution1978.currentUSDGDPPerCapita >=
          strictHistorical1978.currentUSDGDPPerCapita * 1.25 &&
        optimized1978.currentUSDGDPPerCapita >=
          strictHistorical1978.currentUSDGDPPerCapita * 1.8 &&
        optimized1990.currentUSDGDPPerCapita >=
          strictHistorical1990.currentUSDGDPPerCapita * 1.85 &&
        optimized2000.currentUSDGDPPerCapita >=
          strictHistorical2000.currentUSDGDPPerCapita * 1.55 &&
        optimized1978.educationIndex > strictHistorical1978.educationIndex &&
        optimized1990.technologyIndex > strictHistorical1990.technologyIndex,
      `1978 年史实/避免大跃进与公社化/避免文革/全部优化：$${strictHistorical1978.currentUSDGDPPerCapita.toFixed(1)}/$${avoidedCampaigns1978.currentUSDGDPPerCapita.toFixed(1)}/$${avoidedCulturalRevolution1978.currentUSDGDPPerCapita.toFixed(1)}/$${optimized1978.currentUSDGDPPerCapita.toFixed(1)}；全部优化路线 1990/2000 年为 $${optimized1990.currentUSDGDPPerCapita.toFixed(1)}/$${optimized2000.currentUSDGDPPerCapita.toFixed(1)}，分别为史实的 ${(optimized1990.currentUSDGDPPerCapita / strictHistorical1990.currentUSDGDPPerCapita).toFixed(2)} 倍/${(optimized2000.currentUSDGDPPerCapita / strictHistorical2000.currentUSDGDPPerCapita).toFixed(2)} 倍`,
    ),
    makeCheck(
      "historical-causality",
      "可阻止历史事件且前置决策会改变后续危机",
      preventedEvents.length === 2 &&
        causalEngine.getState().nation.pendingHistoricalEventId ===
          "three_year_difficulties_1959" &&
        causalChoices[0]?.durationMonths === 24 &&
        causalEngine.getState().nation.modifiers.some(
          (modifier) =>
            modifier.sourceId === "great_leap_forward_1958" &&
            modifier.target === "sector.primary.output" &&
            modifier.operation === "multiply" &&
            modifier.value > 1,
        ),
      `已避免 ${preventedEvents.map((event) => event.name).join("、")}，三年经济困难由 36 个月降至 ${causalChoices[0]?.durationMonths ?? "未知"} 个月`,
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
      "korean-war-branching",
      "朝鲜战争可被阻止，发生后会传导人口、财政、产业与外交影响",
      koreanWarState.nation.population.monthlyDeaths >
          preventedWarState.nation.population.monthlyDeaths &&
        koreanWarState.nation.fiscal.expenditure >
          preventedWarState.nation.fiscal.expenditure &&
        koreanWarState.nation.sectors.secondary.output >
          preventedWarState.nation.sectors.secondary.output &&
        koreanWarUsRelation < preventedWarUsRelation &&
        koreanWarRussiaRelation > preventedWarRussiaRelation &&
        koreanWarSouthKoreaRelation < -30 &&
        preventedWarSouthKoreaRelation > -30 &&
        preventedWarSouthKoreaRelation > koreanWarSouthKoreaRelation &&
        preventedWarRecord?.outcome === "prevented" &&
        preventedWarFinalState.nation.date.year === 2027 &&
        preventedWarFinalState.nation.history.reports.length === 77,
      `参战/阻止首月死亡 ${koreanWarState.nation.population.monthlyDeaths.toFixed(0)}/${preventedWarState.nation.population.monthlyDeaths.toFixed(0)}，对韩关系 ${koreanWarSouthKoreaRelation.toFixed(2)}/${preventedWarSouthKoreaRelation.toFixed(2)}，阻止路线生成 1950—2026 年 ${preventedWarFinalState.nation.history.reports.length} 个年度报告`,
    ),
    makeCheck(
      "third-front-branching",
      "三线建设可选择史实、集中建设或取消，并形成安全与经济效率取舍",
      historicalThirdFront.nation.diplomacy.securityIndex >
          focusedThirdFront.nation.diplomacy.securityIndex &&
        focusedThirdFront.nation.diplomacy.securityIndex >
          canceledThirdFront.nation.diplomacy.securityIndex &&
        historicalThirdFront.nation.economy.infrastructureIndex >
          canceledThirdFront.nation.economy.infrastructureIndex &&
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
      "关键历史转折可在满足国内外条件后作为一次性国策提前实施",
      earlyRecords.length === historicalInitiativeDefinitions.length &&
        earlyRecords.every((record) =>
          record.year < record.scheduledYear && record.outcome === "enacted_early"
        ),
      earlyRecords.map((record) =>
        `${record.name}提前至${record.year}年（史实${record.scheduledYear}年）`
      ).join("；"),
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
  };
}
