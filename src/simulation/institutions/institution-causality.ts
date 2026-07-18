import causalityData from "../../data/config/institution-causality.json";
import { approach, clamp } from "../core/math";
import type {
  EndogenousRiskId,
  EndogenousRiskSignal,
  InstitutionCausalityState,
  NationState,
} from "../state/game-state";

interface CausalityConfig {
  riskThresholds: Record<EndogenousRiskId, number>;
  policyCapacity: number;
  monthlyInstitutionAdjustmentSpeed: number;
}
const config = causalityData as CausalityConfig;
export const ENDOGENOUS_RISK_IDS = [
  "food_crisis", "financial_crisis", "fiscal_crisis",
  "environmental_health_crisis", "social_unrest", "external_isolation",
] as const satisfies readonly EndogenousRiskId[];
export const endogenousRiskDefinitions = [
  { id: "food_crisis", name: "粮食危机", drivers: ["粮食保障", "战略储备", "数据质量"] },
  { id: "financial_crisis", name: "金融危机", drivers: ["不良贷款", "资本充足", "信贷扩张"] },
  { id: "fiscal_crisis", name: "财政危机", drivers: ["债务率", "利息负担", "通胀"] },
  { id: "environmental_health_crisis", name: "环境健康危机", drivers: ["空气污染", "水压力", "基层医疗"] },
  { id: "social_unrest", name: "社会动荡", drivers: ["贫困失业", "通胀", "稳定度"] },
  { id: "external_isolation", name: "外部孤立", drivers: ["制裁暴露", "航运风险", "国际声誉"] },
] as const;
function signal(id: EndogenousRiskId): EndogenousRiskSignal {
  return { id, pressure: 0, threshold: config.riskThresholds[id], active: false,
    consecutiveMonths: 0, primaryDriver: "", secondaryDriver: "" };
}
export function createEmptyInstitutionCausalityState(): InstitutionCausalityState {
  return {
    stateCapacity: 0.35, localImplementationCapacity: 0.3,
    administrativeCapacity: 0.32, legalPredictability: 0.25,
    statisticalDataQuality: 0.3, policyCredibility: 0.35,
    corruptionRisk: 0.45, reformFatigue: 0, policyOverload: 0,
    effectivePolicyExecutionRate: 0.3,
    risks: {
      food_crisis: signal("food_crisis"),
      financial_crisis: signal("financial_crisis"),
      fiscal_crisis: signal("fiscal_crisis"),
      environmental_health_crisis: signal("environmental_health_crisis"),
      social_unrest: signal("social_unrest"),
      external_isolation: signal("external_isolation"),
    },
    activeRiskIds: [], highestRiskId: "food_crisis", highestRiskPressure: 0,
  };
}
export function ensureInstitutionCausalityState(nation: NationState): void {
  const existing = nation.institutions as Partial<InstitutionCausalityState> | undefined;
  if (existing?.risks && ENDOGENOUS_RISK_IDS.every((id) => existing.risks?.[id]) &&
    Number.isFinite(existing.effectivePolicyExecutionRate)) return;
  nation.institutions = createEmptyInstitutionCausalityState();
  updateInstitutionCausality(nation, true);
}
function riskInputs(nation: NationState): Record<EndogenousRiskId, {
  pressure: number; primary: string; secondary: string;
}> {
  const agriculture = nation.resources.agriculture;
  const banking = nation.financialSystem.banking;
  const environment = nation.resources.infrastructureResources;
  const tradeNetwork = nation.history.monthly.at(-1);
  return {
    food_crisis: {
      pressure: clamp((1 - agriculture.foodSecurityCoverage) * 0.62 +
        Math.max(0, 3 - agriculture.reserveCoverageMonths) / 3 * 0.28 +
        (1 - nation.institutions.statisticalDataQuality) * 0.1, 0, 1),
      primary: "粮食保障不足", secondary: "战略储备与数据质量",
    },
    financial_crisis: {
      pressure: clamp(banking.nonPerformingLoanRatio * 2.4 +
        Math.max(0, 0.1 - banking.capitalAdequacyRatio) * 3 +
        Math.max(0, nation.financialSystem.monetary.annualBroadMoneyGrowth - 0.18) * 0.8,
      0, 1), primary: "不良贷款", secondary: "资本与货币扩张",
    },
    fiscal_crisis: {
      pressure: clamp(nation.fiscal.debtToGDP * 0.68 +
        nation.fiscal.interestExpense / Math.max(nation.fiscal.revenue, 1) * 0.18 +
        Math.max(0, nation.economy.inflationRate - 0.05) * 0.9,
      0, 1), primary: "政府债务", secondary: "利息与通胀",
    },
    environmental_health_crisis: {
      pressure: clamp(environment.airPollutionIndex / 100 * 0.42 +
        environment.waterStressIndex * 0.3 +
        (1 - nation.humanDevelopment.primaryCareCoverage) * 0.28,
      0, 1), primary: "空气与水压力", secondary: "基层医疗",
    },
    social_unrest: {
      pressure: clamp(nation.society.povertyRate * 0.3 +
        nation.labor.unemploymentRate * 0.8 +
        Math.max(0, nation.economy.inflationRate) * 0.6 +
        (1 - nation.society.stabilityIndex / 100) * 0.3,
      0, 1), primary: "贫困与失业", secondary: "通胀与稳定",
    },
    external_isolation: {
      pressure: clamp((tradeNetwork?.tradeSanctionExposure ?? 0) * 0.45 +
        (tradeNetwork?.exportConcentrationIndex ?? 0) * 0.15 +
        Math.max(0, 30 - nation.diplomacy.globalReputation) / 100 * 0.4,
      0, 1), primary: "制裁与伙伴集中", secondary: "国际声誉",
    },
  };
}
/** 计算制度执行库存和因果风险信号；信号不自动改写历史事件或宏观总量。 */
export function updateInstitutionCausality(nation: NationState, initialize = false): void {
  if (!nation.institutions?.risks) {
    nation.institutions = createEmptyInstitutionCausalityState();
    initialize = true;
  }
  const state = nation.institutions;
  const speed = initialize ? 1 : config.monthlyInstitutionAdjustmentSpeed;
  state.policyOverload = clamp(nation.policies.length / config.policyCapacity, 0, 1.5);
  state.administrativeCapacity = approach(state.administrativeCapacity,
    clamp(nation.economy.institutionalEfficiency * 0.62 +
      nation.education.index / 100 * 0.18 + nation.fiscal.budget.administration * 0.8,
    0, 1), speed);
  state.localImplementationCapacity = approach(state.localImplementationCapacity,
    clamp(state.administrativeCapacity * 0.58 +
      nation.regionalEconomy.westernDevelopmentIndex * 0.16 +
      nation.economy.infrastructureIndex / 100 * 0.26, 0, 1), speed);
  state.legalPredictability = approach(state.legalPredictability,
    clamp(nation.economy.institutionalEfficiency * 0.72 +
      nation.privateEconomy.operatingSpace * 0.28, 0, 1), speed);
  state.statisticalDataQuality = approach(state.statisticalDataQuality,
    clamp(state.administrativeCapacity * 0.55 + state.legalPredictability * 0.25 +
      nation.education.literacyRate * 0.2, 0, 1), speed);
  state.corruptionRisk = clamp(1 -
    (state.legalPredictability * 0.45 + state.statisticalDataQuality * 0.25 +
      nation.economy.institutionalEfficiency * 0.3), 0, 1);
  state.reformFatigue = clamp(state.policyOverload * 0.48 +
    nation.modifiers.filter((item) => item.remainingMonths !== 0).length / 40 * 0.32 +
    Math.max(0, 50 - nation.society.stabilityIndex) / 100 * 0.2, 0, 1);
  state.stateCapacity = clamp((state.administrativeCapacity +
    state.localImplementationCapacity + state.legalPredictability +
    state.statisticalDataQuality) / 4, 0, 1);
  state.policyCredibility = clamp(state.stateCapacity * 0.6 +
    nation.society.stabilityIndex / 100 * 0.25 - state.reformFatigue * 0.15, 0, 1);
  state.effectivePolicyExecutionRate = clamp(state.stateCapacity *
    (1 - Math.max(0, state.policyOverload - 0.65) * 0.42) *
    (1 - state.reformFatigue * 0.22), 0, 1);
  const inputs = riskInputs(nation);
  state.activeRiskIds = [];
  let highest = state.risks.food_crisis;
  for (const id of ENDOGENOUS_RISK_IDS) {
    const risk = state.risks[id];
    risk.pressure = inputs[id].pressure;
    risk.primaryDriver = inputs[id].primary;
    risk.secondaryDriver = inputs[id].secondary;
    risk.active = risk.pressure >= risk.threshold;
    risk.consecutiveMonths = risk.active ? risk.consecutiveMonths + (initialize ? 0 : 1) : 0;
    if (risk.active) state.activeRiskIds.push(id);
    if (risk.pressure > highest.pressure) highest = risk;
  }
  state.highestRiskId = highest.id;
  state.highestRiskPressure = highest.pressure;
}
