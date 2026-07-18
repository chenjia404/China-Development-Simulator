import marketDynamicsData from "../../data/config/market-dynamics.json";
import { approach, clamp, safeDivide } from "../core/math";
import type {
  MarketDynamicsState,
  NationState,
  NationalAccountsProductId,
  ProductMarketState,
  SectorId,
} from "../state/game-state";
import {
  inputCoefficientsForProduct,
  NATIONAL_ACCOUNTS_PRODUCT_IDS,
} from "./national-accounts";

interface MarketDynamicsConfig {
  priceAdjustmentSpeed: number;
  relativePriceAdjustmentLimit: number;
  inventoryDemandPressure: number;
  inputCostPassThrough: number;
  wageCostPassThrough: number;
  targetInventoryMonthsByProduct: Record<NationalAccountsProductId, number>;
  consumerPriceWeights: Partial<Record<NationalAccountsProductId, number>>;
  producerPriceWeights: Partial<Record<NationalAccountsProductId, number>>;
  inventoryCycle: {
    monthlyInventoryClearanceSpeed: number;
    excessInventoryActivationRatio: number;
    maximumExcessInventoryRatio: number;
    productionPassThrough: number;
    minimumProductionMultiplier: number;
  };
  wages: {
    monthlyAdjustmentLimit: number;
    referenceLaborShare: number;
    minimumLaborShare: number;
    maximumLaborShare: number;
  };
}

const config = marketDynamicsData as MarketDynamicsConfig;

export function validateMarketDynamicsDefinitions(): string[] {
  const errors: string[] = [];
  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    const months = config.targetInventoryMonthsByProduct[id];
    if (!Number.isFinite(months) || months < 0 || months > 12) {
      errors.push(`${id} 的目标库存月数无效`);
    }
  }
  for (const [name, weights] of [
    ["居民消费价格", config.consumerPriceWeights],
    ["工业生产者价格", config.producerPriceWeights],
  ] as const) {
    const total = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
      (sum, id) => sum + (weights[id] ?? 0),
      0,
    );
    if (Math.abs(total - 1) > 1e-9) errors.push(`${name}权重之和必须为 1`);
  }
  if (
    config.inventoryCycle.excessInventoryActivationRatio >=
    config.inventoryCycle.maximumExcessInventoryRatio
  ) {
    errors.push("过量库存触发点必须低于最大库存偏离率");
  }
  return errors;
}

function createProductMarketState(
  id: NationalAccountsProductId,
): ProductMarketState {
  return {
    id,
    priceIndex: 1,
    annualPriceInflation: 0.02,
    inventoryStock: 0,
    targetInventoryStock: 0,
    inventoryMonths: 0,
    inventoryGapRatio: 0,
    demandPressure: 0,
    inputCostPressure: 0,
  };
}

function createProductMarkets(): MarketDynamicsState["products"] {
  return {
    agriculture: createProductMarketState("agriculture"),
    mining_energy: createProductMarketState("mining_energy"),
    basic_materials: createProductMarketState("basic_materials"),
    consumer_goods: createProductMarketState("consumer_goods"),
    construction: createProductMarketState("construction"),
    general_machinery: createProductMarketState("general_machinery"),
    transport_equipment: createProductMarketState("transport_equipment"),
    chemicals_pharmaceuticals: createProductMarketState("chemicals_pharmaceuticals"),
    electrical_equipment: createProductMarketState("electrical_equipment"),
    electronics_communications: createProductMarketState("electronics_communications"),
    precision_medical: createProductMarketState("precision_medical"),
    aerospace_advanced: createProductMarketState("aerospace_advanced"),
    market_services: createProductMarketState("market_services"),
    public_services: createProductMarketState("public_services"),
  };
}

export function createEmptyMarketDynamicsState(): MarketDynamicsState {
  return {
    products: createProductMarkets(),
    consumerPriceIndex: 1,
    producerPriceIndex: 1,
    gdpDeflator: 1,
    nominalWageIndex: 1,
    realWageIndex: 1,
    annualNominalWageGrowth: 0,
    annualRealWageGrowth: 0,
    aggregateNominalWage: 0,
    laborIncomeShare: config.wages.referenceLaborShare,
    outputGap: 0,
    aggregateInventoryMonths: 0,
    inventoryCycleIndex: 1,
    aggregateDemandPressure: 0,
    aggregateCostPressure: 0,
  };
}

function finite(value: number | undefined, fallback: number, minimum = 0): number {
  return Number.isFinite(value) ? Math.max(minimum, value ?? fallback) : fallback;
}

function targetInventoryStock(nation: NationState, id: NationalAccountsProductId): number {
  const account = nation.nationalAccounts.products[id];
  const domesticUse = Math.max(
    0,
    account.domesticSupply + account.imports - account.exports,
  );
  return domesticUse * config.targetInventoryMonthsByProduct[id] / 12;
}

/** 旧存档缺少市场状态时，以当前供给使用表的目标库存中性重建。 */
export function ensureMarketDynamicsState(nation: NationState): void {
  const existing = nation.marketDynamics as Partial<MarketDynamicsState> | undefined;
  const isUninitialized = !existing?.products ||
    NATIONAL_ACCOUNTS_PRODUCT_IDS.every((id) => {
      const product = existing.products?.[id];
      return !product || (
        (product.inventoryStock ?? 0) <= 0 &&
        (product.targetInventoryStock ?? 0) <= 0
      );
    });
  if (isUninitialized) {
    const created = createEmptyMarketDynamicsState();
    for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
      const target = targetInventoryStock(nation, id);
      created.products[id].inventoryStock = target;
      created.products[id].targetInventoryStock = target;
      created.products[id].inventoryMonths = config.targetInventoryMonthsByProduct[id];
    }
    created.gdpDeflator = Math.max(0.01, nation.economy.priceLevelIndex);
    created.consumerPriceIndex = created.gdpDeflator;
    created.producerPriceIndex = created.gdpDeflator;
    nation.marketDynamics = created;
    return;
  }

  const existingProducts = existing.products;
  if (!existingProducts) return;
  const repaired = createEmptyMarketDynamicsState();
  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    const current = existingProducts[id] as Partial<ProductMarketState> | undefined;
    const target = targetInventoryStock(nation, id);
    if (!current) {
      repaired.products[id].inventoryStock = target;
      repaired.products[id].targetInventoryStock = target;
      repaired.products[id].inventoryMonths = config.targetInventoryMonthsByProduct[id];
      continue;
    }
    repaired.products[id] = {
      id,
      priceIndex: finite(current.priceIndex, nation.economy.priceLevelIndex, 0.01),
      annualPriceInflation: clamp(current.annualPriceInflation ?? 0.02, -0.5, 2),
      inventoryStock: finite(current.inventoryStock, target),
      targetInventoryStock: finite(current.targetInventoryStock, target),
      inventoryMonths: finite(current.inventoryMonths, config.targetInventoryMonthsByProduct[id]),
      inventoryGapRatio: clamp(current.inventoryGapRatio ?? 0, -1, 10),
      demandPressure: clamp(current.demandPressure ?? 0, -2, 2),
      inputCostPressure: clamp(current.inputCostPressure ?? 0, -0.5, 0.5),
    };
  }
  for (const key of Object.keys(repaired) as Array<keyof MarketDynamicsState>) {
    if (key === "products") continue;
    const current = existing[key];
    if (typeof current === "number" && Number.isFinite(current)) {
      (repaired[key] as number) = current;
    }
  }
  nation.marketDynamics = repaired;
}

function weightedPriceIndex(
  state: MarketDynamicsState,
  weights: Partial<Record<NationalAccountsProductId, number>>,
): number {
  const totalWeight = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + (weights[id] ?? 0),
    0,
  );
  if (totalWeight <= 0) return state.gdpDeflator;
  const weightedLog = NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce(
    (sum, id) => sum + Math.log(Math.max(0.01, state.products[id].priceIndex)) *
      (weights[id] ?? 0),
    0,
  );
  return Math.exp(weightedLog / totalWeight);
}

function inputCostPressure(
  state: MarketDynamicsState,
  productId: NationalAccountsProductId,
): number {
  const inputs = inputCoefficientsForProduct(productId);
  let totalCoefficient = 0;
  let weightedRelativeCost = 0;
  for (const inputId of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    const coefficient = inputs[inputId] ?? 0;
    totalCoefficient += coefficient;
    weightedRelativeCost += coefficient * (
      safeDivide(
        state.products[inputId].priceIndex,
        state.products[productId].priceIndex,
        1,
      ) - 1
    );
  }
  return clamp(safeDivide(weightedRelativeCost, totalCoefficient), -0.5, 0.5);
}

function updateWages(nation: NationState, state: MarketDynamicsState): number {
  const employed = Object.values(nation.sectors).reduce(
    (sum, sector) => sum + sector.employment,
    0,
  );
  const compensation = nation.nationalAccounts.compensationOfEmployees;
  // 国民账户劳动报酬采用实际价值口径，编制名义工资前先乘 GDP 平减指数。
  const currentWage = safeDivide(
    compensation * Math.max(0.01, nation.economy.priceLevelIndex),
    employed,
  );
  const previousWage = state.aggregateNominalWage;
  const monthlyGrowth = previousWage > 0
    ? clamp(
        safeDivide(currentWage, previousWage, 1) - 1,
        -config.wages.monthlyAdjustmentLimit,
        config.wages.monthlyAdjustmentLimit,
      )
    : 0;
  const previousRealWageIndex = state.realWageIndex;
  state.aggregateNominalWage = currentWage;
  state.nominalWageIndex = Math.max(0.01, state.nominalWageIndex * (1 + monthlyGrowth));
  state.annualNominalWageGrowth = (1 + monthlyGrowth) ** 12 - 1;
  state.laborIncomeShare = clamp(
    safeDivide(compensation, nation.nationalAccounts.productionGDP),
    config.wages.minimumLaborShare,
    config.wages.maximumLaborShare,
  );
  return previousRealWageIndex;
}

/**
 * 在当月生产、贸易、财政、通胀和国民账户均已形成后结算。相对价格与库存只
 * 影响下一月，保证月度管线不存在同月需求—价格—产出的循环依赖。
 */
export function updateMarketDynamics(nation: NationState): void {
  if (!nation.marketDynamics?.products) ensureMarketDynamicsState(nation);
  const state = nation.marketDynamics;
  const previousRealWageIndex = updateWages(nation, state);
  const macroInflation = clamp(nation.economy.inflationRate, -0.5, 2);

  let weightedDemandPressure = 0;
  let weightedCostPressure = 0;
  let totalOutput = 0;
  let totalInventory = 0;
  let totalTargetInventory = 0;
  for (const id of NATIONAL_ACCOUNTS_PRODUCT_IDS) {
    const market = state.products[id];
    const account = nation.nationalAccounts.products[id];
    const target = targetInventoryStock(nation, id);
    const inventoryBeforeClearance = Math.max(
      0,
      market.inventoryStock + account.inventoryChange / 12,
    );
    market.targetInventoryStock = target;
    market.inventoryStock = approach(
      inventoryBeforeClearance,
      target,
      config.inventoryCycle.monthlyInventoryClearanceSpeed,
    );
    market.inventoryMonths = safeDivide(
      market.inventoryStock * 12,
      Math.max(1, account.domesticSupply + account.imports - account.exports),
    );
    market.inventoryGapRatio = clamp(
      safeDivide(market.inventoryStock - target, Math.max(1, target)),
      -1,
      10,
    );
    market.demandPressure = clamp(-market.inventoryGapRatio, -2, 2);
    market.inputCostPressure = inputCostPressure(state, id);
    const relativePricePressure = clamp(
      market.demandPressure * config.inventoryDemandPressure +
        market.inputCostPressure * config.inputCostPassThrough +
        (state.annualNominalWageGrowth - macroInflation) *
          config.wageCostPassThrough,
      -config.relativePriceAdjustmentLimit,
      config.relativePriceAdjustmentLimit,
    );
    const targetInflation = clamp(macroInflation + relativePricePressure, -0.5, 2);
    market.annualPriceInflation = approach(
      market.annualPriceInflation,
      targetInflation,
      config.priceAdjustmentSpeed,
    );
    market.priceIndex = Math.max(
      0.01,
      market.priceIndex * (1 + market.annualPriceInflation) ** (1 / 12),
    );

    const outputWeight = Math.max(0, account.grossOutput);
    weightedDemandPressure += market.demandPressure * outputWeight;
    weightedCostPressure += market.inputCostPressure * outputWeight;
    totalOutput += outputWeight;
    totalInventory += market.inventoryStock;
    totalTargetInventory += target;
  }

  state.consumerPriceIndex = weightedPriceIndex(state, config.consumerPriceWeights);
  state.producerPriceIndex = weightedPriceIndex(state, config.producerPriceWeights);
  state.gdpDeflator = nation.economy.priceLevelIndex;
  state.realWageIndex = safeDivide(
    state.nominalWageIndex,
    Math.max(0.01, state.consumerPriceIndex),
    state.nominalWageIndex,
  );
  state.annualRealWageGrowth = previousRealWageIndex > 0
    ? (safeDivide(state.realWageIndex, previousRealWageIndex, 1) ** 12) - 1
    : 0;
  state.aggregateDemandPressure = safeDivide(weightedDemandPressure, totalOutput);
  state.aggregateCostPressure = safeDivide(weightedCostPressure, totalOutput);
  state.aggregateInventoryMonths = safeDivide(totalInventory * 12, totalOutput);
  const aggregateInventoryGap = safeDivide(
    totalInventory - totalTargetInventory,
    Math.max(1, totalTargetInventory),
  );
  state.inventoryCycleIndex = clamp(
    1 - Math.max(0, aggregateInventoryGap) *
      config.inventoryCycle.productionPassThrough,
    config.inventoryCycle.minimumProductionMultiplier,
    1.05,
  );
  const weightedUtilization = safeDivide(
    Object.values(nation.sectors).reduce(
      (sum, sector) => sum + sector.capacityUtilization * sector.valueAdded,
      0,
    ),
    Object.values(nation.sectors).reduce(
      (sum, sector) => sum + sector.valueAdded,
      0,
    ),
    0.75,
  );
  state.outputGap = clamp(safeDivide(weightedUtilization, 0.75, 1) - 1, -0.5, 0.5);
}

function productInventoryConstraint(state: ProductMarketState): number {
  const excess = Math.max(
    0,
    state.inventoryGapRatio - config.inventoryCycle.excessInventoryActivationRatio,
  );
  const normalized = clamp(
    safeDivide(
      excess,
      config.inventoryCycle.maximumExcessInventoryRatio -
        config.inventoryCycle.excessInventoryActivationRatio,
    ),
    0,
    1,
  );
  return clamp(
    1 - normalized * config.inventoryCycle.productionPassThrough,
    config.inventoryCycle.minimumProductionMultiplier,
    1,
  );
}

/** 上月过量库存抑制本月生产；短缺主要经价格和已有投入可得率传导。 */
export function inventoryCycleConstraintForSector(
  nation: NationState,
  sectorId: SectorId,
): number {
  const state = nation.marketDynamics;
  if (!state?.products) return 1;
  if (sectorId === "primary") {
    return productInventoryConstraint(state.products.agriculture);
  }
  if (sectorId === "tertiary") {
    // 服务无法像实物商品一样形成可跨期销售的成品库存，库存只用于价格观察。
    return 1;
  }
  return NATIONAL_ACCOUNTS_PRODUCT_IDS.reduce((sum, id) => {
    if (id === "agriculture" || id === "market_services" || id === "public_services") {
      return sum;
    }
    return sum + productInventoryConstraint(state.products[id]) *
      nation.industries[id].outputShare;
  }, 0);
}
