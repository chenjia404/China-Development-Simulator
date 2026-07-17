import { describe, expect, it } from "vitest";
import { Mulberry32 } from "./random";

describe("确定性随机数", () => {
  it("相同种子生成完全相同的序列", () => {
    const first = new Mulberry32(1949);
    const second = new Mulberry32(1949);
    const sequence = Array.from({ length: 100 }, () => first.next());

    expect(Array.from({ length: 100 }, () => second.next())).toEqual(sequence);
  });

  it("可从保存的内部状态无缝继续", () => {
    const original = new Mulberry32(2026);
    Array.from({ length: 17 }, () => original.next());
    const restored = new Mulberry32(original.getState());

    expect(restored.next()).toBe(original.next());
    expect(restored.nextNormal(10, 2)).toBe(original.nextNormal(10, 2));
  });

  it("整数结果始终位于闭区间", () => {
    const random = new Mulberry32(7);
    const values = Array.from({ length: 1_000 }, () => random.nextInt(2, 5));

    expect(Math.min(...values)).toBe(2);
    expect(Math.max(...values)).toBe(5);
  });
});
