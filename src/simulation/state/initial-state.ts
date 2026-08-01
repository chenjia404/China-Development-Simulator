import { createGameDate } from "../core/time";
import { createEmptyAchievementsState } from "../events/national-achievements";
import { SAVE_SCHEMA_VERSION, SIMULATION_VERSION } from "../save/schema";
import type {
  FiscalBudget,
  GameState,
  SectorId,
  SectorState,
} from "./game-state";
import { createInitialWorldState } from "../world/countries";
import { calculateWorldRankings } from "../world/rankings";
import diplomacyConfig from "../../data/config/diplomacy.json";
import { createInitialIndustrialCategories } from "../economy/industrial-structure";
import { createInitialIndustrialPolicyState } from "../policies/industrial-policy";
import { createInitialPrivateEconomyState } from "../economy/private-economy";
import { createEmptyFamineMortalityAccount } from "../population/famine-mortality-account";
import sinoUSNormalizationConfig from "../../data/config/sino-us-normalization.json";
import {
  createEmptyNationalAccountsState,
  updateNationalAccounts,
} from "../economy/national-accounts";
import {
  createEmptyMarketDynamicsState,
  ensureMarketDynamicsState,
} from "../economy/market-dynamics";
import { createInitialDemographicDetailState } from "../population/demographic-cohorts";
import {
  createEmptyEnterpriseSectorState,
  updateEnterpriseSectors,
} from "../economy/enterprise-sectors";
import {
  createEmptyFiscalFederalismState,
  updateFiscalFederalism,
} from "../fiscal/fiscal-federalism";
import { calculateAgriculturalTaxPotentialShare } from "../fiscal/agricultural-tax";
import {
  createEmptyFinancialSystemState,
  updateFinancialSystem,
} from "../economy/monetary-financial";
import {
  createEmptyAgricultureSystemState,
  updateAgricultureSystem,
} from "../economy/agriculture-rural";
import {
  createEmptyInfrastructureResourceState,
  updateInfrastructureResources,
} from "../economy/energy-transport-environment";
import {
  createEmptyPublicTransportState,
  updatePublicTransport,
} from "../economy/transport";
import {
  createEmptyHumanDevelopmentState,
  updateHumanDevelopment,
} from "../society/human-development";
import {
  createEmptyUrbanHousingState,
  updateUrbanHousing,
} from "../society/housing-urbanization";
import {
  createEmptyRegionalEconomyState,
  updateRegionalEconomy,
} from "../economy/regional-economy";
import { updateWorldTradeNetwork } from "../economy/international-network";
import {
  createEmptySecurityDefenseState,
  updateSecurityDefense,
} from "../security/defense-security";
import {
  createEmptyInstitutionCausalityState,
  updateInstitutionCausality,
} from "../institutions/institution-causality";

const INITIAL_BUDGET: FiscalBudget = {
  education: 0.1,
  health: 0.08,
  agriculture: 0.10,
  industry: 0.16,
  infrastructure: 0.15,
  transport: 0.08,
  research: 0.03,
  housing: 0.02,
  welfare: 0.08,
  defense: 0.1,
  administration: 0.10,
};

const INITIAL_PRIMARY_SHARE = 62_000_000_000 / 123_000_000_000;
const INITIAL_AGRICULTURAL_TAX_SHARE = calculateAgriculturalTaxPotentialShare(
  INITIAL_PRIMARY_SHARE,
  0.35,
);
const INITIAL_FISCAL_REVENUE = 12_000_000_000;

function createSector(
  id: SectorId,
  output: number,
  capitalStock: number,
  laborForce: number,
  productivity: number,
): SectorState {
  return {
    id,
    output,
    valueAdded: output,
    capitalStock,
    laborForce,
    productivity,
    capacityUtilization: 0.75,
    averageWage: 0,
    employment: laborForce,
    technologyLevel: 5,
  };
}

export function createInitialGameState(
  seed: number,
  startYear = 1949,
  historicalEventDecisionMode: "automatic" | "interactive" = "automatic",
): GameState {
  const normalizedSeed = seed >>> 0;
  const population = 541_670_000;
  const workingAge = population * 0.56;
  const initialPopulation = {
    total: population,
    ageGroups: {
      children: population * 0.35,
      workingAge,
      elderly: population * 0.09,
    },
    urbanPopulation: population * 0.1064,
    ruralPopulation: population * 0.8936,
    annualBirthRate: 0.036,
    annualDeathRate: 0.02,
    monthlyBirths: 0,
    monthlyDeaths: 0,
    netMigration: 0,
  };
  const historicalNormalizationAtStart =
    historicalEventDecisionMode === "automatic" &&
    startYear >= sinoUSNormalizationConfig.historicalEstablishmentYear;
  const historicalNormalizationElapsedMonths = historicalNormalizationAtStart
    ? Math.max(
        0,
        (startYear - sinoUSNormalizationConfig.historicalEstablishmentYear) * 12,
      )
    : 0;

  const state: GameState = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    simulationVersion: SIMULATION_VERSION,
    seed: normalizedSeed,
    randomState: normalizedSeed,
    eventRandomState: (normalizedSeed ^ 0x9e3779b9) >>> 0,
    nation: {
      id: "china",
      name: "中国",
      internationalInfluence: 12,
      date: createGameDate(startYear),
      population: {
        ...initialPopulation,
        demographicDetail: createInitialDemographicDetailState(initialPopulation),
      },
      labor: {
        laborForce: workingAge * 0.78,
        employed: workingAge * 0.75,
        unemployed: workingAge * 0.03,
        participationRate: 0.78,
        unemploymentRate: 0.0385,
        effectiveLabor: workingAge * 0.47,
        skillMatchRate: 0.72,
      },
      economy: {
        nominalGDP: 123_000_000_000,
        realGDP: 123_000_000_000,
        realGDPIndex: 100,
        nominalGDPPerCapita: 227.08,
        realGDPPerCapita: 227.08,
        currentPriceGDPPerCapita: 227.08,
        currentUSDGDPPerCapita: 49.96,
        globalGDPPerCapitaRank: 146,
        globalGDPPerCapitaParticipants: 146,
        internationalComparableGDP: 123_000_000_000,
        pppGDPPerCapita: 450,
        annualRealGDPGrowth: 0,
        annualNominalGDPGrowth: 0,
        capitalStock: 185_000_000_000,
        totalFactorProductivity: 1,
        humanCapitalIndex: 12,
        infrastructureIndex: 8,
        institutionalEfficiency: 0.35,
        inflationRate: 0.02,
        householdIncome: 65_000_000_000,
        householdDisposableIncome: 58_825_000_000,
        householdConsumption: 57_648_500_000,
        consumptionPropensity: 0.98,
        socialProtectionIncome: 52_000_000,
        domesticDemand: 78_924_500_000,
        domesticDemandShare: 0.6417,
        nationalSavings: 7_000_000_000,
        investment: 18_000_000_000,
        priceLevelIndex: 1,
      },
      sectors: {
        primary: createSector("primary", 62_000_000_000, 45_000_000_000, 180_000_000, 0.65),
        secondary: createSector("secondary", 28_000_000_000, 78_000_000_000, 20_000_000, 0.55),
        tertiary: createSector("tertiary", 33_000_000_000, 62_000_000_000, 27_000_000, 0.6),
      },
      industries: createInitialIndustrialCategories(28_000_000_000),
      industrialPolicy: createInitialIndustrialPolicyState(),
      fiscal: {
        revenue: INITIAL_FISCAL_REVENUE,
        expenditure: 13_000_000_000,
        balance: -1_000_000_000,
        governmentDebt: 5_000_000_000,
        debtToGDP: 0.0407,
        debtInterestRate: 0.03,
        interestExpense: 150_000_000,
        statutoryTaxRate: 0.12,
        effectiveTaxRate: 0.095,
        monetaryFinancing: 0,
        foreignAidExpenditure: 0,
        agriculturalTaxShare: INITIAL_AGRICULTURAL_TAX_SHARE,
        agriculturalTaxRevenue:
          INITIAL_FISCAL_REVENUE * INITIAL_AGRICULTURAL_TAX_SHARE,
        agriculturalTaxAbolished: false,
        budget: { ...INITIAL_BUDGET },
        federalism: createEmptyFiscalFederalismState(),
      },
      education: {
        literacyRate: 0.2,
        primaryCoverage: 0.25,
        secondaryCoverage: 0.05,
        universityCoverage: 0.005,
        averageYearsOfSchooling: 1.6,
        index: 12,
        researchTalent: 40_000,
        higherEducationAdmissionCapacity: 1,
        academicContinuity: 1,
        researchCohortGap: 0,
        educationDisruptionMonths: 0,
        permanentResearchTalentLosses: 0,
        delayedInvestment: Array.from({ length: 240 }, () => 0),
      },
      health: {
        coverageRate: 0.12,
        hospitalCapacity: 5,
        doctorsPerThousand: 0.6,
        lifeExpectancy: 35,
        index: 12,
      },
      humanDevelopment: createEmptyHumanDevelopmentState(),
      technology: {
        index: 6,
        researchPoints: 0,
        adoptionRate: 0.08,
        monthlyResearchOutput: 0,
        completedTechnologyIds: [],
        activeResearchId: null,
        activeResearchProgress: 0,
        developmentPathId: "balanced_foundation",
        previousDevelopmentPathId: null,
        developmentPathProgress: 1,
        lastDevelopmentPathChangeMonth: null,
      },
      resources: {
        foodProduction: 113_000_000,
        foodDemand: 120_000_000,
        foodSupplyRatio: 0.942,
        agriculture: createEmptyAgricultureSystemState(),
        infrastructureResources: createEmptyInfrastructureResourceState(),
        energySupply: 24,
        energyDemand: 25,
        energySupplyRatio: 0.96,
      },
      transport: createEmptyPublicTransportState(),
      society: {
        happinessIndex: 42,
        stabilityIndex: 48,
        povertyRate: 0.8,
        giniCoefficient: 0.32,
        urbanizationRate: 0.1064,
        medianDisposableIncome: 85,
        housingIndex: 18,
        urbanHousing: createEmptyUrbanHousingState(),
      },
      trade: {
        exports: 2_000_000_000,
        imports: 2_500_000_000,
        balance: -500_000_000,
        openness: 0.05,
        foreignInvestment: 0,
        foreignExchangeReserves: 150_000_000,
        monthlyReserveChange: 0,
        remittanceInflows: 200_000_000,
        remittanceReserveContribution: 90_000_000,
        importCoverageMonths: 0.72,
        externalDebt: 0,
        externalDebtToGDP: 0,
        externalDebtInterestRate: 0.025,
        annualExternalDebtService: 0,
        externalDebtServiceRatio: 0,
        monthlyExternalBorrowing: 0,
        capitalGoodsForeignExchangeNeed: 0,
        capitalGoodsImportShare: 0.28,
        capitalGoodsImportCoverage: 0.65,
        sovietDebtRepaymentPlan: "unset",
      },
      privateEconomy: createInitialPrivateEconomyState(),
      enterprises: createEmptyEnterpriseSectorState(),
      nationalAccounts: createEmptyNationalAccountsState(),
      marketDynamics: createEmptyMarketDynamicsState(),
      financialSystem: createEmptyFinancialSystemState(),
      regionalEconomy: createEmptyRegionalEconomyState(),
      diplomacy: {
        diplomaticPoints: diplomacyConfig.initialDiplomaticPoints,
        monthlyPointGain: 0,
        globalReputation: diplomacyConfig.initialReputation,
        securityIndex: diplomacyConfig.initialSecurityIndex,
        organizationIds: [],
        strategyId: "balanced",
        strategyAlignment: 0,
        lastStrategyChangeMonth: null,
        foreignPolicyDoctrineId: "status_quo",
        previousForeignPolicyDoctrineId: null,
        foreignPolicyDoctrineProgress: 1,
        lastForeignPolicyDoctrineChangeMonth: null,
        foreignAidProgramId: "historical_comprehensive",
        previousForeignAidProgramId: null,
        foreignAidProgramProgress: 1,
        lastForeignAidProgramChangeMonth: null,
        annualForeignAidRMB: 0,
        annualForeignAidUSD: 0,
        annualForeignAidForeignExchangeOutflow: 0,
        cumulativeForeignAidRMB: 0,
        cumulativeForeignAidUSD: 0,
        cumulativeForeignAidRMBThrough1980: 0,
        cumulativeForeignAidUSDThrough1980: 0,
        foreignAidEventAnnualRmbAdjustment: 0,
        foreignAidEventAnnualFxRmbAdjustment: 0,
        foreignAidEventHistoricalFxBaselineRmb: 0,
        foreignAidEventAdjustmentRemainingMonths: 0,
        sinoUSNormalizationStatus: historicalNormalizationAtStart
          ? "established"
          : "not_started",
        sinoUSNormalizationStartedYear: historicalNormalizationAtStart
          ? sinoUSNormalizationConfig.historicalEstablishmentYear
          : null,
        sinoUSNormalizationStartedMonth: historicalNormalizationAtStart
          ? sinoUSNormalizationConfig.historicalEstablishmentMonth
          : null,
        sinoUSNormalizationEstablishedYear: historicalNormalizationAtStart
          ? sinoUSNormalizationConfig.historicalEstablishmentYear
          : null,
        sinoUSNormalizationEstablishedMonth: historicalNormalizationAtStart
          ? sinoUSNormalizationConfig.historicalEstablishmentMonth
          : null,
        sinoUSNormalizationNegotiationProgress: historicalNormalizationAtStart ? 1 : 0,
        sinoUSNormalizationNegotiationMonths: 0,
        sinoUSCooperationProgress: historicalNormalizationAtStart
          ? Math.min(
              1,
              historicalNormalizationElapsedMonths /
                sinoUSNormalizationConfig.cooperationTransitionMonths,
            )
          : 0,
        sinoUSNormalizationDelayMonths: 0,
      },
      securityDefense: createEmptySecurityDefenseState(),
      institutions: createEmptyInstitutionCausalityState(),
      policies: [],
      policyProgress: {},
      projects: [],
      modifiers: [],
      achievements: createEmptyAchievementsState(),
      historicalEventDecisionMode,
      pendingHistoricalEventId: null,
      famineMortality: createEmptyFamineMortalityAccount(),
      history: { monthly: [], annual: [], reports: [], historicalEvents: [] },
    },
    world: createInitialWorldState(),
  };
  updateNationalAccounts(state.nation);
  updateAgricultureSystem(state.nation, true);
  updatePublicTransport(state.nation, true);
  updateInfrastructureResources(state.nation, true);
  updateHumanDevelopment(state.nation);
  updateUrbanHousing(state.nation, true);
  updateRegionalEconomy(state.nation);
  updateEnterpriseSectors(state.nation);
  updateFiscalFederalism(state.nation);
  ensureMarketDynamicsState(state.nation);
  updateFinancialSystem(state, true);
  calculateWorldRankings(state);
  updateWorldTradeNetwork(state);
  updateSecurityDefense(state.nation, true);
  updateInstitutionCausality(state.nation, true);
  return state;
}
