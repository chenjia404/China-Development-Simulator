import type { GameState } from "../state/game-state";
import {
  assertCompatibleSave,
  SAVE_SCHEMA_VERSION,
  type SaveEnvelope,
} from "./schema";
import { ensureDiplomacyState } from "../diplomacy/diplomacy";
import { ensureHistoricalEventState } from "../events/historical-event-engine";
import { ensureHistoricalAccountingState } from "../economy/historical-accounting";
import { ensureForeignExchangeState } from "../economy/foreign-exchange";
import { ensureTechnologyTreeState } from "../technology/technology-tree";
import { ensureIndustrialStructureState } from "../economy/industrial-structure";
import { ensureEducationState } from "../society/education";
import { ensurePrivateEconomyState } from "../economy/private-economy";
import { ensureDomesticDemandState } from "../economy/domestic-demand";
import { ensureNationalAccountsState } from "../economy/national-accounts";
import { ensureMarketDynamicsState } from "../economy/market-dynamics";
import { ensureDemographicDetailState } from "../population/demographic-cohorts";
import { ensureEnterpriseSectorState } from "../economy/enterprise-sectors";
import { ensureFiscalAgricultureTaxState } from "../fiscal/agricultural-tax";
import { ensureFiscalFederalismState } from "../fiscal/fiscal-federalism";
import { ensureFinancialSystemState } from "../economy/monetary-financial";
import { ensureAgricultureSystemState } from "../economy/agriculture-rural";
import { ensureInfrastructureResourceState } from "../economy/energy-transport-environment";
import { ensureHumanDevelopmentState } from "../society/human-development";
import { ensureUrbanHousingState } from "../society/housing-urbanization";
import { ensureRegionalEconomyState } from "../economy/regional-economy";
import { ensureWorldTradeNetworkState } from "../economy/international-network";
import { ensureWorldCountriesState } from "../world/countries";
import { ensureForeignMarketState } from "../world/foreign-market-demand";
import { ensureSecurityDefenseState } from "../security/defense-security";
import { ensureInstitutionCausalityState } from "../institutions/institution-causality";
import { ensureIndustrialPolicyState } from "../policies/industrial-policy";
import { ensureFamineMortalityAccount } from "../population/famine-mortality-account";
import { ensureAchievementsState } from "../events/national-achievements";

function checksum(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function serializeGameState(
  state: GameState,
  exportedAt = new Date().toISOString(),
): string {
  const stateJson = JSON.stringify(state);
  const envelope: SaveEnvelope = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    simulationVersion: state.simulationVersion,
    exportedAt,
    checksum: checksum(stateJson),
    state,
  };
  return JSON.stringify(envelope);
}

export function deserializeGameState(serialized: string): GameState {
  const save = JSON.parse(serialized) as SaveEnvelope;
  assertCompatibleSave(save);
  const actualChecksum = checksum(JSON.stringify(save.state));
  if (actualChecksum !== save.checksum) {
    throw new Error("存档校验失败，数据可能已损坏");
  }
  const state = structuredClone(save.state);
  if (!Number.isFinite(state.eventRandomState)) {
    state.eventRandomState = (state.seed ^ 0x9e3779b9) >>> 0;
  }
  state.nation.policyProgress ??= {};
  ensureDiplomacyState(state);
  ensureHistoricalEventState(state.nation);
  ensureFamineMortalityAccount(state.nation);
  ensureHistoricalAccountingState(state);
  ensureForeignExchangeState(state);
  ensureEducationState(state.nation);
  ensureTechnologyTreeState(state.nation);
  ensureIndustrialStructureState(state.nation);
  ensurePrivateEconomyState(state.nation);
  ensureDomesticDemandState(state.nation);
  ensureNationalAccountsState(state.nation);
  ensureMarketDynamicsState(state.nation);
  ensureDemographicDetailState(state.nation);
  ensureEnterpriseSectorState(state.nation);
  ensureFiscalFederalismState(state.nation);
  ensureFiscalAgricultureTaxState(state.nation);
  ensureIndustrialPolicyState(state.nation);
  ensureFinancialSystemState(state);
  ensureAgricultureSystemState(state.nation);
  ensureInfrastructureResourceState(state.nation);
  ensureHumanDevelopmentState(state.nation);
  ensureUrbanHousingState(state.nation);
  ensureRegionalEconomyState(state.nation);
  ensureWorldCountriesState(state.world);
  ensureForeignMarketState(state);
  ensureWorldTradeNetworkState(state);
  ensureSecurityDefenseState(state.nation);
  ensureInstitutionCausalityState(state.nation);
  ensureAchievementsState(state.nation);
  return state;
}
