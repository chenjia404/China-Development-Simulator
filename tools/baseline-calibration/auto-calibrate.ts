import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  searchCalibrationCandidates,
  type CalibrationSearchParameter,
} from "../../src/simulation/index";
import {
  compareWithTargets,
  summarizeCalibration,
  type CalibrationResult,
} from "./calibration";
import { runSimulation } from "./runner";

const scaleForMetric: Partial<Record<CalibrationResult["metric"], string>> = {
  population: "populationScale",
  realGDP: "realGDPScale",
  currentPriceGDPPerCapita: "currentPricePerCapitaScale",
  currentUSDGDPPerCapita: "currentUSDPerCapitaScale",
};

const definitions: CalibrationSearchParameter[] = [
  { id: "populationScale", initial: 1, minimum: 0.9, maximum: 1.1, step: 0.0025 },
  { id: "realGDPScale", initial: 1, minimum: 0.9, maximum: 1.1, step: 0.0025 },
  { id: "currentPricePerCapitaScale", initial: 1, minimum: 0.9, maximum: 1.1, step: 0.0025 },
  { id: "currentUSDPerCapitaScale", initial: 1, minimum: 0.9, maximum: 1.1, step: 0.0025 },
];

const confidenceWeight = { high: 1, medium: 0.7, low: 0.4 } as const;

function adjustedValue(
  result: CalibrationResult,
  parameters: Readonly<Record<string, number>>,
): number {
  const parameterId = scaleForMetric[result.metric];
  return result.simulatedValue * (parameterId ? parameters[parameterId] : 1);
}

function normalizedLoss(
  comparisons: readonly CalibrationResult[],
  parameters: Readonly<Record<string, number>>,
  role: CalibrationResult["role"],
): number {
  const selected = comparisons.filter((comparison) => comparison.role === role);
  if (selected.length === 0) return 0;
  let weightTotal = 0;
  const weightedError = selected.reduce((sum, comparison) => {
    const value = adjustedValue(comparison, parameters);
    const error = comparison.toleranceKind === "relative"
      ? Math.abs(value - comparison.targetValue) /
        Math.max(Math.abs(comparison.targetValue), 1) /
        Math.max(comparison.tolerance, 1e-12)
      : Math.abs(value - comparison.targetValue) /
        Math.max(comparison.tolerance, 1e-12);
    const weight = confidenceWeight[comparison.confidence];
    weightTotal += weight;
    return sum + weight * error ** 2;
  }, 0);
  return weightedError / Math.max(weightTotal, 1);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  const prefix = `${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const run = runSimulation({ strategy: "historical", seed: 1949, startYear: 1949, endYear: 2026 });
  const comparisons = compareWithTargets(run.annual);
  const search = searchCalibrationCandidates(
    definitions,
    (parameters) => normalizedLoss(comparisons, parameters, "fit"),
  );
  const baselineParameters = Object.fromEntries(definitions.map((item) => [item.id, item.initial]));
  const losses = {
    fit: {
      baseline: normalizedLoss(comparisons, baselineParameters, "fit"),
      candidate: normalizedLoss(comparisons, search.parameters, "fit"),
    },
    validation: {
      baseline: normalizedLoss(comparisons, baselineParameters, "validation"),
      candidate: normalizedLoss(comparisons, search.parameters, "validation"),
    },
    projection: {
      baseline: normalizedLoss(comparisons, baselineParameters, "projection"),
      candidate: normalizedLoss(comparisons, search.parameters, "projection"),
    },
  };
  const holdoutAccepted = losses.validation.candidate <= losses.validation.baseline + 1e-12;
  const report = {
    schemaVersion: 1,
    mode: "建议候选，不自动写入配置",
    seed: 1949,
    period: "1949—2026",
    baselineCalibration: summarizeCalibration(comparisons),
    search,
    losses,
    adoptionDecision: holdoutAccepted ? "可进入人工机制复核" : "拒绝：留出验证损失上升",
    effectiveParameters: holdoutAccepted ? search.parameters : baselineParameters,
    guardrails: [
      "搜索只使用 fit 锚点，validation 与 projection 仅用于留出评估",
      "候选比例仅用于定位系统性口径偏差，不会修改模拟状态或历史目标",
      "正式采用前必须回到产生偏差的公式、单位、结算顺序或配置参数",
    ],
  };
  const output = argument("--output");
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
