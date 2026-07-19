/** 将大数值格式化为万 / 亿 / 万亿，便于界面与海报展示。 */
export function formatLarge(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1e12) return `${(value / 1e12).toFixed(2)}万亿`;
  if (absolute >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (absolute >= 1e4) return `${(value / 1e4).toFixed(1)}万`;
  return value.toFixed(0);
}

/** 将 0–1 比率格式化为百分比文本。 */
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * 美元人均等中等金额：保留 $ + 千分位，避免与「万」单位混用造成歧义。
 * 使用纯字符串拼接，不依赖 locale，保证跨环境确定性。
 */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}`;
}

/**
 * 美元宏观总量：大数用万/亿/万亿缩写，小数用千分位，适合海报主数字。
 */
export function formatUsdLarge(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e4) return `$${formatLarge(value)}`;
  return formatUsd(value);
}
