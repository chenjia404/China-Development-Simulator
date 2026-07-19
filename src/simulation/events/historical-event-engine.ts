import historicalEventData from "../../data/config/historical-events.json";
import historicalDecisionData from "../../data/config/historical-event-decisions.json";
import historicalDependencyData from "../../data/config/historical-event-dependencies.json";
import type { ModifierState, NationState } from "../state/game-state";
import type { HistoricalEventRecord } from "../state/history-state";
import { applyForeignAidEventAdjustment } from "../diplomacy/foreign-aid";
import { addModifier } from "./modifiers";
import {
  AGRICULTURAL_TAX_ABOLITION_EVENT_ID,
  ensureFiscalAgricultureTaxState,
} from "../fiscal/agricultural-tax";

export type HistoricalEventCategory =
  | "经济制度"
  | "财政金融"
  | "农业农村"
  | "对外经济"
  | "工业化"
  | "经济危机"
  | "宏观调控"
  | "社会教育"
  | "外交"
  | "经济改革"
  | "外部冲击"
  | "公共卫生"
  | "外交经贸";

export type HistoricalEventImpact = "positive" | "negative" | "mixed";
export type HistoricalEventDecisionMode = "automatic" | "interactive";
export type HistoricalEventOutcome =
  | "occurred"
  | "prevented"
  | "enacted_early"
  | "enacted_late";

export interface HistoricalEventModifierDefinition {
  target: string;
  operation: ModifierState["operation"];
  value: number;
  delayMonths?: number;
  durationMonths?: number;
}

export interface HistoricalEventForeignAidAdjustment {
  annualRmbDelta: number;
  annualForeignExchangeRmbDelta: number;
  durationMonths: number;
}

export interface HistoricalEventDefinition {
  id: string;
  name: string;
  year: number;
  month: number;
  triggerMode?: "scheduled" | "conditional";
  category: HistoricalEventCategory;
  impact: HistoricalEventImpact;
  description: string;
  effects: string[];
  durationMonths: number;
  modifiers: HistoricalEventModifierDefinition[];
  foreignAidAdjustment?: HistoricalEventForeignAidAdjustment;
}

export interface HistoricalEventChoice {
  id: string;
  name: string;
  description: string;
  effects: string[];
  durationMonths: number;
  modifiers: HistoricalEventModifierDefinition[];
  isHistoricalPath: boolean;
  outcome?: HistoricalEventOutcome;
  foreignAidAdjustment?: HistoricalEventForeignAidAdjustment;
}

export interface HistoricalEventAxisOption {
  id: string;
  name: string;
  description: string;
  effects: string[];
  durationMonths: number;
  modifiers: HistoricalEventModifierDefinition[];
  isHistoricalDefault?: boolean;
  useEventModifiers?: boolean;
  outcome?: HistoricalEventOutcome;
  foreignAidAdjustment?: HistoricalEventForeignAidAdjustment;
}

export interface HistoricalEventAxisDefinition {
  id: string;
  name: string;
  description?: string;
  options: HistoricalEventAxisOption[];
}

interface HistoricalEventDecisionDefinition {
  eventId: string;
  choices?: Array<Omit<HistoricalEventChoice, "isHistoricalPath">>;
  axes?: HistoricalEventAxisDefinition[];
}

interface HistoricalEventDependencyDefinition {
  eventId: string;
  sourceEventId: string;
  sourceChoiceIds: string[];
  modifierScale: number;
  durationMultiplier: number;
  contextEffect: string;
}

export const historicalEventDefinitions =
  historicalEventData as HistoricalEventDefinition[];

const historicalDecisionDefinitions =
  historicalDecisionData as HistoricalEventDecisionDefinition[];
const historicalDependencyDefinitions =
  historicalDependencyData as HistoricalEventDependencyDefinition[];

export function getHistoricalEvent(
  eventId: string,
): HistoricalEventDefinition | undefined {
  return historicalEventDefinitions.find((event) => event.id === eventId);
}

function scaleModifier(
  modifier: HistoricalEventModifierDefinition,
  scale: number,
): HistoricalEventModifierDefinition {
  if (modifier.operation === "multiply") {
    return { ...modifier, value: 1 + (modifier.value - 1) * scale };
  }
  if (modifier.operation === "add") {
    return { ...modifier, value: modifier.value * scale };
  }
  return { ...modifier };
}

function genericChoices(event: HistoricalEventDefinition): HistoricalEventChoice[] {
  if (event.impact === "negative") {
    return [
      {
        id: "limited_intervention",
        name: "有限干预、控制损失",
        description: "调动有限财政与行政资源降低冲击强度，保留更多资源应对后续风险。",
        effects: ["事件冲击降低约三成", "持续期有所缩短", "财政支出小幅增加"],
        durationMonths: Math.max(1, Math.round(event.durationMonths * 0.85)),
        modifiers: [
          ...event.modifiers.map((modifier) => scaleModifier(modifier, 0.7)),
          { target: "fiscal.spending", operation: "multiply", value: 1.015 },
        ],
        isHistoricalPath: false,
      },
      {
        id: "comprehensive_response",
        name: "全面应对、优先止损",
        description: "投入更多财政与治理资源系统应对冲击，以更高短期成本换取更低损失和更快恢复。",
        effects: ["事件冲击降低约六成", "恢复时间明显缩短", "财政收入与支出承压"],
        durationMonths: Math.max(1, Math.round(event.durationMonths * 0.7)),
        modifiers: [
          ...event.modifiers.map((modifier) => scaleModifier(modifier, 0.4)),
          { target: "fiscal.spending", operation: "multiply", value: 1.04 },
          { target: "fiscal.revenue", operation: "multiply", value: 0.99 },
        ],
        isHistoricalPath: false,
      },
    ];
  }

  if (event.impact === "positive") {
    return [
      {
        id: "cautious_implementation",
        name: "审慎试点、渐进实施",
        description: "先在有限范围验证制度与执行能力，降低短期收益，同时缩小执行偏差和资源占用。",
        effects: ["政策收益约为历史路径的六成半", "实施期更短", "执行风险较低"],
        durationMonths: Math.max(1, Math.round(event.durationMonths * 0.8)),
        modifiers: event.modifiers.map((modifier) => scaleModifier(modifier, 0.65)),
        isHistoricalPath: false,
      },
      {
        id: "accelerated_implementation",
        name: "扩大投入、加速实施",
        description: "扩大改革或建设投入以放大政策收益，但需要更高财政支出并延长资源占用期。",
        effects: ["政策传导强度提高", "资源投入期延长", "财政支出增加"],
        durationMonths: Math.max(1, Math.round(event.durationMonths * 1.1)),
        modifiers: [
          ...event.modifiers.map((modifier) => scaleModifier(modifier, 1.2)),
          { target: "fiscal.spending", operation: "multiply", value: 1.02 },
        ],
        isHistoricalPath: false,
      },
    ];
  }

  return [
    {
      id: "cautious_adjustment",
      name: "缩小范围、审慎调整",
      description: "降低政策推进强度并缩短实施期，使收益和代价同时收敛，减少路径依赖。",
      effects: ["收益与代价均降低约三成", "实施期缩短", "制度转换更平缓"],
      durationMonths: Math.max(1, Math.round(event.durationMonths * 0.8)),
      modifiers: event.modifiers.map((modifier) => scaleModifier(modifier, 0.7)),
      isHistoricalPath: false,
    },
    {
      id: "active_adjustment",
      name: "主动推进、配套托底",
      description: "提高政策执行强度，并用额外财政资源缓冲转型代价和利益调整。",
      effects: ["政策正负传导同时增强", "财政提供配套支持", "实施周期略有延长"],
      durationMonths: Math.max(1, Math.round(event.durationMonths * 1.05)),
      modifiers: [
        ...event.modifiers.map((modifier) => scaleModifier(modifier, 1.15)),
        { target: "fiscal.spending", operation: "multiply", value: 1.02 },
      ],
      isHistoricalPath: false,
    },
  ];
}

function scaleForeignAidAdjustment(
  adjustment: HistoricalEventForeignAidAdjustment | undefined,
  modifierScale: number,
  durationMultiplier: number,
): HistoricalEventForeignAidAdjustment | undefined {
  if (!adjustment) return undefined;
  return {
    annualRmbDelta: adjustment.annualRmbDelta * modifierScale,
    annualForeignExchangeRmbDelta:
      adjustment.annualForeignExchangeRmbDelta * modifierScale,
    durationMonths: Math.max(
      1,
      Math.round(adjustment.durationMonths * durationMultiplier),
    ),
  };
}

function matchingHistoricalDependencies(
  event: HistoricalEventDefinition,
  nation?: NationState,
) {
  if (!nation) return [];
  return historicalDependencyDefinitions.filter((dependency) => {
    if (dependency.eventId !== event.id) return false;
    const sourceRecord = nation.history.historicalEvents.find(
      (record) => record.id === dependency.sourceEventId,
    );
    return sourceRecord
      ? dependency.sourceChoiceIds.includes(sourceRecord.choiceId)
      : false;
  });
}

function historicalDependencyScales(
  event: HistoricalEventDefinition,
  nation?: NationState,
): { modifierScale: number; durationMultiplier: number } | null {
  const dependencies = matchingHistoricalDependencies(event, nation);
  if (dependencies.length === 0) return null;
  return {
    modifierScale: dependencies.reduce(
      (scale, dependency) => scale * dependency.modifierScale,
      1,
    ),
    durationMultiplier: dependencies.reduce(
      (scale, dependency) => scale * dependency.durationMultiplier,
      1,
    ),
  };
}

function contextualizeHistoricalEvent(
  event: HistoricalEventDefinition,
  nation?: NationState,
): HistoricalEventDefinition {
  const dependencies = matchingHistoricalDependencies(event, nation);
  if (dependencies.length === 0) return event;
  const modifierScale = dependencies.reduce(
    (scale, dependency) => scale * dependency.modifierScale,
    1,
  );
  const durationMultiplier = dependencies.reduce(
    (scale, dependency) => scale * dependency.durationMultiplier,
    1,
  );
  return {
    ...event,
    description: `${event.description} 此前的玩家决策改变了危机成因，政策性冲击将相应减弱。`,
    effects: [
      ...event.effects,
      ...dependencies.map((dependency) => dependency.contextEffect),
    ],
    durationMonths: Math.max(
      1,
      Math.round(event.durationMonths * durationMultiplier),
    ),
    modifiers: event.modifiers.map((modifier) =>
      scaleModifier(modifier, modifierScale)
    ),
    foreignAidAdjustment: scaleForeignAidAdjustment(
      event.foreignAidAdjustment,
      modifierScale,
      durationMultiplier,
    ),
  };
}

function contextualizeHistoricalChoice(
  choice: Omit<HistoricalEventChoice, "isHistoricalPath"> & {
    isHistoricalPath?: boolean;
  },
  scales: { modifierScale: number; durationMultiplier: number } | null,
): HistoricalEventChoice {
  if (!scales) {
    return { ...choice, isHistoricalPath: false };
  }
  const { modifierScale, durationMultiplier } = scales;
  return {
    ...choice,
    isHistoricalPath: false,
    durationMonths: Math.max(
      1,
      Math.round(choice.durationMonths * durationMultiplier),
    ),
    modifiers: choice.modifiers.map((modifier) =>
      scaleModifier(modifier, modifierScale)
    ),
    foreignAidAdjustment: scaleForeignAidAdjustment(
      choice.foreignAidAdjustment,
      modifierScale,
      durationMultiplier,
    ),
  };
}

type HistoricalModifierMergeMode = "overlay" | "stack";

/** 覆盖式：史实贸易底座与救济并存时，重叠 target 取更优缓解、贸易代价取更严。 */
function mergeMultiplyOverlay(target: string, left: number, right: number): number {
  if (
    target === "trade.capitalGoodsImportCoverage" ||
    target === "trade.exportCompetitiveness"
  ) {
    return Math.min(left, right);
  }
  if (target === "population.deathRate") {
    return Math.min(left, right);
  }
  if (target === "fiscal.spending") {
    return Math.max(left, right);
  }
  return Math.max(left, right);
}

/**
 * 叠乘式：备选轴同时生效时，互补冲击按独立效应叠加。
 * 粮食等保留率用软或：1-(1-a)(1-b)；死亡率超额相乘；用汇等代价相乘。
 */
function mergeMultiplyStack(target: string, left: number, right: number): number {
  if (target === "population.deathRate") {
    return 1 + (left - 1) * (right - 1);
  }
  if (
    target === "trade.capitalGoodsImportCoverage" ||
    target === "trade.exportCompetitiveness"
  ) {
    return left * right;
  }
  if (target === "fiscal.spending") {
    return left + right - 1;
  }
  if (left <= 1 && right <= 1) {
    return 1 - (1 - left) * (1 - right);
  }
  if (left >= 1 && right >= 1) {
    return left * right;
  }
  return Math.max(left, right);
}

function composeHistoricalModifiers(
  packages: HistoricalEventModifierDefinition[][],
  mode: HistoricalModifierMergeMode = "overlay",
): HistoricalEventModifierDefinition[] {
  const merged = new Map<string, HistoricalEventModifierDefinition>();
  for (const pack of packages) {
    for (const modifier of pack) {
      const key = [
        modifier.target,
        modifier.operation,
        modifier.delayMonths ?? 0,
        modifier.durationMonths ?? "",
      ].join("|");
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...modifier });
        continue;
      }
      if (modifier.operation === "add") {
        existing.value = mode === "stack"
          ? existing.value + modifier.value
          : Math.max(existing.value, modifier.value);
      } else if (modifier.operation === "multiply") {
        existing.value = mode === "stack"
          ? mergeMultiplyStack(modifier.target, existing.value, modifier.value)
          : mergeMultiplyOverlay(modifier.target, existing.value, modifier.value);
      }
    }
  }
  return [...merged.values()];
}

const threeYearLegacyChoiceAliases: Record<string, string[]> = {
  accept_foreign_aid: [
    "continue_grain_exports",
    "accept_foreign_aid",
    "continue_high_procurement",
  ],
  domestic_emergency_relief: [
    "continue_grain_exports",
    "domestic_emergency_relief",
    "continue_high_procurement",
  ],
  limit_grain_exports: [
    "limit_grain_exports",
    "no_additional_relief",
    "continue_high_procurement",
  ],
  ban_grain_exports_and_import: [
    "ban_grain_exports_and_import",
    "no_additional_relief",
    "continue_high_procurement",
  ],
  reduce_procurement_guarantee_ration: [
    "continue_grain_exports",
    "no_additional_relief",
    "reduce_procurement_guarantee_ration",
  ],
};

/** 旧存档两段式复合 id（缺征购轴）映射到补齐史实征购默认后的三段。 */
function padLegacyThreeYearOptionIds(
  axes: HistoricalEventAxisDefinition[],
  parts: string[],
): string[] | null {
  if (parts.length === 0 || parts.length > axes.length) {
    return null;
  }
  if (parts.length === axes.length) return parts;
  const resolved = axes.map((axis) => {
    const matched = axis.options.find((option) => parts.includes(option.id));
    if (matched) return matched.id;
    return (
      axis.options.find((option) => option.isHistoricalDefault) ??
      axis.options[0]
    ).id;
  });
  // 每个遗留片段都必须落在某一轴上，避免把未知 id 静默改写成默认。
  if (!parts.every((part) => resolved.includes(part))) return null;
  return resolved;
}

function getDecisionDefinition(eventId: string) {
  return historicalDecisionDefinitions.find(
    (definition) => definition.eventId === eventId,
  );
}

export function getHistoricalEventAxes(
  eventOrId: HistoricalEventDefinition | string,
  nation?: NationState,
): HistoricalEventAxisDefinition[] {
  const baseEvent = typeof eventOrId === "string"
    ? getHistoricalEvent(eventOrId)
    : eventOrId;
  if (!baseEvent) return [];
  const bespoke = getDecisionDefinition(baseEvent.id);
  if (!bespoke?.axes?.length) return [];
  const scales = historicalDependencyScales(baseEvent, nation);
  const event = contextualizeHistoricalEvent(baseEvent, nation);
  return bespoke.axes.map((axis) => ({
    ...axis,
    options: axis.options.map((option) => {
      const modifiers = option.useEventModifiers
        ? event.modifiers.map((modifier) => ({ ...modifier }))
        : option.modifiers.map((modifier) => ({ ...modifier }));
      const scaled = contextualizeHistoricalChoice(
        {
          id: option.id,
          name: option.name,
          description: option.description,
          effects: [...option.effects],
          durationMonths: option.durationMonths,
          modifiers,
          outcome: option.outcome,
          foreignAidAdjustment: option.foreignAidAdjustment
            ? { ...option.foreignAidAdjustment }
            : undefined,
        },
        option.useEventModifiers ? null : scales,
      );
      // 史实贸易默认用已 contextualize 的事件本体 modifiers；其余选项再套 dependency 缩放。
      const finalModifiers = option.useEventModifiers
        ? modifiers
        : scaled.modifiers;
      const finalDuration = option.useEventModifiers
        ? event.durationMonths
        : scaled.durationMonths;
      return {
        ...option,
        modifiers: finalModifiers,
        durationMonths: finalDuration,
        foreignAidAdjustment: scaled.foreignAidAdjustment,
      };
    }),
  }));
}

function cartesianAxisOptions(
  axes: HistoricalEventAxisDefinition[],
): HistoricalEventAxisOption[][] {
  return axes.reduce<HistoricalEventAxisOption[][]>(
    (groups, axis) => {
      if (groups.length === 0) {
        return axis.options.map((option) => [option]);
      }
      return groups.flatMap((group) =>
        axis.options.map((option) => [...group, option])
      );
    },
    [],
  );
}

export function composeHistoricalEventAxisChoice(
  eventOrId: HistoricalEventDefinition | string,
  optionIds: string[],
  nation?: NationState,
): HistoricalEventChoice | undefined {
  const baseEvent = typeof eventOrId === "string"
    ? getHistoricalEvent(eventOrId)
    : eventOrId;
  if (!baseEvent) return undefined;
  const axes = getHistoricalEventAxes(baseEvent, nation);
  if (axes.length === 0) return undefined;
  if (optionIds.length !== axes.length) return undefined;
  const selected: HistoricalEventAxisOption[] = [];
  for (const [index, axis] of axes.entries()) {
    const option = axis.options.find((candidate) => candidate.id === optionIds[index]);
    if (!option) return undefined;
    selected.push(option);
  }
  const allHistorical = selected.every((option, index) => {
    const defaults = axes[index].options.find((candidate) =>
      candidate.isHistoricalDefault
    ) ?? axes[index].options[0];
    return option.id === defaults.id;
  });
  const event = contextualizeHistoricalEvent(baseEvent, nation);
  // 含史实贸易底座时用覆盖合并，避免“继续出口+外援”把底座冲击软叠成近乎消除；
  // 各轴均为备选（如禁出口+外援+降征购）时用叠乘，使粮食等互补收益真正高于单轴。
  const mergeMode: HistoricalModifierMergeMode = selected.some(
    (option) => option.useEventModifiers,
  )
    ? "overlay"
    : "stack";
  const modifiers = composeHistoricalModifiers(
    selected.map((option) => option.modifiers),
    mergeMode,
  );
  const durationMonths = Math.max(
    ...selected.map((option) => option.durationMonths),
    1,
  );
  const foreignAidAdjustment = selected
    .map((option) => option.foreignAidAdjustment)
    .find((adjustment) => adjustment != null);
  return {
    id: allHistorical ? "historical_path" : optionIds.join("+"),
    name: allHistorical
      ? "遵循历史路径"
      : selected.map((option) => option.name).join(" + "),
    description: allHistorical
      ? `按史实推进“${event.name}”，完整承受其阶段性收益、代价与持续影响。`
      : selected.map((option) => option.description).join(" "),
    effects: allHistorical
      ? [...event.effects]
      : selected.flatMap((option) => option.effects),
    durationMonths: allHistorical ? event.durationMonths : durationMonths,
    modifiers: allHistorical
      ? event.modifiers.map((modifier) => ({ ...modifier }))
      : modifiers,
    isHistoricalPath: allHistorical,
    outcome: selected.find((option) => option.outcome)?.outcome ?? "occurred",
    foreignAidAdjustment: allHistorical
      ? (event.foreignAidAdjustment
        ? { ...event.foreignAidAdjustment }
        : undefined)
      : (foreignAidAdjustment ? { ...foreignAidAdjustment } : undefined),
  };
}

function expandAxisChoiceId(
  eventId: string,
  choiceId: string,
): string[] | null {
  const axes = getDecisionDefinition(eventId)?.axes;
  if (!axes?.length) return null;
  if (choiceId === "historical_path") {
    return axes.map((axis) =>
      (axis.options.find((option) => option.isHistoricalDefault) ??
        axis.options[0]).id
    );
  }
  if (choiceId.includes("+")) {
    const parts = choiceId.split("+");
    if (parts.length === axes.length) return parts;
    const padded = padLegacyThreeYearOptionIds(axes, parts);
    if (padded) return padded;
    return parts;
  }
  const aliased = threeYearLegacyChoiceAliases[choiceId];
  if (aliased) return aliased;
  // 单轴遗留 id：补齐其余轴的历史默认。
  const matchedAxisIndex = axes.findIndex((axis) =>
    axis.options.some((option) => option.id === choiceId)
  );
  if (matchedAxisIndex < 0) return null;
  return axes.map((axis, index) => {
    if (index === matchedAxisIndex) return choiceId;
    return (
      axis.options.find((option) => option.isHistoricalDefault) ?? axis.options[0]
    ).id;
  });
}

export function getHistoricalEventChoice(
  eventOrId: HistoricalEventDefinition | string,
  choiceId: string,
  nation?: NationState,
): HistoricalEventChoice | undefined {
  const baseEvent = typeof eventOrId === "string"
    ? getHistoricalEvent(eventOrId)
    : eventOrId;
  if (!baseEvent) return undefined;
  const axisOptionIds = expandAxisChoiceId(baseEvent.id, choiceId);
  if (axisOptionIds) {
    return composeHistoricalEventAxisChoice(baseEvent, axisOptionIds, nation);
  }
  return getHistoricalEventChoices(baseEvent, nation).find(
    (candidate) => candidate.id === choiceId,
  );
}

export function getHistoricalEventChoices(
  eventOrId: HistoricalEventDefinition | string,
  nation?: NationState,
): HistoricalEventChoice[] {
  const baseEvent = typeof eventOrId === "string"
    ? getHistoricalEvent(eventOrId)
    : eventOrId;
  if (!baseEvent) return [];
  const axes = getHistoricalEventAxes(baseEvent, nation);
  if (axes.length > 0) {
    const choices = cartesianAxisOptions(axes).map((selected) => {
      const composed = composeHistoricalEventAxisChoice(
        baseEvent,
        selected.map((option) => option.id),
        nation,
      );
      return composed!;
    });
    // 史实组合始终置顶，避免备选项排在轴首位时破坏 choices[0] 约定。
    return choices.sort((left, right) => {
      if (left.isHistoricalPath === right.isHistoricalPath) return 0;
      return left.isHistoricalPath ? -1 : 1;
    });
  }
  const scales = historicalDependencyScales(baseEvent, nation);
  const event = contextualizeHistoricalEvent(baseEvent, nation);
  const historicalChoice: HistoricalEventChoice = {
    id: "historical_path",
    name: "遵循历史路径",
    description: `按史实推进“${event.name}”，完整承受其阶段性收益、代价与持续影响。`,
    effects: [...event.effects],
    durationMonths: event.durationMonths,
    modifiers: event.modifiers.map((modifier) => ({ ...modifier })),
    isHistoricalPath: true,
    outcome: "occurred",
    foreignAidAdjustment: event.foreignAidAdjustment
      ? { ...event.foreignAidAdjustment }
      : undefined,
  };
  const bespoke = getDecisionDefinition(event.id);
  const alternatives = bespoke?.choices?.length
    ? bespoke.choices.map((choice) =>
      contextualizeHistoricalChoice(choice, scales)
    )
    : genericChoices(event);
  return [historicalChoice, ...alternatives];
}

export function ensureHistoricalEventState(nation: NationState): void {
  nation.history.historicalEvents ??= [];
  nation.historicalEventDecisionMode ??= "automatic";
  nation.pendingHistoricalEventId ??= null;
  for (const record of nation.history.historicalEvents) {
    const definition = getHistoricalEvent(record.id);
    record.choiceId ??= "historical_path";
    record.choiceName ??= "遵循历史路径";
    record.choiceDescription ??= "由旧版本存档迁移，按历史方案记录。";
    record.outcome ??= "occurred";
    record.scheduledYear ??= definition?.year ?? record.year;
    record.scheduledMonth ??= definition?.month ?? record.month;
  }
  if (
    nation.pendingHistoricalEventId &&
    (!getHistoricalEvent(nation.pendingHistoricalEventId) ||
      nation.history.historicalEvents.some(
        (record) => record.id === nation.pendingHistoricalEventId,
      ))
  ) {
    nation.pendingHistoricalEventId = null;
  }
}

/** 兼容旧调用名。 */
export const ensureHistoricalEventHistory = ensureHistoricalEventState;

function applyChoice(
  nation: NationState,
  event: HistoricalEventDefinition,
  choice: HistoricalEventChoice,
  recordDate = { year: event.year, month: event.month },
): HistoricalEventRecord {
  const resolvedEvent = contextualizeHistoricalEvent(event, nation);
  for (const [index, modifier] of choice.modifiers.entries()) {
    addModifier(nation, {
      id: `historical:${event.id}:${choice.id}:${index}`,
      sourceId: event.id,
      target: modifier.target,
      operation: modifier.operation,
      value: modifier.value,
      delayMonths: modifier.delayMonths ?? 0,
      remainingMonths: modifier.durationMonths ?? choice.durationMonths,
      stackRule: "stack",
    });
  }
  applyForeignAidEventAdjustment(
    nation,
    choice.foreignAidAdjustment,
    resolvedEvent.foreignAidAdjustment?.annualForeignExchangeRmbDelta ?? 0,
  );
  const record: HistoricalEventRecord = {
    id: event.id,
    name: event.name,
    year: recordDate.year,
    month: recordDate.month,
    scheduledYear: event.year,
    scheduledMonth: event.month,
    category: event.category,
    impact: event.impact,
    description: event.description,
    effects: [...choice.effects],
    durationMonths: choice.durationMonths,
    choiceId: choice.id,
    choiceName: choice.name,
    choiceDescription: choice.description,
    outcome: choice.outcome ?? "occurred",
  };
  nation.history.historicalEvents.push(record);
  ensureFiscalAgricultureTaxState(nation);
  nation.pendingHistoricalEventId = null;
  return record;
}

/** 在史实日期前主动实施一次性历史转折国策；原事件到期后不会重复触发。 */
export function enactHistoricalEventEarly(
  nation: NationState,
  eventId: string,
  initiativeId: string,
  initiativeName: string,
  transitionEffects: string[] = [],
): HistoricalEventRecord {
  ensureHistoricalEventState(nation);
  const event = getHistoricalEvent(eventId);
  if (!event) throw new Error(`未知历史事件：${eventId}`);
  if (nation.pendingHistoricalEventId) {
    throw new Error("请先处理当前待决策历史事件");
  }
  if (nation.history.historicalEvents.some((record) => record.id === eventId)) {
    throw new Error(`${event.name}已经发生或已被处理`);
  }
  const isBeforeSchedule = nation.date.year < event.year ||
    (nation.date.year === event.year && nation.date.month < event.month);
  if (!isBeforeSchedule) {
    throw new Error(`${event.name}只能在史实日期前作为国策提前实施`);
  }
  const historicalChoice = getHistoricalEventChoices(event, nation)[0];
  if (!historicalChoice) throw new Error(`${event.name}缺少历史实施方案`);
  return applyChoice(
    nation,
    event,
    {
      ...historicalChoice,
      id: `initiative:${initiativeId}`,
      name: initiativeName,
      description: `玩家在史实日期前主动实施“${initiativeName}”。`,
      effects: [...historicalChoice.effects, ...transitionEffects],
      outcome: "enacted_early",
    },
    { year: nation.date.year, month: nation.date.month },
  );
}

/** 条件型历史事件只在外部系统确认门槛达成后触发，不受史实日期自动结算。 */
export function triggerConditionalHistoricalEvent(
  nation: NationState,
  eventId: string,
  triggerId: string,
  triggerName: string,
  triggerEffects: string[] = [],
  outcomeOverride?: HistoricalEventOutcome,
): HistoricalEventRecord | null {
  ensureHistoricalEventState(nation);
  const event = getHistoricalEvent(eventId);
  if (!event) throw new Error(`未知历史事件：${eventId}`);
  if (event.triggerMode !== "conditional") {
    throw new Error(`${event.name}不是条件触发型历史事件`);
  }
  if (nation.pendingHistoricalEventId) {
    throw new Error("请先处理当前待决策历史事件");
  }
  if (nation.history.historicalEvents.some((record) => record.id === eventId)) {
    return null;
  }
  const historicalChoice = getHistoricalEventChoices(event, nation)[0];
  if (!historicalChoice) throw new Error(`${event.name}缺少历史实施方案`);
  const isBeforeSchedule = nation.date.year < event.year ||
    (nation.date.year === event.year && nation.date.month < event.month);
  return applyChoice(
    nation,
    event,
    {
      ...historicalChoice,
      id: `condition:${triggerId}`,
      name: triggerName,
      description: `相关历史进程和国际关系条件达成后自动触发“${event.name}”。`,
      effects: [...historicalChoice.effects, ...triggerEffects],
      outcome: outcomeOverride ?? (isBeforeSchedule ? "enacted_early" : "occurred"),
    },
    { year: nation.date.year, month: nation.date.month },
  );
}

export function resolveHistoricalEvent(
  nation: NationState,
  eventId: string,
  choiceId: string,
): HistoricalEventRecord {
  ensureHistoricalEventState(nation);
  if (nation.pendingHistoricalEventId !== eventId) {
    throw new Error("该历史事件当前不需要决策");
  }
  const event = getHistoricalEvent(eventId);
  if (!event) throw new Error(`未知历史事件：${eventId}`);
  if (event.year !== nation.date.year || event.month !== nation.date.month) {
    throw new Error("历史事件决策日期与当前模拟时间不一致");
  }
  const axisOptionIds = expandAxisChoiceId(eventId, choiceId);
  const choice = axisOptionIds
    ? composeHistoricalEventAxisChoice(event, axisOptionIds, nation)
    : getHistoricalEventChoices(event, nation).find(
      (candidate) => candidate.id === choiceId,
    );
  if (!choice) throw new Error(`未知历史事件方案：${choiceId}`);
  return applyChoice(nation, event, choice);
}

export function setHistoricalEventDecisionMode(
  nation: NationState,
  mode: HistoricalEventDecisionMode,
): HistoricalEventRecord | null {
  ensureHistoricalEventState(nation);
  nation.historicalEventDecisionMode = mode;
  if (mode === "automatic" && nation.pendingHistoricalEventId) {
    return resolveHistoricalEvent(
      nation,
      nation.pendingHistoricalEventId,
      "historical_path",
    );
  }
  return null;
}

/** 历史事件按年月确定触发；交互模式只登记待决策事件，不提前结算当月。 */
export function checkHistoricalEvents(nation: NationState): HistoricalEventRecord[] {
  ensureHistoricalEventState(nation);
  if (nation.pendingHistoricalEventId) return [];
  const occurredIds = new Set(
    nation.history.historicalEvents.map((event) => event.id),
  );
  const triggered: HistoricalEventRecord[] = [];
  for (const event of historicalEventDefinitions) {
    if (
      event.triggerMode === "conditional" ||
      event.year !== nation.date.year ||
      event.month !== nation.date.month ||
      occurredIds.has(event.id)
    ) {
      continue;
    }
    // 国策路径已永久废除农业税时，史实月自动入库，避免 interactive 再阻塞决策。
    if (
      event.id === AGRICULTURAL_TAX_ABOLITION_EVENT_ID
    ) {
      ensureFiscalAgricultureTaxState(nation);
      if (nation.fiscal.agriculturalTaxAbolished) {
        nation.pendingHistoricalEventId = event.id;
        triggered.push(
          resolveHistoricalEvent(nation, event.id, "historical_path"),
        );
        occurredIds.add(event.id);
        continue;
      }
    }
    nation.pendingHistoricalEventId = event.id;
    if (nation.historicalEventDecisionMode === "interactive") break;
    triggered.push(resolveHistoricalEvent(nation, event.id, "historical_path"));
  }
  return triggered;
}

export function historicalEventName(eventId: string): string | undefined {
  return getHistoricalEvent(eventId)?.name;
}
