import { describe, expect, it } from "vitest";
import type { AnnualSnapshot } from "../../simulation/state/history-state";
import { createInitialGameState } from "../../simulation/state/initial-state";
import {
  availableShareMilestones,
  buildSharePayload,
  listUnlockedMilestones,
  SHARE_BRAND,
} from "./index";

function stubAnnual(
  partial: Partial<AnnualSnapshot> & Pick<AnnualSnapshot, "year" | "score" | "gdpRank">,
): AnnualSnapshot {
  const { year, score, gdpRank, ...rest } = partial;
  return {
    year,
    month: 12,
    population: 1_000_000_000,
    realGDP: 1e12,
    nominalGDP: 1e12,
    inflationRate: 0.02,
    consumerPriceIndex: 1,
    producerPriceIndex: 1,
    realWageIndex: 1,
    aggregateInventoryMonths: 1,
    outputGap: 0,
    averageHouseholdSize: 3,
    totalDependencyRatio: 0.4,
    monthlyRuralToUrbanMigration: 0,
    stateControlledEnterpriseShare: 0.5,
    privateAndMixedEnterpriseShare: 0.4,
    foreignInvestedEnterpriseShare: 0.1,
    enterpriseProductivityIndex: 1,
    centralRevenueShare: 0.5,
    centralToLocalTransfers: 0,
    socialProtectionReserve: 0,
    broadMoney: 0,
    totalBankLoans: 0,
    nonPerformingLoanRatio: 0,
    currentAccountBalance: 0,
    officialExchangeRate: 1,
    cultivatedLandHectares: 1,
    grainYieldKgPerHectare: 1,
    strategicFoodReserve: 1,
    foodSelfSufficiencyRate: 1,
    dailyCaloriesPerCapita: 2000,
    energyImportDependence: 0.1,
    logisticsEfficiencyIndex: 1,
    carbonEmissions: 1,
    airPollutionIndex: 1,
    higherEducationEnrollmentRate: 0.1,
    advancedSkillShare: 0.1,
    skillMismatchRate: 0.1,
    healthyLifeExpectancy: 60,
    healthRelatedLaborLoss: 0,
    urbanHousingUnits: 1,
    housingShortageUnits: 0,
    homePriceIndex: 1,
    priceToIncomeRatio: 1,
    urbanServiceCoverage: 0.5,
    regionalGDPPerCapitaRatio: 1,
    coastalGDPShare: 0.5,
    westernDevelopmentIndex: 0.5,
    exportConcentrationIndex: 0.2,
    tradeSanctionExposure: 0,
    renminbiSettlementShare: 0.1,
    defenseCapitalStock: 1,
    defenseReadinessIndex: 0.5,
    activeConflictIntensity: 0,
    cumulativeConflictCasualties: 0,
    stateCapacity: 0.5,
    effectivePolicyExecutionRate: 0.5,
    highestEndogenousRiskPressure: 0,
    activeEndogenousRiskCount: 0,
    unemploymentRate: 0.05,
    foreignExchangeReserves: 1,
    remittanceInflows: 0,
    externalDebt: 0,
    externalDebtToGDP: 0,
    annualExternalDebtService: 0,
    capitalGoodsImportCoverage: 1,
    realGDPPerCapita: 1000,
    currentPriceGDPPerCapita: 2000,
    currentUSDGDPPerCapita: 500,
    gdpPerCapitaRank: 80,
    gdpPerCapitaRankParticipants: 180,
    fiscalBalance: 0,
    debtToGDP: 0.2,
    educationIndex: 50,
    technologyIndex: 40,
    completedTechnologyCount: 0,
    industryTechnologyTier: 1,
    industrialUpgradeReadiness: 0.3,
    lifeExpectancy: 70,
    happinessIndex: 55,
    povertyRate: 0.2,
    urbanizationRate: 0.3,
    literacyRate: 0.8,
    primarySectorShare: 0.2,
    secondarySectorShare: 0.4,
    tertiarySectorShare: 0.4,
    score,
    gdpRank,
    ...rest,
  };
}

describe("分享格式化与里程碑", () => {
  it("开局应可生成成绩卡文案", () => {
    const game = createInitialGameState(1949);
    const payload = buildSharePayload(game, { cardType: "score" });

    expect(payload.effectiveType).toBe("score");
    expect(payload.card.type).toBe("score");
    expect(payload.card.title).toBe("本局成绩");
    expect(payload.card.subtitle).toContain("1949");
    expect(payload.copyText).toContain(SHARE_BRAND);
    expect(payload.copyText).toContain("1949年1月");
    expect(payload.fileName).toMatch(/^china-dev-sim-score-1949-01\.png$/);
    expect(payload.card.type).toBe("score");
    if (payload.card.type === "score") {
      expect(payload.card.hero.label).toContain("排名");
      expect(payload.card.metrics.length).toBeLessThanOrEqual(4);
    }
  });

  it("开局尚未有年度结算时不解锁排名里程碑", () => {
    const game = createInitialGameState(1949);
    const unlocked = availableShareMilestones(game);
    expect(unlocked.some((item) => item.id.startsWith("gdp_rank_"))).toBe(false);
    expect(unlocked).toEqual([]);

    const payload = buildSharePayload(game, { cardType: "milestone" });
    expect(payload.effectiveType).toBe("score");
    expect(payload.card.type).toBe("score");
    expect(payload.shareText).not.toContain("http");
    expect(payload.copyText).toContain(SHARE_BRAND);
  });

  it("无比对年份时对比卡回退成绩卡", () => {
    const game = createInitialGameState(1949);
    // 清空年度历史，确保没有任何校准锚点可比对
    game.nation.history.annual = [];
    const payload = buildSharePayload(game, {
      cardType: "compare",
      comparisonTargetId: "history",
    });
    expect(payload.effectiveType).toBe("score");
    expect(payload.card.type).toBe("score");
  });

  it("起始于 1979 年但无 1978 快照时，不生成空壳年份里程碑", () => {
    const game = createInitialGameState(1949, 1979);
    const unlocked = listUnlockedMilestones(game);
    expect(unlocked.some((item) => item.id === "year_1978")).toBe(false);
  });

  it("有 1978 年快照时解锁年份里程碑并展示当年数据", () => {
    const game = createInitialGameState(1949, 1979);
    game.nation.history.annual.push(
      stubAnnual({
        year: 1978,
        score: 42,
        gdpRank: 10,
        currentUSDGDPPerCapita: 156,
        realGDP: 580_000_000_000,
      }),
    );
    const unlocked = listUnlockedMilestones(game);
    expect(unlocked.some((item) => item.id === "year_1978")).toBe(true);

    const payload = buildSharePayload(game, {
      cardType: "milestone",
      milestoneId: "year_1978",
    });
    expect(payload.effectiveType).toBe("milestone");
    expect(payload.card.type).toBe("milestone");
    if (payload.card.type === "milestone") {
      expect(payload.card.milestone.id).toBe("year_1978");
      expect(payload.card.milestone.reachedYear).toBe(1978);
      expect(payload.card.hero.value).toContain("580");
    }
    expect(payload.copyText).toContain("抵达 1978 年");
  });

  it("综合评分与排名里程碑根据年度快照解锁", () => {
    const game = createInitialGameState(1949);
    game.nation.date = { year: 1990, month: 6, elapsedMonths: (1990 - 1949) * 12 + 5 };
    game.nation.history.annual.push(
      stubAnnual({
        year: 1990,
        score: 72,
        gdpRank: 8,
        urbanizationRate: 0.52,
        currentUSDGDPPerCapita: 1200,
      }),
    );

    const unlocked = listUnlockedMilestones(game);
    expect(unlocked.map((item) => item.id)).toEqual(
      expect.arrayContaining(["score_70", "gdp_rank_10", "urbanization_50", "usd_pc_1000"]),
    );

    const payload = buildSharePayload(game, {
      cardType: "milestone",
      milestoneId: "score_70",
    });
    expect(payload.effectiveType).toBe("milestone");
    expect(payload.copyText).toContain("综合评分达到 70");
  });

  it("里程碑指标取达成年快照，不用当前更高的人均美元顶替", () => {
    const game = createInitialGameState(1949);
    game.nation.date = { year: 2000, month: 6, elapsedMonths: (2000 - 1949) * 12 + 5 };
    game.nation.economy.currentUSDGDPPerCapita = 9996;
    game.nation.economy.realGDP = 5e12;
    game.nation.history.annual = [
      stubAnnual({
        year: 1977,
        score: 45,
        gdpRank: 15,
        currentUSDGDPPerCapita: 1012,
        realGDP: 4e11,
      }),
      stubAnnual({
        year: 2000,
        score: 68,
        gdpRank: 6,
        currentUSDGDPPerCapita: 9996,
        realGDP: 5e12,
      }),
    ];

    const unlocked = listUnlockedMilestones(game);
    const usdMilestone = unlocked.find((item) => item.id === "usd_pc_1000");
    expect(usdMilestone?.reachedYear).toBe(1977);
    expect(usdMilestone?.metrics[0]?.value).toBe("$1,012");
    expect(usdMilestone?.metrics[0]?.value).not.toContain("9,996");

    const payload = buildSharePayload(game, {
      cardType: "milestone",
      milestoneId: "usd_pc_1000",
    });
    expect(payload.effectiveType).toBe("milestone");
    expect(payload.copyText).toContain("1977年达成");
    expect(payload.copyText).toContain("$1,012");
    expect(payload.copyText).not.toContain("9,996");
    if (payload.card.type === "milestone") {
      expect(payload.card.hero.value).toBe("$1,012");
      expect(payload.card.subtitle).toContain("1977");
    }
  });


  it("即使年度历史乱序，也按最早达成年取里程碑", () => {
    const game = createInitialGameState(1949);
    game.nation.date = { year: 1995, month: 3, elapsedMonths: (1995 - 1949) * 12 + 2 };
    game.nation.history.annual = [
      stubAnnual({
        year: 1990,
        score: 60,
        gdpRank: 12,
        currentUSDGDPPerCapita: 2500,
      }),
      stubAnnual({
        year: 1985,
        score: 50,
        gdpRank: 14,
        currentUSDGDPPerCapita: 1100,
      }),
      stubAnnual({
        year: 1995,
        score: 65,
        gdpRank: 9,
        currentUSDGDPPerCapita: 4000,
      }),
    ];

    const unlocked = listUnlockedMilestones(game);
    const usdMilestone = unlocked.find((item) => item.id === "usd_pc_1000");
    expect(usdMilestone?.reachedYear).toBe(1985);
    expect(usdMilestone?.metrics[0]?.value).toBe("$1,100");
  });

  it("对比卡在有历史锚点年度后生成对标海报", () => {
    const game = createInitialGameState(1949);
    game.nation.date = { year: 1978, month: 12, elapsedMonths: (1978 - 1949) * 12 + 11 };
    game.nation.history.annual = [
      stubAnnual({
        year: 1978,
        score: 40,
        gdpRank: 8,
        population: 962_590_000,
        realGDP: 638_000_000_000,
        realGDPPerCapita: 660,
        currentPriceGDPPerCapita: 465,
        currentUSDGDPPerCapita: 170,
      }),
    ];

    const payload = buildSharePayload(game, {
      cardType: "compare",
      comparisonTargetId: "history",
    });
    expect(payload.effectiveType).toBe("compare");
    expect(payload.card.type).toBe("compare");
    if (payload.card.type === "compare") {
      expect(payload.card.year).toBe(1978);
      expect(payload.card.targetLabel).toContain("历史");
      expect(payload.card.hero.label).toBe("GDP（当年价人民币）");
      expect(payload.card.metrics[0]?.value).toContain("元");
      expect(payload.card.metrics.length).toBeGreaterThanOrEqual(3);
    }
    expect(payload.copyText).toContain("对标");
  });
});
