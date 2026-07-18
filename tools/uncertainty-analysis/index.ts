import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  summarizeUncertainty,
  type UncertaintySample,
} from "../../src/simulation/index";
import { runBatch } from "../baseline-calibration/runner";
import { strategyIds, type StrategyId } from "../baseline-calibration/strategies";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  const prefix = `${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function integerArgument(name: string, fallback: number): number {
  const raw = argument(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} 必须是整数`);
  return value;
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter((item) => !item.startsWith("--"));
  const strategyArgument = argument("--strategy") ?? positional[0] ?? "historical";
  if (!strategyIds.includes(strategyArgument as StrategyId)) {
    throw new Error(`未知策略：${strategyArgument}`);
  }
  const strategy = strategyArgument as StrategyId;
  const startYear = argument("--start-year") === undefined && positional[3] !== undefined
    ? Number(positional[3])
    : integerArgument("--start-year", 1949);
  const endYear = argument("--end-year") === undefined && positional[4] !== undefined
    ? Number(positional[4])
    : integerArgument("--end-year", 2026);
  const firstSeed = argument("--first-seed") === undefined && positional[1] !== undefined
    ? Number(positional[1])
    : integerArgument("--first-seed", 1949);
  const sampleCount = argument("--samples") === undefined && positional[2] !== undefined
    ? Number(positional[2])
    : integerArgument("--samples", 12);
  if (![startYear, endYear, firstSeed, sampleCount].every(Number.isInteger)) {
    throw new Error("年份、首个种子和样本数必须是整数");
  }
  if (sampleCount < 2 || sampleCount > 200) {
    throw new Error("样本数必须位于 2—200");
  }
  const seeds = Array.from({ length: sampleCount }, (_, index) => firstSeed + index);
  const runs = runBatch({ strategy, startYear, endYear }, seeds);
  const samples: UncertaintySample[] = runs.map((run) => {
    const final = run.annual.at(-1);
    if (!final) throw new Error(`种子 ${run.options.seed} 没有生成年度快照`);
    return {
      seed: run.options.seed,
      metrics: {
        realGDP: final.realGDP,
        realGDPPerCapita: final.realGDPPerCapita,
        population: final.population,
        inflationRate: final.inflationRate,
        debtToGDP: final.debtToGDP,
        technologyIndex: final.technologyIndex,
        score: final.score,
      },
    };
  });
  const report = {
    schemaVersion: 1,
    strategy,
    period: `${startYear}—${endYear}`,
    totalDurationMs: Number(runs.reduce((sum, run) => sum + run.durationMs, 0).toFixed(2)),
    ...summarizeUncertainty(samples),
  };
  const output = argument("--output") ?? positional[5];
  if (output) {
    const outputPath = resolve(output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
