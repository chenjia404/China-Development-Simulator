"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ECharts } from "echarts/core";
import type {
  AnnualSnapshot,
  DiplomaticActionId,
  FiscalBudget,
  GameState,
} from "@/src/simulation";
import {
  averageInternationalRelation,
  diplomaticActionDefinitions,
  internationalOrganizations,
  maximumActivePolicies,
  nationalPolicyDefinitions,
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
        <MetricCard label="实际 GDP" value={formatLarge(nation.economy.realGDP)} detail={`同比 ${formatPercent(growth)}`} />
        <MetricCard label="人均 GDP" value={formatLarge(nation.economy.realGDPPerCapita)} detail={`PPP ${formatLarge(nation.economy.pppGDPPerCapita)}`} tone="gold" />
        <MetricCard label="总人口" value={formatLarge(nation.population.total)} detail={`城市化 ${formatPercent(nation.society.urbanizationRate)}`} tone="red" />
        <MetricCard label="财政余额" value={formatLarge(nation.fiscal.balance)} detail={`债务率 ${formatPercent(nation.fiscal.debtToGDP)}`} tone={nation.fiscal.balance >= 0 ? "green" : "red"} />
        <MetricCard label="科技指数" value={nation.technology.index.toFixed(1)} detail={`采用率 ${formatPercent(nation.technology.adoptionRate)}`} tone="blue" />
        <MetricCard label="世界 GDP 排名" value={`第 ${game.world.rankings.nominalGDP.china ?? "—"} 名`} detail={`综合评分 ${lastAnnual?.score.toFixed(1) ?? "—"}`} tone="green" />
      </div>
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
  const data: Record<Exclude<SectionId, "nation" | "policies" | "diplomacy" | "international" | "statistics" | "settings">, Array<[string, string, string]>> = {
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
  const togglePolicy = (policyId: string) => {
    const selected = game.nation.policies.includes(policyId);
    const next = selected
      ? game.nation.policies.filter((id) => id !== policyId)
      : [...game.nation.policies, policyId];
    void setPolicies(next);
  };

  return (
    <section className="panel detail-page policy-page">
      <div className="detail-hero policy-hero">
        <span className="eyebrow">国家发展路线</span>
        <h2>重要国策</h2>
        <p>国策不直接增加 GDP，而是通过资本配置、人口、公共服务、科研、贸易和财政逐月传导。取消后也会经历退出期。</p>
        <div className="selection-count"><strong>{game.nation.policies.length}</strong> / {maximumActivePolicies} 项正在实施</div>
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
    </section>
  );
}

function organizationUnavailableReason(
  game: GameState,
  organization: typeof internationalOrganizations[number],
): string | null {
  const diplomacy = game.nation.diplomacy;
  if (diplomacy.organizationIds.includes(organization.id)) return "已经加入";
  if (game.nation.date.year < organization.availableYear) return `${organization.availableYear} 年开放`;
  if (game.nation.internationalInfluence < organization.minimumInfluence) return `需要影响力 ${organization.minimumInfluence}`;
  if (game.nation.trade.openness < organization.minimumOpenness) return `需要开放度 ${formatPercent(organization.minimumOpenness, 0)}`;
  if (averageInternationalRelation(game) < organization.minimumAverageRelation) return `需要平均关系 ${organization.minimumAverageRelation}`;
  const partners = game.world.countries.filter((country) => country.diplomaticStatus === "strategic_partner").length;
  if (partners < organization.minimumStrategicPartners) return `需要 ${organization.minimumStrategicPartners} 个战略伙伴`;
  if (diplomacy.diplomaticPoints < organization.cost) return `需要 ${organization.cost} 点外交点数`;
  return null;
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
  const countries = [...game.world.countries].sort((first, second) =>
    second.nominalGDP - first.nominalGDP,
  );

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
      <div className="diplomacy-layout">
        <section className="diplomacy-block">
          <div className="panel-heading"><div><span className="eyebrow">多边机制</span><h2>国际组织</h2></div></div>
          <div className="organization-list">
            {internationalOrganizations.map((organization) => {
              const reason = organizationUnavailableReason(game, organization);
              const joined = game.nation.diplomacy.organizationIds.includes(organization.id);
              return (
                <article className={joined ? "organization-card is-joined" : "organization-card"} key={organization.id}>
                  <div><h3>{organization.name}</h3><p>{organization.description}</p><small>{organization.availableYear} 年 · 消耗 {organization.cost} 点 · 贸易 ×{organization.tradeMultiplier.toFixed(2)}</small></div>
                  <button disabled={busy || reason !== null} title={reason ?? undefined} onClick={() => void joinOrganization(organization.id)}>{joined ? "已加入" : reason ?? "申请加入"}</button>
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

function InternationalSection({ game }: { game: GameState }) {
  const countries = [
    { id: "china", name: "中国", nominalGDP: game.nation.economy.nominalGDP, population: game.nation.population.total, technology: game.nation.technology.index },
    ...game.world.countries.map((country) => ({ id: country.id, name: country.name, nominalGDP: country.nominalGDP, population: country.population, technology: country.technologyIndex })),
  ].sort((a, b) => b.nominalGDP - a.nominalGDP).slice(0, 12);
  return <section className="panel detail-page"><div className="detail-hero"><span className="eyebrow">全球比较</span><h2>世界主要经济体</h2><p>外国经济体采用轻量增长模型，每月与中国同步更新。</p></div><div className="world-table"><div className="world-head"><span>排名</span><span>国家</span><span>名义 GDP</span><span>人均 GDP</span><span>科技</span></div>{countries.map((country, index) => <div className={country.id === "china" ? "world-row is-china" : "world-row"} key={country.id}><span>{index + 1}</span><strong>{country.name}</strong><span>{formatLarge(country.nominalGDP)}</span><span>{formatLarge(country.nominalGDP / country.population)}</span><span>{country.technology.toFixed(1)}</span></div>)}</div></section>;
}

function StatisticsSection({ game, darkMode }: { game: GameState; darkMode: boolean }) {
  return <section className="panel detail-page"><div className="detail-hero"><span className="eyebrow">年度时间序列</span><h2>历史统计</h2><p>长期图表只保存年度值，最近 120 个月用于短期分析。</p></div><HistoryChart annual={game.nation.history.annual} darkMode={darkMode} /><div className="annual-table"><div className="annual-head"><span>年份</span><span>GDP</span><span>人口</span><span>科技</span><span>排名</span></div>{game.nation.history.annual.slice(-10).reverse().map((item) => <div className="annual-row" key={item.year}><strong>{item.year}</strong><span>{formatLarge(item.realGDP)}</span><span>{formatLarge(item.population)}</span><span>{item.technologyIndex.toFixed(1)}</span><span>第 {item.gdpRank} 名</span></div>)}</div></section>;
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
    if (!autoRunning) return;
    const interval = window.setInterval(() => { if (!useSimulationStore.getState().busy) void useSimulationStore.getState().advanceYear(); }, speed === 1 ? 1300 : speed === 5 ? 420 : 180);
    return () => window.clearInterval(interval);
  }, [autoRunning, speed]);

  const sectionTitle = useMemo(() => menuItems.find((item) => item.id === activeSection)?.label ?? "国家总览", [activeSection]);
  if (!game) return <main className="loading-screen"><div className="loading-mark">华</div><h1>中国国家发展模拟器</h1><p>{error ?? "正在启动独立模拟核心…"}</p></main>;
  const displayYear = game.nation.history.annual.at(-1)?.year ?? game.nation.date.year;
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
            <button className={autoRunning ? "control-button stop" : "control-button"} onClick={() => store.setAutoRunning(!autoRunning)}>{autoRunning ? "暂停" : "自动运行"}</button>
            <button className="primary-button" disabled={busy} onClick={() => void store.advanceYear()}>{busy ? "结算中…" : "推进一年"}</button>
          </div>
        </header>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="workspace">
          <section className="status-strip"><div><span>当前进度</span><strong>{game.nation.date.year} 年 {game.nation.date.month} 月</strong></div><div><span>随机种子</span><strong>{game.seed}</strong></div><div><span>年度记录</span><strong>{game.nation.history.annual.length}</strong></div><button disabled={busy || game.nation.date.year > new Date().getFullYear()} onClick={() => void store.runToCurrentYear()}>一键模拟至 {new Date().getFullYear()}</button></section>
          {activeSection === "nation" ? <Overview game={game} darkMode={darkMode} busy={busy} /> : null}
          {activeSection === "policies" ? <PoliciesSection game={game} busy={busy} /> : null}
          {activeSection === "diplomacy" ? <DiplomacySection game={game} busy={busy} /> : null}
          {activeSection === "international" ? <InternationalSection game={game} /> : null}
          {activeSection === "statistics" ? <StatisticsSection game={game} darkMode={darkMode} /> : null}
          {activeSection === "settings" ? <SettingsSection /> : null}
          {!(["nation", "policies", "diplomacy", "international", "statistics", "settings"] as SectionId[]).includes(activeSection) ? <DetailSection game={game} section={activeSection} /> : null}
        </div>
      </div>
    </main>
  );
}
