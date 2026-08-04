"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/src/simulation";
import { buildVictorySummary } from "@/src/ui/victory/victory-stats";
import { downloadPng } from "@/src/ui/share";

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
          <h2 id="victory-title">全球 GDP 第一</h2>
          <p>
            {summary.victoryYear} 年，中华人民共和国名义 GDP 跃居世界第一。
            你可以截图分享这一成就，也可以继续执政，追求更高的人均水平与发展质量。
          </p>
        </header>

        <article ref={captureRef} className="victory-poster" aria-label="胜利成绩海报">
          <div className="victory-poster-brand">
            <span className="victory-poster-mark">华</span>
            <div>
              <strong>中国国家发展模拟器</strong>
              <small>CHINA 1949</small>
            </div>
          </div>
          <div className="victory-poster-eyebrow">胜利 · {summary.victoryYear} 年</div>
          <h3 className="victory-poster-title">全球第一大经济体</h3>
          <div className="victory-poster-hero">
            <span>{summary.hero.label}</span>
            <strong>{summary.hero.value}</strong>
            {summary.hero.detail ? <small>{summary.hero.detail}</small> : null}
          </div>
          <div className="victory-poster-metrics">
            {summary.metrics.map((metric) => (
              <div key={metric.label} className="victory-poster-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                {metric.detail ? <small>{metric.detail}</small> : null}
              </div>
            ))}
          </div>
          <footer className="victory-poster-footer">
            <span>1949 起局 · 种子 {summary.seed}</span>
            <span>长按或下载图片即可分享</span>
          </footer>
        </article>

        <div className="victory-actions">
          <button
            type="button"
            className="victory-secondary"
            disabled={busy}
            onClick={() => {
              if (!captureRef.current) {
                setStatus("海报尚未就绪，请稍后重试");
                return;
              }
              setBusy(true);
              setStatus(null);
              void downloadPng(captureRef.current, fileName)
                .then((result) => setStatus(result.message))
                .finally(() => setBusy(false));
            }}
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
        {status ? <p className="victory-status">{status}</p> : null}
      </section>
    </div>
  );
}
