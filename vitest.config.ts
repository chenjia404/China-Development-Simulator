import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tools/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json-summary"],
    },
  },
});
