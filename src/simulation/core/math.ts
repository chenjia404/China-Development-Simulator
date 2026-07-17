export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function safeDivide(
  numerator: number,
  denominator: number,
  fallback = 0,
): number {
  return denominator === 0 ? fallback : numerator / denominator;
}

export function approach(current: number, target: number, speed: number): number {
  return current + (target - current) * clamp(speed, 0, 1);
}
