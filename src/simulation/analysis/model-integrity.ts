import type { GameState } from "../state/game-state";

export interface ModelIntegrityIndicator {
  id: string;
  name: string;
  relativeError: number;
  tolerance: number;
  passed: boolean;
}

export interface ModelIntegrityReport {
  status: "通过" | "警告";
  passed: number;
  total: number;
  maximumRelativeError: number;
  indicators: ModelIntegrityIndicator[];
}

function relative(error: number, scale: number): number {
  return Math.abs(error) / Math.max(1, Math.abs(scale));
}

function indicator(
  id: string,
  name: string,
  relativeError: number,
  tolerance = 1e-8,
): ModelIntegrityIndicator {
  return {
    id,
    name,
    relativeError,
    tolerance,
    passed: Number.isFinite(relativeError) && relativeError <= tolerance,
  };
}

/** 统一读取所有细分账户的守恒误差，供界面和最终审计共用。 */
export function evaluateModelIntegrity(game: GameState): ModelIntegrityReport {
  const { nation, world } = game;
  const accounts = nation.nationalAccounts;
  const enterprise = nation.enterprises;
  const federalism = nation.fiscal.federalism;
  const financial = nation.financialSystem;
  const agriculture = nation.resources.agriculture;
  const human = nation.humanDevelopment;
  const housing = nation.society.urbanHousing;
  const regional = nation.regionalEconomy;
  const network = world.tradeNetwork;
  const indicators = [
    indicator(
      "national_accounts",
      "国民经济账户",
      Math.max(
        relative(accounts.gdpIdentityError, accounts.productionGDP),
        relative(accounts.maximumProductBalanceError, accounts.productionGDP),
      ),
    ),
    indicator(
      "demography",
      "人口年龄性别账户",
      relative(nation.population.demographicDetail.reconciliationError, nation.population.total),
    ),
    indicator(
      "enterprise",
      "企业所有制账户",
      Math.max(
        relative(enterprise.valueAddedReconciliationError, nation.economy.realGDP),
        relative(enterprise.employmentReconciliationError, nation.labor.employed),
        relative(enterprise.investmentReconciliationError, nation.economy.investment),
        relative(enterprise.exportReconciliationError, nation.trade.exports),
      ),
    ),
    indicator(
      "fiscal",
      "中央地方财政账户",
      Math.max(
        relative(federalism.consolidatedRevenueError, nation.fiscal.revenue),
        relative(federalism.consolidatedExpenditureError, nation.fiscal.expenditure),
        relative(federalism.consolidatedDebtError, nation.fiscal.governmentDebt),
      ),
    ),
    indicator(
      "financial",
      "银行、资本市场与国际收支账户",
      Math.max(
        relative(financial.banking.balanceSheetError, financial.banking.totalAssets),
        relative(
          Math.max(
            0,
            financial.capitalMarket.annualEquityFinancing -
              nation.economy.investment,
          ),
          nation.economy.investment,
        ),
        relative(
          financial.balanceOfPayments.identityError,
          Math.abs(financial.balanceOfPayments.goodsExports) +
            Math.abs(financial.balanceOfPayments.goodsImports),
        ),
      ),
    ),
    indicator(
      "agriculture",
      "农业粮食实物账户",
      relative(agriculture.massBalanceError, agriculture.availableFoodSupply),
    ),
    indicator(
      "energy",
      "能源结构账户",
      nation.resources.infrastructureResources.energyShareError,
    ),
    indicator(
      "human_development",
      "教育劳动力医疗账户",
      Math.max(
        relative(human.educationPopulationError, nation.population.total),
        relative(human.laborForceError, nation.labor.laborForce),
        relative(human.employmentError, nation.labor.employed),
      ),
    ),
    indicator(
      "housing",
      "住房存量账户",
      relative(housing.housingStockError, housing.urbanHousingUnits),
    ),
    indicator(
      "regional",
      "区域与跨区流动账户",
      Math.max(
        relative(regional.populationError, nation.population.total),
        relative(regional.gdpError, nation.economy.realGDP),
        relative(regional.employmentError, nation.labor.employed),
        relative(regional.investmentError, nation.economy.investment),
        relative(regional.exportError, nation.trade.exports),
        relative(regional.migrationFlowError, nation.population.netMigration),
        relative(regional.capitalFlowError, nation.economy.investment),
        relative(regional.fiscalTransferError, federalism.centralToLocalTransfers),
      ),
    ),
    indicator(
      "world_network",
      "世界贸易金融网络",
      Math.max(
        relative(network.exportError, nation.trade.exports),
        relative(network.importError, nation.trade.imports),
        relative(network.investmentError, nation.trade.foreignInvestment),
        relative(network.externalDebtError, nation.trade.externalDebt),
      ),
    ),
  ];
  const passed = indicators.filter((item) => item.passed).length;
  return {
    status: passed === indicators.length ? "通过" : "警告",
    passed,
    total: indicators.length,
    maximumRelativeError: Math.max(...indicators.map((item) => item.relativeError)),
    indicators,
  };
}
