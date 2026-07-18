"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ECharts } from "echarts/core";
import type {
  AnnualSnapshot,
  ComparisonTargetId,
  DiplomaticActionId,
  DiplomaticStrategyId,
  FiscalBudget,
  GameState,
  TargetComparisonMetric,
} from "@/src/simulation";
import {
  averageInternationalRelation,
  developmentRouteBlueprints,
  diplomaticActionDefinitions,
  diplomaticStrategyCooldownRemaining,
  diplomaticStrategyDefinitions,
  diplomaticStrategyEffects,
  getInternationalOrganizationStatus,
  internationalOrganizations,
  getHistoricalEvent,
  getHistoricalEventChoices,
  getHistoricalInitiativeStatus,
  historicalEventDefinitions,
  historicalInitiativeDefinitions,
  isComparisonTargetId,
  maximumActivePolicies,
  nationalPolicyDefinitions,
  calculateTechnologyTreeMetrics,
  compareSimulationWithTarget,
  comparisonTargetOptions,
  getTechnologyNode,
  technologyResearchRequirements,
  technologyTreeDefinitions,
} from "@/src/simulation";
import {
  type SectionId,
  useSimulationStore,
} from "@/src/ui/simulation-store";

const menuItems: Array<{ id: SectionId; label: string; mark: string }> = [
  { id: "nation", label: "国家总览", mark: "国" },
  { id: "economy", label: "经济", mark: "经" },
  { id: "fiscal", label: "财政", mark: "财" },
  { id: "population", label: "人口", mark: "人" },
  { id: "education", label: "教育", mark: "教" },
  { id: "technology", label: "科技", mark: "科" },
  { id: "agriculture", label: "农业", mark: "农" },
  { id: "industry", label: "工业", mark: "工" },
  { id: "infrastructure", label: "基础设施", mark: "基" },
  { id: "policies", label: "国策中心", mark: "策" },
  { id: "diplomacy", label: "外交事务", mark: "外" },
  { id: "history", label: "历史事件", mark: "史" },
  { id: "international", label: "国际", mark: "世" },
  { id: "statistics", label: "统计", mark: "统" },
  { id: "settings", label: "设置", mark: "设" },
];

const budgetLabels: Record<keyof FiscalBudget, string> = {
  education: "教育",
  health: "医疗",
  agriculture: "农业",
  industry: "工业",
  infrastructure: "基础设施",
  research: "科研",
  housing: "住房",
  welfare: "社会保障",
  defense: "国防",
  administration: "行政",
};

function formatLarge(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1e12) return `${(value / 1e12).toFixed(2)}万亿`;
  if (absolute >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (absolute >= 1e4) return `${(value / 1e4).toFixed(1)}万`;
  return value.toFixed(0);
}

function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function MetricCard({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "blue" | "red" | "gold" | "green";
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-label"><span className="metric-dot" />{label}</div>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

function ComparisonTargetSelector({
  value,
  onChange,
}: {
  value: ComparisonTargetId;
  onChange: (value: ComparisonTargetId) => void;
}) {
  return (
    <label className="comparison-selector">
      <span>目标对象</span>
      <select
        aria-label="选择经济对比目标"
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          if (isComparisonTargetId(nextValue)) onChange(nextValue);
        }}
      >
        {comparisonTargetOptions.map((target) => (
          <option value={target.id} key={target.id}>
            {target.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function HistoryChart({ annual, darkMode }: { annual: AnnualSnapshot[]; darkMode: boolean }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || annual.length === 0) return;
    const element = chartRef.current;
    let chart: ECharts | undefined;
    let cancelled = false;
    const observer = new ResizeObserver(() => chart?.resize());
    observer.observe(element);
    void import("@/src/ui/chart-runtime").then(({ createChart }) => {
      if (cancelled) return;
      chart = createChart(element);
      const textColor = darkMode ? "#9cadc8" : "#68758a";
      const gridColor = darkMode ? "#26324a" : "#e8edf5";
      chart.setOption({
      animationDuration: 450,
      tooltip: { trigger: "axis", valueFormatter: (value: unknown) => formatLarge(Number(value)) },
      legend: { data: ["实际 GDP", "人口", "科技指数"], top: 0, textStyle: { color: textColor } },
      grid: { left: 62, right: 58, top: 42, bottom: 36 },
      xAxis: {
        type: "category",
        data: annual.map((item) => item.year),
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor },
      },
      yAxis: [
        { type: "value", axisLabel: { color: textColor, formatter: (value: number) => formatLarge(value) }, splitLine: { lineStyle: { color: gridColor } } },
        { type: "value", min: 0, max: 100, axisLabel: { color: textColor }, splitLine: { show: false } },
      ],
      series: [
        { name: "实际 GDP", type: "line", smooth: 0.28, showSymbol: false, data: annual.map((item) => item.realGDP), lineStyle: { width: 3, color: "#2563eb" }, areaStyle: { color: "rgba(37,99,235,.09)" } },
        { name: "人口", type: "line", smooth: true, showSymbol: false, data: annual.map((item) => item.population), lineStyle: { width: 2, color: "#d84444" } },
        { name: "科技指数", type: "line", yAxisIndex: 1, smooth: true, showSymbol: false, data: annual.map((item) => item.technologyIndex), lineStyle: { width: 2, color: "#d39b23" } },
      ],
      });
    });
    return () => {
      cancelled = true;
      observer.disconnect();
      chart?.dispose();
    };
  }, [annual, darkMode]);

  if (annual.length === 0) {
    return <div className="chart-empty">推进一年后，这里将显示长期发展曲线。</div>;
  }
  return <div ref={chartRef} className="history-chart" aria-label="国家长期发展曲线" />;
}

function BudgetPanel({ game, busy }: { game: GameState; busy: boolean }) {
  const updateBudget = useSimulationStore((store) => store.updateBudget);
  const entries = Object.entries(game.nation.fiscal.budget) as Array<
    [keyof FiscalBudget, number]
  >;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <section className="panel budget-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">年度决策</span><h2>财政预算结构</h2></div>
        <span className="budget-total">合计 {formatPercent(total, 0)}</span>
      </div>
      <div className="budget-list">
        {entries.map(([key, value]) => (
          <label className="budget-row" key={key}>
            <span>{budgetLabels[key]}</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.005"
              value={value}
              disabled={busy}
              onChange={(event) => void updateBudget(key, Number(event.target.value))}
            />
            <strong>{formatPercent(value, 1)}</strong>
          </label>
        ))}
      </div>
      <p className="panel-note">预算改变系统投入能力，效果通过资本、人才和公共服务逐月释放，不会直接增加 GDP。</p>
    </section>
  );
}

function OverviewComparison({ annual }: { annual: AnnualSnapshot[] }) {
  const [targetId, setTargetId] = useState<ComparisonTargetId>("history");
  const setActiveSection = useSimulationStore(
    (store) => store.setActiveSection,
  );
  const comparison = useMemo(
    () => compareSimulationWithTarget(annual, targetId),
    [annual, targetId],
  );
  const latest = comparison.rows.at(-1);
  const usesUSD = comparison.valueBasis === "current_usd";
  const currency = usesUSD ? "$" : "";
  const differenceTone = (value: number) =>
    value > 0.0005 ? "is-above" : value < -0.0005 ? "is-below" : "is-matched";
  const differenceLabel = (value: number) =>
    `${value >= 0 ? "+" : ""}${formatPercent(value)}`;
  const rankLabel = latest?.gdpRank
    ? latest.gdpRank.difference === 0
      ? "位次一致"
      : latest.gdpRank.difference < 0
        ? `领先 ${Math.abs(latest.gdpRank.difference)} 位`
        : `落后 ${latest.gdpRank.difference} 位`
    : "暂无排名锚点";

  return (
    <section className="panel overview-comparison-panel">
      <div className="overview-comparison-heading">
        <div>
          <span className="eyebrow">首页发展对比</span>
          <h2>本局与{comparison.targetLabel}</h2>
          <p>{latest ? `${latest.year} 年最新可比数据` : "尚未到达可比年份"}</p>
        </div>
        <ComparisonTargetSelector value={targetId} onChange={setTargetId} />
      </div>
      {latest ? (
        <div className="overview-comparison-grid">
          <div>
            <span>{usesUSD ? "GDP（现价美元）" : "实际 GDP"}</span>
            <strong>{currency}{formatLarge(latest.gdp.simulated)}</strong>
            <small className={differenceTone(latest.gdp.relativeDifference)}>
              {comparison.targetLabel} {currency}{formatLarge(latest.gdp.target)} · {differenceLabel(latest.gdp.relativeDifference)}
            </small>
          </div>
          <div>
            <span>{usesUSD ? "人均 GDP（美元）" : "人均 GDP"}</span>
            <strong>{currency}{formatLarge(latest.gdpPerCapita.simulated)}</strong>
            <small className={differenceTone(latest.gdpPerCapita.relativeDifference)}>
              {comparison.targetLabel} {currency}{formatLarge(latest.gdpPerCapita.target)} · {differenceLabel(latest.gdpPerCapita.relativeDifference)}
            </small>
          </div>
          <div>
            <span>总人口</span>
            <strong>{formatLarge(latest.population.simulated)}</strong>
            <small>
              {comparison.targetLabel} {formatLarge(latest.population.target)} · {differenceLabel(latest.population.relativeDifference)}
            </small>
          </div>
          <div>
            <span>世界经济排名</span>
            <strong>{latest.gdpRank ? `第 ${latest.gdpRank.simulated} 名` : "—"}</strong>
            <small className={latest.gdpRank
              ? latest.gdpRank.difference < 0
                ? "is-above"
                : latest.gdpRank.difference > 0
                  ? "is-below"
                  : "is-matched"
              : undefined}
            >
              {latest.gdpRank
                ? `${comparison.targetLabel}第 ${latest.gdpRank.target} 名 · ${rankLabel}`
                : rankLabel}
            </small>
          </div>
        </div>
      ) : (
        <p className="overview-comparison-empty">
          推进到 1960 年后即可与{comparison.targetLabel}比较。
        </p>
      )}
      <button
        className="overview-comparison-link"
        onClick={() => setActiveSection("statistics")}
      >
        查看完整年度对比
      </button>
    </section>
  );
}

function Overview({ game, darkMode, busy }: { game: GameState; darkMode: boolean; busy: boolean }) {
  const nation = game.nation;
  const lastAnnual = nation.history.annual.at(-1);
  const previousAnnual = nation.history.annual.at(-2);
  const growth = previousAnnual && lastAnnual
    ? lastAnnual.realGDP / previousAnnual.realGDP - 1
    : nation.economy.annualRealGDPGrowth;

  return (
    <>
      <div className="metrics-grid">
        <MetricCard
          label="实际 GDP"
          value={formatLarge(nation.economy.realGDP)}
          detail={lastAnnual
            ? `${lastAnnual.year} 年同比 ${formatPercent(growth)}`
            : `当前折年同比 ${formatPercent(growth)}`}
        />
        <MetricCard label="人均 GDP（现价美元）" value={`$${formatLarge(nation.economy.currentUSDGDPPerCapita)}`} detail={`当年价 ${formatLarge(nation.economy.currentPriceGDPPerCapita)} 元`} tone="gold" />
        <MetricCard label="总人口" value={formatLarge(nation.population.total)} detail={`城市化 ${formatPercent(nation.society.urbanizationRate)}`} tone="red" />
        <MetricCard label="财政余额" value={formatLarge(nation.fiscal.balance)} detail={`债务率 ${formatPercent(nation.fiscal.debtToGDP)}`} tone={nation.fiscal.balance >= 0 ? "green" : "red"} />
        <MetricCard label="科技指数" value={nation.technology.index.toFixed(1)} detail={`采用率 ${formatPercent(nation.technology.adoptionRate)}`} tone="blue" />
        <MetricCard label="世界经济排名" value={`GDP 第 ${game.world.rankings.nominalGDP.china ?? "—"} 名`} detail={`全球人均第 ${nation.economy.globalGDPPerCapitaRank}/${nation.economy.globalGDPPerCapitaParticipants} · 评分 ${lastAnnual?.score.toFixed(1) ?? "—"}`} tone="green" />
      </div>
      <OverviewComparison annual={nation.history.annual} />
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading"><div><span className="eyebrow">长期趋势</span><h2>国家发展轨迹</h2></div><span className="history-count">{nation.history.annual.length} 个年度</span></div>
          <HistoryChart annual={nation.history.annual} darkMode={darkMode} />
        </section>
        <BudgetPanel game={game} busy={busy} />
      </div>
      <div className="dashboard-grid lower-grid">
        <section className="panel sector-panel">
          <div className="panel-heading"><div><span className="eyebrow">产业结构</span><h2>三次产业增加值</h2></div></div>
          {Object.values(nation.sectors).map((sector) => {
            const labels = { primary: "第一产业", secondary: "第二产业", tertiary: "第三产业" };
            const share = sector.valueAdded / Math.max(nation.economy.realGDP, 1);
            return <div className="sector-row" key={sector.id}><span>{labels[sector.id]}</span><div className="sector-track"><i style={{ width: `${share * 100}%` }} /></div><strong>{formatPercent(share)}</strong></div>;
          })}
        </section>
        <section className="panel pulse-panel">
          <div className="panel-heading"><div><span className="eyebrow">社会脉搏</span><h2>民生与资源</h2></div></div>
          <div className="pulse-grid">
            <div><span>幸福度</span><strong>{nation.society.happinessIndex.toFixed(1)}</strong></div>
            <div><span>预期寿命</span><strong>{nation.health.lifeExpectancy.toFixed(1)} 岁</strong></div>
            <div><span>粮食供应</span><strong>{formatPercent(nation.resources.foodSupplyRatio)}</strong></div>
            <div><span>能源供应</span><strong>{formatPercent(nation.resources.energySupplyRatio)}</strong></div>
          </div>
        </section>
      </div>
    </>
  );
}

function DetailSection({ game, section }: { game: GameState; section: SectionId }) {
  const n = game.nation;
  const data: Record<Exclude<SectionId, "nation" | "policies" | "diplomacy" | "history" | "international" | "statistics" | "settings">, Array<[string, string, string]>> = {
    economy: [["实际 GDP", formatLarge(n.economy.realGDP), "由产业增加值汇总"], ["资本存量", formatLarge(n.economy.capitalStock), "含月度折旧"], ["国内储蓄", formatLarge(n.economy.nationalSavings), "投资的重要来源"], ["通胀率", formatPercent(n.economy.inflationRate), `价格指数 ${n.economy.priceLevelIndex.toFixed(2)}`]],
    fiscal: [["财政收入", formatLarge(n.fiscal.revenue), `有效税率 ${formatPercent(n.fiscal.effectiveTaxRate)}`], ["财政支出", formatLarge(n.fiscal.expenditure), "含债务利息"], ["政府债务", formatLarge(n.fiscal.governmentDebt), `债务率 ${formatPercent(n.fiscal.debtToGDP)}`], ["债务利率", formatPercent(n.fiscal.debtInterestRate), `利息 ${formatLarge(n.fiscal.interestExpense)}`]],
    population: [["儿童人口", formatLarge(n.population.ageGroups.children), "0—14 岁"], ["劳动年龄人口", formatLarge(n.population.ageGroups.workingAge), `参与率 ${formatPercent(n.labor.participationRate)}`], ["老年人口", formatLarge(n.population.ageGroups.elderly), "65 岁及以上"], ["月度自然增长", formatLarge(n.population.monthlyBirths - n.population.monthlyDeaths), `出生率 ${formatPercent(n.population.annualBirthRate)}`]],
    education: [["教育指数", n.education.index.toFixed(1), "长期滞后生效"], ["识字率", formatPercent(n.education.literacyRate), `平均受教育 ${n.education.averageYearsOfSchooling.toFixed(1)} 年`], ["中学覆盖", formatPercent(n.education.secondaryCoverage), "科研人才的基础"], ["大学覆盖", formatPercent(n.education.universityCoverage), `科研人才 ${formatLarge(n.education.researchTalent)}`]],
    technology: [["科技指数", n.technology.index.toFixed(1), `采用率 ${formatPercent(n.technology.adoptionRate)}`], ["科研点数", n.technology.researchPoints.toFixed(1), "累计知识存量"], ["本月科研产出", n.technology.monthlyResearchOutput.toFixed(2), "受人才与制度约束"], ["全要素生产率", n.economy.totalFactorProductivity.toFixed(3), "受年度软上限约束"]],
    agriculture: [["农业增加值", formatLarge(n.sectors.primary.valueAdded), `就业 ${formatLarge(n.sectors.primary.employment)}`], ["粮食产量", `${formatLarge(n.resources.foodProduction)} 吨`, "国内生产"], ["粮食需求", `${formatLarge(n.resources.foodDemand)} 吨`, "人口与收入驱动"], ["粮食供应率", formatPercent(n.resources.foodSupplyRatio), n.resources.foodSupplyRatio < 0.95 ? "存在短缺" : "供应稳定"]],
    industry: [["工业增加值", formatLarge(n.sectors.secondary.valueAdded), `产能利用 ${formatPercent(n.sectors.secondary.capacityUtilization)}`], ["工业资本", formatLarge(n.sectors.secondary.capitalStock), "扣除折旧后"], ["工业就业", formatLarge(n.sectors.secondary.employment), `平均工资 ${formatLarge(n.sectors.secondary.averageWage)}`], ["能源供应率", formatPercent(n.resources.energySupplyRatio), "工业主要瓶颈"]],
    infrastructure: [["综合指数", n.economy.infrastructureIndex.toFixed(1), "交通、电网与通信"], ["住房指数", n.society.housingIndex.toFixed(1), "限制城市承载力"], ["城市化率", formatPercent(n.society.urbanizationRate), `${formatLarge(n.population.urbanPopulation)} 城市人口`], ["服务业增加值", formatLarge(n.sectors.tertiary.valueAdded), "受基础设施显著影响"]],
  };
  if (!(section in data)) return null;
  const title = menuItems.find((item) => item.id === section)?.label ?? "国家指标";
  return <section className="panel detail-page"><div className="detail-hero"><span className="eyebrow">国家统计公报</span><h2>{title}</h2><p>所有指标来自独立 Web Worker 中的月度模拟结算。</p></div><div className="detail-grid">{data[section as keyof typeof data].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{note}</p></article>)}</div>{section === "fiscal" ? <BudgetPanel game={game} busy={false} /> : null}</section>;
}

function TechnologySection({ game, busy }: { game: GameState; busy: boolean }) {
  const nation = game.nation;
  const technology = nation.technology;
  const metrics = calculateTechnologyTreeMetrics(nation);
  const selectTechnologyResearch = useSimulationStore(
    (store) => store.selectTechnologyResearch,
  );
  const activeNode = technology.activeResearchId
    ? getTechnologyNode(technology.activeResearchId)
    : undefined;
  const activeProgress = activeNode
    ? technology.activeResearchProgress / activeNode.researchCost
    : 0;

  return (
    <section className="panel detail-page technology-page">
      <div className="detail-hero technology-hero">
        <span className="eyebrow">教育 · 科研 · 产业能力</span>
        <h2>国家科技树</h2>
        <p>科研预算与人才产生科研产出，教育和前置科技决定能否研究下一节点。科技指数高但产业节点落后时，产业升级收益和出口竞争力仍会受限。</p>
      </div>
      <div className="technology-summary">
        <MetricCard label="科技能力" value={technology.index.toFixed(1)} detail={`教育指数 ${nation.education.index.toFixed(1)} · 采用率 ${formatPercent(technology.adoptionRate)}`} tone="blue" />
        <MetricCard label="已掌握节点" value={`${metrics.completedCount} / ${metrics.totalCount}`} detail={`产业科技第 ${metrics.industryTier} / 5 层`} tone="green" />
        <MetricCard label="产业升级准备度" value={formatPercent(metrics.industrialUpgradeReadiness)} detail={`有效产业科技 ${metrics.effectiveIndustrialTechnology.toFixed(1)} / ${technology.index.toFixed(1)}`} tone={metrics.industrialUpgradeReadiness >= 0.6 ? "green" : "red"} />
        <MetricCard label="当前研究" value={activeNode?.name ?? "等待能力条件"} detail={activeNode ? `${technology.activeResearchProgress.toFixed(1)} / ${activeNode.researchCost} · 本月 ${technology.monthlyResearchOutput.toFixed(2)}` : "无可研究节点时科研仍积累为知识存量"} tone="gold" />
      </div>
      {activeNode ? <div className="technology-active-progress"><div><strong>{activeNode.name}</strong><span>{formatPercent(activeProgress, 0)}</span></div><i><b style={{ width: `${Math.min(activeProgress, 1) * 100}%` }} /></i></div> : null}
      <div className="technology-tree-grid">
        {technologyTreeDefinitions.map((node) => {
          const completed = technology.completedTechnologyIds.includes(node.id);
          const active = technology.activeResearchId === node.id;
          const requirements = technologyResearchRequirements(nation, node);
          const available = !completed && requirements.length === 0;
          return (
            <article className={`technology-node ${completed ? "is-completed" : ""} ${active ? "is-active" : ""} ${!available && !completed ? "is-locked" : ""}`} key={node.id}>
              <div className="technology-node-head"><span>{node.category}</span><small>产业层级 {node.industryTier}</small></div>
              <h3>{node.name}</h3>
              <p>{node.description}</p>
              <div className="technology-requirements">
                <span>教育 ≥ {node.requiredEducationIndex}</span>
                <span>科技 ≥ {node.requiredTechnologyIndex}</span>
                <span>科研成本 {node.researchCost}</span>
              </div>
              <div className="technology-prerequisites">前置：{node.prerequisiteIds.length > 0 ? node.prerequisiteIds.map((id) => getTechnologyNode(id)?.name ?? id).join("、") : "无"}</div>
              <div className="technology-effects">{node.effects.map((effect) => <span key={effect}>{effect}</span>)}</div>
              {!completed && requirements.length > 0 ? <p className="technology-blockers">{requirements.join("；")}</p> : null}
              <button disabled={busy || completed || active || !available} onClick={() => void selectTechnologyResearch(node.id)}>{completed ? "已掌握" : active ? "研究中" : available ? "设为研究目标" : "能力不足"}</button>
            </article>
          );
        })}
      </div>
      <p className="panel-note">没有手动指定目标时，模拟器会按科技树顺序自动选择当前可研究节点；更换目标会重新开始该节点的研究进度。</p>
    </section>
  );
}

function policyUnavailableReason(game: GameState, policyId: string): string | null {
  if (game.nation.policies.includes(policyId)) return null;
  if (game.nation.policies.length >= maximumActivePolicies) {
    return `同时最多实施 ${maximumActivePolicies} 项国策`;
  }
  const policy = nationalPolicyDefinitions.find((item) => item.id === policyId);
  const conflict = nationalPolicyDefinitions.find(
    (selected) =>
      game.nation.policies.includes(selected.id) &&
      (policy?.conflictsWith.includes(selected.id) ||
        selected.conflictsWith.includes(policyId)),
  );
  return conflict ? `与正在实施的“${conflict.name}”冲突` : null;
}

function PoliciesSection({ game, busy }: { game: GameState; busy: boolean }) {
  const setPolicies = useSimulationStore((store) => store.setPolicies);
  const enactHistoricalInitiative = useSimulationStore(
    (store) => store.enactHistoricalInitiative,
  );
  const technologyMetrics = calculateTechnologyTreeMetrics(game.nation);
  const togglePolicy = (policyId: string) => {
    const selected = game.nation.policies.includes(policyId);
    const next = selected
      ? game.nation.policies.filter((id) => id !== policyId)
      : [...game.nation.policies, policyId];
    void setPolicies(next);
  };
  const enactInitiative = (initiativeId: string, name: string) => {
    const confirmed = window.confirm(
      `确定发动“${name}”吗？该历史转折会写入存档且不可撤销。`,
    );
    if (confirmed) void enactHistoricalInitiative(initiativeId);
  };
  const applyBlueprint = (
    blueprint: (typeof developmentRouteBlueprints)[number],
  ) => {
    const sameSelection = blueprint.policyIds.length === game.nation.policies.length &&
      blueprint.policyIds.every((policyId) => game.nation.policies.includes(policyId));
    if (sameSelection) return;
    const confirmed = game.nation.policies.length === 0 || window.confirm(
      `采用“${blueprint.referenceEconomy}参考 · ${blueprint.name}”会替换当前普通国策组合，之后仍可逐项调整和跨路线混搭。是否继续？`,
    );
    if (confirmed) void setPolicies(blueprint.policyIds);
  };

  return (
    <section className="panel detail-page policy-page">
      <div className="detail-hero policy-hero">
        <span className="eyebrow">国家发展路线</span>
        <h2>重要国策</h2>
        <p>国策不直接增加 GDP，而是通过资本配置、人口、公共服务、科研、贸易和财政逐月传导。取消后也会经历退出期。</p>
        <div className="selection-count"><strong>{game.nation.policies.length}</strong> / {maximumActivePolicies} 项正在实施</div>
      </div>
      <div className="route-blueprint-heading">
        <div>
          <span className="eyebrow">快捷组合 · 不锁定路线</span>
          <h2>经济发展蓝图</h2>
          <p>参考韩国、台湾、香港、新加坡、美国和日本的发展经验。一键采用后仍可逐项取消、替换或跨蓝图混搭。</p>
        </div>
      </div>
      <div className="route-blueprint-grid">
        {developmentRouteBlueprints.map((blueprint) => {
          const selectedCount = blueprint.policyIds.filter(
            (policyId) => game.nation.policies.includes(policyId),
          ).length;
          const active = selectedCount === blueprint.policyIds.length;
          return (
            <article
              className={active ? "route-blueprint-card is-active" : "route-blueprint-card"}
              key={blueprint.id}
            >
              <div className="route-blueprint-card-head">
                <span>{blueprint.referenceEconomy}参考</span>
                <small>{selectedCount}/{blueprint.policyIds.length} 项已选</small>
              </div>
              <h3>{blueprint.name}</h3>
              <p>{blueprint.summary}</p>
              <div className="route-blueprint-points strengths">
                <strong>优势</strong>
                <span>{blueprint.strengths.join(" · ")}</span>
              </div>
              <div className="route-blueprint-points tradeoffs">
                <strong>代价</strong>
                <span>{blueprint.tradeoffs.join(" · ")}</span>
              </div>
              <button
                disabled={busy || active}
                onClick={() => applyBlueprint(blueprint)}
              >
                {active ? "正在采用 · 可在下方调整" : "采用推荐组合"}
              </button>
            </article>
          );
        })}
      </div>
      <div className="policy-list-heading">
        <span className="eyebrow">自由组合</span>
        <h2>全部普通国策</h2>
      </div>
      <div className="policy-grid">
        {nationalPolicyDefinitions.map((policy) => {
          const selected = game.nation.policies.includes(policy.id);
          const progress = game.nation.policyProgress[policy.id] ?? 0;
          const reason = policyUnavailableReason(game, policy.id);
          const conflicts = policy.conflictsWith
            .map((id) => nationalPolicyDefinitions.find((item) => item.id === id)?.name)
            .filter(Boolean)
            .join("、");
          return (
            <article className={selected ? "policy-card is-selected" : "policy-card"} key={policy.id}>
              <div className="policy-card-head"><span>{policy.category}</span><small>{policy.transitionMonths} 个月过渡</small></div>
              <h3>{policy.name}</h3>
              <p>{policy.description}</p>
              <div className="policy-progress"><i style={{ width: `${progress * 100}%` }} /></div>
              <div className="policy-meta"><span>生效程度 {formatPercent(progress, 0)}</span><span>{conflicts ? `互斥：${conflicts}` : "无互斥国策"}</span></div>
              {policy.id === "industrial_upgrading" ? <div className="policy-capability">科技准备度 {formatPercent(technologyMetrics.industrialUpgradeReadiness)} · 产业科技第 {technologyMetrics.industryTier} 层；收益按准备度折算，成本照常发生。</div> : null}
              <button
                className={selected ? "policy-toggle remove" : "policy-toggle"}
                disabled={busy || (!selected && reason !== null)}
                title={reason ?? undefined}
                onClick={() => togglePolicy(policy.id)}
              >
                {selected ? "停止实施" : reason ?? "开始实施"}
              </button>
            </article>
          );
        })}
      </div>
      <div className="initiative-heading">
        <div>
          <span className="eyebrow">一次性重大决策</span>
          <h2>历史转折国策</h2>
          <p>适合主动推动的治理、工业化、改革与国际合作事件，满足真实能力门槛后均可由玩家在史实日期前发动。战争、灾害、危机和政治运动仍按事件处理。</p>
        </div>
        <span>{game.nation.diplomacy.diplomaticPoints.toFixed(1)} 外交点数</span>
      </div>
      <div className="initiative-grid">
        {historicalInitiativeDefinitions.map((initiative) => {
          const status = getHistoricalInitiativeStatus(game, initiative);
          const event = getHistoricalEvent(initiative.eventId);
          const record = status.completedRecord;
          const completedEarly = record?.outcome === "enacted_early";
          const initiativeCostLabel = initiative.diplomaticPointCost > 0
            ? `外交成本 ${initiative.diplomaticPointCost} 点`
            : "国内决策 · 无外交成本";
          const initiativeActionLabel = busy && status.available
            ? "正在执行…"
            : status.completed
              ? "已完成"
              : status.available
                ? initiative.diplomaticPointCost > 0
                  ? `发动国策 · ${initiative.diplomaticPointCost} 点`
                  : "发动国策"
                : "暂不可发动";
          return (
            <article
              className={`initiative-card ${status.available ? "is-available" : ""} ${status.completed ? "is-completed" : ""}`}
              key={initiative.id}
            >
              <div className="initiative-card-head">
                <span>{status.completed ? completedEarly ? "已提前实施" : "事件已处理" : status.available ? "可以发动" : "条件未满足"}</span>
                <small>史实 {event?.year ?? "—"} 年 {event?.month ?? "—"} 月</small>
              </div>
              <h3>{initiative.name}</h3>
              <p>{initiative.description}</p>
              <div className="initiative-facts">
                <span>{initiative.category}</span>
                <span>最早 {initiative.availableFromYear} 年</span>
                <span>{initiativeCostLabel}</span>
                <span>调整期 {formatEventDuration(initiative.transitionDurationMonths)}</span>
              </div>
              {record ? (
                <div className="initiative-result">
                  <strong>{completedEarly ? `${record.year} 年 ${record.month} 月提前实施` : `${record.year} 年 ${record.month} 月已处理`}</strong>
                  <span>{completedEarly ? `比史实计划提前 ${record.scheduledYear - record.year} 年` : record.choiceName}</span>
                </div>
              ) : status.blockers.length > 0 ? (
                <div className="initiative-blockers">
                  <strong>尚缺条件</strong>
                  <ul>{status.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
                </div>
              ) : (
                <div className="initiative-ready">国内外条件已满足，可立即提交重大决策。</div>
              )}
              <button
                disabled={busy || !status.available}
                title={!status.available && !status.completed ? status.blockers.join("；") : undefined}
                onClick={() => enactInitiative(initiative.id, initiative.name)}
              >
                {initiativeActionLabel}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function diplomaticActionUnavailableReason(
  game: GameState,
  country: GameState["world"]["countries"][number],
  actionId: DiplomaticActionId,
): string | null {
  const action = diplomaticActionDefinitions[actionId];
  if (country.lastDiplomaticActionMonth !== null) {
    const remaining = action.cooldownMonths -
      (game.nation.date.elapsedMonths - country.lastDiplomaticActionMonth);
    if (remaining > 0) return `冷却 ${remaining} 个月`;
  }
  if (game.nation.diplomacy.diplomaticPoints < action.cost) return `需要 ${action.cost} 点`;
  if (country.relationWithChina < action.minimumRelation) return `关系需达到 ${action.minimumRelation}`;
  if (actionId === "sign_trade_agreement" && country.tradeAgreement) return "已签署协定";
  if (actionId === "strategic_partnership" && !country.tradeAgreement) return "需先签署贸易协定";
  if (actionId === "strategic_partnership" && country.diplomaticStatus === "strategic_partner") return "已是战略伙伴";
  if (actionId === "impose_sanctions" && country.diplomaticStatus === "sanctioned") return "制裁已生效";
  if (actionId === "lift_sanctions" && country.diplomaticStatus !== "sanctioned") return "当前没有制裁";
  if (country.diplomaticStatus === "sanctioned" && (actionId === "sign_trade_agreement" || actionId === "strategic_partnership")) return "制裁期间不可执行";
  return null;
}

const diplomaticStatusLabels = {
  neutral: "一般关系",
  partner: "贸易伙伴",
  strategic_partner: "战略伙伴",
  sanctioned: "制裁中",
} as const;

function DiplomacySection({ game, busy }: { game: GameState; busy: boolean }) {
  const diplomaticAction = useSimulationStore((store) => store.diplomaticAction);
  const joinOrganization = useSimulationStore((store) => store.joinOrganization);
  const setDiplomaticStrategy = useSimulationStore(
    (store) => store.setDiplomaticStrategy,
  );
  const countries = [...game.world.countries].sort((first, second) =>
    second.nominalGDP - first.nominalGDP,
  );
  const currentStrategy = diplomaticStrategyDefinitions.find(
    (strategy) => strategy.id === game.nation.diplomacy.strategyId,
  );
  const currentStrategyEffects = diplomaticStrategyEffects(game.nation);
  const strategyCooldown = diplomaticStrategyCooldownRemaining(game);
  const alignment = game.nation.diplomacy.strategyAlignment;
  const alignmentLabel = Math.abs(alignment) < 0.01
    ? "平衡"
    : alignment < 0
      ? `偏苏 ${Math.abs(alignment * 100).toFixed(0)}%`
      : `偏西 ${Math.abs(alignment * 100).toFixed(0)}%`;
  const strategyTransitionComplete = currentStrategy
    ? Math.abs(currentStrategy.targetAlignment - alignment) < 0.001
    : true;
  const chooseStrategy = (strategyId: DiplomaticStrategyId, name: string) => {
    const confirmed = window.confirm(
      `确定改为“${name}”吗？调整将消耗外交点数，并在 60 个月内不能再次改变路线。`,
    );
    if (confirmed) void setDiplomaticStrategy(strategyId);
  };

  return (
    <section className="panel detail-page diplomacy-page">
      <div className="detail-hero">
        <span className="eyebrow">国际战略与合作</span>
        <h2>外交事务</h2>
        <p>改善关系有时间成本；协定与伙伴关系扩大市场准入，制裁则同时损害贸易和国际声誉。</p>
      </div>
      <div className="diplomacy-metrics">
        <MetricCard label="外交点数" value={game.nation.diplomacy.diplomaticPoints.toFixed(1)} detail={`每月 +${game.nation.diplomacy.monthlyPointGain.toFixed(2)}`} />
        <MetricCard label="国际声誉" value={game.nation.diplomacy.globalReputation.toFixed(1)} detail={`平均关系 ${averageInternationalRelation(game).toFixed(1)}`} tone="green" />
        <MetricCard label="国家安全" value={game.nation.diplomacy.securityIndex.toFixed(1)} detail={`国防预算 ${formatPercent(game.nation.fiscal.budget.defense)}`} tone="gold" />
        <MetricCard label="对外贸易" value={formatLarge(game.nation.trade.exports + game.nation.trade.imports)} detail={`顺差 ${formatLarge(game.nation.trade.balance)}`} tone={game.nation.trade.balance >= 0 ? "green" : "red"} />
      </div>
      <section className="diplomatic-strategy-panel">
        <div className="strategy-panel-heading">
          <div><span className="eyebrow">长期国际取向</span><h2>外交战略路线</h2><p>路线约用三年逐步到位；切换后五年内不能再次调整。效果通过关系、贸易、外资、科研、技术扩散和安全逐月传导。</p></div>
          <div className="strategy-current"><span>当前路线</span><strong>{currentStrategy?.name ?? game.nation.diplomacy.strategyId}</strong><small>{strategyTransitionComplete ? "路线已稳定" : `调整中 · ${alignmentLabel}`}</small></div>
        </div>
        <div className="alignment-scale" aria-label={`当前外交倾向：${alignmentLabel}`}>
          <div className="alignment-labels"><span>亲苏</span><span>平衡</span><span>亲西方</span></div>
          <div className="alignment-track"><i style={{ left: `${(alignment + 1) * 50}%` }} /></div>
        </div>
        <div className="strategy-live-effects">
          <span>市场准入 ×{currentStrategyEffects.marketAccessMultiplier.toFixed(2)}</span>
          <span>外资 ×{currentStrategyEffects.foreignInvestmentMultiplier.toFixed(2)}</span>
          <span>技术扩散 ×{currentStrategyEffects.technologyDiffusionMultiplier.toFixed(2)}</span>
          <span>科研产出 ×{currentStrategyEffects.researchOutputMultiplier.toFixed(2)}</span>
          <span>安全目标 {currentStrategyEffects.securityTargetAdjustment >= 0 ? "+" : ""}{currentStrategyEffects.securityTargetAdjustment.toFixed(1)}</span>
        </div>
        <div className="strategy-grid">
          {diplomaticStrategyDefinitions.map((strategy) => {
            const selected = strategy.id === game.nation.diplomacy.strategyId;
            const insufficientPoints = game.nation.diplomacy.diplomaticPoints <
              strategy.activationCost;
            const unavailableReason = selected
              ? "当前正在采用"
              : strategyCooldown > 0
                ? `还需冷却 ${strategyCooldown} 个月`
                : insufficientPoints
                  ? `需要 ${strategy.activationCost} 点外交点数`
                  : null;
            return (
              <article className={selected ? "strategy-card is-selected" : "strategy-card"} key={strategy.id}>
                <div className="strategy-card-head"><span>{strategy.shortName}</span><small>调整成本 {strategy.activationCost} 点</small></div>
                <h3>{strategy.name}</h3>
                <p>{strategy.description}</p>
                <div className="strategy-effects">{strategy.effects.map((effect) => <span key={effect}>{effect}</span>)}</div>
                <div className="strategy-numbers">
                  <span>贸易 ×{strategy.marketAccessMultiplier.toFixed(2)}</span>
                  <span>外资 ×{strategy.foreignInvestmentMultiplier.toFixed(2)}</span>
                  <span>技术 ×{strategy.technologyDiffusionMultiplier.toFixed(2)}</span>
                  <span>科研 ×{strategy.researchOutputMultiplier.toFixed(2)}</span>
                </div>
                <button
                  disabled={busy || unavailableReason !== null}
                  title={unavailableReason ?? undefined}
                  onClick={() => chooseStrategy(strategy.id, strategy.name)}
                >
                  {selected ? "当前路线" : unavailableReason ?? `选择路线 · ${strategy.activationCost} 点`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <div className="diplomacy-layout">
        <section className="diplomacy-block">
          <div className="panel-heading"><div><span className="eyebrow">多边机制</span><h2>国际组织</h2><p>联合国席位和世界贸易组织由历史进程与外交条件自动解锁，其余组织仍需主动申请。</p></div></div>
          <div className="organization-list">
            {internationalOrganizations.map((organization) => {
              const status = getInternationalOrganizationStatus(game, organization.id);
              const strategicPartners = game.world.countries.filter(
                (country) => country.diplomaticStatus === "strategic_partner",
              ).length;
              return (
                <article className={status.joined ? "organization-card is-joined" : "organization-card"} key={organization.id}>
                  <div className="organization-content">
                    <h3>{organization.name}</h3>
                    <p>{organization.description}</p>
                    <small>
                      {organization.availableYear} 年起 · {organization.automatic ? "条件达成后自动生效" : `消耗 ${organization.cost} 点`} · 贸易 ×{organization.tradeMultiplier.toFixed(2)}
                    </small>
                    <div className="organization-progress" aria-label={`${organization.name}加入条件进度`}>
                      {organization.minimumAverageRelation > 0 && (
                        <span className={status.averageRelation >= organization.minimumAverageRelation ? "is-met" : undefined}>
                          平均关系 {status.averageRelation.toFixed(1)} / {organization.minimumAverageRelation}
                        </span>
                      )}
                      {organization.minimumSupportingCountries > 0 && (
                        <span className={status.supportingCountries >= organization.minimumSupportingCountries ? "is-met" : undefined}>
                          支持国家 {status.supportingCountries} / {organization.minimumSupportingCountries}（关系 ≥ {organization.supportRelationThreshold}）
                        </span>
                      )}
                      {organization.minimumTradeAgreements > 0 && (
                        <span className={status.tradeAgreements >= organization.minimumTradeAgreements ? "is-met" : undefined}>
                          贸易协定 {status.tradeAgreements} / {organization.minimumTradeAgreements}
                        </span>
                      )}
                      {organization.minimumStrategicPartners > 0 && (
                        <span className={strategicPartners >= organization.minimumStrategicPartners ? "is-met" : undefined}>
                          战略伙伴 {strategicPartners} / {organization.minimumStrategicPartners}
                        </span>
                      )}
                    </div>
                    {!status.joined && status.blockers.length > 0 && (
                      <p className="organization-blockers">尚需：{status.blockers.join("；")}</p>
                    )}
                    {status.joined && <p className="organization-success">成员权益已生效</p>}
                  </div>
                  {organization.automatic ? (
                    <span className="organization-auto-state">
                      {status.joined ? "已自动生效" : status.available ? "条件已满足，自动结算" : "等待条件达成"}
                    </span>
                  ) : (
                    <button
                      disabled={busy || !status.available}
                      title={!status.joined && status.blockers.length > 0 ? status.blockers.join("；") : undefined}
                      onClick={() => void joinOrganization(organization.id)}
                    >
                      {status.joined ? "已加入" : status.available ? "申请加入" : "暂未解锁"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
        <section className="diplomacy-block country-relations">
          <div className="panel-heading"><div><span className="eyebrow">双边往来</span><h2>国家关系</h2></div><span className="history-count">{countries.length} 个国家</span></div>
          <div className="relation-list">
            {countries.map((country) => {
              const nextAction: DiplomaticActionId = country.diplomaticStatus === "sanctioned"
                ? "lift_sanctions"
                : !country.tradeAgreement
                  ? "sign_trade_agreement"
                  : "strategic_partnership";
              const improveReason = diplomaticActionUnavailableReason(game, country, "improve_relations");
              const nextReason = diplomaticActionUnavailableReason(game, country, nextAction);
              const sanctionReason = diplomaticActionUnavailableReason(game, country, "impose_sanctions");
              return (
                <article className="relation-row" key={country.id}>
                  <div className="relation-country"><strong>{country.name}</strong><span>{diplomaticStatusLabels[country.diplomaticStatus]}</span></div>
                  <div className={country.relationWithChina >= 35 ? "relation-score positive" : country.relationWithChina < 0 ? "relation-score negative" : "relation-score"}><strong>{country.relationWithChina.toFixed(1)}</strong><span>双边关系</span></div>
                  <div className="relation-actions">
                    <button disabled={busy || improveReason !== null} title={improveReason ?? undefined} onClick={() => void diplomaticAction("improve_relations", country.id)}>改善 · {diplomaticActionDefinitions.improve_relations.cost}</button>
                    <button disabled={busy || nextReason !== null} title={nextReason ?? undefined} onClick={() => void diplomaticAction(nextAction, country.id)}>{diplomaticActionDefinitions[nextAction].name} · {diplomaticActionDefinitions[nextAction].cost}</button>
                    {country.diplomaticStatus !== "sanctioned" ? <button className="danger-action" disabled={busy || sanctionReason !== null} title={sanctionReason ?? undefined} onClick={() => void diplomaticAction("impose_sanctions", country.id)}>制裁 · {diplomaticActionDefinitions.impose_sanctions.cost}</button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

const historicalImpactLabels = {
  positive: "积极影响",
  negative: "负面冲击",
  mixed: "双向影响",
} as const;

function formatEventDuration(months: number): string {
  if (months < 12) return `${months} 个月`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths === 0
    ? `${years} 年`
    : `${years} 年 ${remainingMonths} 个月`;
}

const historicalModifierLabels: Record<string, string> = {
  "sector.primary.output": "农业产出",
  "sector.secondary.output": "工业产出",
  "sector.tertiary.output": "服务业产出",
  "capital.privateInvestment": "社会投资",
  "fiscal.revenue": "财政收入",
  "fiscal.spending": "财政支出",
  "trade.foreignInvestment": "外商投资",
  "trade.exportCompetitiveness": "出口竞争力",
  "diplomacy.reputationTarget": "国际声誉目标",
  "economy.institutionalEfficiencyTarget": "制度效率目标",
  "resources.foodSupply": "粮食供应",
  "resources.energySupply": "能源供应",
  "population.birthRate": "出生率",
  "population.deathRate": "死亡率",
  "education.efficiency": "教育效率",
  "health.efficiency": "医疗效率",
  "technology.researchOutput": "科研产出",
};

function formatHistoricalModifier(modifier: {
  target: string;
  operation: "add" | "multiply" | "override";
  value: number;
}): string {
  const label = historicalModifierLabels[modifier.target] ?? modifier.target;
  if (modifier.operation === "multiply") {
    const change = (modifier.value - 1) * 100;
    return `${label} ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  }
  if (modifier.operation === "add") {
    return `${label} ${modifier.value >= 0 ? "+" : ""}${modifier.value.toFixed(1)}`;
  }
  return `${label} 调整为 ${modifier.value}`;
}

function HistoricalDecisionModal({ game, busy }: { game: GameState; busy: boolean }) {
  const resolveHistoricalEvent = useSimulationStore(
    (store) => store.resolveHistoricalEvent,
  );
  const pendingId = game.nation.pendingHistoricalEventId;
  const event = pendingId ? getHistoricalEvent(pendingId) : undefined;
  const choices = event ? getHistoricalEventChoices(event, game.nation) : [];
  if (!event) return null;

  return (
    <div className="historical-decision-overlay">
      <section
        className="historical-decision-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="historical-decision-title"
      >
        <header className="historical-decision-header">
          <div>
            <span className="eyebrow">国家重大决策 · {event.year} 年 {event.month} 月</span>
            <h2 id="historical-decision-title">{event.name}</h2>
            <p>{event.description}</p>
          </div>
          <span className={`decision-impact ${event.impact}`}>
            {historicalImpactLabels[event.impact]}
          </span>
        </header>
        <div className="historical-choice-grid">
          {choices.map((choice) => (
            <article
              className={`${choice.isHistoricalPath ? "historical-choice is-historical" : "historical-choice"} ${choice.outcome === "prevented" ? "prevents-event" : ""}`}
              key={choice.id}
            >
              <div className="historical-choice-head">
                <span>{choice.outcome === "prevented" ? "阻止事件" : choice.isHistoricalPath ? "史实方案" : "可选路线"}</span>
                <small>持续 {formatEventDuration(choice.durationMonths)}</small>
              </div>
              <h3>{choice.name}</h3>
              <p>{choice.description}</p>
              <div className="historical-choice-effects">
                {choice.effects.map((effect) => <span key={effect}>{effect}</span>)}
              </div>
              <div className="historical-choice-modifiers">
                <strong>模型传导</strong>
                <div>{choice.modifiers.map((modifier, index) => (
                  <span key={`${modifier.target}:${index}`}>
                    {formatHistoricalModifier(modifier)}
                  </span>
                ))}</div>
              </div>
              <button
                disabled={busy}
                onClick={() => void resolveHistoricalEvent(event.id, choice.id)}
              >
                {busy ? "正在执行…" : `选择：${choice.name}`}
              </button>
            </article>
          ))}
        </div>
        <p className="historical-decision-note">
          决策将写入存档且不可撤销。选择后本月仍未结算，可继续推进时间。
        </p>
      </section>
    </div>
  );
}

function HistoricalEventsSection({ game }: { game: GameState }) {
  const [category, setCategory] = useState("全部");
  const sortedEvents = useMemo(
    () => [...historicalEventDefinitions].sort(
      (first, second) => first.year - second.year || first.month - second.month,
    ),
    [],
  );
  const categories = useMemo(
    () => ["全部", ...new Set(sortedEvents.map((event) => event.category))],
    [sortedEvents],
  );
  const occurredIds = new Set(
    game.nation.history.historicalEvents.map((event) => event.id),
  );
  const recordsById = new Map(
    game.nation.history.historicalEvents.map((event) => [event.id, event]),
  );
  const activeIds = new Set(game.nation.modifiers.map((modifier) => modifier.sourceId));
  const currentSerial = game.nation.date.year * 12 + game.nation.date.month;
  const visibleEvents = category === "全部"
    ? sortedEvents
    : sortedEvents.filter((event) => event.category === category);
  const nextEvent = sortedEvents.find((event) =>
    !occurredIds.has(event.id) && event.year * 12 + event.month >= currentSerial,
  );

  return (
    <section className="panel detail-page history-events-page">
      <div className="detail-hero history-events-hero">
        <span className="eyebrow">1949—2026 历史脉络</span>
        <h2>历史事件时间线</h2>
        <p>事件按真实年月确定触发，通过产业、人口、财政、教育、科研、外交与贸易等中间变量持续生效。相同存档与决策下，触发顺序完全确定。</p>
        <div className="history-event-summary">
          <div><strong>{occurredIds.size}</strong><span>已处理</span></div>
          <div><strong>{historicalEventDefinitions.length}</strong><span>事件总数</span></div>
          <div><strong>{activeIds.size}</strong><span>当前修正器</span></div>
        </div>
      </div>
      <div className="history-event-toolbar">
        <label>事件类别<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <div className="next-event"><span>下一事件</span><strong>{nextEvent ? `${nextEvent.year} 年 ${nextEvent.month} 月 · ${nextEvent.name}` : "时间线已完成"}</strong></div>
      </div>
      <div className="historical-timeline">
        {visibleEvents.map((event) => {
          const record = recordsById.get(event.id);
          const selectedChoice = record
            ? getHistoricalEventChoices(event, game.nation).find(
                (choice) => choice.id === record.choiceId,
              )
            : undefined;
          const occurred = occurredIds.has(event.id);
          const active = activeIds.has(event.id);
          const pending = game.nation.pendingHistoricalEventId === event.id;
          const isPast = event.year * 12 + event.month < currentSerial;
          const prevented = record?.outcome === "prevented";
          const enactedEarly = record?.outcome === "enacted_early";
          const status = pending ? "待决策" : prevented ? "已避免" : enactedEarly ? "提前实施" : active ? "影响中" : occurred ? "已发生" : isPast ? "未记录" : "待发生";
          return (
            <article className={`historical-event impact-${event.impact} ${occurred ? "has-occurred" : ""} ${pending ? "is-pending" : ""} ${prevented ? "is-prevented" : ""} ${enactedEarly ? "is-early" : ""}`} key={event.id}>
              <div className="timeline-date"><strong>{event.year}</strong><span>{event.month} 月</span><i /></div>
              <div className="historical-event-card">
                <div className="historical-event-head">
                  <div><span className="event-category">{event.category}</span><span className={`event-impact ${event.impact}`}>{historicalImpactLabels[event.impact]}</span></div>
                  <span className={pending ? "event-status pending" : prevented ? "event-status prevented" : enactedEarly ? "event-status early" : active ? "event-status active" : occurred ? "event-status occurred" : "event-status"}>{status}</span>
                </div>
                <h3>{event.name}</h3>
                <p>{event.description}</p>
                {record ? <div className="event-choice-result"><span>{prevented ? "事件已避免" : enactedEarly ? `提前于 ${record.year} 年 ${record.month} 月实施` : "玩家决策"}</span><strong>{record.choiceName}</strong><p>{record.choiceDescription}</p></div> : null}
                <div className="event-effects">{(record?.effects ?? event.effects).map((effect) => <span key={effect}>{effect}</span>)}</div>
                <div className="event-duration">影响持续：{formatEventDuration(record?.durationMonths ?? event.durationMonths)} · 通过 {selectedChoice?.modifiers.length ?? event.modifiers.length} 个模型变量传导</div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InternationalSection({ game }: { game: GameState }) {
  const trade = game.nation.trade;
  const reserveChangePrefix = trade.monthlyReserveChange >= 0 ? "+" : "";
  const countries = [
    { id: "china", name: "中国", nominalGDP: game.nation.economy.internationalComparableGDP, population: game.nation.population.total, technology: game.nation.technology.index },
    ...game.world.countries.map((country) => ({ id: country.id, name: country.name, nominalGDP: country.nominalGDP, population: country.population, technology: country.technologyIndex })),
  ].sort((a, b) =>
    (game.world.rankings.nominalGDP[a.id] ?? Number.MAX_SAFE_INTEGER) -
    (game.world.rankings.nominalGDP[b.id] ?? Number.MAX_SAFE_INTEGER)
  ).slice(0, 12);
  return (
    <section className="panel detail-page">
      <div className="detail-hero">
        <span className="eyebrow">全球比较</span>
        <h2>世界主要经济体</h2>
        <p>外国经济体采用轻量增长模型，每月与中国同步更新。外汇、侨汇与外债使用美元等值口径；资本品用汇不足会约束设备投资，外债还本付息则消耗外汇储备。</p>
      </div>
      <div className="diplomacy-metrics foreign-exchange-metrics">
        <MetricCard
          label="外汇储备"
          value={`$${formatLarge(trade.foreignExchangeReserves)}`}
          detail={`本月 ${reserveChangePrefix}$${formatLarge(trade.monthlyReserveChange)}`}
          tone={trade.monthlyReserveChange >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="年度侨汇流入"
          value={`$${formatLarge(trade.remittanceInflows)}`}
          detail={`占可比 GDP ${formatPercent(trade.remittanceInflows / Math.max(game.nation.economy.internationalComparableGDP, 1), 2)}`}
          tone="gold"
        />
        <MetricCard
          label="侨汇结汇贡献"
          value={`$${formatLarge(trade.remittanceReserveContribution)}`}
          detail={`留存 ${formatPercent(trade.remittanceReserveContribution / Math.max(trade.remittanceInflows, 1), 0)}`}
          tone="blue"
        />
        <MetricCard
          label="进口覆盖能力"
          value={`${trade.importCoverageMonths.toFixed(1)} 个月`}
          detail={trade.importCoverageMonths >= 6 ? "外汇缓冲较充足" : "必要进口承压"}
          tone={trade.importCoverageMonths >= 6 ? "green" : "red"}
        />
        <MetricCard
          label="外债余额"
          value={`$${formatLarge(trade.externalDebt)}`}
          detail={`负债率 ${formatPercent(trade.externalDebtToGDP, 3)} · 利率 ${formatPercent(trade.externalDebtInterestRate, 1)}`}
          tone={trade.externalDebtToGDP <= 0.2 ? "gold" : "red"}
        />
        <MetricCard
          label="年度外债偿付"
          value={`$${formatLarge(trade.annualExternalDebtService)}`}
          detail={`偿债率 ${formatPercent(trade.externalDebtServiceRatio, 3)} · 本月新增 $${formatLarge(trade.monthlyExternalBorrowing)}`}
          tone={trade.externalDebtServiceRatio <= 0.2 ? "blue" : "red"}
        />
        <MetricCard
          label="资本品外汇满足率"
          value={formatPercent(trade.capitalGoodsImportCoverage, 1)}
          detail={`年度需求 $${formatLarge(trade.capitalGoodsForeignExchangeNeed)} · 进口份额 ${formatPercent(trade.capitalGoodsImportShare, 0)}`}
          tone={trade.capitalGoodsImportCoverage >= 0.75 ? "green" : "red"}
        />
        <MetricCard
          label="全球人均 GDP 排名"
          value={`第 ${game.nation.economy.globalGDPPerCapitaRank} 名`}
          detail={`${game.nation.economy.globalGDPPerCapitaParticipants} 个参评经济体 · $${formatLarge(game.nation.economy.currentUSDGDPPerCapita)}`}
          tone="gold"
        />
      </div>
      <div className="world-table">
        <div className="world-head"><span>主要经济体排名</span><span>国家</span><span>名义 GDP</span><span>人均 GDP</span><span>科技</span></div>
        {countries.map((country, index) => (
          <div className={country.id === "china" ? "world-row is-china" : "world-row"} key={country.id}>
            <span>{index + 1}</span><strong>{country.name}</strong><span>{formatLarge(country.nominalGDP)}</span><span>{formatLarge(country.nominalGDP / country.population)}</span><span>{country.technology.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatisticsSection({ game, darkMode }: { game: GameState; darkMode: boolean }) {
  const [comparisonTargetId, setComparisonTargetId] =
    useState<ComparisonTargetId>("history");
  const comparison = useMemo(
    () => compareSimulationWithTarget(
      game.nation.history.annual,
      comparisonTargetId,
    ),
    [comparisonTargetId, game.nation.history.annual],
  );
  const comparisons = [...comparison.rows].reverse();
  const isInternationalComparison = comparison.valueBasis === "current_usd";
  const differenceTone = (value: number) =>
    value > 0.0005 ? "is-above" : value < -0.0005 ? "is-below" : "is-matched";
  const renderMetric = (
    metric: TargetComparisonMetric,
    currency = false,
  ) => (
    <div className="comparison-metric">
      <strong>{currency ? "$" : ""}{formatLarge(metric.simulated)}</strong>
      <span>
        {comparison.targetLabel} {currency ? "$" : ""}
        {formatLarge(metric.target)}
      </span>
      <small className={differenceTone(metric.relativeDifference)}>
        偏差 {metric.relativeDifference >= 0 ? "+" : ""}
        {formatPercent(metric.relativeDifference)}
      </small>
    </div>
  );
  return (
    <section className="panel detail-page">
      <div className="detail-hero">
        <span className="eyebrow">年度时间序列</span>
        <h2>历史统计</h2>
        <p>长期图表只保存年度值，最近 120 个月用于短期分析。</p>
      </div>
      <HistoryChart annual={game.nation.history.annual} darkMode={darkMode} />
      <section className="historical-comparison-panel">
        <div className="comparison-heading">
          <div>
            <span className="eyebrow">本局路线与同期发展目标</span>
            <h2>国家发展对比</h2>
            <p>选择历史、韩国、日本或台湾，查看相同年份的发展差距。</p>
          </div>
          <ComparisonTargetSelector
            value={comparisonTargetId}
            onChange={setComparisonTargetId}
          />
        </div>
        <div className="historical-comparison-scroll">
          <div className="historical-comparison-table">
            <div className="comparison-head">
              <span>年份</span>
              <span>{isInternationalComparison ? "GDP（现价美元）" : "实际 GDP"}</span>
              <span>{isInternationalComparison ? "人均 GDP（美元）" : "人均 GDP"}</span>
              <span>总人口</span>
              <span>世界经济排名</span>
            </div>
            {comparisons.map((item) => (
              <div className="comparison-row" key={item.year}>
                <strong>{item.year}</strong>
                {renderMetric(item.gdp, isInternationalComparison)}
                {renderMetric(item.gdpPerCapita, isInternationalComparison)}
                {renderMetric(item.population)}
                <div className="comparison-metric comparison-rank">
                  {item.gdpRank ? (
                    <>
                      <strong>第 {item.gdpRank.simulated} 名</strong>
                      <span>
                        {comparison.targetLabel}第 {item.gdpRank.target} 名
                        {item.gdpRank.targetParticipants
                          ? ` / ${item.gdpRank.targetParticipants}`
                          : ""}
                      </span>
                      <small className={item.gdpRank.difference < 0
                        ? "is-above"
                        : item.gdpRank.difference > 0
                          ? "is-below"
                          : "is-matched"}
                      >
                        {item.gdpRank.difference === 0
                          ? `与${comparison.targetLabel}一致`
                          : item.gdpRank.difference < 0
                            ? `领先 ${Math.abs(item.gdpRank.difference)} 位`
                            : `落后 ${item.gdpRank.difference} 位`}
                      </small>
                    </>
                  ) : (
                    <span>该年暂无统一排名锚点</span>
                  )}
                </div>
              </div>
            ))}
            {comparisons.length === 0 && (
              <p className="comparison-empty">
                推进到 1960 年后即可开始与{comparison.targetLabel}比较。
              </p>
            )}
          </div>
        </div>
        <p className="comparison-note">
          {isInternationalComparison
            ? "国家横向对标统一使用同期现价美元；目标排名按同年有数据的世界经济体计算，本局排名来自动态世界模型。对比只用于展示，不会改变模拟结果。"
            : "历史对比的实际 GDP 与人均 GDP 使用项目统一的 1949 年不变价校准口径；世界经济排名按名义 GDP 总量比较。2026 年预测目标不作为真实历史展示。"}
        </p>
      </section>
      <div className="annual-table"><div className="annual-head"><span>年份</span><span>GDP</span><span>人均 GDP</span><span>人口</span><span>科技</span><span>外储 / 外债</span><span>侨汇</span><span>排名</span></div>{game.nation.history.annual.slice(-10).reverse().map((item) => <div className="annual-row" key={item.year}><strong>{item.year}</strong><span>{formatLarge(item.realGDP)}</span><span>${formatLarge(item.currentUSDGDPPerCapita)}<br />{formatLarge(item.currentPriceGDPPerCapita)} 元</span><span>{formatLarge(item.population)}</span><span>指数 {item.technologyIndex.toFixed(1)}<br />产业第 {item.industryTechnologyTier} 层 · {item.completedTechnologyCount} 节点</span><span>外储 ${formatLarge(item.foreignExchangeReserves)}<br />外债 ${formatLarge(item.externalDebt)} · 用汇 {formatPercent(item.capitalGoodsImportCoverage, 0)}</span><span>${formatLarge(item.remittanceInflows)}</span><span>总量第 {item.gdpRank}<br />人均第 {item.gdpPerCapitaRank}/{item.gdpPerCapitaRankParticipants}</span></div>)}</div>
    </section>
  );
}

function SettingsSection() {
  const [seed, setSeed] = useState("1949");
  const newGame = useSimulationStore((store) => store.newGame);
  const importSave = useSimulationStore((store) => store.importSave);
  const exportSave = useSimulationStore((store) => store.exportSave);
  const handleExport = () => {
    const serialized = exportSave();
    if (!serialized) return;
    const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `中国发展模拟器-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="panel detail-page"><div className="detail-hero"><span className="eyebrow">本地数据</span><h2>存档与新游戏</h2><p>游戏数据只保存在当前浏览器的 IndexedDB，可随时导出。</p></div><div className="settings-grid"><article><h3>开始新游戏</h3><p>输入确定性种子；相同种子和决策会得到相同结果。</p><div className="settings-action"><input value={seed} onChange={(event) => setSeed(event.target.value)} inputMode="numeric" aria-label="随机种子" /><button onClick={() => void newGame(Number(seed) || 1949)}>从 1949 重新开始</button></div></article><article><h3>导入与导出</h3><p>导出文件包含模拟版本、随机状态和完整年度历史。</p><div className="settings-action"><button onClick={handleExport}>导出 JSON 存档</button><label className="file-button">导入存档<input type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(importSave); }} /></label></div></article></div></section>;
}

export function SimulatorDashboard() {
  const store = useSimulationStore();
  const { game, activeSection, darkMode, speed, autoRunning, busy, error, initialize } = store;

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? "dark" : "light"; }, [darkMode]);
  useEffect(() => {
    if (!autoRunning || game?.nation.pendingHistoricalEventId) return;
    const interval = window.setInterval(() => { if (!useSimulationStore.getState().busy) void useSimulationStore.getState().advanceYear(); }, speed === 1 ? 1300 : speed === 5 ? 420 : 180);
    return () => window.clearInterval(interval);
  }, [autoRunning, game?.nation.pendingHistoricalEventId, speed]);

  const sectionTitle = useMemo(() => menuItems.find((item) => item.id === activeSection)?.label ?? "国家总览", [activeSection]);
  if (!game) return <main className="loading-screen"><div className="loading-mark">华</div><h1>中国国家发展模拟器</h1><p>{error ?? "正在启动独立模拟核心…"}</p></main>;
  const displayYear = game.nation.history.annual.at(-1)?.year ?? game.nation.date.year;
  const awaitingHistoricalDecision = Boolean(game.nation.pendingHistoricalEventId);
  const handleRestart = async () => {
    const confirmed = window.confirm(
      "确定重新开始吗？当前进度将被清除，并使用相同随机种子回到 1949 年。",
    );
    if (!confirmed) return;
    await store.newGame(game.seed);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">华</span><div><strong>国家发展模拟器</strong><small>CHINA 1949</small></div></div>
        <nav aria-label="主要导航">{menuItems.map((item) => <button key={item.id} className={activeSection === item.id ? "nav-item active" : "nav-item"} onClick={() => store.setActiveSection(item.id)}><span>{item.mark}</span>{item.label}</button>)}</nav>
        <div className="sidebar-foot"><i /><span>模拟核心在线</span><small>v{game.simulationVersion}</small></div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="page-title"><span>{sectionTitle}</span><h1>{displayYear} 年 · 中华人民共和国</h1></div>
          <div className="top-actions">
            <button className="restart-button" disabled={busy} onClick={() => void handleRestart()}>重新开始</button>
            <button className="theme-button" onClick={() => store.setDarkMode(!darkMode)} aria-label="切换深色模式">{darkMode ? "日" : "夜"}</button>
            <div className="speed-control">{([1, 5, 10] as const).map((value) => <button className={speed === value ? "active" : ""} key={value} onClick={() => store.setSpeed(value)}>{value}×</button>)}</div>
            <button className={autoRunning ? "control-button stop" : "control-button"} disabled={awaitingHistoricalDecision} onClick={() => store.setAutoRunning(!autoRunning)}>{autoRunning ? "暂停" : "自动运行"}</button>
            <button className="primary-button" disabled={busy || awaitingHistoricalDecision} onClick={() => void store.advanceYear()}>{awaitingHistoricalDecision ? "请先决策" : busy ? "结算中…" : "推进一年"}</button>
          </div>
        </header>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="workspace">
          <section className="status-strip"><div><span>当前进度</span><strong>{game.nation.date.year} 年 {game.nation.date.month} 月</strong></div><div><span>随机种子</span><strong>{game.seed}</strong></div><div><span>年度记录</span><strong>{game.nation.history.annual.length}</strong></div>{awaitingHistoricalDecision ? <div className="pending-decision-status"><span>模拟状态</span><strong>等待重大决策</strong></div> : null}<button disabled={busy || awaitingHistoricalDecision || game.nation.date.year > new Date().getFullYear()} onClick={() => void store.runToCurrentYear()}>一键模拟至 {new Date().getFullYear()}</button></section>
          {activeSection === "nation" ? <Overview game={game} darkMode={darkMode} busy={busy} /> : null}
          {activeSection === "policies" ? <PoliciesSection game={game} busy={busy} /> : null}
          {activeSection === "technology" ? <TechnologySection game={game} busy={busy} /> : null}
          {activeSection === "diplomacy" ? <DiplomacySection game={game} busy={busy} /> : null}
          {activeSection === "history" ? <HistoricalEventsSection game={game} /> : null}
          {activeSection === "international" ? <InternationalSection game={game} /> : null}
          {activeSection === "statistics" ? <StatisticsSection game={game} darkMode={darkMode} /> : null}
          {activeSection === "settings" ? <SettingsSection /> : null}
          {!(["nation", "technology", "policies", "diplomacy", "history", "international", "statistics", "settings"] as SectionId[]).includes(activeSection) ? <DetailSection game={game} section={activeSection} /> : null}
        </div>
      </div>
      <HistoricalDecisionModal game={game} busy={busy} />
    </main>
  );
}
