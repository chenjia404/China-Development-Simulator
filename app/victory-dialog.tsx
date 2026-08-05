"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/src/simulation";
import { buildVictorySummary } from "@/src/ui/victory/victory-stats";
import { downloadPng } from "@/src/ui/share";
import { VictoryPoster } from "./victory-poster";

interface VictoryDialogProps {
  game: GameState;
  open: boolean;
  onContinue: () => void;
}

export function VictoryDialog({ game, open, onContinue }: VictoryDialogProps) {
  const captureRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const summary = buildVictorySummary(game);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onContinue();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onContinue, open]);

  if (!open || !summary) return null;

  const fileName = `china-dev-sim-victory-${summary.victoryYear}.png`;

  const handleDownload = () => {
    if (busy) return;
    if (!captureRef.current) {
      setStatus("海报尚未就绪，请稍后重试");
      return;
    }
    setBusy(true);
    setStatus(null);
    void downloadPng(captureRef.current, fileName, {
      backgroundColor: "#0f1f3d",
    })
      .then((result) => setStatus(result.message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="victory-overlay" role="presentation">
      <section
        className="victory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="victory-title"
      >
        <header className="victory-header">
          <span className="eyebrow">胜利</span>
          <h2 id="victory-title">{summary.pathName}</h2>
          <p>
            {summary.victoryYear} 年，中华人民共和国连续五年完成这条路线的全部目标。
            {summary.pathSummary}你可以下载手机竖屏海报分享成就，也可以继续执政，挑战其余国家目标。
          </p>
        </header>

        <div className="victory-preview-shell">
          <div className="victory-preview-scaler">
            <div className="victory-poster-capture">
              <VictoryPoster summary={summary} />
            </div>
          </div>
        </div>

        {/* 不受预览缩放 transform 影响的离屏节点，专供出图 */}
        <div className="victory-poster-offscreen" aria-hidden="true">
          <VictoryPoster ref={captureRef} summary={summary} />
        </div>

        <div className="victory-actions">
          <button
            type="button"
            className="victory-secondary"
            disabled={busy}
            onClick={handleDownload}
          >
            下载截图
          </button>
          <button
            type="button"
            className="victory-primary"
            disabled={busy}
            onClick={onContinue}
          >
            继续执政
          </button>
        </div>
        {status ? <p className="victory-status" role="status">{status}</p> : null}
      </section>
    </div>
  );
}
