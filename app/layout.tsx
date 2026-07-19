import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "中国国家发展模拟器";
const description = "从 1949 年开始经营国家，以确定性月度模型探索不同发展道路。";

export async function generateMetadata(): Promise<Metadata> {
  let imageUrl = "/og.png";
  if (process.env.STATIC_EXPORT !== "true") {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") ??
      requestHeaders.get("host") ??
      "localhost:3000";
    const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
    const protocol = forwardedProtocol === "http" ? "http" :
      host.startsWith("localhost") ? "http" : "https";
    imageUrl = `${protocol}://${host}/og.png`;
  }
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      images: [{ url: imageUrl, width: 1728, height: 907, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
