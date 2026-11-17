import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Marketing OS",
  title: "Marketing OS",
  description:
    "Marketing OS 多品牌營銷、Lead、預約及客戶營運系統。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Marketing OS",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#5a2348",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-HK" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
