import type { ModifierState } from "./game-state";

export type DevelopmentStage =
  | "低收入"
  | "中低收入"
  | "中高收入"
  | "高收入";

export interface WorldCountryState {
  id: string;
  name: string;
  population: number;
  realGDP: number;
  nominalGDP: number;
  priceLevelIndex: number;
  technologyIndex: number;
  educationIndex: number;
  lifeExpectancy: number;
  happinessIndex: number;
  internationalInfluence: number;
  baseGrowthPotential: number;
  developmentStage: DevelopmentStage;
  /** 相对同发展阶段基准的进口吸收倾向，贸易枢纽国家通常更高。 */
  importPropensity: number;
  relationWithChina: number;
  diplomaticStatus: "neutral" | "partner" | "strategic_partner" | "sanctioned";
  tradeAgreement: boolean;
  sanctionLevel: number;
  lastDiplomaticActionMonth: number | null;
  modifiers: ModifierState[];
}

export interface WorldRankings {
  nominalGDP: Record<string, number>;
  nominalGDPPerCapita: Record<string, number>;
  technology: Record<string, number>;
  education: Record<string, number>;
  lifeExpectancy: Record<string, number>;
  happiness: Record<string, number>;
  influence: Record<string, number>;
}

export interface TradePartnerAccount {
  countryId: string;
  exports: number;
  imports: number;
  foreignDirectInvestment: number;
  externalDebtClaims: number;
  tradeBalance: number;
  marketAccessIndex: number;
  shippingRiskIndex: number;
  sanctionExposure: number;
  usdSettlementShare: number;
  renminbiSettlementShare: number;
  otherCurrencySettlementShare: number;
}

/** 中国与世界国家之间的贸易、投资、债权和结算网络。 */
export interface WorldTradeNetworkState {
  partners: Record<string, TradePartnerAccount>;
  exportConcentrationIndex: number;
  importConcentrationIndex: number;
  topExportPartnerId: string | null;
  topImportPartnerId: string | null;
  averageShippingRisk: number;
  sanctionExposure: number;
  renminbiSettlementShare: number;
  exportError: number;
  importError: number;
  investmentError: number;
  externalDebtError: number;
}

export interface WorldState {
  countries: WorldCountryState[];
  rankings: WorldRankings;
  globalDemandIndex: number;
  /** 外国可及进口吸收池的累积指数，影响中国出口目标。 */
  foreignImportDemandIndex: number;
  /** 上月全部可及外国进口吸收池名义规模。 */
  foreignImportPool: number;
  /** 追踪各国名义 GDP，用于计算实际外国增长。 */
  lastForeignNominalGDP: Record<string, number>;
  worldPriceLevel: number;
  tradeNetwork: WorldTradeNetworkState;
}
