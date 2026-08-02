import type { ModifierState } from "./game-state";

export type DevelopmentStage =
  | "低收入"
  | "中低收入"
  | "中高收入"
  | "高收入";

/** 文明式城邦关系：贸易伙伴、援助对象或竞争对手。 */
export type CityStateRelationKind =
  | "trade_partner"
  | "aid_recipient"
  | "competitor";

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
  /** 文明式城邦关系标签，调制进口吸收权重。 */
  cityStateRelation: CityStateRelationKind;
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

/** 品类×伙伴出口矩阵；金额与 nation.trade.exports 同口径（名义人民币）。 */
export interface CategoryPartnerExports {
  industrial: Record<string, Record<string, number>>;
  other: Record<string, number>;
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
  /** 工业品类与农产服务等非工业出口按伙伴分解。 */
  categoryPartnerExports: CategoryPartnerExports;
  /** 各工业品类分配误差的最大值。 */
  categoryExportError: number;
  /** 非工业出口分配误差。 */
  otherExportError: number;
  /** 品类关税敏感度与伙伴制裁形成的出口壁垒暴露，0—1。 */
  tradeBarrierExposure: number;
  /** 出口品类集中度 HHI。 */
  categoryConcentrationIndex: number;
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
