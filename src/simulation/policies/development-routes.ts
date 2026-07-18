import blueprintData from "../../data/config/development-route-blueprints.json";
import {
  getNationalPolicy,
  maximumActivePolicies,
  validatePolicySelection,
} from "./policy-engine";

export interface DevelopmentRouteBlueprint {
  id: string;
  name: string;
  referenceEconomy: string;
  summary: string;
  policyIds: string[];
  strengths: string[];
  tradeoffs: string[];
}

export const developmentRouteBlueprints: DevelopmentRouteBlueprint[] = blueprintData;

export function getDevelopmentRouteBlueprint(
  blueprintId: string,
): DevelopmentRouteBlueprint | undefined {
  return developmentRouteBlueprints.find(
    (blueprint) => blueprint.id === blueprintId,
  );
}

/** 校验快捷蓝图只引用可组合国策；蓝图本身不构成互斥路线。 */
export function validateDevelopmentRouteBlueprints(): void {
  const ids = new Set<string>();
  for (const blueprint of developmentRouteBlueprints) {
    if (ids.has(blueprint.id)) throw new Error(`发展路线蓝图重复：${blueprint.id}`);
    ids.add(blueprint.id);
    if (blueprint.policyIds.length > maximumActivePolicies) {
      throw new Error(`${blueprint.name}超过国策槽位上限`);
    }
    for (const policyId of blueprint.policyIds) {
      if (!getNationalPolicy(policyId)) {
        throw new Error(`${blueprint.name}引用未知国策：${policyId}`);
      }
    }
    validatePolicySelection(blueprint.policyIds);
    if (blueprint.strengths.length === 0 || blueprint.tradeoffs.length === 0) {
      throw new Error(`${blueprint.name}必须同时说明收益和代价`);
    }
  }
}
