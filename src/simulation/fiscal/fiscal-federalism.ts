import federalismData from "../../data/config/fiscal-federalism.json";
import { clamp, safeDivide } from "../core/math";
import type {
  FiscalFederalismState,
  NationState,
  SocialProtectionProgramAccount,
} from "../state/game-state";

type ProgramId = "pension" | "medical" | "unemployment" | "minimumLiving" | "family";
interface Config {
  centralRevenueShareBefore1994: number;
  centralRevenueShareAfter1994: number;
  centralSpendingShareBefore1994: number;
  centralSpendingShareAfter1994: number;
  reformTransitionMonths: number;
  localDebtShare: number;
  socialInsuranceContributionShareOfRevenue: number;
  socialProtectionProgramWeights: Record<ProgramId, number>;
}
const config = federalismData as Config;
const PROGRAM_IDS = ["pension", "medical", "unemployment", "minimumLiving", "family"] as const;

function emptyProgram(): SocialProtectionProgramAccount {
  return { contributionRevenue: 0, benefitExpenditure: 0, balance: 0, beneficiaries: 0, averageBenefit: 0 };
}

export function createEmptyFiscalFederalismState(): FiscalFederalismState {
  return {
    central: { revenue: 0, expenditure: 0, balance: 0, debt: 0 },
    local: { revenue: 0, expenditure: 0, balance: 0, debt: 0 },
    centralToLocalTransfers: 0,
    centralRevenueShare: config.centralRevenueShareBefore1994,
    centralSpendingShare: config.centralSpendingShareBefore1994,
    socialProtection: {
      pension: emptyProgram(), medical: emptyProgram(), unemployment: emptyProgram(),
      minimumLiving: emptyProgram(), family: emptyProgram(), reserve: 0,
      totalContributions: 0, totalBenefits: 0,
    },
    consolidatedRevenueError: 0,
    consolidatedExpenditureError: 0,
    consolidatedDebtError: 0,
  };
}

export function validateFiscalFederalismConfig(): string[] {
  const total = PROGRAM_IDS.reduce((sum, id) => sum + config.socialProtectionProgramWeights[id], 0);
  return Math.abs(total - 1) > 1e-9 ? ["社会保障项目权重之和必须为1"] : [];
}

export function ensureFiscalFederalismState(nation: NationState): void {
  const current = nation.fiscal.federalism as Partial<FiscalFederalismState> | undefined;
  if (current?.central && current.local && current.socialProtection?.pension &&
      Number.isFinite(current.central.revenue)) return;
  nation.fiscal.federalism = createEmptyFiscalFederalismState();
  updateFiscalFederalism(nation);
}

function reformProgress(nation: NationState): number {
  const months = (nation.date.year - 1994) * 12 + nation.date.month - 1;
  return clamp(months / config.reformTransitionMonths, 0, 1);
}

function beneficiaries(nation: NationState, id: ProgramId): number {
  if (id === "pension") return nation.population.ageGroups.elderly;
  if (id === "medical") return nation.population.total * nation.health.coverageRate;
  if (id === "unemployment") return nation.labor.unemployed;
  if (id === "minimumLiving") return nation.population.total * nation.society.povertyRate;
  return nation.population.ageGroups.children;
}

/** 把合并财政拆为中央、地方和五项社保账户，不改变财政总收入与总支出。 */
export function updateFiscalFederalism(nation: NationState): void {
  if (!nation.fiscal.federalism) nation.fiscal.federalism = createEmptyFiscalFederalismState();
  const { fiscal } = nation;
  const state = fiscal.federalism;
  const progress = reformProgress(nation);
  state.centralRevenueShare = config.centralRevenueShareBefore1994 +
    (config.centralRevenueShareAfter1994 - config.centralRevenueShareBefore1994) * progress;
  state.centralSpendingShare = config.centralSpendingShareBefore1994 +
    (config.centralSpendingShareAfter1994 - config.centralSpendingShareBefore1994) * progress;
  const centralGrossRevenue = fiscal.revenue * state.centralRevenueShare;
  const localOwnRevenue = fiscal.revenue - centralGrossRevenue;
  const centralDirectSpending = fiscal.expenditure * state.centralSpendingShare;
  const localSpending = fiscal.expenditure - centralDirectSpending;
  state.centralToLocalTransfers = clamp(
    Math.max(0, localSpending - localOwnRevenue),
    0,
    centralGrossRevenue,
  );
  state.central.revenue = centralGrossRevenue - state.centralToLocalTransfers;
  state.local.revenue = localOwnRevenue + state.centralToLocalTransfers;
  state.central.expenditure = centralDirectSpending;
  state.local.expenditure = localSpending;
  state.central.balance = state.central.revenue - state.central.expenditure;
  state.local.balance = state.local.revenue - state.local.expenditure;
  state.local.debt = fiscal.governmentDebt * config.localDebtShare * progress;
  state.central.debt = fiscal.governmentDebt - state.local.debt;

  const contributions = Math.min(
    fiscal.revenue * config.socialInsuranceContributionShareOfRevenue,
    fiscal.revenue,
  );
  const welfareBenefits = Math.min(
    fiscal.expenditure * fiscal.budget.welfare,
    fiscal.expenditure,
  );
  state.socialProtection.totalContributions = contributions;
  state.socialProtection.totalBenefits = welfareBenefits;
  for (const id of PROGRAM_IDS) {
    const account = state.socialProtection[id];
    const weight = config.socialProtectionProgramWeights[id];
    account.contributionRevenue = contributions * weight;
    account.benefitExpenditure = welfareBenefits * weight;
    account.balance = account.contributionRevenue - account.benefitExpenditure;
    account.beneficiaries = beneficiaries(nation, id);
    account.averageBenefit = safeDivide(account.benefitExpenditure, account.beneficiaries);
  }
  state.socialProtection.reserve = Math.max(
    0,
    state.socialProtection.reserve +
      (contributions - welfareBenefits) / 12,
  );
  state.consolidatedRevenueError = Math.abs(
    state.central.revenue + state.local.revenue - fiscal.revenue,
  );
  state.consolidatedExpenditureError = Math.abs(
    state.central.expenditure + state.local.expenditure - fiscal.expenditure,
  );
  state.consolidatedDebtError = Math.abs(
    state.central.debt + state.local.debt - fiscal.governmentDebt,
  );
}
