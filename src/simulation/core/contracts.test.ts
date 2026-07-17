import { describe, expect, it } from "vitest";
import { assertCompatibleSave, SAVE_SCHEMA_VERSION } from "../index";

describe("模拟接口契约", () => {
  it("接受当前存档版本", () => {
    expect(() =>
      assertCompatibleSave({
        schemaVersion: SAVE_SCHEMA_VERSION,
        simulationVersion: "0.1.0",
        exportedAt: "2026-01-01T00:00:00.000Z",
        checksum: "test",
        state: {} as never,
      }),
    ).not.toThrow();
  });

  it("拒绝未知存档版本", () => {
    expect(() =>
      assertCompatibleSave({ schemaVersion: 2 } as never),
    ).toThrow("不支持的存档版本");
  });
});
