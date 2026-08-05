"use client";

import { getFutureDecision, type GameState } from "@/src/simulation";
import { useSimulationStore } from "@/src/ui/simulation-store";

interface FutureDecisionDialogProps {
  game: GameState;
  busy: boolean;
}

export function FutureDecisionDialog({ game, busy }: FutureDecisionDialogProps) {
  const decisionId = game.nation.futureEra.pendingDecisionId;
  const decision = decisionId ? getFutureDecision(decisionId) : undefined;
  const resolveFutureDecision = useSimulationStore(
    (state) => state.resolveFutureDecision,
  );
  if (!decision) return null;

  const future = game.nation.futureEra;
  return (
    <div className="future-decision-overlay" role="presentation">
      <section
        className="future-decision-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="future-decision-title"
      >
        <header>
          <span className="eyebrow">未来情景 · {decision.year}</span>
          <h2 id="future-decision-title">{decision.name}</h2>
          <p>{decision.description}</p>
        </header>
        <div className="future-pressure-strip">
          <span>气候风险 {(future.climateRisk * 100).toFixed(0)}%</span>
          <span>老龄压力 {(future.ageingPressure * 100).toFixed(0)}%</span>
          <span>智能扩散 {(future.aiDiffusion * 100).toFixed(0)}%</span>
          <span>清洁转型 {(future.cleanEnergyTransition * 100).toFixed(0)}%</span>
        </div>
        <div className="future-choice-grid">
          {decision.choices.map((choice) => (
            <article key={choice.id}>
              <h3>{choice.name}</h3>
              <p>{choice.description}</p>
              <ul>{choice.effects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolveFutureDecision(decision.id, choice.id)}
              >
                {busy ? "处理中…" : "选择此方案"}
              </button>
            </article>
          ))}
        </div>
        <p className="future-decision-note">
          未来节点是基于趋势的情景推演，不代表现实预测；选择会通过人口、资源、财政、技术和社会中间变量逐步传导。
        </p>
      </section>
    </div>
  );
}
