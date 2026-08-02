import {
  NATIONAL_ACCOUNTS_PRODUCT_IDS,
  AGE_BAND_IDS,
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
    幸福度: nation.society.happinessIndex,
    稳定度: nation.society.stabilityIndex,
  })) {
    if (value < 0 || value > 100) throw new Error(`${name}超出 0 至 100 边界`);
  }
  // 科技指数无硬顶，但禁止负值与无边际递减约束下的异常发散。
  if (nation.technology.index < 0 || !Number.isFinite(nation.technology.index)) {
    throw new Error("科技指数必须为非负有限值");
  }
  if (nation.technology.index > 2_000) {
    throw new Error("科技指数异常发散");
  }
  if (
    state.world.countries.some(
      (country) =>
        country.technologyIndex < 0 ||
        !Number.isFinite(country.technologyIndex) ||
        country.technologyIndex > 2_000,
    )
  ) {
    throw new Error("世界国家科技指数出现负值或异常发散");
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
  const market = nation.marketDynamics;
  if (Object.keys(market.products).length !== NATIONAL_ACCOUNTS_PRODUCT_IDS.length) {
    throw new Error("产品价格与库存账户数量不完整");
  }
  for (const product of Object.values(market.products)) {
    if (product.priceIndex <= 0) throw new Error(`${product.id} 的价格指数必须大于零`);
    if (product.inventoryStock < 0 || product.inventoryMonths < 0) {
      throw new Error(`${product.id} 的库存不得为负`);
    }
  }
  const demographic = nation.population.demographicDetail;
  if (Object.keys(demographic.cohorts).length !== AGE_BAND_IDS.length) {
    throw new Error("年龄性别人口队列数量不完整");
  }
  const cohortPopulation = AGE_BAND_IDS.reduce(
    (sum, id) => sum + demographic.cohorts[id].male + demographic.cohorts[id].female,
    0,
  );
  if (Math.abs(cohortPopulation - nation.population.total) > 1) {
    throw new Error("年龄性别队列与总人口未调和");
  }
  if (
    demographic.households.householdCount <= 0 ||
    demographic.households.averageHouseholdSize <= 0 ||
    demographic.households.totalDependencyRatio < 0
  ) {
    throw new Error("家庭户或抚养比账户无效");
  }
  const enterprises = nation.enterprises;
  if (Object.keys(enterprises.ownership).length !== 5) {
    throw new Error("企业所有制账户数量不完整");
  }
  const enterpriseShare = Object.values(enterprises.ownership).reduce(
    (sum, account) => sum + account.valueAddedShare,
    0,
  );
  if (Math.abs(enterpriseShare - 1) > 1e-8) {
    throw new Error("企业所有制增加值份额未守恒");
  }
  if (
    enterprises.valueAddedReconciliationError /
      Math.max(1, nation.nationalAccounts.productionGDP * 0.88) > 1e-10 ||
    enterprises.employmentReconciliationError /
      Math.max(1, nation.labor.employed) > 1e-10 ||
    enterprises.investmentReconciliationError /
      Math.max(1, nation.economy.investment) > 1e-10 ||
    enterprises.exportReconciliationError /
      Math.max(1, nation.trade.exports) > 1e-10
  ) {
    throw new Error("企业账户与宏观总量未调和");
  }
  const federalism = nation.fiscal.federalism;
  if (
    federalism.consolidatedRevenueError / Math.max(1, nation.fiscal.revenue) > 1e-10 ||
    federalism.consolidatedExpenditureError / Math.max(1, nation.fiscal.expenditure) > 1e-10 ||
    federalism.consolidatedDebtError / Math.max(1, nation.fiscal.governmentDebt) > 1e-10
  ) throw new Error("中央地方合并财政未守恒");
  if (federalism.socialProtection.reserve < 0) throw new Error("社会保障储备不得为负");
  const financial = nation.financialSystem;
  if (
    financial.monetary.monetaryBase < 0 ||
    financial.monetary.broadMoney < 0 ||
    financial.banking.totalLoans < 0 ||
    financial.banking.nonPerformingLoanRatio < 0 ||
    financial.banking.nonPerformingLoanRatio > 1
  ) throw new Error("货币银行账户出现无效存量或比例");
  if (
    financial.banking.balanceSheetError /
      Math.max(1, financial.banking.totalAssets) > 1e-10
  ) throw new Error("银行资产负债表未守恒");
  if (
    financial.balanceOfPayments.identityError /
      Math.max(1, Math.abs(financial.balanceOfPayments.reserveAssetChange)) > 1e-10
  ) throw new Error("国际收支表未守恒");
  const agriculture = nation.resources.agriculture;
  if (
    agriculture.cultivatedLandHectares <= 0 ||
    agriculture.grainYieldKgPerHectare <= 0 ||
    agriculture.strategicReserveStock < 0 ||
    agriculture.foodSecurityCoverage < 0 ||
    agriculture.rationCoverageRate < 0 ||
    agriculture.rationCoverageRate > 1
  ) throw new Error("农业农村账户出现无效实物存量或比例");
  if (
    agriculture.massBalanceError /
      Math.max(1, agriculture.availableFoodSupply) > 1e-10
  ) throw new Error("粮食供需库存账户未守恒");
  const infrastructureResources = nation.resources.infrastructureResources;
  if (
    infrastructureResources.energyShareError > 1e-10 ||
    infrastructureResources.totalPrimaryEnergy < 0 ||
    infrastructureResources.freightCapacity <= 0 ||
    infrastructureResources.carbonEmissions < 0 ||
    infrastructureResources.airPollutionIndex < 0 ||
    infrastructureResources.airPollutionIndex > 100
  ) throw new Error("能源运输环境账户无效或能源份额未守恒");
  const humanDevelopment = nation.humanDevelopment;
  if (
    humanDevelopment.educationPopulationError > 1 ||
    humanDevelopment.laborForceError /
      Math.max(1, nation.labor.laborForce) > 1e-10 ||
    humanDevelopment.employmentError /
      Math.max(1, nation.labor.employed) > 1e-10 ||
    humanDevelopment.healthyLifeExpectancy > nation.health.lifeExpectancy ||
    humanDevelopment.healthRelatedLaborLoss < 0
  ) throw new Error("教育劳动力医疗细账未守恒或出现无效指标");
  const housing = nation.society.urbanHousing;
  if (
    housing.urbanHousingUnits <= 0 ||
    housing.occupiedUnits < 0 ||
    housing.vacantUnits < 0 ||
    housing.homePriceIndex <= 0 ||
    housing.urbanServiceCoverage < 0 ||
    housing.housingStockError / Math.max(1, housing.urbanHousingUnits) > 1e-10
  ) throw new Error("住房土地城市化账户无效或住房存量未守恒");
  const regional = nation.regionalEconomy;
  if (
    regional.populationError / Math.max(1, nation.population.total) > 1e-10 ||
    regional.gdpError / Math.max(1, nation.economy.realGDP) > 1e-10 ||
    regional.employmentError / Math.max(1, nation.labor.employed) > 1e-10 ||
    regional.investmentError / Math.max(1, nation.economy.investment) > 1e-10 ||
    regional.exportError / Math.max(1, nation.trade.exports) > 1e-10 ||
    regional.migrationFlowError / Math.max(1, nation.population.total) > 1e-10 ||
    regional.capitalFlowError / Math.max(1, nation.economy.investment) > 1e-10 ||
    regional.fiscalTransferError / Math.max(1, nation.fiscal.revenue) > 1e-10
  ) throw new Error("区域经济或跨区流动账户未守恒");
  const tradeNetwork = state.world.tradeNetwork;
  if (
    tradeNetwork.exportError / Math.max(1, nation.trade.exports) > 1e-10 ||
    tradeNetwork.importError / Math.max(1, nation.trade.imports) > 1e-10 ||
    tradeNetwork.investmentError / Math.max(1, nation.trade.foreignInvestment) > 1e-10 ||
    tradeNetwork.externalDebtError / Math.max(1, nation.trade.externalDebt) > 1e-10 ||
    tradeNetwork.categoryExportError / Math.max(1, nation.trade.exports) > 1e-10 ||
    tradeNetwork.otherExportError / Math.max(1, nation.trade.exports) > 1e-10 ||
    tradeNetwork.renminbiSettlementShare < 0 ||
    tradeNetwork.renminbiSettlementShare > 1 ||
    tradeNetwork.tradeBarrierExposure < 0 ||
    tradeNetwork.tradeBarrierExposure > 1
  ) throw new Error("世界贸易与国际金融网络未守恒");
  const defense = nation.securityDefense;
  if (
    defense.annualDefenseBudget < 0 ||
    defense.defenseCapitalStock < 0 ||
    defense.readinessIndex < 0 || defense.readinessIndex > 100 ||
    defense.cumulativeConflictMonths < 0 ||
    defense.cumulativeConflictCasualties < 0 ||
    defense.cumulativeWarCost < 0
  ) throw new Error("国防战争安全账户出现无效库存或比例");
  const institutions = nation.institutions;
  if (
    institutions.stateCapacity < 0 || institutions.stateCapacity > 1 ||
    institutions.effectivePolicyExecutionRate < 0 ||
    institutions.effectivePolicyExecutionRate > 1 ||
    institutions.activeRiskIds.some((id) => !institutions.risks[id]?.active) ||
    Object.values(institutions.risks).some((risk) =>
      risk.pressure < 0 || risk.pressure > 1 || risk.consecutiveMonths < 0
    )
  ) throw new Error("制度执行或内生风险因果图出现无效状态");
  if (
    market.consumerPriceIndex <= 0 ||
    market.producerPriceIndex <= 0 ||
    market.gdpDeflator <= 0 ||
    market.nominalWageIndex <= 0 ||
    market.realWageIndex <= 0
  ) {
    throw new Error("价格或工资指数必须大于零");
  }
  if (state.world.countries.some((country) => country.population <= 0 || country.realGDP <= 0)) {
    throw new Error("世界国家出现非正人口或 GDP");
  }
}
