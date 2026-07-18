import registryData from "../../src/data/config/historical-data-registry.json";

export const calibrationMetrics = [
  "population",
  "realGDP",
  "currentPriceGDPPerCapita",
  "currentUSDGDPPerCapita",
  "gdpRank",
  "gdpPerCapitaRank",
  "urbanizationRate",
  "lifeExpectancy",
  "literacyRate",
  "primarySectorShare",
  "secondarySectorShare",
  "tertiarySectorShare",
] as const;

export type CalibrationMetric = typeof calibrationMetrics[number];
export type CalibrationRole = "fit" | "validation" | "projection";
export type DataConfidence = "high" | "medium" | "low";

export interface HistoricalDataSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
  scope: string;
}

export interface HistoricalDataSeries {
  id: string;
  metric: CalibrationMetric;
  name: string;
  unit: string;
  valueType: "stock" | "flow" | "index" | "share" | "rank";
  priceBasis:
    | "not_applicable"
    | "internal_constant_1949_rmb"
    | "current_rmb"
    | "current_usd";
  frequency: "annual";
  sourceIds: string[];
  confidencePeriods: Array<{
    startYear: number;
    endYear: number;
    level: DataConfidence;
  }>;
  notes: string;
}

interface HistoricalDataRegistry {
  metadata: {
    schemaVersion: number;
    description: string;
    lastReviewedOn: string;
    confidenceLevels: Record<DataConfidence, string>;
  };
  sources: HistoricalDataSource[];
  series: HistoricalDataSeries[];
}

export interface RegisteredCalibrationTarget {
  year: number;
  role: CalibrationRole;
  [key: string]: unknown;
}

export const historicalDataRegistry = registryData as HistoricalDataRegistry;

const seriesByMetric = new Map(
  historicalDataRegistry.series.map((series) => [series.metric, series]),
);

export function getHistoricalDataSeries(metric: CalibrationMetric): HistoricalDataSeries {
  const series = seriesByMetric.get(metric);
  if (!series) throw new Error(`历史数据注册表缺少指标：${metric}`);
  return series;
}

export function confidenceForMetricYear(
  metric: CalibrationMetric,
  year: number,
): DataConfidence {
  const period = getHistoricalDataSeries(metric).confidencePeriods.find(
    (candidate) => year >= candidate.startYear && year <= candidate.endYear,
  );
  if (!period) throw new Error(`历史数据注册表缺少 ${metric} 在 ${year} 年的可信度`);
  return period.level;
}

/**
 * 审计数据注册表本身，不访问网络。来源内容的人工复核日期记录在配置元数据中，
 * 自动检查只负责口径完整性、唯一性和校准年份覆盖。
 */
export function validateHistoricalDataRegistry(
  targets: RegisteredCalibrationTarget[],
): string[] {
  const errors: string[] = [];
  if (historicalDataRegistry.metadata.schemaVersion !== 1) {
    errors.push("历史数据注册表版本必须为 1");
  }

  const sourceIds = historicalDataRegistry.sources.map((source) => source.id);
  if (new Set(sourceIds).size !== sourceIds.length) errors.push("数据来源 ID 存在重复");
  for (const source of historicalDataRegistry.sources) {
    if (!/^https:\/\//u.test(source.url)) {
      errors.push(`数据来源 ${source.id} 必须使用 HTTPS 地址`);
    }
    if (!source.publisher || !source.title || !source.scope) {
      errors.push(`数据来源 ${source.id} 的发布者、标题和适用范围不得为空`);
    }
  }

  const seriesIds = historicalDataRegistry.series.map((series) => series.id);
  if (new Set(seriesIds).size !== seriesIds.length) errors.push("数据序列 ID 存在重复");
  const metricIds = historicalDataRegistry.series.map((series) => series.metric);
  if (new Set(metricIds).size !== metricIds.length) errors.push("一个校准指标只能登记一条主序列");
  for (const metric of calibrationMetrics) {
    if (!metricIds.includes(metric)) errors.push(`缺少校准指标主序列：${metric}`);
  }

  const sourceIdSet = new Set(sourceIds);
  for (const series of historicalDataRegistry.series) {
    if (series.sourceIds.length === 0) errors.push(`数据序列 ${series.id} 没有来源`);
    for (const sourceId of series.sourceIds) {
      if (!sourceIdSet.has(sourceId)) {
        errors.push(`数据序列 ${series.id} 引用了未知来源 ${sourceId}`);
      }
    }
    for (const period of series.confidencePeriods) {
      if (period.startYear > period.endYear) {
        errors.push(`数据序列 ${series.id} 的可信度时期起止颠倒`);
      }
    }
  }

  const targetYears = targets.map((target) => target.year);
  if (new Set(targetYears).size !== targetYears.length) errors.push("校准年份存在重复");
  const roles = new Set(targets.map((target) => target.role));
  for (const role of ["fit", "validation", "projection"] as const) {
    if (!roles.has(role)) errors.push(`校准目标缺少 ${role} 分组`);
  }
  for (const target of targets) {
    if (!["fit", "validation", "projection"].includes(target.role)) {
      errors.push(`${target.year} 年的校准角色无效：${target.role}`);
    }
    for (const metric of calibrationMetrics) {
      if (typeof target[metric] !== "number") continue;
      const series = seriesByMetric.get(metric);
      if (!series) continue;
      const covered = series.confidencePeriods.some(
        (period) => target.year >= period.startYear && target.year <= period.endYear,
      );
      if (!covered) errors.push(`数据序列 ${series.id} 未覆盖 ${target.year} 年`);
    }
  }
  return errors;
}
