import {
  SHARE_POSTER_HEIGHT,
  SHARE_POSTER_WIDTH,
} from "./share-brand";

export interface ShareActionResult {
  ok: boolean;
  mode: "downloaded" | "native" | "clipboard" | "fallback" | "cancelled" | "error";
  message: string;
}

function triggerDownload(href: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** 将海报 DOM 渲染为 PNG data URL。 */
export async function renderPosterDataUrl(element: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  // 等一帧，避免刚切换卡片类型时字体/布局未完成就截图
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  try {
    return await toPng(element, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#f7f4ef",
      width: SHARE_POSTER_WIDTH,
      height: SHARE_POSTER_HEIGHT,
      style: {
        transform: "none",
        margin: "0",
        opacity: "1",
      },
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? `生成海报失败：${error.message}` : "生成海报失败",
    );
  }
}

export async function downloadPng(
  element: HTMLElement,
  fileName: string,
): Promise<ShareActionResult> {
  try {
    const dataUrl = await renderPosterDataUrl(element);
    triggerDownload(dataUrl, fileName);
    return {
      ok: true,
      mode: "downloaded",
      message: "海报已下载",
    };
  } catch (error) {
    return {
      ok: false,
      mode: "error",
      message: error instanceof Error ? error.message : "生成海报失败",
    };
  }
}

export async function copyText(text: string): Promise<ShareActionResult> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const succeeded = document.execCommand("copy");
      textarea.remove();
      if (!succeeded) throw new Error("浏览器不支持剪贴板写入");
    }
    return {
      ok: true,
      mode: "clipboard",
      message: "文案已复制到剪贴板",
    };
  } catch (error) {
    return {
      ok: false,
      mode: "error",
      message: error instanceof Error ? error.message : "复制文案失败",
    };
  }
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, body = ""] = dataUrl.split(",", 2);
  const isBase64 = header.includes(";base64");
  const binary = isBase64 ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], fileName, { type: "image/png" });
}

/**
 * 优先带图调用系统分享；不支持文件时退回纯文案；
 * 再不行则下载图片并复制剪贴板文案（优先 clipboardText，便于带上链接）。
 */
export async function shareNative(options: {
  element: HTMLElement;
  fileName: string;
  title: string;
  text: string;
  /** 降级复制时使用；默认回退到 text。 */
  clipboardText?: string;
  url?: string;
}): Promise<ShareActionResult> {
  const clipboardPayload = options.clipboardText ?? options.text;
  try {
    if (typeof navigator.share !== "function") {
      const download = await downloadPng(options.element, options.fileName);
      if (!download.ok) return download;
      const copied = await copyText(clipboardPayload);
      return {
        ok: true,
        mode: "fallback",
        message: copied.ok
          ? "已下载图片并复制文案，请手动发到社交网络"
          : "已下载图片；复制文案失败，请手动编写分享内容",
      };
    }

    const dataUrl = await renderPosterDataUrl(options.element);
    const file = dataUrlToFile(dataUrl, options.fileName);
    const withFiles = {
      title: options.title,
      text: options.text,
      url: options.url,
      files: [file],
    };

    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share(withFiles);
      return {
        ok: true,
        mode: "native",
        message: "已打开系统分享",
      };
    }

    await navigator.share({
      title: options.title,
      text: options.text,
      url: options.url,
    });
    return {
      ok: true,
      mode: "native",
      message: "已打开系统分享（当前环境不支持直接分享图片）",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        mode: "cancelled",
        message: "已取消分享",
      };
    }
    return {
      ok: false,
      mode: "error",
      message: error instanceof Error ? error.message : "系统分享失败",
    };
  }
}
