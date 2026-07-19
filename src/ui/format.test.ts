import { describe, expect, it } from "vitest";
import { formatLarge, formatPercent, formatUsd, formatUsdLarge } from "./format";

describe("界面数值格式化", () => {
  it("按数量级压缩大数", () => {
    expect(formatLarge(1234)).toBe("1234");
    expect(formatLarge(12_345)).toBe("1.2万");
    expect(formatLarge(123_456_789)).toBe("1.23亿");
    expect(formatLarge(1.5e12)).toBe("1.50万亿");
  });

  it("将比率转成百分比文本", () => {
    expect(formatPercent(0.156)).toBe("15.6%");
    expect(formatPercent(0.5, 0)).toBe("50%");
  });

  it("美元金额使用千分位而不混用万", () => {
    expect(formatUsd(1012)).toBe("$1,012");
    expect(formatUsd(9996)).toBe("$9,996");
    expect(formatUsd(12_500)).toBe("$12,500");
    expect(formatUsd(Number.NaN)).toBe("—");
  });

  it("美元宏观总量大数使用缩写", () => {
    expect(formatUsdLarge(1.5e12)).toBe("$1.50万亿");
    expect(formatUsdLarge(2500)).toBe("$2,500");
  });
});
