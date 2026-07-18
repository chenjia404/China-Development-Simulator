import historicalEventData from "../../data/config/historical-events.json";
import historicalDecisionData from "../../data/config/historical-event-decisions.json";
import historicalDependencyData from "../../data/config/historical-event-dependencies.json";
import type { ModifierState, NationState } from "../state/game-state";
import type { HistoricalEventRecord } from "../state/history-state";
import { addModifier } from "./modifiers";

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
export type HistoricalEventOutcome = "occurred" | "prevented" | "enacted_early";

export interface HistoricalEventModifierDefinition {
  target: string;
  operation: ModifierState["operation"];
  value: number;
}

export interface HistoricalEventDefinition {
  id: string;
  name: string;
  year: number;
  month: number;
  category: HistoricalEventCategory;
  impact: HistoricalEventImpact;
  description: string;
  effects: string[];
  durationMonths: number;
  modifiers: HistoricalEventModifierDefinition[];
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
}

interface HistoricalEventDecisionDefinition {
  eventId: string;
  choices: Array<Omit<HistoricalEventChoice, "isHistoricalPath">>;
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

function contextualizeHistoricalEvent(
  event: HistoricalEventDefinition,
  nation?: NationState,
): HistoricalEventDefinition {
  if (!nation) return event;
  const dependencies = historicalDependencyDefinitions.filter((dependency) => {
    if (dependency.eventId !== event.id) return false;
    const sourceRecord = nation.history.historicalEvents.find(
      (record) => record.id === dependency.sourceEventId,
    );
    return sourceRecord
      ? dependency.sourceChoiceIds.includes(sourceRecord.choiceId)
      : false;
  });
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
  };
}

export function getHistoricalEventChoices(
  eventOrId: HistoricalEventDefinition | string,
  nation?: NationState,
): HistoricalEventChoice[] {
  const baseEvent = typeof eventOrId === "string"
    ? getHistoricalEvent(eventOrId)
    : eventOrId;
  if (!baseEvent) return [];
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
  };
  const bespoke = historicalDecisionDefinitions.find(
    (definition) => definition.eventId === event.id,
  );
  const alternatives = bespoke
    ? bespoke.choices.map((choice) => ({ ...choice, isHistoricalPath: false }))
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
  for (const [index, modifier] of choice.modifiers.entries()) {
    addModifier(nation, {
      id: `historical:${event.id}:${choice.id}:${index}`,
      sourceId: event.id,
      target: modifier.target,
      operation: modifier.operation,
      value: modifier.value,
      remainingMonths: choice.durationMonths,
      stackRule: "replace",
    });
  }
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
  const choice = getHistoricalEventChoices(event, nation).find(
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
      event.year !== nation.date.year ||
      event.month !== nation.date.month ||
      occurredIds.has(event.id)
    ) {
      continue;
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
