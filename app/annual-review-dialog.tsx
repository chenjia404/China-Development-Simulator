"use client";

import { useMemo, useState } from "react";
import {
  annualReviewRequiresNewPlan,
  maximumFiveYearPriorities,
  strategicPriorityDefinitions,
  type GameState,
  type StrategicPriorityId,
} from "@/src/simulation";
import { useSimulationStore } from "@/src/ui/simulation-store";

interface AnnualReviewDialogProps {
  game: GameState;
  busy: boolean;
}

export function AnnualReviewDialog({ game, busy }: AnnualReviewDialogProps) {
  const planning = game.nation.strategicPlanning;
  const reviewYear = planning.pendingReviewYear;
  const report = useMemo(
    () => game.nation.history.reports.find((item) => item.year === reviewYear),
    [game.nation.history.reports, reviewYear],
  );
  const requiresNewPlan = annualReviewRequiresNewPlan(game.nation);
  const [annualFocusId, setAnnualFocusId] = useState<StrategicPriorityId>(
    (planning.annualFocusId as StrategicPriorityId | null) ??
      (planning.priorityIds[0] as StrategicPriorityId | undefined) ??
      strategicPriorityDefinitions[0].id,
  );
  const [planPriorityIds, setPlanPriorityIds] = useState<StrategicPriorityId[]>(
    planning.priorityIds.filter((id): id is StrategicPriorityId =>
      strategicPriorityDefinitions.some((item) => item.id === id),
    ),
  );
  const resolveAnnualReview = useSimulationStore((state) => state.resolveAnnualReview);

  if (reviewYear === null || !report) return null;

  const togglePlanPriority = (priorityId: StrategicPriorityId) => {
    setPlanPriorityIds((current) => {
      if (current.includes(priorityId)) {
        return current.filter((id) => id !== priorityId);
      }
      if (current.length >= maximumFiveYearPriorities) return current;
      return [...current, priorityId];
    });
  };
  const canConfirm = !busy && (!requiresNewPlan || planPriorityIds.length > 0);

  return (
    <div className="annual-review-overlay" role="presentation">
      <section
        className="annual-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="annual-review-title"
      >
        <header className="annual-review-header">
          <span className="eyebrow">年度复盘 · {reviewYear}</span>
          <h2 id="annual-review-title">国家发展年度报告</h2>
          <p>先复盘结果与原因，再确定下一年度重点。五年规划到期时才能重选长期方向。</p>
        </header>

        <div className="annual-review-summary">
          {report.highlights.map((item) => <div key={item}>{item}</div>)}
        </div>

        <div className="annual-review-columns">
          <section>
            <h3>主要传导原因</h3>
            {report.causalDrivers.map((driver) => (
              <article key={`${driver.label}:${driver.detail}`} className={`annual-driver is-${driver.tone}`}>
                <strong>{driver.label}</strong>
                <p>{driver.detail}</p>
              </article>
            ))}
            {report.majorEvents.length > 0 ? (
              <p className="annual-review-note">重大事件：{report.majorEvents.join("、")}</p>
            ) : null}
          </section>
          <section>
            <h3>风险预警</h3>
            <ul>{report.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
          </section>
        </div>

        <section className="annual-focus-section">
          <div>
            <h3>下一年度重点</h3>
            <p>选择一项额外聚焦方向，有效期为十二个月。</p>
          </div>
          <div className="annual-priority-grid">
            {strategicPriorityDefinitions.map((priority) => (
              <button
                type="button"
                key={priority.id}
                className={annualFocusId === priority.id ? "is-selected" : ""}
                onClick={() => setAnnualFocusId(priority.id)}
                disabled={busy}
              >
                <strong>{priority.name}</strong>
                <span>{priority.summary}</span>
              </button>
            ))}
          </div>
        </section>

        {requiresNewPlan ? (
          <section className="five-year-plan-section">
            <div>
              <h3>制定下一轮五年规划</h3>
              <p>选择一至 {maximumFiveYearPriorities} 项长期重点，规划期为 {reviewYear + 1}—{reviewYear + 5} 年。</p>
            </div>
            <div className="annual-priority-grid">
              {strategicPriorityDefinitions.map((priority) => {
                const selected = planPriorityIds.includes(priority.id);
                return (
                  <button
                    type="button"
                    key={priority.id}
                    className={selected ? "is-selected" : ""}
                    onClick={() => togglePlanPriority(priority.id)}
                    disabled={busy || (!selected && planPriorityIds.length >= maximumFiveYearPriorities)}
                  >
                    <strong>{priority.name}</strong>
                    <span>{selected ? "已纳入规划" : priority.summary}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="annual-review-note">
            当前五年规划：{planning.planStartYear}—{planning.planEndYear} 年；长期重点保持不变。
          </p>
        )}

        <footer className="annual-review-actions">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void resolveAnnualReview(
              annualFocusId,
              requiresNewPlan ? planPriorityIds : undefined,
            )}
          >
            确认年度重点并继续
          </button>
        </footer>
      </section>
    </div>
  );
}
