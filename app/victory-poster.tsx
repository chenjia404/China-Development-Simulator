import { forwardRef } from "react";
import type { VictorySummary } from "@/src/ui/victory/victory-stats";
import { SHARE_BRAND, SHARE_SLOGAN } from "@/src/ui/share";

interface VictoryPosterProps {
  summary: VictorySummary;
}

/** 手机竖屏胜利海报（1080×1440），专供预览与下载出图。 */
export const VictoryPoster = forwardRef<HTMLElement, VictoryPosterProps>(
  function VictoryPoster({ summary }, ref) {
    return (
      <article ref={ref} className="victory-poster" aria-label="胜利成绩海报">
        <header className="victory-poster-brand">
          <span className="victory-poster-mark">华</span>
          <div>
            <strong>{SHARE_BRAND}</strong>
            <p>{SHARE_SLOGAN}</p>
          </div>
        </header>

        <div className="victory-poster-eyebrow">胜利 · {summary.victoryYear} 年</div>
        <h3 className="victory-poster-title">全球第一大经济体</h3>
        <p className="victory-poster-subtitle">
          自 1949 年起局，历时 {summary.yearsPlayed} 年登顶
        </p>

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
          <span>手机竖屏海报 · 下载图片即可分享</span>
        </footer>
      </article>
    );
  },
);
