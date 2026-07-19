import { describe, expect, it } from "vitest";
import { runFinalAudit } from "./audit";

describe("极端策略与最终审计", () => {
  it("全部 V1 核心验收检查通过", async () => {
    const report = await runFinalAudit();
    expect(
      report.checks.filter((check) => !check.passed),
      "失败项应为空",
    ).toEqual([]);
    expect(report.status).toBe("通过");
  // 审计会并行覆盖完整历史路线、极端策略和新增国策对照；单路线性能
  // 仍由 audit 内部的独立预算严格检查，外层超时只负责等待整组编排完成。
  }, 60_000);
});
