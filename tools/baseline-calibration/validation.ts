import {
  NATIONAL_ACCOUNTS_PRODUCT_IDS,
  type GameState,
} from "../../src/simulation/index";

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
  for (const [name, value] of Object.entries({
    民营经营空间: nation.privateEconomy.operatingSpace,
    企业家组织能力: nation.privateEconomy.entrepreneurialCapacity,
    技术商业化能力: nation.privateEconomy.technologyCommercialization,
    民营出口网络: nation.privateEconomy.exportNetworkStrength,
  })) {
    if (value < 0 || value > 1) throw new Error(`${name}超出 0 至 1 边界`);
  }
  if (nation.history.monthly.length > 120) {
    throw new Error("月度历史超过 120 条上限");
  }
  const accounts = nation.nationalAccounts;
  if (Object.keys(accounts.products).length !== NATIONAL_ACCOUNTS_PRODUCT_IDS.length) {
    throw new Error("投入产出产品账户数量不完整");
  }
  if (accounts.productionGDP <= 0) throw new Error("生产法 GDP 必须大于零");
  if (accounts.gdpIdentityError / accounts.productionGDP > 1e-8) {
    throw new Error("生产法、收入法与支出法 GDP 未守恒");
  }
  if (accounts.maximumProductBalanceError / accounts.productionGDP > 1e-8) {
    throw new Error("投入产出供给使用表未守恒");
  }
  for (const product of Object.values(accounts.products)) {
    if (product.inputAvailability < 0 || product.inputAvailability > 1) {
      throw new Error(`${product.id} 的中间投入可得率超出 0 至 1`);
    }
  }
  if (state.world.countries.some((country) => country.population <= 0 || country.realGDP <= 0)) {
    throw new Error("世界国家出现非正人口或 GDP");
  }
}
