/** 可由多种子无界面模拟结果汇总的指标。 */
export const UNCERTAINTY_METRIC_IDS = [
  "realGDP",
  "realGDPPerCapita",
  "population",
  "inflationRate",
  "debtToGDP",
  "technologyIndex",
  "score",
] as const;

export type UncertaintyMetricId = typeof UNCERTAINTY_METRIC_IDS[number];

export interface UncertaintySample {
  seed: number;
  metrics: Record<UncertaintyMetricId, number>;
}

export interface UncertaintyInterval {
  minimum: number;
  p10: number;
  median: number;
  p90: number;
  maximum: number;
  mean: number;
  standardDeviation: number;
  coefficientOfVariation: number;
}

export interface UncertaintySummary {
  sampleCount: number;
  seeds: number[];
  metrics: Record<UncertaintyMetricId, UncertaintyInterval>;
}

export function quantile(values: readonly number[], probability: number): number {
  if (values.length === 0) throw new Error("分位数至少需要一个样本");
  if (probability < 0 || probability > 1) throw new Error("分位点必须位于 0—1");
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("不确定性样本必须全部为有限数值");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

function summarizeValues(values: readonly number[]): UncertaintyInterval {
  const ordered = [...values].sort((left, right) => left - right);
  const mean = ordered.reduce((sum, value) => sum + value, 0) / ordered.length;
  const variance = ordered.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / ordered.length;
  const standardDeviation = Math.sqrt(variance);
  return {
    minimum: quantile(values, 0),
    p10: quantile(values, 0.1),
    median: quantile(values, 0.5),
    p90: quantile(values, 0.9),
    maximum: quantile(values, 1),
    mean,
    standardDeviation,
    coefficientOfVariation: Math.abs(mean) > 1e-12
      ? standardDeviation / Math.abs(mean)
      : 0,
  };
}

/**
 * 汇总由种子随机事件带来的区间。排序只影响报告展示，不影响分位数，
 * 因而并行批量任务以任何顺序返回都能得到同一份结果。
 */
export function summarizeUncertainty(
  samples: readonly UncertaintySample[],
): UncertaintySummary {
  if (samples.length === 0) throw new Error("不确定性分析至少需要一个种子");
  const seedSet = new Set(samples.map((sample) => sample.seed));
  if (seedSet.size !== samples.length) throw new Error("不确定性分析的种子不得重复");
  for (const sample of samples) {
    if (!Number.isInteger(sample.seed)) throw new Error("随机种子必须是整数");
    for (const metricId of UNCERTAINTY_METRIC_IDS) {
      if (!Number.isFinite(sample.metrics[metricId])) {
        throw new Error(`种子 ${sample.seed} 的 ${metricId} 不是有限数值`);
      }
    }
  }
  return {
    sampleCount: samples.length,
    seeds: [...seedSet].sort((left, right) => left - right),
    metrics: Object.fromEntries(UNCERTAINTY_METRIC_IDS.map((metricId) => [
      metricId,
      summarizeValues(samples.map((sample) => sample.metrics[metricId])),
    ])) as Record<UncertaintyMetricId, UncertaintyInterval>,
  };
}
