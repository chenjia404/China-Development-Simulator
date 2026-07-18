import type { ModifierState, NationState } from "../state/game-state";

/** 按稳定顺序应用同一目标上的修正，避免不同运行环境产生顺序差异。 */
export function applyModifiers(
  nation: NationState,
  target: string,
  baseValue: number,
): number {
  const modifiers = nation.modifiers
    .filter(
      (modifier) =>
        modifier.target === target && (modifier.delayMonths ?? 0) <= 0,
    )
    .toSorted((left, right) => left.id.localeCompare(right.id));
  let value = baseValue;
  for (const modifier of modifiers) {
    if (modifier.operation === "add") value += modifier.value;
    if (modifier.operation === "multiply") value *= modifier.value;
    if (modifier.operation === "override") value = modifier.value;
  }
  return value;
}

export function addModifier(nation: NationState, incoming: ModifierState): void {
  const sameTarget = nation.modifiers.filter(
    (modifier) =>
      modifier.sourceId === incoming.sourceId &&
      modifier.target === incoming.target,
  );
  if (incoming.stackRule === "replace") {
    nation.modifiers = nation.modifiers.filter(
      (modifier) => !sameTarget.includes(modifier),
    );
  } else if (incoming.stackRule === "max" && sameTarget.some(
    (modifier) => modifier.value >= incoming.value,
  )) {
    return;
  } else if (incoming.stackRule === "min" && sameTarget.some(
    (modifier) => modifier.value <= incoming.value,
  )) {
    return;
  }
  nation.modifiers.push(incoming);
}

export function advanceModifiers(nation: NationState): void {
  for (const modifier of nation.modifiers) {
    if ((modifier.delayMonths ?? 0) > 0) {
      modifier.delayMonths = (modifier.delayMonths ?? 0) - 1;
      continue;
    }
    if (modifier.remainingMonths !== null) modifier.remainingMonths -= 1;
  }
  nation.modifiers = nation.modifiers.filter(
    (modifier) =>
      modifier.remainingMonths === null || modifier.remainingMonths > 0,
  );
}
