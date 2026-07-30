"use client";

import { useEffect } from "react";

/** GitHub 仓库源码压缩包（默认分支 master）。 */
export const SOURCE_REPO_ZIP_URL =
  "https://github.com/chenjia404/China-Development-Simulator/archive/refs/heads/master.zip";

export const SOURCE_REPO_URL =
  "https://github.com/chenjia404/China-Development-Simulator";

interface SourceNoticeDialogProps {
  open: boolean;
  onConfirm: () => void;
}

/**
 * 每次进入页面时展示的提示弹窗。
 * 确认后关闭；下载源码会拉取仓库 ZIP，不关闭弹窗。
 */
export function SourceNoticeDialog({ open, onConfirm }: SourceNoticeDialogProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const downloadSource = () => {
    // GitHub 跨域 ZIP 由浏览器直接拉取；新标签打开可避免当前页被导航打断。
    window.open(SOURCE_REPO_ZIP_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="source-notice-overlay" role="presentation">
      <section
        className="source-notice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-notice-title"
      >
        <header className="source-notice-header">
          <span className="eyebrow">开源提示</span>
          <h2 id="source-notice-title">如果对本模拟游戏的不满意，请自行用 AI 修改。</h2>
          <p>
            本项目源码已在 GitHub 公开，可自由下载后用 AI 助手按自己的想法调整国策、事件与界面。
          </p>
        </header>
        <div className="source-notice-actions">
          <button type="button" className="source-notice-secondary" onClick={downloadSource}>
            下载源码
          </button>
          <button type="button" className="source-notice-primary" onClick={onConfirm}>
            确认
          </button>
        </div>
        <p className="source-notice-repo">
          仓库地址：
          <a href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer">
            {SOURCE_REPO_URL}
          </a>
        </p>
      </section>
    </div>
  );
}
