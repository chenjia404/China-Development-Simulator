"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ECharts } from "echarts/core";
import type {
  AnnualSnapshot,
  ComparisonTargetId,
  DiplomaticActionId,
  DiplomaticStrategyId,
  FiscalBudget,
  ForeignPolicyDoctrineId,
  ForeignAidProgramId,
  GameState,
  IndustrialPolicyStance,
  TargetComparisonMetric,
  TechnologyIndustryPathId,
} from "@/src/simulation";
import { formatLarge, formatPercent } from "@/src/ui/format";
import { ShareDialog } from "./share-dialog";
import {
  averageInternationalRelation,
  developmentRouteBlueprints,
  diplomaticActionDefinitions,
  diplomaticStrategyCooldownRemaining,
  diplomaticStrategyDefinitions,
  diplomaticStrategyEffects,
  foreignPolicyDoctrineCooldownRemaining,
  foreignPolicyDoctrineDefinitions,
  foreignPolicyDoctrineEffects,
  getInternationalOrganizationStatus,
  internationalOrganizations,
  getHistoricalEvent,
  getHistoricalEventAxes,
  getHistoricalEventChoice,
  getHistoricalEventChoices,
  composeHistoricalEventAxisChoice,
  getHistoricalInitiativeStatus,
  historicalEventDefinitions,
  historicalInitiativeDefinitions,
  isComparisonTargetId,
  maximumActivePolicies,
  nationalPolicyDefinitions,
  nationalPolicyRequirementBlockers,
  nationalPolicyRequirementDescriptions,
  nationalPolicyImplementationRate,
  calculateTechnologyTreeMetrics,
  calculateIndustrialStructureMetrics,
  compareSimulationWithTarget,
  comparisonTargetOptions,
  getTechnologyNode,
  technologyResearchRequirements,
  technologyTreeDefinitions,
  industrialCategoryDefinitions,
  industrialPolicyChangeCooldownRemaining,
  industrialPolicyEffect,
  foreignAidProgramCooldownRemaining,
  foreignAidProgramDefinitions,
  foreignAidProgramEffects,
  getForeignAidProgram,
  historicalForeignAidTotalsThrough1980,
  getSinoUSNormalizationStatus,
  sinoUSNormalizationDefinition,
  sinoUSNormalizationEffects,
  getTechnologyIndustryPath,
  technologyIndustryEffect,
  technologyIndustryEnergyDemandMultiplier,
  technologyIndustryPathCooldownRemaining,
  technologyIndustryPathDefinitions,
  nationalAccountsProductDefinitions,
  AGE_BAND_IDS,
  enterpriseOwnershipDefinitions,
  economicRegionDefinitions,
  endogenousRiskDefinitions,
  evaluateModelIntegrity,
} from "@/src/simulation";
import {
  type SectionId,
  useSimulationStore,
} from "@/src/ui/simulation-store";
import { formatHistoricalModifier } from "@/src/ui/historical-modifier-text";

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
  const federalism = game.nation.fiscal.federalism;

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
      <div className="fiscal-level-grid">
        <article><span>中央财政</span><strong>{formatLarge(federalism.central.revenue)} / {formatLarge(federalism.central.expenditure)}</strong><p>收入 / 支出 · 债务 {formatLarge(federalism.central.debt)}</p></article>
        <article><span>地方财政</span><strong>{formatLarge(federalism.local.revenue)} / {formatLarge(federalism.local.expenditure)}</strong><p>收入 / 支出 · 债务 {formatLarge(federalism.local.debt)}</p></article>
        <article><span>中央对地方转移支付</span><strong>{formatLarge(federalism.centralToLocalTransfers)}</strong><p>合并财政内部流量，不重复计支出</p></article>
        <article><span>社会保障储备</span><strong>{formatLarge(federalism.socialProtection.reserve)}</strong><p>缴费收入减待遇支出的累计存量</p></article>
      </div>
      <div className="social-protection-grid">
        {([['pension', '养老'], ['medical', '医疗'], ['unemployment', '失业'], ['minimumLiving', '最低生活保障'], ['family', '家庭与儿童']] as const).map(([id, label]) => {
          const account = federalism.socialProtection[id];
          return <article key={id}><strong>{label}</strong><span>待遇 {formatLarge(account.benefitExpenditure)}</span><span>覆盖 {formatLarge(account.beneficiaries)} 人</span><small>人均 {formatLarge(account.averageBenefit)}</small></article>;
        })}
      </div>
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
          <p>{latest ? `${latest.year} 年完整年度对比` : "尚未到达可比年份"}</p>
        </div>
        <ComparisonTargetSelector value={targetId} onChange={setTargetId} />
      </div>
      {latest ? (
        <div className="overview-comparison-grid">
          <div>
            <span>{usesUSD ? "GDP（现价美元）" : "GDP（当年价人民币）"}</span>
            <strong>{currency}{formatLarge(latest.gdp.simulated)}</strong>
            <small className={differenceTone(latest.gdp.relativeDifference)}>
              {comparison.targetLabel} {currency}{formatLarge(latest.gdp.target)} · {differenceLabel(latest.gdp.relativeDifference)}
            </small>
            {latest.gdpUSD ? <em>按当年汇率：本局 ${formatLarge(latest.gdpUSD.simulated)} · 历史 ${formatLarge(latest.gdpUSD.target)}</em> : null}
          </div>
          <div>
            <span>{usesUSD ? "人均 GDP（美元）" : "人均 GDP（当年价人民币）"}</span>
            <strong>{currency}{formatLarge(latest.gdpPerCapita.simulated)}{usesUSD ? "" : " 元"}</strong>
            <small className={differenceTone(latest.gdpPerCapita.relativeDifference)}>
              {comparison.targetLabel} {currency}{formatLarge(latest.gdpPerCapita.target)}{usesUSD ? "" : " 元"} · {differenceLabel(latest.gdpPerCapita.relativeDifference)}
            </small>
            {latest.gdpPerCapitaUSD ? <em>按当年汇率：本局 ${formatLarge(latest.gdpPerCapitaUSD.simulated)} · 历史 ${formatLarge(latest.gdpPerCapitaUSD.target)}</em> : null}
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
          推进到存在完整当年价数据的年度后即可与{comparison.targetLabel}比较。
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSession, setShareSession] = useState(0);
  const growth = previousAnnual && lastAnnual
    ? lastAnnual.realGDP / previousAnnual.realGDP - 1
    : nation.economy.annualRealGDPGrowth;
  const currentPriceGDP = nation.economy.currentPriceGDPPerCapita *
    nation.population.total;
  const currentPeriod = `${nation.date.year} 年 ${nation.date.month} 月`;

  return (
    <>
      <div className="share-overview-toolbar">
        <div>
          <span className="eyebrow">本局战报</span>
          <h2>国家发展成绩</h2>
          <p>生成成绩卡、里程碑或对比海报，便于在社交网络分享。</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShareSession((value) => value + 1);
            setShareOpen(true);
          }}
          disabled={busy}
        >
          分享本局
        </button>
      </div>
      <div className="metrics-grid">
        <MetricCard
          label="GDP（当年价，当前月折年）"
          value={formatLarge(currentPriceGDP)}
          detail={`${currentPeriod} · 实际同比 ${formatPercent(growth)}`}
        />
        <MetricCard label="人均 GDP（当年价）" value={`${formatLarge(nation.economy.currentPriceGDPPerCapita)} 元`} detail={`按当年汇率约 $${formatLarge(nation.economy.currentUSDGDPPerCapita)} · ${currentPeriod}`} tone="gold" />
        <MetricCard label="总人口" value={formatLarge(nation.population.total)} detail={`城市化 ${formatPercent(nation.society.urbanizationRate)}`} tone="red" />
        <MetricCard label="财政余额" value={formatLarge(nation.fiscal.balance)} detail={`债务率 ${formatPercent(nation.fiscal.debtToGDP)}`} tone={nation.fiscal.balance >= 0 ? "green" : "red"} />
        <MetricCard label="科技指数" value={nation.technology.index.toFixed(1)} detail={`采用率 ${formatPercent(nation.technology.adoptionRate)}`} tone="blue" />
        <MetricCard label="世界经济排名" value={`GDP 第 ${game.world.rankings.nominalGDP.china ?? "—"} 名`} detail={`全球人均第 ${nation.economy.globalGDPPerCapitaRank}/${nation.economy.globalGDPPerCapitaParticipants} · 评分 ${lastAnnual?.score.toFixed(1) ?? "—"}`} tone="green" />
      </div>
      <OverviewComparison annual={nation.history.annual} />
      <ShareDialog
        key={shareSession}
        game={game}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
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

function NationalAccountsPanel({ game }: { game: GameState }) {
  const accounts = game.nation.nationalAccounts;
  const bottlenecks = nationalAccountsProductDefinitions
    .map((definition) => ({
      ...definition,
      availability: accounts.products[definition.id].inputAvailability,
    }))
    .toSorted((left, right) => left.availability - right.availability)
    .slice(0, 4);
  const identityErrorRate = accounts.gdpIdentityError /
    Math.max(accounts.productionGDP, 1);
  return (
    <section className="panel national-accounts-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">供给使用表 · 三种GDP口径</span>
          <h2>国民经济账户</h2>
        </div>
        <span>核算误差 {formatPercent(identityErrorRate, 4)}</span>
      </div>
      <div className="detail-grid">
        <article><span>生产法 GDP</span><strong>{formatLarge(accounts.productionGDP)}</strong><p>14类产品增加值合计</p></article>
        <article><span>收入法 GDP</span><strong>{formatLarge(accounts.incomeGDP)}</strong><p>劳动报酬、折旧、生产税与营业盈余</p></article>
        <article><span>支出法 GDP</span><strong>{formatLarge(accounts.expenditureGDP)}</strong><p>消费、资本形成、政府消费与净出口</p></article>
        <article><span>中间投入可得率</span><strong>{formatPercent(accounts.aggregateInputAvailability)}</strong><p>低于临界值后滞后约束下一月生产</p></article>
      </div>
      <div className="account-flow-grid">
        <div><span>居民消费</span><strong>{formatLarge(accounts.householdConsumption)}</strong></div>
        <div><span>资本形成</span><strong>{formatLarge(accounts.grossCapitalFormation + accounts.inventoryChange)}</strong></div>
        <div><span>政府消费</span><strong>{formatLarge(accounts.governmentConsumption)}</strong></div>
        <div><span>净出口</span><strong>{formatLarge(accounts.exports - accounts.imports)}</strong></div>
      </div>
      <div className="account-bottlenecks">
        <span>当前投入瓶颈</span>
        {bottlenecks.map((item) => (
          <div key={item.id}>
            <strong>{item.name}</strong>
            <span>{formatPercent(item.availability)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketDynamicsPanel({ game }: { game: GameState }) {
  const market = game.nation.marketDynamics;
  const productRows = nationalAccountsProductDefinitions.map((definition) => ({
    ...definition,
    ...market.products[definition.id],
  }));
  return (
    <section className="panel market-dynamics-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">相对价格 · 工资 · 库存周期</span>
          <h2>部门市场动态</h2>
        </div>
        <span>产出缺口 {formatPercent(market.outputGap)}</span>
      </div>
      <div className="detail-grid">
        <article><span>居民消费价格 CPI</span><strong>{market.consumerPriceIndex.toFixed(3)}</strong><p>食品、消费品与服务加权</p></article>
        <article><span>工业生产者价格 PPI</span><strong>{market.producerPriceIndex.toFixed(3)}</strong><p>采矿、材料与制造品加权</p></article>
        <article><span>实际工资指数</span><strong>{market.realWageIndex.toFixed(3)}</strong><p>名义工资指数 ÷ CPI</p></article>
        <article><span>综合库存</span><strong>{market.aggregateInventoryMonths.toFixed(2)} 个月</strong><p>过量实物库存滞后抑制生产</p></article>
      </div>
      <div className="product-market-grid">
        {productRows.map((product) => (
          <article key={product.id}>
            <div><strong>{product.name}</strong><span>{product.priceIndex.toFixed(3)}</span></div>
            <p>价格同比 {formatPercent(product.annualPriceInflation)} · 库存 {product.inventoryMonths.toFixed(2)} 月</p>
            <div className={product.inventoryGapRatio > 0.75 ? "inventory-track excess" : "inventory-track"}>
              <i style={{ width: `${Math.min(100, Math.max(0, (product.inventoryGapRatio + 1) / 4 * 100))}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const ageBandLabels = [
  "0—4", "5—9", "10—14", "15—19", "20—24", "25—29",
  "30—34", "35—39", "40—44", "45—49", "50—54", "55—59",
  "60—64", "65—69", "70—74", "75—79", "80—84", "85+",
];

function DemographicDetailPanel({ game }: { game: GameState }) {
  const detail = game.nation.population.demographicDetail;
  return (
    <section className="panel demographic-detail-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">年龄×性别 · 家庭户 · 城乡流动</span><h2>人口队列账户</h2></div>
        <span>性别比 {detail.sexRatio.toFixed(3)}</span>
      </div>
      <div className="detail-grid">
        <article><span>家庭户数</span><strong>{formatLarge(detail.households.householdCount)}</strong><p>户均 {detail.households.averageHouseholdSize.toFixed(2)} 人</p></article>
        <article><span>少儿抚养比</span><strong>{formatPercent(detail.households.childDependencyRatio)}</strong><p>0—14岁 / 15—64岁</p></article>
        <article><span>老年抚养比</span><strong>{formatPercent(detail.households.elderlyDependencyRatio)}</strong><p>65岁及以上 / 15—64岁</p></article>
        <article><span>本月农村转城市</span><strong>{formatLarge(detail.migration.monthlyRuralToUrban)}</strong><p>剔除总人口自然增长后的净流量</p></article>
      </div>
      <div className="cohort-grid">
        {AGE_BAND_IDS.map((id, index) => {
          const cohort = detail.cohorts[id];
          return <article key={id}><strong>{ageBandLabels[index]}岁</strong><span>男 {formatLarge(cohort.male)}</span><span>女 {formatLarge(cohort.female)}</span></article>;
        })}
      </div>
    </section>
  );
}

function AgricultureSystemPanel({ game }: { game: GameState }) {
  const agriculture = game.nation.resources.agriculture;
  return <section className="panel national-accounts-panel">
    <div className="panel-heading"><div><span className="eyebrow">土地 · 单产 · 库存 · 营养</span><h2>农业农村与粮食安全</h2></div><span>自给率 {formatPercent(agriculture.selfSufficiencyRate)}</span></div>
    <div className="detail-grid">
      <article><span>耕地面积</span><strong>{formatLarge(agriculture.cultivatedLandHectares)} 公顷</strong><p>灌溉覆盖 {formatPercent(agriculture.irrigatedLandRate)}</p></article>
      <article><span>粮食单产</span><strong>{formatLarge(agriculture.grainYieldKgPerHectare)} 千克/公顷</strong><p>机械化率 {formatPercent(agriculture.mechanizationRate)}</p></article>
      <article><span>战略粮食储备</span><strong>{formatLarge(agriculture.strategicReserveStock)} 吨</strong><p>可覆盖 {agriculture.reserveCoverageMonths.toFixed(1)} 个月</p></article>
      <article><span>综合粮食保障</span><strong>{formatPercent(agriculture.foodSecurityCoverage)}</strong><p>配给覆盖 {formatPercent(agriculture.rationCoverageRate)}</p></article>
      <article><span>粮食进出口</span><strong>{formatLarge(agriculture.foodImports)} / {formatLarge(agriculture.foodExports)} 吨</strong><p>进口 / 出口年度流量</p></article>
      <article><span>人均营养供给</span><strong>{formatLarge(agriculture.dailyCaloriesPerCapita)} 千卡/日</strong><p>营养压力 {formatPercent(agriculture.nutritionStressIndex)}</p></article>
      <article><span>农村劳动收入</span><strong>{formatLarge(agriculture.ruralIncomePerWorker)}</strong><p>第一产业劳动报酬口径</p></article>
      <article><span>收获后损失</span><strong>{formatLarge(agriculture.postHarvestLoss)} 吨</strong><p>总收获到净产量的损耗</p></article>
    </div>
  </section>;
}

function InfrastructureResourcePanel({ game }: { game: GameState }) {
  const state = game.nation.resources.infrastructureResources;
  const energyNames: Record<string, string> = { coal: "煤炭", oil: "石油", gas: "天然气", hydro: "水电", nuclear: "核电", renewables: "可再生能源" };
  return <section className="panel national-accounts-panel">
    <div className="panel-heading"><div><span className="eyebrow">能源结构 · 运输网络 · 环境约束</span><h2>能源运输与资源环境</h2></div><span>物流效率 {state.logisticsEfficiencyIndex.toFixed(1)}</span></div>
    <div className="account-flow-grid">{Object.values(state.energyMix).map((item) => <div key={item.id}><span>{energyNames[item.id]}</span><strong>{formatPercent(item.share)}</strong></div>)}</div>
    <div className="detail-grid">
      <article><span>发电量</span><strong>{formatLarge(state.electricityGeneration)}</strong><p>电网损耗 {formatPercent(state.gridLossRate)}</p></article>
      <article><span>能源进口依赖</span><strong>{formatPercent(state.energyImportDependence)}</strong><p>油气进口与开放条件相关</p></article>
      <article><span>铁路 / 公路</span><strong>{formatLarge(state.railNetworkKm)} / {formatLarge(state.highwayNetworkKm)} 公里</strong><p>全国运输网络长度</p></article>
      <article><span>货运负荷</span><strong>{formatPercent(state.freightCapacityUtilization)}</strong><p>需求超过能力会压低物流效率</p></article>
      <article><span>碳排放</span><strong>{formatLarge(state.carbonEmissions)}</strong><p>碳强度 {state.carbonIntensity.toExponential(2)}</p></article>
      <article><span>空气污染</span><strong>{state.airPollutionIndex.toFixed(1)}</strong><p>水压力 {formatPercent(state.waterStressIndex)}</p></article>
      <article><span>资源耗竭压力</span><strong>{formatPercent(state.resourceDepletionIndex)}</strong><p>化石能源结构与供需共同决定</p></article>
      <article><span>港口吞吐</span><strong>{formatLarge(state.portThroughputTonnes)} 吨</strong><p>由进出口与开放度形成</p></article>
    </div>
  </section>;
}

function HumanDevelopmentPanel({ game }: { game: GameState }) {
  const state = game.nation.humanDevelopment;
  const stageNames: Record<string, string> = { primary: "小学", secondary: "中学", vocational: "职业教育", higher: "高等教育" };
  const skillNames: Record<string, string> = { basic: "基础劳动", skilled: "技能劳动", advanced: "高级技能", research: "科研人才" };
  return <section className="panel national-accounts-panel">
    <div className="panel-heading"><div><span className="eyebrow">学段 · 技能 · 疾病负担</span><h2>人力发展账户</h2></div><span>技能错配 {formatPercent(state.skillMismatchRate)}</span></div>
    <div className="enterprise-ownership-grid">{Object.values(state.educationStages).map((item) => <article key={item.id}><div><strong>{stageNames[item.id]}</strong><span>{formatPercent(item.enrollmentRate)}</span></div><p>在校 {formatLarge(item.enrolledStudents)} · 毕业 {formatLarge(item.graduates)}</p><small>完成率 {formatPercent(item.completionRate)}</small></article>)}</div>
    <div className="enterprise-ownership-grid">{Object.values(state.laborSkills).map((item) => <article key={item.id}><div><strong>{skillNames[item.id]}</strong><span>{formatLarge(item.employed)}</span></div><p>劳动力 {formatLarge(item.laborForce)} · 失业 {formatPercent(item.unemploymentRate)}</p><small>相对工资 ×{item.relativeWage.toFixed(2)}</small></article>)}</div>
    <div className="detail-grid">
      <article><span>基层医疗覆盖</span><strong>{formatPercent(state.primaryCareCoverage)}</strong><p>预防保健 {formatPercent(state.preventiveCareCoverage)}</p></article>
      <article><span>健康预期寿命</span><strong>{state.healthyLifeExpectancy.toFixed(1)} 岁</strong><p>健康劳动损失 {formatPercent(state.healthRelatedLaborLoss)}</p></article>
      <article><span>传染病负担</span><strong>{formatPercent(state.communicableDiseaseBurden)}</strong><p>慢性病 {formatPercent(state.nonCommunicableDiseaseBurden)}</p></article>
      <article><span>个人医疗负担</span><strong>{formatPercent(state.outOfPocketHealthShare)}</strong><p>床位 {state.hospitalBedsPerThousand.toFixed(1)} / 千人</p></article>
    </div>
  </section>;
}

function UrbanHousingPanel({ game }: { game: GameState }) {
  const housing = game.nation.society.urbanHousing;
  return <section className="panel national-accounts-panel">
    <div className="panel-heading"><div><span className="eyebrow">住房库存 · 土地 · 城市承载</span><h2>住房土地与城市化</h2></div><span>服务覆盖 {formatPercent(housing.urbanServiceCoverage)}</span></div>
    <div className="detail-grid">
      <article><span>城镇住房存量</span><strong>{formatLarge(housing.urbanHousingUnits)} 套</strong><p>在住 {formatLarge(housing.occupiedUnits)} · 空置 {formatLarge(housing.vacantUnits)}</p></article>
      <article><span>住房短缺</span><strong>{formatLarge(housing.housingShortageUnits)} 套</strong><p>空置率 {formatPercent(housing.vacancyRate)}</p></article>
      <article><span>年度竣工</span><strong>{formatLarge(housing.annualNewCompletions)} 套</strong><p>月拆除 {formatLarge(housing.monthlyDemolitions)} 套</p></article>
      <article><span>房价 / 租金指数</span><strong>{housing.homePriceIndex.toFixed(2)} / {housing.rentIndex.toFixed(2)}</strong><p>房价收入比 {housing.priceToIncomeRatio.toFixed(1)}</p></article>
      <article><span>居民租金负担</span><strong>{formatPercent(housing.rentBurdenRate)}</strong><p>住房按揭 {formatLarge(housing.mortgageDebt)}</p></article>
      <article><span>建设用地转用</span><strong>{formatLarge(housing.annualLandConversionHectares)} 公顷/年</strong><p>土地出让收入 {formatLarge(housing.annualLandLeaseRevenue)}</p></article>
      <article><span>非正规住房</span><strong>{formatPercent(housing.informalHousingShare)}</strong><p>短缺与制度执行共同决定</p></article>
      <article><span>城市服务承载</span><strong>{formatLarge(housing.urbanServiceCapacity)} 户</strong><p>住房、交通与公共服务综合容量</p></article>
    </div>
  </section>;
}

function RegionalEconomyPanel({ game }: { game: GameState }) {
  const regional = game.nation.regionalEconomy;
  return <section className="panel national-accounts-panel">
    <div className="panel-heading"><div><span className="eyebrow">区域差距 · 人口 · 资本 · 财政</span><h2>六大区域经济</h2></div><span>最高/最低人均 GDP {regional.regionalGDPPerCapitaRatio.toFixed(2)} 倍</span></div>
    <div className="enterprise-ownership-grid">{economicRegionDefinitions.map((definition) => {
      const item = regional.regions[definition.id];
      return <article key={definition.id}><div><strong>{definition.name}</strong><span>{formatPercent(item.realGDP / Math.max(game.nation.economy.realGDP, 1))}</span></div><p>人口 {formatLarge(item.population)} · GDP {formatLarge(item.realGDP)}</p><p>投资 {formatLarge(item.investment)} · 出口 ${formatLarge(item.exports)}</p><small>迁移 {item.netInterregionalMigration >= 0 ? "+" : ""}{formatLarge(item.netInterregionalMigration)} · 财政净转移 {formatLarge(item.netFiscalTransfer)}</small></article>;
    })}</div>
    <div className="account-flow-grid"><div><span>沿海 GDP</span><strong>{formatPercent(regional.coastalGDPShare)}</strong></div><div><span>西部发展指数</span><strong>{formatPercent(regional.westernDevelopmentIndex)}</strong></div><div><span>区域人口误差</span><strong>{regional.populationError.toFixed(2)}</strong></div><div><span>跨区财政净额</span><strong>{regional.fiscalTransferError.toFixed(2)}</strong></div></div>
  </section>;
}

function SecurityDefensePanel({ game }: { game: GameState }) {
  const state = game.nation.securityDefense;
  return <section className="panel national-accounts-panel">
    <div className="panel-heading"><div><span className="eyebrow">预算 · 动员 · 战备 · 战争损耗</span><h2>国防战争与国家安全</h2></div><span>{state.activeConflictId ? `冲突强度 ${formatPercent(state.conflictIntensity)}` : "当前无战争"}</span></div>
    <div className="detail-grid">
      <article><span>年度国防预算</span><strong>{formatLarge(state.annualDefenseBudget)}</strong><p>装备 {formatLarge(state.equipmentInvestment)} · 后勤 {formatLarge(state.logisticsExpenditure)}</p></article>
      <article><span>现役 / 预备役</span><strong>{formatLarge(state.activePersonnel)} / {formatLarge(state.reservePersonnel)}</strong><p>人员动员规模</p></article>
      <article><span>国防资本存量</span><strong>{formatLarge(state.defenseCapitalStock)}</strong><p>现代化率 {formatPercent(state.equipmentModernizationRate)}</p></article>
      <article><span>综合战备</span><strong>{state.readinessIndex.toFixed(1)}</strong><p>后勤 {state.logisticsReadinessIndex.toFixed(1)} · 战略纵深 {state.strategicDepthIndex.toFixed(1)}</p></article>
      <article><span>军品进口保障</span><strong>{formatPercent(state.militaryImportCoverage)}</strong><p>国内采购 {formatPercent(state.domesticProcurementShare)}</p></article>
      <article><span>累计战争成本</span><strong>{formatLarge(state.cumulativeWarCost)}</strong><p>累计伤亡 {formatLarge(state.cumulativeConflictCasualties)}</p></article>
      <article><span>民用投资机会成本</span><strong>{formatLarge(state.civilianInvestmentOpportunityCost)}</strong><p>高于基准国防占比的资源占用</p></article>
      <article><span>外部威胁</span><strong>{state.externalThreatIndex.toFixed(1)}</strong><p>民防能力 {state.civilDefenseCapacity.toFixed(1)}</p></article>
    </div>
  </section>;
}

function InstitutionCausalityPanel({ game }: { game: GameState }) {
  const state = game.nation.institutions;
  return <section className="panel national-accounts-panel">
    <div className="panel-heading"><div><span className="eyebrow">执行能力 · 政策负荷 · 因果预警</span><h2>制度执行与内生风险图</h2></div><span>有效执行 {formatPercent(state.effectivePolicyExecutionRate)}</span></div>
    <div className="account-flow-grid"><div><span>国家能力</span><strong>{formatPercent(state.stateCapacity)}</strong></div><div><span>地方执行</span><strong>{formatPercent(state.localImplementationCapacity)}</strong></div><div><span>法治可预期性</span><strong>{formatPercent(state.legalPredictability)}</strong></div><div><span>统计数据质量</span><strong>{formatPercent(state.statisticalDataQuality)}</strong></div><div><span>政策负荷</span><strong>{formatPercent(state.policyOverload)}</strong></div><div><span>改革疲劳</span><strong>{formatPercent(state.reformFatigue)}</strong></div></div>
    <div className="enterprise-ownership-grid">{endogenousRiskDefinitions.map((definition) => {
      const risk = state.risks[definition.id];
      return <article key={definition.id}><div><strong>{definition.name}</strong><span>{formatPercent(risk.pressure)}</span></div><p>{risk.primaryDriver}</p><small>{risk.secondaryDriver} · 门槛 {formatPercent(risk.threshold)} · {risk.active ? `连续 ${risk.consecutiveMonths} 月预警` : "未触发"}</small></article>;
    })}</div>
  </section>;
}

function DetailSection({ game, section }: { game: GameState; section: SectionId }) {
  const n = game.nation;
  const data: Record<Exclude<SectionId, "nation" | "policies" | "diplomacy" | "history" | "international" | "statistics" | "settings">, Array<[string, string, string]>> = {
    economy: [["实际 GDP", formatLarge(n.economy.realGDP), "由产业增加值汇总，受内外需求对产能利用的滞后影响"], ["内需规模", formatLarge(n.economy.domesticDemand), `约为名义 GDP 的 ${formatPercent(n.economy.domesticDemandShare)}`], ["居民消费", formatLarge(n.economy.householdConsumption), `消费倾向 ${formatPercent(n.economy.consumptionPropensity)}`], ["社保转移收入", formatLarge(n.economy.socialProtectionIncome), "降低预防性储蓄，但不直接计入 GDP"], ["居民可支配收入", formatLarge(n.economy.householdDisposableIncome), "税后收入、侨汇与社保转移的综合结果"], ["资本存量", formatLarge(n.economy.capitalStock), "含月度折旧"], ["国内储蓄", formatLarge(n.economy.nationalSavings), "投资的重要来源"], ["通胀率", formatPercent(n.economy.inflationRate), `价格指数 ${n.economy.priceLevelIndex.toFixed(2)}`]],
    fiscal: [["财政收入", formatLarge(n.fiscal.revenue), `有效税率 ${formatPercent(n.fiscal.effectiveTaxRate)}`], ["财政支出", formatLarge(n.fiscal.expenditure), "含债务利息；援外为展示归因，不单独叠加"], ["对外援助", formatLarge(n.fiscal.foreignAidExpenditure), "与年度承诺同口径，不增减财政总支出"], ["政府债务", formatLarge(n.fiscal.governmentDebt), `债务率 ${formatPercent(n.fiscal.debtToGDP)}`], ["债务利率", formatPercent(n.fiscal.debtInterestRate), `利息 ${formatLarge(n.fiscal.interestExpense)}`]],
    population: [["儿童人口", formatLarge(n.population.ageGroups.children), "0—14 岁"], ["劳动年龄人口", formatLarge(n.population.ageGroups.workingAge), `参与率 ${formatPercent(n.labor.participationRate)}`], ["老年人口", formatLarge(n.population.ageGroups.elderly), "65 岁及以上"], ["月度自然增长", formatLarge(n.population.monthlyBirths - n.population.monthlyDeaths), `出生率 ${formatPercent(n.population.annualBirthRate)}`]],
    education: [["教育指数", n.education.index.toFixed(1), "长期滞后生效"], ["识字率", formatPercent(n.education.literacyRate), `平均受教育 ${n.education.averageYearsOfSchooling.toFixed(1)} 年`], ["大学招生能力", formatPercent(n.education.higherEducationAdmissionCapacity), `累计严重中断 ${n.education.educationDisruptionMonths} 个月`], ["学术体系连续性", formatPercent(n.education.academicContinuity), "恢复速度慢于停摆速度"], ["科研人才代际缺口", formatPercent(n.education.researchCohortGap), `现有科研人才 ${formatLarge(n.education.researchTalent)}`], ["科研人才永久损失", formatLarge(n.education.permanentResearchTalentLosses), "含迫害死亡与永久离岗"]],
    technology: [["科技指数", n.technology.index.toFixed(1), `采用率 ${formatPercent(n.technology.adoptionRate)}`], ["科研点数", n.technology.researchPoints.toFixed(1), "累计知识存量"], ["本月科研产出", n.technology.monthlyResearchOutput.toFixed(2), "受人才与制度约束"], ["全要素生产率", n.economy.totalFactorProductivity.toFixed(3), "受年度软上限约束"]],
    agriculture: [["农业增加值", formatLarge(n.sectors.primary.valueAdded), `就业 ${formatLarge(n.sectors.primary.employment)}`], ["粮食产量", `${formatLarge(n.resources.foodProduction)} 吨`, "国内生产"], ["粮食需求", `${formatLarge(n.resources.foodDemand)} 吨`, "人口与收入驱动"], ["粮食供应率", formatPercent(n.resources.foodSupplyRatio), n.resources.foodSupplyRatio < 0.95 ? "存在短缺" : "供应稳定"]],
    industry: [["工业增加值", formatLarge(n.sectors.secondary.valueAdded), `产能利用 ${formatPercent(n.sectors.secondary.capacityUtilization)}`], ["工业资本", formatLarge(n.sectors.secondary.capitalStock), "扣除折旧后"], ["工业就业", formatLarge(n.sectors.secondary.employment), `平均工资 ${formatLarge(n.sectors.secondary.averageWage)}`], ["能源供应率", formatPercent(n.resources.energySupplyRatio), "工业主要瓶颈"]],
    infrastructure: [["综合指数", n.economy.infrastructureIndex.toFixed(1), "交通、电网与通信"], ["住房指数", n.society.housingIndex.toFixed(1), "限制城市承载力"], ["城市化率", formatPercent(n.society.urbanizationRate), `${formatLarge(n.population.urbanPopulation)} 城市人口`], ["服务业增加值", formatLarge(n.sectors.tertiary.valueAdded), "受基础设施显著影响"]],
  };
  if (!(section in data)) return null;
  const title = menuItems.find((item) => item.id === section)?.label ?? "国家指标";
  return <section className="panel detail-page"><div className="detail-hero"><span className="eyebrow">国家统计公报</span><h2>{title}</h2><p>所有指标来自独立 Web Worker 中的月度模拟结算。</p></div><div className="detail-grid">{data[section as keyof typeof data].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><p>{note}</p></article>)}</div>{section === "economy" ? <><NationalAccountsPanel game={game} /><MarketDynamicsPanel game={game} /></> : null}{section === "population" ? <><DemographicDetailPanel game={game} /><RegionalEconomyPanel game={game} /></> : null}{section === "fiscal" ? <><BudgetPanel game={game} busy={false} /><SecurityDefensePanel game={game} /><InstitutionCausalityPanel game={game} /></> : null}{section === "agriculture" ? <AgricultureSystemPanel game={game} /> : null}{section === "infrastructure" ? <><InfrastructureResourcePanel game={game} /><UrbanHousingPanel game={game} /></> : null}{section === "education" ? <HumanDevelopmentPanel game={game} /> : null}</section>;
}

function IndustrySection({ game, busy }: { game: GameState; busy: boolean }) {
  const nation = game.nation;
  const setIndustrialPolicy = useSimulationStore(
    (store) => store.setIndustrialPolicy,
  );
  const metrics = calculateIndustrialStructureMetrics(nation);
  const developmentPath = getTechnologyIndustryPath(
    nation.technology.developmentPathId,
  );
  const industrialExports = Object.values(nation.industries).reduce(
    (sum, category) => sum + category.exportValue,
    0,
  );
  const stanceOptions: Array<{
    id: IndustrialPolicyStance;
    label: string;
  }> = [
    { id: "support", label: "扶持" },
    { id: "neutral", label: "中性" },
    { id: "suppress", label: "限制" },
  ];
  const chooseIndustrialPolicy = (
    industryId: (typeof industrialCategoryDefinitions)[number]["id"],
    industryName: string,
    stance: IndustrialPolicyStance,
  ) => {
    const message = stance === "support"
      ? `确定扶持“${industryName}”吗？政策将逐步改善投资、科研、生产率和出口，但会占用财政与信贷资源，并可能积累产业错配。`
      : stance === "suppress"
        ? `确定限制“${industryName}”吗？政策将压低投资、产出和出口，并可能造成失业与供应链冲击。`
        : `确定把“${industryName}”恢复为中性产业政策吗？既有政策强度将逐步退出。`;
    if (window.confirm(message)) {
      void setIndustrialPolicy(industryId, stance);
    }
  };
  return (
    <section className="panel detail-page industry-page">
      <div className="detail-hero industry-hero">
        <span className="eyebrow">产业链 · 技术能力 · 出口结构</span>
        <h2>工业细分结构</h2>
        <p>第二产业拆分为十一类工业。当前“{developmentPath?.name ?? nation.technology.developmentPathId}”路线会改变各类别的扩张权重、生产率和出口竞争力，教育、科技节点、能源、基建、投资与开放度仍共同决定实际产出。</p>
      </div>
      <div className="industry-summary">
        <MetricCard label="工业增加值" value={formatLarge(nation.sectors.secondary.valueAdded)} detail={`占实际 GDP ${formatPercent(nation.sectors.secondary.valueAdded / Math.max(nation.economy.realGDP, 1))}`} tone="blue" />
        <MetricCard label="工业复杂度" value={metrics.complexityIndex.toFixed(1)} detail={`产出能力倍率 ${metrics.outputMultiplier.toFixed(3)}`} tone="green" />
        <MetricCard label="高技术工业" value={formatPercent(metrics.highTechnologyShare)} detail="化工医药、电气电子、精密医疗和高端装备" tone="gold" />
        <MetricCard label="工业品出口" value={`$${formatLarge(industrialExports)}`} detail={`占总出口 ${formatPercent(metrics.industrialExportShare)}`} tone="red" />
        <MetricCard label="产业政策财政成本" value={formatLarge(nation.industrialPolicy.annualFiscalCost)} detail="年度承诺，进入政府支出与赤字闭环" tone="gold" />
        <MetricCard label="行政执行有效性" value={formatPercent(nation.industrialPolicy.administrativeEffectiveness)} detail="同时干预过多行业会稀释执行能力" tone="blue" />
        <MetricCard label="供应链约束" value={formatPercent(nation.industrialPolicy.supplyChainConstraint)} detail="限制上游关键行业会传导至全部工业" tone={nation.industrialPolicy.supplyChainConstraint < 0.98 ? "red" : "green"} />
        <MetricCard label="产业错配指数" value={formatPercent(nation.industrialPolicy.distortionIndex)} detail={`就业调整压力 ${formatPercent(nation.industrialPolicy.laborDisplacementPressure)}`} tone={nation.industrialPolicy.distortionIndex > 0.03 ? "red" : "green"} />
      </div>
      <section className="enterprise-ownership-panel">
        <div className="panel-heading"><div><span className="eyebrow">所有制 · 就业 · 投资 · 出口</span><h2>企业部门账户</h2></div><span>企业约 {formatLarge(nation.enterprises.totalEnterpriseCount)} 家</span></div>
        <div className="enterprise-ownership-grid">
          {enterpriseOwnershipDefinitions.map((definition) => {
            const account = nation.enterprises.ownership[definition.id];
            return <article key={definition.id}><div><strong>{definition.name}</strong><span>{formatPercent(account.valueAddedShare)}</span></div><p>增加值 {formatLarge(account.valueAdded)} · 就业 {formatLarge(account.employment)}</p><p>投资 {formatLarge(account.investment)} · 出口 ${formatLarge(account.exports)}</p><small>生产率 {account.productivityIndex.toFixed(3)} · 融资可得 {formatPercent(account.financingAccess)}</small></article>;
          })}
        </div>
      </section>
      <div className="industry-category-grid">
        {industrialCategoryDefinitions.map((definition) => {
          const category = nation.industries[definition.id];
          const pathEffect = technologyIndustryEffect(nation, definition.id);
          const policy = nation.industrialPolicy.categories[definition.id];
          const policyEffect = industrialPolicyEffect(nation, definition.id);
          const cooldown = industrialPolicyChangeCooldownRemaining(
            nation,
            definition.id,
          );
          const stanceName = stanceOptions.find((option) => option.id === policy.stance)
            ?.label ?? policy.stance;
          return (
            <article
              className="industry-category-card"
              data-industry-id={definition.id}
              key={definition.id}
            >
              <div className="industry-category-head">
                <span>{formatPercent(category.outputShare)}</span>
                <small>技术准备 {formatPercent(category.technologyReadiness, 0)}</small>
              </div>
              <h3>{definition.name}</h3>
              <p>{definition.description}</p>
              <div className="industry-category-values">
                <span><small>增加值</small><strong>{formatLarge(category.valueAdded)}</strong></span>
                <span><small>出口</small><strong>${formatLarge(category.exportValue)}</strong></span>
                <span><small>生产率</small><strong>{category.productivityIndex.toFixed(1)}</strong></span>
              </div>
              <div className="industry-category-track"><i style={{ width: `${category.technologyReadiness * 100}%` }} /></div>
              <div className="industry-category-requirements">
                教育 ≥ {definition.requiredEducationIndex} · 科技 ≥ {definition.requiredTechnologyIndex}
              </div>
              <div className="industry-path-effects">
                路线传导：份额 ×{pathEffect.outputWeightMultiplier.toFixed(2)} · 生产率 ×{pathEffect.productivityMultiplier.toFixed(2)} · 出口 ×{pathEffect.exportMultiplier.toFixed(2)}
              </div>
              <div className={`industrial-policy-control is-${policy.stance}`}>
                <div className="industrial-policy-control-head">
                  <strong>产业政策：{stanceName}</strong>
                  <span>执行强度 {formatPercent(Math.abs(policy.effectiveIntensity))}</span>
                </div>
                <div className="industrial-policy-buttons">
                  {stanceOptions.map((option) => (
                    <button
                      className={policy.stance === option.id ? "active" : ""}
                      disabled={busy || policy.stance === option.id || cooldown > 0}
                      key={option.id}
                      onClick={() => chooseIndustrialPolicy(
                        definition.id,
                        definition.name,
                        option.id,
                      )}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <small>
                  {cooldown > 0
                    ? `政策调整冷却还剩 ${cooldown} 个月`
                    : "每次调整后六个月内不能再次修改"}
                </small>
                <p>
                  当前传导：份额 ×{policyEffect.outputWeightMultiplier.toFixed(2)} ·
                  投资 ×{policyEffect.investmentMultiplier.toFixed(2)} ·
                  生产率 ×{policyEffect.productivityMultiplier.toFixed(2)} ·
                  出口 ×{policyEffect.exportMultiplier.toFixed(2)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TechnologySection({ game, busy }: { game: GameState; busy: boolean }) {
  const nation = game.nation;
  const technology = nation.technology;
  const metrics = calculateTechnologyTreeMetrics(nation);
  const selectTechnologyResearch = useSimulationStore(
    (store) => store.selectTechnologyResearch,
  );
  const setTechnologyIndustryPath = useSimulationStore(
    (store) => store.setTechnologyIndustryPath,
  );
  const currentPath = getTechnologyIndustryPath(technology.developmentPathId);
  const pathCooldown = technologyIndustryPathCooldownRemaining(nation);
  const pathProgress = technology.developmentPathProgress;
  const chooseDevelopmentPath = (
    pathId: TechnologyIndustryPathId,
    name: string,
  ) => {
    const confirmed = window.confirm(
      `确定改为“${name}”吗？路线将在 48 个月内逐步完成转型，当前研究进度损失 35%，并在 36 个月内不能再次调整。`,
    );
    if (confirmed) void setTechnologyIndustryPath(pathId);
  };
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
        <MetricCard label="科技能力" value={technology.index.toFixed(1)} detail={`学术连续性 ${formatPercent(nation.education.academicContinuity)} · 人才缺口 ${formatPercent(nation.education.researchCohortGap)}`} tone="blue" />
        <MetricCard label="已掌握节点" value={`${metrics.completedCount} / ${metrics.totalCount}`} detail={`产业科技第 ${metrics.industryTier} / ${metrics.industryTierCount} 层`} tone="green" />
        <MetricCard label="产业升级准备度" value={formatPercent(metrics.industrialUpgradeReadiness)} detail={`有效产业科技 ${metrics.effectiveIndustrialTechnology.toFixed(1)} / ${technology.index.toFixed(1)}`} tone={metrics.industrialUpgradeReadiness >= 0.6 ? "green" : "red"} />
        <MetricCard label="当前研究" value={activeNode?.name ?? "等待能力条件"} detail={activeNode ? `${technology.activeResearchProgress.toFixed(1)} / ${activeNode.researchCost} · 本月 ${technology.monthlyResearchOutput.toFixed(2)}` : "无可研究节点时科研仍积累为知识存量"} tone="gold" />
      </div>
      <section className="technology-path-panel">
        <div className="technology-path-heading">
          <div>
            <span className="eyebrow">长期科研与产业取向</span>
            <h2>科技工业发展路线</h2>
            <p>路线决定自动科研优先级、专项与非专项研究效率，并在 48 个月内逐步改变工业份额、生产率、能源需求和出口能力。科技前置条件不会被跳过，玩家仍可手动选择单个科技节点。</p>
          </div>
          <div className="technology-path-current">
            <span>当前路线</span>
            <strong>{currentPath?.name ?? technology.developmentPathId}</strong>
            <small>{pathProgress >= 1 ? "路线已稳定" : `转型中 · ${(pathProgress * 100).toFixed(0)}%`}</small>
          </div>
        </div>
        <div className="technology-path-live-effects">
          <span>能源需求 ×{technologyIndustryEnergyDemandMultiplier(nation).toFixed(2)}</span>
          <span>转型周期 48 个月</span>
          <span>调整冷却 {pathCooldown > 0 ? `${pathCooldown} 个月` : "已结束"}</span>
          <span>切换损失当前研究进度 35%</span>
        </div>
        <div className="technology-path-grid">
          {technologyIndustryPathDefinitions.map((path) => {
            const selected = path.id === technology.developmentPathId;
            const unavailableReason = selected
              ? "当前正在采用"
              : pathCooldown > 0
                ? `还需冷却 ${pathCooldown} 个月`
                : null;
            const focusedTechnologies = path.preferredTechnologyIds
              .map((id) => getTechnologyNode(id)?.name ?? id)
              .slice(0, 5);
            const affectedIndustries = Object.entries(path.industryEffects)
              .map(([industryId, effect]) => {
                const industry = industrialCategoryDefinitions.find(
                  (definition) => definition.id === industryId,
                );
                return `${industry?.name ?? industryId} ${effect.outputWeightMultiplier >= 1 ? "+" : ""}${((effect.outputWeightMultiplier - 1) * 100).toFixed(0)}%`;
              });
            return (
              <article className={selected ? "technology-path-card is-selected" : "technology-path-card"} key={path.id}>
                <div className="technology-path-card-head"><span>{path.shortName}</span><small>能源 ×{path.energyDemandMultiplier.toFixed(2)}</small></div>
                <h3>{path.name}</h3>
                <p>{path.description}</p>
                <div className="technology-path-effects">{path.effects.map((effect) => <span key={effect}>{effect}</span>)}</div>
                <div className="technology-path-numbers">
                  <span>专项科研 ×{path.focusedResearchMultiplier.toFixed(2)}</span>
                  <span>非专项科研 ×{path.unfocusedResearchMultiplier.toFixed(2)}</span>
                </div>
                <div className="technology-path-focus"><strong>优先科技</strong><span>{focusedTechnologies.length > 0 ? focusedTechnologies.join("、") : "保持科技树通用顺序"}</span></div>
                <div className="technology-path-focus"><strong>产业倾斜</strong><span>{affectedIndustries.length > 0 ? affectedIndustries.join(" · ") : "保持完整产业链，不额外倾斜"}</span></div>
                <button
                  disabled={busy || unavailableReason !== null}
                  title={unavailableReason ?? undefined}
                  onClick={() => chooseDevelopmentPath(path.id, path.name)}
                >
                  {selected ? "当前路线" : unavailableReason ?? "选择发展路线"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
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
              <div className="technology-industry-effects">
                <strong>工业影响</strong>
                {node.industrialEffects.map((effect) => {
                  const industryName = industrialCategoryDefinitions.find(
                    (industry) => industry.id === effect.industryId,
                  )?.name ?? effect.industryId;
                  return <span key={effect.industryId}>{industryName} · 产能 +{((effect.productivityMultiplier - 1) * 100).toFixed(0)}% · 出口 +{((effect.exportMultiplier - 1) * 100).toFixed(0)}%</span>;
                })}
              </div>
              {!completed && requirements.length > 0 ? <p className="technology-blockers">{requirements.join("；")}</p> : null}
              <button disabled={busy || completed || active || !available} onClick={() => void selectTechnologyResearch(node.id)}>{completed ? "已掌握" : active ? "研究中" : available ? "设为研究目标" : "能力不足"}</button>
            </article>
          );
        })}
      </div>
      <p className="panel-note">没有手动指定目标时，模拟器会根据发展路线确定性选择当前可研究节点；手动研究路线外科技不会被禁止，但将采用该路线的非专项研究效率。更换单个研究目标会重新开始该节点的研究进度。</p>
    </section>
  );
}

function policyUnavailableReason(game: GameState, policyId: string): string | null {
  if (game.nation.policies.includes(policyId)) return null;
  if (game.nation.policies.length >= maximumActivePolicies) {
    return `同时最多实施 ${maximumActivePolicies} 项国策`;
  }
  const policy = nationalPolicyDefinitions.find((item) => item.id === policyId);
  const requirementBlockers = nationalPolicyRequirementBlockers(
    game.nation,
    policyId,
  );
  if (requirementBlockers.length > 0) return requirementBlockers.join("；");
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
          const requirementDescriptions = nationalPolicyRequirementDescriptions(policy);
          return (
            <article className={selected ? "policy-card is-selected" : "policy-card"} key={policy.id}>
              <div className="policy-card-head"><span>{policy.category}</span><small>{policy.transitionMonths} 个月过渡</small></div>
              <h3>{policy.name}</h3>
              <p>{policy.description}</p>
              {requirementDescriptions.length > 0 ? (
                <div className="policy-requirements">
                  <strong>启动门槛</strong>
                  <span>{requirementDescriptions.join(" · ")}</span>
                </div>
              ) : null}
              <div className="policy-progress"><i style={{ width: `${progress * 100}%` }} /></div>
              <div className="policy-meta"><span>生效程度 {formatPercent(progress, 0)}</span><span>{conflicts ? `互斥：${conflicts}` : "无互斥国策"}</span></div>
              {policy.id === "compulsory_education_implementation" ? <div className="policy-capability">当前落实率 {formatPercent(nationalPolicyImplementationRate(game.nation, policy.id))}；预算或执行能力低于门槛后，教育收益会按比例下降，财政承诺仍保留。</div> : null}
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
                <span>{initiative.availableFromYear === undefined
                  ? "无固定年份限制"
                  : `最早 ${initiative.availableFromYear} 年`}</span>
                <span>{initiativeCostLabel}</span>
                <span>调整期 {formatEventDuration(initiative.transitionDurationMonths)}</span>
              </div>
              <div className="initiative-effects">
                <strong>实施影响</strong>
                {initiative.transitionEffects.map((effect) => (
                  <span key={effect}>{effect}</span>
                ))}
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
  const setForeignPolicyDoctrine = useSimulationStore(
    (store) => store.setForeignPolicyDoctrine,
  );
  const setForeignAidProgram = useSimulationStore(
    (store) => store.setForeignAidProgram,
  );
  const startSinoUSNormalization = useSimulationStore(
    (store) => store.startSinoUSNormalization,
  );
  const countries = [...game.world.countries].sort((first, second) =>
    second.nominalGDP - first.nominalGDP,
  );
  const currentStrategy = diplomaticStrategyDefinitions.find(
    (strategy) => strategy.id === game.nation.diplomacy.strategyId,
  );
  const currentStrategyEffects = diplomaticStrategyEffects(game.nation);
  const strategyCooldown = diplomaticStrategyCooldownRemaining(game);
  const currentDoctrine = foreignPolicyDoctrineDefinitions.find(
    (doctrine) => doctrine.id === game.nation.diplomacy.foreignPolicyDoctrineId,
  );
  const currentDoctrineEffects = foreignPolicyDoctrineEffects(game.nation);
  const doctrineCooldown = foreignPolicyDoctrineCooldownRemaining(game);
  const doctrineProgress = game.nation.diplomacy.foreignPolicyDoctrineProgress;
  const currentAidProgram = getForeignAidProgram(
    game.nation.diplomacy.foreignAidProgramId,
  );
  const aidProgramEffects = foreignAidProgramEffects(game.nation);
  const aidCooldown = foreignAidProgramCooldownRemaining(game.nation);
  const aidProgress = game.nation.diplomacy.foreignAidProgramProgress;
  const historicalAidTotals = historicalForeignAidTotalsThrough1980();
  const normalizationStatus = getSinoUSNormalizationStatus(game);
  const normalizationEffects = sinoUSNormalizationEffects(game.nation);
  const normalizationState = game.nation.diplomacy.sinoUSNormalizationStatus;
  const normalizationStarted = game.nation.diplomacy.sinoUSNormalizationStartedYear === null
    ? "尚未启动"
    : `${game.nation.diplomacy.sinoUSNormalizationStartedYear}年${game.nation.diplomacy.sinoUSNormalizationStartedMonth}月`;
  const normalizationEstablished =
    game.nation.diplomacy.sinoUSNormalizationEstablishedYear === null
      ? "尚未建交"
      : `${game.nation.diplomacy.sinoUSNormalizationEstablishedYear}年${game.nation.diplomacy.sinoUSNormalizationEstablishedMonth}月`;
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
  const chooseDoctrine = (doctrineId: ForeignPolicyDoctrineId, name: string) => {
    const confirmed = window.confirm(
      `确定采用“${name}”吗？外交学说独立于亲苏、平衡或亲西方取向，调整将消耗外交点数，并在 60 个月内不能再次改变。`,
    );
    if (confirmed) void setForeignPolicyDoctrine(doctrineId);
  };
  const chooseForeignAidProgram = (
    programId: ForeignAidProgramId,
    name: string,
  ) => {
    const confirmed = window.confirm(
      `确定采用“${name}”吗？援外承诺将在 12 个月内调整到位，并在 24 个月内不能再次改变；财政、设备、科研、外汇和受援国关系都会随之变化。`,
    );
    if (confirmed) void setForeignAidProgram(programId);
  };
  const beginSinoUSNormalization = () => {
    const confirmed = window.confirm(
      `确定发动“推动中美建交”吗？将消耗 ${sinoUSNormalizationDefinition.activationCost} 点外交点数，并进入约 ${normalizationStatus.estimatedNegotiationMonths} 个月的谈判；建交会改善对美合作和西方市场渠道，也会调整对苏联、朝鲜的关系目标。`,
    );
    if (confirmed) void startSinoUSNormalization();
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
      <section className="diplomatic-strategy-panel doctrine-panel">
        <div className="strategy-panel-heading">
          <div>
            <span className="eyebrow">对外行为准则</span>
            <h2>外交学说</h2>
            <p>外交学说与阵营取向相互独立，可以自由组合。放弃对外革命、和平共处会改善美国、日本、韩国等非苏系国家关系，但降低苏联、朝鲜、越南等苏系国家关系；所有变化均在三年内逐步传导。</p>
          </div>
          <div className="strategy-current">
            <span>当前学说</span>
            <strong>{currentDoctrine?.name ?? game.nation.diplomacy.foreignPolicyDoctrineId}</strong>
            <small>{doctrineProgress >= 1 ? "学说已稳定" : `调整中 · ${(doctrineProgress * 100).toFixed(0)}%`}</small>
          </div>
        </div>
        <div className="strategy-live-effects">
          <span>市场准入 ×{currentDoctrineEffects.marketAccessMultiplier.toFixed(2)}</span>
          <span>外资 ×{currentDoctrineEffects.foreignInvestmentMultiplier.toFixed(2)}</span>
          <span>技术扩散 ×{currentDoctrineEffects.technologyDiffusionMultiplier.toFixed(2)}</span>
          <span>科研产出 ×{currentDoctrineEffects.researchOutputMultiplier.toFixed(2)}</span>
          <span>安全目标 {currentDoctrineEffects.securityTargetAdjustment >= 0 ? "+" : ""}{currentDoctrineEffects.securityTargetAdjustment.toFixed(1)}</span>
          <span>声誉目标 {currentDoctrineEffects.reputationTargetAdjustment >= 0 ? "+" : ""}{currentDoctrineEffects.reputationTargetAdjustment.toFixed(1)}</span>
          <span>外交点/月 {currentDoctrineEffects.monthlyPointGainAdjustment >= 0 ? "+" : ""}{currentDoctrineEffects.monthlyPointGainAdjustment.toFixed(2)}</span>
        </div>
        <div className="strategy-grid doctrine-grid">
          {foreignPolicyDoctrineDefinitions.map((doctrine) => {
            const selected = doctrine.id === game.nation.diplomacy.foreignPolicyDoctrineId;
            const insufficientPoints = game.nation.diplomacy.diplomaticPoints <
              doctrine.activationCost;
            const unavailableReason = selected
              ? "当前正在采用"
              : doctrineCooldown > 0
                ? `还需冷却 ${doctrineCooldown} 个月`
                : insufficientPoints
                  ? `需要 ${doctrine.activationCost} 点外交点数`
                  : null;
            return (
              <article className={selected ? "strategy-card is-selected" : "strategy-card"} key={doctrine.id}>
                <div className="strategy-card-head"><span>{doctrine.shortName}</span><small>调整成本 {doctrine.activationCost} 点</small></div>
                <h3>{doctrine.name}</h3>
                <p>{doctrine.description}</p>
                <div className="strategy-effects">{doctrine.effects.map((effect) => <span key={effect}>{effect}</span>)}</div>
                <div className="strategy-numbers">
                  <span>贸易 ×{doctrine.marketAccessMultiplier.toFixed(2)}</span>
                  <span>外资 ×{doctrine.foreignInvestmentMultiplier.toFixed(2)}</span>
                  <span>技术 ×{doctrine.technologyDiffusionMultiplier.toFixed(2)}</span>
                  <span>科研 ×{doctrine.researchOutputMultiplier.toFixed(2)}</span>
                  <span>安全 {doctrine.securityTargetAdjustment >= 0 ? "+" : ""}{doctrine.securityTargetAdjustment}</span>
                  <span>声誉 {doctrine.reputationTargetAdjustment >= 0 ? "+" : ""}{doctrine.reputationTargetAdjustment}</span>
                </div>
                <button
                  disabled={busy || unavailableReason !== null}
                  title={unavailableReason ?? undefined}
                  onClick={() => chooseDoctrine(doctrine.id, doctrine.name)}
                >
                  {selected ? "当前学说" : unavailableReason ?? `采用学说 · ${doctrine.activationCost} 点`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <section className="diplomatic-strategy-panel normalization-panel">
        <div className="strategy-panel-heading">
          <div>
            <span className="eyebrow">一次性外交国策 · 可提前或延迟</span>
            <h2>中美建交进程</h2>
            <p>史实节点为1979年1月。玩家可以在关系和国家能力达标后提前发动，也可以继续延迟；提前形成的留学生、科研、技术设备、出口客户和外资渠道会逐月积累，延迟造成的是无法事后一次补回的存量差距。</p>
          </div>
          <div className="strategy-current">
            <span>当前状态</span>
            <strong>{normalizationState === "established" ? "已经建交" : normalizationState === "negotiating" ? "谈判进行中" : "尚未启动"}</strong>
            <small>{normalizationState === "negotiating" ? `谈判进度 ${(game.nation.diplomacy.sinoUSNormalizationNegotiationProgress * 100).toFixed(0)}%` : normalizationEstablished}</small>
          </div>
        </div>
        <div className="normalization-metrics">
          <div><span>对美关系</span><strong>{normalizationStatus.usRelation.toFixed(1)}</strong><small>发动门槛 {sinoUSNormalizationDefinition.minimumUSRelation}</small></div>
          <div><span>谈判启动</span><strong>{normalizationStarted}</strong><small>预计谈判 {normalizationStatus.estimatedNegotiationMonths} 个月</small></div>
          <div><span>合作成熟度</span><strong>{formatPercent(normalizationEffects.cooperationProgress, 0)}</strong><small>约用五年形成完整渠道</small></div>
          <div><span>相对史实延迟</span><strong>{game.nation.diplomacy.sinoUSNormalizationDelayMonths} 个月</strong><small>{normalizationStatus.historicalDatePassed ? "正在累积机会成本" : "1979年1月前不计延迟"}</small></div>
        </div>
        <div className="strategy-live-effects">
          <span>市场准入 ×{normalizationEffects.marketAccessMultiplier.toFixed(3)}</span>
          <span>外资信心 ×{normalizationEffects.foreignInvestmentMultiplier.toFixed(3)}</span>
          <span>技术扩散 ×{normalizationEffects.technologyDiffusionMultiplier.toFixed(3)}</span>
          <span>科研产出 ×{normalizationEffects.researchOutputMultiplier.toFixed(3)}</span>
          <span>教育交流 ×{normalizationEffects.educationExchangeMultiplier.toFixed(3)}</span>
          <span>出口竞争力 ×{normalizationEffects.exportCompetitivenessMultiplier.toFixed(3)}</span>
          <span>吸收能力 {formatPercent(normalizationEffects.absorptionReadiness, 0)}</span>
        </div>
        <div className="normalization-policy-action">
          <div>
            <strong>贸易、科技与教育传导</strong>
            <p>1979年建交后，双边贸易由1978年的约11亿美元增至1979年的23亿美元，1980年约40亿美元；同年签署科技、文化及留学生交流安排。模型把这些变化拆入双边关系、贸易协定、大学与科研人才、技术扩散、外资和出口，不直接给 GDP 加固定值。</p>
            {normalizationState === "not_started" && normalizationStatus.blockers.length > 0 ? <p className="normalization-blockers">尚需：{normalizationStatus.blockers.join("；")}</p> : null}
          </div>
          <button
            disabled={busy || !normalizationStatus.available}
            title={normalizationStatus.blockers.join("；") || undefined}
            onClick={beginSinoUSNormalization}
          >
            {normalizationState === "established" ? "中美已经建交" : normalizationState === "negotiating" ? "建交谈判进行中" : normalizationStatus.available ? `发动国策 · ${sinoUSNormalizationDefinition.activationCost} 点` : "条件尚未满足"}
          </button>
        </div>
        <p className="panel-note">史实时间的经济倍率是校准中性基线；提前路线获得更早的积累，延迟路线在未建交期间低于史实合作进度。正式建交约一年后会形成对美贸易协定渠道，同时改善美国、日本、韩国关系目标，并使苏联、朝鲜关系目标承受有限调整。</p>
      </section>
      <section className="diplomatic-strategy-panel foreign-aid-panel">
        <div className="strategy-panel-heading">
          <div>
            <span className="eyebrow">财政承诺 · 受援伙伴 · 国内机会成本</span>
            <h2>对外援助方案</h2>
            <p>史实路线按1950—1980年约365亿元人民币、当年官方汇率约170亿美元记录。玩家可以停止、缩减、改变受援方向或扩大援助；变化不会直接修改 GDP，而是通过国内投资、工业设备、科研人员、外汇、出口网络、国际声誉和相关国家关系逐月传导。界面中的财政归因与年度承诺同口径，仅作展示，不抬高财政总支出。</p>
          </div>
          <div className="strategy-current">
            <span>当前方案</span>
            <strong>{currentAidProgram?.name ?? game.nation.diplomacy.foreignAidProgramId}</strong>
            <small>{aidProgress >= 1 ? "方案已稳定" : `调整中 · ${(aidProgress * 100).toFixed(0)}%`}</small>
          </div>
        </div>
        <div className="foreign-aid-metrics">
          <div><span>1949—1980累计</span><strong>{formatLarge(game.nation.diplomacy.cumulativeForeignAidRMBThrough1980)} 元</strong><small>史实参考 {formatLarge(historicalAidTotals.rmb)} 元</small></div>
          <div><span>官方汇率美元等值</span><strong>${formatLarge(game.nation.diplomacy.cumulativeForeignAidUSDThrough1980)}</strong><small>史实参考 ${formatLarge(historicalAidTotals.usd)}</small></div>
          <div><span>当前年度承诺</span><strong>{formatLarge(game.nation.diplomacy.annualForeignAidRMB)} 元</strong><small>约 ${formatLarge(game.nation.diplomacy.annualForeignAidUSD)}</small></div>
          <div><span>年度援外用汇</span><strong>${formatLarge(game.nation.diplomacy.annualForeignAidForeignExchangeOutflow)}</strong><small>财政归因 {formatLarge(game.nation.fiscal.foreignAidExpenditure)}</small></div>
        </div>
        <div className="strategy-live-effects">
          <span>国内投资 ×{aidProgramEffects.domesticInvestmentMultiplier.toFixed(3)}</span>
          <span>科研产出 ×{aidProgramEffects.researchOutputMultiplier.toFixed(3)}</span>
          <span>工业生产率 ×{aidProgramEffects.industrialProductivityMultiplier.toFixed(3)}</span>
          <span>出口竞争力 ×{aidProgramEffects.exportCompetitivenessMultiplier.toFixed(3)}</span>
          <span>调整冷却 {aidCooldown > 0 ? `${aidCooldown} 个月` : "已结束"}</span>
        </div>
        <div className="strategy-grid foreign-aid-grid">
          {foreignAidProgramDefinitions.map((program) => {
            const selected = program.id === game.nation.diplomacy.foreignAidProgramId;
            const insufficientPoints = game.nation.diplomacy.diplomaticPoints <
              program.activationCost;
            const unavailableReason = selected
              ? "当前正在采用"
              : aidCooldown > 0
                ? `还需冷却 ${aidCooldown} 个月`
                : insufficientPoints
                  ? `需要 ${program.activationCost} 点外交点数`
                  : null;
            const recipientNames = program.recipientCountryIds.map(
              (countryId) => game.world.countries.find(
                (country) => country.id === countryId,
              )?.name ?? countryId,
            );
            return (
              <article className={selected ? "strategy-card aid-program-card is-selected" : "strategy-card aid-program-card"} key={program.id}>
                <div className="strategy-card-head"><span>{program.shortName}</span><small>调整成本 {program.activationCost} 点</small></div>
                <h3>{program.name}</h3>
                <p>{program.description}</p>
                <div className="strategy-effects">{program.effects.map((effect) => <span key={effect}>{effect}</span>)}</div>
                <div className="strategy-numbers aid-program-numbers">
                  <span>国内投资 ×{program.domesticInvestmentMultiplier.toFixed(3)}</span>
                  <span>科研 ×{program.researchOutputMultiplier.toFixed(3)}</span>
                  <span>工业 ×{program.industrialProductivityMultiplier.toFixed(3)}</span>
                  <span>出口 ×{program.exportCompetitivenessMultiplier.toFixed(3)}</span>
                  <span>财政/GDP {formatPercent(program.fiscalShareOfGDP, 2)}</span>
                  <span>援外用汇 {formatPercent(program.foreignExchangeShare, 0)}</span>
                </div>
                <div className="aid-recipient-list"><strong>重点受援国</strong><span>{recipientNames.length > 0 ? recipientNames.join("、") : "不安排政府援助"}</span></div>
                <button
                  disabled={busy || unavailableReason !== null}
                  title={unavailableReason ?? undefined}
                  onClick={() => chooseForeignAidProgram(program.id, program.name)}
                >
                  {selected ? "当前方案" : unavailableReason ?? `采用方案 · ${program.activationCost} 点`}
                </button>
              </article>
            );
          })}
        </div>
        <p className="panel-note">史实综合援外是历史校准的中性基线。暂停援助会把原有资源转回国内，但不会凭空增加财政收入；经贸与技术合作可能改善工业经验和出口网络，大规模援助则以更强关系和声誉换取更高国内机会成本。</p>
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

function formatMortalityPeople(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  if (abs >= 10_000) {
    const wan = rounded / 10_000;
    const text = Math.abs(wan) >= 100
      ? wan.toFixed(0)
      : wan.toFixed(1).replace(/\.0$/, "");
    return `${text} 万人`;
  }
  return `${rounded.toLocaleString("zh-CN")} 人`;
}

function FamineMortalityReportModal({
  game,
  busy,
}: {
  game: GameState;
  busy: boolean;
}) {
  const dismiss = useSimulationStore((store) => store.dismissFamineMortalityReport);
  const report = game.nation.famineMortality?.pendingReport;
  if (!report) return null;

  const excessPositive = report.excessDeaths > 0;
  const excessNearZero = Math.abs(report.excessDeaths) < 50_000;

  return (
    <div className="historical-decision-overlay">
      <section
        className="historical-decision-modal famine-mortality-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="famine-mortality-title"
      >
        <header className="historical-decision-header">
          <div>
            <span className="eyebrow">三年经济困难 · 阶段结算</span>
            <h2 id="famine-mortality-title">
              {report.windowStartYear}—{report.windowEndYear} 年人口损失报告
            </h2>
            <p>
              以 1955—1957 年本局年均死亡为常态基线，估算危机三年内的超额死亡。
              该口径对应人口学上的非正常死亡近似，不等于年末人口净减，也不包含少出生人口。
              报告在 1961 年 12 月结算完成后弹出；确认前暂停推进。
            </p>
          </div>
          <span className={`decision-impact ${excessPositive ? "negative" : "mixed"}`}>
            {excessNearZero ? "接近常态" : excessPositive ? "超额死亡" : "低于常态"}
          </span>
        </header>
        {!report.accountComplete ? (
          <p className="famine-mortality-warning">
            本局未完整跨越 1955—1961 年（或缺基线月），超额死亡为弱估计，仅供参考。
          </p>
        ) : null}
        <div className="famine-mortality-stats">
          <article>
            <span>估计超额死亡</span>
            <strong className={excessPositive ? "is-loss" : "is-relief"}>
              {excessNearZero
                ? "约 0"
                : `${excessPositive ? "" : "约减少 "}${formatMortalityPeople(Math.abs(report.excessDeaths))}`}
            </strong>
            <small>
              = 窗口累计死亡 − 常态基线 × {report.windowEndYear - report.windowStartYear + 1} 年
            </small>
          </article>
          <article>
            <span>窗口内累计死亡</span>
            <strong>{formatMortalityPeople(report.totalDeaths)}</strong>
            <small>
              {report.windowStartYear}—{report.windowEndYear} 年合计
            </small>
          </article>
          <article>
            <span>常态基线（三年）</span>
            <strong>{formatMortalityPeople(report.expectedBaselineDeaths)}</strong>
            <small>
              年均 {formatMortalityPeople(report.baselineAnnualAverage)}
              {report.baselineSource === "recorded"
                ? " · 1955—1957 完整记录"
                : report.baselineSource === "partial"
                  ? " · 基线月不完整"
                  : " · 合成基线"}
            </small>
          </article>
        </div>
        {report.choiceName ? (
          <div className="event-choice-result">
            <span>危机应对方案</span>
            <strong>{report.choiceName}</strong>
            <p>不同粮食贸易与救济组合会显著改变超额死亡规模。</p>
          </div>
        ) : null}
        <p className="historical-decision-note">
          确认后继续推进时间。报告会保留在本局状态中，可在之后对照不同决策路径。
        </p>
        <div className="famine-mortality-actions">
          <button type="button" disabled={busy} onClick={() => void dismiss()}>
            {busy ? "处理中…" : "已知晓，继续"}
          </button>
        </div>
      </section>
    </div>
  );
}

function HistoricalDecisionModal({ game, busy }: { game: GameState; busy: boolean }) {
  const resolveHistoricalEvent = useSimulationStore(
    (store) => store.resolveHistoricalEvent,
  );
  const pendingId = game.nation.pendingHistoricalEventId;
  const event = pendingId ? getHistoricalEvent(pendingId) : undefined;
  const axes = event ? getHistoricalEventAxes(event, game.nation) : [];
  const choices = event ? getHistoricalEventChoices(event, game.nation) : [];
  const [axisSelections, setAxisSelections] = useState(() =>
    axes.map((axis) =>
      (axis.options.find((option) => option.isHistoricalDefault) ??
        axis.options[0]).id
    ),
  );

  if (!event) return null;

  const preview = axes.length > 0
    ? composeHistoricalEventAxisChoice(event, axisSelections, game.nation)
    : undefined;
  const confirmAxisChoice = () => {
    if (!preview) return;
    void resolveHistoricalEvent(event.id, preview.id);
  };

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
        {axes.length > 0 ? (
          <>
            <div className="historical-axis-board">
              {axes.map((axis, axisIndex) => (
                <section className="historical-axis-panel" key={axis.id}>
                  <header>
                    <span className="eyebrow">第 {axisIndex + 1} 轴</span>
                    <h3>{axis.name}</h3>
                    {axis.description ? <p>{axis.description}</p> : null}
                  </header>
                  <div className="historical-choice-grid historical-axis-options">
                    {axis.options.map((option) => {
                      const selected = axisSelections[axisIndex] === option.id;
                      return (
                        <article
                          className={`historical-choice ${selected ? "is-selected" : ""} ${option.isHistoricalDefault ? "is-historical" : ""}`}
                          key={option.id}
                        >
                          <div className="historical-choice-head">
                            <span>
                              {option.isHistoricalDefault ? "史实默认" : "可选"}
                            </span>
                            <small>持续 {formatEventDuration(option.durationMonths)}</small>
                          </div>
                          <h3>{option.name}</h3>
                          <p>{option.description}</p>
                          <div className="historical-choice-effects">
                            {option.effects.map((effect) => (
                              <span key={effect}>{effect}</span>
                            ))}
                          </div>
                          <div className="historical-choice-modifiers">
                            <strong>模型传导</strong>
                            <div>
                              {option.modifiers.length === 0
                                ? <span>无额外 Modifier</span>
                                : option.modifiers.map((modifier, index) => (
                                  <span key={`${modifier.target}:${index}`}>
                                    {formatHistoricalModifier(modifier)}
                                  </span>
                                ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setAxisSelections((current) =>
                                current.map((value, index) =>
                                  index === axisIndex ? option.id : value
                                )
                              )}
                          >
                            {selected ? "已选择" : `选择：${option.name}`}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {preview ? (
              <div className="historical-axis-preview">
                <div>
                  <span className="eyebrow">组合预览</span>
                  <strong>{preview.name}</strong>
                  <p>{preview.description}</p>
                  <div className="historical-choice-modifiers">
                    <strong>合并后传导（持续 {formatEventDuration(preview.durationMonths)}）</strong>
                    <div>
                      {preview.modifiers.map((modifier, index) => (
                        <span key={`${modifier.target}:${index}`}>
                          {formatHistoricalModifier(modifier)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || axisSelections.length !== axes.length}
                  onClick={confirmAxisChoice}
                >
                  {busy ? "正在执行…" : `确认组合：${preview.name}`}
                </button>
              </div>
            ) : null}
          </>
        ) : (
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
        )}
        <p className="historical-decision-note">
          {axes.length > 0
            ? "请在各轴各选一项后确认组合；禁止出口并提前进口可与接受外国援助同时生效。决策写入存档后不可撤销。"
            : "决策将写入存档且不可撤销。选择后本月仍未结算，可继续推进时间。"}
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
            ? getHistoricalEventChoice(event, record.choiceId, game.nation)
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
  const financial = game.nation.financialSystem;
  const tradeNetwork = game.world.tradeNetwork;
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
      <div className="panel-heading"><div><span className="eyebrow">货币 · 信贷 · 跨境流量</span><h2>货币银行与国际收支</h2></div><span>官方汇率 {financial.officialExchangeRate.toFixed(2)} 元/美元</span></div>
      <div className="diplomacy-metrics foreign-exchange-metrics">
        <MetricCard label="广义货币 M2" value={formatLarge(financial.monetary.broadMoney)} detail={`基础货币 ${formatLarge(financial.monetary.monetaryBase)} · 增速 ${formatPercent(financial.monetary.annualBroadMoneyGrowth, 1)}`} tone="blue" />
        <MetricCard label="银行贷款" value={formatLarge(financial.banking.totalLoans)} detail={`企业 ${formatLarge(financial.banking.enterpriseLoans)} · 居民 ${formatLarge(financial.banking.householdLoans)}`} tone="gold" />
        <MetricCard label="社会融资能力" value={formatPercent(financial.capitalMarket.socialFinancingCapacity)} detail={`股权市场深度 ${formatPercent(financial.capitalMarket.equityMarketDepth)} · 上市企业 ${financial.capitalMarket.listedCompanyCount.toLocaleString("zh-CN")} 家`} tone="blue" />
        <MetricCard label="年度股权融资" value={formatLarge(financial.capitalMarket.annualEquityFinancing)} detail={`创新融资占比 ${formatPercent(financial.capitalMarket.innovationFinancingShare)} · 流动性 ${formatPercent(financial.capitalMarket.marketLiquidity)}`} tone="gold" />
        <MetricCard label="投资者保护" value={formatPercent(financial.capitalMarket.investorProtectionIndex)} detail={`交易所运行 ${formatPercent(financial.capitalMarket.exchangeOperationalCapacity)} · 市场风险 ${formatPercent(financial.capitalMarket.marketVolatilityIndex)}`} tone={financial.capitalMarket.marketVolatilityIndex <= 0.35 ? "green" : "red"} />
        <MetricCard label="不良贷款" value={formatPercent(financial.banking.nonPerformingLoanRatio, 2)} detail={`拨备 ${formatLarge(financial.banking.loanLossProvisions)} · 资本充足率 ${formatPercent(financial.banking.capitalAdequacyRatio, 1)}`} tone={financial.banking.nonPerformingLoanRatio <= 0.05 ? "green" : "red"} />
        <MetricCard label="经常账户" value={`$${formatLarge(financial.balanceOfPayments.currentAccountBalance)}`} detail={`金融账户 $${formatLarge(financial.balanceOfPayments.financialAccountBalance)} · 储备变动 $${formatLarge(financial.balanceOfPayments.reserveAssetChange)}`} tone={financial.balanceOfPayments.currentAccountBalance >= 0 ? "green" : "red"} />
      </div>
      <div className="world-table">
        <div className="world-head"><span>主要经济体排名</span><span>国家</span><span>名义 GDP</span><span>人均 GDP</span><span>科技</span></div>
        {countries.map((country, index) => (
          <div className={country.id === "china" ? "world-row is-china" : "world-row"} key={country.id}>
            <span>{index + 1}</span><strong>{country.name}</strong><span>{formatLarge(country.nominalGDP)}</span><span>{formatLarge(country.nominalGDP / country.population)}</span><span>{country.technology.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <div className="panel-heading"><div><span className="eyebrow">伙伴分布 · 结算币种 · 航运风险</span><h2>世界贸易与金融网络</h2></div><span>人民币结算 {formatPercent(tradeNetwork.renminbiSettlementShare)}</span></div>
      <div className="diplomacy-metrics foreign-exchange-metrics">
        <MetricCard label="出口集中度 HHI" value={tradeNetwork.exportConcentrationIndex.toFixed(3)} detail={`最大伙伴 ${game.world.countries.find((item) => item.id === tradeNetwork.topExportPartnerId)?.name ?? "—"}`} tone="blue" />
        <MetricCard label="进口集中度 HHI" value={tradeNetwork.importConcentrationIndex.toFixed(3)} detail={`最大伙伴 ${game.world.countries.find((item) => item.id === tradeNetwork.topImportPartnerId)?.name ?? "—"}`} tone="gold" />
        <MetricCard label="平均航运风险" value={formatPercent(tradeNetwork.averageShippingRisk)} detail="关系、制裁与基础航线风险加权" tone={tradeNetwork.averageShippingRisk < 0.3 ? "green" : "red"} />
        <MetricCard label="制裁暴露" value={formatPercent(tradeNetwork.sanctionExposure)} detail="按出口伙伴份额加权" tone={tradeNetwork.sanctionExposure < 0.1 ? "green" : "red"} />
      </div>
      <div className="world-table">
        <div className="world-head"><span>伙伴</span><span>出口</span><span>进口</span><span>外资</span><span>人民币结算</span></div>
        {Object.values(tradeNetwork.partners).toSorted((a, b) => b.exports + b.imports - a.exports - a.imports).slice(0, 10).map((partner) => <div className="world-row" key={partner.countryId}><strong>{game.world.countries.find((item) => item.id === partner.countryId)?.name ?? partner.countryId}</strong><span>${formatLarge(partner.exports)}</span><span>${formatLarge(partner.imports)}</span><span>${formatLarge(partner.foreignDirectInvestment)}</span><span>{formatPercent(partner.renminbiSettlementShare)}</span></div>)}
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
    prefix = "",
    suffix = "",
    secondary?: TargetComparisonMetric,
  ) => (
    <div className="comparison-metric">
      <strong>{prefix}{formatLarge(metric.simulated)}{suffix}</strong>
      <span>
        {comparison.targetLabel} {prefix}{formatLarge(metric.target)}{suffix}
      </span>
      <small className={differenceTone(metric.relativeDifference)}>
        偏差 {metric.relativeDifference >= 0 ? "+" : ""}
        {formatPercent(metric.relativeDifference)}
      </small>
      {secondary ? <em>按当年汇率：本局 ${formatLarge(secondary.simulated)} · 对标 ${formatLarge(secondary.target)}</em> : null}
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
              <span>{isInternationalComparison ? "GDP（现价美元）" : "GDP（当年价人民币）"}</span>
              <span>{isInternationalComparison ? "人均 GDP（美元）" : "人均 GDP（当年价人民币）"}</span>
              <span>总人口</span>
              <span>世界经济排名</span>
            </div>
            {comparisons.map((item) => (
              <div className="comparison-row" key={item.year}>
                <strong>{item.year}</strong>
                {renderMetric(
                  item.gdp,
                  isInternationalComparison ? "$" : "",
                  "",
                  item.gdpUSD,
                )}
                {renderMetric(
                  item.gdpPerCapita,
                  isInternationalComparison ? "$" : "",
                  isInternationalComparison ? "" : " 元",
                  item.gdpPerCapitaUSD,
                )}
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
                推进到存在完整当年价数据的年度后即可开始与{comparison.targetLabel}比较。
              </p>
            )}
          </div>
        </div>
        <p className="comparison-note">
          {isInternationalComparison
            ? "国家横向对标统一使用同期现价美元；目标排名按同年有数据的世界经济体计算，本局排名来自动态世界模型。对比只用于展示，不会改变模拟结果。"
            : "中国历史对比统一使用完整年度的当年价人民币，美元按同年口径补充；世界经济排名按现价美元名义 GDP 比较。模型内部不变价只用于实际增长趋势，不作为普通 GDP 展示。2026 年预测目标不作为真实历史展示。"}
        </p>
      </section>
      <div className="annual-table"><div className="annual-head"><span>年份</span><span>实际 GDP（模型不变价）</span><span>人均 GDP（当年价）</span><span>人口</span><span>科技</span><span>外储 / 外债</span><span>侨汇</span><span>排名</span></div>{game.nation.history.annual.slice(-10).reverse().map((item) => <div className="annual-row" key={item.year}><strong>{item.year}</strong><span>{formatLarge(item.realGDP)}</span><span>{formatLarge(item.currentPriceGDPPerCapita)} 元<br />${formatLarge(item.currentUSDGDPPerCapita)}</span><span>{formatLarge(item.population)}</span><span>指数 {item.technologyIndex.toFixed(1)}<br />产业第 {item.industryTechnologyTier} 层 · {item.completedTechnologyCount} 节点</span><span>外储 ${formatLarge(item.foreignExchangeReserves)}<br />外债 ${formatLarge(item.externalDebt)} · 用汇 {formatPercent(item.capitalGoodsImportCoverage, 0)}</span><span>${formatLarge(item.remittanceInflows)}</span><span>总量第 {item.gdpRank}<br />人均第 {item.gdpPerCapitaRank}/{item.gdpPerCapitaRankParticipants}</span></div>)}</div>
    </section>
  );
}

function SettingsSection({ game }: { game: GameState }) {
  const [seed, setSeed] = useState("1949");
  const newGame = useSimulationStore((store) => store.newGame);
  const importSave = useSimulationStore((store) => store.importSave);
  const exportSave = useSimulationStore((store) => store.exportSave);
  const integrity = useMemo(() => evaluateModelIntegrity(game), [game]);
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
  return (
    <section className="panel detail-page">
      <div className="detail-hero">
        <span className="eyebrow">本地数据</span>
        <h2>存档与新游戏</h2>
        <p>游戏数据只保存在当前浏览器的 IndexedDB，可随时导出。</p>
      </div>
      <div className="settings-grid">
        <article>
          <h3>开始新游戏</h3>
          <p>输入确定性种子；相同种子和决策会得到相同结果。</p>
          <div className="settings-action">
            <input value={seed} onChange={(event) => setSeed(event.target.value)} inputMode="numeric" aria-label="随机种子" />
            <button onClick={() => void newGame(Number(seed) || 1949)}>从 1949 重新开始</button>
          </div>
        </article>
        <article>
          <h3>导入与导出</h3>
          <p>导出文件包含模拟版本、随机状态和完整年度历史。</p>
          <div className="settings-action">
            <button onClick={handleExport}>导出 JSON 存档</button>
            <label className="file-button">导入存档<input type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(importSave); }} /></label>
          </div>
        </article>
      </div>
      <div className="panel-heading settings-audit-heading">
        <div>
          <span className="eyebrow">守恒关系 · 确定性 · 风险信号</span>
          <h2>模型完整性与审计</h2>
        </div>
        <span className={integrity.status === "通过" ? "audit-status is-passed" : "audit-status is-warning"}>
          {integrity.passed}/{integrity.total} 项{integrity.status}
        </span>
      </div>
      <div className="settings-grid integrity-grid">
        <article>
          <h3>账户守恒检查</h3>
          <p>最大相对误差 {integrity.maximumRelativeError.toExponential(2)}；账户超过容差时会显示警告，但不会用截断掩盖公式错误。</p>
          <ul className="integrity-list">
            {integrity.indicators.map((item) => (
              <li key={item.id} className={item.passed ? "is-passed" : "is-warning"}>
                <span>{item.name}</span>
                <strong>{item.passed ? "通过" : "警告"}</strong>
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>可重复性与风险</h3>
          <p>当前种子 {game.seed}，核心版本 {game.simulationVersion}。随机状态随存档序列化，相同决策可逐月复现。</p>
          <div className="integrity-summary">
            <span>当前内生风险</span>
            <strong>{game.nation.institutions.activeRiskIds.length} 项</strong>
            <small>最高压力 {formatPercent(game.nation.institutions.highestRiskPressure)}</small>
          </div>
          <div className="integrity-summary">
            <span>离线研究工具</span>
            <strong>多种子不确定性区间</strong>
            <small>自动校准只给出候选，不会覆写历史锚点</small>
          </div>
        </article>
      </div>
    </section>
  );
}

export function SimulatorDashboard() {
  const store = useSimulationStore();
  const { game, activeSection, darkMode, speed, autoRunning, busy, error, initialize } = store;

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? "dark" : "light"; }, [darkMode]);
  useEffect(() => {
    if (
      !autoRunning ||
      game?.nation.pendingHistoricalEventId ||
      game?.nation.famineMortality?.pendingReport
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      if (!useSimulationStore.getState().busy) {
        void useSimulationStore.getState().advanceYear();
      }
    }, speed === 1 ? 1300 : speed === 5 ? 420 : 180);
    return () => window.clearInterval(interval);
  }, [
    autoRunning,
    game?.nation.pendingHistoricalEventId,
    game?.nation.famineMortality?.pendingReport,
    speed,
  ]);

  const sectionTitle = useMemo(() => menuItems.find((item) => item.id === activeSection)?.label ?? "国家总览", [activeSection]);
  if (!game) return <main className="loading-screen"><div className="loading-mark">华</div><h1>中国国家发展模拟器</h1><p>{error ?? "正在启动独立模拟核心…"}</p></main>;
  const displayYear = game.nation.history.annual.at(-1)?.year ?? game.nation.date.year;
  const awaitingHistoricalDecision = Boolean(game.nation.pendingHistoricalEventId);
  const awaitingFamineReport = Boolean(game.nation.famineMortality?.pendingReport);
  const awaitingBlockingPopup = awaitingHistoricalDecision || awaitingFamineReport;
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
            <button className={autoRunning ? "control-button stop" : "control-button"} disabled={awaitingBlockingPopup} onClick={() => store.setAutoRunning(!autoRunning)}>{autoRunning ? "暂停" : "自动运行"}</button>
            <button className="primary-button" disabled={busy || awaitingBlockingPopup} onClick={() => void store.advanceYear()}>{awaitingHistoricalDecision ? "请先决策" : awaitingFamineReport ? "请先确认报告" : busy ? "结算中…" : "推进一年"}</button>
          </div>
        </header>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="workspace">
          <section className="status-strip"><div><span>当前进度</span><strong>{game.nation.date.year} 年 {game.nation.date.month} 月</strong></div><div><span>随机种子</span><strong>{game.seed}</strong></div><div><span>年度记录</span><strong>{game.nation.history.annual.length}</strong></div>{awaitingHistoricalDecision ? <div className="pending-decision-status"><span>模拟状态</span><strong>等待重大决策</strong></div> : null}{awaitingFamineReport ? <div className="pending-decision-status"><span>模拟状态</span><strong>等待死亡报告确认</strong></div> : null}<button disabled={busy || awaitingBlockingPopup || game.nation.date.year > new Date().getFullYear()} onClick={() => void store.runToCurrentYear()}>一键模拟至 {new Date().getFullYear()}</button></section>
          {activeSection === "nation" ? <Overview game={game} darkMode={darkMode} busy={busy} /> : null}
          {activeSection === "policies" ? <PoliciesSection game={game} busy={busy} /> : null}
          {activeSection === "technology" ? <TechnologySection game={game} busy={busy} /> : null}
          {activeSection === "industry" ? <IndustrySection game={game} busy={busy} /> : null}
          {activeSection === "diplomacy" ? <DiplomacySection game={game} busy={busy} /> : null}
          {activeSection === "history" ? <HistoricalEventsSection game={game} /> : null}
          {activeSection === "international" ? <InternationalSection game={game} /> : null}
          {activeSection === "statistics" ? <StatisticsSection game={game} darkMode={darkMode} /> : null}
          {activeSection === "settings" ? <SettingsSection game={game} /> : null}
          {!(["nation", "technology", "industry", "policies", "diplomacy", "history", "international", "statistics", "settings"] as SectionId[]).includes(activeSection) ? <DetailSection game={game} section={activeSection} /> : null}
        </div>
      </div>
      {game.nation.pendingHistoricalEventId ? (
        <HistoricalDecisionModal
          key={game.nation.pendingHistoricalEventId}
          game={game}
          busy={busy}
        />
      ) : game.nation.famineMortality?.pendingReport ? (
        <FamineMortalityReportModal game={game} busy={busy} />
      ) : null}
    </main>
  );
}
