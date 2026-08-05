"use client";

import { useEffect } from "react";
import {
  requiredVictoryYears,
  victoryPathDefinitions,
} from "@/src/simulation/victory/victory";
import {
  getGameDifficulty,
  getGameScenario,
  type GameState,
} from "@/src/simulation";

interface GameGoalDialogProps {
  open: boolean;
  game?: GameState | null;
  onConfirm: () => void;
}

/**
 * 进入游戏时展示的胜利目标说明。
 */
export function GameGoalDialog({ open, game, onConfirm }: GameGoalDialogProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;
  const scenario = game ? getGameScenario(game.nation.scenario.scenarioId) : null;
  const difficulty = game ? getGameDifficulty(game.nation.scenario.difficultyId) : null;

  return (
    <div className="game-goal-overlay" role="presentation">
      <section
        className="game-goal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-goal-title"
      >
        <header className="game-goal-header">
          <span className="eyebrow">游戏目标</span>
          <h2 id="game-goal-title">选择你的国家发展答案</h2>
          <p>
            你从 1949 年接手新中国，按月推进国家发展。三条路线会并行评估，
            任意路线满足全部门槛并连续保持 <strong>{requiredVictoryYears} 年</strong>即可获胜。
          </p>
        </header>
        {scenario && difficulty ? (
          <p className="game-goal-scenario">
            本局：{scenario.name} · {scenario.startYear}—{scenario.endYear} 年 · {difficulty.name}难度
          </p>
        ) : null}
        <div className="game-goal-paths">
          {victoryPathDefinitions.map((path) => (
            <article key={path.id}>
              <strong>{path.name}</strong>
              <p>{path.summary}</p>
              <span>{path.metrics.length} 项年度门槛</span>
            </article>
          ))}
        </div>
        <ul className="game-goal-points">
          <li>每年 12 月结算后更新路线进度，任何门槛失守都会中断连续年份</li>
          <li>达成目标后可继续推进时间，探索更高发展水平</li>
          <li>胜利页面可截图分享本局关键成绩</li>
        </ul>
        <div className="game-goal-actions">
          <button type="button" className="game-goal-primary" onClick={onConfirm}>
            开始执政
          </button>
        </div>
      </section>
    </div>
  );
}
