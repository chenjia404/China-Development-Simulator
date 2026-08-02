import relationData from "../../data/config/world-city-state-relations.json";
import countryData from "../../data/config/world-countries.json";
import type { CityStateRelationKind } from "../state/world-state";

interface CityStateRelationConfig {
  importAbsorptionMultipliers: Record<CityStateRelationKind, number>;
  relations: Record<string, CityStateRelationKind>;
}

const config = relationData as CityStateRelationConfig;
const configuredCountryIds = new Set(
  (countryData as Array<{ id: string }>).map((country) => country.id),
);

export const cityStateRelationLabels: Record<CityStateRelationKind, string> = {
  trade_partner: "贸易伙伴",
  aid_recipient: "援助对象",
  competitor: "竞争对手",
};

export const cityStateRelationDescriptions: Record<CityStateRelationKind, string> = {
  trade_partner: "开放市场与贸易枢纽，提高进口吸收权重",
  aid_recipient: "南南合作与援外项目带来设备与工程进口需求",
  competitor: "产业与地缘竞争压低对华商品进口吸收",
};

export function cityStateRelationForCountry(
  countryId: string,
): CityStateRelationKind {
  const relation = config.relations[countryId];
  if (!relation) {
    throw new Error(`缺少城邦关系配置：${countryId}`);
  }
  return relation;
}

export function cityStateImportAbsorptionMultiplier(
  relation: CityStateRelationKind,
): number {
  return config.importAbsorptionMultipliers[relation];
}

/** 启动时校验 64 国城邦关系配置完整且倍率有效。 */
export function validateCityStateRelations(): void {
  const ids = configuredCountryIds;
  const configuredIds = new Set(Object.keys(config.relations));
  if (configuredIds.size !== ids.size) {
    throw new Error(
      `城邦关系配置数量必须为 ${ids.size}，当前为 ${configuredIds.size}`,
    );
  }
  for (const id of ids) {
    if (!configuredIds.has(id)) {
      throw new Error(`城邦关系配置缺少国家：${id}`);
    }
  }
  for (const id of configuredIds) {
    if (!ids.has(id)) {
      throw new Error(`城邦关系配置包含未知国家：${id}`);
    }
  }
  for (const relation of Object.values(config.relations)) {
    const multiplier = config.importAbsorptionMultipliers[relation];
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new Error(`城邦关系 ${relation} 的进口吸收倍率无效`);
    }
  }
}
