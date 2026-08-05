"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpeningChoices } from "@/src/simulation";
import {
  diplomaticStrategyDefinitions,
  foreignPolicyDoctrineDefinitions,
  getEconomicMechanismPreset,
  listEconomicMechanismPresets,
  openingDevelopmentBlueprints,
} from "@/src/simulation";

const STEPS = [
  { id: "mechanism", title: "经济机制" },
  { id: "strategy", title: "外交战略" },
  { id: "doctrine", title: "外交学说" },
  { id: "blueprint", title: "发展蓝图" },
] as const;

const DEFAULT_CHOICES: OpeningChoices = {
  economicMechanism: "planned",
  diplomaticStrategyId: "balanced",
  foreignPolicyDoctrineId: "status_quo",
  developmentBlueprintId: "heavy_industry_priority",
};

interface OpeningSetupDialogProps {
  open: boolean;
  busy?: boolean;
  onConfirm: (choices: OpeningChoices) => void | Promise<void>;
}

/**
 * 新建游戏时的开局路线选择：经济机制、外交战略、外交学说与发展蓝图。
 */
export function OpeningSetupDialog({
  open,
  busy = false,
  onConfirm,
}: OpeningSetupDialogProps) {
  if (!open) return null;
  return <OpeningSetupDialogContent busy={busy} onConfirm={onConfirm} />;
}

function OpeningSetupDialogContent({
  busy,
  onConfirm,
}: {
  busy: boolean;
  onConfirm: (choices: OpeningChoices) => void | Promise<void>;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [choices, setChoices] = useState<OpeningChoices>(DEFAULT_CHOICES);
  const mechanisms = useMemo(() => listEconomicMechanismPresets(), []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const selectedMechanism = getEconomicMechanismPreset(choices.economicMechanism);
  const selectedStrategy = diplomaticStrategyDefinitions.find(
    (item) => item.id === choices.diplomaticStrategyId,
  );
  const selectedDoctrine = foreignPolicyDoctrineDefinitions.find(
    (item) => item.id === choices.foreignPolicyDoctrineId,
  );
  const selectedBlueprint = openingDevelopmentBlueprints.find(
    (item) => item.id === choices.developmentBlueprintId,
  );

  return (
    <div className="game-goal-overlay opening-setup-overlay" role="presentation">
      <section
        className="game-goal-modal opening-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="opening-setup-title"
      >
        <header className="game-goal-header">
          <span className="eyebrow">开局路线 · {stepIndex + 1}/{STEPS.length}</span>
          <h2 id="opening-setup-title">选定建国初期路线</h2>
          <p>
            这些选择写入 1949 年初始状态；开局后仍可在国策中心与外交页按冷却与过渡规则调整。
          </p>
        </header>

        <nav className="opening-setup-steps" aria-label="开局选择步骤">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={
                index === stepIndex
                  ? "opening-setup-step is-active"
                  : index < stepIndex
                    ? "opening-setup-step is-done"
                    : "opening-setup-step"
              }
              onClick={() => setStepIndex(index)}
              disabled={busy}
            >
              {item.title}
            </button>
          ))}
        </nav>

        <div className="opening-setup-body">
          <h3>{step.title}</h3>
          {step.id === "mechanism" && (
            <div className="opening-setup-options">
              {mechanisms.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    choices.economicMechanism === preset.id
                      ? "opening-setup-card is-selected"
                      : "opening-setup-card"
                  }
                  onClick={() =>
                    setChoices((current) => ({
                      ...current,
                      economicMechanism: preset.id,
                    }))
                  }
                  disabled={busy}
                >
                  <strong>{preset.name}</strong>
                  <p>{preset.summary}</p>
                </button>
              ))}
            </div>
          )}

          {step.id === "strategy" && (
            <div className="opening-setup-options">
              {diplomaticStrategyDefinitions.map((strategy) => (
                <button
                  key={strategy.id}
                  type="button"
                  className={
                    choices.diplomaticStrategyId === strategy.id
                      ? "opening-setup-card is-selected"
                      : "opening-setup-card"
                  }
                  onClick={() =>
                    setChoices((current) => ({
                      ...current,
                      diplomaticStrategyId: strategy.id,
                    }))
                  }
                  disabled={busy}
                >
                  <strong>{strategy.name}</strong>
                  <p>{strategy.description}</p>
                  <ul>
                    {strategy.effects.slice(0, 3).map((effect) => (
                      <li key={effect}>{effect}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          )}

          {step.id === "doctrine" && (
            <div className="opening-setup-options">
              {foreignPolicyDoctrineDefinitions.map((doctrine) => (
                <button
                  key={doctrine.id}
                  type="button"
                  className={
                    choices.foreignPolicyDoctrineId === doctrine.id
                      ? "opening-setup-card is-selected"
                      : "opening-setup-card"
                  }
                  onClick={() =>
                    setChoices((current) => ({
                      ...current,
                      foreignPolicyDoctrineId: doctrine.id,
                    }))
                  }
                  disabled={busy}
                >
                  <strong>{doctrine.name}</strong>
                  <p>{doctrine.description}</p>
                  <ul>
                    {doctrine.effects.slice(0, 3).map((effect) => (
                      <li key={effect}>{effect}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          )}

          {step.id === "blueprint" && (
            <div className="opening-setup-options">
              {openingDevelopmentBlueprints.map((blueprint) => (
                <button
                  key={blueprint.id}
                  type="button"
                  className={
                    choices.developmentBlueprintId === blueprint.id
                      ? "opening-setup-card is-selected"
                      : "opening-setup-card"
                  }
                  onClick={() =>
                    setChoices((current) => ({
                      ...current,
                      developmentBlueprintId: blueprint.id,
                    }))
                  }
                  disabled={busy}
                >
                  <strong>{blueprint.name}</strong>
                  {blueprint.eraNote ? <small>{blueprint.eraNote}</small> : null}
                  <p>{blueprint.summary}</p>
                  <p className="opening-setup-meta">
                    收益：{blueprint.strengths.join("、")}
                  </p>
                  <p className="opening-setup-meta">
                    代价：{blueprint.tradeoffs.join("、")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {isLast && (
          <aside className="opening-setup-summary">
            <span className="eyebrow">本局摘要</span>
            <p>
              {selectedMechanism.name} · {selectedStrategy?.shortName ?? selectedStrategy?.name} ·{" "}
              {selectedDoctrine?.shortName ?? selectedDoctrine?.name} · {selectedBlueprint?.name}
            </p>
          </aside>
        )}

        <div className="opening-setup-actions">
          <button
            type="button"
            className="opening-setup-secondary"
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            disabled={busy || stepIndex === 0}
          >
            上一步
          </button>
          {!isLast ? (
            <button
              type="button"
              className="game-goal-primary"
              onClick={() => setStepIndex((index) => Math.min(STEPS.length - 1, index + 1))}
              disabled={busy}
            >
              下一步
            </button>
          ) : (
            <button
              type="button"
              className="game-goal-primary"
              onClick={() => void onConfirm(choices)}
              disabled={busy}
            >
              {busy ? "创建中…" : "确认开局路线"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
