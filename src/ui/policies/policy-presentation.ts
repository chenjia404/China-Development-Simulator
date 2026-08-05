import type { GameState } from "../../simulation/state/game-state";
import {
  nationalPolicyDefinitions,
  nationalPolicyRequirementBlockers,
  type NationalPolicyDefinition,
} from "../../simulation/policies/policy-engine";
import { getBlueprintMissionStatus } from "../../simulation/policies/blueprint-missions";
import { strategicPriorityName } from "../../simulation/policies/strategic-planning";

export interface PolicyRecommendation {
  policy: NationalPolicyDefinition;
  reasons: string[];
  score: number;
}

export interface PolicyPresentationGroups {
  active: NationalPolicyDefinition[];
  recommended: PolicyRecommendation[];
  nearUnlock: Array<{
    policy: NationalPolicyDefinition;
    blockers: string[];
  }>;
  catalog: NationalPolicyDefinition[];
}

const priorityTargetPrefixes: Record<string, string[]> = {
  industrialization: ["sector.secondary", "industry.", "capital."],
  food_security: ["sector.primary", "resources.food", "agriculture."],
  education: ["education."],
  technology: ["technology."],
  livelihood: ["society.", "wellbeing.", "health.", "economy.consumption"],
  fiscal_stability: ["fiscal."],
  opening: ["trade.", "privateEconomy."],
};

const missionMetricTargetPrefixes: Record<string, string[]> = {
  secondary_sector_share: ["sector.secondary", "industry."],
  energy_supply_ratio: ["resources.energy"],
  infrastructure_index: ["economy.infrastructure", "transport."],
  food_supply_ratio: ["resources.food", "sector.primary"],
  daily_calories: ["resources.food", "sector.primary"],
  stability: ["society.stability", "wellbeing."],
  grain_yield: ["sector.primary", "resources.food"],
  mechanization_rate: ["sector.primary", "capital."],
  education_index: ["education."],
  poverty_rate: ["wellbeing.", "society."],
  happiness: ["society.happiness", "wellbeing."],
  literacy_rate: ["education."],
  higher_education_rate: ["education."],
  technology_index: ["technology."],
  completed_technologies: ["technology."],
  technology_rank: ["technology."],
  education_rank: ["education."],
  openness: ["trade."],
  exports_to_gdp: ["trade."],
  foreign_exchange_reserves: ["trade."],
  private_mixed_share: ["privateEconomy.", "capital.private"],
  logistics_efficiency: ["trade.logistics", "production.logistics", "transport."],
  trade_agreements: ["trade."],
  gdp_per_capita_usd: ["economy.structural", "capital.", "technology."],
  industry_technology_tier: ["technology.", "industry."],
};

const riskTargetPrefixes: Record<string, string[]> = {
  food_crisis: ["resources.food", "sector.primary"],
  financial_crisis: ["fiscal.", "capital.private", "economy.institutional"],
  fiscal_crisis: ["fiscal."],
  environmental_health_crisis: ["resources.energy", "health.", "transport."],
  social_unrest: ["society.", "wellbeing.", "education."],
  external_isolation: ["trade.", "privateEconomy."],
};

function policyMatchesPrefixes(
  policy: NationalPolicyDefinition,
  prefixes: string[],
): boolean {
  return policy.modifiers.some((modifier) =>
    prefixes.some((prefix) => modifier.target.startsWith(prefix))
  );
}

export function buildPolicyPresentationGroups(
  game: GameState,
): PolicyPresentationGroups {
  const activeIds = new Set(game.nation.policies);
  const active = nationalPolicyDefinitions.filter((policy) => activeIds.has(policy.id));
  const candidates = nationalPolicyDefinitions.filter((policy) => !activeIds.has(policy.id));
  const mission = getBlueprintMissionStatus(game);
  const missingMissionMetrics = mission.metrics.filter((metric) => !metric.met);
  const highestRisk = game.nation.institutions.highestRiskId;

  const ranked = candidates
    .map((policy): PolicyRecommendation => {
      const reasons: string[] = [];
      let score = 0;
      for (const priorityId of game.nation.strategicPlanning.priorityIds) {
        const prefixes = priorityTargetPrefixes[priorityId] ?? [];
        if (policyMatchesPrefixes(policy, prefixes)) {
          score += 3;
          reasons.push(`匹配五年规划“${strategicPriorityName(priorityId)}”`);
        }
      }
      for (const metric of missingMissionMetrics) {
        if (policyMatchesPrefixes(policy, missionMetricTargetPrefixes[metric.id] ?? [])) {
          score += 2;
          reasons.push(`有助于蓝图指标“${metric.label}”`);
        }
      }
      if (policyMatchesPrefixes(policy, riskTargetPrefixes[highestRisk] ?? [])) {
        score += 2;
        reasons.push("回应当前最高制度风险");
      }
      return { policy, reasons: [...new Set(reasons)], score };
    })
    .filter((item) =>
      item.score > 0 &&
      nationalPolicyRequirementBlockers(game.nation, item.policy.id).length === 0
    )
    .sort((left, right) => right.score - left.score || left.policy.id.localeCompare(right.policy.id));

  const availableFallback = candidates
    .filter((policy) => nationalPolicyRequirementBlockers(game.nation, policy.id).length === 0)
    .filter((policy) => !ranked.some((item) => item.policy.id === policy.id))
    .map((policy): PolicyRecommendation => ({
      policy,
      reasons: ["当前条件已满足，可作为政策储备"],
      score: 0,
    }));
  const recommended = [...ranked, ...availableFallback].slice(0, 4);

  const nearUnlock = candidates
    .map((policy) => ({
      policy,
      blockers: nationalPolicyRequirementBlockers(game.nation, policy.id),
    }))
    .filter((item) => item.blockers.length > 0 && item.blockers.length <= 2)
    .sort((left, right) =>
      left.blockers.length - right.blockers.length ||
      left.policy.id.localeCompare(right.policy.id)
    )
    .slice(0, 6);

  return {
    active,
    recommended,
    nearUnlock,
    catalog: nationalPolicyDefinitions,
  };
}
