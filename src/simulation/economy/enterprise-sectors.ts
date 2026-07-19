import enterpriseData from "../../data/config/enterprise-sectors.json";
import { approach, clamp, safeDivide } from "../core/math";
import type {
  EnterpriseOwnershipAccount,
  EnterpriseOwnershipId,
  EnterpriseSectorState,
  NationState,
} from "../state/game-state";

interface OwnershipDefinition {
  id: EnterpriseOwnershipId;
  name: string;
  baseScore: number;
  productivity: number;
  wage: number;
  export: number;
  profitability: number;
  financing: number;
  equityFinancingSensitivity: number;
}

interface EnterpriseConfig {
  monthlyShareAdjustmentSpeed: number;
  enterprisesPerBillionGDP: { minimum: number; maximum: number };
  ownership: OwnershipDefinition[];
}

const config = enterpriseData as EnterpriseConfig;

export const ENTERPRISE_OWNERSHIP_IDS = [
  "state_owned",
  "collective",
  "private_domestic",
  "foreign_invested",
  "mixed_ownership",
] as const satisfies readonly EnterpriseOwnershipId[];

export const enterpriseOwnershipDefinitions = config.ownership.map(
  ({ id, name }) => ({ id, name }),
);

const definitionById = new Map(config.ownership.map((item) => [item.id, item]));

function definition(id: EnterpriseOwnershipId): OwnershipDefinition {
  const found = definitionById.get(id);
  if (!found) throw new Error(`企业所有制配置缺少：${id}`);
  return found;
}

function emptyAccount(id: EnterpriseOwnershipId): EnterpriseOwnershipAccount {
  return {
    id,
    valueAddedShare: 0.2,
    enterpriseCount: 0,
    output: 0,
    valueAdded: 0,
    employment: 0,
    investment: 0,
    exports: 0,
    averageWage: 0,
    operatingSurplus: 0,
    productivityIndex: definition(id).productivity,
    financingAccess: definition(id).financing,
  };
}

function emptyOwnership(): EnterpriseSectorState["ownership"] {
  return {
    state_owned: emptyAccount("state_owned"),
    collective: emptyAccount("collective"),
    private_domestic: emptyAccount("private_domestic"),
    foreign_invested: emptyAccount("foreign_invested"),
    mixed_ownership: emptyAccount("mixed_ownership"),
  };
}

export function createEmptyEnterpriseSectorState(): EnterpriseSectorState {
  return {
    ownership: emptyOwnership(),
    totalEnterpriseCount: 0,
    aggregateProductivityIndex: 1,
    stateControlledShare: 0.4,
    privateAndMixedShare: 0.4,
    foreignInvestedShare: 0,
    monthlyEntryRate: 0,
    monthlyExitRate: 0,
    valueAddedReconciliationError: 0,
    employmentReconciliationError: 0,
    investmentReconciliationError: 0,
    exportReconciliationError: 0,
  };
}

export function validateEnterpriseSectorDefinitions(): string[] {
  const errors: string[] = [];
  if (config.ownership.length !== ENTERPRISE_OWNERSHIP_IDS.length) {
    errors.push("企业所有制必须为5类");
  }
  if (new Set(config.ownership.map((item) => item.id)).size !== 5) {
    errors.push("企业所有制 ID 缺失或重复");
  }
  for (const item of config.ownership) {
    if (
      item.baseScore <= 0 || item.productivity <= 0 || item.financing <= 0 ||
      item.equityFinancingSensitivity < 0
    ) {
      errors.push(`${item.id} 的结构参数必须大于零`);
    }
  }
  return errors;
}

function targetShares(nation: NationState): Record<EnterpriseOwnershipId, number> {
  const privateCapability = (
    nation.privateEconomy.operatingSpace +
    nation.privateEconomy.entrepreneurialCapacity +
    nation.privateEconomy.technologyCommercialization +
    nation.privateEconomy.exportNetworkStrength
  ) / 4;
  const openness = clamp(nation.trade.openness, 0, 1.5);
  const foreignCapitalIntensity = clamp(
    safeDivide(nation.trade.foreignInvestment, nation.economy.nominalGDP),
    0,
    0.2,
  );
  const scores: Record<EnterpriseOwnershipId, number> = {
    state_owned: definition("state_owned").baseScore *
      (1.35 - nation.economy.institutionalEfficiency * 0.35 - privateCapability * 0.25),
    collective: definition("collective").baseScore *
      (1.25 - nation.society.urbanizationRate * 0.65 - privateCapability * 0.3),
    private_domestic: definition("private_domestic").baseScore +
      nation.privateEconomy.operatingSpace * 0.62 +
      nation.privateEconomy.entrepreneurialCapacity * 0.46,
    foreign_invested: definition("foreign_invested").baseScore +
      openness * 0.09 + foreignCapitalIntensity * 2.8,
    mixed_ownership: definition("mixed_ownership").baseScore +
      nation.privateEconomy.technologyCommercialization * 0.22 +
      nation.economy.institutionalEfficiency * 0.08,
  };
  const total = ENTERPRISE_OWNERSHIP_IDS.reduce(
    (sum, id) => sum + Math.max(0.001, scores[id]),
    0,
  );
  return Object.fromEntries(ENTERPRISE_OWNERSHIP_IDS.map(
    (id) => [id, Math.max(0.001, scores[id]) / total],
  )) as Record<EnterpriseOwnershipId, number>;
}

function allocateByWeight(
  state: EnterpriseSectorState,
  amount: number,
  weight: (id: EnterpriseOwnershipId) => number,
  assign: (account: EnterpriseOwnershipAccount, value: number) => void,
): void {
  const totalWeight = ENTERPRISE_OWNERSHIP_IDS.reduce(
    (sum, id) => sum + Math.max(0, weight(id)),
    0,
  );
  for (const id of ENTERPRISE_OWNERSHIP_IDS) {
    assign(state.ownership[id], amount * safeDivide(Math.max(0, weight(id)), totalWeight));
  }
}

/** 旧存档缺失企业账户时从当前制度能力和宏观总量确定性重建。 */
export function ensureEnterpriseSectorState(nation: NationState): void {
  const existing = nation.enterprises as Partial<EnterpriseSectorState> | undefined;
  const complete = Boolean(existing?.ownership && ENTERPRISE_OWNERSHIP_IDS.every(
    (id) => existing.ownership?.[id] &&
      Number.isFinite(existing.ownership[id].valueAddedShare),
  ));
  if (complete) return;
  nation.enterprises = createEmptyEnterpriseSectorState();
  const targets = targetShares(nation);
  for (const id of ENTERPRISE_OWNERSHIP_IDS) {
    nation.enterprises.ownership[id].valueAddedShare = targets[id];
  }
  updateEnterpriseSectors(nation);
}

/** 分配现有企业部门总量，不直接增加 GDP、就业、投资或出口。 */
export function updateEnterpriseSectors(nation: NationState): void {
  if (!nation.enterprises?.ownership) ensureEnterpriseSectorState(nation);
  const state = nation.enterprises;
  const targets = targetShares(nation);
  let shareTotal = 0;
  for (const id of ENTERPRISE_OWNERSHIP_IDS) {
    const account = state.ownership[id];
    account.valueAddedShare = approach(
      account.valueAddedShare,
      targets[id],
      config.monthlyShareAdjustmentSpeed,
    );
    shareTotal += account.valueAddedShare;
  }
  for (const id of ENTERPRISE_OWNERSHIP_IDS) {
    state.ownership[id].valueAddedShare /= shareTotal;
  }

  const development = clamp(
    Math.log1p(nation.economy.realGDPPerCapita) / Math.log(60_001),
    0,
    1,
  );
  const enterprisesPerBillion = approach(
    config.enterprisesPerBillionGDP.minimum,
    config.enterprisesPerBillionGDP.maximum,
    development,
  );
  state.totalEnterpriseCount = Math.max(
    1,
    nation.economy.realGDP / 1_000_000_000 * enterprisesPerBillion,
  );
  const previousCount = ENTERPRISE_OWNERSHIP_IDS.reduce(
    (sum, id) => sum + state.ownership[id].enterpriseCount,
    0,
  );
  const countGrowth = previousCount > 0
    ? safeDivide(state.totalEnterpriseCount, previousCount, 1) - 1
    : 0;
  state.monthlyEntryRate = clamp(Math.max(0, countGrowth) + development * 0.002, 0, 0.2);
  state.monthlyExitRate = clamp(Math.max(0, -countGrowth) + (1 - nation.society.stabilityIndex / 100) * 0.0015, 0, 0.2);

  const enterpriseValueAdded = nation.nationalAccounts.productionGDP * 0.88;
  const capitalMarketSupport = clamp(
    nation.financialSystem.capitalMarket.equityMarketDepth *
      nation.financialSystem.capitalMarket.marketLiquidity *
      (0.4 + nation.financialSystem.capitalMarket.investorProtectionIndex * 0.6),
    0,
    1,
  );
  for (const id of ENTERPRISE_OWNERSHIP_IDS) {
    const account = state.ownership[id];
    account.enterpriseCount = state.totalEnterpriseCount * account.valueAddedShare;
    account.valueAdded = enterpriseValueAdded * account.valueAddedShare;
    account.output = account.valueAdded * safeDivide(
      Object.values(nation.sectors).reduce((sum, sector) => sum + sector.output, 0),
      nation.economy.realGDP,
      1,
    );
    account.productivityIndex = definition(id).productivity *
      (0.75 + nation.economy.totalFactorProductivity * 0.25);
    account.financingAccess = clamp(
      definition(id).financing *
        (0.75 + nation.economy.institutionalEfficiency * 0.35) *
        (1 + capitalMarketSupport * definition(id).equityFinancingSensitivity * 0.28),
      0.1,
      1.2,
    );
  }
  allocateByWeight(
    state,
    nation.labor.employed,
    (id) => state.ownership[id].valueAddedShare / state.ownership[id].productivityIndex,
    (account, value) => { account.employment = value; },
  );
  allocateByWeight(
    state,
    nation.economy.investment,
    (id) => state.ownership[id].valueAddedShare * state.ownership[id].financingAccess,
    (account, value) => { account.investment = value; },
  );
  allocateByWeight(
    state,
    nation.trade.exports,
    (id) => state.ownership[id].valueAddedShare * definition(id).export,
    (account, value) => { account.exports = value; },
  );
  allocateByWeight(
    state,
    nation.nationalAccounts.operatingSurplus,
    (id) => state.ownership[id].valueAddedShare * definition(id).profitability,
    (account, value) => { account.operatingSurplus = value; },
  );
  const aggregateWage = safeDivide(
    nation.nationalAccounts.compensationOfEmployees,
    nation.labor.employed,
  );
  for (const id of ENTERPRISE_OWNERSHIP_IDS) {
    state.ownership[id].averageWage = aggregateWage * definition(id).wage;
  }
  state.aggregateProductivityIndex = ENTERPRISE_OWNERSHIP_IDS.reduce(
    (sum, id) => sum + state.ownership[id].valueAddedShare * state.ownership[id].productivityIndex,
    0,
  );
  state.stateControlledShare = state.ownership.state_owned.valueAddedShare +
    state.ownership.collective.valueAddedShare;
  state.privateAndMixedShare = state.ownership.private_domestic.valueAddedShare +
    state.ownership.mixed_ownership.valueAddedShare;
  state.foreignInvestedShare = state.ownership.foreign_invested.valueAddedShare;
  state.valueAddedReconciliationError = Math.abs(
    ENTERPRISE_OWNERSHIP_IDS.reduce((sum, id) => sum + state.ownership[id].valueAdded, 0) -
      enterpriseValueAdded,
  );
  state.employmentReconciliationError = Math.abs(
    ENTERPRISE_OWNERSHIP_IDS.reduce((sum, id) => sum + state.ownership[id].employment, 0) -
      nation.labor.employed,
  );
  state.investmentReconciliationError = Math.abs(
    ENTERPRISE_OWNERSHIP_IDS.reduce((sum, id) => sum + state.ownership[id].investment, 0) -
      nation.economy.investment,
  );
  state.exportReconciliationError = Math.abs(
    ENTERPRISE_OWNERSHIP_IDS.reduce((sum, id) => sum + state.ownership[id].exports, 0) -
      nation.trade.exports,
  );
}
