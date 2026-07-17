import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { annualSnapshotsToCsv } from "./csv";
import { runBatch } from "./runner";
import { strategyIds, type StrategyId } from "./strategies";

interface CliOptions {
  strategy: StrategyId;
  seed: number;
  runs: number;
  startYear: number;
  endYear: number;
  format: "json" | "csv";
  output?: string;
}

function readValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name}必须是整数`);
  return parsed;
}

function parseOptions(args: string[]): CliOptions {
  const positional = args.filter((value, index) =>
    !value.startsWith("--") && (index === 0 || !args[index - 1].startsWith("--")),
  );
  const usePositional = !args.some((value) => value.startsWith("--"));
  const strategy = (
    readValue(args, "--strategy") ??
    (usePositional ? positional[0] : undefined) ??
    "historical"
  ) as StrategyId;
  if (!strategyIds.includes(strategy)) {
    throw new Error(`未知策略：${strategy}，可选 ${strategyIds.join("、")}`);
  }
  const format = readValue(args, "--format") ??
    (usePositional ? positional[5] : undefined) ??
    "json";
  if (format !== "json" && format !== "csv") {
    throw new Error("导出格式只能是 json 或 csv");
  }
  return {
    strategy,
    seed: parseInteger(readValue(args, "--seed") ?? (usePositional ? positional[1] : undefined), 1949, "随机种子"),
    runs: parseInteger(readValue(args, "--runs") ?? (usePositional ? positional[2] : undefined), 1, "运行次数"),
    startYear: parseInteger(readValue(args, "--start-year") ?? (usePositional ? positional[3] : undefined), 1949, "开始年份"),
    endYear: parseInteger(readValue(args, "--end-year") ?? (usePositional ? positional[4] : undefined), new Date().getFullYear(), "结束年份"),
    format,
    output: readValue(args, "--output") ?? (usePositional ? positional[6] : undefined),
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.runs < 1 || options.runs > 1_000) {
    throw new Error("运行次数必须在 1 至 1000 之间");
  }
  const seeds = Array.from({ length: options.runs }, (_, index) => options.seed + index);
  const results = runBatch(
    {
      strategy: options.strategy,
      startYear: options.startYear,
      endYear: options.endYear,
    },
    seeds,
  );
  const summaries = results.map((result) => {
    const nation = result.finalState.nation;
    return {
      seed: result.options.seed,
      strategy: result.options.strategy,
      durationMs: Number(result.durationMs.toFixed(2)),
      years: result.annual.length,
      finalYear: result.annual.at(-1)?.year,
      population: nation.population.total,
      realGDP: nation.economy.realGDP,
      realGDPPerCapita: nation.economy.realGDPPerCapita,
      inflationRate: nation.economy.inflationRate,
      debtToGDP: nation.fiscal.debtToGDP,
      educationIndex: nation.education.index,
      technologyIndex: nation.technology.index,
      lifeExpectancy: nation.health.lifeExpectancy,
      happinessIndex: nation.society.happinessIndex,
      gdpRank: nation.history.annual.at(-1)?.gdpRank,
      score: nation.history.annual.at(-1)?.score,
    };
  });

  if (options.output) {
    const outputPath = resolve(options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    const content = options.format === "csv"
      ? annualSnapshotsToCsv(results[0].annual)
      : JSON.stringify({ summaries, runs: results.map((result) => result.annual) }, null, 2);
    await writeFile(outputPath, options.format === "csv" ? `\uFEFF${content}` : content, "utf8");
  }

  process.stdout.write(`${JSON.stringify({ status: "通过", summaries }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
