import populationConfig from "../../data/config/population.json";
import { clamp, safeDivide } from "../core/math";
import type { RandomGenerator } from "../core/random";
import type { NationState } from "../state/game-state";
import { applyModifiers } from "../events/modifiers";
import { applyPolicyModifiers } from "../policies/policy-engine";
import { ensureInfrastructurePenetrationState } from "../society/infrastructure-penetration";

function distributeDeaths(
  children: number,
  workingAge: number,
  elderly: number,
  deaths: number,
): [number, number, number] {
  const childRisk = children * 0.8;
  const workingRisk = workingAge * 0.5;
  const elderlyRisk = elderly * 4;
  const totalRisk = childRisk + workingRisk + elderlyRisk;

  return [
    deaths * safeDivide(childRisk, totalRisk),
    deaths * safeDivide(workingRisk, totalRisk),
    deaths * safeDivide(elderlyRisk, totalRisk),
  ];
}

function developmentEraFactor(
  year: number,
  startYear: number,
  maturityYears: number,
): number {
  return clamp((year - startYear) / maturityYears, 0, 1);
}

export function updateDemographics(
  nation: NationState,
  random: RandomGenerator,
): void {
  ensureInfrastructurePenetrationState(nation);
  const {
    population,
    society,
    economy,
    education,
    health,
    resources,
    date,
  } = nation;
  const penetration = society.infrastructurePenetration;
  const households = population.demographicDetail.households;
  const urbanization = safeDivide(population.urbanPopulation, population.total);
  const incomeDevelopment = clamp(
    Math.log1p(Math.max(economy.realGDPPerCapita, 0)) / Math.log(60_001),
    0,
    1,
  );
  const elderlyShare = safeDivide(
    population.ageGroups.elderly,
    population.total,
  );
  const workingShare = safeDivide(
    population.ageGroups.workingAge,
    population.total,
  );
  const mediaInformationEffect = clamp(
    penetration.televisionPenetration * 0.45 +
      penetration.mobilePenetration * 0.35 +
      penetration.internetPenetration * 0.2,
    0,
    1,
  );
  const penetrationEra = developmentEraFactor(
    date.year,
    populationConfig.penetrationEffectStartYear,
    populationConfig.penetrationEffectMaturityYears,
  );
  const structureEra = developmentEraFactor(
    date.year,
    populationConfig.structureEffectStartYear,
    populationConfig.structureEffectMaturityYears,
  );
  const coreBirthSuppression =
    urbanization * populationConfig.urbanBirthSuppression +
    (education.index / 100) * populationConfig.educationBirthSuppression +
    incomeDevelopment * populationConfig.incomeBirthSuppression;
  const structureBirthSuppression = clamp(
    structureEra * (
      education.secondaryCoverage * populationConfig.secondaryEducationBirthSuppression +
      education.universityCoverage * populationConfig.universityEducationBirthSuppression +
      elderlyShare * populationConfig.elderlyShareBirthSuppression +
      households.childDependencyRatio * populationConfig.childDependencyBirthSuppression +
      mediaInformationEffect * populationConfig.mediaInformationBirthSuppression
    ),
    0,
    0.05,
  );
  const birthSuppression = clamp(
    coreBirthSuppression + structureBirthSuppression,
    0,
    0.9,
  );
  const annualBirthRate = clamp(
    applyModifiers(
      nation,
      "population.birthRate",
      applyPolicyModifiers(
        nation,
        "population.birthRate",
        populationConfig.baseAnnualBirthRate,
      ),
    ) * (1 - birthSuppression) +
      random.nextNormal(0, populationConfig.birthRateNoise),
    populationConfig.minimumAnnualBirthRate,
    populationConfig.maximumAnnualBirthRate,
  );

  const foodShortage = Math.max(0, 1 - resources.foodSupplyRatio);
  const healthProtection = clamp(
    health.index / 100,
    0,
    1,
  ) * populationConfig.healthMortalityProtection;
  const infrastructureProtection = clamp(
  penetrationEra * (
      penetration.electricityPenetration * populationConfig.electricityMortalityProtection +
      mediaInformationEffect * populationConfig.mediaHealthMortalityProtection
    ),
    0,
    0.15,
  );
  const annualDeathRate = clamp(
    applyModifiers(
      nation,
      "population.deathRate",
      populationConfig.baseAnnualDeathRate *
      (1 - clamp(healthProtection + infrastructureProtection, 0, 0.88)) *
      (1 + foodShortage * 2.5 + elderlyShare * populationConfig.elderlyShareMortalityPressure),
    ) +
      random.nextNormal(0, populationConfig.deathRateNoise),
    populationConfig.minimumAnnualDeathRate,
    populationConfig.maximumAnnualDeathRate,
  );

  const births = population.total * annualBirthRate / 12;
  const deaths = population.total * annualDeathRate / 12;
  const [childDeaths, workingDeaths, elderlyDeaths] = distributeDeaths(
    population.ageGroups.children,
    population.ageGroups.workingAge,
    population.ageGroups.elderly,
    deaths,
  );
  const childToWorking =
    population.ageGroups.children /
    (populationConfig.childhoodYears * 12);
  const workingToElderly =
    population.ageGroups.workingAge /
    (populationConfig.workingAgeYears * 12);

  population.ageGroups.children = Math.max(
    0,
    population.ageGroups.children + births - childDeaths - childToWorking,
  );
  population.ageGroups.workingAge = Math.max(
    0,
    population.ageGroups.workingAge +
      childToWorking -
      workingDeaths -
      workingToElderly +
      population.netMigration,
  );
  population.ageGroups.elderly = Math.max(
    0,
    population.ageGroups.elderly + workingToElderly - elderlyDeaths,
  );
  population.total =
    population.ageGroups.children +
    population.ageGroups.workingAge +
    population.ageGroups.elderly;

  const migrationCapacity = clamp(
    (economy.infrastructureIndex / 100) * 0.45 +
      (society.housingIndex / 100) * 0.35 +
      health.coverageRate * 0.2 +
      penetrationEra * (
        penetration.electricityPenetration * populationConfig.urbanMigrationElectricityWeight +
        mediaInformationEffect * populationConfig.urbanMigrationMediaWeight
      ) +
      workingShare * populationConfig.urbanMigrationWorkingAgeWeight * structureEra,
    0.05,
    1,
  );
  const ruralPopulation = population.total * (1 - urbanization);
  const ruralToUrban =
    ruralPopulation *
    populationConfig.annualUrbanMigrationRate /
    12 *
    migrationCapacity *
    (1 + (nation.policyProgress.expand_opening ?? 0)) *
    (1 + (nation.policyProgress.industry_priority ?? 0) * 0.15) *
    applyModifiers(
      nation,
      "urban.migration",
      applyPolicyModifiers(nation, "urban.migration", 1),
    );
  population.urbanPopulation = clamp(
    population.total * urbanization + ruralToUrban,
    0,
    population.total,
  );
  population.ruralPopulation = population.total - population.urbanPopulation;
  population.annualBirthRate = annualBirthRate;
  population.annualDeathRate = annualDeathRate;
  population.monthlyBirths = births;
  population.monthlyDeaths = deaths;
  society.urbanizationRate = safeDivide(
    population.urbanPopulation,
    population.total,
  );
}
