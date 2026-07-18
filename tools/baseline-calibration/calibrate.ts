import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  calibrationResultsToCsv,
  compareWithTargets,
  summarizeCalibration,
} from "./calibration";
import { runSimulation } from "./runner";

async function main(): Promise<void> {
  const result = runSimulation({
    strategy: "historical",
    seed: 1949,
    startYear: 1949,
    endYear: 2026,
  });
  const comparisons = compareWithTargets(result.annual);
  const summary = summarizeCalibration(comparisons);
  const outputFlag = process.argv.indexOf("--output");
  const outputArgument = outputFlag >= 0
    ? process.argv[outputFlag + 1]
    : process.argv[2];
  if (outputArgument) {
    const outputPath = resolve(outputArgument);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `\uFEFF${calibrationResultsToCsv(comparisons)}`, "utf8");
  }
  process.stdout.write(`${JSON.stringify({
    status: summary.passRate >= 0.85 ? "通过" : "需要继续校准",
    durationMs: Number(result.durationMs.toFixed(2)),
    passed: summary.passed,
    total: summary.total,
    passRate: Number((summary.passRate * 100).toFixed(1)),
    byRole: summary.byRole,
    byConfidence: summary.byConfidence,
    failed: summary.failed,
  }, null, 2)}\n`);
  if (summary.passRate < 0.85) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
