import foreignAidConfig from "../../data/config/foreign-aid-programs.json";
import { clamp } from "../core/math";
import type { GameState, NationState } from "../state/game-state";

export type ForeignAidProgramId =
  NationState["diplomacy"]["foreignAidProgramId"];

export interface ForeignAidProgramDefinition {
  id: ForeignAidProgramId;
  name: string;
  shortName: string;
  description: string;
  effects: string[];
  activationCost: number;
  historicalScale: number;
  post1980GDPShare: number;
  fiscalShareOfGDP: number;
  foreignExchangeShare: number;
  relationTargetBonus: number;
  reputationTargetBonus: number;
  monthlyDiplomaticPointBonus: number;
  domesticInvestmentMultiplier: number;
  researchOutputMultiplier: number;
  industrialProductivityMultiplier: number;
  exportCompetitivenessMultiplier: number;
  recipientCountryIds: string[];
}

export interface ForeignAidProgramEffects {
  domesticInvestmentMultiplier: number;
  researchOutputMultiplier: number;
  industrialProductivityMultiplier: number;
  exportCompetitivenessMultiplier: number;
  reputationTargetAdjustment: number;
  monthlyDiplomaticPointAdjustment: number;
}

interface HistoricalSchedule {
  startYear: number;
  endYear: number;
  annualRMB: number;
}

interface ExchangeRateAnchor {
  year: number;
  rmbPerUSD: number;
}

export const foreignAidProgramDefinitions =
  foreignAidConfig.definitions as ForeignAidProgramDefinition[];
export const foreignAidProgramCooldownMonths = foreignAidConfig.cooldownMonths;
export const foreignAidProgramTransitionMonths = foreignAidConfig.transitionMonths;
export const historicalForeignAidProgramId =
  foreignAidConfig.historicalProgramId as ForeignAidProgramId;

const historicalSchedule =
  foreignAidConfig.historicalSchedule as HistoricalSchedule[];
const exchangeRateAnchors =
  foreignAidConfig.officialExchangeRateAnchors as ExchangeRateAnchor[];

export function getForeignAidProgram(
  programId: string,
): ForeignAidProgramDefinition | undefined {
  return foreignAidProgramDefinitions.find((program) => program.id === programId);
}

function historicalProgram(): ForeignAidProgramDefinition {
  const definition = getForeignAidProgram(historicalForeignAidProgramId);
  if (!definition) throw new Error("缺少史实综合援外配置");
  return definition;
}

export function validateForeignAidPrograms(countryIds?: Set<string>): void {
  const ids = new Set<string>();
  for (const program of foreignAidProgramDefinitions) {
    if (ids.has(program.id)) throw new Error(`对外援助方案重复：${program.id}`);
    if (
      program.historicalScale < 0 ||
      program.post1980GDPShare < 0 ||
      program.fiscalShareOfGDP < 0 ||
      program.foreignExchangeShare < 0 ||
      program.foreignExchangeShare > 1 ||
      program.domesticInvestmentMultiplier <= 0 ||
      program.researchOutputMultiplier <= 0 ||
      program.industrialProductivityMultiplier <= 0 ||
      program.exportCompetitivenessMultiplier <= 0
    ) {
      throw new Error(`${program.name}包含无效援助参数`);
    }
    for (const countryId of program.recipientCountryIds) {
      if (countryIds && !countryIds.has(countryId)) {
        throw new Error(`${program.name}包含未知受援国：${countryId}`);
      }
    }
    ids.add(program.id);
  }
  if (!ids.has(historicalForeignAidProgramId)) {
    throw new Error("对外援助配置缺少史实基线方案");
  }
}

export function historicalForeignAidAnnualRMB(year: number): number {
  return historicalSchedule.find(
    (phase) => year >= phase.startYear && year <= phase.endYear,
  )?.annualRMB ?? 0;
}

export function officialHistoricalExchangeRate(year: number): number {
  const sorted = exchangeRateAnchors.toSorted((left, right) => left.year - right.year);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) throw new Error("援外官方汇率锚点不能为空");
  if (year <= first.year) return first.rmbPerUSD;
  if (year >= last.year) return last.rmbPerUSD;
  const upperIndex = sorted.findIndex((anchor) => anchor.year >= year);
  const lower = sorted[upperIndex - 1];
  const upper = sorted[upperIndex];
  if (!lower || !upper) return first.rmbPerUSD;
  const progress = (year - lower.year) / (upper.year - lower.year);
  return lower.rmbPerUSD + (upper.rmbPerUSD - lower.rmbPerUSD) * progress;
}

export function historicalForeignAidTotalsThrough1980(): {
  rmb: number;
  usd: number;
} {
  let rmb = 0;
  let usd = 0;
  for (let year = 1950; year <= 1980; year += 1) {
    const annualRMB = historicalForeignAidAnnualRMB(year);
    rmb += annualRMB;
    usd += annualRMB / officialHistoricalExchangeRate(year);
  }
  return { rmb, usd };
}

function historicalTotalsBeforeDate(nation: NationState): {
  rmb: number;
  usd: number;
} {
  let rmb = 0;
  let usd = 0;
  for (let year = 1950; year <= Math.min(1980, nation.date.year); year += 1) {
    const completedMonths = year < nation.date.year
      ? 12
      : Math.max(0, nation.date.month - 1);
    const annualRMB = historicalForeignAidAnnualRMB(year);
    rmb += annualRMB * completedMonths / 12;
    usd += annualRMB / officialHistoricalExchangeRate(year) * completedMonths / 12;
  }
  return { rmb, usd };
}

export function ensureForeignAidState(state: GameState): void {
  const diplomacy = state.nation.diplomacy;
  const needsHistoricalMigration = diplomacy.foreignAidProgramId === undefined;
  diplomacy.foreignAidProgramId ??= historicalForeignAidProgramId;
  diplomacy.previousForeignAidProgramId ??= null;
  diplomacy.foreignAidProgramProgress ??= 1;
  diplomacy.lastForeignAidProgramChangeMonth ??= null;
  diplomacy.annualForeignAidRMB ??= 0;
  diplomacy.annualForeignAidUSD ??= 0;
  diplomacy.annualForeignAidForeignExchangeOutflow ??= 0;
  diplomacy.cumulativeForeignAidRMB ??= 0;
  diplomacy.cumulativeForeignAidUSD ??= 0;
  diplomacy.cumulativeForeignAidRMBThrough1980 ??= 0;
  diplomacy.cumulativeForeignAidUSDThrough1980 ??= 0;
  state.nation.fiscal.foreignAidExpenditure ??= 0;
  if (needsHistoricalMigration) {
    const totals = historicalTotalsBeforeDate(state.nation);
    diplomacy.cumulativeForeignAidRMB = totals.rmb;
    diplomacy.cumulativeForeignAidUSD = totals.usd;
    diplomacy.cumulativeForeignAidRMBThrough1980 = totals.rmb;
    diplomacy.cumulativeForeignAidUSDThrough1980 = totals.usd;
  }
}

function programPair(nation: NationState): {
  previous: ForeignAidProgramDefinition;
  current: ForeignAidProgramDefinition;
  progress: number;
} {
  const current = getForeignAidProgram(nation.diplomacy.foreignAidProgramId);
  const previous = nation.diplomacy.previousForeignAidProgramId
    ? getForeignAidProgram(nation.diplomacy.previousForeignAidProgramId)
    : current;
  if (!current || !previous) throw new Error("对外援助方案配置不完整");
  return {
    previous,
    current,
    progress: clamp(nation.diplomacy.foreignAidProgramProgress, 0, 1),
  };
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function interpolateProgramValue(
  nation: NationState,
  selector: (program: ForeignAidProgramDefinition) => number,
): number {
  const { previous, current, progress } = programPair(nation);
  return interpolate(selector(previous), selector(current), progress);
}

function currentPriceGDP(nation: NationState): number {
  return Math.max(
    0,
    nation.economy.currentPriceGDPPerCapita * nation.population.total,
  );
}

function currentOfficialExchangeRate(nation: NationState): number {
  if (nation.date.year <= 1980) return officialHistoricalExchangeRate(nation.date.year);
  return clamp(
    nation.economy.currentPriceGDPPerCapita /
      Math.max(nation.economy.currentUSDGDPPerCapita, 0.01),
    0.1,
    20,
  );
}

function annualCommitmentFor(
  nation: NationState,
  program: ForeignAidProgramDefinition,
): number {
  if (nation.date.year <= 1980) {
    return historicalForeignAidAnnualRMB(nation.date.year) *
      program.historicalScale;
  }
  return currentPriceGDP(nation) * program.post1980GDPShare;
}

export function foreignAidProgramEffects(
  nation: NationState,
): ForeignAidProgramEffects {
  const baseline = historicalProgram();
  return {
    domesticInvestmentMultiplier: interpolateProgramValue(
      nation,
      (program) => program.domesticInvestmentMultiplier,
    ),
    researchOutputMultiplier: interpolateProgramValue(
      nation,
      (program) => program.researchOutputMultiplier,
    ),
    industrialProductivityMultiplier: interpolateProgramValue(
      nation,
      (program) => program.industrialProductivityMultiplier,
    ),
    exportCompetitivenessMultiplier: interpolateProgramValue(
      nation,
      (program) => program.exportCompetitivenessMultiplier,
    ),
    reputationTargetAdjustment: interpolateProgramValue(
      nation,
      (program) => program.reputationTargetBonus,
    ) - baseline.reputationTargetBonus,
    monthlyDiplomaticPointAdjustment: interpolateProgramValue(
      nation,
      (program) => program.monthlyDiplomaticPointBonus,
    ) - baseline.monthlyDiplomaticPointBonus,
  };
}

function relationBonus(
  program: ForeignAidProgramDefinition,
  countryId: string,
): number {
  return program.recipientCountryIds.includes(countryId)
    ? program.relationTargetBonus
    : 0;
}

export function foreignAidRelationTargetAdjustment(
  nation: NationState,
  countryId: string,
): number {
  const { previous, current, progress } = programPair(nation);
  const effectiveBonus = interpolate(
    relationBonus(previous, countryId),
    relationBonus(current, countryId),
    progress,
  );
  return effectiveBonus - relationBonus(historicalProgram(), countryId);
}

function baselineAnnualForeignExchangeOutflow(nation: NationState): number {
  const baseline = historicalProgram();
  return annualCommitmentFor(nation, baseline) /
    currentOfficialExchangeRate(nation) * baseline.foreignExchangeShare;
}

/**
 * 现有史实校准已隐含史实援外成本，因此外储只结算相对史实基线的增减，
 * 避免把同一历史成本重复扣除。暂停援助会释放用汇，扩大援助则额外消耗。
 */
export function foreignAidReserveFlowAdjustment(nation: NationState): number {
  return baselineAnnualForeignExchangeOutflow(nation) -
    nation.diplomacy.annualForeignAidForeignExchangeOutflow;
}

export function foreignAidProgramCooldownRemaining(nation: NationState): number {
  const changedAt = nation.diplomacy.lastForeignAidProgramChangeMonth;
  if (changedAt === null) return 0;
  return Math.max(
    0,
    foreignAidProgramCooldownMonths - (nation.date.elapsedMonths - changedAt),
  );
}

export function setForeignAidProgram(
  state: GameState,
  programId: ForeignAidProgramId,
): void {
  ensureForeignAidState(state);
  const program = getForeignAidProgram(programId);
  if (!program) throw new Error(`未知对外援助方案：${programId}`);
  if (state.nation.diplomacy.foreignAidProgramId === programId) {
    throw new Error(`当前已经采用${program.name}`);
  }
  const cooldown = foreignAidProgramCooldownRemaining(state.nation);
  if (cooldown > 0) throw new Error(`对外援助方案调整还需冷却 ${cooldown} 个月`);
  if (state.nation.diplomacy.diplomaticPoints < program.activationCost) {
    throw new Error(`调整为${program.name}需要 ${program.activationCost} 点外交点数`);
  }
  state.nation.diplomacy.diplomaticPoints -= program.activationCost;
  state.nation.diplomacy.previousForeignAidProgramId =
    state.nation.diplomacy.foreignAidProgramId;
  state.nation.diplomacy.foreignAidProgramId = programId;
  state.nation.diplomacy.foreignAidProgramProgress = 0;
  state.nation.diplomacy.lastForeignAidProgramChangeMonth =
    state.nation.date.elapsedMonths;
}

export function updateForeignAidProgram(state: GameState): void {
  ensureForeignAidState(state);
  const { nation } = state;
  if (nation.diplomacy.foreignAidProgramProgress < 1) {
    nation.diplomacy.foreignAidProgramProgress = clamp(
      nation.diplomacy.foreignAidProgramProgress +
        1 / foreignAidProgramTransitionMonths,
      0,
      1,
    );
    if (nation.diplomacy.foreignAidProgramProgress >= 1) {
      nation.diplomacy.previousForeignAidProgramId = null;
    }
  }
  const { previous, current, progress } = programPair(nation);
  const annualRMB = interpolate(
    annualCommitmentFor(nation, previous),
    annualCommitmentFor(nation, current),
    progress,
  );
  const exchangeRate = currentOfficialExchangeRate(nation);
  const annualUSD = annualRMB / exchangeRate;
  const foreignExchangeShare = interpolate(
    previous.foreignExchangeShare,
    current.foreignExchangeShare,
    progress,
  );
  nation.diplomacy.annualForeignAidRMB = annualRMB;
  nation.diplomacy.annualForeignAidUSD = annualUSD;
  nation.diplomacy.annualForeignAidForeignExchangeOutflow =
    annualUSD * foreignExchangeShare;
  nation.diplomacy.cumulativeForeignAidRMB += annualRMB / 12;
  nation.diplomacy.cumulativeForeignAidUSD += annualUSD / 12;
  if (nation.date.year <= 1980) {
    nation.diplomacy.cumulativeForeignAidRMBThrough1980 += annualRMB / 12;
    nation.diplomacy.cumulativeForeignAidUSDThrough1980 += annualUSD / 12;
  }
  nation.fiscal.foreignAidExpenditure =
    nation.economy.nominalGDP * interpolate(
      previous.fiscalShareOfGDP,
      current.fiscalShareOfGDP,
      progress,
    );
}
