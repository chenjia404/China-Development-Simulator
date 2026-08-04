"use client";

import { useEffect } from "react";

interface GameGoalDialogProps {
  open: boolean;
  onConfirm: () => void;
}

/**
 * 进入游戏时展示的胜利目标说明。
 */
export function GameGoalDialog({ open, onConfirm }: GameGoalDialogProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

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
          <h2 id="game-goal-title">让中国成为全球第一大经济体</h2>
          <p>
            你从 1949 年接手新中国，按月推进国家发展。通过国策、财政、外交与产业政策，
            逐步提升经济总量，最终在<strong>全球名义 GDP 排名</strong>中登顶第一，即可获胜。
          </p>
        </header>
        <ul className="game-goal-points">
          <li>排名在每年 12 月年度结算后更新</li>
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
