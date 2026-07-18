import type { AnnualSnapshot } from "../../src/simulation/index";

export function annualSnapshotsToCsv(annual: AnnualSnapshot[]): string {
  const headers = [
    "年份", "人口", "实际GDP", "名义GDP", "实际人均GDP", "当年价人均GDP", "现价美元人均GDP", "通胀率",
    "失业率", "财政余额", "债务率", "外汇储备", "外债余额", "外债负债率",
    "年度外债偿付", "资本品外汇满足率", "城市化率", "识字率", "教育指数",
    "科技指数", "已完成科技节点", "产业科技层级", "产业升级准备度",
    "预期寿命", "幸福度", "贫困率", "第一产业占比",
    "第二产业占比", "第三产业占比", "GDP排名", "全球人均GDP排名", "参与排名经济体", "综合评分",
  ];
  const rows = annual.map((item) => [
    item.year,
    item.population,
    item.realGDP,
    item.nominalGDP,
    item.realGDPPerCapita,
    item.currentPriceGDPPerCapita,
    item.currentUSDGDPPerCapita,
    item.inflationRate,
    item.unemploymentRate,
    item.fiscalBalance,
    item.debtToGDP,
    item.foreignExchangeReserves,
    item.externalDebt,
    item.externalDebtToGDP,
    item.annualExternalDebtService,
    item.capitalGoodsImportCoverage,
    item.urbanizationRate,
    item.literacyRate,
    item.educationIndex,
    item.technologyIndex,
    item.completedTechnologyCount,
    item.industryTechnologyTier,
    item.industrialUpgradeReadiness,
    item.lifeExpectancy,
    item.happinessIndex,
    item.povertyRate,
    item.primarySectorShare,
    item.secondarySectorShare,
    item.tertiarySectorShare,
    item.gdpRank,
    item.gdpPerCapitaRank,
    item.gdpPerCapitaRankParticipants,
    item.score,
  ]);
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}
