import calibrationData from "../../src/data/config/calibration-targets.json";
import {
  calibrationMetrics,
  historicalDataRegistry,
  type CalibrationRole,
  type RegisteredCalibrationTarget,
  validateHistoricalDataRegistry,
} from "./data-registry";

const targets = calibrationData.years as RegisteredCalibrationTarget[];
const errors = validateHistoricalDataRegistry(targets);
const targetYearsByRole = Object.fromEntries(
  (["fit", "validation", "projection"] as CalibrationRole[]).map((role) => [
    role,
    targets.filter((target) => target.role === role).map((target) => target.year),
  ]),
);

process.stdout.write(`${JSON.stringify({
  status: errors.length === 0 ? "通过" : "失败",
  registryVersion: historicalDataRegistry.metadata.schemaVersion,
  lastReviewedOn: historicalDataRegistry.metadata.lastReviewedOn,
  sourceCount: historicalDataRegistry.sources.length,
  metricCount: calibrationMetrics.length,
  targetYearCount: targets.length,
  targetYearsByRole,
  errors,
}, null, 2)}\n`);

if (errors.length > 0) process.exitCode = 1;
