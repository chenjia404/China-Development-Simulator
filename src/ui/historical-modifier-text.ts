/** 历史事件与一次性国策使用的模型变量中文名称。 */
export const historicalModifierLabels: Readonly<Record<string, string>> = {
  "sector.primary.output": "农业产出",
  "sector.secondary.output": "工业产出",
  "sector.tertiary.output": "服务业产出",
  "capital.governmentInvestment": "政府投资",
  "capital.privateInvestment": "社会投资",
  "capital.investmentEfficiency": "投资效率",
  "fiscal.revenue": "财政收入",
  "fiscal.spending": "财政支出",
  "trade.foreignInvestment": "外商投资",
  "trade.exportCompetitiveness": "出口竞争力",
  "trade.opennessTarget": "对外开放目标",
  "trade.remittanceInflows": "侨汇流入",
  "trade.remittanceTransferEfficiency": "侨汇到户效率",
  "trade.capitalGoodsImportCoverage": "资本品进口保障率",
  "trade.externalBorrowing": "新增外债融资",
  "trade.externalBorrowingNonReserveUse": "外债国内建设使用比例",
  "trade.externalDebtInterestRate": "外债利率",
  "trade.externalDebtPrincipalRepaymentRate": "外债本金偿还率",
  "diplomacy.reputationTarget": "国际声誉目标",
  "diplomacy.securityTarget": "国家安全环境",
  "diplomacy.relationTarget.albania": "对阿尔巴尼亚关系",
  "diplomacy.relationTarget.australia": "对澳大利亚关系",
  "diplomacy.relationTarget.canada": "对加拿大关系",
  "diplomacy.relationTarget.czechoslovakia": "对捷克斯洛伐克关系",
  "diplomacy.relationTarget.egypt": "对埃及关系",
  "diplomacy.relationTarget.france": "对法国关系",
  "diplomacy.relationTarget.germany": "对德国关系",
  "diplomacy.relationTarget.hungary": "对匈牙利关系",
  "diplomacy.relationTarget.india": "对印度关系",
  "diplomacy.relationTarget.indonesia": "对印度尼西亚关系",
  "diplomacy.relationTarget.japan": "对日本关系",
  "diplomacy.relationTarget.myanmar": "对缅甸关系",
  "diplomacy.relationTarget.north_korea": "对朝鲜关系",
  "diplomacy.relationTarget.pakistan": "对巴基斯坦关系",
  "diplomacy.relationTarget.poland": "对波兰关系",
  "diplomacy.relationTarget.romania": "对罗马尼亚关系",
  "diplomacy.relationTarget.russia": "对苏联／俄罗斯关系",
  "diplomacy.relationTarget.south_korea": "对韩国关系",
  "diplomacy.relationTarget.united_kingdom": "对英国关系",
  "diplomacy.relationTarget.usa": "对美国关系",
  "diplomacy.relationTarget.vietnam": "对越南关系",
  "economy.consumptionPropensity": "居民消费倾向",
  "economy.infrastructureInvestment": "基础设施投资",
  "economy.institutionalEfficiencyTarget": "制度效率目标",
  "economy.structuralProductivityGrowth": "结构性生产率增长",
  "society.happiness": "幸福度目标",
  "society.stability": "社会稳定目标",
  "wellbeing.welfare": "民生福利",
  "resources.foodSupply": "粮食供应",
  "resources.energySupply": "能源供应",
  "population.birthRate": "出生率",
  "population.deathRate": "死亡率",
  "urban.migration": "城乡人口迁移",
  "education.efficiency": "教育效率",
  "education.higherEducationAdmissions": "高等教育招生能力",
  "education.humanCapitalFormation": "人力资本形成",
  "education.academicContinuityTarget": "学术体系连续性",
  "education.researchCohortFormation": "科研人才培养",
  "education.researchTalentRetention": "科研人才留存",
  "health.efficiency": "医疗效率",
  "technology.researchOutput": "科研产出",
  "technology.treeResearchProgress": "科技树研究进度",
  "industry.mining_energy.productivity": "采矿与能源工业生产率",
  "industry.basic_materials.outputWeight": "基础材料工业产出权重",
  "industry.basic_materials.productivity": "基础材料工业生产率",
  "industry.chemicals_pharmaceuticals.productivity": "化工与医药工业生产率",
  "industry.consumer_goods.outputWeight": "消费品工业产出权重",
  "industry.consumer_goods.productivity": "消费品工业生产率",
  "industry.electronics_communications.productivity": "电子通信工业生产率",
  "industry.general_machinery.productivity": "通用机械工业生产率",
  "privateEconomy.operatingSpaceChange": "民营经济经营空间变化",
  "privateEconomy.entrepreneurialCapacityChange": "企业家组织能力变化",
  "privateEconomy.technologyCommercializationChange": "民营科技商业化能力变化",
  "privateEconomy.exportNetworkChange": "民营出口网络变化",
};

export interface HistoricalModifierTextInput {
  target: string;
  operation: "add" | "multiply" | "override";
  value: number;
}

/** 将内部模型字段转换为玩家可理解的中文政策影响说明。 */
export function formatHistoricalModifier(
  modifier: HistoricalModifierTextInput,
): string {
  const label = historicalModifierLabels[modifier.target] ?? "其他政策传导指标";
  if (modifier.operation === "multiply") {
    const change = (modifier.value - 1) * 100;
    return `${label} ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  }
  if (modifier.operation === "add") {
    return `${label} ${modifier.value >= 0 ? "+" : ""}${modifier.value.toFixed(1)}`;
  }
  return `${label} 调整为 ${modifier.value}`;
}
