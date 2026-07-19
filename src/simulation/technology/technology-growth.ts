import technologyConfig from "../../data/config/technology.json";

/**
 * 科技指数无硬顶。超过起始阈值后，月增量按 scale/(scale+超额) 递减，
 * 可继续上涨但不会线性发散。阈值默认 100，使到达 100 之前与旧路径一致。
 */
export function technologyDiminishingFactor(technologyIndex: number): number {
  const start = technologyConfig.diminishingReturnsStartIndex;
  const scale = technologyConfig.diminishingReturnsScale;
  const excess = Math.max(0, technologyIndex - start);
  return scale / (scale + excess);
}

/**
 * 前沿吸收：未达阈值时全额转化（与旧路径一致）；达到后仅保留残余比例，
 * 并随超额继续衰减，模拟靠近技术前沿后研发更难立刻铺开到全经济。
 */
export function technologyProductiveAbsorption(technologyIndex: number): number {
  const start = technologyConfig.productiveAbsorptionStartIndex;
  if (technologyIndex < start) return 1;
  const scale = technologyConfig.productiveAbsorptionScale;
  const residual = technologyConfig.productiveFrontierResidual;
  const excess = technologyIndex - start;
  return residual * (scale / (scale + excess));
}

/**
 * 将科技指数映射为下游效果系数。0–100 与旧公式 `index/100` 完全一致；
 * 超过 100 后按渐近线逼近 `1 + effectHeadroom`，避免能源、国防等线性爆炸。
 */
export function technologyNormalizedEffect(technologyIndex: number): number {
  if (technologyIndex <= 100) {
    return technologyIndex / 100;
  }
  const excess = technologyIndex - 100;
  const headroom = technologyConfig.effectHeadroom;
  const scale = technologyConfig.effectSaturationScale;
  return 1 + headroom * (excess / (excess + scale));
}
