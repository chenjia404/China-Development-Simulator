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
  }, 30_000);
});
