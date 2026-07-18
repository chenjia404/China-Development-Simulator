import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  calculateTradeAccess,
  createSimulationEngine,
  createInitialGameState,
  historicalEventDefinitions,
  getHistoricalEventChoices,
  deserializeGameState,
  serializeGameState,
} from "../../src/simulation/index";
import { compareWithTargets, summarizeCalibration } from "../baseline-calibration/calibration";
import { runSimulation, type SimulationRunResult } from "../baseline-calibration/runner";
import { strategyIds, type StrategyId } from "../baseline-calibration/strategies";

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
  const summaries = strategyIds.map((strategy) => summary(runs.get(strategy)!));
  const byStrategy = new Map(summaries.map((item) => [item.strategy, item]));
  const historicalSummary = byStrategy.get("historical")!;
  const industrialSummary = byStrategy.get("industrial")!;
  const livelihoodSummary = byStrategy.get("livelihood")!;
  const debtSummary = byStrategy.get("debt")!;
  const noneSummary = byStrategy.get("none")!;

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

  const checks: AuditCheck[] = [
    makeCheck(
      "continuous-run",
      "六种策略均连续运行 1949—2026",
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
      `六条路线产生 ${distinctGDP.size} 个不同的最终 GDP 数量级结果`,
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
      "diplomacy-trade-link",
      "协定和制裁对国际贸易形成双向反馈",
      agreementAccess > neutralAccess && sanctionedAccess < neutralAccess,
      `中性 ${neutralAccess.toFixed(3)}，贸易协定 ${agreementAccess.toFixed(3)}，制裁 ${sanctionedAccess.toFixed(3)}`,
    ),
    makeCheck(
      "historical-timeline",
      "详细历史事件按年月唯一触发并进入年表",
      historicalRecords.length === historicalEventDefinitions.length &&
        historicalRecordIds.size === historicalRecords.length &&
        historicalRecordIds.has("foreign_assets_reorganization") &&
        historicalRecordIds.has("industry_wide_joint_ownership_1956"),
      `${historicalRecords.length}/${historicalEventDefinitions.length} 个事件已记录，包含外资清理与全行业公私合营`,
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
