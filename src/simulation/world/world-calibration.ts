import anchorData from "../../data/config/world-economic-anchors.json";
import { clamp } from "../core/math";

interface GdpAnchor {
  year: number;
  realGDP: number;
}

interface CountryAnchorConfig {
  id: string;
  anchors: GdpAnchor[];
}

interface WorldCalibrationConfig {
  monthlyCalibrationStrength: number;
  maximumMonthlyCalibrationAdjustment: number;
  overshootCalibrationMultiplier: number;
  countries: CountryAnchorConfig[];
}

const config = anchorData as WorldCalibrationConfig;

const anchorByCountryId = new Map(
  config.countries.map((country) => [country.id, country.anchors] as const),
);

function interpolateAnchor(anchors: GdpAnchor[], year: number): number | null {
  if (anchors.length === 0) return null;
  const sorted = anchors.toSorted((left, right) => left.year - right.year);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return null;
  if (year <= first.year) return first.realGDP;
  if (year >= last.year) return last.realGDP;

  const upperIndex = sorted.findIndex((anchor) => anchor.year >= year);
  const lower = sorted[upperIndex - 1];
  const upper = sorted[upperIndex];
  if (!lower || !upper) return first.realGDP;
  const progress = (year - lower.year) / (upper.year - lower.year);
  return lower.realGDP + (upper.realGDP - lower.realGDP) * progress;
}

/** 按历史锚点温和校准外国经济体规模，避免偏离公开数据量级。 */
export function applyWorldCountryCalibration(
  countryId: string,
  year: number,
  realGDP: number,
): number {
  const anchors = anchorByCountryId.get(countryId);
  if (!anchors) return realGDP;
  const anchor = interpolateAnchor(anchors, year);
  if (!anchor || anchor <= 0 || realGDP <= 0) return realGDP;

  const gap = Math.log(anchor / realGDP);
  const strength = gap < 0
    ? config.monthlyCalibrationStrength * (config.overshootCalibrationMultiplier ?? 1.8)
    : config.monthlyCalibrationStrength;
  const adjustment = clamp(
    gap * strength,
    -config.maximumMonthlyCalibrationAdjustment,
    config.maximumMonthlyCalibrationAdjustment,
  );
  return realGDP * (1 + adjustment);
}

export function getWorldCountryAnchor(
  countryId: string,
  year: number,
): number | null {
  const anchors = anchorByCountryId.get(countryId);
  if (!anchors) return null;
  return interpolateAnchor(anchors, year);
}
