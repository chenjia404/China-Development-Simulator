import type { GameState } from "../../src/simulation/index";

export function validateGameState(state: GameState): void {
  const visit = (value: unknown, path: string): void => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`${path} 出现非有限数值：${value}`);
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        visit(child, `${path}.${key}`);
      }
    }
  };
  visit(state, "state");

  const { nation } = state;
  if (nation.population.total <= 0) throw new Error("总人口必须大于零");
  if (nation.economy.realGDP < 0) throw new Error("实际 GDP 不得为负");
  if (nation.population.urbanPopulation > nation.population.total) {
    throw new Error("城市人口不得超过总人口");
  }
  if (nation.labor.unemploymentRate < 0 || nation.labor.unemploymentRate > 0.6) {
    throw new Error("失业率超出 0 至 60% 边界");
  }
  if (nation.health.lifeExpectancy < 20 || nation.health.lifeExpectancy > 100) {
    throw new Error("预期寿命超出 20 至 100 岁边界");
  }
  for (const [name, value] of Object.entries({
    教育指数: nation.education.index,
    医疗指数: nation.health.index,
    科技指数: nation.technology.index,
    幸福度: nation.society.happinessIndex,
    稳定度: nation.society.stabilityIndex,
  })) {
    if (value < 0 || value > 100) throw new Error(`${name}超出 0 至 100 边界`);
  }
  if (nation.history.monthly.length > 120) {
    throw new Error("月度历史超过 120 条上限");
  }
  if (state.world.countries.some((country) => country.population <= 0 || country.realGDP <= 0)) {
    throw new Error("世界国家出现非正人口或 GDP");
  }
}
