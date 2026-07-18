import inputOutputData from "../../data/config/input-output.json";
import { clamp, safeDivide } from "../core/math";
import type {
  IndustrialCategoryId,
  NationState,
  NationalAccountsProductId,
  NationalAccountsProductState,
  NationalAccountsState,
  SectorId,
} from "../state/game-state";

interface InputOutputProductDefinition {
  id: NationalAccountsProductId;
  name: string;
  importWeight: number;
  finalUseWeights: {
    consumption: number;
    capital: number;
    government: number;
  };
  inputs: Partial<Record<NationalAccountsProductId, number>>;
}

interface InputOutputConfig {
  serviceOutputShares: {
    marketServices: number;
    publicServices: number;
  };
  maximumInputConstraint: number;
  minimumInputConstraint: number;
  inputConstraintActivationCoverage: number;
  inputConstraintPassThrough: number;
  targetInventoryShareOfResidualSupply: number;
  agricultureExportShare: number;
  incomeAccount: {
    consumptionOfFixedCapitalShare: number;
    productionTaxShareOfFiscalRevenue: number;
    maximumProductionTaxShareOfGDP: number;
  };
  products: InputOutputProductDefinition[];
}

const inputOutputConfig = inputOutputData as InputOutputConfig;

export const nationalAccountsProductDefinitions = inputOutputConfig.products.map(
  (product) => ({ id: product.id, name: product.name }),
);

export const NATIONAL_ACCOUNTS_PRODUCT_IDS = [
  "agriculture",
  "mining_energy",
  "basic_materials",
  "consumer_goods",
  "construction",
  "general_machinery",
  "transport_equipment",
  "chemicals_pharmaceuticals",
  "electrical_equipment",
  "electronics_communications",
  "precision_medical",
  "aerospace_advanced",
  "market_services",
  "public_services",
] as const satisfies readonly NationalAccountsProductId[];

const INDUSTRIAL_PRODUCT_IDS = NATIONAL_ACCOUNTS_PRODUCT_IDS.filter(
  (id): id is IndustrialCategoryId =>
    id !== "agriculture" && id !== "market_services" && id !== "public_services",
);

function definitionFor(id: NationalAccountsProductId): InputOutputProductDefinition {
  const definition = inputOutputConfig.products.find((product) => product.id === id);
  if (!definition) throw new Error(`投入产出配置缺少产品：${id}`);
  return definition;
}

function createProductState(id: NationalAccountsProductId): NationalAccountsProductState {
  return {
    id,
    grossOutput: 0,
    domesticSupply: 0,
    imports: 0,
    exports: 0,
    intermediateDemand: 0,
    householdConsumption: 0,
    capitalFormation: 0,
    governmentConsumption: 0,
    inventoryChange: 0,
    valueAdded: 0,
    inputSupplyCoverage: 1,
    inputAvailability: 1,
    supplyUseGap: 0,
  };
}

function createProductAccounts(): NationalAccountsState["products"] {
  return {
    agriculture: createProductState("agriculture"),
    mining_energy: createProductState("mining_energy"),
    basic_materials: createProductState("basic_materials"),
    consumer_goods: createProductState("consumer_goods"),
    construction: createProductState("construction"),
    general_machinery: createProductState("general_machinery"),
    transport_equipment: createProductState("transport_equipment"),
    chemicals_pharmaceuticals: createProductState("chemicals_pharmaceuticals"),
    electrical_equipment: createProductState("electrical_equipment"),
    electronics_communications: createProductState("electronics_communications"),
    precision_medical: createProductState("precision_medical"),
    aerospace_advanced: createProductState("aerospace_advanced"),
    market_services: createProductState("market_services"),
    public_services: createProductState("public_services"),
  };
}

export function createEmptyNationalAccountsState(): NationalAccountsState {
  return {
    products: createProductAccounts(),
    productionGDP: 0,
    incomeGDP: 0,
    expenditureGDP: 0,
    compensationOfEmployees: 0,
    consumptionOfFixedCapital: 0,
    taxesLessSubsidies: 0,
    operatingSurplus: 0,
    householdConsumption: 0,
    governmentConsumption: 0,
    grossCapitalFormation: 0,
    inventoryChange: 0,
    exports: 0,
    imports: 0,
    statisticalDiscrepancyBeforeReconciliation: 0,
    expenditureReconciliationFactor: 1,
    gdpIdentityError: 0,
    maximumProductBalanceError: 0,
    aggregateInputAvailability: 1,
  };
}

function productGrossOutput(nation: NationState, id: NationalAccountsProductId): number {
  if (id === "agriculture") return nation.sectors.primary.output;
  if (id === "market_services") {
    return nation.sectors.tertiary.output *
      inputOutputConfig.serviceOutputShares.marketServices;
  }
  if (id === "public_services") {
    return nation.sectors.tertiary.output *
      inputOutputConfig.serviceOutputShares.publicServices;
  }
  return nation.industries[id].output;
}

function productValueAdded(nation: NationState, id: NationalAccountsProductId): number {
  if (id === "agriculture") return nation.sectors.primary.valueAdded;
  if (id === "market_services") {
    return nation.sectors.tertiary.valueAdded *
      inputOutputConfig.serviceOutputShares.marketServices;
  }
  if (id === "public_services") {
    return nation.sectors.tertiary.valueAdded *
      inputOutputConfig.serviceOutputShares.publicServices;
  }
  return nation.industries[id].valueAdded;
}

function productExports(nation: NationState, id: NationalAccountsProductId): number {
  const priceLevel = Math.max(0.01, nation.economy.priceLevelIndex);
  const realExports = nation.trade.exports / priceLevel;
  if (id === "agriculture") {
    return realExports * inputOutputConfig.agricultureExportShare;
  }
  if (id === "market_services") {
    const industrialExports = INDUSTRIAL_PRODUCT_IDS.reduce(
      (sum, industryId) =>
        sum + nation.industries[industryId].exportValue / priceLevel,
      0,
    );
    return Math.max(
      0,
      realExports - industrialExports -
        realExports * inputOutputConfig.agricultureExportShare,
    );
  }
  if (id === "public_services") return 0;
  return nation.industries[id].exportValue / priceLevel;
}

function normalizedImportWeights(): Map<NationalAccountsProductId, number> {
  const total = inputOutputConfig.products.reduce(
    (sum, product) => sum + Math.max(0, product.importWeight),
    0,
  );
  return new Map(inputOutputConfig.products.map((product) => [
    product.id,
    safeDivide(Math.max(0, product.importWeight), total),
  ]));
}

const importWeights = normalizedImportWeights();

function allocateProductExports(
  nation: NationState,
  products: NationalAccountsState["products"],
): void {
  let overflow = 0;
  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    const target = Math.max(0, productExports(nation, id));
    const capacity = products[id].domesticSupply + products[id].imports;
    products[id].exports = Math.min(target, capacity);
    overflow += Math.max(0, target - capacity);
  }
  if (overflow <= 0) return;
  const eligible = NATIONAL_ACCOUNTS_PRODUCT_IDS.filter(
    (id) => id !== "public_services",
  );
  const spareCapacity = eligible.reduce(
    (sum, id) => sum + Math.max(
      0,
      products[id].domesticSupply + products[id].imports - products[id].exports,
    ),
    0,
  );
  if (spareCapacity <= 0) return;
  const distributable = Math.min(overflow, spareCapacity);
  for (const id of eligible) {
    const spare = Math.max(
      0,
      products[id].domesticSupply + products[id].imports - products[id].exports,
    );
    products[id].exports += distributable * safeDivide(spare, spareCapacity);
  }
}

export function validateInputOutputDefinitions(): string[] {
  const errors: string[] = [];
  const ids = inputOutputConfig.products.map((product) => product.id);
  if (ids.length !== NATIONAL_ACCOUNTS_PRODUCT_IDS.length) {
    errors.push(`投入产出产品应为 ${NATIONAL_ACCOUNTS_PRODUCT_IDS.length} 类`);
  }
  if (new Set(ids).size !== ids.length) errors.push("投入产出产品 ID 存在重复");
  const knownIds = new Set<NationalAccountsProductId>(NATIONAL_ACCOUNTS_PRODUCT_IDS);
  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    if (!ids.includes(id)) errors.push(`投入产出配置缺少产品 ${id}`);
  }
  for (const product of inputOutputConfig.products) {
    const finalWeightTotal = Object.values(product.finalUseWeights).reduce(
      (sum, weight) => sum + weight,
      0,
    );
    if (Math.abs(finalWeightTotal - 1) > 1e-9) {
      errors.push(`${product.id} 的最终使用权重之和必须为 1`);
    }
    const inputTotal = Object.entries(product.inputs).reduce(
      (sum, [inputId, coefficient]) => {
        if (!knownIds.has(inputId as NationalAccountsProductId)) {
          errors.push(`${product.id} 引用了未知中间投入 ${inputId}`);
        }
        if (!Number.isFinite(coefficient) || coefficient < 0 || coefficient >= 1) {
          errors.push(`${product.id} 的 ${inputId} 直接消耗系数无效`);
        }
        return sum + coefficient;
      },
      0,
    );
    if (inputTotal >= 0.85) errors.push(`${product.id} 的中间投入系数之和过高`);
  }
  return errors;
}

function repairFinite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value ?? fallback) : fallback;
}

/** 旧存档缺少国民账户时按当前部门状态确定性重建。 */
export function ensureNationalAccountsState(nation: NationState): void {
  const existing = nation.nationalAccounts as Partial<NationalAccountsState> | undefined;
  if (!existing?.products) {
    nation.nationalAccounts = createEmptyNationalAccountsState();
    updateNationalAccounts(nation);
    return;
  }

  const repaired = createEmptyNationalAccountsState();
  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    const current = existing.products[id] as Partial<NationalAccountsProductState> | undefined;
    if (!current) {
      nation.nationalAccounts = createEmptyNationalAccountsState();
      updateNationalAccounts(nation);
      return;
    }
    repaired.products[id] = {
      id,
      grossOutput: repairFinite(current.grossOutput, 0),
      domesticSupply: repairFinite(current.domesticSupply, 0),
      imports: repairFinite(current.imports, 0),
      exports: repairFinite(current.exports, 0),
      intermediateDemand: repairFinite(current.intermediateDemand, 0),
      householdConsumption: repairFinite(current.householdConsumption, 0),
      capitalFormation: repairFinite(current.capitalFormation, 0),
      governmentConsumption: repairFinite(current.governmentConsumption, 0),
      inventoryChange: Number.isFinite(current.inventoryChange)
        ? current.inventoryChange ?? 0
        : 0,
      valueAdded: repairFinite(current.valueAdded, 0),
      inputSupplyCoverage: clamp(current.inputSupplyCoverage ?? 1, 0, 1),
      inputAvailability: clamp(current.inputAvailability ?? 1, 0, 1),
      supplyUseGap: Number.isFinite(current.supplyUseGap)
        ? current.supplyUseGap ?? 0
        : 0,
    };
  }
  for (const key of Object.keys(repaired) as Array<keyof NationalAccountsState>) {
    if (key === "products") continue;
    const current = existing[key];
    if (typeof current === "number" && Number.isFinite(current)) {
      (repaired[key] as number) = current;
    }
  }
  nation.nationalAccounts = repaired;
}

function calculateIntermediateDemand(
  accounts: NationalAccountsState["products"],
  inputId: NationalAccountsProductId,
): number {
  return NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce((sum, consumerId) => {
    const coefficient = definitionFor(consumerId).inputs[inputId] ?? 0;
    return sum + accounts[consumerId].grossOutput * coefficient;
  }, 0);
}

function calculateInputAvailability(
  accounts: NationalAccountsState["products"],
  consumerId: NationalAccountsProductId,
): number {
  const inputs = Object.entries(definitionFor(consumerId).inputs) as Array<
    [NationalAccountsProductId, number]
  >;
  const totalCoefficient = inputs.reduce((sum, [, coefficient]) => sum + coefficient, 0);
  if (totalCoefficient <= 0) return 1;
  const weightedLogCoverage = inputs.reduce(
    (sum, [inputId, coefficient]) =>
      sum + Math.log(Math.max(0.01, accounts[inputId].inputSupplyCoverage)) * coefficient,
    0,
  );
  return clamp(
    Math.exp(weightedLogCoverage / totalCoefficient),
    inputOutputConfig.minimumInputConstraint,
    inputOutputConfig.maximumInputConstraint,
  );
}

/**
 * 用本月已经形成的产出、进出口和财政状态编制年度化供给使用账户。计算结果
 * 供下一月生产读取，避免同月循环依赖。
 */
export function updateNationalAccounts(nation: NationState): void {
  const accounts = createEmptyNationalAccountsState();
  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    const product = accounts.products[id];
    product.grossOutput = Math.max(0, productGrossOutput(nation, id));
    product.domesticSupply = product.grossOutput;
    product.valueAdded = Math.max(0, productValueAdded(nation, id));
    product.imports = Math.max(
      0,
      nation.trade.imports / Math.max(0.01, nation.economy.priceLevelIndex) *
        (importWeights.get(id) ?? 0),
    );
  }
  allocateProductExports(nation, accounts.products);

  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    const product = accounts.products[id];
    product.intermediateDemand = calculateIntermediateDemand(accounts.products, id);
    const supplyForDomesticUse = Math.max(
      0,
      product.domesticSupply + product.imports - product.exports,
    );
    product.inputSupplyCoverage = product.intermediateDemand > 0
      ? clamp(
          safeDivide(supplyForDomesticUse, product.intermediateDemand),
          inputOutputConfig.minimumInputConstraint,
          inputOutputConfig.maximumInputConstraint,
        )
      : 1;

    const residualSupply = supplyForDomesticUse - product.intermediateDemand;
    const positiveResidual = Math.max(0, residualSupply);
    product.inventoryChange = residualSupply < 0
      ? residualSupply
      : positiveResidual * inputOutputConfig.targetInventoryShareOfResidualSupply;
    const finalUse = positiveResidual - Math.max(0, product.inventoryChange);
    const weights = definitionFor(id).finalUseWeights;
    const weightTotal = weights.consumption + weights.capital + weights.government;
    product.householdConsumption = finalUse * safeDivide(weights.consumption, weightTotal);
    product.capitalFormation = finalUse * safeDivide(weights.capital, weightTotal);
    product.governmentConsumption = finalUse * safeDivide(weights.government, weightTotal);
    const totalUse = product.intermediateDemand +
      product.householdConsumption +
      product.capitalFormation +
      product.governmentConsumption +
      product.exports +
      product.inventoryChange;
    product.supplyUseGap = product.domesticSupply + product.imports - totalUse;
  }

  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    accounts.products[id].inputAvailability = calculateInputAvailability(
      accounts.products,
      id,
    );
  }

  accounts.productionGDP = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + accounts.products[id].valueAdded,
    0,
  );
  const rawConsumption = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + accounts.products[id].householdConsumption,
    0,
  );
  const rawGovernment = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + accounts.products[id].governmentConsumption,
    0,
  );
  const rawCapital = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + accounts.products[id].capitalFormation,
    0,
  );
  const rawInventory = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + accounts.products[id].inventoryChange,
    0,
  );
  const rawExports = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + accounts.products[id].exports,
    0,
  );
  const rawImports = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + accounts.products[id].imports,
    0,
  );
  const rawExpenditureGDP = rawConsumption + rawGovernment + rawCapital +
    rawInventory + rawExports - rawImports;
  accounts.statisticalDiscrepancyBeforeReconciliation =
    accounts.productionGDP - rawExpenditureGDP;
  accounts.expenditureReconciliationFactor = rawExpenditureGDP > 0
    ? clamp(safeDivide(accounts.productionGDP, rawExpenditureGDP), 0.25, 4)
    : 1;
  const reconciliation = accounts.expenditureReconciliationFactor;
  accounts.householdConsumption = rawConsumption * reconciliation;
  accounts.governmentConsumption = rawGovernment * reconciliation;
  accounts.grossCapitalFormation = rawCapital * reconciliation;
  accounts.inventoryChange = rawInventory * reconciliation;
  accounts.exports = rawExports * reconciliation;
  accounts.imports = rawImports * reconciliation;
  accounts.expenditureGDP = accounts.householdConsumption +
    accounts.governmentConsumption +
    accounts.grossCapitalFormation +
    accounts.inventoryChange +
    accounts.exports -
    accounts.imports;

  accounts.compensationOfEmployees = Object.values(nation.sectors).reduce(
    (sum, sector) => sum + sector.averageWage * sector.employment,
    0,
  );
  accounts.consumptionOfFixedCapital = accounts.productionGDP *
    inputOutputConfig.incomeAccount.consumptionOfFixedCapitalShare;
  accounts.taxesLessSubsidies = Math.min(
    Math.max(
      0,
      nation.fiscal.revenue *
        inputOutputConfig.incomeAccount.productionTaxShareOfFiscalRevenue,
    ),
    accounts.productionGDP *
      inputOutputConfig.incomeAccount.maximumProductionTaxShareOfGDP,
  );
  accounts.operatingSurplus = Math.max(
    0,
    accounts.productionGDP -
      accounts.compensationOfEmployees -
      accounts.consumptionOfFixedCapital -
      accounts.taxesLessSubsidies,
  );
  accounts.incomeGDP = accounts.compensationOfEmployees +
    accounts.consumptionOfFixedCapital +
    accounts.taxesLessSubsidies +
    accounts.operatingSurplus;
  accounts.gdpIdentityError = Math.max(
    Math.abs(accounts.productionGDP - accounts.expenditureGDP),
    Math.abs(accounts.productionGDP - accounts.incomeGDP),
  );
  accounts.maximumProductBalanceError = Math.max(
    ...NATIONAL_ACCOUNTS_PRODUCT_IDS.map((id) =>
      Math.abs(accounts.products[id].supplyUseGap)),
  );
  accounts.aggregateInputAvailability = safeDivide(
    NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
      (sum, id) =>
        sum + accounts.products[id].inputAvailability * accounts.products[id].grossOutput,
      0,
    ),
    NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
      (sum, id) => sum + accounts.products[id].grossOutput,
      0,
    ),
    1,
  );
  nation.nationalAccounts = accounts;
}

/** 使用上月投入产出账户形成的中间品可得率约束本月生产。 */
export function inputOutputConstraintForSector(
  nation: NationState,
  sectorId: SectorId,
): number {
  const accounts = nation.nationalAccounts;
  if (!accounts?.products) return 1;
  let availability = 1;
  if (sectorId === "primary") {
    availability = accounts.products.agriculture.inputAvailability;
  } else if (sectorId === "tertiary") {
    availability =
      accounts.products.market_services.inputAvailability *
        inputOutputConfig.serviceOutputShares.marketServices +
      accounts.products.public_services.inputAvailability *
        inputOutputConfig.serviceOutputShares.publicServices;
  } else {
    availability = INDUSTRIAL_PRODUCT_IDS.reduce(
      (sum, id) => sum +
        accounts.products[id].inputAvailability * nation.industries[id].outputShare,
      0,
    );
  }
  const shortage = Math.max(
    0,
    inputOutputConfig.inputConstraintActivationCoverage - availability,
  ) / inputOutputConfig.inputConstraintActivationCoverage;
  return clamp(
    1 - shortage * inputOutputConfig.inputConstraintPassThrough,
    inputOutputConfig.minimumInputConstraint,
    inputOutputConfig.maximumInputConstraint,
  );
}
