import type { ShareCardPayload } from "@/src/ui/share";
import { SHARE_BRAND, SHARE_SLOGAN } from "@/src/ui/share";
import { forwardRef } from "react";

interface SharePosterProps {
  card: ShareCardPayload;
}

export const SharePoster = forwardRef<HTMLElement, SharePosterProps>(
  function SharePoster({ card }, ref) {
    const typeLabel =
      card.type === "score" ? "成绩卡" : card.type === "milestone" ? "里程碑" : "对比卡";

    return (
      <article ref={ref} className="share-poster" data-share-type={card.type}>
        <header className="share-poster-brand">
          <div className="share-poster-mark">中</div>
          <div>
            <strong>{SHARE_BRAND}</strong>
            <p>{SHARE_SLOGAN}</p>
          </div>
        </header>

        <div className="share-poster-eyebrow">{typeLabel}</div>
        <h2 className="share-poster-title">{card.title}</h2>
        <p className="share-poster-subtitle">{card.subtitle}</p>

        {card.type === "milestone" ? (
          <p className="share-poster-milestone-desc">{card.milestone.description}</p>
        ) : null}

        <div className="share-poster-hero">
          <span>{card.hero.label}</span>
          <strong>{card.hero.value}</strong>
          {card.hero.detail ? <small>{card.hero.detail}</small> : null}
        </div>

        {card.metrics.length > 0 ? (
          <div className="share-poster-metrics">
            {card.metrics.map((metric) => (
              <div key={`${metric.label}-${metric.value}`} className="share-poster-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                {metric.detail ? <small>{metric.detail}</small> : null}
              </div>
            ))}
          </div>
        ) : null}

        <footer className="share-poster-footer">
          <span>手机竖屏海报 · 1949 起局</span>
          <span>长按图片即可转发</span>
        </footer>
      </article>
    );
  },
);
