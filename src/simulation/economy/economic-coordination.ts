import economicCoordinationConfig from "../../data/config/economic-coordination.json";
import { approach, clamp } from "../core/math";
import { applyModifiers } from "../events/modifiers";
import type {
  EconomicCoordinationState,
  EnterpriseInstitutionStance,
  LandInstitutionStance,
  NationState,
  PriceInstitutionStance,
} from "../state/game-state";

/**
 * 边界（与 AGENTS / 修订计划一致）：
 * - 不占用 maximumActivePolicies 国策槽
 * - 不改写 enterprise-sectors.targetShares（公有份额只读派生）
 * - 不直接乘 economy.realGDP / sector.*.output
 * - 与 institutionalEfficiency、institutions、marketDynamics、trade.openness 语义分离
 */

interface StanceOffset {
  name: string;
  planningOffset: number;
  domesticMarketFreedomOffset: number;
}

interface SoftEffectsConfig {
  secondaryAllocationBiasPerPlanning: number;
  maximumSecondaryAllocationBias: number;
  privateOperatingSpaceBiasPerMarket: number;
  privateEntrepreneurBiasPerMarket: number;
  privateOperatingSpaceBiasPerPlanning: number;
  maximumPrivateMonthlyBias: number;
  distortionBiasPerPlanning: number;
  maximumDistortionBias: number;
  priceAdjustmentSpeedFloor: number;
  priceAdjustmentSpeedSpan: number;
  shortagePressurePerPlanning: number;
  maximumShortagePressure: number;
}

interface InsightWhen {
  minimumPlanning?: number;
  maximumPlanning?: number;
  minimumDomesticMarket?: number;
  maximumDomesticMarket?: number;
  minimumPublicOwnership?: number;
  maximumPublicOwnership?: number;
  minimumOpenness?: number;
  maximumOpenness?: number;
}

export interface EconomicSystemClassification {
  id: string;
  name: string;
}

export interface EconomicCoordinationInsights {
  advantages: string[];
  problems: string[];
}

export interface EconomicCoordinationPrivateEconomyBias {
  operatingSpace: number;
  entrepreneurialCapacity: number;
}

const config = economicCoordinationConfig;
const soft = config.softEffects as SoftEffectsConfig;
const initialState = config.initialState;

export const landInstitutionStances = Object.keys(
  config.landStances,
) as LandInstitutionStance[];

export const enterpriseInstitutionStances = Object.keys(
  config.enterpriseStances,
) as EnterpriseInstitutionStance[];

export const priceInstitutionStances = Object.keys(
  config.priceStances,
) as PriceInstitutionStance[];

function isLandStance(value: unknown): value is LandInstitutionStance {
  return typeof value === "string" &&
    landInstitutionStances.includes(value as LandInstitutionStance);
}

function isEnterpriseStance(
  value: unknown,
): value is EnterpriseInstitutionStance {
  return typeof value === "string" &&
    enterpriseInstitutionStances.includes(value as EnterpriseInstitutionStance);
}

function isPriceStance(value: unknown): value is PriceInstitutionStance {
  return typeof value === "string" &&
    priceInstitutionStances.includes(value as PriceInstitutionStance);
}

export function createInitialEconomicCoordinationState(): EconomicCoordinationState {
  return {
    planningIntensity: initialState.planningIntensity,
    planningTarget: initialState.planningTarget,
    domesticMarketFreedom: initialState.domesticMarketFreedom,
    domesticMarketFreedomTarget: initialState.domesticMarketFreedomTarget,
    publicOwnershipShare: initialState.publicOwnershipShare,
    landStance: initialState.landStance as LandInstitutionStance,
    enterpriseStance: initialState.enterpriseStance as EnterpriseInstitutionStance,
    priceStance: initialState.priceStance as PriceInstitutionStance,
    landStanceChangedElapsedMonth: null,
    enterpriseStanceChangedElapsedMonth: null,
    priceStanceChangedElapsedMonth: null,
  };
}

function isCompleteEconomicCoordinationState(
  state: Partial<EconomicCoordinationState> | undefined,
): state is EconomicCoordinationState {
  return Boolean(
    state &&
      Number.isFinite(state.planningIntensity) &&
      Number.isFinite(state.planningTarget) &&
      Number.isFinite(state.domesticMarketFreedom) &&
      Number.isFinite(state.domesticMarketFreedomTarget) &&
      Number.isFinite(state.publicOwnershipShare) &&
      isLandStance(state.landStance) &&
      isEnterpriseStance(state.enterpriseStance) &&
      isPriceStance(state.priceStance) &&
      (state.landStanceChangedElapsedMonth === null ||
        Number.isInteger(state.landStanceChangedElapsedMonth)) &&
      (state.enterpriseStanceChangedElapsedMonth === null ||
        Number.isInteger(state.enterpriseStanceChangedElapsedMonth)) &&
      (state.priceStanceChangedElapsedMonth === null ||
        Number.isInteger(state.priceStanceChangedElapsedMonth)),
  );
}

function stanceImpliedTargets(nation: NationState): {
  planning: number;
  domesticMarket: number;
} {
  const offsets = stanceOffsets(nation);
  return {
    planning: clamp(config.baseline.planning + offsets.planning, 0, 1),
    domesticMarket: clamp(
      config.baseline.domesticMarketFreedom + offsets.domesticMarket,
      0,
      1,
    ),
  };
}

/** 按已记录历史事件顺序回放制度姿态提示，供旧存档迁移使用。 */
function replayHistoricalCoordinationStances(nation: NationState): void {
  const records = [...(nation.history?.historicalEvents ?? [])].sort(
    (left, right) =>
      left.year * 12 + left.month - (right.year * 12 + right.month),
  );
  for (const record of records) {
    applyHistoricalEconomicCoordinationStance(nation, record.id, {
      outcome: record.outcome,
      choiceId: record.choiceId,
      recordCooldown: false,
    });
  }
}

/** 旧存档缺少字段时按开局默认值确定性补齐；完整状态不重建对象引用。 */
export function ensureEconomicCoordinationState(nation: NationState): void {
  const existing = nation.economicCoordination as
    | Partial<EconomicCoordinationState>
    | undefined;
  if (isCompleteEconomicCoordinationState(existing)) {
    existing.planningIntensity = clamp(existing.planningIntensity, 0, 1);
    existing.planningTarget = clamp(existing.planningTarget, 0, 1);
    existing.domesticMarketFreedom = clamp(existing.domesticMarketFreedom, 0, 1);
    existing.domesticMarketFreedomTarget = clamp(
      existing.domesticMarketFreedomTarget,
      0,
      1,
    );
    existing.publicOwnershipShare = clamp(existing.publicOwnershipShare, 0, 1);
    return;
  }
  const fallback = createInitialEconomicCoordinationState();
  const hadPartialStocks = Number.isFinite(existing?.planningIntensity) &&
    Number.isFinite(existing?.domesticMarketFreedom);
  nation.economicCoordination = {
    planningIntensity: clamp(
      Number.isFinite(existing?.planningIntensity)
        ? existing?.planningIntensity ?? fallback.planningIntensity
        : fallback.planningIntensity,
      0,
      1,
    ),
    planningTarget: clamp(
      Number.isFinite(existing?.planningTarget)
        ? existing?.planningTarget ?? fallback.planningTarget
        : fallback.planningTarget,
      0,
      1,
    ),
    domesticMarketFreedom: clamp(
      Number.isFinite(existing?.domesticMarketFreedom)
        ? existing?.domesticMarketFreedom ?? fallback.domesticMarketFreedom
        : fallback.domesticMarketFreedom,
      0,
      1,
    ),
    domesticMarketFreedomTarget: clamp(
      Number.isFinite(existing?.domesticMarketFreedomTarget)
        ? existing?.domesticMarketFreedomTarget ??
          fallback.domesticMarketFreedomTarget
        : fallback.domesticMarketFreedomTarget,
      0,
      1,
    ),
    publicOwnershipShare: clamp(
      Number.isFinite(existing?.publicOwnershipShare)
        ? existing?.publicOwnershipShare ?? fallback.publicOwnershipShare
        : fallback.publicOwnershipShare,
      0,
      1,
    ),
    landStance: isLandStance(existing?.landStance)
      ? existing.landStance
      : fallback.landStance,
    enterpriseStance: isEnterpriseStance(existing?.enterpriseStance)
      ? existing.enterpriseStance
      : fallback.enterpriseStance,
    priceStance: isPriceStance(existing?.priceStance)
      ? existing.priceStance
      : fallback.priceStance,
    landStanceChangedElapsedMonth:
      existing?.landStanceChangedElapsedMonth === null ||
        Number.isInteger(existing?.landStanceChangedElapsedMonth)
        ? existing?.landStanceChangedElapsedMonth ?? null
        : null,
    enterpriseStanceChangedElapsedMonth:
      existing?.enterpriseStanceChangedElapsedMonth === null ||
        Number.isInteger(existing?.enterpriseStanceChangedElapsedMonth)
        ? existing?.enterpriseStanceChangedElapsedMonth ?? null
        : null,
    priceStanceChangedElapsedMonth:
      existing?.priceStanceChangedElapsedMonth === null ||
        Number.isInteger(existing?.priceStanceChangedElapsedMonth)
        ? existing?.priceStanceChangedElapsedMonth ?? null
        : null,
  };
  replayHistoricalCoordinationStances(nation);
  if (!hadPartialStocks) {
    const implied = stanceImpliedTargets(nation);
    nation.economicCoordination.planningTarget = implied.planning;
    nation.economicCoordination.planningIntensity = implied.planning;
    nation.economicCoordination.domesticMarketFreedomTarget =
      implied.domesticMarket;
    nation.economicCoordination.domesticMarketFreedom = implied.domesticMarket;
  }
  refreshEconomicCoordinationDerivedShares(nation);
}

function stanceOffsets(nation: NationState): {
  planning: number;
  domesticMarket: number;
} {
  const land = config.landStances[nation.economicCoordination.landStance] as
    StanceOffset;
  const enterprise = config.enterpriseStances[
    nation.economicCoordination.enterpriseStance
  ] as StanceOffset;
  const price = config.priceStances[nation.economicCoordination.priceStance] as
    StanceOffset;
  return {
    planning: land.planningOffset + enterprise.planningOffset + price.planningOffset,
    domesticMarket: land.domesticMarketFreedomOffset +
      enterprise.domesticMarketFreedomOffset +
      price.domesticMarketFreedomOffset,
  };
}

function stanceCooldownRemaining(
  lastChanged: number | null,
  elapsedMonths: number,
): number {
  if (lastChanged === null) return 0;
  return Math.max(
    0,
    config.minimumStanceChangeIntervalMonths - (elapsedMonths - lastChanged),
  );
}

export function economicCoordinationStanceCooldownRemaining(
  nation: NationState,
  axis: "land" | "enterprise" | "price",
): number {
  ensureEconomicCoordinationState(nation);
  const state = nation.economicCoordination;
  const lastChanged = axis === "land"
    ? state.landStanceChangedElapsedMonth
    : axis === "enterprise"
    ? state.enterpriseStanceChangedElapsedMonth
    : state.priceStanceChangedElapsedMonth;
  return stanceCooldownRemaining(lastChanged, nation.date.elapsedMonths);
}

export function setEconomicCoordinationStance(
  nation: NationState,
  axis: "land" | "enterprise" | "price",
  stance: LandInstitutionStance | EnterpriseInstitutionStance | PriceInstitutionStance,
): void {
  ensureEconomicCoordinationState(nation);
  if (axis !== "land" && axis !== "enterprise" && axis !== "price") {
    throw new Error(`未知制度姿态轴：${String(axis)}`);
  }
  const state = nation.economicCoordination;
  const cooldown = economicCoordinationStanceCooldownRemaining(nation, axis);
  if (cooldown > 0) {
    throw new Error(
      `该制度姿态调整后需等待 ${config.minimumStanceChangeIntervalMonths} 个月才能再次修改`,
    );
  }
  if (axis === "land") {
    if (!isLandStance(stance)) throw new Error(`未知土地制度姿态：${stance}`);
    if (state.landStance === stance) return;
    state.landStance = stance;
    state.landStanceChangedElapsedMonth = nation.date.elapsedMonths;
    return;
  }
  if (axis === "enterprise") {
    if (!isEnterpriseStance(stance)) {
      throw new Error(`未知企业制度姿态：${stance}`);
    }
    if (state.enterpriseStance === stance) return;
    state.enterpriseStance = stance;
    state.enterpriseStanceChangedElapsedMonth = nation.date.elapsedMonths;
    return;
  }
  if (!isPriceStance(stance)) throw new Error(`未知价格制度姿态：${stance}`);
  if (state.priceStance === stance) return;
  state.priceStance = stance;
  state.priceStanceChangedElapsedMonth = nation.date.elapsedMonths;
}

/**
 * 姿态与历史事件 modifier 共同形成目标，库存按月滞后收敛；
 * 公有份额仅快照 enterprises，不反向写入所有制公式。
 */
export function updateEconomicCoordination(nation: NationState): void {
  ensureEconomicCoordinationState(nation);
  const offsets = stanceOffsets(nation);
  const planningBase = clamp(
    config.baseline.planning + offsets.planning,
    0,
    1,
  );
  const marketBase = clamp(
    config.baseline.domesticMarketFreedom + offsets.domesticMarket,
    0,
    1,
  );
  const planningTarget = clamp(
    applyModifiers(
      nation,
      "economicCoordination.planningTarget",
      planningBase,
    ),
    0,
    1,
  );
  const domesticMarketFreedomTarget = clamp(
    applyModifiers(
      nation,
      "economicCoordination.domesticMarketFreedomTarget",
      marketBase,
    ),
    0,
    1,
  );
  const state = nation.economicCoordination;
  state.planningTarget = planningTarget;
  state.domesticMarketFreedomTarget = domesticMarketFreedomTarget;
  state.planningIntensity = clamp(
    approach(
      state.planningIntensity,
      planningTarget,
      config.monthlyConvergence,
    ),
    0,
    1,
  );
  state.domesticMarketFreedom = clamp(
    approach(
      state.domesticMarketFreedom,
      domesticMarketFreedomTarget,
      config.monthlyConvergence,
    ),
    0,
    1,
  );
  refreshEconomicCoordinationDerivedShares(nation);
}

/** 在企业所有制账户结算后刷新公有份额快照。 */
export function refreshEconomicCoordinationDerivedShares(
  nation: NationState,
): void {
  ensureEconomicCoordinationState(nation);
  nation.economicCoordination.publicOwnershipShare = clamp(
    Number.isFinite(nation.enterprises?.stateControlledShare)
      ? nation.enterprises.stateControlledShare
      : nation.economicCoordination.publicOwnershipShare,
    0,
    1,
  );
}

/** 计划偏高时略增二次产业资本配置份额，上限受配置约束。 */
export function economicCoordinationSecondaryAllocationBias(
  nation: NationState,
): number {
  const planning = nation.economicCoordination.planningIntensity;
  const bias = (planning - 0.5) * soft.secondaryAllocationBiasPerPlanning;
  return clamp(
    bias,
    -soft.maximumSecondaryAllocationBias,
    soft.maximumSecondaryAllocationBias,
  );
}

/** 对内市场与计划强度对民营能力月流量的弱偏置；不改 targetShares。 */
export function economicCoordinationPrivateEconomyBias(
  nation: NationState,
): EconomicCoordinationPrivateEconomyBias {
  const market = nation.economicCoordination.domesticMarketFreedom;
  const planning = nation.economicCoordination.planningIntensity;
  const enterpriseSign = nation.economicCoordination.enterpriseStance ===
      "private_led"
    ? 1
    : nation.economicCoordination.enterpriseStance === "soe_led"
    ? -1
    : 0;
  const operatingSpace = clamp(
    (market - 0.4) * soft.privateOperatingSpaceBiasPerMarket +
      (planning - 0.55) * soft.privateOperatingSpaceBiasPerPlanning +
      enterpriseSign * soft.privateOperatingSpaceBiasPerMarket * 0.35,
    -soft.maximumPrivateMonthlyBias,
    soft.maximumPrivateMonthlyBias,
  );
  const entrepreneurialCapacity = clamp(
    (market - 0.4) * soft.privateEntrepreneurBiasPerMarket +
      enterpriseSign * soft.privateEntrepreneurBiasPerMarket * 0.5,
    -soft.maximumPrivateMonthlyBias,
    soft.maximumPrivateMonthlyBias,
  );
  return { operatingSpace, entrepreneurialCapacity };
}

/** 计划动员带来的轻度配置扭曲，并入产业政策聚合惩罚，不重置 distortionIndex。 */
export function economicCoordinationDistortionBias(nation: NationState): number {
  return clamp(
    Math.max(0, nation.economicCoordination.planningIntensity - 0.55) *
      soft.distortionBiasPerPlanning,
    0,
    soft.maximumDistortionBias,
  );
}

/** 对内市场越高，价格向供需调整越快；计划价格压低弹性并略增短缺压力。 */
export function economicCoordinationPriceAdjustmentSpeedMultiplier(
  nation: NationState,
): number {
  const market = nation.economicCoordination.domesticMarketFreedom;
  return clamp(
    soft.priceAdjustmentSpeedFloor + market * soft.priceAdjustmentSpeedSpan,
    0.4,
    1.2,
  );
}

export function economicCoordinationShortagePressure(nation: NationState): number {
  const planning = nation.economicCoordination.planningIntensity;
  const market = nation.economicCoordination.domesticMarketFreedom;
  const plannedPrice = nation.economicCoordination.priceStance === "planned"
    ? 1
    : nation.economicCoordination.priceStance === "guided"
    ? 0.45
    : 0;
  return clamp(
    Math.max(0, planning - 0.6) * soft.shortagePressurePerPlanning *
      (0.55 + plannedPrice * 0.45) *
      (1.15 - market),
    0,
    soft.maximumShortagePressure,
  );
}

function matchesInsight(
  when: InsightWhen,
  planning: number,
  market: number,
  publicOwnership: number,
  openness: number,
): boolean {
  if (when.minimumPlanning !== undefined && planning < when.minimumPlanning) {
    return false;
  }
  if (when.maximumPlanning !== undefined && planning > when.maximumPlanning) {
    return false;
  }
  if (
    when.minimumDomesticMarket !== undefined &&
    market < when.minimumDomesticMarket
  ) {
    return false;
  }
  if (
    when.maximumDomesticMarket !== undefined &&
    market > when.maximumDomesticMarket
  ) {
    return false;
  }
  if (
    when.minimumPublicOwnership !== undefined &&
    publicOwnership < when.minimumPublicOwnership
  ) {
    return false;
  }
  if (
    when.maximumPublicOwnership !== undefined &&
    publicOwnership > when.maximumPublicOwnership
  ) {
    return false;
  }
  if (when.minimumOpenness !== undefined && openness < when.minimumOpenness) {
    return false;
  }
  if (when.maximumOpenness !== undefined && openness > when.maximumOpenness) {
    return false;
  }
  return true;
}

export function classifyEconomicSystem(
  nation: NationState,
): EconomicSystemClassification {
  ensureEconomicCoordinationState(nation);
  const planning = nation.economicCoordination.planningIntensity;
  const market = nation.economicCoordination.domesticMarketFreedom;
  const publicOwnership = nation.economicCoordination.publicOwnershipShare;
  const openness = clamp(nation.trade.openness, 0, 1.5);
  const rules = config.classification;

  if (
    planning >= rules.highlyPlanned.minimumPlanning &&
    publicOwnership >= rules.highlyPlanned.minimumPublicOwnership &&
    market <= rules.highlyPlanned.maximumDomesticMarket
  ) {
    return {
      id: rules.highlyPlanned.id,
      name: rules.highlyPlanned.name,
    };
  }
  if (
    planning <= rules.marketOriented.maximumPlanning &&
    market >= rules.marketOriented.minimumDomesticMarket
  ) {
    return {
      id: rules.marketOriented.id,
      name: rules.marketOriented.name,
    };
  }
  if (
    planning >= rules.socialistMarket.minimumPlanning &&
    planning <= rules.socialistMarket.maximumPlanning &&
    market >= rules.socialistMarket.minimumDomesticMarket &&
    market <= rules.socialistMarket.maximumDomesticMarket &&
    openness >= rules.socialistMarket.minimumOpenness &&
    publicOwnership >= rules.socialistMarket.minimumPublicOwnership &&
    publicOwnership <= rules.socialistMarket.maximumPublicOwnership
  ) {
    return {
      id: rules.socialistMarket.id,
      name: rules.socialistMarket.name,
    };
  }
  if (
    planning >= rules.mixed.minimumPlanning &&
    planning <= rules.mixed.maximumPlanning &&
    market >= rules.mixed.minimumDomesticMarket &&
    market <= rules.mixed.maximumDomesticMarket
  ) {
    return { id: rules.mixed.id, name: rules.mixed.name };
  }
  return {
    id: rules.transitional.id,
    name: rules.transitional.name,
  };
}

export function economicCoordinationInsights(
  nation: NationState,
): EconomicCoordinationInsights {
  ensureEconomicCoordinationState(nation);
  const planning = nation.economicCoordination.planningIntensity;
  const market = nation.economicCoordination.domesticMarketFreedom;
  const publicOwnership = nation.economicCoordination.publicOwnershipShare;
  const openness = clamp(nation.trade.openness, 0, 1.5);
  const advantages = config.insightRules.advantages
    .filter((rule) =>
      matchesInsight(rule.when, planning, market, publicOwnership, openness)
    )
    .map((rule) => rule.label);
  const problems = config.insightRules.problems
    .filter((rule) =>
      matchesInsight(rule.when, planning, market, publicOwnership, openness)
    )
    .map((rule) => rule.label);
  return { advantages, problems };
}

export function economicCoordinationDisplayMetrics(nation: NationState): {
  planning: number;
  domesticMarket: number;
  publicOwnership: number;
  openness: number;
  stateControl: number;
} {
  ensureEconomicCoordinationState(nation);
  const planning = nation.economicCoordination.planningIntensity;
  const publicOwnership = nation.economicCoordination.publicOwnershipShare;
  return {
    planning,
    domesticMarket: nation.economicCoordination.domesticMarketFreedom,
    publicOwnership,
    openness: clamp(nation.trade.openness, 0, 1),
    stateControl: clamp(planning * 0.55 + publicOwnership * 0.45, 0, 1),
  };
}

export function landStanceDefinition(stance: LandInstitutionStance): StanceOffset {
  return config.landStances[stance] as StanceOffset;
}

export function enterpriseStanceDefinition(
  stance: EnterpriseInstitutionStance,
): StanceOffset {
  return config.enterpriseStances[stance] as StanceOffset;
}

export function priceStanceDefinition(stance: PriceInstitutionStance): StanceOffset {
  return config.priceStances[stance] as StanceOffset;
}

const historicalStanceHints: Partial<
  Record<
    string,
    {
      landStance?: LandInstitutionStance;
      enterpriseStance?: EnterpriseInstitutionStance;
      priceStance?: PriceInstitutionStance;
    }
  >
> = {
  land_reform_1950: { landStance: "household_farming" },
  first_five_year_plan: { priceStance: "planned" },
  unified_purchase_1953: { priceStance: "planned" },
  individual_joint_ownership_1954: { enterpriseStance: "mixed" },
  industry_wide_joint_ownership_1956: { enterpriseStance: "soe_led" },
  peoples_communes_1958: { landStance: "collective", priceStance: "planned" },
  reform_and_opening_1978: {
    landStance: "household_farming",
    priceStance: "guided",
  },
  urban_economic_reform_1984: {
    enterpriseStance: "mixed",
    priceStance: "guided",
  },
  socialist_market_economy_1992: {
    enterpriseStance: "mixed",
    priceStance: "guided",
  },
};

function isCanonicalHistoricalChoice(choiceId: string | undefined): boolean {
  if (!choiceId) return true;
  return choiceId === "historical_path" ||
    choiceId.startsWith("historical") ||
    choiceId.startsWith("initiative:") ||
    choiceId.startsWith("condition:");
}

/**
 * 史实路径事件结算时同步制度姿态默认值。
 * 阻止/反事实选择不写入史实姿态；实时结算写入冷却，迁移回放不写入冷却。
 */
export function applyHistoricalEconomicCoordinationStance(
  nation: NationState,
  eventId: string,
  options?: {
    outcome?: "occurred" | "prevented" | "enacted_early" | "enacted_late";
    choiceId?: string;
    recordCooldown?: boolean;
  },
): void {
  if (!isCompleteEconomicCoordinationState(nation.economicCoordination)) {
    ensureEconomicCoordinationState(nation);
  }
  if ((options?.outcome ?? "occurred") === "prevented") return;
  if (!isCanonicalHistoricalChoice(options?.choiceId)) return;
  const hint = historicalStanceHints[eventId];
  if (!hint) return;
  const state = nation.economicCoordination;
  const recordCooldown = options?.recordCooldown !== false;
  const elapsed = nation.date.elapsedMonths;
  if (hint.landStance && state.landStance !== hint.landStance) {
    state.landStance = hint.landStance;
    if (recordCooldown) state.landStanceChangedElapsedMonth = elapsed;
  }
  if (hint.enterpriseStance && state.enterpriseStance !== hint.enterpriseStance) {
    state.enterpriseStance = hint.enterpriseStance;
    if (recordCooldown) state.enterpriseStanceChangedElapsedMonth = elapsed;
  }
  if (hint.priceStance && state.priceStance !== hint.priceStance) {
    state.priceStance = hint.priceStance;
    if (recordCooldown) state.priceStanceChangedElapsedMonth = elapsed;
  }
}
