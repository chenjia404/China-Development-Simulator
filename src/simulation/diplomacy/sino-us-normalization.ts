import normalizationConfig from "../../data/config/sino-us-normalization.json";
import { clamp } from "../core/math";
import type { GameState, NationState } from "../state/game-state";
import type { HistoricalEventOutcome } from "../events/historical-event-engine";
import { triggerConditionalHistoricalEvent } from "../events/historical-event-engine";

export type SinoUSNormalizationStatus =
  | "not_started"
  | "negotiating"
  | "established";

export interface SinoUSNormalizationEffects {
  cooperationProgress: number;
  historicalBaselineProgress: number;
  relativeTimingAdvantage: number;
  absorptionReadiness: number;
  marketAccessMultiplier: number;
  foreignInvestmentMultiplier: number;
  technologyDiffusionMultiplier: number;
  researchOutputMultiplier: number;
  educationExchangeMultiplier: number;
  exportCompetitivenessMultiplier: number;
  reputationTargetAdjustment: number;
  monthlyDiplomaticPointAdjustment: number;
}

export interface SinoUSNormalizationPolicyStatus {
  status: SinoUSNormalizationStatus;
  available: boolean;
  blockers: string[];
  usRelation: number;
  estimatedNegotiationMonths: number;
  historicalDatePassed: boolean;
}

export const sinoUSNormalizationDefinition = {
  name: "推动中美建交",
  description:
    "通过互相承认、使领馆安排和双边谈判建立正式外交关系，并逐步打开科技、教育、贸易和投资合作渠道。",
  ...normalizationConfig,
};

function monthDifference(
  year: number,
  month: number,
  baseYear: number,
  baseMonth: number,
): number {
  return (year - baseYear) * 12 + month - baseMonth;
}

function historicalBaselineProgress(nation: NationState): number {
  const elapsed = monthDifference(
    nation.date.year,
    nation.date.month,
    normalizationConfig.historicalEstablishmentYear,
    normalizationConfig.historicalEstablishmentMonth,
  );
  if (elapsed < 0) return 0;
  return clamp(
    (elapsed + 1) / normalizationConfig.cooperationTransitionMonths,
    0,
    1,
  );
}

function establishedElapsedMonths(nation: NationState): number {
  const diplomacy = nation.diplomacy;
  if (
    diplomacy.sinoUSNormalizationEstablishedYear === null ||
    diplomacy.sinoUSNormalizationEstablishedMonth === null
  ) {
    return 0;
  }
  return Math.max(
    0,
    monthDifference(
      nation.date.year,
      nation.date.month,
      diplomacy.sinoUSNormalizationEstablishedYear,
      diplomacy.sinoUSNormalizationEstablishedMonth,
    ),
  );
}

function normalizationOutcome(nation: NationState): HistoricalEventOutcome {
  const difference = monthDifference(
    nation.diplomacy.sinoUSNormalizationEstablishedYear ?? nation.date.year,
    nation.diplomacy.sinoUSNormalizationEstablishedMonth ?? nation.date.month,
    normalizationConfig.historicalEstablishmentYear,
    normalizationConfig.historicalEstablishmentMonth,
  );
  if (difference < 0) return "enacted_early";
  if (difference > 0) return "enacted_late";
  return "occurred";
}

function recordNormalization(state: GameState): void {
  if (
    state.nation.history.historicalEvents.some(
      (record) => record.id === "sino_us_normalization_1979",
    )
  ) {
    return;
  }
  const record = triggerConditionalHistoricalEvent(
    state.nation,
    "sino_us_normalization_1979",
    "diplomatic-policy:sino-us-normalization",
    "中美建交谈判完成",
    [
      `实际建交时间为${state.nation.diplomacy.sinoUSNormalizationEstablishedYear}年${state.nation.diplomacy.sinoUSNormalizationEstablishedMonth}月`,
      "科技、教育、贸易和投资合作在五年内逐步形成",
    ],
    normalizationOutcome(state.nation),
  );
  if (!record) return;
  record.year = state.nation.diplomacy.sinoUSNormalizationEstablishedYear ?? record.year;
  record.month = state.nation.diplomacy.sinoUSNormalizationEstablishedMonth ?? record.month;
}

/** 为旧存档补齐建交状态；自动史实路线按1979年1月确定性重建。 */
export function ensureSinoUSNormalizationState(state: GameState): void {
  const { diplomacy } = state.nation;
  const historicalDatePassed = monthDifference(
    state.nation.date.year,
    state.nation.date.month,
    normalizationConfig.historicalEstablishmentYear,
    normalizationConfig.historicalEstablishmentMonth,
  ) >= 0;
  const hasStatus = diplomacy.sinoUSNormalizationStatus === "not_started" ||
    diplomacy.sinoUSNormalizationStatus === "negotiating" ||
    diplomacy.sinoUSNormalizationStatus === "established";

  if (!hasStatus) {
    const reconstructHistorical =
      state.nation.historicalEventDecisionMode === "automatic" &&
      historicalDatePassed;
    diplomacy.sinoUSNormalizationStatus = reconstructHistorical
      ? "established"
      : "not_started";
    diplomacy.sinoUSNormalizationStartedYear = reconstructHistorical
      ? normalizationConfig.historicalEstablishmentYear
      : null;
    diplomacy.sinoUSNormalizationStartedMonth = reconstructHistorical
      ? normalizationConfig.historicalEstablishmentMonth
      : null;
    diplomacy.sinoUSNormalizationEstablishedYear = reconstructHistorical
      ? normalizationConfig.historicalEstablishmentYear
      : null;
    diplomacy.sinoUSNormalizationEstablishedMonth = reconstructHistorical
      ? normalizationConfig.historicalEstablishmentMonth
      : null;
    diplomacy.sinoUSNormalizationNegotiationProgress = reconstructHistorical ? 1 : 0;
    diplomacy.sinoUSNormalizationNegotiationMonths = reconstructHistorical ? 0 : 0;
    diplomacy.sinoUSCooperationProgress = reconstructHistorical
      ? historicalBaselineProgress(state.nation)
      : 0;
    diplomacy.sinoUSNormalizationDelayMonths = reconstructHistorical
      ? 0
      : Math.max(
          0,
          monthDifference(
            state.nation.date.year,
            state.nation.date.month,
            normalizationConfig.historicalEstablishmentYear,
            normalizationConfig.historicalEstablishmentMonth,
          ) + 1,
        );
  }

  diplomacy.sinoUSNormalizationStartedYear ??= null;
  diplomacy.sinoUSNormalizationStartedMonth ??= null;
  diplomacy.sinoUSNormalizationEstablishedYear ??= null;
  diplomacy.sinoUSNormalizationEstablishedMonth ??= null;
  diplomacy.sinoUSNormalizationNegotiationProgress = Number.isFinite(
      diplomacy.sinoUSNormalizationNegotiationProgress,
    )
    ? clamp(diplomacy.sinoUSNormalizationNegotiationProgress, 0, 1)
    : 0;
  diplomacy.sinoUSNormalizationNegotiationMonths = Number.isFinite(
      diplomacy.sinoUSNormalizationNegotiationMonths,
    )
    ? Math.max(0, Math.round(diplomacy.sinoUSNormalizationNegotiationMonths))
    : 0;
  diplomacy.sinoUSCooperationProgress = Number.isFinite(
      diplomacy.sinoUSCooperationProgress,
    )
    ? clamp(diplomacy.sinoUSCooperationProgress, 0, 1)
    : 0;
  diplomacy.sinoUSNormalizationDelayMonths = Number.isFinite(
      diplomacy.sinoUSNormalizationDelayMonths,
    )
    ? Math.max(0, Math.round(diplomacy.sinoUSNormalizationDelayMonths))
    : 0;
}

function estimatedNegotiationMonths(usRelation: number): number {
  return Math.round(clamp(
    normalizationConfig.baseNegotiationMonths -
      Math.max(0, usRelation) /
        normalizationConfig.relationMonthsReductionDivisor,
    normalizationConfig.minimumNegotiationMonths,
    normalizationConfig.baseNegotiationMonths,
  ));
}

export function getSinoUSNormalizationStatus(
  state: GameState,
): SinoUSNormalizationPolicyStatus {
  ensureSinoUSNormalizationState(state);
  const diplomacy = state.nation.diplomacy;
  const usa = state.world.countries.find((country) => country.id === "usa");
  if (!usa) throw new Error("世界国家配置缺少美国");
  const blockers: string[] = [];
  if (diplomacy.sinoUSNormalizationStatus === "not_started") {
    if (state.nation.date.year < normalizationConfig.earliestStartYear) {
      blockers.push(`最早可在 ${normalizationConfig.earliestStartYear} 年发动`);
    }
    if (state.nation.pendingHistoricalEventId) blockers.push("需先处理当前历史事件决策");
    if (usa.diplomaticStatus === "sanctioned" || usa.sanctionLevel > 0.2) {
      blockers.push("需先解除对美制裁");
    }
    if (usa.relationWithChina < normalizationConfig.minimumUSRelation) {
      blockers.push(`对美关系需达到 ${normalizationConfig.minimumUSRelation}`);
    }
    if (state.nation.diplomacy.globalReputation < normalizationConfig.minimumReputation) {
      blockers.push(`国际声誉需达到 ${normalizationConfig.minimumReputation}`);
    }
    if (state.nation.society.stabilityIndex < normalizationConfig.minimumStability) {
      blockers.push(`社会稳定需达到 ${normalizationConfig.minimumStability}`);
    }
    if (
      state.nation.economy.institutionalEfficiency <
        normalizationConfig.minimumInstitutionalEfficiency
    ) {
      blockers.push(
        `制度效率需达到 ${Math.round(normalizationConfig.minimumInstitutionalEfficiency * 100)}%`,
      );
    }
    if (diplomacy.diplomaticPoints < normalizationConfig.activationCost) {
      blockers.push(`需要 ${normalizationConfig.activationCost} 点外交点数`);
    }
  }
  return {
    status: diplomacy.sinoUSNormalizationStatus,
    available:
      diplomacy.sinoUSNormalizationStatus === "not_started" &&
      blockers.length === 0,
    blockers,
    usRelation: usa.relationWithChina,
    estimatedNegotiationMonths: estimatedNegotiationMonths(usa.relationWithChina),
    historicalDatePassed: monthDifference(
      state.nation.date.year,
      state.nation.date.month,
      normalizationConfig.historicalEstablishmentYear,
      normalizationConfig.historicalEstablishmentMonth,
    ) >= 0,
  };
}

/** 发动建交谈判；结果只由当前关系和可序列化状态决定。 */
export function startSinoUSNormalization(state: GameState): void {
  const status = getSinoUSNormalizationStatus(state);
  if (status.status === "established") throw new Error("中美已经建立外交关系");
  if (status.status === "negotiating") throw new Error("中美建交谈判正在进行");
  if (!status.available) {
    throw new Error(`推动中美建交的条件未满足：${status.blockers.join("；")}`);
  }
  const diplomacy = state.nation.diplomacy;
  diplomacy.diplomaticPoints -= normalizationConfig.activationCost;
  diplomacy.sinoUSNormalizationStatus = "negotiating";
  diplomacy.sinoUSNormalizationStartedYear = state.nation.date.year;
  diplomacy.sinoUSNormalizationStartedMonth = state.nation.date.month;
  diplomacy.sinoUSNormalizationNegotiationProgress = 0;
  diplomacy.sinoUSNormalizationNegotiationMonths = status.estimatedNegotiationMonths;
}

function establishNormalization(state: GameState): void {
  const diplomacy = state.nation.diplomacy;
  diplomacy.sinoUSNormalizationStatus = "established";
  diplomacy.sinoUSNormalizationEstablishedYear = state.nation.date.year;
  diplomacy.sinoUSNormalizationEstablishedMonth = state.nation.date.month;
  diplomacy.sinoUSNormalizationNegotiationProgress = 1;
  diplomacy.sinoUSNormalizationDelayMonths = Math.max(
    0,
    monthDifference(
      state.nation.date.year,
      state.nation.date.month,
      normalizationConfig.historicalEstablishmentYear,
      normalizationConfig.historicalEstablishmentMonth,
    ),
  );
  const usa = state.world.countries.find((country) => country.id === "usa");
  if (usa) usa.relationWithChina = clamp(usa.relationWithChina + 8, -100, 100);
  recordNormalization(state);
}

/** 月度推进建交谈判、合作成熟度和1979年后的延迟机会成本。 */
export function updateSinoUSNormalization(state: GameState): void {
  ensureSinoUSNormalizationState(state);
  const { nation } = state;
  const diplomacy = nation.diplomacy;
  const reachedHistoricalDate = monthDifference(
    nation.date.year,
    nation.date.month,
    normalizationConfig.historicalEstablishmentYear,
    normalizationConfig.historicalEstablishmentMonth,
  ) >= 0;

  if (
    diplomacy.sinoUSNormalizationStatus === "not_started" &&
    nation.historicalEventDecisionMode === "automatic" &&
    reachedHistoricalDate
  ) {
    diplomacy.sinoUSNormalizationStartedYear =
      normalizationConfig.historicalEstablishmentYear;
    diplomacy.sinoUSNormalizationStartedMonth =
      normalizationConfig.historicalEstablishmentMonth;
    diplomacy.sinoUSNormalizationNegotiationMonths = 0;
    establishNormalization(state);
  } else if (diplomacy.sinoUSNormalizationStatus === "negotiating") {
    diplomacy.sinoUSNormalizationNegotiationProgress = clamp(
      diplomacy.sinoUSNormalizationNegotiationProgress +
        1 / Math.max(1, diplomacy.sinoUSNormalizationNegotiationMonths),
      0,
      1,
    );
    if (diplomacy.sinoUSNormalizationNegotiationProgress >= 1) {
      establishNormalization(state);
    }
  }

  if (diplomacy.sinoUSNormalizationStatus !== "established") {
    diplomacy.sinoUSNormalizationDelayMonths = reachedHistoricalDate
      ? monthDifference(
          nation.date.year,
          nation.date.month,
          normalizationConfig.historicalEstablishmentYear,
          normalizationConfig.historicalEstablishmentMonth,
        ) + 1
      : 0;
    return;
  }

  diplomacy.sinoUSCooperationProgress = clamp(
    diplomacy.sinoUSCooperationProgress +
      1 / normalizationConfig.cooperationTransitionMonths,
    0,
    1,
  );
  recordNormalization(state);

  const usa = state.world.countries.find((country) => country.id === "usa");
  if (
    usa &&
    establishedElapsedMonths(nation) >= normalizationConfig.tradeAgreementDelayMonths &&
    usa.diplomaticStatus !== "sanctioned"
  ) {
    usa.tradeAgreement = true;
    if (usa.diplomaticStatus === "neutral") usa.diplomaticStatus = "partner";
  }
}

export function sinoUSNormalizationEffects(
  nation: NationState,
): SinoUSNormalizationEffects {
  const actualProgress = clamp(nation.diplomacy.sinoUSCooperationProgress ?? 0, 0, 1);
  const baselineProgress = historicalBaselineProgress(nation);
  const relativeTimingAdvantage = clamp(actualProgress - baselineProgress, -1, 1);
  const absorptionReadiness = clamp(
    0.25 +
      nation.education.index / 200 +
      nation.trade.openness * 0.25 +
      nation.economy.institutionalEfficiency * 0.2,
    0.35,
    1,
  );
  const economicTimingAdvantage = relativeTimingAdvantage * absorptionReadiness;
  const effect = normalizationConfig.effects;
  const multiplier = (maximum: number, scale = economicTimingAdvantage) =>
    Math.max(0.5, 1 + (maximum - 1) * scale);
  return {
    cooperationProgress: actualProgress,
    historicalBaselineProgress: baselineProgress,
    relativeTimingAdvantage,
    absorptionReadiness,
    marketAccessMultiplier: multiplier(effect.marketAccessMultiplier),
    foreignInvestmentMultiplier: multiplier(effect.foreignInvestmentMultiplier),
    technologyDiffusionMultiplier: multiplier(effect.technologyDiffusionMultiplier),
    researchOutputMultiplier: multiplier(effect.researchOutputMultiplier),
    educationExchangeMultiplier: multiplier(effect.educationExchangeMultiplier),
    exportCompetitivenessMultiplier: multiplier(effect.exportCompetitivenessMultiplier),
    reputationTargetAdjustment: effect.reputationTargetAdjustment * actualProgress,
    monthlyDiplomaticPointAdjustment:
      effect.monthlyDiplomaticPointAdjustment * actualProgress,
  };
}

export function sinoUSNormalizationRelationTargetAdjustment(
  nation: NationState,
  countryId: string,
): number {
  const progress = clamp(nation.diplomacy.sinoUSCooperationProgress ?? 0, 0, 1);
  const negotiating = nation.diplomacy.sinoUSNormalizationStatus === "negotiating"
    ? clamp(nation.diplomacy.sinoUSNormalizationNegotiationProgress, 0, 1)
    : 0;
  const effects = normalizationConfig.effects;
  if (countryId === "usa") {
    return effects.usRelationTargetAdjustment * progress +
      effects.negotiationUSRelationTargetAdjustment * negotiating;
  }
  if (countryId === "japan") return effects.japanRelationTargetAdjustment * progress;
  if (countryId === "south_korea") {
    return effects.southKoreaRelationTargetAdjustment * progress;
  }
  if (countryId === "russia") return effects.russiaRelationTargetAdjustment * progress;
  if (countryId === "north_korea") {
    return effects.northKoreaRelationTargetAdjustment * progress;
  }
  return 0;
}
