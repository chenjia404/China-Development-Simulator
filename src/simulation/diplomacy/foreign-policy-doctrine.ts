import doctrineConfig from "../../data/config/foreign-policy-doctrines.json";
import { clamp } from "../core/math";
import type { GameState, NationState } from "../state/game-state";

export type ForeignPolicyDoctrineId =
  NationState["diplomacy"]["foreignPolicyDoctrineId"];

export interface ForeignPolicyDoctrineDefinition {
  id: ForeignPolicyDoctrineId;
  name: string;
  shortName: string;
  description: string;
  activationCost: number;
  effects: string[];
  marketAccessMultiplier: number;
  foreignInvestmentMultiplier: number;
  technologyDiffusionMultiplier: number;
  researchOutputMultiplier: number;
  securityTargetAdjustment: number;
  reputationTargetAdjustment: number;
  monthlyPointGainAdjustment: number;
  relationGroupAdjustments: Record<string, number>;
  relationTargetAdjustments: Record<string, number>;
}

export interface ForeignPolicyDoctrineEffects {
  marketAccessMultiplier: number;
  foreignInvestmentMultiplier: number;
  technologyDiffusionMultiplier: number;
  researchOutputMultiplier: number;
  securityTargetAdjustment: number;
  reputationTargetAdjustment: number;
  monthlyPointGainAdjustment: number;
}

export const foreignPolicyDoctrineDefinitions =
  doctrineConfig.doctrines as ForeignPolicyDoctrineDefinition[];
export const foreignPolicyDoctrineCooldownMonths = doctrineConfig.cooldownMonths;

export function getForeignPolicyDoctrine(
  doctrineId: string,
): ForeignPolicyDoctrineDefinition | undefined {
  return foreignPolicyDoctrineDefinitions.find((doctrine) => doctrine.id === doctrineId);
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function doctrinePair(nation: NationState): {
  previous: ForeignPolicyDoctrineDefinition;
  current: ForeignPolicyDoctrineDefinition;
  progress: number;
} {
  const current = getForeignPolicyDoctrine(
    nation.diplomacy.foreignPolicyDoctrineId,
  );
  const previous = nation.diplomacy.previousForeignPolicyDoctrineId
    ? getForeignPolicyDoctrine(nation.diplomacy.previousForeignPolicyDoctrineId)
    : current;
  if (!current || !previous) throw new Error("外交学说配置不完整");
  return {
    previous,
    current,
    progress: clamp(nation.diplomacy.foreignPolicyDoctrineProgress, 0, 1),
  };
}

export function foreignPolicyDoctrineEffects(
  nation: NationState,
): ForeignPolicyDoctrineEffects {
  const { previous, current, progress } = doctrinePair(nation);
  const blend = (getValue: (definition: ForeignPolicyDoctrineDefinition) => number) =>
    interpolate(getValue(previous), getValue(current), progress);
  return {
    marketAccessMultiplier: blend((definition) => definition.marketAccessMultiplier),
    foreignInvestmentMultiplier: blend(
      (definition) => definition.foreignInvestmentMultiplier,
    ),
    technologyDiffusionMultiplier: blend(
      (definition) => definition.technologyDiffusionMultiplier,
    ),
    researchOutputMultiplier: blend((definition) => definition.researchOutputMultiplier),
    securityTargetAdjustment: blend((definition) => definition.securityTargetAdjustment),
    reputationTargetAdjustment: blend(
      (definition) => definition.reputationTargetAdjustment,
    ),
    monthlyPointGainAdjustment: blend(
      (definition) => definition.monthlyPointGainAdjustment,
    ),
  };
}

function relationAdjustment(
  definition: ForeignPolicyDoctrineDefinition,
  countryId: string,
): number {
  let adjustment = definition.relationTargetAdjustments[countryId] ?? 0;
  for (const [groupId, groupAdjustment] of Object.entries(
    definition.relationGroupAdjustments,
  )) {
    const countryIds = doctrineConfig.countryGroups[
      groupId as keyof typeof doctrineConfig.countryGroups
    ];
    if (countryIds?.includes(countryId)) adjustment += groupAdjustment;
  }
  return adjustment;
}

export function foreignPolicyDoctrineRelationAdjustment(
  nation: NationState,
  countryId: string,
): number {
  const { previous, current, progress } = doctrinePair(nation);
  return interpolate(
    relationAdjustment(previous, countryId),
    relationAdjustment(current, countryId),
    progress,
  );
}

export function updateForeignPolicyDoctrine(nation: NationState): void {
  if (nation.diplomacy.foreignPolicyDoctrineProgress >= 1) {
    nation.diplomacy.foreignPolicyDoctrineProgress = 1;
    nation.diplomacy.previousForeignPolicyDoctrineId = null;
    return;
  }
  nation.diplomacy.foreignPolicyDoctrineProgress = clamp(
    nation.diplomacy.foreignPolicyDoctrineProgress + 1 / doctrineConfig.transitionMonths,
    0,
    1,
  );
  if (nation.diplomacy.foreignPolicyDoctrineProgress >= 1) {
    nation.diplomacy.previousForeignPolicyDoctrineId = null;
  }
}

export function foreignPolicyDoctrineCooldownRemaining(state: GameState): number {
  const changedAt = state.nation.diplomacy.lastForeignPolicyDoctrineChangeMonth;
  if (changedAt === null) return 0;
  return Math.max(
    0,
    foreignPolicyDoctrineCooldownMonths -
      (state.nation.date.elapsedMonths - changedAt),
  );
}

export function setForeignPolicyDoctrine(
  state: GameState,
  doctrineId: ForeignPolicyDoctrineId,
): void {
  const doctrine = getForeignPolicyDoctrine(doctrineId);
  if (!doctrine) throw new Error(`未知外交学说：${doctrineId}`);
  const diplomacy = state.nation.diplomacy;
  if (diplomacy.foreignPolicyDoctrineId === doctrineId) {
    throw new Error(`当前已经采用${doctrine.name}`);
  }
  const cooldown = foreignPolicyDoctrineCooldownRemaining(state);
  if (cooldown > 0) throw new Error(`外交学说调整还需冷却 ${cooldown} 个月`);
  if (diplomacy.diplomaticPoints < doctrine.activationCost) {
    throw new Error(`采用${doctrine.name}需要 ${doctrine.activationCost} 点外交点数`);
  }
  diplomacy.diplomaticPoints -= doctrine.activationCost;
  diplomacy.previousForeignPolicyDoctrineId = diplomacy.foreignPolicyDoctrineId;
  diplomacy.foreignPolicyDoctrineId = doctrine.id;
  diplomacy.foreignPolicyDoctrineProgress = 0;
  diplomacy.lastForeignPolicyDoctrineChangeMonth = state.nation.date.elapsedMonths;
}
