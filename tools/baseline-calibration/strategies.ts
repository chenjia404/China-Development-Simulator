import type { FiscalBudget } from "../../src/simulation/index";

export type StrategyId =
  | "historical"
  | "industrial"
  | "livelihood"
  | "education_technology"
  | "debt"
  | "none";

export interface AnnualDecision {
  budget?: FiscalBudget;
  policyIds: string[];
}

const balancedBudget: FiscalBudget = {
  education: 0.1,
  health: 0.08,
  agriculture: 0.12,
  industry: 0.18,
  infrastructure: 0.15,
  research: 0.03,
  housing: 0.06,
  welfare: 0.08,
  defense: 0.1,
  administration: 0.1,
};

function historicalDecision(year: number): AnnualDecision {
  if (year < 1957) {
    return {
      budget: { ...balancedBudget, agriculture: 0.22, industry: 0.19, infrastructure: 0.16, education: 0.08, welfare: 0.03 },
      policyIds: ["agriculture_priority"],
    };
  }
  if (year < 1978) {
    return {
      budget: { ...balancedBudget, agriculture: 0.14, industry: 0.27, infrastructure: 0.18, education: 0.07, research: 0.025, welfare: 0.025 },
      policyIds: ["industry_priority"],
    };
  }
  if (year < 2000) {
    return {
      budget: { ...balancedBudget, agriculture: 0.09, industry: 0.22, infrastructure: 0.2, education: 0.11, research: 0.05, administration: 0.07 },
      policyIds: year < 1992
        ? ["industry_priority"]
        : ["industry_priority", "expand_opening"],
    };
  }
  return {
    budget: { ...balancedBudget, agriculture: 0.055, industry: 0.16, infrastructure: 0.18, education: 0.16, health: 0.11, research: 0.1, administration: 0.055 },
    policyIds: year < 2012
      ? ["expand_opening", "technology_priority", "industry_priority"]
      : ["expand_opening", "technology_priority"],
  };
}

export function getAnnualDecision(
  strategy: StrategyId,
  year: number,
): AnnualDecision {
  switch (strategy) {
    case "historical":
      return historicalDecision(year);
    case "industrial":
      return {
        budget: { ...balancedBudget, industry: 0.42, infrastructure: 0.22, agriculture: 0.04, education: 0.05, health: 0.035, welfare: 0.015 },
        policyIds: ["industry_priority"],
      };
    case "livelihood":
      return {
        budget: { ...balancedBudget, health: 0.2, education: 0.2, welfare: 0.18, housing: 0.12, industry: 0.06, research: 0.02, defense: 0.04 },
        policyIds: ["livelihood_priority", "low_tax"],
      };
    case "education_technology":
      return {
        budget: year < 1970
          ? {
              education: 0.38,
              health: 0.08,
              agriculture: 0.01,
              industry: 0.01,
              infrastructure: 0.01,
              research: 0.01,
              housing: 0.04,
              welfare: 0.07,
              defense: 0.06,
              administration: 0.05,
            }
          : {
              education: 0.26,
              health: 0.1,
              agriculture: 0.04,
              industry: 0.05,
              infrastructure: 0.08,
              research: 0.17,
              housing: 0.06,
              welfare: 0.07,
              defense: 0.05,
              administration: 0.06,
            },
        policyIds: year < 1978
          ? ["technology_priority"]
          : ["technology_priority", "expand_opening"],
      };
    case "debt":
      return {
        budget: { ...balancedBudget, education: 0.35, health: 0.3, industry: 0.45, infrastructure: 0.5, research: 0.25, welfare: 0.3 },
        policyIds: ["deficit_spending", "monetary_financing", "low_tax"],
      };
    case "none":
      return { policyIds: [] };
  }
}

export const strategyIds: StrategyId[] = [
  "historical",
  "industrial",
  "livelihood",
  "education_technology",
  "debt",
  "none",
];
