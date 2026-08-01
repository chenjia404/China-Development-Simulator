import type { FiscalBudget } from "../../src/simulation/index";

export type StrategyId =
  | "historical"
  | "industrial"
  | "livelihood"
  | "education_technology"
  | "korean_catch_up"
  | "taiwan_sme_export"
  | "hong_kong_free_port"
  | "singapore_fdi_city"
  | "us_innovation_market"
  | "japan_quality_industry"
  | "debt"
  | "none";

export interface AnnualDecision {
  budget?: Partial<FiscalBudget>;
  policyIds: string[];
}

export const optimizedHistoricalStrategyIds: StrategyId[] = [
  "korean_catch_up",
  "taiwan_sme_export",
  "hong_kong_free_port",
  "singapore_fdi_city",
  "us_innovation_market",
  "japan_quality_industry",
];

const balancedBudget: FiscalBudget = {
  education: 0.1,
  health: 0.08,
  agriculture: 0.12,
  industry: 0.18,
  infrastructure: 0.15,
  transport: 0,
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
  if (year < 2012) {
    return {
      budget: {
        ...balancedBudget,
        agriculture: 0.055,
        industry: 0.16,
        infrastructure: 0.18,
        education: 0.16,
        health: 0.11,
        research: 0.1,
        administration: 0.055,
      },
      // 入世后逐步淡出工业优先，避免 2010s 二产资本份额持续偏高。
      policyIds: year < 2005
        ? ["expand_opening", "technology_priority", "industry_priority"]
        : ["expand_opening", "technology_priority"],
    };
  }
  return {
    budget: {
      ...balancedBudget,
      agriculture: 0.05,
      industry: 0.13,
      infrastructure: 0.16,
      education: 0.17,
      health: 0.12,
      research: 0.11,
      welfare: 0.1,
      administration: 0.05,
    },
    policyIds: ["expand_opening", "technology_priority", "livelihood_priority"],
  };
}

function koreanCatchUpDecision(year: number): AnnualDecision {
  if (year > 2000) {
    return {
      budget: {
        education: 0.18,
        health: 0.11,
        agriculture: 0.03,
        industry: 0.14,
        infrastructure: 0.15,
        research: 0.15,
        housing: 0.06,
        welfare: 0.07,
        defense: 0.05,
        administration: 0.06,
      },
      policyIds: [
        "technology_priority",
        "education_priority",
        "expand_opening",
        "industrial_upgrading",
        "green_development",
      ],
    };
  }
  if (year < 1962) {
    return {
      budget: {
        education: 0.19,
        health: 0.05,
        agriculture: 0.07,
        industry: 0.25,
        infrastructure: 0.2,
        research: 0.06,
        housing: 0.03,
        welfare: 0.03,
        defense: 0.06,
        administration: 0.06,
      },
      policyIds: [
        "developmental_finance",
        "vocational_technical_education",
        "expand_opening",
        "export_oriented",
        "export_industrial_zones",
      ],
    };
  }
  if (year < 1973) {
    return {
      budget: {
        education: 0.18,
        health: 0.05,
        agriculture: 0.06,
        industry: 0.24,
        infrastructure: 0.2,
        research: 0.08,
        housing: 0.03,
        welfare: 0.03,
        defense: 0.06,
        administration: 0.07,
      },
      policyIds: [
        "developmental_finance",
        "vocational_technical_education",
        "export_oriented",
        "export_industrial_zones",
        "industrial_upgrading",
      ],
    };
  }
  return {
    budget: {
      education: 0.17,
      health: 0.07,
      agriculture: 0.04,
      industry: 0.23,
      infrastructure: 0.19,
      research: 0.13,
      housing: 0.03,
      welfare: 0.04,
      defense: 0.05,
      administration: 0.05,
    },
    policyIds: [
      "developmental_finance",
      "vocational_technical_education",
      "export_oriented",
      "export_industrial_zones",
      "industrial_upgrading",
    ],
  };
}

function taiwanSmeExportDecision(year: number): AnnualDecision {
  if (year > 2000) {
    return {
      budget: {
        education: 0.18,
        health: 0.12,
        agriculture: 0.04,
        industry: 0.12,
        infrastructure: 0.13,
        research: 0.16,
        housing: 0.07,
        welfare: 0.09,
        defense: 0.04,
        administration: 0.05,
      },
      policyIds: [
        "sme_export_networks",
        "technology_priority",
        "green_development",
        "livelihood_priority",
        "expand_opening",
      ],
    };
  }
  return {
    budget: {
      education: 0.16,
      health: 0.08,
      agriculture: 0.07,
      industry: 0.2,
      infrastructure: 0.17,
      research: 0.1,
      housing: 0.05,
      welfare: 0.05,
      defense: 0.05,
      administration: 0.07,
    },
    policyIds: [
      "sme_export_networks",
      "electronics_science_parks",
      "vocational_technical_education",
      "export_oriented",
      "expand_opening",
    ],
  };
}

function hongKongFreePortDecision(): AnnualDecision {
  return {
    budget: {
      education: 0.12,
      health: 0.09,
      agriculture: 0.04,
      industry: 0.08,
      infrastructure: 0.2,
      research: 0.06,
      housing: 0.12,
      welfare: 0.08,
      defense: 0.05,
      administration: 0.08,
    },
    policyIds: [
      "free_port_trade",
      "international_finance_logistics",
      "low_tax",
      "expand_opening",
      "urbanization_reform",
    ],
  };
}

function singaporeFdiCityDecision(year: number): AnnualDecision {
  if (year > 2000) {
    return {
      budget: {
        education: 0.18,
        health: 0.12,
        agriculture: 0.03,
        industry: 0.11,
        infrastructure: 0.14,
        research: 0.16,
        housing: 0.1,
        welfare: 0.08,
        defense: 0.03,
        administration: 0.05,
      },
      policyIds: [
        "investment_promotion_agency",
        "public_housing_skills",
        "technology_priority",
        "green_development",
        "livelihood_priority",
      ],
    };
  }
  return {
    budget: {
      education: 0.18,
      health: 0.08,
      agriculture: 0.04,
      industry: 0.18,
      infrastructure: 0.17,
      research: 0.11,
      housing: 0.12,
      welfare: 0.05,
      defense: 0.03,
      administration: 0.04,
    },
    policyIds: [
      "investment_promotion_agency",
      "public_housing_skills",
      "expand_opening",
      "vocational_technical_education",
      "industrial_upgrading",
    ],
  };
}

function usInnovationMarketDecision(): AnnualDecision {
  return {
    budget: {
      education: 0.18,
      health: 0.1,
      agriculture: 0.05,
      industry: 0.1,
      infrastructure: 0.12,
      research: 0.18,
      housing: 0.06,
      welfare: 0.08,
      defense: 0.06,
      administration: 0.07,
    },
    policyIds: [
      "research_university_network",
      "venture_capital_markets",
      "consumption_stimulus",
      "low_tax",
      "expand_opening",
    ],
  };
}

function japanQualityIndustryDecision(year: number): AnnualDecision {
  if (year > 2000) {
    return {
      budget: {
        education: 0.16,
        health: 0.12,
        agriculture: 0.04,
        industry: 0.12,
        infrastructure: 0.13,
        research: 0.16,
        housing: 0.07,
        welfare: 0.09,
        defense: 0.05,
        administration: 0.06,
      },
      policyIds: [
        "quality_manufacturing_system",
        "technology_priority",
        "green_development",
        "livelihood_priority",
        "expand_opening",
      ],
    };
  }
  return {
    budget: {
      education: 0.15,
      health: 0.08,
      agriculture: 0.05,
      industry: 0.22,
      infrastructure: 0.18,
      research: 0.1,
      housing: 0.04,
      welfare: 0.05,
      defense: 0.05,
      administration: 0.08,
    },
    policyIds: [
      "main_bank_industrial_coordination",
      "quality_manufacturing_system",
      "vocational_technical_education",
      "export_oriented",
      "expand_opening",
    ],
  };
}

export function getHistoricalEventChoice(
  strategy: StrategyId,
  eventId: string,
): string {
  if (!optimizedHistoricalStrategyIds.includes(strategy)) return "historical_path";
  return {
    foreign_assets_reorganization: "regulated_foreign_business",
    korean_war_1950: "oppose_korean_war",
    industry_wide_joint_ownership_1956: "preserve_mixed_ownership",
    great_leap_forward_1958: "avoid_great_leap",
    peoples_communes_1958: "avoid_communes",
    three_year_difficulties_1959:
      "ban_grain_exports_and_import+no_additional_relief+reduce_procurement_guarantee_ration+foreign_aid_500mt",
    third_front_construction_1964: "cancel_third_front",
    cultural_revolution_disruption_1966: "protect_institutions",
  }[eventId] ?? "historical_path";
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
    case "korean_catch_up":
      return koreanCatchUpDecision(year);
    case "taiwan_sme_export":
      return taiwanSmeExportDecision(year);
    case "hong_kong_free_port":
      return hongKongFreePortDecision();
    case "singapore_fdi_city":
      return singaporeFdiCityDecision(year);
    case "us_innovation_market":
      return usInnovationMarketDecision();
    case "japan_quality_industry":
      return japanQualityIndustryDecision(year);
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
  "korean_catch_up",
  "taiwan_sme_export",
  "hong_kong_free_port",
  "singapore_fdi_city",
  "us_innovation_market",
  "japan_quality_industry",
  "debt",
  "none",
];
