export interface CalibrationSearchParameter {
  id: string;
  initial: number;
  minimum: number;
  maximum: number;
  step: number;
}

export interface CalibrationSearchResult {
  parameters: Record<string, number>;
  initialLoss: number;
  bestLoss: number;
  evaluations: number;
  improved: boolean;
}

function validateDefinition(definition: CalibrationSearchParameter): void {
  if (!definition.id) throw new Error("自动校准参数必须具有 ID");
  if (![definition.initial, definition.minimum, definition.maximum, definition.step]
    .every(Number.isFinite)) {
    throw new Error(`自动校准参数 ${definition.id} 的边界必须为有限数值`);
  }
  if (definition.minimum > definition.maximum) {
    throw new Error(`自动校准参数 ${definition.id} 的下界不得大于上界`);
  }
  if (definition.initial < definition.minimum || definition.initial > definition.maximum) {
    throw new Error(`自动校准参数 ${definition.id} 的初值超出边界`);
  }
  if (definition.step <= 0) throw new Error(`自动校准参数 ${definition.id} 的步长必须为正数`);
}

function candidateValues(definition: CalibrationSearchParameter): number[] {
  const precision = Math.max(0, (definition.step.toString().split(".")[1]?.length ?? 0) + 2);
  const values: number[] = [];
  const count = Math.floor(
    (definition.maximum - definition.minimum) / definition.step + 1e-9,
  );
  for (let index = 0; index <= count; index += 1) {
    values.push(Number((definition.minimum + index * definition.step).toFixed(precision)));
  }
  if (values.at(-1)! < definition.maximum - 1e-10) values.push(definition.maximum);
  if (!values.some((value) => Math.abs(value - definition.initial) < 1e-10)) {
    values.push(definition.initial);
  }
  return values.sort((left, right) => left - right);
}

/**
 * 有界、可重复的坐标搜索。它只返回候选值，不写配置文件；参数是否采用仍须经过
 * 验证集、经济含义和历史资料复核。
 */
export function searchCalibrationCandidates(
  definitions: readonly CalibrationSearchParameter[],
  objective: (parameters: Readonly<Record<string, number>>) => number,
  maximumPasses = 4,
): CalibrationSearchResult {
  if (definitions.length === 0) throw new Error("自动校准至少需要一个参数");
  if (!Number.isInteger(maximumPasses) || maximumPasses < 1) {
    throw new Error("自动校准轮数必须是正整数");
  }
  definitions.forEach(validateDefinition);
  if (new Set(definitions.map((definition) => definition.id)).size !== definitions.length) {
    throw new Error("自动校准参数 ID 不得重复");
  }
  const parameters = Object.fromEntries(
    definitions.map((definition) => [definition.id, definition.initial]),
  );
  let evaluations = 1;
  const initialLoss = objective(parameters);
  if (!Number.isFinite(initialLoss) || initialLoss < 0) {
    throw new Error("自动校准目标函数必须返回有限非负值");
  }
  let bestLoss = initialLoss;
  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;
    for (const definition of definitions) {
      let selectedValue = parameters[definition.id];
      let selectedLoss = bestLoss;
      for (const value of candidateValues(definition)) {
        const candidate = { ...parameters, [definition.id]: value };
        const loss = objective(candidate);
        evaluations += 1;
        if (!Number.isFinite(loss) || loss < 0) {
          throw new Error("自动校准目标函数必须返回有限非负值");
        }
        const improvesLoss = loss < selectedLoss - 1e-12;
        const equalButCloserToInitial = Math.abs(loss - selectedLoss) <= 1e-12 &&
          Math.abs(value - definition.initial) <
            Math.abs(selectedValue - definition.initial) - 1e-12;
        if (improvesLoss || equalButCloserToInitial) {
          selectedValue = value;
          selectedLoss = loss;
        }
      }
      if (Math.abs(selectedValue - parameters[definition.id]) > 1e-12) changed = true;
      parameters[definition.id] = selectedValue;
      bestLoss = selectedLoss;
    }
    if (!changed) break;
  }
  return {
    parameters,
    initialLoss,
    bestLoss,
    evaluations,
    improved: bestLoss < initialLoss - 1e-12,
  };
}
