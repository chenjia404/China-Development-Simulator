"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComparisonTargetId, GameState } from "@/src/simulation";
import {
  availableComparisonTargets,
  availableShareMilestones,
  buildSharePayload,
  copyText,
  downloadPng,
  SHARE_BRAND,
  shareNative,
  type ShareCardType,
} from "@/src/ui/share";
import { SharePoster } from "./share-poster";
import "./share.css";

interface ShareDialogProps {
  game: GameState;
  open: boolean;
  onClose: () => void;
}

const cardTypeOptions: Array<{ id: ShareCardType; label: string }> = [
  { id: "score", label: "成绩卡" },
  { id: "milestone", label: "里程碑" },
  { id: "compare", label: "对比卡" },
];

function resolveMilestoneId(
  milestones: ReturnType<typeof availableShareMilestones>,
  preferred: string | null,
): string | null {
  if (milestones.length === 0) return null;
  if (preferred && milestones.some((item) => item.id === preferred)) {
    return preferred;
  }
  return milestones[0]?.id ?? null;
}

export function ShareDialog({ game, open, onClose }: ShareDialogProps) {
  const captureRef = useRef<HTMLElement>(null);
  const [cardType, setCardType] = useState<ShareCardType>("score");
  const [comparisonTargetId, setComparisonTargetId] =
    useState<ComparisonTargetId>("history");
  const [preferredMilestoneId, setPreferredMilestoneId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const milestones = useMemo(() => availableShareMilestones(game), [game]);
  const milestoneId = resolveMilestoneId(milestones, preferredMilestoneId);
  const pageUrl = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}`
    : undefined;

  const payload = useMemo(
    () =>
      buildSharePayload(game, {
        cardType,
        comparisonTargetId,
        milestoneId,
        pageUrl,
      }),
    [cardType, comparisonTargetId, game, milestoneId, pageUrl],
  );

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
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const runAction = async (
    action: () => Promise<{ ok: boolean; message: string }>,
    options: { requirePoster?: boolean } = {},
  ) => {
    if (busy) return;
    const requirePoster = options.requirePoster ?? true;
    if (requirePoster && !captureRef.current) {
      setStatus("海报尚未就绪，请稍后重试");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const result = await action();
      setStatus(result.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="share-dialog-overlay"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-dialog-header">
          <div>
            <span className="eyebrow">社交分享</span>
            <h2 id="share-dialog-title">分享本局海报</h2>
            <p>按手机竖屏排版，可系统分享、下载或复制短文案。</p>
          </div>
          <button
            type="button"
            className="share-dialog-close"
            onClick={onClose}
            disabled={busy}
          >
            关闭
          </button>
        </div>

        <div className="share-type-tabs" role="tablist" aria-label="海报类型">
          {cardTypeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={cardType === option.id}
              className={cardType === option.id ? "is-active" : undefined}
              onClick={() => {
                setCardType(option.id);
                setStatus(null);
              }}
              disabled={busy}
            >
              {option.label}
            </button>
          ))}
        </div>

        {cardType === "milestone" ? (
          milestones.length > 0 ? (
            <label className="share-option-row">
              <span>已达成里程碑</span>
              <select
                value={milestoneId ?? ""}
                disabled={busy}
                onChange={(event) => setPreferredMilestoneId(event.target.value)}
              >
                {milestones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reachedYear} · {item.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="share-option-hint">
              尚未达成可分享的里程碑，将自动改用成绩卡预览。继续推进并完成年度结算后，再看排名、年份与发展节点。
            </p>
          )
        ) : null}

        {cardType === "compare" ? (
          <label className="share-option-row">
            <span>对标对象</span>
            <select
              value={comparisonTargetId}
              disabled={busy}
              onChange={(event) =>
                setComparisonTargetId(event.target.value as ComparisonTargetId)
              }
            >
              {availableComparisonTargets().map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {payload.effectiveType !== cardType ? (
          <p className="share-option-hint">
            {cardType === "compare"
              ? "当前尚无比对年份数据，已回退为成绩卡预览。"
              : "已回退为成绩卡预览。"}
          </p>
        ) : null}

        <div className="share-preview-shell">
          <div className="share-preview-scaler">
            <div className="share-poster-capture" aria-hidden>
              <SharePoster card={payload.card} />
            </div>
          </div>
        </div>

        {/* 不受预览缩放 transform 影响的离屏节点，专供出图（避免 opacity:0，否则部分浏览器截图空白） */}
        <div className="share-poster-offscreen" aria-hidden>
          <SharePoster ref={captureRef} card={payload.card} />
        </div>

        <div className="share-dialog-actions">
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                if (!captureRef.current) {
                  return { ok: false, message: "海报尚未就绪" };
                }
                return shareNative({
                  element: captureRef.current,
                  fileName: payload.fileName,
                  title: SHARE_BRAND,
                  text: payload.shareText,
                  clipboardText: payload.copyText,
                  url: pageUrl,
                });
              })
            }
          >
            系统分享
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                if (!captureRef.current) {
                  return { ok: false, message: "海报尚未就绪" };
                }
                return downloadPng(captureRef.current, payload.fileName);
              })
            }
          >
            下载图片
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runAction(() => copyText(payload.copyText), { requirePoster: false })
            }
          >
            复制文案
          </button>
        </div>

        {status ? <p className="share-dialog-status">{status}</p> : null}
      </div>
    </div>
  );
}
