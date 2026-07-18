import cohortData from "../../data/config/demographic-cohorts.json";
import { approach, clamp, safeDivide } from "../core/math";
import type {
  AgeBandId,
  DemographicDetailState,
  NationState,
  PopulationState,
  SexPopulationCohort,
} from "../state/game-state";

interface AgeBandDefinition {
  id: AgeBandId;
  minimumAge: number;
  maximumAge: number | null;
  initialShare: number;
  mortalityRisk: number;
}

interface DemographicCohortConfig {
  maleBirthShare: number;
  minimumAverageHouseholdSize: number;
  maximumAverageHouseholdSize: number;
  initialAverageHouseholdSize: number;
  urbanHouseholdSizeDiscount: number;
  developmentHouseholdSizeDiscount: number;
  monthlyHouseholdAdjustmentSpeed: number;
  ageBands: AgeBandDefinition[];
}

const config = cohortData as DemographicCohortConfig;
type PopulationTotals = Pick<
  PopulationState,
  "total" | "ageGroups" | "urbanPopulation" | "ruralPopulation"
>;

export const AGE_BAND_IDS = [
  "age_0_4", "age_5_9", "age_10_14", "age_15_19", "age_20_24",
  "age_25_29", "age_30_34", "age_35_39", "age_40_44", "age_45_49",
  "age_50_54", "age_55_59", "age_60_64", "age_65_69", "age_70_74",
  "age_75_79", "age_80_84", "age_85_plus",
] as const satisfies readonly AgeBandId[];

const CHILD_BANDS = new Set<AgeBandId>(AGE_BAND_IDS.slice(0, 3));
const WORKING_BANDS = new Set<AgeBandId>(AGE_BAND_IDS.slice(3, 13));
const CHILD_BAND_IDS = AGE_BAND_IDS.slice(0, 3);
const WORKING_BAND_IDS = AGE_BAND_IDS.slice(3, 13);
const ELDERLY_BAND_IDS = AGE_BAND_IDS.slice(13);
const definitionById = new Map(config.ageBands.map((item) => [item.id, item]));

function definition(id: AgeBandId): AgeBandDefinition {
  const found = definitionById.get(id);
  if (!found) throw new Error(`人口队列配置缺少年龄组：${id}`);
  return found;
}

function emptyCohorts(): DemographicDetailState["cohorts"] {
  return Object.fromEntries(AGE_BAND_IDS.map((id) => [id, { id, male: 0, female: 0 }])) as
    DemographicDetailState["cohorts"];
}

function cohortTotal(cohort: SexPopulationCohort): number {
  return cohort.male + cohort.female;
}

function targetGroupTotal(population: PopulationTotals, id: AgeBandId): number {
  if (CHILD_BANDS.has(id)) return population.ageGroups.children;
  if (WORKING_BANDS.has(id)) return population.ageGroups.workingAge;
  return population.ageGroups.elderly;
}

function groupWeightTotal(ids: readonly AgeBandId[]): number {
  return ids.reduce((sum, id) => sum + definition(id).initialShare, 0);
}

function initializeCohorts(population: PopulationTotals): DemographicDetailState["cohorts"] {
  const cohorts = emptyCohorts();
  const groups = [
    CHILD_BAND_IDS,
    WORKING_BAND_IDS,
    ELDERLY_BAND_IDS,
  ] as const;
  for (const ids of groups) {
    const target = targetGroupTotal(population, ids[0]);
    const weightTotal = groupWeightTotal(ids);
    for (const id of ids) {
      const total = target * safeDivide(definition(id).initialShare, weightTotal);
      cohorts[id].male = total * config.maleBirthShare;
      cohorts[id].female = total * (1 - config.maleBirthShare);
    }
  }
  return cohorts;
}

function summarize(
  population: PopulationTotals,
  cohorts: DemographicDetailState["cohorts"],
  averageHouseholdSize: number,
): DemographicDetailState {
  const malePopulation = AGE_BAND_IDS.reduce((sum, id) => sum + cohorts[id].male, 0);
  const femalePopulation = AGE_BAND_IDS.reduce((sum, id) => sum + cohorts[id].female, 0);
  const workingAgeFemalePopulation = AGE_BAND_IDS.reduce(
    (sum, id) => sum + (WORKING_BANDS.has(id) ? cohorts[id].female : 0),
    0,
  );
  const householdCount = safeDivide(population.total, averageHouseholdSize);
  const working = Math.max(1, population.ageGroups.workingAge);
  return {
    cohorts,
    households: {
      householdCount,
      urbanHouseholds: householdCount * safeDivide(population.urbanPopulation, population.total),
      ruralHouseholds: householdCount * safeDivide(population.ruralPopulation, population.total),
      averageHouseholdSize,
      childDependencyRatio: population.ageGroups.children / working,
      elderlyDependencyRatio: population.ageGroups.elderly / working,
      totalDependencyRatio:
        (population.ageGroups.children + population.ageGroups.elderly) / working,
    },
    migration: {
      monthlyRuralToUrban: 0,
      monthlyUrbanToRural: 0,
      cumulativeRuralToUrban: 0,
      lastUrbanPopulation: population.urbanPopulation,
      lastTotalPopulation: population.total,
    },
    malePopulation,
    femalePopulation,
    sexRatio: safeDivide(malePopulation, femalePopulation, 1),
    workingAgeFemalePopulation,
    reconciliationError: Math.abs(malePopulation + femalePopulation - population.total),
  };
}

export function createInitialDemographicDetailState(
  population: PopulationTotals,
): DemographicDetailState {
  return summarize(population, initializeCohorts(population), config.initialAverageHouseholdSize);
}

export function validateDemographicCohortDefinitions(): string[] {
  const errors: string[] = [];
  if (config.ageBands.length !== AGE_BAND_IDS.length) errors.push("年龄组必须为18组");
  if (new Set(config.ageBands.map((item) => item.id)).size !== AGE_BAND_IDS.length) {
    errors.push("年龄组 ID 缺失或重复");
  }
  const share = config.ageBands.reduce((sum, item) => sum + item.initialShare, 0);
  if (Math.abs(share - 1) > 1e-9) errors.push("初始年龄权重之和必须为1");
  return errors;
}

/** 旧存档按三段人口、城乡人口和统一初始年龄形状确定性重建。 */
export function ensureDemographicDetailState(nation: NationState): void {
  const detail = nation.population.demographicDetail as
    Partial<DemographicDetailState> | undefined;
  const complete = Boolean(
    detail?.cohorts &&
    detail.households &&
    detail.migration &&
    AGE_BAND_IDS.every((id) => {
      const cohort = detail.cohorts?.[id];
      return cohort && Number.isFinite(cohort.male) && Number.isFinite(cohort.female);
    }) &&
    Number.isFinite(detail.households?.averageHouseholdSize) &&
    Number.isFinite(detail.migration?.lastUrbanPopulation) &&
    Number.isFinite(detail.migration?.lastTotalPopulation) &&
    Number.isFinite(detail.malePopulation) &&
    Number.isFinite(detail.femalePopulation),
  );
  if (complete) return;
  if (!detail?.cohorts || AGE_BAND_IDS.some((id) => !detail.cohorts?.[id])) {
    nation.population.demographicDetail = createInitialDemographicDetailState(
      nation.population,
    );
    return;
  }
  const repaired = createInitialDemographicDetailState(nation.population);
  for (const id of AGE_BAND_IDS) {
    const current = detail.cohorts[id];
    repaired.cohorts[id] = {
      id,
      male: Number.isFinite(current.male) ? Math.max(0, current.male) : 0,
      female: Number.isFinite(current.female) ? Math.max(0, current.female) : 0,
    };
  }
  if (detail.migration) {
    repaired.migration = {
      monthlyRuralToUrban: Math.max(0, detail.migration.monthlyRuralToUrban ?? 0),
      monthlyUrbanToRural: Math.max(0, detail.migration.monthlyUrbanToRural ?? 0),
      cumulativeRuralToUrban: Math.max(0, detail.migration.cumulativeRuralToUrban ?? 0),
      lastUrbanPopulation: Math.max(0, detail.migration.lastUrbanPopulation ?? nation.population.urbanPopulation),
      lastTotalPopulation: Math.max(1, detail.migration.lastTotalPopulation ?? nation.population.total),
    };
  }
  repaired.households.averageHouseholdSize = clamp(
    detail.households?.averageHouseholdSize ?? config.initialAverageHouseholdSize,
    config.minimumAverageHouseholdSize,
    config.maximumAverageHouseholdSize,
  );
  nation.population.demographicDetail = repaired;
  reconcileAndSummarize(nation);
}

function reconcileGroup(
  cohorts: DemographicDetailState["cohorts"],
  ids: readonly AgeBandId[],
  target: number,
): void {
  const current = ids.reduce((sum, id) => sum + cohortTotal(cohorts[id]), 0);
  if (current <= 0) {
    const weightTotal = groupWeightTotal(ids);
    for (const id of ids) {
      const total = target * safeDivide(definition(id).initialShare, weightTotal);
      cohorts[id].male = total * config.maleBirthShare;
      cohorts[id].female = total * (1 - config.maleBirthShare);
    }
    return;
  }
  const factor = target / current;
  for (const id of ids) {
    cohorts[id].male *= factor;
    cohorts[id].female *= factor;
  }
}

function reconcileAndSummarize(nation: NationState): void {
  const { population } = nation;
  const detail = population.demographicDetail;
  reconcileGroup(detail.cohorts, CHILD_BAND_IDS, population.ageGroups.children);
  reconcileGroup(detail.cohorts, WORKING_BAND_IDS, population.ageGroups.workingAge);
  reconcileGroup(detail.cohorts, ELDERLY_BAND_IDS, population.ageGroups.elderly);

  const development = clamp(
    Math.log1p(Math.max(0, nation.economy.realGDPPerCapita)) / Math.log(60_001),
    0,
    1,
  );
  const targetHouseholdSize = clamp(
    config.initialAverageHouseholdSize -
      nation.society.urbanizationRate * config.urbanHouseholdSizeDiscount -
      development * config.developmentHouseholdSizeDiscount,
    config.minimumAverageHouseholdSize,
    config.maximumAverageHouseholdSize,
  );
  const averageHouseholdSize = approach(
    detail.households.averageHouseholdSize,
    targetHouseholdSize,
    config.monthlyHouseholdAdjustmentSpeed,
  );
  const migration = detail.migration;
  const expectedUrbanWithoutMigration = migration.lastUrbanPopulation * safeDivide(
    population.total,
    migration.lastTotalPopulation,
    1,
  );
  const migrationBalance = population.urbanPopulation - expectedUrbanWithoutMigration;
  migration.monthlyRuralToUrban = Math.max(0, migrationBalance);
  migration.monthlyUrbanToRural = Math.max(0, -migrationBalance);
  migration.cumulativeRuralToUrban += migration.monthlyRuralToUrban;

  const malePopulation = AGE_BAND_IDS.reduce(
    (sum, id) => sum + detail.cohorts[id].male,
    0,
  );
  const femalePopulation = AGE_BAND_IDS.reduce(
    (sum, id) => sum + detail.cohorts[id].female,
    0,
  );
  detail.malePopulation = malePopulation;
  detail.femalePopulation = femalePopulation;
  detail.sexRatio = safeDivide(malePopulation, femalePopulation, 1);
  detail.workingAgeFemalePopulation = WORKING_BAND_IDS.reduce(
    (sum, id) => sum + detail.cohorts[id].female,
    0,
  );
  detail.reconciliationError = Math.abs(
    malePopulation + femalePopulation - population.total,
  );
  const householdCount = safeDivide(population.total, averageHouseholdSize);
  const working = Math.max(1, population.ageGroups.workingAge);
  detail.households.householdCount = householdCount;
  detail.households.urbanHouseholds = householdCount *
    safeDivide(population.urbanPopulation, population.total);
  detail.households.ruralHouseholds = householdCount *
    safeDivide(population.ruralPopulation, population.total);
  detail.households.averageHouseholdSize = averageHouseholdSize;
  detail.households.childDependencyRatio = population.ageGroups.children / working;
  detail.households.elderlyDependencyRatio = population.ageGroups.elderly / working;
  detail.households.totalDependencyRatio =
    (population.ageGroups.children + population.ageGroups.elderly) / working;
  migration.lastUrbanPopulation = population.urbanPopulation;
  migration.lastTotalPopulation = population.total;
}

/** 推进年龄性别队列，再与历史校准的总人口账户调和。 */
export function updateDemographicCohorts(nation: NationState): void {
  if (!nation.population.demographicDetail?.cohorts) ensureDemographicDetailState(nation);
  const detail = nation.population.demographicDetail;
  const cohorts = detail.cohorts;
  const deathRiskTotal = AGE_BAND_IDS.reduce(
    (sum, id) => sum + cohortTotal(cohorts[id]) * definition(id).mortalityRisk,
    0,
  );
  const next = emptyCohorts();
  for (let index = 0; index < AGE_BAND_IDS.length; index += 1) {
    const id = AGE_BAND_IDS[index];
    const cohort = cohorts[id];
    const total = cohortTotal(cohort);
    const deaths = nation.population.monthlyDeaths * safeDivide(
      total * definition(id).mortalityRisk,
      deathRiskTotal,
    );
    const survival = Math.max(0, total - deaths);
    const maleShare = safeDivide(cohort.male, total, config.maleBirthShare);
    const agingOut = index === AGE_BAND_IDS.length - 1 ? 0 : survival / 60;
    next[id].male += (survival - agingOut) * maleShare;
    next[id].female += (survival - agingOut) * (1 - maleShare);
    if (agingOut > 0) {
      const nextId = AGE_BAND_IDS[index + 1];
      next[nextId].male += agingOut * maleShare;
      next[nextId].female += agingOut * (1 - maleShare);
    }
  }
  next.age_0_4.male += nation.population.monthlyBirths * config.maleBirthShare;
  next.age_0_4.female += nation.population.monthlyBirths * (1 - config.maleBirthShare);
  detail.cohorts = next;
  reconcileAndSummarize(nation);
}
