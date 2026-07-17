import type { AnnualSnapshot } from "../../src/simulation/index";

export function annualSnapshotsToCsv(annual: AnnualSnapshot[]): string {
  const headers = [
    "年份", "人口", "实际GDP", "名义GDP", "实际人均GDP", "通胀率",
    "失业率", "财政余额", "债务率", "城市化率", "识字率", "教育指数",
    "科技指数", "预期寿命", "幸福度", "贫困率", "第一产业占比",
    "第二产业占比", "第三产业占比", "GDP排名", "综合评分",
  ];
  const rows = annual.map((item) => [
    item.year,
    item.population,
    item.realGDP,
    item.nominalGDP,
    item.realGDPPerCapita,
    item.inflationRate,
    item.unemploymentRate,
    item.fiscalBalance,
    item.debtToGDP,
    item.urbanizationRate,
    item.literacyRate,
    item.educationIndex,
    item.technologyIndex,
    item.lifeExpectancy,
    item.happinessIndex,
    item.povertyRate,
    item.primarySectorShare,
    item.secondarySectorShare,
    item.tertiarySectorShare,
    item.gdpRank,
    item.score,
  ]);
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}
