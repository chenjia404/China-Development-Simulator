import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tools/**/*.test.ts"],
    // 长程月度推进在并行负载下偶发超过默认 5s，统一放宽避免误杀。
    testTimeout: 20_000,
    coverage: {
      reporter: ["text", "json-summary"],
    },
  },
});
