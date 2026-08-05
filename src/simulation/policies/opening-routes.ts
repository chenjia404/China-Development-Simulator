import openingBlueprintData from "../../data/config/opening-development-blueprints.json";
import {
  getNationalPolicy,
  maximumActivePolicies,
  validatePolicySelection,
} from "./policy-engine";

/** 1949 开局选用的中国语境发展蓝图（与局内外国参照蓝图分离）。 */
export interface OpeningDevelopmentBlueprint {
  id: string;
  name: string;
  eraNote?: string;
  summary: string;
  policyIds: string[];
  strengths: string[];
  tradeoffs: string[];
}

export const openingDevelopmentBlueprints: OpeningDevelopmentBlueprint[] =
  openingBlueprintData;

export function getOpeningDevelopmentBlueprint(
  blueprintId: string,
): OpeningDevelopmentBlueprint | undefined {
  return openingDevelopmentBlueprints.find(
    (blueprint) => blueprint.id === blueprintId,
  );
}

/** 校验开局蓝图只引用可组合且无互斥冲突的国策。 */
export function validateOpeningDevelopmentBlueprints(): void {
  const ids = new Set<string>();
  for (const blueprint of openingDevelopmentBlueprints) {
    if (ids.has(blueprint.id)) {
      throw new Error(`开局发展蓝图重复：${blueprint.id}`);
    }
    ids.add(blueprint.id);
    if (blueprint.policyIds.length === 0) {
      throw new Error(`${blueprint.name}未配置国策`);
    }
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
